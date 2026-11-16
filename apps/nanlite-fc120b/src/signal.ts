import { clamp, effects, fanCap, type State } from "./state";

const noise = (n: number) => { const value = Math.sin(n * 127.1 + 311.7) * 43758.5453; return value - Math.floor(value); };
const mix = (a: number, b: number, n: number) => a + (b - a) * n;
const triangle = (t: number) => 1 - Math.abs((t % 1) * 2 - 1);
export type Signal = { dim: number; cct: number; cap: number };

/** Sample illustrative, deterministic light output; this is not a firmware model.
 * Irregular storm spacing uses seeded intervals, so min/max affect real output.
 */
export function sample(state: State, now: number): Signal {
  const config = state.config, cap = fanCap(config);
  let dim = config.dim, cct = config.cct;
  if (!state.power || state.blackout) return { dim: 0, cct, cap };
  if (config.mode === "EFFECT") {
    const e = effects[config.effect], v = config.effects[config.effect];
    const t = Math.max(0, now - state.epoch) / 1000;
    const speed = v.speed ?? 50, hi = v.dim ?? 100, lo = v.dimLow ?? 0;
    const rate = 0.3 + speed / 15;
    const flicker = noise(Math.floor(t * rate * 3));
    cct = v.cct ?? 5600;
    switch (e.name) {
      case "CCT LOOP": cct = mix(v.cctLow!, v.cctHigh!, triangle(t / speed)); dim = hi; break;
      case "INT LOOP": dim = mix(lo, hi, triangle(t / speed)); break;
      case "FLASH": dim = t % v.interval! < v.interval! * v.ratio! / 100 ? hi : 0; break;
      case "PULSE": dim = hi * (0.5 - 0.5 * Math.cos(2 * Math.PI * t * v.pulses! / 60)); break;
      case "STORM AUTO": {
        let remaining = t;
        // Repeating a seeded 32-storm cycle bounds work even after a long session.
        const intervals = Array.from({ length: 32 }, (_, i) => mix(v.intervalLow!, v.intervalHigh!, noise(i + 1)));
        remaining %= intervals.reduce((sum, value) => sum + value, 0);
        let i = 0;
        while (remaining >= intervals[i] && i < 31) remaining -= intervals[i++];
        dim = remaining < 0.36 && (remaining % 0.12) < 0.055 ? hi : 0;
        break;
      }
      case "STORM MANUAL": {
        const age = state.trigger === null ? Infinity : Math.max(0, now - state.trigger) / 1000;
        dim = age < 0.6 && age % 0.16 < 0.07 ? hi : 0; break;
      }
      case "TV": dim = mix(lo, hi, 0.2 + flicker * 0.8); cct += (noise(Math.floor(t * rate)) * 2 - 1) * v.shift!; break;
      case "PAPARAZZI": dim = flicker > 0.65 ? hi : 0; break;
      case "CANDLE/FIRE": dim = mix(lo, hi, 0.3 + 0.7 * flicker); break;
      case "BAD BULB": dim = hi * (1 - (flicker > 0.6 ? v.intensity! / 100 : 0)); break;
      case "FIREWORK": {
        const age = t % (0.5 + (101 - speed) / 12);
        dim = hi * (age < 0.1 ? age / 0.1 : Math.exp(-(age - 0.1) * (101 - v.decay!) / 12)); break;
      }
      case "EXPLOSION AUTO": dim = hi * Math.exp(-(t % (0.5 + (101 - speed) / 12)) * (101 - v.decay!) / 8); break;
      case "EXPLOSION MANUAL": dim = state.trigger === null ? 0 : hi * Math.exp(-Math.max(0, now - state.trigger) / 1000 * (101 - v.decay!) / 8); break;
      case "WELDING": dim = v.pause ? 0 : mix(lo, hi, flicker > 0.35 ? 0.7 + 0.3 * flicker : 0); break;
    }
  }
  // The relative CCT envelope is deliberately illustrative, not measured lux.
  const envelope = config.settings.output === 1 ? 0.82 : 0.82 + 0.18 * (1 - Math.abs(cct - 4600) / 1900);
  return { dim: clamp(Math.min(dim, cap) * envelope, 0, 100), cct: clamp(cct, 2700, 6500), cap };
}

/** Approximate blackbody colour, sufficient to compare warm/cool practice settings. */
export function kelvinRgb(kelvin: number): [number, number, number] {
  const t = clamp(kelvin, 2700, 6500) / 100;
  return [255, clamp(99.47 * Math.log(t) - 161.12, 0, 255), clamp(138.52 * Math.log(t - 10) - 305.04, 0, 255)];
}
