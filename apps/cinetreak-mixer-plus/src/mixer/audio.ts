import type { MixerState } from './types';
import { progress } from './switching';
import type { Sources } from './video/sources';

export type Levels = Record<string, number>;
interface Channel { oscillator: OscillatorNode; tone: GainNode; input: GainNode; gain: GainNode; delay: DelayNode; gate: GainNode; analyser: AnalyserNode; compressor: DynamicsCompressorNode; mediaId?: string }
const channels = ['IN1', 'IN2', 'IN3', 'IN4', 'MIC1', 'MIC2'];
const dbGain = (db: number) => Math.pow(10, db / 20);

/** Six real signal paths feed the mix; headphone monitoring replaces the audible PGM monitor. */
export class AudioMixer {
  context: AudioContext | null = null;
  monitor: 'PGM' | 'Headphones' = 'PGM';
  levels: Levels = {};
  private channels: Channel[] = [];
  private master?: GainNode;
  private programMeter?: AnalyserNode;
  private ear?: GainNode;
  private earMeter?: AnalyserNode;
  private speakerPgm?: GainNode;
  private speakerEar?: GainNode;
  private mediaNodes = new Map<string, MediaElementAudioSourceNode>();
  private samples = new Float32Array(256);
  async start() {
    if (!this.context) this.setup();
    await this.context!.resume();
  }
  private setup() {
    const ctx = this.context = new AudioContext();
    const sum = ctx.createGain();
    this.master = ctx.createGain(); this.programMeter = ctx.createAnalyser(); this.programMeter.fftSize = 256;
    this.speakerPgm = ctx.createGain(); this.speakerEar = ctx.createGain();
    sum.connect(this.master).connect(this.programMeter).connect(this.speakerPgm).connect(ctx.destination);
    this.ear = ctx.createGain(); this.earMeter = ctx.createAnalyser(); this.earMeter.fftSize = 256;
    this.ear.connect(this.earMeter).connect(this.speakerEar).connect(ctx.destination);
    this.channels = channels.map((name, i) => {
      const oscillator = ctx.createOscillator(), tone = ctx.createGain(), input = ctx.createGain(), delay = ctx.createDelay(1), gain = ctx.createGain(), gate = ctx.createGain(), analyser = ctx.createAnalyser(), compressor = ctx.createDynamicsCompressor();
      oscillator.frequency.value = [196, 261.63, 329.63, 392, 146.83, 220][i]; oscillator.type = 'sine'; tone.gain.value = 0;
      compressor.ratio.value = 1; analyser.fftSize = 256;
      oscillator.connect(tone).connect(input).connect(compressor).connect(delay).connect(gain).connect(analyser).connect(gate).connect(sum);
      oscillator.start(); return { oscillator, tone, input, compressor, delay, gain, analyser, gate };
    });
  }
  /** Reconcile live channel routing with mixer state; reuse nodes and smooth audible gain/delay changes. */
  update(s: MixerState, now: number, sources: Sources) {
    const ctx = this.context;
    if (!ctx) return;
    const when = ctx.currentTime, active = s.started && s.power;
    const smooth = (param: AudioParam, value: number) => param.setTargetAtTime(value, when, .015);
    this.channels.forEach((ch, i) => {
      const name = channels[i], id = s.assets[name], imported = id ? sources.imported.get(id) : undefined;
      const media = imported?.element instanceof HTMLMediaElement ? imported.element : undefined;
      if (ch.mediaId !== id || (id && media && !this.mediaNodes.has(id))) {
        if (ch.mediaId) this.mediaNodes.get(ch.mediaId)?.disconnect();
        ch.mediaId = id;
        if (id && media) {
          let node = this.mediaNodes.get(id);
          if (!node) { node = ctx.createMediaElementSource(media); this.mediaNodes.set(id, node); }
          media.muted = false; node.connect(ch.input);
        }
      }
      const synthetic = !id;
      smooth(ch.tone.gain, synthetic && active ? .065 * (.45 + .55 * Math.max(0, Math.sin(now / 360 + i * 1.3))) : 0);
      const key = `audio.${name.toLowerCase()}`;
      smooth(ch.gain.gain, dbGain(Number(s.params[`${key}.volume`])) * (i >= 4 && s.params[`${key}.input`] === 'Microphone' ? 1.6 : 1));
      smooth(ch.delay.delayTime, Math.max(0, Number(s.params[`${key}.delay`])) / 1000);
      const alc = Number(s.params[`${key}.alc`]) || 0;
      smooth(ch.compressor.threshold, alc ? -28 + alc * 3 : 0); smooth(ch.compressor.ratio, alc ? 2 + alc : 1);
      const mode = String(s.params[`${key}.mode`]);
      let gate = mode === 'On' ? 1 : 0;
      if (mode === 'AFV') {
        if (s.transition) {
          const t = progress(s.transition, now);
          gate = (s.transition.from.source === name ? 1 - t : 0) + (s.transition.to.source === name ? t : 0);
        } else gate = s.pgm.source === name ? 1 : 0;
      }
      smooth(ch.gate.gain, active ? gate : 0);
    });
    smooth(this.master!.gain, active && s.params['audio.pgm.on'] ? dbGain(Number(s.params['audio.pgm.volume'])) : 0);
    smooth(this.ear!.gain, active ? dbGain(Number(s.params['audio.ear.volume'])) : 0);
    smooth(this.speakerPgm!.gain, this.monitor === 'PGM' ? 1 : 0); smooth(this.speakerEar!.gain, this.monitor === 'Headphones' ? 1 : 0);
    // A single selected monitor tap avoids mixing every channel into the headphones accidentally.
    const selected = String(s.params['audio.ear.source']);
    const tap = selected === 'PGM' ? this.programMeter! : this.channels[Math.max(0, channels.indexOf(selected))].analyser;
    if (this.lastEarTap !== tap) {
      if (this.lastEarTap) this.lastEarTap.disconnect(this.ear!);
      tap.connect(this.ear!); this.lastEarTap = tap;
    }
    const read = (analyser: AnalyserNode) => {
      analyser.getFloatTimeDomainData(this.samples);
      const rms = Math.sqrt(this.samples.reduce((total, v) => total + v * v, 0) / this.samples.length);
      return Math.max(0, Math.min(1, (20 * Math.log10(Math.max(.00001, rms)) + 60) / 60));
    };
    this.channels.forEach((ch, i) => { this.levels[channels[i]] = read(ch.analyser); });
    this.levels.PGM = read(this.programMeter!); this.levels.EAR = read(this.earMeter!);
  }
  private lastEarTap?: AnalyserNode;
  dispose() { for (const ch of this.channels) ch.oscillator.stop(); void this.context?.close(); }
}
