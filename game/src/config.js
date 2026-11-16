// Every number a designer might touch lives here: arena, vault geometry, player feel, volley
// ballistics, scoring, and the wave roster. Modules import these instead of hardcoding.
// The colour table is the one exception: it lives in palette.js beside its helper.

export const ARENA = { width: 1280, height: 720, margin: 46 };

export const VAULT = {
  radius: 126,
  halfArc: (62 * Math.PI) / 180,
  absorbPad: 10,
  openSpeedScale: 0.6,
  ringRadius: 86,
  openEase: 14,
};

export const PLAYER = {
  radius: 15,
  speed: 320,
  accel: 2400,
  friction: 11,
  lives: 3,
  invulnSeconds: 1.5,
  hurtDecay: 2.4,
};

export const VOLLEY = {
  speed: 900,
  spread: 0.13,
  damage: 2,
  life: 3.2,
  homingTurn: 9,
  trailSeconds: 0.16,
  radius: 6,
};

export const SCORE = {
  absorb: 10,
  kill: 150,
  bossKill: 4000,
  waveClear: 500,
  comboWindow: 2.6,
  comboCap: 40,
};

export const SHARD_CAP = 16;
export const WAVE_COUNT = 10;
export const BOSS_WAVE = 10;
export const BOSS_BULLET_SPEED = 205;

// Counts per wave, 1..9. Wave 10 is the Warden alone.
export const SPAWN_TABLE = {
  1: { spitter: 3 },
  2: { spitter: 3, lancer: 1 },
  3: { spitter: 3, orbiter: 2 },
  4: { spitter: 4, orbiter: 2, lancer: 1 },
  5: { spitter: 4, orbiter: 3, lancer: 2 },
  6: { spitter: 5, orbiter: 3, lancer: 3 },
  7: { spitter: 5, orbiter: 4, lancer: 4 },
  8: { spitter: 6, orbiter: 5, lancer: 5 },
  9: { spitter: 7, orbiter: 7, lancer: 7 },
};
