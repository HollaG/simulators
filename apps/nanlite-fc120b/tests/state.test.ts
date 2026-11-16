import { describe, expect, it } from "vitest";
import { defaults, effects, initialState, loadConfig, reducer, settings, type Action, type State } from "../src/state";
import { sample } from "../src/signal";

const act = (s: State, action: Omit<Extract<Action, { type: "TURN" }>, "now"> | Omit<Extract<Action, { type: "PRESS" }>, "now"> | { type: "POWER" | "MODE" | "MENU" | "RESET" }, now = 1000) => reducer(s, { ...action, now } as Action);
const turn = (s: State, knob: "left" | "right", delta: number) => act(s, { type: "TURN", knob, delta });
const press = (s: State, knob: "left" | "right", now = 1000) => act(s, { type: "PRESS", knob }, now);
const powered = () => act(initialState(), { type: "POWER" });
const fx = (index: number) => turn(act(powered(), { type: "MODE" }), "left", index);

describe("FC-120B operating contract", () => {
  it("ignores controls while off and restarts with stable settings but no blackout/menu", () => {
    let s = initialState();
    expect(turn(s, "left", 40)).toBe(s);
    s = turn(powered(), "left", 23);
    s = press(s, "left"); s = act(s, { type: "MENU" });
    s = act(s, { type: "POWER" });
    expect(sample(s, 1000).dim).toBe(0);
    s = act(s, { type: "POWER" });
    expect(s.config.dim).toBe(43);
    expect(s.blackout).toBe(false); expect(s.menu).toBeNull();
  });
  it("bounds CCT and DIM and loops all five CCT presets", () => {
    let s = turn(turn(powered(), "left", 500), "right", 500);
    expect(s.config.dim).toBe(100); expect(s.config.cct).toBe(6500);
    const result: number[] = [];
    for (let i = 0; i < 6; i++) { s = press(s, "right"); result.push(s.config.cct); }
    expect(result).toEqual([2700, 3200, 4300, 5600, 6500, 2700]);
    s = turn(turn(s, "left", -500), "right", -500);
    expect(s.config.dim).toBe(0); expect(s.config.cct).toBe(2700);
  });
  it("blackout restores stored DIM in CCT and effect modes, including inside menus", () => {
    for (const start of [powered(), fx(3)]) {
      const before = sample(start, 1375);
      let s = press(start, "left");
      expect(sample(s, 1375).dim).toBe(0);
      expect(s.config).toBe(start.config);
      s = act(s, { type: "MENU" }); s = press(s, "left");
      expect(sample(s, 1375)).toEqual(before);
    }
  });
  it("wraps effect selection and edits bounded range endpoints independently", () => {
    let s = fx(-1);
    expect(effects[s.config.effect].name).toBe("WELDING");
    s = turn(s, "left", 1); expect(s.config.effect).toBe(0);
    s = turn(s, "right", 2); // CCT MIN
    s = turn(s, "left", 100);
    expect(s.config.effects[0].cctLow).toBe(5600);
    s = turn(s, "right", 1); s = turn(s, "left", -100);
    expect(s.config.effects[0].cctHigh).toBe(5600);
    expect(s.config.cct).toBe(5600);
  });
  it("keeps menu drafts isolated until right press, and MENU cancels", () => {
    let s = act(powered(), { type: "MENU" });
    s = turn(s, "right", 1); s = press(s, "right"); // ADDRESS/DMX
    s = press(s, "right"); s = turn(s, "right", 600);
    expect(s.menu?.draft).toBe(512); expect(s.config.settings.address).toBe(1);
    s = act(s, { type: "MENU" }); expect(s.config.settings.address).toBe(1);
    s = press(s, "right"); s = turn(s, "right", 41); s = press(s, "right");
    expect(s.config.settings.address).toBe(42);
    s = act(s, { type: "MENU" }); // dismiss SET
    s = act(s, { type: "MENU" }); expect(s.menu?.group).toBe("root");
    s = act(s, { type: "MENU" }); expect(s.menu).toBeNull();
  });
  it("fan modes affect actual output while preserving requested DIM", () => {
    const s = turn(powered(), "left", 100);
    for (const [fan, max] of [[0, 100], [1, 100], [2, 50], [3, 15]]) {
      const config = { ...s.config, settings: { ...s.config.settings, fan } };
      const out = sample({ ...s, config }, 1000);
      expect(out.dim).toBeLessThanOrEqual(max); expect(out.cap).toBe(max);
      expect(config.dim).toBe(100);
    }
  });
  it("manual shots require a trigger, restart on repeated press, and cancel on blackout/power/mode/effect", () => {
    for (const index of [5, 12]) {
      let s = fx(index);
      expect(sample(s, 3000).dim).toBe(0);
      s = press(s, "right", 3000); expect(sample(s, 3000).dim).toBeGreaterThan(0);
      const expired = sample(s, 20000).dim;
      expect(expired).toBeLessThan(0.01);
      s = press(s, "right", 20000); expect(sample(s, 20000).dim).toBeGreaterThan(0);
      for (const a of [{ type: "POWER" }, { type: "MODE" }, { type: "PRESS", knob: "left" }, { type: "TURN", knob: "left", delta: 1 }] as const) expect(act(s, a, 20001).trigger).toBeNull();
    }
  });
  it("welding pause stops the preview signal and keeps editable brightness", () => {
    let s = fx(13); s = turn(s, "right", 5); s = turn(s, "left", 1);
    expect(s.config.effects[13].pause).toBe(1);
    expect(sample(s, 1500).dim).toBe(0);
    expect(s.config.effects[13].dim).toBe(100);
  });
  it("reset requires YES and clears configuration without faking hardware firmware", () => {
    let s = turn(powered(), "left", 50);
    s = act(s, { type: "MENU" }); s = turn(s, "right", 8); s = press(s, "right");
    s = press(s, "right"); expect(s.config.dim).toBe(70);
    s = press(s, "right"); s = turn(s, "right", 1); s = press(s, "right");
    expect(s.config).toEqual(defaults()); expect(s.power).toBe(true);
  });
});

describe("deterministic light preview", () => {
  it.each(effects.map((e, i) => [e.name, i] as const))("%s produces bounded finite output and changes with its controls", (_, index) => {
    let s = fx(index);
    if (effects[index].manual) s = press(s, "right", 1000);
    for (let now = 1000; now <= 25000; now += 83) {
      const signal = sample(s, now);
      expect(Number.isFinite(signal.dim)).toBe(true);
      expect(signal.dim).toBeGreaterThanOrEqual(0); expect(signal.dim).toBeLessThanOrEqual(100);
      expect(signal.cct).toBeGreaterThanOrEqual(2700); expect(signal.cct).toBeLessThanOrEqual(6500);
      expect(sample(s, now)).toEqual(signal);
    }
    const config = { ...s.config, effects: s.config.effects.map((v, i) => i === index ? { ...v, dim: 0, dimLow: 0 } : v) };
    expect(sample({ ...s, config }, 1234).dim).toBe(0);
  });
  it("range and speed settings change observable CCT, pulse rate, and flash ratio", () => {
    const loop = fx(0);
    expect(sample(loop, 1000).cct).toBe(3200);
    expect(sample(loop, 5000).cct).toBe(5600);
    const pulse = fx(3);
    expect(sample(pulse, 1000).dim).toBe(0);
    expect(sample(pulse, 1750).dim).toBeGreaterThan(80);
    const flash = fx(2);
    expect(sample(flash, 1100).dim).toBeGreaterThan(0);
    expect(sample(flash, 1750).dim).toBe(0);
  });
});

describe("configuration persistence", () => {
  it("roundtrips only stable settings and reloads powered off", () => {
    const config = fx(7).config;
    const restored = initialState(loadConfig(JSON.stringify({ version: 1, config, power: true, blackout: true, trigger: 123 })));
    expect(restored.config).toEqual(config);
    expect(restored.power).toBe(false); expect(restored.trigger).toBeNull();
  });
  it("sanitizes malformed values, unknown schemas, reversed ranges and non-step values", () => {
    expect(loadConfig("bad")).toEqual(defaults()); expect(loadConfig('{"version":9}')).toEqual(defaults());
    const config = defaults();
    config.dim = 999; config.cct = 1234; config.effects[0].cctLow = 6500; config.effects[0].cctHigh = 2700;
    config.settings.fan = -1; config.effects[2].interval = 0.234;
    const loaded = loadConfig(JSON.stringify({ version: 1, config }));
    expect(loaded.dim).toBe(100); expect(loaded.cct).toBe(2700);
    expect(loaded.effects[0].cctLow).toBe(2700); expect(loaded.effects[2].interval).toBe(0.2);
    expect(loaded.settings.fan).toBe(settings.fan.min);
  });
});
