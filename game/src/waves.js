// The wave roster: which bodies a wave holds, when each arrives, and when the next wave starts.
// The roster is shuffled from the spawn table so a wave's mix interleaves instead of clumping.

import { ARENA, BOSS_WAVE, SCORE, SPAWN_TABLE, WAVE_COUNT } from './config.js';
import { emitScorePopup, emitShockwave } from './effects.js';
import { spawnEnemy } from './enemies.js';
import { ENEMY, EVENTS } from './state.js';

const SPAWN_STAGGER = 0.55;

/** Begin `wave` on the state: banner, empty queue, and the roster queued with staggered arrivals. */
export function spawnWave(state, wave) {
  state.wave = wave;
  state.waveTime = 0;
  state.waveBanner = 1.9;
  state.spawnQueue = [];
  if (wave >= BOSS_WAVE) {
    state.spawnQueue.push({ at: 1.1, kind: ENEMY.warden });
    return;
  }
  queueWaveRoster(state, wave);
}

/** Push one entry per body, shuffled, each with its arrival time inside the wave. */
export function queueWaveRoster(state, wave) {
  const table = SPAWN_TABLE[wave] ?? SPAWN_TABLE[WAVE_COUNT - 1];
  const roster = [];
  for (const kind of Object.keys(table)) {
    for (let i = 0; i < table[kind]; i += 1) roster.push(kind);
  }
  for (let i = roster.length - 1; i > 0; i -= 1) {
    const j = state.rng.int(0, i);
    [roster[i], roster[j]] = [roster[j], roster[i]];
  }
  roster.forEach((kind, index) => {
    state.spawnQueue.push({ at: 0.3 + index * SPAWN_STAGGER, kind });
  });
}

/** Bodies whose arrival time has come leave the queue and enter the arena. */
export function releaseDueSpawns(state) {
  if (state.spawnQueue.length === 0) return;
  const due = [];
  const rest = [];
  for (const item of state.spawnQueue) {
    if (item.at <= state.waveTime) due.push(item);
    else rest.push(item);
  }
  if (due.length === 0) return;
  state.spawnQueue = rest;
  for (const item of due) spawnEnemy(state, item.kind);
}

/** Clear a wave only once its queue and its bodies are gone, and only while waves remain. */
export function advanceWaveIfCleared(state) {
  if (state.spawnQueue.length > 0) return;
  if (state.enemies.length > 0) return;
  if (state.waveBanner > 0.35) return;
  if (state.wave >= WAVE_COUNT) return;
  state.score += SCORE.waveClear;
  emitScorePopup(state, ARENA.width / 2, ARENA.height / 2 - 30, `WAVE CLEAR  +${SCORE.waveClear}`, '#ffe6a8');
  emitShockwave(state, ARENA.width / 2, ARENA.height / 2, 260, '#ffb347');
  state.events.push({ type: EVENTS.waveClear, wave: state.wave });
  spawnWave(state, state.wave + 1);
}
