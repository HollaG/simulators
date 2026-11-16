import type { CSSProperties } from "react";
// Percentages measured against the unchanged supplied 500 × 500 rear-panel photo.
export const panel = { width: 500, height: 500 };
export const bounds = {
  screen: { x: 37.4, y: 33.0, w: 33.3, h: 18.0 },
  left: { x: 23.6, y: 54.8, w: 12.4, h: 12.6 },
  right: { x: 72.5, y: 54.8, w: 13.0, h: 12.6 },
  mode: { x: 45.5, y: 56.8, w: 8.9, h: 4.1 },
  menu: { x: 54.4, y: 56.8, w: 9.3, h: 4.1 },
  power: { x: 73.7, y: 76.1, w: 9.5, h: 6.5 },
};
export const position = (b: { x: number; y: number; w: number; h: number }): CSSProperties => ({ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` });
