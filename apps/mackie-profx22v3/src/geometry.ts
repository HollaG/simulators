// Calibration uses the uncropped 3000×2111 photo. Pixel measurements below are
// expressed on its 1864×1312 reference preview and converted to percentages.
export const PANEL = {
  width: 3000,
  height: 2111,
  referenceWidth: 1864,
  referenceHeight: 1312,
};
export type Bounds = { x: number; y: number; w: number; h: number };
export const bounds = (x: number, y: number, w: number, h: number): Bounds => ({
  x: (x / 1864) * 100,
  y: (y / 1312) * 100,
  w: (w / 1864) * 100,
  h: (h / 1312) * 100,
});
export const channelX = [
  98, 180, 262, 344, 426, 508, 590, 672, 753, 835, 917, 999, 1081, 1162, 1244,
  1326, 1407, 1489,
];
export const knobBounds = (x: number, y: number) =>
  bounds(x - 21, y - 21, 42, 42);
export const switchBounds = (x: number, y: number) =>
  bounds(x - 11, y - 9, 22, 18);
export const faderBounds = (x: number) => bounds(x - 20, 1055, 40, 210);
export const channelKnobs = [
  { key: "gain", y: 357, label: "Gain", color: "white" },
  { key: "comp", y: 417, label: "Compressor", color: "white" },
  { key: "high", y: 485, label: "High EQ", color: "blue" },
  { key: "mid", y: 534, label: "Mid EQ", color: "blue" },
  { key: "freq", y: 583, label: "Mid frequency", color: "white" },
  { key: "low", y: 632, label: "Low EQ", color: "blue" },
  { key: "mon1", y: 698, label: "MON 1 send", color: "green" },
  { key: "mon2", y: 746, label: "MON 2 send", color: "green" },
  { key: "mon3", y: 797, label: "MON 3 send", color: "green" },
  { key: "fx", y: 879, label: "FX send", color: "yellow" },
  { key: "pan", y: 933, label: "Pan", color: "white" },
] as const;
