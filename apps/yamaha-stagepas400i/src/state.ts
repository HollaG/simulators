export const STORAGE_KEY = "stagepas400i-session-v1";
export const CHANNELS = ["1", "2", "3", "4", "5/6", "7/8"] as const;
export const INPUTS = {
  ch1: { label: "CH 1 · XLR", channel: 0 },
  ch2: { label: "CH 2 · XLR", channel: 1 },
  ch3: { label: "CH 3 · combo", channel: 2 },
  ch4: { label: "CH 4 · combo", channel: 3 },
  phone56: { label: "CH 5/6 · phone L/R", channel: 4 },
  rca56: { label: "CH 5/6 · RCA L/R", channel: 4 },
  phone78: { label: "CH 7/8 · phone L/R", channel: 5 },
  mini78: { label: "CH 7/8 · stereo mini", channel: 5 },
  usb78: { label: "CH 7/8 · iPod/iPhone USB", channel: 5 },
} as const;
export type InputId = keyof typeof INPUTS;
export const SOURCE_LABELS = {
  none: "Disconnected",
  voice: "Dynamic microphone",
  condenser: "Condenser microphone",
  guitar: "Passive guitar",
  keyboard: "Stereo keyboard",
  music: "Stereo backing track",
  tone: "1 kHz test tone",
  bass: "80 Hz test tone",
  feedback: "Feedback test · 1.1 kHz",
  file: "Local audio file",
} as const;
export type SourceKind = keyof typeof SOURCE_LABELS;
export type Input = {
  kind: SourceKind;
  volume: number;
  plug: "xlr" | "phone";
  filename?: string;
};
export type Channel = {
  level: number;
  high: number;
  low: number;
  reverb: number;
  mic: boolean;
  mono: boolean;
};
export type MixerState = {
  channels: Channel[];
  inputs: Record<InputId, Input>;
  power: boolean;
  ac: boolean;
  phantom: boolean;
  hiZ: boolean;
  reverbOn: boolean;
  reverbTypeTime: number;
  feedback: boolean;
  master: number;
  masterEQ: number;
  monitor: number;
  speakerL: boolean;
  speakerR: boolean;
  monitorL: boolean;
  monitorR: boolean;
  sub: boolean;
  footswitch: boolean;
};
export type ChannelParam = "level" | "low" | "high" | "reverb";
export type GlobalParam = "master" | "masterEQ" | "monitor" | "reverbTypeTime";
export type Toggle =
  | "power"
  | "ac"
  | "phantom"
  | "hiZ"
  | "reverbOn"
  | "feedback"
  | "speakerL"
  | "speakerR"
  | "monitorL"
  | "monitorR"
  | "sub"
  | "footswitch";
export type Action =
  | { type: "channel"; channel: number; param: ChannelParam; value: number }
  | { type: "switch"; channel: number; param: "mic" | "mono" }
  | { type: "global"; param: GlobalParam; value: number }
  | { type: "toggle"; param: Toggle }
  | { type: "input"; id: InputId; input: Partial<Input> }
  | { type: "foot" }
  | { type: "demo" }
  | { type: "reset" };

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
export const powered = (state: MixerState) => state.power && state.ac;
// The analog taper is unpublished. Seven is a practice unity point, zero is mute.
export const levelGain = (level: number) => (level / 7) ** 2;
export const dbGain = (db: number) => 10 ** (db / 20);
export const toDb = (amplitude: number) =>
  amplitude > 0.000001 ? 20 * Math.log10(amplitude) : -120;

export function createDefault(): MixerState {
  return {
    channels: CHANNELS.map(() => ({
      level: 0,
      high: 0,
      low: 0,
      reverb: 0,
      mic: false,
      mono: false,
    })),
    inputs: Object.fromEntries(
      Object.keys(INPUTS).map((id) => [
        id,
        { kind: "none", volume: 0, plug: "xlr" },
      ]),
    ) as Record<InputId, Input>,
    power: false,
    ac: true,
    phantom: false,
    hiZ: false,
    reverbOn: false,
    reverbTypeTime: 0,
    feedback: false,
    master: 0,
    masterEQ: 0,
    monitor: 0,
    speakerL: true,
    speakerR: true,
    monitorL: false,
    monitorR: false,
    sub: false,
    footswitch: false,
  };
}

/** Jack insertion, not audio amplitude, decides analog priority. USB is additive. */
export function activeInputs(state: MixerState, channel: number): InputId[] {
  const connected = (id: InputId) => state.inputs[id].kind !== "none";
  if (channel < 4)
    return (["ch1", "ch2", "ch3", "ch4"] as InputId[])
      .slice(channel, channel + 1)
      .filter(connected);
  if (channel === 4)
    return (connected("phone56") ? ["phone56"] : ["rca56"]).filter((id) =>
      connected(id as InputId),
    ) as InputId[];
  return (
    [connected("mini78") ? "mini78" : "phone78", "usb78"] as InputId[]
  ).filter(connected);
}

export function inputGain(state: MixerState, id: InputId): number {
  const input = state.inputs[id];
  const channel = INPUTS[id].channel;
  if (!powered(state) || !activeInputs(state, channel).includes(id)) return 0;
  if (input.kind === "condenser" && (channel > 1 || !state.phantom)) return 0;
  return dbGain(
    input.volume + (channel < 4 && state.channels[channel].mic ? 26 : 0),
  );
}

export function reverbProgram(value: number) {
  const position = clamp(value, 0, 99.99) / 25;
  const index = Math.floor(position);
  return {
    name: ["HALL", "PLATE", "ROOM", "ECHO"][index],
    index,
    amount: position - index,
  };
}

/** Physical positions remain when power is removed; the momentary reverb resets. */
export function mixerReducer(state: MixerState, action: Action): MixerState {
  switch (action.type) {
    case "channel": {
      if (!Number.isFinite(action.value) || !state.channels[action.channel])
        return state;
      if (action.param === "reverb" && action.channel > 3) return state;
      const eq = action.param === "low" || action.param === "high";
      return {
        ...state,
        channels: state.channels.map((channel, i) =>
          i === action.channel
            ? {
                ...channel,
                [action.param]: clamp(action.value, eq ? -15 : 0, eq ? 15 : 10),
              }
            : channel,
        ),
      };
    }
    case "switch":
      if (
        !state.channels[action.channel] ||
        (action.param === "mic" ? action.channel > 3 : action.channel < 4)
      )
        return state;
      return {
        ...state,
        channels: state.channels.map((channel, i) =>
          i === action.channel
            ? { ...channel, [action.param]: !channel[action.param] }
            : channel,
        ),
      };
    case "global":
      if (!Number.isFinite(action.value)) return state;
      return {
        ...state,
        [action.param]: clamp(
          action.value,
          action.param === "masterEQ" ? -1 : 0,
          action.param === "reverbTypeTime"
            ? 100
            : action.param === "masterEQ"
              ? 1
              : 10,
        ),
      };
    case "toggle": {
      if (action.param === "reverbOn" && !powered(state)) return state;
      const next = { ...state, [action.param]: !state[action.param] };
      if (action.param === "power" || (action.param === "ac" && !next.ac))
        next.reverbOn = false;
      return next;
    }
    case "input": {
      const input = { ...state.inputs[action.id], ...action.input };
      if (
        !Object.hasOwn(SOURCE_LABELS, input.kind) ||
        !Number.isFinite(input.volume)
      )
        return state;
      input.volume = clamp(input.volume, -24, 6);
      if (input.kind !== "file") delete input.filename;
      return { ...state, inputs: { ...state.inputs, [action.id]: input } };
    }
    case "foot":
      return powered(state) && state.footswitch
        ? { ...state, reverbOn: !state.reverbOn }
        : state;
    case "demo": {
      const next = createDefault();
      next.power = true;
      next.master = 7;
      next.monitor = 7;
      next.monitorL = next.monitorR = true;
      next.hiZ = true;
      next.inputs.ch1.kind = "voice";
      next.inputs.ch4 = { kind: "guitar", plug: "phone", volume: 0 };
      next.inputs.phone56.kind = "keyboard";
      next.inputs.usb78.kind = "music";
      for (const [i, channel] of next.channels.entries()) {
        channel.level = [6, 0, 0, 4.5, 4, 4][i];
        channel.mic = i === 0;
      }
      return next;
    }
    case "reset":
      return createDefault();
  }
}

/** Restore known fields only. Missing imported files stay connected and silent. */
export function restoreSession(raw: string | null): MixerState {
  const initial = createDefault();
  try {
    const saved = JSON.parse(raw || "null");
    if (saved?.version !== 1 || !saved.state || typeof saved.state !== "object")
      return initial;
    const source = saved.state;
    let state = initial;
    for (const param of [
      "master",
      "masterEQ",
      "monitor",
      "reverbTypeTime",
    ] as GlobalParam[]) {
      if (typeof source[param] === "number")
        state = mixerReducer(state, {
          type: "global",
          param,
          value: source[param],
        });
    }
    for (const param of [
      "ac",
      "phantom",
      "hiZ",
      "feedback",
      "speakerL",
      "speakerR",
      "monitorL",
      "monitorR",
      "sub",
      "footswitch",
    ] as Toggle[]) {
      if (typeof source[param] === "boolean")
        state = { ...state, [param]: source[param] };
    }
    for (let i = 0; i < 6; i++) {
      const channel = Array.isArray(source.channels)
        ? source.channels[i]
        : null;
      for (const param of [
        "level",
        "low",
        "high",
        "reverb",
      ] as ChannelParam[]) {
        if (typeof channel?.[param] === "number")
          state = mixerReducer(state, {
            type: "channel",
            channel: i,
            param,
            value: channel[param],
          });
      }
      for (const param of ["mic", "mono"] as const) {
        if (
          typeof channel?.[param] === "boolean" &&
          channel[param] !== state.channels[i][param]
        )
          state = mixerReducer(state, { type: "switch", channel: i, param });
      }
    }
    for (const id of Object.keys(INPUTS) as InputId[]) {
      const input = source.inputs?.[id];
      if (
        !input ||
        !Object.hasOwn(SOURCE_LABELS, input.kind) ||
        typeof input.volume !== "number"
      )
        continue;
      state = mixerReducer(state, {
        type: "input",
        id,
        input: {
          kind: input.kind,
          volume: input.volume,
          plug: input.plug === "phone" ? "phone" : "xlr",
          ...(typeof input.filename === "string"
            ? { filename: input.filename.slice(0, 180) }
            : {}),
        },
      });
    }
    return state;
  } catch {
    return initial;
  }
}
