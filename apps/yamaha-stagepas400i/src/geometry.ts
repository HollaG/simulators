import type { CSSProperties } from "react";
import type { InputId } from "./state";

export const PANEL = { width: 2430, height: 1380 };
export type Bounds = { x: number; y: number; w: number; h: number };
// Measurements use a 2048 × 1163 preview of the exact 2430 × 1380 crop.
export const rect = (x: number, y: number, w: number, h: number): Bounds => ({
  x: ((x - w / 2) / 2048) * 100,
  y: ((y - h / 2) / 1163) * 100,
  w: (w / 2048) * 100,
  h: (h / 1163) * 100,
});
export const position = (bounds: Bounds): CSSProperties => ({
  left: `${bounds.x}%`,
  top: `${bounds.y}%`,
  width: `${bounds.w}%`,
  height: `${bounds.h}%`,
});
export const channelX = [345, 504, 663, 822, 994, 1158];
export const knobBounds = (
  channel: number,
  row: "high" | "low" | "reverb" | "level",
) =>
  rect(
    channelX[channel],
    { high: 540, low: 658, reverb: 779, level: 916 }[row],
    79,
    79,
  );
export const jacks: { id: InputId; bounds: Bounds; plugY?: number[] }[] = [
  ...(["ch1", "ch2", "ch3", "ch4"] as InputId[]).map((id, i) => ({
    id,
    bounds: rect(channelX[i], 226, 113, 115),
  })),
  { id: "phone56", bounds: rect(957, 263, 88, 220), plugY: [23, 81] },
  { id: "rca56", bounds: rect(1058, 269, 80, 195), plugY: [24, 71] },
  { id: "phone78", bounds: rect(1171, 263, 85, 220), plugY: [23, 81] },
  { id: "mini78", bounds: rect(1149, 445, 44, 44) },
  { id: "usb78", bounds: rect(1635, 469, 56, 100) },
];
