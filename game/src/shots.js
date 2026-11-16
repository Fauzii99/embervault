// Deterministic screenshot scenes. Each one plays the real rules forward from a seeded world with a
// small autopilot that can only do what a player does — steer and hold or release the vault — then
// returns the resulting state. Lives are refilled between fast-forward segments so a scene can be
// reached; that is scene setup, not a rule change.

import { ARENA, PLAYER, SHARD_CAP, WAVE_COUNT } from './config.js';
import { ENEMY, PHASE, closeVaultAndFire, createGame, openVault, startRun, steer, update } from './world.js';

const STEP = 1 / 120;
const CENTER = { x: ARENA.width / 2, y: ARENA.height / 2 };

function nearestShot(state) {
  const player = state.player;
  let shot = null;
  let dist = Infinity;
  for (const bullet of state.bullets) {
    if (bullet.homing) continue;
    const d = Math.hypot(bullet.x - player.x, bullet.y - player.y);
    if (d < dist) {
      dist = d;
      shot = bullet;
    }
  }
  return { shot, dist };
}

function nearestEnemy(state) {
  const player = state.player;
  let enemy = null;
  let dist = Infinity;
  for (const body of state.enemies) {
    const d = Math.hypot(body.x - player.x, body.y - player.y);
    if (d < dist) {
      dist = d;
      enemy = body;
    }
  }
  return { enemy, dist };
}

/** Dodge shots and bodies, stay off the walls, drift toward the middle for a composed frame. */
function pilotSteer(state) {
  const player = state.player;
  let dirX = 0;
  let dirY = 0;

  for (const bullet of state.bullets) {
    if (bullet.homing) continue;
    const lead = 0.22;
    const px = bullet.x + bullet.vx * lead;
    const py = bullet.y + bullet.vy * lead;
    const dx = player.x - px;
    const dy = player.y - py;
    const d = Math.hypot(dx, dy) || 1;
    if (d > 210) continue;
    const weight = (1 - d / 210) ** 2 * 3.4;
    dirX += (dx / d) * weight;
    dirY += (dy / d) * weight;
  }

  for (const enemy of state.enemies) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const d = Math.hypot(dx, dy) || 1;
    const danger = enemy.radius + 150;
    if (d > danger) continue;
    const weight = (1 - d / danger) ** 2 * 3.8;
    dirX += (dx / d) * weight;
    dirY += (dy / d) * weight;
  }

  const margin = 170;
  if (player.x < margin) dirX += (margin - player.x) / margin * 2.2;
  if (player.x > ARENA.width - margin) dirX -= (player.x - (ARENA.width - margin)) / margin * 2.2;
  if (player.y < margin) dirY += (margin - player.y) / margin * 2.2;
  if (player.y > ARENA.height - margin) dirY -= (player.y - (ARENA.height - margin)) / margin * 2.2;
  dirX += (CENTER.x - player.x) * 0.006;
  dirY += (CENTER.y - player.y) * 0.006;

  const length = Math.hypot(dirX, dirY);
  if (length < 1e-5) steer(state, 0, 0, STEP);
  else steer(state, dirX / length, dirY / length, STEP);
}

/** Point the vault at the nearest shot, else the nearest body, exactly as a mouse would. */
function pilotAim(state) {
  const player = state.player;
  const { shot } = nearestShot(state);
  const { enemy } = nearestEnemy(state);
  const target = shot ?? enemy;
  if (!target) return;
  const aim = Math.atan2(target.y - player.y, target.x - player.x);
  let delta = (aim - state.vaultAngle) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  state.vaultAngle += delta * 0.45;
}

/** One simulated step of the pilot's play, in one of three postures. */
function pilotStep(state, posture) {
  pilotSteer(state);
  pilotAim(state);
  const { dist } = nearestShot(state);
  const ring = state.shards.length;
  let wantOpen = state.vaultOpen;

  if (posture === 'hold') {
    wantOpen = true;
  } else if (posture === 'build') {
    wantOpen = dist < 250 && ring < SHARD_CAP;
  } else if (ring >= SHARD_CAP) {
    wantOpen = false;
  } else if (ring >= 4 && dist > 240) {
    wantOpen = false;
  } else if (ring >= 9 && dist > 150) {
    wantOpen = false;
  } else if (dist < 240) {
    wantOpen = true;
  }

  if (wantOpen && !state.vaultOpen) openVault(state);
  else if (!wantOpen && state.vaultOpen) closeVaultAndFire(state);
  update(state, STEP);
}

function revive(state) {
  if (state.phase === PHASE.dead) {
    state.lives = PLAYER.lives;
    state.phase = PHASE.playing;
    state.outcome = null;
  } else if (state.lives < PLAYER.lives) {
    state.lives = PLAYER.lives;
  }
}

/** Play until the requested wave starts. */
function reachWave(state, wave) {
  const deadline = Math.round(480 / STEP);
  for (let i = 0; i < deadline; i += 1) {
    if (state.wave >= wave || state.phase === PHASE.won) return;
    revive(state);
    pilotStep(state, 'survive');
  }
}

/** Hold the vault and catch until the ring holds `wanted` shards. Holding alone kills nothing, so
 *  the wave cannot advance underneath a scene that only wants to pose. */
function fillRing(state, wanted, seconds) {
  const deadline = Math.round(seconds / STEP);
  for (let i = 0; i < deadline; i += 1) {
    if (state.shards.length >= wanted) return;
    revive(state);
    pilotStep(state, 'hold');
  }
}

/** Keep the vault open and the ring up while the frame settles. */
function presentRing(state, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    revive(state);
    pilotStep(state, 'hold');
  }
}

/** Translation only: slide the whole scene so the player sits at the arena centre. */
function recenter(state) {
  const dx = CENTER.x - state.player.x;
  const dy = CENTER.y - state.player.y;
  const shift = (item) => {
    item.x += dx;
    item.y += dy;
    if (item.trail) {
      for (const point of item.trail) {
        point.x += dx;
        point.y += dy;
      }
    }
  };
  shift(state.player);
  for (const list of [state.bullets, state.enemies, state.particles, state.shockwaves, state.popups]) {
    for (const item of list) shift(item);
  }
}

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

export function buildShot(name, seed = 1) {
  const state = createGame(seed);
  startRun(state, seed);

  if (name === 'title') {
    // Capture a genuine mid-wave moment with bodies and fire on screen, then drop the title over it.
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

  if (name === 'play') {
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

  if (name === 'peak') {
    reachWave(state, WAVE_COUNT);
    state.lives = PLAYER.lives;
    // Wait for the Warden's first rings, then catch them until the ring is full.
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

  if (name === 'over') {
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

  if (name === 'win') {
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

  return { state, view: 'play' };
}
