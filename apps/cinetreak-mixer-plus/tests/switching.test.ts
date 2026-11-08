import { describe, expect, it } from 'vitest';
import { menu, menuAt, parameters, validateParam } from '../src/mixer/menus';
import { initialState, reducer, enabled } from '../src/mixer/reducer';
import { opacity, progress } from '../src/mixer/switching';
import type { MixerState } from '../src/mixer/types';

const press = (s: MixerState, id: string, now = 0) => reducer(s, { type: 'BUTTON', id, now });
const param = (s: MixerState, id: string, value: number | string | boolean, now = 0) => reducer(s, { type: 'PARAM', id, value, now });

describe('program, preview and timed switching', () => {
  it('prepares preview without changing program, then performs a true swap', () => {
    const s = press(initialState(), 'pvw3'); expect(s.pgm.source).toBe('IN1'); expect(s.pvw.source).toBe('IN3');
    const cut = press(s, 'cut'); expect(cut.pgm.source).toBe('IN3'); expect(cut.pvw.source).toBe('IN1');
  });
  it('captures transition settings, derives midpoint, and commits exactly once', () => {
    const s = press(param(initialState(), 'transition.duration', 1), 'auto', 100);
    expect(progress(s.transition!, 600)).toBe(.5); expect(s.pgm.source).toBe('IN1');
    const changed = param(s, 'transition.duration', 2, 700); expect(changed.transition!.durationMs).toBe(1000);
    const complete = reducer(changed, { type: 'COMPLETE', id: s.transition!.id, now: 1100 });
    expect(complete.pgm.source).toBe('IN2'); expect(complete.pvw.source).toBe('IN1'); expect(complete.transition).toBeNull();
    expect(reducer(complete, { type: 'COMPLETE', id: s.transition!.id, now: 1200 }).pgm.source).toBe('IN2');
  });
  it('ignores repeated AUTO/source changes and CUT finishes the captured target', () => {
    const s = press(initialState(), 'auto', 0);
    const repeated = press(press(press(s, 'auto', 100), 'pvw4', 120), 'pgm3', 150);
    expect(repeated.transition?.id).toBe(s.transition?.id);
    const cut = press(repeated, 'cut', 200); expect(cut.pgm.source).toBe('IN2'); expect(cut.pvw.source).toBe('IN1');
    expect(reducer(cut, { type: 'COMPLETE', id: s.transition!.id, now: 600 }).pgm.source).toBe('IN2');
  });
  it('ignores completion events from an older operation', () => {
    const old = press(initialState(), 'auto'); const cut = press(old, 'cut', 10); const next = press(cut, 'auto', 20);
    const ignored = reducer(next, { type: 'COMPLETE', id: old.transition!.id, now: 30 });
    expect(ignored.transition?.id).toBe(next.transition?.id);
  });
  it('reconciles an elapsed transition before processing a later source input', () => {
    const s = press(press(initialState(), 'auto'), 'pvw4', 800);
    expect(s.pgm.source).toBe('IN2'); expect(s.pvw.source).toBe('IN4'); expect(s.transition).toBeNull();
  });
  it('does not let video menu edits alter a running composition', () => {
    const s = press(initialState(), 'auto'); expect(param(s, 'pip.source', 'IN4', 100).params['pip.source']).toBe('IN1');
    expect(param(s, 'audio.in1.volume', -12, 100).params['audio.in1.volume']).toBe(-12);
  });
  it('selects PAT/E-STOP in preview before taking live', () => {
    const s = press(initialState(), 'estop'); expect(s.pgm.source).toBe('IN1'); expect(s.pvw.source).toBe('E-STOP');
    expect(press(s, 'cut').pgm.source).toBe('E-STOP'); expect(press(s, 'pat').pvw.source).toBe('PAT');
  });
});
describe('effect routing and indicators', () => {
  it('takes preview PIP to program and retains downstream logo flags', () => {
    let s = press(initialState(), 'key'); expect(enabled(s, 'pvw', 'pip')).toBe(true);
    s = reducer(s, { type: 'MODE', delta: 2, now: 0 }); expect(s.selected).toBe('logo');
    s = press(s, 'key'); s = press(s, 'cut');
    expect(enabled(s, 'pgm', 'pip')).toBe(true); expect(enabled(s, 'pvw', 'pip')).toBe(false);
    expect(enabled(s, 'pvw', 'logo')).toBe(true); expect(enabled(s, 'pgm', 'logo')).toBe(false);
    s = press(s, 'onair'); expect(enabled(s, 'pgm', 'logo') && enabled(s, 'pvw', 'logo')).toBe(true);
  });
  it('freezes an input and releases the same capture after a source change', () => {
    let s = press(initialState(), 'still'); expect(s.freeze?.source).toBe('IN1');
    s = press(s, 'pgm3'); expect(s.freeze?.source).toBe('IN1');
    expect(press(s, 'still').freeze).toBeNull();
  });
});
describe('fade, lock and power', () => {
  it('reverses FTB continuously and keeps AUTO independent', () => {
    let s = press(press(initialState(), 'auto'), 'ftb', 0);
    expect(opacity(s, 200)).toBeCloseTo(.4);
    s = press(s, 'ftb', 200); expect(s.fade?.from).toBeCloseTo(.4); expect(s.fade?.to).toBe(0); expect(s.fade?.durationMs).toBeCloseTo(200); expect(s.transition).not.toBeNull();
    expect(opacity(s, 400)).toBe(0);
  });
  it('locks physical inputs while the clock still finishes transitions', () => {
    const s = press(press(initialState(), 'auto'), 'power', 10);
    expect(s.locked).toBe(true); expect(press(s, 'pvw4', 20).pvw.source).toBe('IN2');
    expect(reducer(s, { type: 'TICK', now: 1000 }).pgm.source).toBe('IN2');
    expect(press(s, 'power', 20).locked).toBe(false);
  });
  it('shutdown cancels transient state, and power resumes the configuration', () => {
    const s = press(press(param(initialState(), 'transition.duration', 2), 'auto'), 'shutdown', 50);
    expect(s.power).toBe(false); expect(s.transition).toBeNull(); expect(s.started).toBe(false);
    expect(press(s, 'power', 100).params['transition.duration']).toBe(2);
  });
});
describe('camera modes and memories', () => {
  it('saves and recalls camera positions without switching either bus', () => {
    let s = press(initialState(), 'cam');
    s = reducer(s, { type: 'MOVE', x: 1, y: 1, zoom: 1, dt: .1, now: 0 });
    s = press(press(s, 'pos'), 'pvw2'); const saved = { ...s.cameras[0] };
    s = reducer(s, { type: 'MOVE', x: -1, y: 0, zoom: 0, dt: .1, now: 20 });
    s = press(s, 'pgm2', 30); expect(s.cameras[0]).toEqual(saved); expect(s.pgm.source).toBe('IN1'); expect(s.pvw.source).toBe('IN2');
  });
  it('keeps joystick coordinates in range', () => {
    const s = press(initialState(), 'cam');
    const moved = reducer({ ...s, cameras: s.cameras.map(c => ({ ...c, x: 100, y: 0, zoom: 4 })) }, { type: 'MOVE', x: 1, y: -1, zoom: 1, dt: 20, now: 0 });
    expect(moved.cameras[0]).toEqual({ x: 100, y: 0, zoom: 4 });
  });
  it('recalls production settings/media while retaining global preferences and presets', () => {
    let s = press(param(initialState(), 'pip.source', 'IN4'), 'pgm3');
    s = reducer(s, { type: 'ASSET', slot: 'LOGO1', id: 'asset-123', now: 0 }); s = press(s, 'save');
    s = param(press(s, 'pgm2'), 'system.backlight', 45); s = param(s, 'pip.source', 'IN2');
    s = press(s, 'mem'); expect(s.pgm.source).toBe('IN3'); expect(s.params['pip.source']).toBe('IN4'); expect(s.params['system.backlight']).toBe(45); expect(s.assets.LOGO1).toBe('asset-123');
    const reset = press(s, 'reset'); expect(reset.memories[0]).not.toBeNull(); expect(reset.assets.LOGO1).toBe('asset-123'); expect(reset.started).toBe(false);
  });
});
describe('menus and parameter validation', () => {
  it('navigates, edits and backs out using only hardware inputs', () => {
    let s = press(press(initialState(), 'menu'), 'encoder'); // Effect submenu
    s = reducer(s, { type: 'ENCODER', delta: 1, now: 0 }); s = press(s, 'encoder');
    s = reducer(s, { type: 'ENCODER', delta: 5, now: 0 }); expect(s.params['transition.duration']).toBe(1);
    s = press(s, 'encoder'); expect(s.menu.editing).toBe(false);
    s = press(s, 'menu'); expect(s.menu.path).toEqual([]); s = press(s, 'menu'); expect(s.menu.open).toBe(false);
  });
  it('supports audio shortcut and OSD timeout', () => {
    const s = press(initialState(), 'audio', 100); expect(s.menu.path).toEqual([1]);
    expect(reducer(s, { type: 'TICK', now: 30101 }).menu.open).toBe(false);
  });
  it('rejects malformed inputs and clamps legal numeric parameters', () => {
    expect(validateParam('not.a.path', 1)).toBeUndefined(); expect(validateParam('system.ip', '999.1.1.1')).toBeUndefined();
    expect(validateParam('transition.duration', 99)).toBe(5); expect(validateParam('transition.kind', 'NOPE')).toBeUndefined(); expect(validateParam('pip.custom', Number.NaN)).toBeUndefined();
  });
  it('every menu parameter has a valid default and every definition is bounded', () => {
    function visit(items: typeof menu) { for (const item of items) { if (item.param) expect(parameters[item.param]).toBeDefined(); if (item.children) visit(item.children); } }
    visit(menu); for (const [id, def] of Object.entries(parameters)) expect(validateParam(id, def.default)).toEqual(def.default);
    expect(menuAt([1]).length).toBe(8);
  });
});
