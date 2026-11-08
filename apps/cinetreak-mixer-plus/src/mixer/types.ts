import type { ParamValue } from './menus';
export type Source = 'IN1' | 'IN2' | 'IN3' | 'IN4' | 'PAT' | 'E-STOP';
export type Effect = 'chroma' | 'luma' | 'pip' | 'dsk' | 'logo';
export const effects: Effect[] = ['chroma', 'luma', 'pip', 'dsk', 'logo'];
export interface BusScene { source: Source; chroma: boolean; luma: boolean; pip: boolean }
export interface Camera { x: number; y: number; zoom: number }
export interface Transition { id: number; kind: string; startedAt: number; durationMs: number; from: BusScene; to: BusScene; softness: number; dip: string; color: string }
export interface Fade { id: number; startedAt: number; durationMs: number; from: number; to: number }
export interface Snapshot { pgm: BusScene; pvw: BusScene; downstream: MixerState['downstream']; params: Record<string, ParamValue>; assets: Record<string, string> }
export interface MixerState {
  power: boolean; locked: boolean; started: boolean; pgm: BusScene; pvw: BusScene;
  downstream: { pgm: { dsk: boolean; logo: boolean }; pvw: { dsk: boolean; logo: boolean } };
  selected: Effect; params: Record<string, ParamValue>; transition: Transition | null; fade: Fade | null; black: number;
  serial: number; freeze: { source: Source; id: number } | null; mv: boolean; cam: boolean; pos: boolean; position: string | null;
  cameras: Camera[]; presets: (Camera | null)[][];
  menu: { open: boolean; path: number[]; cursor: number; editing: boolean; lastInput: number; octet: number };
  memories: (Snapshot | null)[]; assets: Record<string, string>;
  notice: string;
}
export type Action =
  | { type: 'BUTTON'; id: string; now: number }
  | { type: 'ENCODER'; delta: number; now: number }
  | { type: 'MODE'; delta: number; now: number }
  | { type: 'PARAM'; id: string; value: ParamValue; now: number }
  | { type: 'MOVE'; x: number; y: number; zoom: number; dt: number; now: number }
  | { type: 'TICK'; now: number }
  | { type: 'COMPLETE'; id: number; now: number }
  | { type: 'ASSET'; slot: string; id: string; now: number }
  | { type: 'NOTICE'; message: string }
  | { type: 'RESTORE'; state: Partial<MixerState> };
