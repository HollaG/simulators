import { describe, expect, it } from "vitest";
import {
  defaults,
  elapsed,
  initialState,
  loadConfig,
  reducer,
  type Action,
  type State,
} from "../src/state";
import { floatWav, recordedFiles } from "../src/audio";

const on = () => reducer(initialState(), { type: "POWER", now: 0 });
const action = (s: State, type: Action["type"], now = 0, extra = {}) =>
  reducer(s, { type, now, ...extra } as Action);
const record = () => action(on(), "REC", 1000);
const saved = (s = record()) => {
  s = action(s, "STOP", 6000);
  return action(s, "SAVED", 6000, { id: s.pending!.id });
};

describe("recording contract", () => {
  it("requires power and armed tracks", () => {
    expect(action(initialState(), "REC").mode).toBe("idle");
    const s = action(on(), "TRACK", 0, { index: 0 });
    expect(action(s, "REC").message).toContain("Arm at least");
  });
  it("HOLD blocks transport while recording time advances, then unlock permits stop", () => {
    let s = action(record(), "HOLD", 2000);
    s = action(s, "STOP", 4000);
    expect(s.mode).toBe("recording");
    expect(elapsed(s, 5000)).toBe(4);
    s = action(s, "HOLD", 5000);
    s = action(s, "STOP", 6000);
    expect(s.pending!.duration).toBe(5);
  });
  it("refuses shutdown while recording and saving, and ignores stale save completion", () => {
    let s = action(record(), "POWER", 2000);
    expect(s.power).toBe(true);
    expect(s.mode).toBe("recording");
    s = action(s, "REC", 3000);
    expect(action(s, "POWER", 3500).mode).toBe("saving");
    expect(action(s, "SAVED", 4000, { id: 999 })).toEqual(s);
    s = action(s, "SAVED", 4000, { id: s.pending!.id });
    expect(s.takes).toHaveLength(1);
    expect(action(s, "SAVED", 4000, { id: 1 }).takes).toHaveLength(1);
  });
  it("records mixer changes with timestamps, while keeping input selection fixed", () => {
    let s = action(record(), "MIXER", 1500);
    s = action(s, "ENTER", 1500);
    s = action(s, "DIAL", 2000, { value: -1 });
    expect(s.draft!.events.at(-1)).toEqual({
      time: 1,
      gains: [-1, 0, 0, 0, 0],
    });
    expect(s.draft!.config.inputs[0].gain).toBe(0);
    expect(action(s, "TRACK", 3000, { index: 1 }).config.inputs[1].armed).toBe(
      false,
    );
  });
  it("limits marks to 99 and finalizes at the practice duration even in HOLD", () => {
    let s = record();
    for (let i = 0; i < 102; i++) s = action(s, "ENTER", 1100 + i * 100);
    expect(s.draft!.marks).toHaveLength(99);
    s = action(s, "HOLD", 20000);
    s = action(s, "TICK", 99000);
    expect(s.pending!.duration).toBe(60);
  });
  it("trash cancel keeps recording; execute finalizes a hidden take", () => {
    let s = action(record(), "DIAL", 2000, { value: 1 });
    s = action(s, "DIAL", 2000, { value: 1 });
    s = action(s, "ENTER", 2000);
    expect(s.screen).toBe("trash");
    s = action(s, "ENTER", 3000);
    expect(s.mode).toBe("recording");
    s = { ...s, screen: "trash", cursor: 1 };
    s = action(s, "ENTER", 4000);
    expect(s.pending!.trashed).toBe(true);
  });
});

describe("playback, settings and files", () => {
  it("plays actual take duration, seeks marks, pauses without advancing, and stops home", () => {
    let s = action(record(), "ENTER", 3000);
    s = saved(s);
    s = action(s, "PLAY", 7000);
    s = action(s, "SKIP", 7100, { value: 1 });
    expect(s.position).toBe(2);
    s = action(s, "PLAY", 8100);
    expect(s.position).toBe(3);
    expect(elapsed(s, 12000)).toBe(3);
    s = action(s, "STOP", 12000);
    expect(s.screen).toBe("home");
    expect(s.mode).toBe("idle");
  });
  it("linked arm buttons affect both channels and omit unavailable playback tracks", () => {
    let s = on();
    s.config.links[0] = true;
    s = action(s, "TRACK", 0, { index: 2 });
    expect(s.config.inputs.slice(1, 3).every((i) => i.armed)).toBe(true);
    s = action(s, "TRACK", 0, { index: 1 });
    expect(s.config.inputs.slice(1, 3).every((i) => !i.armed)).toBe(true);
  });
  it("keeps playback mixer adjustments separate from recording gains", () => {
    let s = saved();
    s = action(s, "PLAY", 7000);
    s = action(s, "MIXER", 7000);
    s = action(s, "ENTER", 7000);
    s = action(s, "DIAL", 7100, { value: -1 });
    expect(s.playGains[0]).toBe(-1);
    expect(s.config.inputs[0].gain).toBe(0);
  });
  it("exports stereo MIC, linked pairs, and no automatic LR file at 96 kHz", () => {
    const t = saved().takes[0];
    t.config.inputs[1].armed = t.config.inputs[2].armed = true;
    t.config.links[0] = true;
    expect(recordedFiles(t).map((f) => f.name)).toEqual([
      "MicLR",
      "Tr12",
      "LR",
    ]);
    t.config.rate = 96000;
    expect(recordedFiles(t).map((f) => f.name)).toEqual(["MicLR", "Tr12"]);
    t.config.mono = true;
    expect(recordedFiles(t)[0].channels).toEqual([0]);
  });
  it("rejects invalid or future saved settings instead of trusting parsed JSON", () => {
    expect(loadConfig('{"version":1,"config":{}}')).toEqual(defaults());
    const config = defaults();
    config.inputs[1].phantom = true;
    expect(loadConfig(JSON.stringify({ version: 1, config }))).toEqual(config);
    expect(loadConfig(JSON.stringify({ version: 2, config }))).toEqual(
      defaults(),
    );
    config.inputs[0].gain = Infinity;
    expect(loadConfig(JSON.stringify({ version: 1, config }))).toEqual(
      defaults(),
    );
  });
  it("writes IEEE float WAV without clipping samples above full scale", () => {
    const buffer = {
      length: 2,
      sampleRate: 96000,
      getChannelData: () => new Float32Array([2, -1.5]),
    } as unknown as AudioBuffer;
    const data = new DataView(floatWav(buffer, [0]));
    expect(data.getUint16(20, true)).toBe(3);
    expect(data.getUint16(34, true)).toBe(32);
    expect(data.getUint32(24, true)).toBe(96000);
    expect(data.getFloat32(56, true)).toBe(2);
    expect(data.getFloat32(60, true)).toBe(-1.5);
  });
});
