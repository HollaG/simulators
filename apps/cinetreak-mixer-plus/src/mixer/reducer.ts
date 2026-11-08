import { defaultParams, menuAt, parameters, validateParam, type ParamValue } from './menus';
import { clamp, commit, opacity, progress } from './switching';
import { effects, type Action, type BusScene, type MixerState, type Snapshot, type Source } from './types';

const scene = (source: Source): BusScene => ({ source, chroma: false, luma: false, pip: false });
export function initialState(): MixerState {
  return {
    power: true, locked: false, started: false, pgm: scene('IN1'), pvw: scene('IN2'),
    downstream: { pgm: { dsk: false, logo: false }, pvw: { dsk: false, logo: false } }, selected: 'pip',
    params: defaultParams(), transition: null, fade: null, black: 0, serial: 0, freeze: null, mv: true,
    cam: false, pos: false, position: null, cameras: Array.from({ length: 4 }, () => ({ x: 50, y: 50, zoom: 1 })),
    presets: Array.from({ length: 4 }, () => [null, null, null, null]),
    menu: { open: false, path: [], cursor: 0, editing: false, lastInput: 0, octet: 0 },
    memories: [null, null, null, null], assets: {}, notice: 'Ready. Select a preview source, then CUT or AUTO.',
  };
}
const physicalBlocked = (s: MixerState) => !s.power || s.locked;
const videoParam = (id: string) => /^(pip|chroma|luma|dsk|logo|image|port\.(flip|layout))/.test(id);
export const canSave = (s: MixerState) => !s.transition && !s.fade;
export function snapshot(s: MixerState): Snapshot {
  return structuredClone({ pgm: s.pgm, pvw: s.pvw, downstream: s.downstream, params: Object.fromEntries(Object.entries(s.params).filter(([id]) => !id.startsWith('system.') && !id.startsWith('ptz.'))), assets: s.assets });
}
function setParam(s: MixerState, id: string, value: ParamValue): MixerState {
  const valid = validateParam(id, value);
  if (valid === undefined) return s;
  if (s.transition && videoParam(id)) return { ...s, notice: 'Video settings are held until AUTO finishes.' };
  return { ...s, params: { ...s.params, [id]: valid } };
}
function edit(s: MixerState, delta: number): MixerState {
  const item = menuAt(s.menu.path)[s.menu.cursor];
  if (!item?.param) return s;
  const def = parameters[item.param];
  const current = s.params[item.param];
  if (def.type === 'number') return setParam(s, item.param, Math.round((Number(current) + delta * def.step!) * 1000) / 1000);
  if (def.type === 'toggle') return setParam(s, item.param, delta > 0);
  if (def.type === 'enum') return setParam(s, item.param, def.options![clamp(def.options!.indexOf(String(current)) + delta, 0, def.options!.length - 1)]);
  if (item.param === 'ptz.ip' && s.params['ptz.search']) {
    const options = ['192.168.1.101', '192.168.1.102', '192.168.1.103', '192.168.1.104'];
    return setParam(s, item.param, options[clamp(Math.max(0, options.indexOf(String(current))) + delta, 0, 3)]);
  }
  const octets = String(current).split('.');
  octets[s.menu.octet] = String(clamp(Number(octets[s.menu.octet]) + delta, 0, 255));
  return setParam(s, item.param, octets.join('.'));
}

/** Route physical inputs by power/lock, camera mode, then transition restrictions. No clock or browser APIs run here. */
export function reducer(state: MixerState, action: Action): MixerState {
  if (action.type === 'RESTORE') return { ...state, ...action.state };
  if (action.type === 'NOTICE') return { ...state, notice: action.message };
  const now = action.now;
  // Reconcile elapsed operations before accepting a new input, including a hidden-tab return.
  let s = state;
  if (s.transition && progress(s.transition, now) >= 1) s = commit(s);
  if (s.fade && progress(s.fade, now) >= 1) s = { ...s, black: s.fade.to, fade: null };
  if (action.type === 'COMPLETE') return s.transition?.id === action.id ? commit(s) : s;
  if (action.type === 'TICK') {
    if (s.menu.open && now - s.menu.lastInput > Number(s.params['system.osd']) * 1000)
      return { ...s, menu: { ...s.menu, open: false, editing: false } };
    return s;
  }
  if (action.type === 'BUTTON' && action.id === 'reset') {
    const fresh = initialState();
    return { ...fresh, serial: s.serial + 1, memories: s.memories, assets: s.assets, notice: 'Settings reset. Press Start practice to resume audio.' };
  }
  if (action.type === 'BUTTON' && action.id === 'shutdown') return { ...s, power: false, locked: false, started: false, transition: null, fade: null, black: 0, freeze: null, position: null, cam: false, pos: false, serial: s.serial + 1, menu: { ...s.menu, open: false }, notice: 'Powered off. Press power to resume.' };
  if (action.type === 'BUTTON' && action.id === 'power') return s.power ? { ...s, locked: !s.locked, notice: s.locked ? 'Panel unlocked.' : 'Panel locked. Press lock/power to unlock.' } : { ...s, power: true, locked: false, notice: 'Powered on. Press Start practice for audio.' };
  if (physicalBlocked(s)) return s;
  if (action.type === 'BUTTON' && action.id === 'start') return { ...s, started: true, notice: 'Practice running · audio enabled.' };
  if (action.type === 'PARAM') return setParam(s, action.id, action.value);
  if (action.type === 'ASSET') return s.transition ? s : { ...s, assets: { ...s.assets, [action.slot]: action.id }, notice: `${action.slot} loaded and saved locally.` };
  if (action.type === 'MODE') return { ...s, selected: effects[(effects.indexOf(s.selected) + action.delta + effects.length * 100) % effects.length], position: null };
  if (action.type === 'ENCODER') {
    if (!s.menu.open) return { ...s, menu: { open: true, path: [], cursor: 0, editing: false, lastInput: now, octet: 0 } };
    s = { ...s, menu: { ...s.menu, lastInput: now } };
    return s.menu.editing ? edit(s, action.delta) : { ...s, menu: { ...s.menu, cursor: clamp(s.menu.cursor + action.delta, 0, menuAt(s.menu.path).length - 1) } };
  }
  if (action.type === 'MOVE') {
    if (s.position && !s.transition) {
      const step = Math.min(action.dt, .1) * 30;
      const xKey = s.position === 'crop' ? 'pip.cropX' : s.position === 'pick' ? 'chroma.pickX' : `${s.position}.x`;
      const yKey = s.position === 'crop' ? 'pip.cropY' : s.position === 'pick' ? 'chroma.pickY' : `${s.position}.y`;
      return { ...s, params: { ...s.params, [xKey]: clamp(Number(s.params[xKey]) + action.x * step, 0, 100), [yKey]: clamp(Number(s.params[yKey]) + action.y * step, 0, 100) } };
    }
    if (!s.cam) return s;
    const index = Number(s.params['ptz.camera']) - 1;
    const c = s.cameras[index], speed = (4 + Number(s.params['ptz.speed']) * 2) * Math.min(action.dt, .1);
    return { ...s, cameras: s.cameras.map((camera, i) => i === index ? { x: clamp(c.x + action.x * speed, 0, 100), y: clamp(c.y + action.y * speed, 0, 100), zoom: clamp(c.zoom + action.zoom * speed * .05, 1, 4) } : camera) };
  }
  if (action.type !== 'BUTTON') return s;
  let id = action.id;
  s = { ...s, menu: { ...s.menu, lastInput: now } };
  if (id === 'menu') {
    if (s.position) return { ...s, position: null };
    if (!s.menu.open) return { ...s, menu: { ...s.menu, open: true, path: [], cursor: 0 } };
    if (s.menu.editing) return { ...s, menu: { ...s.menu, editing: false } };
    if (s.menu.path.length) return { ...s, menu: { ...s.menu, cursor: s.menu.path.at(-1)!, path: s.menu.path.slice(0, -1) } };
    return { ...s, menu: { ...s.menu, open: false } };
  }
  if (id === 'encoder') {
    if (!s.menu.open) return { ...s, menu: { ...s.menu, open: true, path: [], cursor: 0 } };
    const item = menuAt(s.menu.path)[s.menu.cursor];
    if (!item) return s;
    if (item.children) return { ...s, menu: { ...s.menu, path: [...s.menu.path, s.menu.cursor], cursor: 0 } };
    if (item.param) {
      if (s.menu.editing && parameters[item.param].type === 'text' && !(item.param === 'ptz.ip' && s.params['ptz.search']) && s.menu.octet < 3) return { ...s, menu: { ...s.menu, octet: s.menu.octet + 1 } };
      return { ...s, menu: { ...s.menu, editing: !s.menu.editing, octet: 0 } };
    }
    id = item.command ?? '';
  }
  if (id === 'audio') return { ...s, menu: { ...s.menu, open: true, path: [1], cursor: 0, editing: false } };
  if (id === 'mv') return { ...s, mv: !s.mv };
  if (id === 'cam') return { ...s, cam: !s.cam, pos: false, position: null, notice: s.cam ? 'Camera mode off.' : `Controlling camera ${s.params['ptz.camera']}. Hold joystick or zoom; POS opens presets.` };
  if (id === 'pos') return s.cam ? { ...s, pos: !s.pos, notice: 'Camera presets: bottom PVW row saves; top PGM row recalls.' } : { ...s, notice: 'Press CAM before POS.' };
  if (id === 'joystick') return { ...s, position: null, notice: 'Position adjustment finished.' };
  if (id === 'mode' || id.startsWith('position:')) {
    const target = id.startsWith('position:') ? id.split(':')[1] : s.selected;
    return { ...s, position: s.position === target ? null : target, params: target === 'pick' ? { ...s.params, 'chroma.pick': 'PickColor' } : s.params, menu: { ...s.menu, open: false }, notice: `Use the joystick to position ${target.toUpperCase()}. MENU finishes.` };
  }
  const sourceMatch = /^(pgm|pvw)([1-4])$/.exec(id);
  if (sourceMatch && s.cam && s.pos) {
    const camera = Number(s.params['ptz.camera']) - 1, slot = Number(sourceMatch[2]) - 1;
    if (sourceMatch[1] === 'pvw') return { ...s, presets: s.presets.map((slots, i) => i === camera ? slots.map((preset, j) => j === slot ? { ...s.cameras[camera] } : preset) : slots), notice: `Camera ${camera + 1} · preset ${slot + 1} saved.` };
    const preset = s.presets[camera][slot];
    return preset ? { ...s, cameras: s.cameras.map((c, i) => i === camera ? { ...preset } : c), notice: `Camera ${camera + 1} · preset ${slot + 1} recalled.` } : { ...s, notice: 'Preset empty. Save with the matching PVW button first.' };
  }
  if (id === 'ftb') {
    const from = opacity(s, now), to = s.fade ? 1 - s.fade.to : s.black > .5 ? 0 : 1;
    return { ...s, serial: s.serial + 1, fade: { id: s.serial + 1, startedAt: now, durationMs: Math.max(1, Math.abs(to - from) * Number(s.params['transition.ftb']) * 1000), from, to }, notice: to ? 'Program fading to black. Audio continues.' : 'Returning from black.' };
  }
  if (id === 'cut') return { ...commit(s), notice: 'CUT · program and preview exchanged.' };
  if (s.transition) return { ...s, notice: 'AUTO in progress. CUT finishes it immediately.' };
  if (id === 'auto') return { ...s, serial: s.serial + 1, transition: { id: s.serial + 1, kind: String(s.params['transition.kind']), startedAt: now, durationMs: Number(s.params['transition.duration']) * 1000, from: { ...s.pgm }, to: { ...s.pvw }, softness: Number(s.params['transition.softness']), dip: String(s.params['transition.dip']), color: '#' + ['red', 'green', 'blue'].map(k => Number(s.params[`transition.${k}`]).toString(16).padStart(2, '0')).join('') }, notice: `${s.params['transition.kind']} · ${s.params['transition.duration']}s` };
  if (sourceMatch) {
    const bus = sourceMatch[1] as 'pgm' | 'pvw';
    return { ...s, [bus]: { ...s[bus], source: `IN${sourceMatch[2]}` }, notice: `${bus.toUpperCase()} → IN${sourceMatch[2]}` };
  }
  if (id === 'pat' || id === 'estop') return { ...s, pvw: { ...s.pvw, source: id === 'pat' ? 'PAT' : 'E-STOP' }, notice: `${id === 'pat' ? s.params['image.pat'] : 'Emergency source'} prepared in preview. CUT or AUTO to take live.` };
  if (id === 'key' || id === 'onair') {
    const bus = id === 'key' ? 'pvw' : 'pgm', effect = s.selected;
    return effect === 'dsk' || effect === 'logo' ? { ...s, downstream: { ...s.downstream, [bus]: { ...s.downstream[bus], [effect]: !s.downstream[bus][effect] } } } : { ...s, [bus]: { ...s[bus], [effect]: !s[bus][effect] } };
  }
  if (id === 'still') return { ...s, freeze: s.freeze ? null : s.pgm.source.startsWith('IN') ? { source: s.pgm.source, id: s.serial + 1 } : null, serial: s.serial + 1, notice: s.freeze ? 'Input frame released.' : 'STILL holds the current program input everywhere it appears.' };
  if (id === 'save') {
    if (!canSave(s)) return { ...s, notice: 'Wait for the fade to finish before saving.' };
    const slot = Number(s.params['system.mem']) - 1;
    return { ...s, memories: s.memories.map((value, i) => i === slot ? snapshot(s) : value), notice: `MEM ${slot + 1} saved.` };
  }
  if (id === 'mem' || id === 'recall') {
    if (!canSave(s)) return s;
    const slot = Number(s.params['system.mem']) - 1, stored = s.memories[slot];
    return stored ? { ...s, ...structuredClone(stored), params: { ...s.params, ...stored.params }, notice: `MEM ${slot + 1} recalled.` } : { ...s, notice: `MEM ${slot + 1} is empty. Save through System → MEM.` };
  }
  if (id === 'version') return { ...s, notice: 'Mixer Plus Simulator 0.1 · virtual hardware · provisional firmware behaviour' };
  if (id === 'reset') return { ...initialState(), memories: s.memories, assets: s.assets, serial: s.serial + 1 };
  return s;
}

export function enabled(s: MixerState, bus: 'pgm' | 'pvw', effect: typeof effects[number]): boolean {
  return effect === 'dsk' || effect === 'logo' ? s.downstream[bus][effect] : s[bus][effect];
}
