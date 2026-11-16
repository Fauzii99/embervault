// The shared spine of the simulation: the state object and the phase/enemy/event vocabulary every
// other sim module reads. No DOM, no canvas, no audio.

import { ARENA, PLAYER } from './config.js';
import { makeRng } from './random.js';

export const PHASE = { title: 'title', playing: 'playing', dead: 'dead', won: 'won' };
export const ENEMY = { spitter: 'spitter', orbiter: 'orbiter', lancer: 'lancer', warden: 'warden' };
export const EVENTS = {
  absorb: 'absorb',
  volley: 'volley',
  kill: 'kill',
  hit: 'hit',
  waveClear: 'waveClear',
  death: 'death',
  victory: 'victory',
};

/** A fresh game parked on the title screen. */
export function createGame(seed = 1) {
  return {
    phase: PHASE.title,
    time: 0,
    score: 0,
    best: 0,
    lives: PLAYER.lives,
    wave: 1,
    waveTime: 0,
    waveBanner: 0,
    combo: 0,
    comboTimer: 0,
    vaultOpen: false,
    vaultArc: 0,
    vaultAngle: -Math.PI / 2,
    shards: [],
    bullets: [],
    enemies: [],
    particles: [],
    shockwaves: [],
    popups: [],
    player: {
      x: ARENA.width / 2,
      y: ARENA.height / 2,
      vx: 0,
      vy: 0,
      radius: PLAYER.radius,
      invuln: 0,
      hurtFlash: 0,
    },
    shake: 0,
    spawnQueue: [],
    hintTimer: 0,
    totalAbsorbed: 0,
    events: [],
    outcome: null,
    rng: makeRng(seed),
  };
}

/** Rebuild every field in place from a seeded game, so callers keep one reference. Only `best` survives. */
export function resetRunState(state, seed) {
  const best = state.best;
  const fresh = createGame(seed ?? Math.floor(Math.random() * 1e9));
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, fresh, { best });
}

/** Hand the loop the queued cues once, so each sound plays exactly once. */
export function drainEvents(state) {
  const events = state.events;
  state.events = [];
  return events;
}
