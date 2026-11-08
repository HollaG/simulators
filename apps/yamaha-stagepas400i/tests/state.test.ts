import { describe, expect, it } from "vitest";
import {
  activeInputs,
  createDefault,
  inputGain,
  mixerReducer,
  restoreSession,
  reverbProgram,
  type MixerState,
} from "../src/state";

describe("documented routing", () => {
  it("selects connected jacks even if their media is missing; USB always adds", () => {
    const state = createDefault();
    state.inputs.rca56.kind = "music";
    expect(activeInputs(state, 4)).toEqual(["rca56"]);
    state.inputs.phone56.kind = "file";
    expect(activeInputs(state, 4)).toEqual(["phone56"]);
    state.inputs.phone78.kind = "music";
    state.inputs.usb78.kind = "tone";
    expect(activeInputs(state, 5)).toEqual(["phone78", "usb78"]);
    state.inputs.mini78.kind = "file";
    expect(activeInputs(state, 5)).toEqual(["mini78", "usb78"]);
  });
  it("requires phantom only on the two supported condenser inputs", () => {
    const state = createDefault();
    state.power = true;
    state.inputs.ch1.kind = state.inputs.ch3.kind = "condenser";
    expect(inputGain(state, "ch1")).toBe(0);
    state.phantom = true;
    expect(inputGain(state, "ch1")).toBe(1);
    expect(inputGain(state, "ch3")).toBe(0);
    state.channels[0].mic = true;
    expect(20 * Math.log10(inputGain(state, "ch1"))).toBeCloseTo(26);
    state.ac = false;
    expect(inputGain(state, "ch1")).toBe(0);
  });
});

describe("power and switches", () => {
  it("retains physical controls through power loss but clears momentary reverb", () => {
    let state = mixerReducer(createDefault(), { type: "demo" });
    state = {
      ...state,
      phantom: true,
      feedback: true,
      reverbOn: true,
      hiZ: true,
    };
    const channels = state.channels;
    state = mixerReducer(state, { type: "toggle", param: "power" });
    expect(state.reverbOn).toBe(false);
    expect(state.channels).toBe(channels);
    expect([state.phantom, state.feedback, state.hiZ]).toEqual([
      true,
      true,
      true,
    ]);
    expect(mixerReducer(state, { type: "toggle", param: "reverbOn" })).toBe(
      state,
    );
    state = mixerReducer(state, { type: "toggle", param: "power" });
    expect(state.reverbOn).toBe(false);
    state = mixerReducer(state, { type: "toggle", param: "reverbOn" });
    state = mixerReducer(state, { type: "toggle", param: "ac" });
    expect(state.reverbOn).toBe(false);
  });
  it("requires a powered mixer and a connected footswitch", () => {
    let state = mixerReducer(createDefault(), { type: "demo" });
    expect(mixerReducer(state, { type: "foot" })).toBe(state);
    state = { ...state, footswitch: true };
    state = mixerReducer(state, { type: "foot" });
    expect(state.reverbOn).toBe(true);
    expect(mixerReducer(state, { type: "foot" }).reverbOn).toBe(false);
  });
  it("clamps real parameter ranges and rejects impossible strip controls", () => {
    const state = createDefault();
    expect(
      mixerReducer(state, {
        type: "channel",
        channel: 0,
        param: "low",
        value: -40,
      }).channels[0].low,
    ).toBe(-15);
    expect(
      mixerReducer(state, {
        type: "channel",
        channel: 4,
        param: "reverb",
        value: 10,
      }),
    ).toBe(state);
    expect(
      mixerReducer(state, { type: "switch", channel: 5, param: "mic" }),
    ).toBe(state);
    expect(
      mixerReducer(state, { type: "global", param: "master", value: NaN }),
    ).toBe(state);
  });
});

describe("session restore", () => {
  it("restores positions/connections but never auto-starts power or reverb", () => {
    const state: MixerState = {
      ...mixerReducer(createDefault(), { type: "demo" }),
      reverbOn: true,
    };
    state.inputs.phone56 = {
      kind: "file",
      plug: "phone",
      volume: -3,
      filename: "My keys.wav",
    };
    const restored = restoreSession(JSON.stringify({ version: 1, state }));
    expect(restored.channels).toEqual(state.channels);
    expect(restored.inputs.phone56).toEqual(state.inputs.phone56);
    expect(restored.power).toBe(false);
    expect(restored.reverbOn).toBe(false);
  });
  it("recovers safely from corrupt, unknown and malformed settings", () => {
    for (const raw of [
      "broken",
      "null",
      JSON.stringify({ version: 99 }),
      JSON.stringify({
        version: 1,
        state: {
          channels: "invalid",
          inputs: { ch1: { kind: "bad", volume: 0 } },
          master: "loud",
        },
      }),
    ]) {
      expect(restoreSession(raw)).toEqual(createDefault());
    }
  });
  it("maps the continuous reverb knob to four regions with increasing local time", () => {
    expect(
      [0, 25, 50, 75, 100].map((value) => reverbProgram(value).name),
    ).toEqual(["HALL", "PLATE", "ROOM", "ECHO", "ECHO"]);
    expect(reverbProgram(24).amount).toBeGreaterThan(reverbProgram(5).amount);
    expect(reverbProgram(25).amount).toBe(0);
  });
});
