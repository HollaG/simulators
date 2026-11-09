import type { CSSProperties } from "react";
import type { InputId } from "./state";
export const PANEL = { width: 1155, height: 1344 };
export type Bounds = { x: number; y: number; w: number; h: number };
// Original photo centres, mapped into the crop at (165, 78), 1155 × 1344.
export const rect = (x: number, y: number, w: number, h: number): Bounds => ({
  x: ((x - 165 - w / 2) / PANEL.width) * 100,
  y: ((y - 78 - h / 2) / PANEL.height) * 100,
  w: (w / PANEL.width) * 100,
  h: (h / PANEL.height) * 100,
});
export const position = (b: Bounds): CSSProperties => ({
  left: `${b.x}%`,
  top: `${b.y}%`,
  width: `${b.w}%`,
  height: `${b.h}%`,
});
export const channelX = [268, 384, 501, 617, 728, 837, 947];
export const rowY = {
  gain: 558,
  comp: 679,
  high: 812,
  mid: 898,
  low: 983,
  fx: 1070,
  pan: 1155,
  level: 1276,
};
export const jacks: { id: InputId; bounds: Bounds }[] = [
  ...(["ch1", "ch2", "ch3", "ch4"] as InputId[]).map((id, i) => ({
    id,
    bounds: rect(channelX[i], 258, 96, 100),
  })),
  { id: "phone56", bounds: rect(727, 347, 65, 150) },
  { id: "rca56", bounds: rect(752, 593, 58, 115) },
  { id: "phone78", bounds: rect(812, 347, 65, 150) },
  { id: "rca78", bounds: rect(816, 593, 58, 115) },
  { id: "line910", bounds: rect(898, 347, 65, 150) },
];
