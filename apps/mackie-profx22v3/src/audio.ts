import { createEffect } from "./effects";
import { makeDemoBuffer, makeTone } from "./sources";
import { dbToGain, gainToDb, type MixerState } from "./state";

export type ListenBus =
  | "main"
  | "phones"
  | "cr"
  | "mon1"
  | "mon2"
  | "mon3"
  | "sub12"
  | "sub34"
  | "fxSend";
export const LISTEN_BUSES: { id: ListenBus; label: string }[] = [
  { id: "main", label: "Main L / R" },
  { id: "phones", label: "Headphones · PFL" },
  { id: "cr", label: "Control room · PFL" },
  { id: "mon1", label: "MON 1" },
  { id: "mon2", label: "MON 2" },
  { id: "mon3", label: "MON 3" },
  { id: "sub12", label: "Subgroup 1–2" },
  { id: "sub34", label: "Subgroup 3–4" },
  { id: "fxSend", label: "FX send · dry" },
];
type Strip = {
  source: AudioBufferSourceNode | null;
  sourceId: string | null;
  input: GainNode;
  trim: GainNode;
  inputMeter: AnalyserNode;
  hp: BiquadFilterNode;
  comp: DynamicsCompressorNode;
  low: BiquadFilterNode;
  mid: BiquadFilterNode;
  high: BiquadFilterNode;
  pre: AnalyserNode;
  mute: GainNode;
  fader: GainNode;
  pan: StereoPannerNode;
  lr: GainNode;
  sub12: GainNode;
  sub34: GainNode;
  solo: GainNode;
  direct: GainNode;
  mon1: GainNode;
  mon2: GainNode;
  mon3Pre: GainNode;
  mon3Post: GainNode;
  fx: GainNode;
};
export type Readings = {
  left: number;
  right: number;
  inputs: number[];
  channel: number[];
  buses: Record<ListenBus, number>;
  running: boolean;
};
export const emptyReadings = (): Readings => ({
  left: -120,
  right: -120,
  inputs: Array(18).fill(-120),
  channel: Array(18).fill(-120),
  buses: Object.fromEntries(LISTEN_BUSES.map((b) => [b.id, -120])) as Record<
    ListenBus,
    number
  >,
  running: false,
});

/** One audio graph models the desk. Meters read actual samples; listening attenuation
 * lives after every simulated output so it cannot change the hardware meter levels.
 */
export class MixerAudio {
  readonly context = new AudioContext();
  private buffers = new Map<string, AudioBuffer>();
  private strips: Strip[] = [];
  private mainSum = this.gain();
  private breakGate = this.gain();
  private main = this.gain();
  private sub12 = this.gain();
  private sub34 = this.gain();
  private sub12LR = this.gain();
  private sub34LR = this.gain();
  private mon1 = this.gain();
  private mon2 = this.gain();
  private mon3 = this.gain();
  private fxSend = this.gain();
  private wet = this.gain();
  private fxReturn = this.gain();
  private fxSub12 = this.gain();
  private fxSub34 = this.gain();
  private fxMon = [this.gain(), this.gain(), this.gain()];
  private solo = this.gain(1);
  private directInputs = this.gain();
  private monitorMain = this.gain();
  private monitorSolo = this.gain();
  private monitorBlend = this.gain();
  private monitorSum = this.gain();
  private directBlend = this.gain();
  private usbBlend = this.gain();
  private usb12 = this.gain();
  private usb12Node: AudioBufferSourceNode | null = null;
  private usb12Id: string | null = null;
  private phones = this.gain();
  private cr = this.gain();
  private listen = this.gain();
  private safety = this.gain();
  private meterLeft: AnalyserNode;
  private meterRight: AnalyserNode;
  private soloMeter: AnalyserNode;
  private taps: Record<ListenBus, AnalyserNode>;
  private effect: ReturnType<typeof createEffect> | null = null;
  private preset = 0;
  private soloActive = false;
  private currentBus: ListenBus = "main";
  private state: MixerState | null = null;
  private samples = new Float32Array(1024);
  private initialized = false;

  constructor() {
    // Importing/decoding a file must not start playback as a side effect.
    void this.context.suspend();
    this.mainSum.connect(this.breakGate).connect(this.main);
    this.sub12.connect(this.sub12LR).connect(this.mainSum);
    this.sub34.connect(this.sub34LR).connect(this.mainSum);
    this.wet.connect(this.fxReturn).connect(this.mainSum);
    this.fxReturn.connect(this.fxSub12).connect(this.sub12);
    this.fxReturn.connect(this.fxSub34).connect(this.sub34);
    [this.mon1, this.mon2, this.mon3].forEach((mon, i) =>
      this.wet.connect(this.fxMon[i]).connect(mon),
    );
    this.main.connect(this.monitorMain).connect(this.monitorSum);
    this.solo.connect(this.monitorSolo).connect(this.monitorSum);
    this.directInputs.connect(this.directBlend).connect(this.monitorBlend);
    this.usb12.connect(this.usbBlend).connect(this.monitorBlend);
    this.monitorBlend.connect(this.monitorSum);
    this.monitorSum.connect(this.phones);
    this.monitorSum.connect(this.cr);
    const splitter = this.context.createChannelSplitter(2);
    this.main.connect(splitter);
    this.meterLeft = this.analyser();
    this.meterRight = this.analyser();
    splitter.connect(this.meterLeft, 0);
    splitter.connect(this.meterRight, 1);
    this.soloMeter = this.analyser();
    this.solo.connect(this.soloMeter);
    this.taps = Object.fromEntries(
      LISTEN_BUSES.map(({ id }) => {
        const analyser = this.analyser();
        const node = id === "fxSend" ? this.fxSend : this[id];
        node.connect(analyser);
        return [id, analyser];
      }),
    ) as Record<ListenBus, AnalyserNode>;
    this.listen.connect(this.safety).connect(this.context.destination);
    this.safety.gain.value = dbToGain(-18);
    for (let i = 0; i < 18; i++) this.strips.push(this.createStrip(i));
    this.selectBus("main");
  }
  private gain(channels = 2) {
    const gain = this.context.createGain();
    gain.channelCount = channels;
    gain.channelCountMode = "explicit";
    return gain;
  }
  private analyser() {
    const analyser = this.context.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0;
    return analyser;
  }
  private set(param: AudioParam, value: number) {
    // Set the first graph configuration immediately, before audio can run. Ramping
    // initially open assignment gates would briefly leak unassigned channels.
    if (!this.initialized)
      param.setValueAtTime(value, this.context.currentTime);
    else param.setTargetAtTime(value, this.context.currentTime, 0.012);
  }
  private createStrip(index: number): Strip {
    const channels = index < 14 ? 1 : 2;
    const input = this.gain(channels);
    const trim = this.gain(channels);
    const inputMeter = this.analyser();
    const hp = this.context.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 100;
    hp.Q.value = 0.707;
    const comp = this.context.createDynamicsCompressor();
    comp.attack.value = 0.005;
    comp.release.value = 0.15;
    comp.knee.value = 12;
    const low = this.context.createBiquadFilter();
    low.type = "lowshelf";
    low.frequency.value = 80;
    const mid = this.context.createBiquadFilter();
    mid.type = "peaking";
    mid.Q.value = 1;
    const high = this.context.createBiquadFilter();
    high.type = "highshelf";
    high.frequency.value = 12000;
    const pre = this.analyser();
    const mute = this.gain(channels);
    const fader = this.gain(channels);
    const pan = this.context.createStereoPanner();
    const lr = this.gain();
    const sub12 = this.gain();
    const sub34 = this.gain();
    const solo = this.gain(1);
    const direct = this.gain();
    const mon1 = this.gain(1);
    const mon2 = this.gain(1);
    const mon3Pre = this.gain(1);
    const mon3Post = this.gain(1);
    const fx = this.gain(1);
    input
      .connect(trim)
      .connect(hp)
      .connect(comp)
      .connect(low)
      .connect(mid)
      .connect(high)
      .connect(pre);
    trim.connect(inputMeter);
    pre.connect(mute).connect(fader).connect(pan);
    // The intermission strip joins after Break; all other main/sub/FX contributions pass through it.
    pan.connect(lr).connect(index === 17 ? this.main : this.mainSum);
    pan.connect(sub12).connect(this.sub12);
    pan.connect(sub34).connect(this.sub34);
    pre.connect(solo).connect(this.solo);
    if (index !== 17) fader.connect(direct).connect(this.directInputs);
    mute.connect(mon1).connect(this.mon1);
    mute.connect(mon2).connect(this.mon2);
    mute.connect(mon3Pre).connect(this.mon3);
    fader.connect(mon3Post).connect(this.mon3);
    fader.connect(fx).connect(this.fxSend);
    return {
      source: null,
      sourceId: null,
      input,
      trim,
      inputMeter,
      hp,
      comp,
      low,
      mid,
      high,
      pre,
      mute,
      fader,
      pan,
      lr,
      sub12,
      sub34,
      solo,
      direct,
      mon1,
      mon2,
      mon3Pre,
      mon3Post,
      fx,
    };
  }
  private buffer(id: string | null): AudioBuffer | null {
    if (!id) return null;
    if (this.buffers.has(id)) return this.buffers.get(id)!;
    const demo = /^demo:([0-5])$/.exec(id);
    const generated = demo
      ? makeDemoBuffer(this.context, Number(demo[1]))
      : id === "tone"
        ? makeTone(this.context)
        : null;
    if (generated) this.buffers.set(id, generated);
    return generated;
  }
  hasSource(id: string | null) {
    return (
      id === null ||
      id === "tone" ||
      /^demo:[0-5]$/.test(id) ||
      this.buffers.has(id)
    );
  }
  async importFile(file: File): Promise<string> {
    const buffer = await this.context.decodeAudioData(await file.arrayBuffer());
    const id = `file:${crypto.randomUUID()}:${file.name}`;
    this.buffers.set(id, buffer);
    return id;
  }
  private startSource(
    id: string | null,
    destination: AudioNode,
  ): AudioBufferSourceNode | null {
    const buffer = this.buffer(id);
    if (!buffer) return null;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(destination);
    source.start(0, this.context.currentTime % buffer.duration);
    return source;
  }
  private stopSource(source: AudioBufferSourceNode | null) {
    if (source) {
      source.stop();
      source.disconnect();
    }
  }

  /** Apply serializable desk state to the existing graph with short parameter ramps. */
  update(state: MixerState, now = performance.now()) {
    this.state = state;
    const g = state.globals;
    this.soloActive = state.channels.some((channel) => channel.solo);
    state.channels.forEach((channel, i) => {
      const strip = this.strips[i];
      const sourceId = i === 17 && g.usb34 ? state.usb34Source : channel.source;
      if (strip.sourceId !== sourceId) {
        this.stopSource(strip.source);
        strip.sourceId = sourceId;
        strip.source = this.startSource(sourceId, strip.input);
      }
      const isMic = channel.input === "mic" || channel.input === "condenser";
      const phantomOff = channel.input === "condenser" && !g.phantom && i < 17;
      this.set(strip.input.gain, phantomOff ? 0 : 1);
      const trimDb =
        i < 14
          ? channel.gain + (isMic ? -20 : 0)
          : i < 17
            ? isMic
              ? channel.gain - 40
              : 0
            : channel.gain;
      this.set(strip.trim.gain, dbToGain(trimDb));
      // Hybrid low-cut acts on its mic path, not its stereo line sockets (manual p.33).
      this.set(
        strip.hp.frequency,
        channel.lowCut && (i < 14 || isMic) ? 100 : 5,
      );
      this.set(strip.comp.ratio, i < 12 && channel.comp > 0 ? 6 : 1);
      this.set(strip.comp.threshold, -18 + (1 - channel.comp) * 18);
      this.set(strip.low.gain, channel.low);
      this.set(strip.mid.gain, channel.mid);
      this.set(strip.mid.frequency, i === 17 ? 2500 : channel.freq);
      this.set(strip.high.gain, channel.high);
      this.set(strip.mute.gain, channel.mute ? 0 : 1);
      this.set(strip.fader.gain, dbToGain(channel.fader));
      this.set(strip.pan.pan, channel.pan);
      this.set(strip.lr.gain, channel.lr ? 1 : 0);
      this.set(strip.sub12.gain, channel.sub12 ? 1 : 0);
      this.set(strip.sub34.gain, channel.sub34 ? 1 : 0);
      this.set(strip.solo.gain, channel.solo ? 1 : 0);
      this.set(strip.direct.gain, g.break ? 0 : 1);
      this.set(strip.mon1.gain, dbToGain(channel.mon1));
      this.set(strip.mon2.gain, dbToGain(channel.mon2));
      this.set(strip.mon3Pre.gain, channel.pre3 ? dbToGain(channel.mon3) : 0);
      this.set(strip.mon3Post.gain, channel.pre3 ? 0 : dbToGain(channel.mon3));
      this.set(strip.fx.gain, dbToGain(channel.fx));
    });
    this.set(this.main.gain, dbToGain(g.main));
    this.set(this.breakGate.gain, g.break ? 0 : 1);
    this.set(this.sub12.gain, dbToGain(g.sub12));
    this.set(this.sub34.gain, dbToGain(g.sub34));
    this.set(this.sub12LR.gain, g.sub12LR ? 1 : 0);
    this.set(this.sub34LR.gain, g.sub34LR ? 1 : 0);
    this.set(this.mon1.gain, dbToGain(g.mon1));
    this.set(this.mon2.gain, dbToGain(g.mon2));
    this.set(this.mon3.gain, dbToGain(g.mon3));
    this.set(this.fxSend.gain, dbToGain(g.fxMaster));
    if (state.preset !== this.preset) {
      this.effect?.dispose();
      this.preset = state.preset;
      this.effect = createEffect(this.context, this.fxSend, state.preset);
      this.effect.output.connect(this.wet);
    }
    this.set(
      this.wet.gain,
      g.fxMute || g.footMute || now < state.bootUntil ? 0 : 1,
    );
    this.set(this.fxReturn.gain, dbToGain(g.fxReturn));
    this.set(this.fxSub12.gain, g.fxSub12 ? 1 : 0);
    this.set(this.fxSub34.gain, g.fxSub34 ? 1 : 0);
    [g.fxMon1, g.fxMon2, g.fxMon3].forEach((db, i) =>
      this.set(this.fxMon[i].gain, dbToGain(db)),
    );
    if (state.usb12Source !== this.usb12Id) {
      this.stopSource(this.usb12Node);
      this.usb12Id = state.usb12Source;
      this.usb12Node = this.startSource(state.usb12Source, this.usb12);
    }
    this.set(this.directBlend.gain, g.blend > 0 ? 1 - g.blend : 1);
    this.set(this.usbBlend.gain, g.blend < 0 ? 1 + g.blend : 1);
    this.set(this.monitorMain.gain, !g.toPhones && !this.soloActive ? 1 : 0);
    this.set(
      this.monitorSolo.gain,
      !g.toPhones && this.soloActive && !g.break ? 1 : 0,
    );
    this.set(this.monitorBlend.gain, g.toPhones ? 1 : 0);
    this.set(this.phones.gain, dbToGain(g.phones));
    this.set(this.cr.gain, dbToGain(g.cr));
    this.set(this.listen.gain, state.power ? 1 : 0);
    this.initialized = true;
  }
  selectBus(bus: ListenBus) {
    try {
      this.taps?.[this.currentBus].disconnect(this.listen);
    } catch {
      /* Initial selection has no connection yet. */
    }
    this.currentBus = bus;
    this.taps[bus].connect(this.listen);
  }
  setVolume(db: number) {
    this.set(this.safety.gain, dbToGain(db));
  }
  async start() {
    await this.context.resume();
  }
  async pause() {
    await this.context.suspend();
  }
  async dispose() {
    this.effect?.dispose();
    await this.context.close();
  }
  private peak(node: AnalyserNode): number {
    node.getFloatTimeDomainData(this.samples);
    let peak = 0;
    for (const sample of this.samples) peak = Math.max(peak, Math.abs(sample));
    return gainToDb(peak) + 18;
  }
  read(): Readings {
    if (!this.state?.power || this.context.state !== "running")
      return emptyReadings();
    return {
      left: this.peak(this.soloActive ? this.soloMeter : this.meterLeft),
      right: this.soloActive ? -120 : this.peak(this.meterRight),
      inputs: this.strips.map((strip) => this.peak(strip.inputMeter)),
      channel: this.strips.map((strip) => this.peak(strip.pre)),
      buses: Object.fromEntries(
        LISTEN_BUSES.map((bus) => [bus.id, this.peak(this.taps[bus.id])]),
      ) as Record<ListenBus, number>,
      running: true,
    };
  }
}
