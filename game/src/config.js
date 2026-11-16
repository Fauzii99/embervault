// EMBERVAULT — tuning constants and the palette. Every number the game balances on lives here, so
// the feel can be adjusted in one place without touching the simulation.

export const ARENA = { width: 1280, height: 720, margin: 46 };

// Violet dusk with amber fire and magenta hostiles. Nothing else is allowed on screen.
export const PALETTE = {
  void: '#150a24',
  voidDeep: '#0d0617',
  grid: '#2c1a4a',
  gridBright: '#3d2663',
  amber: '#ffb347',
  amberHot: '#ffe6a8',
  ember: '#ff7a29',
  magenta: '#ff2e88',
  magentaDeep: '#a3125c',
  violet: '#8b5cf6',
  core: '#fff4e2',
  ink: '#0a0410',
  white: '#fffaf2',
};

// The vault: the one mechanic. Open it to swallow fire, and it costs you your gun and your speed.
export const VAULT = {
  radius: 126,
  halfArc: (62 * Math.PI) / 180,
  openSpeedScale: 0.6,
  ringBase: 40,
  ringStep: 2.4,
  ringSpin: 2.2,
  absorbRadiusPad: 10,
};

export const SHARD_CAP = 16;

export const PLAYER = {
  radius: 15,
  speed: 320,
  accel: 2400,
  friction: 11,
  lives: 3,
  invulnSeconds: 1.5,
  fireCooldown: 0.14,
};

export const VOLLEY = {
  speed: 900,
  damage: 2,
  homingTurn: 9,
  trailSeconds: 0.22,
};

export const SCORE = {
  absorb: 10,
  kill: 150,
  bossKill: 4000,
  waveClear: 500,
  comboStep: 5,
  comboMax: 5,
};

export const WAVE_COUNT = 10;
export const BOSS_WAVE = 10;
export const TARGET_SCORE = 20000;

