// The colour values and one helper for painting them at partial alpha. Amber and white belong to
// the player and the HUD, magenta to enemies, violet to the arena frame.

export const PALETTE = {
  void: '#150a24',
  deep: '#0d0617',
  grid: '#2c1a4a',
  amber: '#ffb347',
  amberHot: '#ffe6a8',
  ember: '#ff7a29',
  magenta: '#ff2e88',
  violet: '#8b5cf6',
  core: '#fff4e2',
  white: '#fffaf2',
};

/** `#rrggbb` plus an alpha, as the canvas wants it. */
export function withAlpha(hex, alpha) {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
