import { dbGain } from "./state";

/** Browser approximations of the 24 documented SPX families. The dry signal is
 * handled by the desk; this graph emits wet signal only and owns its LFO cleanup.
 */
export class Effects {
  readonly input: GainNode;
  readonly output: GainNode;
  private nodes: AudioNode[] = [];
  private oscillators: OscillatorNode[] = [];
  private key = "";
  constructor(private context: AudioContext) {
    this.input = context.createGain();
    this.output = context.createGain();
  }
  /** Rebuild only when the audible program/parameter changes. Stop old modulation
   * sources as well as disconnecting them so parameter turns don't leak LFOs.
   */
  configure(program: number, parameter: number) {
    const key = `${program}:${parameter.toFixed(1)}`;
    if (key === this.key) return;
    this.key = key;
    this.input.disconnect();
    this.nodes.forEach((n) => n.disconnect());
    this.nodes = [];
    this.oscillators.forEach((n) => n.stop());
    this.oscillators = [];
    const c = this.context,
      p = parameter / 10;
    const own = <T extends AudioNode>(n: T): T => {
      this.nodes.push(n);
      return n;
    };
    const gain = (v: number) => {
      const n = own(c.createGain());
      n.gain.value = v;
      return n;
    };
    const modulate = (target: AudioParam, rate: number, depth: number) => {
      const lfo = own(c.createOscillator());
      lfo.frequency.value = rate;
      const amount = gain(depth);
      lfo.connect(amount).connect(target);
      lfo.start();
      this.oscillators.push(lfo);
    };
    if (program <= 10) {
      const convolver = own(c.createConvolver());
      convolver.normalize = false;
      const base = [2.8, 4.2, 0.8, 1.3, 1.8, 2.4, 1.9, 0.45, 0.4, 0.75][
        program - 1
      ];
      const seconds = 0.12 + base * (0.3 + p * 1.5);
      const buffer = c.createBuffer(
        2,
        Math.ceil(c.sampleRate * seconds),
        c.sampleRate,
      );
      for (let side = 0; side < 2; side++) {
        const samples = buffer.getChannelData(side);
        let seed = 8421 + side * 39;
        for (let i = 0; i < samples.length; i++) {
          seed = (1664525 * seed + 1013904223) >>> 0;
          const t = i / samples.length;
          samples[i] = (seed / 2147483648 - 1) * Math.exp(-t * 7) * 0.018;
          if (program === 9)
            samples[i] =
              i % Math.floor(c.sampleRate * (0.03 + side * 0.007)) === 0
                ? 0.3 * (1 - t)
                : 0;
          if (program === 10 && t > 0.4) samples[i] = 0;
        }
      }
      convolver.buffer = buffer;
      this.input.connect(convolver).connect(this.output);
    } else if (program <= 14) {
      const delay = own(c.createDelay(2));
      delay.delayTime.value = 0.04 + p * (program === 11 ? 0.65 : 0.9);
      this.input.connect(delay).connect(this.output);
      if (program !== 11) {
        const feedback = gain(0.18 + p * 0.42),
          filter = own(c.createBiquadFilter());
        filter.type = "lowpass";
        filter.frequency.value = program === 12 ? 8500 : 2800;
        delay.connect(filter).connect(feedback).connect(delay);
      }
    } else if (program === 15) {
      let previous: AudioNode = this.input;
      for (let i = 0; i < 4; i++) {
        const filter = own(c.createBiquadFilter());
        filter.type = "allpass";
        filter.frequency.value = 600 + i * 450;
        modulate(filter.frequency, 0.15 + p * 4, 450);
        previous.connect(filter);
        previous = filter;
      }
      previous.connect(this.output);
    } else if (program <= 19) {
      const voices = program === 19 ? 4 : program === 18 ? 3 : 2;
      for (let i = 0; i < voices; i++) {
        const delay = own(c.createDelay(0.1)),
          level = gain(1 / voices);
        delay.delayTime.value = program === 16 ? 0.004 : 0.018 + i * 0.007;
        modulate(
          delay.delayTime,
          program === 19 ? 0.5 + i * 0.15 : 0.1 + p * 3 + i * 0.13,
          program === 16 ? 0.002 : 0.002 + (program === 19 ? p : 0.5) * 0.006,
        );
        this.input.connect(delay).connect(level).connect(this.output);
        if (program === 16) {
          const feedback = gain(0.55);
          delay.connect(feedback).connect(delay);
        }
      }
    } else if (program === 20) {
      const amplitude = gain(0.5);
      modulate(amplitude.gain, 0.3 + p * 11, 0.5);
      this.input.connect(amplitude).connect(this.output);
    } else if (program === 21 || program === 22) {
      const filter = own(c.createBiquadFilter());
      filter.type = "bandpass";
      filter.Q.value = program === 21 ? 4 : 1.2;
      filter.frequency.value = program === 21 ? 1600 : 350 + p * 2200;
      if (program === 21) modulate(filter.frequency, 0.1 + p * 5, 1300);
      this.input.connect(filter).connect(this.output);
    } else if (program === 23) {
      const drive = own(c.createWaveShaper()),
        curve = new Float32Array(2048);
      const amount = 1 + p * 60;
      for (let i = 0; i < curve.length; i++)
        curve[i] = Math.tanh((i / 1023.5 - 1) * amount) / Math.tanh(amount);
      drive.curve = curve;
      drive.oversample = "2x";
      this.input
        .connect(drive)
        .connect(gain(dbGain(-6)))
        .connect(this.output);
    } else {
      const pitch = own(
        new AudioWorkletNode(c, "practice-pitch", {
          outputChannelCount: [2],
          parameterData: { semitones: -12 + p * 24 },
        }),
      );
      this.input.connect(pitch).connect(this.output);
    }
  }
  dispose() {
    this.oscillators.forEach((n) => n.stop());
    this.nodes.forEach((n) => n.disconnect());
    this.input.disconnect();
    this.output.disconnect();
  }
}
