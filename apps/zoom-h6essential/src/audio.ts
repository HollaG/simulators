import {
  dbGain,
  elapsed,
  enabled,
  isPlayback,
  mixerGain,
  type Config,
  type State,
  type Take,
} from "./state";

export const trackIndex = (channel: number) => Math.max(0, channel - 1);
export type Readings = {
  levels: number[];
  waves: number[][];
  mix: number[];
  time: number;
};
export const silentReadings = (): Readings => ({
  levels: Array(6).fill(-100),
  waves: Array.from({ length: 6 }, () => Array(64).fill(0)),
  mix: [-100, -100],
  time: 0,
});
const frequencies = [220, 330, 110, 165, 440, 550];

/** A periodic, deterministic six-channel rehearsal source. The 40 Hz component
 * makes the documented Lo Cut choices audible and measurable without live inputs.
 */
export function signal(time: number, channel: number): number {
  const t = ((time % 4) + 4) % 4;
  const envelope =
    0.45 + 0.55 * Math.pow(Math.sin(Math.PI * (t + channel / 8)), 2);
  return (
    envelope *
      (0.1 * Math.sin(2 * Math.PI * frequencies[channel] * t) +
        0.035 * Math.sin(2 * Math.PI * frequencies[channel] * 2 * t)) +
    0.06 * Math.sin(2 * Math.PI * 40 * t)
  );
}

function sourceBuffer(
  ctx: BaseAudioContext,
  channel: number,
  mono: boolean,
): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let n = 0; n < data.length; n++) {
    const t = n / ctx.sampleRate;
    data[n] =
      mono && channel < 2
        ? (signal(t, 0) + signal(t, 1)) / 2
        : signal(t, channel);
  }
  return buffer;
}

function sourceActive(config: Config, channel: number) {
  const i = trackIndex(channel),
    input = config.inputs[i];
  return (
    input.armed &&
    input.source !== "off" &&
    (i === 0 || input.source !== "condenser" || input.phantom)
  );
}
function pan(config: Config, channel: number): [number, number] {
  if (channel < 2) return channel === 0 ? [1, 0] : [0, 1];
  const linked = config.links[channel < 4 ? 0 : 1];
  return linked
    ? channel % 2 === 0
      ? [1, 0]
      : [0, 1]
    : [Math.SQRT1_2, Math.SQRT1_2];
}
function rms(data: Float32Array): number {
  let sum = 0;
  for (const v of data) sum += v * v;
  return Math.max(
    -100,
    20 * Math.log10(Math.sqrt(sum / data.length) || 0.00001),
  );
}
type Strip = {
  source: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  live: GainNode;
  playback: GainNode;
  gain: GainNode;
  analyser: AnalyserNode;
  left: GainNode;
  right: GainNode;
  samples: Float32Array<ArrayBuffer>;
};

/** The live monitor and recorded playback share meter/output taps. Saved audio
 * is rendered separately from captured settings, so headphone level never changes files.
 */
export class RecorderAudio {
  context: AudioContext | null = null;
  strips: Strip[] = [];
  buffers = new Map<number, AudioBuffer>();
  private previews = new Map<number, number[][]>();
  private master: GainNode | null = null;
  private mixMeters: AnalyserNode[] = [];
  private players: AudioBufferSourceNode[] = [];
  private playKey = "";
  private mono = false;
  private startPromise: Promise<void> | null = null;

  start(): Promise<void> {
    if (!this.startPromise) this.startPromise = this.setup();
    return this.startPromise.then(async () => {
      if (this.context?.state === "suspended") await this.context.resume();
    });
  }

  private async setup() {
    const ctx = new AudioContext();
    this.context = ctx;
    const merger = ctx.createChannelMerger(2);
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    merger.connect(this.master).connect(ctx.destination);
    const split = ctx.createChannelSplitter(2);
    merger.connect(split);
    this.mixMeters = [0, 1].map((i) => {
      const meter = ctx.createAnalyser();
      meter.fftSize = 1024;
      split.connect(meter, i);
      return meter;
    });
    this.strips = Array.from({ length: 6 }, (_, channel) => {
      const source = ctx.createBufferSource();
      source.buffer = sourceBuffer(ctx, channel, false);
      source.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.Q.value = Math.SQRT1_2;
      const live = ctx.createGain();
      live.gain.value = 0;
      const playback = ctx.createGain();
      playback.gain.value = 0;
      const gain = ctx.createGain();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      const left = ctx.createGain(),
        right = ctx.createGain();
      source.connect(filter).connect(live).connect(gain).connect(analyser);
      playback.connect(gain);
      analyser.connect(left).connect(merger, 0, 0);
      analyser.connect(right).connect(merger, 0, 1);
      source.start(0, (performance.now() / 1000) % 4);
      return {
        source,
        filter,
        live,
        playback,
        gain,
        analyser,
        left,
        right,
        samples: new Float32Array(1024),
      };
    });
    await ctx.resume();
  }

  sync(s: State, listen: boolean) {
    const ctx = this.context;
    if (!ctx || !this.master) return;
    const playing = s.mode === "playing";
    const key = playing ? `${s.selected}:${s.since}` : "";
    if (key !== this.playKey) {
      this.players.forEach((p) => {
        p.stop();
        p.disconnect();
      });
      this.players = [];
      this.playKey = key;
      const take = this.buffers.get(s.selected);
      if (playing && take) {
        const offset = elapsed(s, performance.now());
        if (offset < take.duration)
          for (let ch = 0; ch < 6; ch++) {
            const source = ctx.createBufferSource();
            const mono = ctx.createBuffer(1, take.length, take.sampleRate);
            mono.copyToChannel(take.getChannelData(ch), 0);
            source.buffer = mono;
            source.connect(this.strips[ch].playback);
            source.start(0, offset);
            this.players.push(source);
          }
      }
    }
    if (s.config.mono !== this.mono) {
      this.mono = s.config.mono;
      for (let ch = 0; ch < 2; ch++) {
        const strip = this.strips[ch];
        strip.source.stop();
        strip.source.disconnect();
        const source = ctx.createBufferSource();
        source.buffer = sourceBuffer(ctx, ch, this.mono);
        source.loop = true;
        source.connect(strip.filter);
        source.start(0, (performance.now() / 1000) % 4);
        strip.source = source;
      }
    }
    const routing = isPlayback(s)
      ? s.takes.find((t) => t.id === s.selected)!.config
      : s.config;
    this.strips.forEach((strip, ch) => {
      const input = s.config.inputs[trackIndex(ch)];
      strip.filter.frequency.setTargetAtTime(
        input.lowCut || 0,
        ctx.currentTime,
        0.01,
      );
      strip.live.gain.setTargetAtTime(
        s.power && !isPlayback(s) && sourceActive(s.config, ch) ? 1 : 0,
        ctx.currentTime,
        0.01,
      );
      strip.playback.gain.setTargetAtTime(
        s.power && playing && enabled(s, trackIndex(ch)) ? 1 : 0,
        ctx.currentTime,
        0.01,
      );
      strip.gain.gain.setTargetAtTime(
        dbGain(mixerGain(s, trackIndex(ch))),
        ctx.currentTime,
        0.01,
      );
      const [left, right] = pan(routing, ch);
      strip.left.gain.value = left;
      strip.right.gain.value = right;
    });
    // Monitoring is deliberately attenuated; the meter remains at the actual mix tap.
    this.master.gain.setTargetAtTime(
      s.power && listen ? (s.config.volume / 100) * 0.08 : 0,
      ctx.currentTime,
      0.02,
    );
  }

  read(state?: State): Readings {
    if (!this.context) return silentReadings();
    const waves: number[][] = [],
      levels: number[] = [];
    for (const strip of this.strips) {
      strip.analyser.getFloatTimeDomainData(strip.samples);
      levels.push(rms(strip.samples));
      waves.push(Array.from({ length: 64 }, (_, i) => strip.samples[i * 16]));
    }
    const data = new Float32Array(1024);
    const mix = this.mixMeters.map((meter) => {
      meter.getFloatTimeDomainData(data);
      return rms(data);
    });
    return {
      waves:
        state && isPlayback(state)
          ? this.previews.get(state.selected) || waves
          : waves,
      levels,
      mix,
      time: this.context.currentTime,
    };
  }

  /** Reconstruct a take from the same periodic sources and captured mixer timeline.
   * Channels 0–5 are individual recordings; 6–7 are the automatic stereo file.
   */
  async render(take: Take): Promise<AudioBuffer> {
    const ctx = new OfflineAudioContext(
      8,
      Math.ceil(take.duration * take.config.rate),
      take.config.rate,
    );
    const merger = ctx.createChannelMerger(8);
    merger.connect(ctx.destination);
    for (let ch = 0; ch < 6; ch++) {
      if (!sourceActive(take.config, ch)) continue;
      const input = take.config.inputs[trackIndex(ch)];
      const source = ctx.createBufferSource();
      source.buffer = sourceBuffer(ctx, ch, take.config.mono);
      source.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = input.lowCut || 0;
      filter.Q.value = Math.SQRT1_2;
      source.connect(filter);
      const mixed = ctx.createGain();
      filter.connect(mixed);
      for (const event of take.events)
        mixed.gain.setValueAtTime(
          dbGain(event.gains[trackIndex(ch)]),
          Math.min(take.duration, event.time),
        );
      (take.config.post ? mixed : filter).connect(merger, 0, ch);
      if (take.config.rate !== 96000) {
        pan(take.config, ch).forEach((value, side) => {
          const gain = ctx.createGain();
          gain.gain.value = value;
          mixed.connect(gain).connect(merger, 0, 6 + side);
        });
      }
      source.start(0, (take.startedAt / 1000) % 4);
    }
    const buffer = await ctx.startRendering();
    this.buffers.set(take.id, buffer);
    // Cache a peak envelope once per take, rather than scanning long recordings
    // every display frame. Paused playback still shows the recorded waveform.
    this.previews.set(
      take.id,
      Array.from({ length: 6 }, (_, ch) => {
        const data = buffer.getChannelData(ch);
        return Array.from({ length: 64 }, (_, bin) => {
          let peak = 0;
          const start = Math.floor((bin * data.length) / 64),
            end = Math.floor(((bin + 1) * data.length) / 64);
          for (let n = start; n < end; n++)
            peak = Math.max(peak, Math.abs(data[n]));
          return peak * (bin % 2 ? 1 : -1);
        });
      }),
    );
    return buffer;
  }

  close() {
    this.players.forEach((p) => p.stop());
    this.players = [];
    this.buffers.clear();
    this.previews.clear();
    void this.context?.close();
  }
}

export function recordedFiles(
  take: Take,
): { name: string; channels: number[] }[] {
  const result: { name: string; channels: number[] }[] = [];
  if (take.config.inputs[0].armed)
    result.push({
      name: take.config.mono ? "MicMono" : "MicLR",
      channels: take.config.mono ? [0] : [0, 1],
    });
  for (let i = 1; i <= 4; i++) {
    if (!take.config.inputs[i].armed) continue;
    if (i % 2 && take.config.links[i < 3 ? 0 : 1]) {
      result.push({ name: `Tr${i}${i + 1}`, channels: [i + 1, i + 2] });
      i++;
    } else result.push({ name: `Tr${i}`, channels: [i + 1] });
  }
  if (take.config.rate !== 96000) result.push({ name: "LR", channels: [6, 7] });
  return result;
}

/** IEEE float WAV preserves values above full scale; no clipping or integer conversion. */
export function floatWav(buffer: AudioBuffer, channels: number[]): ArrayBuffer {
  const bytes = buffer.length * channels.length * 4;
  const result = new ArrayBuffer(56 + bytes),
    view = new DataView(result);
  const word = (offset: number, value: string) =>
    [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  word(0, "RIFF");
  view.setUint32(4, 48 + bytes, true);
  word(8, "WAVE");
  word(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 3, true);
  view.setUint16(22, channels.length, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels.length * 4, true);
  view.setUint16(32, channels.length * 4, true);
  view.setUint16(34, 32, true);
  word(36, "fact");
  view.setUint32(40, 4, true);
  view.setUint32(44, buffer.length, true);
  word(48, "data");
  view.setUint32(52, bytes, true);
  const data = channels.map((ch) => buffer.getChannelData(ch));
  for (let n = 0; n < buffer.length; n++)
    for (let ch = 0; ch < channels.length; ch++)
      view.setFloat32(56 + (n * channels.length + ch) * 4, data[ch][n], true);
  return result;
}
