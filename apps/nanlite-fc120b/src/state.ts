export const STORAGE_KEY = "fc120b-session-v1";
export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const wrap = (n: number, size: number) => ((n % size) + size) % size;

export type ParamId = "dim" | "dimLow" | "cct" | "cctLow" | "cctHigh" | "speed" | "interval" | "intervalLow" | "intervalHigh" | "ratio" | "pulses" | "shift" | "intensity" | "decay" | "pause";
type Param = { id: ParamId; label: string; min: number; max: number; step: number; initial: number; unit?: string };
const p = (id: ParamId, label: string, min: number, max: number, step: number, initial: number, unit = ""): Param => ({ id, label, min, max, step, initial, unit });
const dim = p("dim", "DIM", 0, 100, 1, 100, "%");
const dimLow = p("dimLow", "DIM MIN", 0, 100, 1, 0, "%");
const cct = p("cct", "CCT", 2700, 6500, 100, 5600, "K");
const speed = p("speed", "SPEED", 1, 100, 1, 50);
const seconds = p("speed", "SPEED", 2, 30, 1, 8, "s");
const decay = p("decay", "DECAY", 1, 100, 1, 50);
export const effects: { name: string; page: number; params: Param[]; manual?: boolean }[] = [
  { name: "CCT LOOP", page: 21, params: [dim, p("cctLow", "CCT MIN", 2700, 6500, 100, 3200, "K"), p("cctHigh", "CCT MAX", 2700, 6500, 100, 5600, "K"), seconds] },
  { name: "INT LOOP", page: 22, params: [dimLow, dim, cct, seconds] },
  { name: "FLASH", page: 23, params: [dim, cct, p("interval", "INTERVALS", 0.1, 10, 0.1, 1, "s"), p("ratio", "FLASH RATIO", 0, 100, 1, 50, "%")] },
  { name: "PULSE", page: 24, params: [dim, cct, p("pulses", "PULSES/MIN", 1, 240, 1, 40)] },
  { name: "STORM AUTO", page: 25, params: [dim, cct, p("intervalLow", "INTVL MIN", 1, 60, 1, 1, "s"), p("intervalHigh", "INTVL MAX", 1, 60, 1, 60, "s")] },
  { name: "STORM MANUAL", page: 26, params: [dim, cct], manual: true },
  { name: "TV", page: 27, params: [dimLow, dim, cct, speed, p("shift", "CCT SHIFT", 0, 3000, 100, 0, "K")] },
  { name: "PAPARAZZI", page: 28, params: [dim, cct, speed] },
  { name: "CANDLE/FIRE", page: 29, params: [dimLow, dim, cct, speed] },
  { name: "BAD BULB", page: 30, params: [dim, cct, p("intensity", "INTENSITY", 1, 100, 1, 50), speed] },
  { name: "FIREWORK", page: 31, params: [dim, cct, speed, decay] },
  { name: "EXPLOSION AUTO", page: 32, params: [dim, cct, speed, decay] },
  { name: "EXPLOSION MANUAL", page: 33, params: [dim, cct, decay], manual: true },
  { name: "WELDING", page: 35, params: [dimLow, dim, cct, speed, p("pause", "PAUSE", 0, 1, 1, 0)] },
];

type Setting = { label: string; min: number; max: number; initial: number; options?: string[]; page: number; remote?: boolean };
export const settings = {
  output: { label: "OUTPUT MODE", options: ["MAX OUTPUT", "CONSTANT OUTPUT"], min: 0, max: 1, initial: 0, page: 37 },
  address: { label: "ADDRESS", min: 1, max: 512, initial: 1, page: 8, remote: true },
  dmxMode: { label: "DMX MODE", options: ["CCT 8bit", "ULTIMATE DMX 8bit"], min: 0, max: 1, initial: 0, page: 9, remote: true },
  reduced: { label: "DMX REDUCED CHANNELS", options: ["OFF", "ON"], min: 0, max: 1, initial: 0, page: 10, remote: true },
  curve: { label: "DMX DIMMING CURVE", options: ["LINEAR", "EXPONENT", "LOGARITHM", "S CURVE", "GAMMA 2.2"], min: 0, max: 4, initial: 0, page: 11, remote: true },
  smoothing: { label: "DMX SMOOTHING", options: ["OFF", "ON"], min: 0, max: 1, initial: 0, page: 12, remote: true },
  protocol: { label: "WIRELESS PROTOCOL", options: ["V1.0", "V2.0"], min: 0, max: 1, initial: 0, page: 17, remote: true },
  fan: { label: "FAN CONTROL", options: ["SMART", "FULL SPEED", "LOW SPEED", "OFF"], min: 0, max: 3, initial: 0, page: 38 },
  rotate: { label: "ROTATE SCREEN", options: ["NO", "YES"], min: 0, max: 1, initial: 0, page: 39 },
  screen: { label: "SCREEN BRIGHTNESS", min: 1, max: 5, initial: 3, page: 40 },
  language: { label: "LANGUAGE", options: ["ENGLISH", "简体中文"], min: 0, max: 1, initial: 0, page: 41 },
} satisfies Record<string, Setting>;
export type SettingId = keyof typeof settings;
export const setting = (id: SettingId): Setting => settings[id];
export type Command = "bluetooth" | "firmware" | "reset" | "version";
export type Group = "root" | "dmx" | "wireless";
type MenuEntry = { label: string; group?: Group; setting?: SettingId; command?: Command };
export const menus: Record<Group, MenuEntry[]> = {
  root: [
    { label: "OUTPUT MODE", setting: "output" }, { label: "ADDRESS/DMX", group: "dmx" },
    { label: "WIRELESS CONTROL", group: "wireless" }, { label: "FAN CONTROL", setting: "fan" },
    { label: "ROTATE SCREEN", setting: "rotate" }, { label: "SCREEN BRIGHTNESS", setting: "screen" },
    { label: "LANGUAGE", setting: "language" }, { label: "FIRMWARE UPDATE", command: "firmware" },
    { label: "RESET ALL SETTINGS", command: "reset" }, { label: "VERSION", command: "version" },
  ],
  dmx: (["address", "dmxMode", "reduced", "curve", "smoothing"] as SettingId[]).map(id => ({ label: settings[id].label, setting: id })),
  wireless: [{ label: "RESET BLUETOOTH", command: "bluetooth" }, { label: "WIRELESS PROTOCOL", setting: "protocol" }],
};
export type Values = Partial<Record<ParamId, number>>;
export type Config = { mode: "CCT" | "EFFECT"; dim: number; cct: number; effect: number; effects: Values[]; settings: Record<SettingId, number> };
export type Menu = { group: Group; cursor: number; editor?: SettingId | Command; draft: number; notice?: string };
export type State = { config: Config; power: boolean; blackout: boolean; field: number; menu: Menu | null; epoch: number; trigger: number | null };
export type Action = { type: "POWER" | "MODE" | "MENU" | "RESET"; now: number } | { type: "TURN"; knob: "left" | "right"; delta: number; now: number } | { type: "PRESS"; knob: "left" | "right"; now: number };

export function defaults(): Config {
  return {
    mode: "CCT", dim: 20, cct: 5600, effect: 0,
    effects: effects.map(effect => Object.fromEntries(effect.params.map(param => [param.id, param.initial]))),
    settings: Object.fromEntries(Object.entries(settings).map(([id, value]) => [id, value.initial])) as Config["settings"],
  };
}
export const initialState = (config = defaults()): State => ({ config, power: false, blackout: false, field: 0, menu: null, epoch: 0, trigger: null });
export const fanCap = (config: Config) => [100, 100, 50, 15][config.settings.fan];
export const valueLabel = (id: SettingId, value: number) => setting(id).options?.[value] ?? String(value);
export const paramLabel = (param: Param, value: number) => param.id === "pause" ? (value ? "ON" : "OFF") : `${Number(value.toFixed(1))}${param.unit ?? ""}`;
const isSetting = (id: string): id is SettingId => Object.hasOwn(settings, id);

/** Routes power, global blackout, menu drafts and mode-specific dial actions.
 * The clock is supplied by callers; no timers or browser resources live here.
 */
export function reducer(state: State, action: Action): State {
  if (action.type === "RESET") return { ...initialState(), power: state.power, epoch: action.now };
  if (action.type === "POWER") return { ...state, power: !state.power, blackout: false, menu: null, field: 0, trigger: null, epoch: action.now };
  if (!state.power) return state;
  const config = state.config;
  if (action.type === "PRESS" && action.knob === "left") return { ...state, blackout: !state.blackout, trigger: null };
  if (action.type === "MODE") return { ...state, config: { ...config, mode: config.mode === "CCT" ? "EFFECT" : "CCT" }, menu: null, field: 0, trigger: null, epoch: action.now };
  if (action.type === "MENU") {
    const m = state.menu;
    if (!m) return { ...state, menu: { group: "root", cursor: 0, draft: 0 } };
    if (m.editor || m.notice) return { ...state, menu: { ...m, editor: undefined, notice: undefined } };
    return { ...state, menu: m.group === "root" ? null : { group: "root", cursor: m.group === "dmx" ? 1 : 2, draft: 0 } };
  }
  if (action.type !== "TURN" && action.type !== "PRESS") return state;
  if (state.menu) {
    const m = state.menu;
    if (action.knob === "left") return state;
    if (action.type === "TURN") {
      const max = m.editor && isSetting(m.editor) ? setting(m.editor).max : 1;
      const min = m.editor && isSetting(m.editor) ? setting(m.editor).min : 0;
      return { ...state, menu: m.editor
        ? { ...m, draft: clamp(m.draft + action.delta, min, max) }
        : { ...m, notice: undefined, cursor: clamp(m.cursor + action.delta, 0, menus[m.group].length - 1) } };
    }
    if (m.notice) return { ...state, menu: { ...m, notice: undefined } };
    if (m.editor) {
      const id = m.editor;
      if (id === "reset") return m.draft ? { ...initialState(), power: true, epoch: action.now } : { ...state, menu: { ...m, editor: undefined } };
      if (id === "bluetooth") return { ...state, menu: { ...m, editor: undefined, notice: m.draft ? "SIMULATED RESET\nNo Bluetooth connection" : undefined } };
      if (!isSetting(id)) return state;
      const next = id === "rotate" ? (m.draft ? 1 - config.settings.rotate : config.settings.rotate) : m.draft;
      return { ...state, config: { ...config, settings: { ...config.settings, [id]: next } }, menu: { ...m, editor: undefined, notice: id === "fan" ? `FAN: ${valueLabel("fan", next)}\nMAX POWER: ${[100, 100, 50, 15][next]}%` : "SET" } };
    }
    const entry = menus[m.group][m.cursor];
    if (entry.group) return { ...state, menu: { group: entry.group, cursor: 0, draft: 0 } };
    const id = entry.setting ?? entry.command!;
    return { ...state, menu: { ...m, editor: id, draft: entry.setting && id !== "rotate" ? config.settings[entry.setting] : 0 } };
  }
  if (config.mode === "CCT") {
    if (action.type === "PRESS") {
      const presets = [2700, 3200, 4300, 5600, 6500];
      const next = presets.find(value => value > config.cct) ?? presets[0];
      return { ...state, config: { ...config, cct: next } };
    }
    const id = action.knob === "left" ? "dim" : "cct";
    return { ...state, blackout: id === "dim" ? false : state.blackout, config: { ...config, [id]: clamp(config[id] + action.delta * (id === "dim" ? 1 : 100), id === "dim" ? 0 : 2700, id === "dim" ? 100 : 6500) } };
  }
  const effect = effects[config.effect];
  if (action.type === "PRESS") return effect.manual ? { ...state, trigger: action.now } : state;
  if (action.knob === "right") return { ...state, field: wrap(state.field + action.delta, effect.params.length + 1) };
  if (state.field === 0) return { ...state, config: { ...config, effect: wrap(config.effect + action.delta, effects.length) }, trigger: null, epoch: action.now };
  const param = effect.params[state.field - 1];
  const values = { ...config.effects[config.effect] };
  let value = clamp(Number(((values[param.id] ?? param.initial) + action.delta * param.step).toFixed(1)), param.min, param.max);
  // Range endpoints cannot cross. The right dial visits each endpoint separately.
  const pairs: [ParamId, ParamId][] = [["dimLow", "dim"], ["cctLow", "cctHigh"], ["intervalLow", "intervalHigh"]];
  for (const [low, high] of pairs) {
    if (param.id === low && values[high] !== undefined) value = Math.min(value, values[high]!);
    if (param.id === high && values[low] !== undefined) value = Math.max(value, values[low]!);
  }
  values[param.id] = value;
  return { ...state, blackout: param.id === "dim" || param.id === "dimLow" ? false : state.blackout, config: { ...config, effects: config.effects.map((v, i) => i === config.effect ? values : v) } };
}

/** Validate only known configuration fields; old or future schemas never reach state. */
export function loadConfig(raw: string | null): Config {
  const result = defaults();
  if (!raw) return result;
  try {
    const saved = JSON.parse(raw);
    if (saved?.version !== 1 || !saved.config || typeof saved.config !== "object") return result;
    const c = saved.config;
    const number = (value: unknown, min: number, max: number, fallback: number, step = 1) => typeof value === "number" && Number.isFinite(value) ? Number(clamp(min + Math.round((value - min) / step) * step, min, max).toFixed(1)) : fallback;
    result.mode = c.mode === "EFFECT" ? "EFFECT" : "CCT";
    result.dim = number(c.dim, 0, 100, result.dim);
    result.cct = number(c.cct, 2700, 6500, result.cct, 100);
    result.effect = number(c.effect, 0, effects.length - 1, 0);
    for (const id of Object.keys(settings) as SettingId[]) {
      const s = setting(id);
      result.settings[id] = number(c.settings?.[id], s.min, s.max, s.initial);
    }
    effects.forEach((e, i) => {
      e.params.forEach(param => { result.effects[i][param.id] = number(c.effects?.[i]?.[param.id], param.min, param.max, param.initial, param.step); });
      for (const [low, high] of [["dimLow", "dim"], ["cctLow", "cctHigh"], ["intervalLow", "intervalHigh"]] as [ParamId, ParamId][]) {
        const values = result.effects[i];
        if (values[low] !== undefined && values[high] !== undefined) values[low] = Math.min(values[low]!, values[high]!);
      }
    });
  } catch { /* Corrupted browser data falls back to a usable practice session. */ }
  return result;
}
