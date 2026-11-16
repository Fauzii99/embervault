// Deterministic screenshot scenes. Each one runs the autopilot forward from a seeded world, then poses
// only what a scene needs (score floors, a banner, an end card). The rules are never touched: the
// posing here is composition, and the autopilot can only steer and work the vault.

import { ARENA, PLAYER, SHARD_CAP, WAVE_COUNT } from './config.js';
import { createGame, ENEMY, PHASE } from './state.js';
import {
  fillRing,
  pilotStep,
  presentRing,
  reachWave,
  recenter,
  revive,
} from './autopilot.js';
import { startRun } from './simulation.js';

const STEP = 1 / 120;
const CENTER = { x: ARENA.width / 2, y: ARENA.height / 2 };

/** Bodies must stay inside the safe box after the slide, or a shifted body clips the HUD band. */
function clampBodies(state) {
  for (const enemy of state.enemies) {
    // The Warden's floor keeps its 300 px health bar and label out of the top HUD band.
    const floor = enemy.kind === ENEMY.warden ? 262 : 132;
    const side = enemy.radius + 12;
    enemy.x = Math.min(Math.max(enemy.x, side), ARENA.width - side);
    enemy.y = Math.min(Math.max(enemy.y, floor), ARENA.height - 150);
    // Keep bodies off the hint pill's band so no silhouette sits on the teaching line.
    if (enemy.y > 552 && enemy.y < 646) enemy.y = enemy.y < 599 ? 552 : 646;
  }
}

/** Shots that drifted into a HUD band are dropped so a frozen frame never puts fire on a label. */
function clearHudBands(state) {
  state.bullets = state.bullets.filter((bullet) => bullet.y > 152 && bullet.y < ARENA.height - 132);
}

function settleHud(state, floorScore, combo) {
  state.score = Math.max(state.score, floorScore);
  state.combo = combo;
  state.comboTimer = 2.6;
  state.best = Math.max(state.best, state.score);
  state.shake = 0;
  state.waveBanner = 0;
  state.hintTimer = 5;
}

/** The title card over a genuine mid-wave moment, so the card is never a flat backdrop. */
function poseTitle(state) {
  const deadline = Math.round(60 / STEP);
  for (let i = 0; i < deadline; i += 1) {
    revive(state);
    pilotStep(state, 'build');
    if (state.wave >= 4 && state.enemies.length >= 6 && state.bullets.length >= 5 && state.shards.length >= 6) break;
  }
  clearHudBands(state);
  state.shards = state.shards.slice(0, 5);
  state.vaultOpen = false;
  state.vaultArc = 0;
  state.hintTimer = 0;
  state.waveBanner = 0;
  state.phase = PHASE.title;
  state.combo = Math.min(12, Math.max(state.combo, 9));
  state.comboTimer = 2.6;
  state.score = Math.max(state.score, 5860);
  state.best = Math.max(state.best, state.score + 6180);
  state.bullets = state.bullets.filter((bullet) => !bullet.homing);
  state.shake = 0;
  return { state, view: 'title' };
}

/** Mid-action with a near-full ring and the vault arc open. */
function posePlay(state) {
  reachWave(state, 4);
  fillRing(state, 12, 30);
  presentRing(state, 0.5);
  state.shards = state.shards.slice(0, 12);
  settleHud(state, 7420, 11);
  clearHudBands(state);
  recenter(state);
  clampBodies(state);
  return { state, view: 'play' };
}

/** The cover: the full 16-shard ring with the Warden off-centre so its arc and bar both read. */
function posePeak(state) {
  reachWave(state, WAVE_COUNT);
  state.lives = PLAYER.lives;
  let held = 0;
  const wardenOffset = () => {
    const boss = state.enemies.find((enemy) => enemy.kind === ENEMY.warden);
    return boss ? Math.abs(boss.x - CENTER.x) : 0;
  };
  while (held < 26 && !(state.shards.length >= SHARD_CAP && state.bullets.length >= 6 && wardenOffset() > 210)) {
    revive(state);
    pilotStep(state, 'hold');
    held += STEP;
  }
  presentRing(state, 0.45);
  state.shards = state.shards.slice(0, SHARD_CAP);
  settleHud(state, 41280, 27);
  state.shake = 0.18;
  clearHudBands(state);
  recenter(state);
  clampBodies(state);
  return { state, view: 'peak' };
}

/** The defeat card with the restart line. */
function poseOver(state) {
  reachWave(state, 6);
  fillRing(state, 9, 25);
  state.shards = state.shards.slice(0, 9);
  state.score = Math.max(state.score, 15960);
  state.best = Math.max(state.best, state.score + 2480);
  state.combo = Math.max(state.combo, 7);
  state.lives = 0;
  state.phase = PHASE.dead;
  state.outcome = 'defeat';
  state.vaultOpen = false;
  state.vaultArc = 0;
  state.hintTimer = 0;
  state.waveBanner = 0;
  state.shake = 0;
  return { state, view: 'over' };
}

/** The victory card, arena cleared. */
function poseWin(state) {
  reachWave(state, WAVE_COUNT);
  state.enemies = [];
  state.bullets = [];
  state.spawnQueue = [];
  state.shards = [];
  state.vaultOpen = false;
  state.vaultArc = 0;
  state.score = Math.max(state.score, 58340);
  state.lives = 1;
  state.phase = PHASE.won;
  state.outcome = 'victory';
  state.best = Math.max(state.best, state.score);
  state.shake = 0;
  state.waveBanner = 0;
  state.hintTimer = 0;
  return { state, view: 'win' };
}

export function buildShot(name, seed = 1) {
  const state = createGame(seed);
  startRun(state, seed);
  if (name === 'title') return poseTitle(state);
  if (name === 'play') return posePlay(state);
  if (name === 'peak') return posePeak(state);
  if (name === 'over') return poseOver(state);
  if (name === 'win') return poseWin(state);
  return { state, view: 'play' };
}
