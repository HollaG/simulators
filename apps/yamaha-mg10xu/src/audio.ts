import { Effects } from "./effects";
import {
  INPUTS,
  activeInputs,
  dbGain,
  levelGain,
  fxActive,
  type InputId,
  type SourceKind,
  type MixerState,
} from "./state";

export type ListenBus = "stereo" | "monitor" | "phones" | "fx" | "usb";
export type Readings = {
  left: number;
  right: number;
  stereo: number;
  monitor: number;
  phones: number;
  fx: number;
  usb: number;
  peaks: number[];
  listening: number;
};
export const emptyReadings = (): Readings => ({
  left: -120,
  right: -120,
  stereo: -120,
  monitor: -120,
  phones: -120,
  fx: -120,
  usb: -120,
  peaks: Array(7).fill(-120),
  listening: -120,
});

/** Repeatable musical sketches, not sampled instruments. Mono inputs share the
 * same waveform on both sides; stereo material has independent left/right notes.
 */
function generated(
  context: AudioContext,
  kind: SourceKind,
  mono: boolean,
  preamp: boolean,
) {
  const buffer = context.createBuffer(
    2,
    context.sampleRate * 4,
    context.sampleRate,
  );
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let seed = 1273;
    for (let i = 0; i < data.length; i++) {
      const t = i / context.sampleRate,
        phase = t % 0.5,
        beat = Math.floor(t * 2);
      const sine = (hz: number) => Math.sin(t * Math.PI * 2 * hz);
      let value = 0;
      if (kind === "voice" || kind === "condenser")
        value =
          0.0005 *
          Math.max(0, Math.sin((Math.PI * phase) / 0.45)) ** 2 *
          (sine(110) +
            0.5 * sine(220) +
            0.25 * sine(880) +
            0.1 * sine(1760) +
            0.2 * sine(40));
      else if (kind === "tone") value = 0.06 * sine(1000);
      else if (kind === "bass") value = 0.06 * sine(40);
      else if (kind === "keys")
        value =
          0.09 *
          Math.sin((Math.PI * phase) / 0.5) ** 0.3 *
          (sine([220, 262, 294, 330][beat % 4] * (!mono && ch ? 1.5 : 1)) +
            0.2 * sine(880));
      else if (kind === "music") {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        value =
          0.07 *
          (Math.sin(2 * Math.PI * 55 * phase) * Math.exp(-phase * 25) +
            0.5 *
              sine([55, 66, 74, 66][Math.floor(beat / 2)]) *
              Math.exp(-phase * 4) +
            0.2 * (seed / 2147483648 - 1) * Math.exp(-(t % 0.25) * 90) +
            0.2 * sine(!mono && ch ? 660 : 440));
      }
      // Quiet mono line sources keep the gain exercise useful. Connector type
      // itself does not attenuate this combo input; PAD supplies the −26 dB.
      data[i] =
        preamp && kind !== "voice" && kind !== "condenser"
          ? value * dbGain(-26)
          : value;
    }
  }
  return buffer;
}
type InputPath = {
  gate: GainNode;
  source: AudioBufferSourceNode | null;
  key: string;
};
type Strip = {
  pre: GainNode;
  hp: BiquadFilterNode;
  low: BiquadFilterNode;
  mid: BiquadFilterNode;
  high: BiquadFilterNode;
  comp: DynamicsCompressorNode;
  makeup: GainNode;
  level: GainNode;
  left: GainNode;
  right: GainNode;
  send: GainNode;
  main: GainNode;
  direct: GainNode;
  meter: AnalyserNode;
};

/** One audio graph models pre-master USB recording, monitor-only return and the
 * separate FX bus. Browser listening volume sits after meter taps and never
 * changes a desk meter. Sources/nodes stay outside serializable React state.
 */
export class MixerAudio {
  readonly context = new AudioContext();
  private inputs = new Map<InputId, InputPath>();
  private strips: Strip[] = [];
  private files = new Map<
    InputId,
    { buffer: AudioBuffer; filename: string; revision: number }
  >();
  private buffers = new Map<string, AudioBuffer>();
  private stereoBus = this.context.createGain();
  private stereoMaster = this.context.createGain();
  private fxBus = this.context.createGain();
  private directMonitor = this.context.createGain();
  private monitorStereo = this.context.createGain();
  private monitorSum = this.context.createGain();
  private effects = new Effects(this.context);
  private wet = this.context.createGain();
  private outputs = new Map<ListenBus, GainNode>();
  private meters = new Map<string, AnalyserNode>();
  private listenGates = new Map<ListenBus, GainNode>();
  private listening = this.context.createGain();
  private leftMeter: AnalyserNode;
  private rightMeter: AnalyserNode;
  private ready = false;
  private enabled = false;
  constructor() {
    const c = this.context;
    // Importing a file may create this graph during a gesture. Only Start audio
    // should make it audible; constructing resources must leave playback stopped.
    void c.suspend();
    this.stereoBus.channelCount = 2;
    this.stereoBus.channelCountMode = "explicit";
    for (const bus of [
      "stereo",
      "monitor",
      "phones",
      "fx",
      "usb",
    ] as ListenBus[]) {
      const out = c.createGain(),
        listen = c.createGain();
      this.outputs.set(bus, out);
      this.listenGates.set(bus, listen);
      this.meters.set(bus, this.analyser(out));
      out.connect(listen).connect(this.listening);
    }
    this.listening.gain.value = 0;
    this.listening.connect(c.destination);
    this.meters.set("listening", this.analyser(this.listening));
    this.stereoBus
      .connect(this.stereoMaster)
      .connect(this.outputs.get("stereo")!);
    this.stereoBus.connect(this.outputs.get("usb")!);
    this.meters.set("stereo", this.analyser(this.stereoMaster));
    this.stereoBus.connect(this.monitorStereo).connect(this.monitorSum);
    this.directMonitor.connect(this.monitorSum);
    this.monitorSum.connect(this.outputs.get("monitor")!);
    this.monitorSum.connect(this.outputs.get("phones")!);
    this.fxBus.connect(this.outputs.get("fx")!);
    this.fxBus.connect(this.effects.input);
    this.effects.output.connect(this.wet).connect(this.stereoBus);
    const split = c.createChannelSplitter(2);
    this.stereoMaster.connect(split);
    this.leftMeter = this.analyser();
    this.rightMeter = this.analyser();
    split.connect(this.leftMeter, 0);
    split.connect(this.rightMeter, 1);
    // Analyser branches are silent; a zero gain sink keeps all measured taps pulled.
    const sink = c.createGain();
    sink.gain.value = 0;
    sink.connect(c.destination);
    this.leftMeter.connect(sink);
    this.rightMeter.connect(sink);
    this.meters.get("stereo")!.connect(sink);
    for (let i = 0; i < 7; i++) {
      const pre = c.createGain(),
        hp = c.createBiquadFilter(),
        low = c.createBiquadFilter(),
        mid = c.createBiquadFilter(),
        high = c.createBiquadFilter();
      const comp = c.createDynamicsCompressor(),
        makeup = c.createGain(),
        level = c.createGain();
      hp.type = "highpass";
      hp.Q.value = Math.SQRT1_2;
      low.type = "lowshelf";
      low.frequency.value = 100;
      mid.type = "peaking";
      mid.frequency.value = 2500;
      mid.Q.value = 0.8;
      high.type = "highshelf";
      high.frequency.value = 10000;
      pre
        .connect(hp)
        .connect(comp)
        .connect(makeup)
        .connect(low)
        .connect(mid)
        .connect(high)
        .connect(level);
      const meter = this.analyser(high);
      meter.connect(sink);
      const splitter = c.createChannelSplitter(2),
        merger = c.createChannelMerger(2),
        left = c.createGain(),
        right = c.createGain();
      level.connect(splitter);
      splitter.connect(left, 0);
      splitter.connect(right, 1);
      left.connect(merger, 0, 0);
      right.connect(merger, 0, 1);
      const main = c.createGain(),
        direct = c.createGain(),
        send = c.createGain();
      send.channelCount = 1;
      send.channelCountMode = "explicit";
      merger.connect(main).connect(this.stereoBus);
      merger.connect(direct).connect(this.directMonitor);
      level.connect(send).connect(this.fxBus);
      this.strips.push({
        pre,
        hp,
        low,
        mid,
        high,
        comp,
        makeup,
        level,
        left,
        right,
        send,
        main,
        direct,
        meter,
      });
    }
    for (const id of Object.keys(INPUTS) as InputId[]) {
      const gate = c.createGain();
      gate.gain.value = 0;
      gate.connect(this.strips[INPUTS[id].channel].pre);
      this.inputs.set(id, { gate, source: null, key: "" });
    }
  }
  private analyser(source?: AudioNode) {
    const analyser = this.context.createAnalyser();
    analyser.fftSize = 2048;
    source?.connect(analyser);
    return analyser;
  }
  private set(param: AudioParam, value: number) {
    param.setTargetAtTime(value, this.context.currentTime, 0.012);
  }
  async start() {
    await this.context.resume();
    if (!this.ready) {
      await this.context.audioWorklet.addModule(
        `${import.meta.env.BASE_URL}pitch-worklet.js`,
      );
      this.ready = true;
    }
    this.enabled = true;
  }
  async stop() {
    this.enabled = false;
    await this.context.suspend();
  }
  hasFile(id: InputId, filename: string) {
    return this.files.get(id)?.filename === filename;
  }
  async decode(data: ArrayBuffer) {
    return this.context.decodeAudioData(data);
  }
  putFile(id: InputId, filename: string, buffer: AudioBuffer) {
    this.files.set(id, {
      buffer,
      filename,
      revision: (this.files.get(id)?.revision || 0) + 1,
    });
  }
  clearFiles() {
    this.files.clear();
  }
  /** Reconcile source identity before gains so a disconnected/missing input stays
   * silent. TO MON diverts 9/10's dry signal; its FX send remains on the shared
   * bus as shown in Yamaha's block diagram. Smooth gain changes avoid clicks.
   */
  update(s: MixerState, bus: ListenBus, volume: number) {
    const c = this.context,
      active = activeInputs(s);
    for (const [id, path] of this.inputs) {
      const v = s.inputs[id],
        index = INPUTS[id].channel,
        mono = index < 4 || (id === "line910" && v.mono);
      const file = this.files.get(id),
        validFile = file?.filename === v.filename;
      const key = `${v.kind}:${mono}:${v.filename}:${validFile ? file.revision : "missing"}`;
      if (path.key !== key) {
        path.source?.stop();
        path.source?.disconnect();
        path.source = null;
        path.key = key;
        let buffer: AudioBuffer | undefined;
        if (v.kind === "file") buffer = validFile ? file.buffer : undefined;
        else if (v.kind !== "none") {
          const name = `${v.kind}:${mono}:${index < 4}`;
          if (!this.buffers.has(name))
            this.buffers.set(name, generated(c, v.kind, mono, index < 4));
          buffer = this.buffers.get(name);
        }
        if (buffer) {
          // Mono jacks sum imported stereo material; L/MONO uses only its left side.
          if (mono) {
            const m = c.createBuffer(2, buffer.length, buffer.sampleRate),
              l = buffer.getChannelData(0),
              r = buffer.getChannelData(
                Math.min(1, buffer.numberOfChannels - 1),
              );
            for (let ch = 0; ch < 2; ch++) {
              const d = m.getChannelData(ch);
              for (let i = 0; i < d.length; i++)
                d[i] = id === "line910" ? l[i] : (l[i] + r[i]) * 0.5;
            }
            buffer = m;
          } else if (buffer.numberOfChannels === 1) {
            const stereo = c.createBuffer(2, buffer.length, buffer.sampleRate);
            stereo.copyToChannel(buffer.getChannelData(0), 0);
            stereo.copyToChannel(buffer.getChannelData(0), 1);
            buffer = stereo;
          }
          const source = c.createBufferSource();
          source.buffer = buffer;
          source.loop = true;
          source.connect(path.gate);
          source.start();
          path.source = source;
        }
      }
      const poweredMic =
        v.kind !== "condenser" || (v.plug === "xlr" && s.phantom && index < 4);
      this.set(
        path.gate.gain,
        s.power &&
          active.includes(id) &&
          poweredMic &&
          (id !== "usb910" || s.usbConnected)
          ? dbGain(v.db + (id === "usb910" ? s.attenuator : 0))
          : 0,
      );
    }
    s.channels.forEach((v, i) => {
      const path = this.strips[i],
        input = s.inputs[active[i]];
      this.set(path.pre.gain, i < 4 ? dbGain(v.gain - (v.pad ? 26 : 0)) : 1);
      this.set(path.hp.frequency, i < 4 && v.hpf ? 80 : 5);
      this.set(path.low.gain, v.low);
      this.set(path.mid.gain, i < 4 ? v.mid : 0);
      this.set(path.high.gain, v.high);
      const amount = i < 2 ? v.comp / 10 : 0;
      this.set(path.comp.threshold, 2 - 30 * amount);
      this.set(path.comp.ratio, 1 + amount * 3);
      path.comp.attack.value = 0.025;
      path.comp.release.value = 0.3;
      path.comp.knee.value = 0;
      this.set(path.makeup.gain, dbGain(amount * 7));
      this.set(path.level.gain, levelGain(v.level));
      const mono = i < 4 || (active[i] === "line910" && input.mono);
      this.set(
        path.left.gain,
        mono
          ? Math.cos(((v.pan + 1) * Math.PI) / 4) * Math.SQRT2
          : v.pan > 0
            ? 1 - v.pan
            : 1,
      );
      this.set(
        path.right.gain,
        mono
          ? Math.sin(((v.pan + 1) * Math.PI) / 4) * Math.SQRT2
          : v.pan < 0
            ? 1 + v.pan
            : 1,
      );
      this.set(path.main.gain, i === 6 && !s.toStereo ? 0 : 1);
      this.set(path.direct.gain, i === 6 && !s.toStereo ? 1 : 0);
      this.set(path.send.gain, levelGain(v.fx));
    });
    if (this.ready)
      this.effects.configure(s.program, s.parameters[s.program - 1]);
    this.set(this.wet.gain, fxActive(s) ? levelGain(s.fxReturn) : 0);
    this.set(this.monitorStereo.gain, s.stereoMute ? 0 : 1);
    this.set(this.stereoMaster.gain, s.power ? levelGain(s.master) : 0);
    const outputGains = {
      stereo: s.stereoConnected ? 1 : 0,
      monitor: s.monitorConnected ? levelGain(s.monitor) : 0,
      phones: s.phonesConnected ? levelGain(s.monitor) : 0,
      fx: s.fxConnected ? 1 : 0,
      usb: s.usbConnected ? 1 : 0,
    };
    for (const [id, out] of this.outputs)
      this.set(out.gain, s.power ? outputGains[id] : 0);
    for (const [id, gate] of this.listenGates)
      this.set(gate.gain, id === bus ? 1 : 0);
    this.set(this.listening.gain, this.enabled ? dbGain(volume) : 0);
  }
  private measure(analyser: AnalyserNode, peak = false) {
    const samples = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(samples);
    let sum = 0,
      highest = 0;
    for (const v of samples) {
      sum += v * v;
      highest = Math.max(highest, Math.abs(v));
    }
    const value = peak ? highest : Math.sqrt(sum / samples.length);
    return value < 1e-7 ? -120 : 20 * Math.log10(value) + 20;
  }
  readings(): Readings {
    if (this.context.state !== "running") return emptyReadings();
    return {
      ...emptyReadings(),
      ...Object.fromEntries(
        [...this.meters].map(([id, meter]) => [id, this.measure(meter)]),
      ),
      left: this.measure(this.leftMeter),
      right: this.measure(this.rightMeter),
      peaks: this.strips.map((path) => this.measure(path.meter, true)),
    };
  }
  async dispose() {
    this.inputs.forEach((p) => p.source?.stop());
    this.effects.dispose();
    await this.context.close();
  }
}
