import type { Fade, MixerState, Transition } from './types';
export const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));
export const progress = (op: Transition | Fade, now: number) => clamp((now - op.startedAt) / Math.max(1, op.durationMs));
export const opacity = (state: MixerState, now: number) => state.fade ? state.fade.from + (state.fade.to - state.fade.from) * progress(state.fade, now) : state.black;
/** Commit from captured bus descriptors so interrupts and stale completions cannot perform a second swap. */
export function commit(state: MixerState): MixerState {
  return { ...state, pgm: state.transition ? { ...state.transition.to } : { ...state.pvw }, pvw: state.transition ? { ...state.transition.from } : { ...state.pgm }, transition: null };
}
