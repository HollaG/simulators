/** Deterministic eight-beat loops share a length and phase so the practice band stays together. */
export function makeDemoBuffer(
  context: BaseAudioContext,
  instrument: number,
): AudioBuffer {
  const beat = 60 / 110;
  const duration = beat * 8;
  const buffer = context.createBuffer(
    1,
    Math.round(context.sampleRate * duration),
    context.sampleRate,
  );
  const samples = buffer.getChannelData(0);
  let seed = 1729 + instrument;
  const notes = [55, 55, 65.406, 73.416, 55, 82.407, 73.416, 65.406];
  for (let i = 0; i < samples.length; i++) {
    const time = i / context.sampleRate;
    const b = Math.floor(time / beat);
    const t = time % beat;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1;
    if (instrument === 0)
      samples[i] =
        Math.sin(2 * Math.PI * (47 * t + 12 * (1 - Math.exp(-t * 35)))) *
        Math.exp(-t * 19) *
        0.28;
    else if (instrument === 1)
      samples[i] =
        b % 2
          ? (noise * 0.7 + Math.sin(t * 2 * Math.PI * 180) * 0.3) *
            Math.exp(-t * 24) *
            0.23
          : noise * Math.exp(-t * 130) * 0.025;
    else if (instrument === 2)
      samples[i] =
        (Math.sin(2 * Math.PI * notes[b] * t) +
          0.25 * Math.sin(4 * Math.PI * notes[b] * t)) *
        Math.min(t * 100, 1) *
        Math.exp(-t * 3) *
        0.17;
    else if (instrument === 3) {
      const p = t % (beat / 2);
      samples[i] =
        [2, 2.5, 3].reduce(
          (sum, n) => sum + Math.sin(2 * Math.PI * notes[b] * n * p),
          0,
        ) *
        Math.exp(-p * 13) *
        0.045;
    } else if (instrument === 4)
      samples[i] =
        [2, 2.5, 3, 4].reduce(
          (sum, n) =>
            sum +
            Math.sin(time * 2 * Math.PI * (b < 4 ? 130.813 : 146.832) * n),
          0,
        ) *
        Math.sin((Math.PI * t) / beat) *
        0.027;
    else
      samples[i] =
        [1, 2, 3].reduce(
          (sum, n) =>
            sum +
            Math.sin(
              time * Math.PI * 2 * notes[b] * 4 * n +
                Math.sin(time * 32) * 0.04,
            ) /
              n,
          0,
        ) *
        Math.sin((Math.PI * t) / beat) ** 2 *
        0.085;
  }
  return buffer;
}
export function makeTone(context: BaseAudioContext): AudioBuffer {
  const buffer = context.createBuffer(
    1,
    context.sampleRate,
    context.sampleRate,
  );
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++)
    data[i] = Math.sin((i / context.sampleRate) * Math.PI * 2 * 1000) * 0.126;
  return buffer;
}
