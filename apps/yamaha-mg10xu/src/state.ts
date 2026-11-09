export const STORAGE_KEY = "mg10xu-session-v1";
export const CHANNELS = ["1", "2", "3", "4", "5/6", "7/8", "9/10"];
export const INPUTS = {
  ch1: { label: "CH 1 MIC/LINE", channel: 0 },
  ch2: { label: "CH 2 MIC/LINE", channel: 1 },
  ch3: { label: "CH 3 MIC/LINE", channel: 2 },
  ch4: { label: "CH 4 MIC/LINE", channel: 3 },
  phone56: { label: "CH 5/6 phone L/R", channel: 4 },
  rca56: { label: "CH 5/6 RCA L/R", channel: 4 },
  phone78: { label: "CH 7/8 phone L/R", channel: 5 },
  rca78: { label: "CH 7/8 RCA L/R", channel: 5 },
  line910: { label: "CH 9/10 LINE L/R", channel: 6 },
  usb910: { label: "CH 9/10 USB playback", channel: 6 },
} as const;
export type InputId = keyof typeof INPUTS;
export const SOURCES = {
  none: "Disconnected",
  voice: "Dynamic microphone",
  condenser: "Condenser microphone",
  music: "Stereo backing track",
  keys: "Stereo keyboard",
  tone: "1 kHz test tone",
  bass: "40 Hz rumble",
  file: "Local audio file",
} as const;
export type SourceKind = keyof typeof SOURCES;
export type Input = {
  kind: SourceKind;
  db: number;
  plug: "xlr" | "phone";
  mono: boolean;
  filename: string;
};
export const PROGRAMS = [
  ["REV HALL 1", "Reverb time"],
  ["REV HALL 2", "Reverb time"],
  ["REV ROOM 1", "Reverb time"],
  ["REV ROOM 2", "Reverb time"],
  ["REV STAGE 1", "Reverb time"],
  ["REV STAGE 2", "Reverb time"],
  ["REV PLATE", "Reverb time"],
  ["DRUM AMB", "Reverb time"],
  ["EARLY REF", "Room size"],
  ["GATE REV", "Room size"],
  ["SINGLE DLY", "Delay time"],
  ["DELAY", "Delay time"],
  ["VOCAL ECHO", "Delay time"],
  ["KARAOKE", "Delay time"],
  ["PHASER", "LFO frequency"],
  ["FLANGER", "LFO frequency"],
  ["CHORUS 1", "LFO frequency"],
  ["CHORUS 2", "LFO frequency"],
  ["SYMPHONIC", "LFO depth"],
  ["TREMOLO", "LFO frequency"],
  ["AUTO WAH", "LFO frequency"],
  ["RADIO VOICE", "Cutoff offset"],
  ["DISTORTION", "Drive"],
  ["PITCH CHANGE", "Pitch"],
] as const;
export const channelParams = {
  gain: { min: 20, max: 64, step: 1, initial: 20, color: "#e6e8e4" },
  comp: { min: 0, max: 10, step: 0.1, initial: 0, color: "#dfd568" },
  high: { min: -15, max: 15, step: 0.5, initial: 0, color: "#56bc7d" },
  mid: { min: -15, max: 15, step: 0.5, initial: 0, color: "#56bc7d" },
  low: { min: -15, max: 15, step: 0.5, initial: 0, color: "#56bc7d" },
  fx: { min: 0, max: 10, step: 0.1, initial: 0, color: "#e6e8e4" },
  pan: { min: -1, max: 1, step: 0.05, initial: 0, color: "#d85f52" },
  level: { min: 0, max: 10, step: 0.1, initial: 0, color: "#e6e8e4" },
} as const;
export type ChannelParam = keyof typeof channelParams;
export type Channel = Record<ChannelParam, number> & {
  pad: boolean;
  hpf: boolean;
};
export type Toggle =
  | "power"
  | "phantom"
  | "usb"
  | "toStereo"
  | "stereoMute"
  | "fxOn"
  | "footConnected"
  | "stereoConnected"
  | "monitorConnected"
  | "phonesConnected"
  | "fxConnected"
  | "usbConnected";
export type GlobalParam = "master" | "monitor" | "fxReturn" | "parameter";
export type MixerState = Record<Toggle, boolean> & {
  channels: Channel[];
  inputs: Record<InputId, Input>;
  master: number;
  monitor: number;
  fxReturn: number;
  parameter: number;
  parameters: number[];
  program: number;
  pending: number | null;
  previewUntil: number;
  footBypass: boolean;
  attenuator: number;
  editingAttenuator: boolean;
  presses: number;
  lastPress: number;
};
export type Action =
  | { type: "channel"; channel: number; param: ChannelParam; value: number }
  | { type: "channelToggle"; channel: number; param: "pad" | "hpf" }
  | { type: "toggle"; param: Toggle }
  | { type: "global"; param: GlobalParam; value: number }
  | { type: "input"; id: InputId; patch: Partial<Input> }
  | { type: "turn"; value: number; now: number; held?: boolean }
  | { type: "press"; now: number }
  | { type: "tick"; now: number }
  | { type: "foot" }
  | { type: "reset" }
  | { type: "demo" };
export const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
export const dbGain = (db: number) => 10 ** (db / 20);
// Nominal marker is 7.5; endpoints model silence and +10 dB, not an analog pot curve.
export const levelGain = (n: number) =>
  n <= 0 ? 0 : dbGain(n >= 7.5 ? (n - 7.5) * 4 : (n - 7.5) * 6);
export const fxActive = (s: MixerState) => s.power && s.fxOn && !s.footBypass;

export function createDefault(): MixerState {
  return {
    channels: CHANNELS.map(
      () =>
        ({
          ...Object.fromEntries(
            Object.entries(channelParams).map(([key, p]) => [key, p.initial]),
          ),
          pad: false,
          hpf: false,
        }) as Channel,
    ),
    inputs: Object.fromEntries(
      Object.keys(INPUTS).map((id) => [
        id,
        {
          kind: "none",
          db: 0,
          plug: id.startsWith("ch") ? "xlr" : "phone",
          mono: false,
          filename: "",
        },
      ]),
    ) as Record<InputId, Input>,
    power: false,
    phantom: false,
    usb: false,
    toStereo: true,
    stereoMute: false,
    fxOn: false,
    footConnected: false,
    stereoConnected: true,
    monitorConnected: true,
    phonesConnected: true,
    fxConnected: false,
    usbConnected: true,
    master: 0,
    monitor: 0,
    fxReturn: 0,
    parameter: 5,
    parameters: Array(24).fill(5),
    program: 1,
    pending: null,
    previewUntil: 0,
    footBypass: false,
    attenuator: 0,
    editingAttenuator: false,
    presses: 0,
    lastPress: -Infinity,
  };
}

/** Select connected inputs using the hardware's phone-over-RCA and LINE/USB priority. */
export function activeInputs(s: MixerState): InputId[] {
  return [
    "ch1",
    "ch2",
    "ch3",
    "ch4",
    s.inputs.phone56.kind !== "none" ? "phone56" : "rca56",
    s.inputs.phone78.kind !== "none" ? "phone78" : "rca78",
    s.usb ? "usb910" : "line910",
  ] as InputId[];
}

/** Pure control contract; timestamps make preview expiry and multi-press deterministic. */
export function mixerReducer(s: MixerState, a: Action): MixerState {
  if (a.type === "reset") return createDefault();
  if (a.type === "demo") {
    const d = createDefault();
    d.power = true;
    d.master = 7.5;
    d.monitor = 6;
    d.fxOn = true;
    d.fxReturn = 5;
    d.inputs.ch1.kind = "voice";
    d.inputs.phone56.kind = "keys";
    d.inputs.usb910.kind = "music";
    d.channels[0] = {
      ...d.channels[0],
      gain: 42,
      hpf: true,
      comp: 3,
      level: 7.5,
      fx: 5,
    };
    d.channels[4].level = 6;
    d.channels[6].level = 6;
    d.usb = true;
    return d;
  }
  if (a.type === "channel") {
    if (!s.channels[a.channel] || !Number.isFinite(a.value)) return s;
    if (
      (a.channel >= 4 && ["gain", "mid"].includes(a.param)) ||
      (a.channel >= 2 && a.param === "comp")
    )
      return s;
    const p = channelParams[a.param];
    return {
      ...s,
      channels: s.channels.map((c, i) =>
        i === a.channel ? { ...c, [a.param]: clamp(a.value, p.min, p.max) } : c,
      ),
    };
  }
  if (a.type === "channelToggle")
    return a.channel >= 0 && a.channel < 4
      ? {
          ...s,
          channels: s.channels.map((c, i) =>
            i === a.channel ? { ...c, [a.param]: !c[a.param] } : c,
          ),
        }
      : s;
  if (a.type === "toggle") {
    const next = { ...s, [a.param]: !s[a.param] };
    if (a.param === "power")
      return {
        ...next,
        pending: null,
        previewUntil: 0,
        editingAttenuator: false,
        presses: 0,
        footBypass: false,
      };
    if (a.param === "fxOn" || a.param === "footConnected")
      next.footBypass = false;
    return next;
  }
  if (a.type === "global") {
    if (!Number.isFinite(a.value)) return s;
    const value = clamp(a.value, 0, 10);
    return {
      ...s,
      [a.param]: value,
      ...(a.param === "parameter"
        ? {
            parameters: s.parameters.map((n, i) =>
              i === s.program - 1 ? value : n,
            ),
          }
        : {}),
    };
  }
  if (a.type === "input")
    return {
      ...s,
      inputs: { ...s.inputs, [a.id]: { ...s.inputs[a.id], ...a.patch } },
    };
  if (a.type === "foot")
    return s.power && s.fxOn && s.footConnected
      ? { ...s, footBypass: !s.footBypass }
      : s;
  if (!s.power) return s;
  if (a.type === "tick")
    return s.pending !== null && a.now >= s.previewUntil
      ? { ...s, pending: null }
      : s;
  if (a.type === "turn") {
    if (!Number.isFinite(a.value)) return s;
    if (s.editingAttenuator)
      return { ...s, attenuator: -clamp(Math.round(a.value), 0, 24) };
    const value = clamp(Math.round(a.value), 1, 24);
    return a.held
      ? { ...s, program: value, pending: null, presses: 0 }
      : {
          ...s,
          pending: value === s.program ? null : value,
          previewUntil: a.now + 5000,
          presses: 0,
        };
  }
  if (a.type === "press") {
    if (s.editingAttenuator)
      return { ...s, editingAttenuator: false, presses: 0 };
    const presses = a.now - s.lastPress < 1000 ? s.presses + 1 : 1;
    const program =
      s.pending !== null && a.now < s.previewUntil ? s.pending : s.program;
    return {
      ...s,
      program,
      pending: null,
      presses: presses === 5 ? 0 : presses,
      lastPress: a.now,
      editingAttenuator: presses === 5,
    };
  }
  return s;
}

/** Validate known fields through the same ranges as physical controls; transient state never restores. */
export function restoreSession(raw: string | null): MixerState {
  let s = createDefault();
  try {
    const data = JSON.parse(raw || "null");
    if (data?.version !== 1 || !data.settings) return s;
    const saved = data.settings;
    for (const param of [
      "phantom",
      "usb",
      "toStereo",
      "stereoMute",
      "fxOn",
      "footConnected",
      "stereoConnected",
      "monitorConnected",
      "phonesConnected",
      "fxConnected",
      "usbConnected",
    ] as Toggle[])
      if (typeof saved[param] === "boolean") s[param] = saved[param];
    for (let i = 0; i < 7; i++)
      for (const param of Object.keys(channelParams) as ChannelParam[])
        if (Number.isFinite(saved.channels?.[i]?.[param]))
          s = mixerReducer(s, {
            type: "channel",
            channel: i,
            param,
            value: saved.channels[i][param],
          });
    for (let i = 0; i < 4; i++)
      for (const param of ["pad", "hpf"] as const)
        s.channels[i][param] = saved.channels?.[i]?.[param] === true;
    for (const id of Object.keys(INPUTS) as InputId[]) {
      const v = saved.inputs?.[id];
      if (v && Object.hasOwn(SOURCES, v.kind))
        s.inputs[id] = {
          kind: v.kind,
          db: Number.isFinite(v.db) ? clamp(v.db, -36, 12) : 0,
          plug: v.plug === "xlr" ? "xlr" : "phone",
          mono: v.mono === true,
          filename: typeof v.filename === "string" ? v.filename : "",
        };
    }
    for (const param of ["master", "monitor", "fxReturn"] as const)
      if (Number.isFinite(saved[param]))
        s = mixerReducer(s, { type: "global", param, value: saved[param] });
    s.program = Number.isFinite(saved.program)
      ? clamp(Math.round(saved.program), 1, 24)
      : 1;
    s.parameters = Array.from({ length: 24 }, (_, i) =>
      Number.isFinite(saved.parameters?.[i])
        ? clamp(saved.parameters[i], 0, 10)
        : 5,
    );
    s.parameter = Number.isFinite(saved.parameter)
      ? clamp(saved.parameter, 0, 10)
      : 5;
    s.attenuator = Number.isFinite(saved.attenuator)
      ? clamp(saved.attenuator, -24, 0)
      : 0;
  } catch {
    /* A corrupt saved session falls back to the safe, powered-off desk. */
  }
  return s;
}
