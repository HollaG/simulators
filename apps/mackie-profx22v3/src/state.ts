export const CHANNEL_LABELS = [
  ...Array.from({ length: 14 }, (_, i) => String(i + 1)),
  "15/16",
  "17/18",
  "19/20",
  "21/22",
];
export const PRESETS = [
  "Bright Room",
  "Warm Lounge",
  "Small Stage",
  "Warm Theater",
  "Warm Hall",
  "Concert Hall",
  "Cathedral",
  "Small Plate",
  "Large Plate",
  "Chorus 1",
  "Chorus 2",
  "Delay + Reverb",
  "Doubler",
  "Echo",
  "Delay 1 (Fast)",
  "Delay 2 (Medium)",
  "Delay 3 (Slow)",
  "Ping-Pong Delay",
  "Overdrive / Distortion",
  "Spring Reverb",
  "Early Reflections",
  "Auto-Wah",
  "Flange",
  "Slapback Reverb",
];
export const METER_STEPS = [20, 15, 10, 6, 3, 0, -2, -4, -7, -10, -20, -30];
export type InputType = "line" | "mic" | "condenser" | "instrument";
export type Channel = {
  name: string;
  source: string | null;
  input: InputType;
  gain: number;
  comp: number;
  high: number;
  mid: number;
  freq: number;
  low: number;
  mon1: number;
  mon2: number;
  mon3: number;
  fx: number;
  pan: number;
  fader: number;
  mute: boolean;
  solo: boolean;
  lowCut: boolean;
  hiZ: boolean;
  pre3: boolean;
  lr: boolean;
  sub12: boolean;
  sub34: boolean;
};
export type NumericChannelKey = {
  [K in keyof Channel]: Channel[K] extends number ? K : never;
}[keyof Channel];
export type BooleanChannelKey = {
  [K in keyof Channel]: Channel[K] extends boolean ? K : never;
}[keyof Channel];
export type Globals = {
  main: number;
  sub12: number;
  sub34: number;
  fxReturn: number;
  mon1: number;
  mon2: number;
  mon3: number;
  fxMaster: number;
  fxMon1: number;
  fxMon2: number;
  fxMon3: number;
  blend: number;
  cr: number;
  phones: number;
  sub12LR: boolean;
  sub34LR: boolean;
  fxSub12: boolean;
  fxSub34: boolean;
  phantom: boolean;
  break: boolean;
  fxMute: boolean;
  footMute: boolean;
  toPhones: boolean;
  usb34: boolean;
};
export type NumericGlobalKey = {
  [K in keyof Globals]: Globals[K] extends number ? K : never;
}[keyof Globals];
export type BooleanGlobalKey = {
  [K in keyof Globals]: Globals[K] extends boolean ? K : never;
}[keyof Globals];
export type MixerState = {
  channels: Channel[];
  globals: Globals;
  preset: number;
  power: boolean;
  bootUntil: number;
  pending: { preset: number; expires: number } | null;
  usb12Source: string | null;
  usb34Source: string | null;
};
export type Action =
  | {
      type: "channel";
      index: number;
      key: NumericChannelKey | BooleanChannelKey | "name" | "source" | "input";
      value: number | boolean | string | null;
    }
  | { type: "global"; key: keyof Globals; value: number | boolean }
  | { type: "presetTurn"; delta: number; now: number }
  | { type: "presetConfirm"; now: number }
  | { type: "tick"; now: number }
  | { type: "power"; now: number }
  | { type: "usb"; bus: "usb12Source" | "usb34Source"; source: string | null }
  | { type: "load"; state: MixerState }
  | { type: "reset" }
  | { type: "demo" };

export const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));
export const dbToGain = (db: number) => (db <= -90 ? 0 : 10 ** (db / 20));
export const gainToDb = (gain: number) =>
  gain > 0 ? 20 * Math.log10(gain) : -120;
export const formatDb = (db: number) =>
  db <= -90 ? "−∞ dB" : `${db > 0 ? "+" : ""}${db.toFixed(1)} dB`;
// Piecewise taper keeps useful mixing levels spread over the upper half of the fader.
const FADER_POINTS = [
  [0, -90],
  [0.06, -60],
  [0.15, -40],
  [0.27, -20],
  [0.43, -10],
  [0.58, -5],
  [0.75, 0],
  [0.9, 5],
  [1, 10],
];
export function faderDb(position: number): number {
  const p = clamp(position, 0, 1);
  const i = FADER_POINTS.findIndex((point) => point[0] >= p);
  if (i <= 0) return -90;
  const [a, b] = [FADER_POINTS[i - 1], FADER_POINTS[i]];
  return a[1] + ((p - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
}
export function faderPosition(db: number): number {
  const i = FADER_POINTS.findIndex((point) => point[1] >= db);
  if (i <= 0) return db >= 10 ? 1 : 0;
  const [a, b] = [FADER_POINTS[i - 1], FADER_POINTS[i]];
  return a[0] + ((db - a[1]) / (b[1] - a[1])) * (b[0] - a[0]);
}
export function channelRange(
  index: number,
  key: NumericChannelKey,
): [number, number, number] {
  if (key === "gain")
    return index === 17
      ? [-20, 20, 0.5]
      : index >= 14
        ? [0, 60, 0.5]
        : [-20, 40, 0.5];
  if (key === "freq") return [100, 8000, 10];
  if (key === "pan") return [-1, 1, 0.02];
  if (key === "comp") return [0, 1, 0.01];
  if (["high", "mid", "low"].includes(key)) return [-15, 15, 0.5];
  return [-90, 10, 0.5];
}
export const makeChannel = (index: number): Channel => ({
  name: `Channel ${CHANNEL_LABELS[index]}`,
  source: null,
  input: "line",
  gain: index >= 14 && index < 17 ? 20 : 0,
  comp: 0,
  high: 0,
  mid: 0,
  freq: 600,
  low: 0,
  mon1: -90,
  mon2: -90,
  mon3: -90,
  fx: -90,
  pan: 0,
  fader: -90,
  mute: false,
  solo: false,
  lowCut: false,
  hiZ: false,
  pre3: false,
  lr: true,
  sub12: false,
  sub34: false,
});
export function createDefault(): MixerState {
  return {
    channels: CHANNEL_LABELS.map((_, i) => makeChannel(i)),
    globals: {
      main: 0,
      sub12: 0,
      sub34: 0,
      fxReturn: -90,
      mon1: 0,
      mon2: 0,
      mon3: 0,
      fxMaster: 0,
      fxMon1: -90,
      fxMon2: -90,
      fxMon3: -90,
      blend: 0,
      cr: -10,
      phones: -10,
      sub12LR: false,
      sub34LR: false,
      fxSub12: false,
      fxSub34: false,
      phantom: false,
      break: false,
      fxMute: false,
      footMute: false,
      toPhones: false,
      usb34: false,
    },
    preset: 1,
    power: true,
    bootUntil: 0,
    pending: null,
    usb12Source: null,
    usb34Source: null,
  };
}
export const DEMO_NAMES = [
  "Kick",
  "Snare",
  "Bass",
  "Guitar",
  "Keys",
  "Vocal synth",
];
export function demoState(): MixerState {
  const state = createDefault();
  DEMO_NAMES.forEach((name, i) =>
    Object.assign(state.channels[i], {
      name,
      source: `demo:${i}`,
      fader: -6,
      pan: i === 3 ? -0.3 : i === 4 ? 0.3 : 0,
    }),
  );
  return state;
}

/** Reducer owns hardware configuration and FX confirmation deadlines, never audio nodes. */
export function mixerReducer(state: MixerState, action: Action): MixerState {
  if (action.type === "reset") return createDefault();
  if (action.type === "demo") return demoState();
  if (action.type === "load") return action.state;
  if (action.type === "power")
    return {
      ...state,
      power: !state.power,
      pending: null,
      bootUntil: !state.power ? action.now + 5000 : 0,
    };
  if (action.type === "tick")
    return state.pending && action.now >= state.pending.expires
      ? { ...state, pending: null }
      : state;
  if (!state.power) return state;
  if (action.type === "channel") {
    if (!state.channels[action.index]) return state;
    let value = action.value;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) return state;
      const [min, max] = channelRange(
        action.index,
        action.key as NumericChannelKey,
      );
      value = clamp(value, min, max);
    }
    return {
      ...state,
      channels: state.channels.map((channel, i) =>
        i === action.index ? { ...channel, [action.key]: value } : channel,
      ),
    };
  }
  if (action.type === "global")
    return {
      ...state,
      globals: {
        ...state.globals,
        [action.key]:
          typeof action.value === "number"
            ? clamp(
                action.value,
                action.key === "blend" ? -1 : -90,
                action.key === "blend" ? 1 : 10,
              )
            : action.value,
      },
    };
  if (action.type === "usb") return { ...state, [action.bus]: action.source };
  if (action.type === "presetTurn") {
    const current =
      state.pending && action.now < state.pending.expires
        ? state.pending.preset
        : state.preset;
    return {
      ...state,
      pending: {
        preset: ((((current - 1 + action.delta) % 24) + 24) % 24) + 1,
        expires: action.now + 10000,
      },
    };
  }
  if (action.type === "presetConfirm")
    return state.pending
      ? {
          ...state,
          preset:
            action.now < state.pending.expires
              ? state.pending.preset
              : state.preset,
          pending: null,
        }
      : state;
  return state;
}

export const STORAGE_KEY = "profx22v3-session-v1";
/** Restore only known fields with correct types and bounds; transient operations never resume. */
export function restoreSession(raw: string | null): MixerState {
  const base = createDefault();
  if (!raw) return base;
  try {
    const saved = JSON.parse(raw);
    if (
      saved.version !== 1 ||
      !Array.isArray(saved.state?.channels) ||
      saved.state.channels.length !== 18
    )
      return base;
    const incoming = saved.state;
    base.channels = base.channels.map((channel, index) => {
      const candidate = incoming.channels[index];
      if (!candidate || typeof candidate !== "object") return channel;
      for (const key of Object.keys(channel) as (keyof Channel)[]) {
        const value = candidate[key];
        if (
          typeof channel[key] === "number" &&
          typeof value === "number" &&
          Number.isFinite(value)
        ) {
          const [min, max] = channelRange(index, key as NumericChannelKey);
          (channel as unknown as Record<string, unknown>)[key] = clamp(
            value,
            min,
            max,
          );
        } else if (
          typeof channel[key] === "boolean" &&
          typeof value === "boolean"
        ) {
          (channel as unknown as Record<string, unknown>)[key] = value;
        }
      }
      if (typeof candidate.name === "string")
        channel.name = candidate.name.slice(0, 60);
      if (typeof candidate.source === "string")
        channel.source = candidate.source.slice(0, 250);
      if (["line", "mic", "condenser", "instrument"].includes(candidate.input))
        channel.input = candidate.input;
      return channel;
    });
    for (const key of Object.keys(base.globals) as (keyof Globals)[]) {
      const value = incoming.globals?.[key];
      if (typeof base.globals[key] === "boolean" && typeof value === "boolean")
        (base.globals as unknown as Record<string, unknown>)[key] = value;
      if (
        typeof base.globals[key] === "number" &&
        typeof value === "number" &&
        Number.isFinite(value)
      )
        (base.globals as unknown as Record<string, unknown>)[key] = clamp(
          value,
          key === "blend" ? -1 : -90,
          key === "blend" ? 1 : 10,
        );
    }
    base.preset = Number.isInteger(incoming.preset)
      ? clamp(incoming.preset, 1, 24)
      : 1;
    for (const bus of ["usb12Source", "usb34Source"] as const)
      if (typeof incoming[bus] === "string")
        base[bus] = incoming[bus].slice(0, 250);
    return base;
  } catch {
    return base;
  }
}
