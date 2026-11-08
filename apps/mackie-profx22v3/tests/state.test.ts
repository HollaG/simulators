import { describe, expect, it } from "vitest";
import {
  createDefault,
  demoState,
  faderDb,
  faderPosition,
  mixerReducer,
  restoreSession,
} from "../src/state";

describe("FX encoder", () => {
  it("previews, wraps, and only applies on a push", () => {
    let state = createDefault();
    state = mixerReducer(state, { type: "presetTurn", delta: -1, now: 100 });
    expect(state.preset).toBe(1);
    expect(state.pending?.preset).toBe(24);
    state = mixerReducer(state, { type: "presetConfirm", now: 200 });
    expect(state.preset).toBe(24);
    expect(state.pending).toBeNull();
  });
  it("expires after ten seconds and does not let an earlier deadline cancel a newer preview", () => {
    let state = mixerReducer(createDefault(), {
      type: "presetTurn",
      delta: 1,
      now: 0,
    });
    state = mixerReducer(state, { type: "presetTurn", delta: 1, now: 9000 });
    expect(
      mixerReducer(state, { type: "tick", now: 10000 }).pending?.preset,
    ).toBe(3);
    state = mixerReducer(state, { type: "tick", now: 19000 });
    expect(state.pending).toBeNull();
    expect(state.preset).toBe(1);
  });
  it("starts a fresh preview if a rotation arrives after expiry, before the next tick", () => {
    let state = mixerReducer(createDefault(), {
      type: "presetTurn",
      delta: 4,
      now: 0,
    });
    state = mixerReducer(state, { type: "presetTurn", delta: 1, now: 10001 });
    expect(state.pending?.preset).toBe(2);
  });
  it("does not confirm an expired preview when the browser delayed the expiry callback", () => {
    const state = mixerReducer(createDefault(), {
      type: "presetTurn",
      delta: 5,
      now: 0,
    });
    const confirmed = mixerReducer(state, {
      type: "presetConfirm",
      now: 10001,
    });
    expect(confirmed.preset).toBe(1);
    expect(confirmed.pending).toBeNull();
  });
  it("power cancels a preview, retains the confirmed program, and warms up for five seconds", () => {
    let state = mixerReducer(createDefault(), {
      type: "presetTurn",
      delta: 3,
      now: 0,
    });
    state = mixerReducer(state, { type: "power", now: 100 });
    expect(state.pending).toBeNull();
    expect(state.power).toBe(false);
    state = mixerReducer(state, { type: "global", key: "main", value: 8 });
    expect(state.globals.main).toBe(0);
    state = mixerReducer(state, { type: "power", now: 1000 });
    expect(state.bootUntil).toBe(6000);
    expect(state.preset).toBe(1);
  });
});
describe("session restoration", () => {
  it("restores configuration and missing-file identity, excluding transient power/preview state", () => {
    const state = demoState();
    state.channels[2].source = "file:id:bass.wav";
    state.channels[2].fader = -4;
    state.power = false;
    state.pending = { preset: 4, expires: 1200 };
    state.bootUntil = 9000;
    const restored = restoreSession(JSON.stringify({ version: 1, state }));
    expect(restored.channels[2].source).toBe("file:id:bass.wav");
    expect(restored.channels[2].fader).toBe(-4);
    expect(restored.power).toBe(true);
    expect(restored.pending).toBeNull();
    expect(restored.bootUntil).toBe(0);
  });
  it("rejects unknown versions and invalid shapes, and bounds malformed numeric settings", () => {
    expect(restoreSession("{bad")).toEqual(createDefault());
    expect(
      restoreSession(JSON.stringify({ version: 2, state: demoState() })),
    ).toEqual(createDefault());
    const state = demoState();
    state.channels[0].pan = 300;
    state.channels[1].mid = -500;
    const restored = restoreSession(JSON.stringify({ version: 1, state }));
    expect(restored.channels[0].pan).toBe(1);
    expect(restored.channels[1].mid).toBe(-15);
  });
});
describe("fader taper", () => {
  it("has a true off, a usable unity position, and reversible interpolation", () => {
    expect(faderDb(0)).toBe(-90);
    expect(faderDb(0.75)).toBe(0);
    expect(faderDb(1)).toBe(10);
    for (const db of [-90, -60, -45, -30, -20, -10, -5, 0, 3, 10])
      expect(faderDb(faderPosition(db))).toBeCloseTo(db, 8);
  });
});
