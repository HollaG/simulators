/** Two overlapping moving delay windows keep pitch changes continuous.
 * This granular shifter is a practice approximation, not Yamaha's SPX algorithm.
 */
class PracticePitch extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "semitones",
        defaultValue: 0,
        minValue: -12,
        maxValue: 12,
        automationRate: "k-rate",
      },
    ];
  }
  constructor() {
    super();
    this.buffers = [new Float32Array(16384), new Float32Array(16384)];
    this.write = 0;
    this.phase = 0;
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0],
      output = outputs[0];
    const ratio = 2 ** (parameters.semitones[0] / 12),
      windowSize = sampleRate * 0.07;
    for (let i = 0; i < output[0].length; i++) {
      for (let ch = 0; ch < output.length; ch++) {
        const buffer = this.buffers[ch];
        buffer[this.write] = input[ch]?.[i] ?? input[0]?.[i] ?? 0;
        let value = 0;
        for (let voice = 0; voice < 2; voice++) {
          const phase = (this.phase + voice * 0.5) % 1;
          const position =
            (this.write - 256 - phase * windowSize + 32768) % 16384;
          const index = Math.floor(position),
            fraction = position - index;
          const sample =
            buffer[index] * (1 - fraction) +
            buffer[(index + 1) % 16384] * fraction;
          value += sample * (0.5 - 0.5 * Math.cos(2 * Math.PI * phase));
        }
        output[ch][i] = value;
      }
      this.write = (this.write + 1) % 16384;
      this.phase = (this.phase + (1 - ratio) / windowSize + 1) % 1;
    }
    return true;
  }
}
registerProcessor("practice-pitch", PracticePitch);
