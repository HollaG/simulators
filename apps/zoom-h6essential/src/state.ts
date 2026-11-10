export const TRACKS = ["MIC", "1", "2", "3", "4"] as const;
export const MAX_SECONDS = 60;
export const STORAGE_KEY = "h6essential-settings-v1";
export type Source = "demo" | "condenser" | "off";
export type Input = {
  armed: boolean;
  gain: number;
  lowCut: number;
  phantom: boolean;
  source: Source;
};
export type Config = {
  inputs: Input[];
  links: boolean[];
  mono: boolean;
  rate: number;
  post: boolean;
  volume: number;
};
export type Take = {
  id: number;
  name: string;
  duration: number;
  startedAt: number;
  config: Config;
  events: { time: number; gains: number[] }[];
  marks: number[];
  trashed: boolean;
};
export type Screen =
  | "home"
  | "playback"
  | "mixer"
  | "input"
  | "rec"
  | "files"
  | "fileActions"
  | "trash"
  | "unavailable";
export type State = {
  power: boolean;
  hold: boolean;
  config: Config;
  screen: Screen;
  mode: "idle" | "recording" | "saving" | "playing" | "paused";
  cursor: number;
  input: number;
  inside: boolean;
  editing: boolean;
  choice: number;
  takes: Take[];
  selected: number;
  playEnabled: boolean[];
  playGains: number[];
  position: number;
  since: number;
  draft: Take | null;
  pending: Take | null;
  nextId: number;
  message: string;
  returnScreen: Screen;
};
export type Action =
  | {
      type:
        "POWER" | "HOLD" | "REC" | "STOP" | "PLAY" | "MIXER" | "ENTER" | "TICK";
      now: number;
    }
  | { type: "DIAL" | "SKIP" | "SEEK"; value: number; now: number }
  | { type: "TRACK"; index: number; now: number }
  | { type: "SOURCE"; index: number; source: Source; now: number }
  | { type: "VOLUME"; value: number; now: number }
  | { type: "SAVED"; id: number }
  | { type: "ERROR"; message: string; id?: number };

export const defaults = (): Config => ({
  inputs: TRACKS.map((_, i) => ({
    armed: i === 0,
    gain: 0,
    lowCut: 0,
    phantom: false,
    source: "demo",
  })),
  links: [false, false],
  mono: false,
  rate: 48000,
  post: false,
  volume: 25,
});
export const initialState = (config = defaults()): State => ({
  power: false,
  hold: false,
  config,
  screen: "home",
  mode: "idle",
  cursor: 0,
  input: 0,
  inside: false,
  editing: false,
  choice: 0,
  takes: [],
  selected: -1,
  playEnabled: Array(5).fill(true),
  playGains: Array(5).fill(0),
  position: 0,
  since: 0,
  draft: null,
  pending: null,
  nextId: 1,
  message: "Power on to begin.",
  returnScreen: "home",
});
export const clamp = (x: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, x));
export const dbGain = (db: number) => (db <= -81 ? 0 : Math.pow(10, db / 20));
export const gainLabel = (gain: number) =>
  gain <= -81 ? "Mute" : `${gain > 0 ? "+" : ""}${gain} dB`;
export const isPlayback = (s: State) =>
  s.mode === "playing" || s.mode === "paused";
export const currentTake = (s: State) =>
  s.takes.find((t) => t.id === s.selected && !t.trashed);
export const mixerGain = (s: State, i: number) =>
  isPlayback(s) ? s.playGains[i] : s.config.inputs[i].gain;
export const enabled = (s: State, i: number) =>
  isPlayback(s)
    ? !!currentTake(s)?.config.inputs[i].armed && s.playEnabled[i]
    : s.config.inputs[i].armed;
export const elapsed = (s: State, now: number) =>
  s.mode === "recording"
    ? clamp((now - s.draft!.startedAt) / 1000, 0, MAX_SECONDS)
    : clamp(
        s.position + (s.mode === "playing" ? (now - s.since) / 1000 : 0),
        0,
        currentTake(s)?.duration || 0,
      );
export function formatTime(seconds: number) {
  const n = Math.floor(seconds);
  return [Math.floor(n / 3600), Math.floor(n / 60) % 60, n % 60]
    .map((v) => String(v).padStart(2, "0"))
    .join(":");
}
export const homeItems = (s: State) =>
  s.mode === "recording"
    ? ["Mark", "Output", "Trash"]
    : isPlayback(s)
      ? ["File List", "A–B Repeat", "Output", "Export", "Trash"]
      : [
          "File List",
          "Input",
          "Output",
          "Rec Settings",
          "SD Card",
          "USB",
          "System",
        ];

type Setting = {
  id: "lowCut" | "phantom" | "mono" | "link" | "rate" | "post";
  label: string;
  options: (string | number)[];
  index: number;
};
export function settings(s: State): Setting[] {
  if (s.screen === "rec")
    return [
      {
        id: "rate",
        label: "Sample Rate",
        options: ["44.1 kHz", "48 kHz", "96 kHz"],
        index: [44100, 48000, 96000].indexOf(s.config.rate),
      },
      {
        id: "post",
        label: "Rec Source",
        options: ["Pre Mixer", "Post Mixer"],
        index: +s.config.post,
      },
    ];
  const input = s.config.inputs[s.input];
  return [
    {
      id: "lowCut",
      label: "Lo Cut",
      options: ["Off", "80 Hz", "160 Hz", "240 Hz"],
      index: [0, 80, 160, 240].indexOf(input.lowCut),
    },
    ...(s.input === 0
      ? [
          {
            id: "mono" as const,
            label: "Mono Mix",
            options: ["Off", "On"],
            index: +s.config.mono,
          },
        ]
      : [
          {
            id: "phantom" as const,
            label: "Phantom",
            options: ["Off", "On"],
            index: +input.phantom,
          },
          {
            id: "link" as const,
            label: s.input < 3 ? "1&2 Link" : "3&4 Link",
            options: ["Off", "Stereo"],
            index: +s.config.links[s.input < 3 ? 0 : 1],
          },
        ]),
  ];
}

function open(s: State, screen: Screen): State {
  return {
    ...s,
    screen,
    cursor: 0,
    editing: false,
    inside: false,
    message: "",
  };
}
function finish(s: State, now: number, trashed = false): State {
  if (!s.draft) return s;
  return {
    ...open(s, "home"),
    mode: "saving",
    pending: { ...s.draft, duration: Math.max(0.05, elapsed(s, now)), trashed },
    draft: null,
    message: "Saving practice take…",
  };
}
function playTake(s: State, take: Take, now: number, playing: boolean): State {
  return {
    ...open(s, "playback"),
    selected: take.id,
    position: 0,
    since: now,
    mode: playing ? "playing" : "paused",
    playEnabled: take.config.inputs.map((i) => i.armed),
    playGains: Array(5).fill(0),
  };
}
function changeSetting(s: State, entry: Setting): State {
  const config = structuredClone(s.config);
  switch (entry.id) {
    case "rate":
      config.rate = [44100, 48000, 96000][s.choice];
      break;
    case "post":
      config.post = !!s.choice;
      break;
    case "lowCut":
      config.inputs[s.input].lowCut = [0, 80, 160, 240][s.choice];
      break;
    case "phantom":
      config.inputs[s.input].phantom = !!s.choice;
      break;
    case "mono":
      config.mono = !!s.choice;
      break;
    case "link": {
      const pair = s.input < 3 ? 0 : 1;
      config.links[pair] = !!s.choice;
      if (s.choice) {
        const first = pair * 2 + 1;
        config.inputs[first + 1].armed = config.inputs[first].armed;
        config.inputs[first + 1].gain = config.inputs[first].gain;
      }
    }
  }
  return { ...s, config, editing: false };
}

/** All device inputs pass through power/HOLD/busy checks before mode handling.
 * Time comes from the caller, so recording and seeking remain testable without timers.
 */
export function reducer(s: State, a: Action): State {
  if (a.type === "SAVED") {
    if (s.pending?.id !== a.id) return s;
    return {
      ...s,
      takes: [...s.takes, s.pending],
      selected: s.pending.id,
      pending: null,
      mode: "idle",
      message: "Take saved for this session. Press PLAY to listen.",
    };
  }
  if (a.type === "ERROR")
    return a.id !== undefined && s.pending?.id !== a.id
      ? s
      : {
          ...s,
          mode: s.mode === "saving" ? "idle" : s.mode,
          pending: null,
          message: a.message,
        };
  if (a.type === "TICK") {
    if (s.mode === "recording" && elapsed(s, a.now) >= MAX_SECONDS)
      return finish(s, a.now);
    if (
      s.mode === "playing" &&
      elapsed(s, a.now) >= (currentTake(s)?.duration || 0)
    )
      return {
        ...s,
        mode: "paused",
        position: currentTake(s)?.duration || 0,
        since: a.now,
      };
    return s;
  }
  if (a.type === "HOLD")
    return s.power
      ? {
          ...s,
          hold: !s.hold,
          message: s.hold ? "Controls unlocked." : "HOLD — controls locked.",
        }
      : s;
  if (a.type === "POWER") {
    if (s.hold) return s;
    if (s.mode === "recording" || s.mode === "saving")
      return {
        ...s,
        message: "Stop recording and finish saving before switching off.",
      };
    return {
      ...open(s, "home"),
      power: !s.power,
      mode: "idle",
      position: 0,
      message: s.power
        ? "Powered off."
        : "Ready. Arm your tracks and press REC.",
    };
  }
  if (!s.power || s.hold || s.mode === "saving") return s;
  if (a.type === "VOLUME")
    return { ...s, config: { ...s.config, volume: clamp(a.value, 0, 100) } };
  if (a.type === "SOURCE") {
    if (s.mode !== "idle") return s;
    const inputs = s.config.inputs.map((v, i) =>
      i === a.index ? { ...v, source: a.source } : v,
    );
    return { ...s, config: { ...s.config, inputs } };
  }
  if (a.type === "TRACK") {
    if (s.mode === "recording")
      return {
        ...s,
        message: "Practice rule: track selection is fixed during a take.",
      };
    const indices = [a.index];
    const config = isPlayback(s) ? currentTake(s)!.config : s.config;
    if (a.index > 0 && config.links[a.index < 3 ? 0 : 1])
      indices.push(a.index % 2 ? a.index + 1 : a.index - 1);
    if (isPlayback(s))
      return {
        ...s,
        playEnabled: s.playEnabled.map((v, i) =>
          indices.includes(i) ? !s.playEnabled[a.index] : v,
        ),
      };
    return {
      ...s,
      config: {
        ...s.config,
        inputs: s.config.inputs.map((v, i) =>
          indices.includes(i)
            ? { ...v, armed: !s.config.inputs[a.index].armed }
            : v,
        ),
      },
    };
  }
  if (a.type === "REC") {
    if (s.mode === "recording") return finish(s, a.now);
    if (isPlayback(s) || !["home", "mixer"].includes(s.screen))
      return { ...s, message: "Press STOP to return home before recording." };
    if (!s.config.inputs.some((i) => i.armed))
      return { ...s, message: "Arm at least one track." };
    if (s.takes.length >= 8)
      return {
        ...s,
        message:
          "Eight-take practice limit. Download your takes, then reset the session.",
      };
    const draft: Take = {
      id: s.nextId,
      name: `TAKE_${String(s.nextId).padStart(3, "0")}`,
      startedAt: a.now,
      duration: 0,
      config: structuredClone(s.config),
      events: [{ time: 0, gains: s.config.inputs.map((i) => i.gain) }],
      marks: [],
      trashed: false,
    };
    return {
      ...s,
      mode: "recording",
      cursor: 0,
      editing: false,
      draft,
      nextId: s.nextId + 1,
      message: "Recording — 60-second practice take.",
    };
  }
  if (a.type === "STOP") {
    if (s.mode === "recording") return finish(s, a.now);
    return { ...open(s, "home"), mode: "idle", position: 0 };
  }
  if (a.type === "PLAY") {
    if (s.mode === "recording") return s;
    if (isPlayback(s))
      return {
        ...s,
        mode: s.mode === "playing" ? "paused" : "playing",
        position:
          elapsed(s, a.now) >= (currentTake(s)?.duration || 0)
            ? 0
            : elapsed(s, a.now),
        since: a.now,
      };
    const take = s.takes.filter((t) => !t.trashed).at(-1);
    return take
      ? playTake(s, take, a.now, true)
      : { ...s, message: "No recorded files. Record a take first." };
  }
  if (a.type === "MIXER") {
    if (!["home", "playback", "mixer"].includes(s.screen)) return s;
    return open(
      s,
      s.screen === "mixer" ? (isPlayback(s) ? "playback" : "home") : "mixer",
    );
  }
  if (a.type === "SEEK" && isPlayback(s))
    return {
      ...s,
      position: clamp(elapsed(s, a.now) + a.value, 0, currentTake(s)!.duration),
      since: a.now,
    };
  if (a.type === "SKIP" && isPlayback(s)) {
    const take = currentTake(s)!;
    const pos = elapsed(s, a.now);
    const mark =
      a.value > 0
        ? take.marks.find((m) => m > pos + 0.15)
        : [...take.marks].reverse().find((m) => m < pos - 0.5);
    if (mark !== undefined || (a.value < 0 && pos > 0.5))
      return { ...s, position: mark ?? 0, since: a.now };
    const takes = s.takes.filter((t) => !t.trashed);
    const next = takes[takes.indexOf(take) + Math.sign(a.value)];
    return next
      ? playTake(s, next, a.now, s.mode === "playing")
      : { ...s, position: a.value > 0 ? take.duration : 0, since: a.now };
  }
  if (a.type === "DIAL") {
    const step = Math.sign(a.value);
    if (s.screen === "mixer" && s.editing) {
      if (isPlayback(s)) {
        const playGains = [...s.playGains];
        playGains[s.cursor] = clamp(playGains[s.cursor] + step, -81, 40);
        if (s.cursor > 0 && currentTake(s)!.config.links[s.cursor < 3 ? 0 : 1])
          playGains[s.cursor % 2 ? s.cursor + 1 : s.cursor - 1] =
            playGains[s.cursor];
        return { ...s, playGains };
      }
      const inputs = s.config.inputs.map((i) => ({ ...i }));
      inputs[s.cursor].gain = clamp(inputs[s.cursor].gain + step, -81, 40);
      const links = isPlayback(s)
        ? currentTake(s)!.config.links
        : s.config.links;
      if (s.cursor > 0 && links[s.cursor < 3 ? 0 : 1])
        inputs[s.cursor % 2 ? s.cursor + 1 : s.cursor - 1].gain =
          inputs[s.cursor].gain;
      return {
        ...s,
        config: { ...s.config, inputs },
        draft: s.draft
          ? {
              ...s.draft,
              events: [
                ...s.draft.events,
                { time: elapsed(s, a.now), gains: inputs.map((i) => i.gain) },
              ],
            }
          : null,
      };
    }
    if (s.editing)
      return {
        ...s,
        choice: clamp(
          s.choice + step,
          0,
          settings(s)[s.cursor].options.length - 1,
        ),
      };
    const count =
      s.screen === "mixer"
        ? 5
        : s.screen === "input"
          ? s.inside
            ? settings(s).length + 1
            : 6
          : s.screen === "rec"
            ? settings(s).length + 1
            : s.screen === "files"
              ? s.takes.filter((t) => !t.trashed).length + 1
              : s.screen === "fileActions"
                ? 3
                : s.screen === "trash"
                  ? 2
                  : homeItems(s).length;
    return { ...s, cursor: clamp(s.cursor + step, 0, count - 1) };
  }
  if (a.type !== "ENTER") return s;
  if (s.screen === "mixer") return { ...s, editing: !s.editing };
  if (s.screen === "unavailable")
    return open(s, isPlayback(s) ? "playback" : "home");
  if (s.screen === "input" && !s.inside)
    return s.cursor === 5
      ? open(s, "home")
      : { ...s, input: s.cursor, cursor: 0, inside: true };
  if (s.screen === "input" || s.screen === "rec") {
    const entry = settings(s)[s.cursor];
    if (!entry)
      return s.screen === "input"
        ? { ...s, inside: false, cursor: s.input }
        : open(s, "home");
    return s.editing
      ? changeSetting(s, entry)
      : { ...s, editing: true, choice: entry.index };
  }
  if (s.screen === "files") {
    const take = s.takes.filter((t) => !t.trashed)[s.cursor];
    return take
      ? {
          ...open(s, "fileActions"),
          selected: take.id,
          mode: "paused",
          position: 0,
          since: a.now,
          playEnabled: take.config.inputs.map((i) => i.armed),
        }
      : { ...open(s, "home"), mode: "idle" };
  }
  if (s.screen === "fileActions") {
    if (s.cursor === 0) return playTake(s, currentTake(s)!, a.now, false);
    if (s.cursor === 2) return open(s, "files");
    return { ...open(s, "trash"), returnScreen: "fileActions" };
  }
  if (s.screen === "trash") {
    if (s.cursor === 0) return open(s, s.returnScreen);
    if (s.mode === "recording") return finish(s, a.now, true);
    return {
      ...open(s, "home"),
      mode: "idle",
      position: 0,
      takes: s.takes.map((t) =>
        t.id === s.selected ? { ...t, trashed: true } : t,
      ),
      selected: -1,
      message: "Take moved to TRASH.",
    };
  }
  const item = homeItems(s)[s.cursor];
  if (item === "Mark" && s.draft)
    return s.draft.marks.length >= 99
      ? { ...s, message: "99-mark limit reached." }
      : {
          ...s,
          draft: { ...s.draft, marks: [...s.draft.marks, elapsed(s, a.now)] },
          message: `Mark ${s.draft.marks.length + 1} added.`,
        };
  if (item === "Trash") return { ...open(s, "trash"), returnScreen: s.screen };
  if (item === "File List")
    return {
      ...open(s, "files"),
      position: elapsed(s, a.now),
      mode: isPlayback(s) ? "paused" : "idle",
    };
  if (item === "Input") return open(s, "input");
  if (item === "Rec Settings") return open(s, "rec");
  return {
    ...open(s, "unavailable"),
    message: `${item} is outside this practice version.${item === "Export" ? " Use the download controls beside the panel." : ""}`,
  };
}

/** Restore only known settings. Transient operations and in-memory takes never survive reload. */
export function loadConfig(raw: string | null): Config {
  const fallback = defaults();
  try {
    const data = JSON.parse(raw || "null");
    if (data?.version !== 1) return fallback;
    const c = data.config as Config;
    if (
      !Array.isArray(c.inputs) ||
      c.inputs.length !== 5 ||
      !Array.isArray(c.links) ||
      c.links.length !== 2 ||
      !c.links.every((v) => typeof v === "boolean") ||
      typeof c.mono !== "boolean" ||
      typeof c.post !== "boolean" ||
      ![44100, 48000, 96000].includes(c.rate) ||
      !Number.isFinite(c.volume) ||
      c.volume < 0 ||
      c.volume > 100 ||
      c.inputs.some(
        (i) =>
          !i ||
          typeof i.armed !== "boolean" ||
          typeof i.phantom !== "boolean" ||
          !Number.isInteger(i.gain) ||
          i.gain < -81 ||
          i.gain > 40 ||
          ![0, 80, 160, 240].includes(i.lowCut) ||
          !["demo", "condenser", "off"].includes(i.source),
      )
    )
      return fallback;
    return c;
  } catch {
    return fallback;
  }
}
