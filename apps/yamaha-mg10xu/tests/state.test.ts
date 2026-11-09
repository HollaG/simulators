import { describe, it, expect } from "vitest";
import {
  activeInputs,
  createDefault,
  mixerReducer as reduce,
  restoreSession,
  fxActive,
} from "../src/state";

describe("MG10XU control contract", () => {
  it("keeps phone priority over RCA and switches USB independently of routing", () => {
    let s = createDefault();
    s.inputs.rca56.kind = "music";
    expect(activeInputs(s)[4]).toBe("rca56");
    s.inputs.phone56.kind = "keys";
    expect(activeInputs(s)[4]).toBe("phone56");
    s = reduce(s, { type: "toggle", param: "usb" });
    expect(activeInputs(s)[6]).toBe("usb910");
    expect(s.toStereo).toBe(true);
  });
  it("previews, confirms and expires selections without changing audible program", () => {
    let s = { ...createDefault(), power: true };
    s = reduce(s, { type: "turn", value: 12, now: 100 });
    expect(s.program).toBe(1);
    expect(s.pending).toBe(12);
    s = reduce(s, { type: "tick", now: 5100 });
    expect(s.pending).toBeNull();
    expect(s.program).toBe(1);
    s = reduce(s, { type: "turn", value: 18, now: 6000 });
    s = reduce(s, { type: "press", now: 6100 });
    expect(s.program).toBe(18);
    expect(s.pending).toBeNull();
    s = reduce(s, { type: "turn", value: 24, now: 6200, held: true });
    expect(s.program).toBe(24);
  });
  it("does not commit an expired preview when a suspended tab returns", () => {
    let s = { ...createDefault(), power: true };
    s = reduce(s, { type: "turn", value: 9, now: 0 });
    expect(reduce(s, { type: "press", now: 6000 }).program).toBe(1);
  });
  it("recalls per-program parameter without moving the physical parameter knob", () => {
    let s = { ...createDefault(), power: true };
    s = reduce(s, { type: "global", param: "parameter", value: 8 });
    s = reduce(s, { type: "turn", value: 2, now: 1, held: true });
    expect(s.parameters[1]).toBe(5);
    expect(s.parameter).toBe(8);
    s = reduce(s, { type: "global", param: "parameter", value: 3 });
    s = reduce(s, { type: "turn", value: 1, now: 2, held: true });
    expect(s.parameters[0]).toBe(8);
    expect(s.parameter).toBe(3);
  });
  it("enters USB attenuation on five successive presses and applies it separately", () => {
    let s = { ...createDefault(), power: true };
    for (let n = 0; n < 5; n++) s = reduce(s, { type: "press", now: n * 100 });
    expect(s.editingAttenuator).toBe(true);
    s = reduce(s, { type: "turn", value: 18, now: 600 });
    expect(s.attenuator).toBe(-18);
    expect(s.program).toBe(1);
    s = reduce(s, { type: "press", now: 800 });
    expect(s.editingAttenuator).toBe(false);
    s = reduce(s, { type: "press", now: 2500 });
    expect(s.presses).toBe(1);
  });
  it("gates footswitch bypass with both physical connection and FX ON", () => {
    let s = { ...createDefault(), power: true, fxOn: true };
    expect(reduce(s, { type: "foot" }).footBypass).toBe(false);
    s.footConnected = true;
    s = reduce(s, { type: "foot" });
    expect(fxActive(s)).toBe(false);
    s = reduce(s, { type: "foot" });
    expect(fxActive(s)).toBe(true);
    s = reduce(s, { type: "toggle", param: "power" });
    expect(fxActive(s)).toBe(false);
  });
  it("restores controls and file identities but starts off with no pending actions", () => {
    let s = reduce(createDefault(), { type: "demo" });
    s = reduce(s, { type: "turn", value: 8, now: 0 });
    s.inputs.ch2 = { ...s.inputs.ch2, kind: "file", filename: "piano.wav" };
    const restored = restoreSession(
      JSON.stringify({ version: 1, settings: s }),
    );
    expect(restored.power).toBe(false);
    expect(restored.pending).toBeNull();
    expect(restored.channels[0].gain).toBe(42);
    expect(restored.inputs.ch2.filename).toBe("piano.wav");
    expect(restored.inputs.ch2.kind).toBe("file");
  });
  it("validates saved ranges and ignores invalid versions and unavailable controls", () => {
    const s = createDefault();
    expect(
      reduce(s, { type: "channel", channel: 6, param: "gain", value: 64 }),
    ).toBe(s);
    expect(
      reduce(s, {
        type: "channel",
        channel: 1,
        param: "gain",
        value: Infinity,
      }),
    ).toBe(s);
    expect(restoreSession("{bad")).toEqual(s);
    expect(restoreSession('{"version":2}')).toEqual(s);
    s.channels[0].level = 500;
    expect(
      restoreSession(JSON.stringify({ version: 1, settings: s })).channels[0]
        .level,
    ).toBe(10);
  });
});
