import {
  INPUTS,
  dbGain,
  inputGain,
  levelGain,
  powered,
  reverbProgram,
  toDb,
  type InputId,
  type MixerState,
  type SourceKind,
} from "./state";

export type ListenBus = "speakers" | "monitor" | "sub";
export type Readings = {
  speakers: number;
  monitor: number;
  sub: number;
  reverb: number;
  preLimiter: number;
  notches: number[];
  left: number;
  right: number;
  listening: number;
};
export const emptyReadings = (): Readings => ({
  speakers: -120,
  monitor: -120,
  sub: -120,
  reverb: -120,
  preLimiter: -120,
  notches: [],
  left: -120,
  right: -120,
  listening: -120,
});

/** Repeatable, quiet practice material. These are synthetic sounds, not recordings. */
function generatedBuffer(context: AudioContext, kind: SourceKind): AudioBuffer {
  const seconds = 4;
  const buffer = context.createBuffer(
    2,
    context.sampleRate * seconds,
    context.sampleRate,
  );
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let seed = 9183;
    for (let i = 0; i < data.length; i++) {
      const t = i / context.sampleRate;
      const beat = Math.floor(t * 2);
      const phase = t % 0.5;
      const sine = (hz: number) => Math.sin(2 * Math.PI * hz * t);
      let value = 0;
      if (kind === "voice" || kind === "condenser") {
        const syllable = Math.max(0, Math.sin((Math.PI * (t % 0.5)) / 0.4));
        value =
          0.007 *
          syllable ** 2 *
          (sine(104) + 0.6 * sine(208) + 0.3 * sine(728) + 0.12 * sine(1352));
      } else if (kind === "guitar") {
        const hz = [110, 146, 164, 196][Math.floor(beat / 2) % 4];
        value =
          0.12 *
          Math.exp(-phase * 8) *
          (sine(hz) + 0.4 * sine(hz * 2) + 0.2 * sine(hz * 4));
      } else if (kind === "keyboard") {
        const notes = channel ? [330, 392, 440, 392] : [220, 262, 294, 262];
        value =
          0.11 *
          Math.sin((Math.PI * phase) / 0.5) ** 0.3 *
          (sine(notes[beat % 4]) + 0.25 * sine(notes[beat % 4] * 2));
      } else if (kind === "music") {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const kick = Math.sin(2 * Math.PI * 55 * phase) * Math.exp(-phase * 25);
        const bass =
          sine([55, 66, 74, 66][Math.floor(beat / 2)]) * Math.exp(-phase * 3);
        const hat = (seed / 2147483648 - 1) * Math.exp(-(t % 0.25) * 90);
        value =
          0.12 *
          (kick +
            0.6 * bass +
            0.3 * hat +
            0.2 * sine(channel ? 660 : 440) * Math.exp(-phase * 9));
      } else if (kind === "tone") value = 0.13 * sine(1000);
      else if (kind === "bass") value = 0.13 * sine(80);
      else if (kind === "feedback") value = 0.1 * sine(1100);
      data[i] = value;
    }
  }
  return buffer;
}

type InputPath = {
  gate: GainNode;
  loading: BiquadFilterNode;
  source: AudioBufferSourceNode | null;
  key: string;
};
type ChannelPath = {
  high: BiquadFilterNode;
  low: BiquadFilterNode;
  level: GainNode;
  stereo: GainNode;
  mono: GainNode;
  send: GainNode;
};

/** Owns one Web Audio graph. React owns settings, never nodes or audio sample data.
 * Monitor branches before the speaker DSP/master; the listening attenuator is last
 * and deliberately excluded from every meter tap.
 */
export class StagepasAudio {
  readonly context = new AudioContext();
  private inputs = new Map<InputId, InputPath>();
  private channels: ChannelPath[] = [];
  private buffers = new Map<SourceKind, AudioBuffer>();
  private files = new Map<InputId, AudioBuffer>();
  private fileRevisions = new Map<InputId, number>();
  private mix = this.gain();
  private fxSend = this.gain();
  private fxWet = this.gain();
  private convolution = this.context.createConvolver();
  private convolutionGain = this.gain();
  private echo = this.context.createDelay(1);
  private echoFeedback = this.gain();
  private echoGain = this.gain();
  private programKey = "";
  private feedbackTap = this.analyser();
  private notches = Array.from({ length: 7 }, () =>
    this.filter("peaking", 1000),
  );
  private notchFrequencies: number[] = [];
  private nextDetectionAt = 0;
  private masterLow = this.filter("lowshelf", 130);
  private masterHigh = this.filter("highshelf", 3500);
  private master = this.gain();
  private speakerHighPass = this.filter("highpass", 10);
  private subLowPass = this.filter("lowpass", 120);
  private subMono = this.gain(1);
  private subGate = this.gain();
  private monitor = this.gain();
  private monitorMono = this.gain(1);
  private monitorStereoGate = this.gain();
  private monitorMonoGate = this.gain();
  private monitorPlugs = this.context.createChannelMerger(2);
  private speakerPlugs = this.context.createChannelMerger(2);
  private limiter = this.context.createDynamicsCompressor();
  private peakCeiling = this.context.createWaveShaper();
  private leftPlug = this.gain(1);
  private rightPlug = this.gain(1);
  private monitorLeftPlug = this.gain(1);
  private monitorRightPlug = this.gain(1);
  private outputGates: Record<ListenBus, GainNode> = {
    speakers: this.gain(),
    monitor: this.gain(),
    sub: this.gain(),
  };
  private listening = this.gain();
  private selectedBus: ListenBus = "speakers";
  private listeningDb = -24;
  private state: MixerState | null = null;
  private initialized = false;
  private monitorSideTaps = [this.analyser(), this.analyser()];
  private preLimiterSideTaps = [this.analyser(), this.analyser()];
  private taps = {
    speakers: this.analyser(),
    monitor: this.analyser(),
    sub: this.analyser(),
    reverb: this.analyser(),
    preLimiter: this.analyser(),
    left: this.analyser(),
    right: this.analyser(),
    listening: this.analyser(),
  };
  private timeData = new Float32Array(2048);
  private frequencyData = new Float32Array(1024);

  constructor() {
    // Some browsers create a running context inside a gesture (including file
    // selection). Only the explicit Start audio action should enable playback.
    void this.context.suspend();
    this.fxSend.channelCount = 1;
    this.fxSend.channelCountMode = "explicit";
    for (let i = 0; i < 6; i++) {
      const channel: ChannelPath = {
        high: this.filter("highshelf", 8000),
        low: this.filter("lowshelf", 100),
        level: this.gain(),
        stereo: this.gain(),
        mono: this.gain(1),
        send: this.gain(),
      };
      channel.high.connect(channel.low).connect(channel.level);
      channel.level.connect(channel.stereo).connect(this.mix);
      channel.level.connect(channel.mono).connect(this.mix);
      if (i < 4) channel.level.connect(channel.send).connect(this.fxSend);
      this.channels.push(channel);
    }
    for (const id of Object.keys(INPUTS) as InputId[]) {
      const gate = this.gain(INPUTS[id].channel < 4 ? 1 : 2);
      const loading = this.filter("lowpass", 22000);
      gate.connect(loading).connect(this.channels[INPUTS[id].channel].high);
      this.inputs.set(id, { gate, loading, source: null, key: "" });
    }
    this.fxSend
      .connect(this.convolution)
      .connect(this.convolutionGain)
      .connect(this.fxWet);
    this.fxSend.connect(this.echo).connect(this.echoGain).connect(this.fxWet);
    this.echo.connect(this.echoFeedback).connect(this.echo);
    this.echoFeedback.gain.value = 0.3;
    this.fxWet.connect(this.mix);
    this.fxWet.connect(this.taps.reverb);
    this.mix.connect(this.monitor).connect(this.taps.monitor);
    this.monitor.connect(this.monitorStereoGate);
    const monitorMeterSplit = this.context.createChannelSplitter(2);
    this.monitor.connect(monitorMeterSplit);
    this.monitorSideTaps.forEach((tap, side) =>
      monitorMeterSplit.connect(tap, side),
    );
    this.monitor.connect(this.monitorMono).connect(this.monitorMonoGate);
    const monitorSplit = this.context.createChannelSplitter(2);
    this.monitorStereoGate.connect(monitorSplit);
    monitorSplit.connect(this.monitorLeftPlug, 0);
    monitorSplit.connect(this.monitorRightPlug, 1);
    // L-only monitor insertion sums stereo into a single mono jack.
    this.monitorMonoGate.connect(this.monitorLeftPlug);
    this.monitorLeftPlug.connect(this.monitorPlugs, 0, 0);
    this.monitorRightPlug.connect(this.monitorPlugs, 0, 1);
    this.monitorPlugs.connect(this.outputGates.monitor);

    this.mix.connect(this.feedbackTap);
    let previous: AudioNode = this.mix;
    for (const notch of this.notches) {
      previous.connect(notch);
      previous = notch;
    }
    previous
      .connect(this.masterLow)
      .connect(this.masterHigh)
      .connect(this.master);
    this.master
      .connect(this.subMono)
      .connect(this.subLowPass)
      .connect(this.taps.sub);
    this.subLowPass.connect(this.subGate).connect(this.outputGates.sub);
    this.master.connect(this.speakerHighPass).connect(this.taps.preLimiter);
    const preLimiterSplit = this.context.createChannelSplitter(2);
    this.speakerHighPass.connect(preLimiterSplit);
    this.preLimiterSideTaps.forEach((tap, side) =>
      preLimiterSplit.connect(tap, side),
    );
    this.speakerHighPass
      .connect(this.limiter)
      .connect(this.peakCeiling)
      .connect(this.taps.speakers);
    this.limiter.threshold.value = -6;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.15;
    // A compressor limits average energy, so add a smooth peak ceiling. Quiet
    // samples remain linear; overloads approach 0.5 (-6 dBFS) without overshoot.
    const ceiling = new Float32Array(16385);
    for (let i = 0; i < ceiling.length; i++) {
      const x = (i / (ceiling.length - 1)) * 2 - 1;
      ceiling[i] =
        Math.abs(x) <= 0.4
          ? x
          : Math.sign(x) * (0.4 + 0.1 * Math.tanh((Math.abs(x) - 0.4) / 0.1));
    }
    this.peakCeiling.curve = ceiling;
    const split = this.context.createChannelSplitter(2);
    this.peakCeiling.connect(split);
    split.connect(this.taps.left, 0);
    split.connect(this.taps.right, 1);
    split.connect(this.leftPlug, 0);
    split.connect(this.rightPlug, 1);
    this.leftPlug.connect(this.speakerPlugs, 0, 0);
    this.rightPlug.connect(this.speakerPlugs, 0, 1);
    this.speakerPlugs.connect(this.outputGates.speakers);
    for (const gate of Object.values(this.outputGates))
      gate.connect(this.listening);
    this.listening.connect(this.context.destination);
    this.listening.connect(this.taps.listening);
    this.setVolume(this.listeningDb);
    this.selectBus(this.selectedBus);
  }

  private gain(channels = 2) {
    const node = this.context.createGain();
    node.channelCount = channels;
    node.channelCountMode = "explicit";
    return node;
  }
  private filter(type: BiquadFilterType, frequency: number) {
    const filter = this.context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    // Web Audio low/high-pass Q uses dB; -3.01 dB gives a Butterworth response.
    filter.Q.value =
      type === "lowpass" || type === "highpass" ? -3.0103 : 0.707;
    return filter;
  }
  private analyser() {
    const analyser = this.context.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0;
    return analyser;
  }
  private smooth(param: AudioParam, value: number) {
    if (!this.initialized) {
      param.value = value;
      return;
    }
    param.setTargetAtTime(value, this.context.currentTime, 0.015);
  }
  setVolume(db: number) {
    this.listeningDb = db;
    this.smooth(this.listening.gain, dbGain(db));
  }
  selectBus(bus: ListenBus) {
    this.selectedBus = bus;
    for (const [id, gate] of Object.entries(this.outputGates))
      this.smooth(gate.gain, id === bus ? 1 : 0);
  }
  hasFile(id: InputId) {
    return this.files.has(id);
  }
  clearFile(id: InputId) {
    this.files.delete(id);
    this.fileRevisions.set(id, (this.fileRevisions.get(id) || 0) + 1);
  }
  async decodeFile(data: ArrayBuffer) {
    return this.context.decodeAudioData(data);
  }
  setFile(id: InputId, buffer: AudioBuffer) {
    this.files.set(id, buffer);
    this.fileRevisions.set(id, (this.fileRevisions.get(id) || 0) + 1);
  }
  clearFiles() {
    this.files.clear();
    for (const id of this.inputs.keys())
      this.fileRevisions.set(id, (this.fileRevisions.get(id) || 0) + 1);
  }

  /** Change only affected source nodes. A disconnected/missing file never becomes a tone. */
  update(state: MixerState) {
    const on = powered(state);
    this.state = state;
    for (const [id, path] of this.inputs) {
      const input = state.inputs[id];
      const key =
        input.kind === "file"
          ? `file:${this.fileRevisions.get(id) || 0}`
          : input.kind;
      if (key !== path.key) {
        path.source?.stop();
        path.source?.disconnect();
        path.source = null;
        path.key = key;
        let buffer: AudioBuffer | undefined;
        if (input.kind === "file") buffer = this.files.get(id);
        else if (input.kind !== "none") {
          if (!this.buffers.has(input.kind))
            this.buffers.set(
              input.kind,
              generatedBuffer(this.context, input.kind),
            );
          buffer = this.buffers.get(input.kind);
        }
        if (buffer) {
          const source = this.context.createBufferSource();
          source.buffer = buffer;
          source.loop = true;
          source.connect(path.gate);
          source.start(
            0,
            input.kind === "file"
              ? 0
              : this.context.currentTime % buffer.duration,
          );
          path.source = source;
        }
      }
      this.smooth(path.gate.gain, inputGain(state, id));
      const loadedGuitar =
        id === "ch4" &&
        input.kind === "guitar" &&
        input.plug === "phone" &&
        !state.hiZ;
      this.smooth(
        path.loading.frequency,
        loadedGuitar ? 900 : Math.min(22000, this.context.sampleRate / 2 - 1),
      );
    }
    state.channels.forEach((settings, i) => {
      const path = this.channels[i];
      this.smooth(path.high.gain, settings.high);
      this.smooth(path.low.gain, settings.low);
      this.smooth(path.level.gain, levelGain(settings.level));
      this.smooth(path.stereo.gain, settings.mono ? 0 : 1);
      this.smooth(path.mono.gain, settings.mono ? 1 : 0);
      this.smooth(path.send.gain, settings.reverb / 10);
    });
    this.configureReverb(state.reverbTypeTime);
    this.smooth(this.fxWet.gain, on && state.reverbOn ? 0.5 : 0);
    if (!on || !state.feedback) {
      this.notchFrequencies = [];
      for (const filter of this.notches) this.smooth(filter.gain, 0);
      this.nextDetectionAt = 0;
    }
    this.smooth(
      this.masterLow.gain,
      state.masterEQ * (state.masterEQ < 0 ? 15 : 9),
    );
    this.smooth(
      this.masterHigh.gain,
      state.masterEQ < 0 ? -state.masterEQ * 2 : 0,
    );
    this.smooth(this.master.gain, on ? levelGain(state.master) : 0);
    this.smooth(this.monitor.gain, on ? levelGain(state.monitor) : 0);
    this.smooth(this.speakerHighPass.frequency, state.sub ? 120 : 10);
    this.smooth(this.subGate.gain, state.sub && on ? 1 : 0);
    this.smooth(this.leftPlug.gain, state.speakerL && on ? 1 : 0);
    this.smooth(this.rightPlug.gain, state.speakerR && on ? 1 : 0);
    const monoMonitor = state.monitorL && !state.monitorR;
    this.smooth(this.monitorStereoGate.gain, monoMonitor ? 0 : 1);
    this.smooth(this.monitorMonoGate.gain, monoMonitor ? 1 : 0);
    this.smooth(this.monitorLeftPlug.gain, state.monitorL && on ? 1 : 0);
    this.smooth(this.monitorRightPlug.gain, state.monitorR && on ? 1 : 0);
    this.initialized = true;
  }

  /** Approximate SPX families using deterministic decaying impulses and a real echo. */
  private configureReverb(value: number) {
    const program = reverbProgram(value);
    const key = `${program.index}:${Math.round(program.amount * 12)}`;
    if (key === this.programKey) return;
    this.programKey = key;
    const echo = program.index === 3;
    this.smooth(this.echoGain.gain, echo ? 1 : 0);
    this.smooth(this.convolutionGain.gain, echo ? 0 : 1);
    this.smooth(this.echo.delayTime, 0.09 + program.amount * 0.55);
    if (echo) return;
    const seconds =
      [1.2, 0.6, 0.15][program.index] +
      program.amount * [2.6, 1.7, 0.9][program.index];
    const impulse = this.context.createBuffer(
      2,
      Math.ceil(seconds * this.context.sampleRate),
      this.context.sampleRate,
    );
    for (let ch = 0; ch < 2; ch++) {
      const samples = impulse.getChannelData(ch);
      let seed = 142 + ch;
      let filtered = 0;
      for (let i = 0; i < samples.length; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const noise = seed / 2147483648 - 1;
        filtered += (program.index === 1 ? 0.85 : 0.25) * (noise - filtered);
        samples[i] = filtered * Math.exp((-i / samples.length) * 7);
      }
    }
    this.convolution.buffer = impulse;
  }

  /** Find sustained, narrow spectral peaks; retain at most seven until reset.
   * This is an explicit practice approximation, not Yamaha's detection algorithm.
   */
  private detectFeedback() {
    if (
      !this.state ||
      !powered(this.state) ||
      !this.state.feedback ||
      this.notchFrequencies.length >= 7
    )
      return;
    if (this.context.currentTime < this.nextDetectionAt) return;
    this.nextDetectionAt = this.context.currentTime + 0.4;
    this.feedbackTap.getFloatFrequencyData(this.frequencyData);
    let best = -1;
    let strength = -40;
    const binHz = this.context.sampleRate / this.feedbackTap.fftSize;
    for (let i = 8; i < this.frequencyData.length - 8; i++) {
      const hz = i * binHz;
      const db = this.frequencyData[i];
      if (
        hz < 180 ||
        hz > 9000 ||
        this.notchFrequencies.some(
          (existing) => Math.abs(existing - hz) / existing < 0.06,
        )
      )
        continue;
      if (
        db > strength &&
        db - this.frequencyData[i - 5] > 18 &&
        db - this.frequencyData[i + 5] > 18
      ) {
        best = i;
        strength = db;
      }
    }
    if (best < 0) return;
    const filter = this.notches[this.notchFrequencies.length];
    const frequency = best * binHz;
    this.notchFrequencies.push(frequency);
    filter.frequency.value = frequency;
    filter.Q.value = 12;
    this.smooth(filter.gain, -24);
  }

  private peakDb(analyser: AnalyserNode) {
    analyser.getFloatTimeDomainData(this.timeData);
    let peak = 0;
    for (const sample of this.timeData) peak = Math.max(peak, Math.abs(sample));
    return toDb(peak);
  }

  read(): Readings {
    if (this.context.state !== "running" || !this.state || !powered(this.state))
      return emptyReadings();
    this.detectFeedback();
    const readings = emptyReadings();
    for (const [name, analyser] of Object.entries(this.taps)) {
      readings[name as keyof typeof this.taps] = this.peakDb(analyser);
    }
    // Meter each side first: opposite-polarity stereo must not appear silent
    // just because an analyser would downmix the two channels.
    readings.speakers = Math.max(readings.left, readings.right);
    readings.monitor = Math.max(
      ...this.monitorSideTaps.map((tap) => this.peakDb(tap)),
    );
    readings.preLimiter = Math.max(
      ...this.preLimiterSideTaps.map((tap) => this.peakDb(tap)),
    );
    readings.notches = [...this.notchFrequencies];
    return readings;
  }
  async start() {
    await this.context.resume();
  }
  async stop() {
    await this.context.suspend();
  }
  async dispose() {
    await this.context.close();
  }
}
