type Effect = { output: AudioNode; dispose: () => void };

/** Approximate the 24 GigFX programs with audible Web Audio effect families.
 * These reproduce the practice routing, not Mackie's proprietary DSP algorithms.
 */
export function createEffect(
  context: BaseAudioContext,
  input: AudioNode,
  preset: number,
): Effect {
  const nodes: AudioNode[] = [];
  const oscillators: OscillatorNode[] = [];
  const output = context.createGain();
  nodes.push(output);
  const track = <T extends AudioNode>(node: T): T => {
    nodes.push(node);
    return node;
  };
  const reverb = (seconds: number, brightness: number) => {
    const convolver = track(context.createConvolver());
    const length = Math.ceil(context.sampleRate * seconds);
    const impulse = context.createBuffer(2, length, context.sampleRate);
    let seed = 919 + preset;
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      let previous = 0;
      for (let i = 0; i < length; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        previous += brightness * (seed / 2147483648 - 1 - previous);
        data[i] = previous * Math.exp((-i / length) * 7);
      }
    }
    convolver.buffer = impulse;
    input.connect(convolver);
    convolver.connect(output);
  };
  const delay = (time: number, feedback: number, pingPong = false) => {
    const left = track(context.createDelay(2));
    const right = track(context.createDelay(2));
    const feedbackL = track(context.createGain());
    const feedbackR = track(context.createGain());
    left.delayTime.value = time;
    right.delayTime.value = time;
    feedbackL.gain.value = feedback;
    feedbackR.gain.value = feedback;
    input.connect(left);
    if (pingPong) {
      const panL = track(context.createStereoPanner());
      const panR = track(context.createStereoPanner());
      panL.pan.value = -1;
      panR.pan.value = 1;
      left.connect(panL).connect(output);
      right.connect(panR).connect(output);
      left.connect(feedbackL).connect(right);
      right.connect(feedbackR).connect(left);
    } else {
      left.connect(output);
      left.connect(feedbackL).connect(left);
    }
  };
  const modulation = (
    time: number,
    depth: number,
    rate: number,
    feedback: number,
  ) => {
    const delayed = track(context.createDelay(0.1));
    const mod = track(context.createGain());
    const fb = track(context.createGain());
    const lfo = context.createOscillator();
    oscillators.push(lfo);
    delayed.delayTime.value = time;
    mod.gain.value = depth;
    fb.gain.value = feedback;
    lfo.frequency.value = rate;
    lfo.connect(mod).connect(delayed.delayTime);
    lfo.start();
    input.connect(delayed).connect(output);
    delayed.connect(fb).connect(delayed);
  };
  if (preset <= 9) {
    const times = [0.45, 0.7, 0.85, 1.2, 1.8, 2.5, 4, 0.9, 2];
    reverb(times[preset - 1], preset === 1 || preset === 8 ? 0.9 : 0.35);
  } else if (preset === 10 || preset === 11)
    modulation(0.018, 0.004, preset === 10 ? 0.8 : 1.5, 0.12);
  else if (preset === 12) {
    reverb(1.5, 0.5);
    delay(0.28, 0.3);
    output.gain.value = 0.6;
  } else if (preset === 13) modulation(0.035, 0.002, 0.4, 0);
  else if (preset >= 14 && preset <= 18)
    delay([0.28, 0.16, 0.32, 0.48, 0.25][preset - 14], 0.38, preset === 18);
  else if (preset === 19) {
    const distortion = track(context.createWaveShaper());
    const curve = new Float32Array(4096);
    for (let i = 0; i < curve.length; i++)
      curve[i] = Math.tanh(((i / (curve.length - 1)) * 2 - 1) * 8) * 0.35;
    distortion.curve = curve;
    distortion.oversample = "2x";
    input.connect(distortion).connect(output);
  } else if (preset === 20) {
    reverb(1.4, 0.2);
    delay(0.045, 0.22);
    output.gain.value = 0.6;
  } else if (preset === 21) delay(0.065, 0.18);
  else if (preset === 22) {
    const filter = track(context.createBiquadFilter());
    filter.type = "bandpass";
    filter.frequency.value = 1200;
    filter.Q.value = 3;
    const lfo = context.createOscillator();
    oscillators.push(lfo);
    const mod = track(context.createGain());
    mod.gain.value = 950;
    lfo.frequency.value = 1.6;
    input.connect(filter).connect(output);
    lfo.connect(mod).connect(filter.frequency);
    lfo.start();
  } else if (preset === 23) modulation(0.005, 0.004, 0.25, 0.6);
  else {
    delay(0.09, 0.16);
    reverb(0.3, 0.5);
    output.gain.value = 0.65;
  }
  return {
    output,
    dispose: () => {
      // Disconnect only this program's input edges: the FX send analyser stays attached.
      for (const node of nodes) {
        try {
          input.disconnect(node);
        } catch {
          /* No direct input edge. */
        }
        node.disconnect();
      }
      for (const osc of oscillators) {
        osc.stop();
        osc.disconnect();
      }
    },
  };
}
