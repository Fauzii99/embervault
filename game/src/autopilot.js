// The screenshot autopilot: it may only do what a player can do — steer, hold the vault, release it.
// Everything here plays the real rules forward from a seeded state; no scene posing happens here.

import { ARENA, PLAYER, SHARD_CAP } from './config.js';
import { PHASE } from './state.js';
import { closeVaultAndFire, openVault } from './vault.js';
import { update } from './simulation.js';
import { steer } from './player.js';

const STEP = 1 / 120;
const CENTER = { x: ARENA.width / 2, y: ARENA.height / 2 };

/** The closest hostile shot and its distance, the pilot's first choice of target. */
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
  if (player.x < margin) dirX += ((margin - player.x) / margin) * 2.2;
  if (player.x > ARENA.width - margin) dirX -= ((player.x - (ARENA.width - margin)) / margin) * 2.2;
  if (player.y < margin) dirY += ((margin - player.y) / margin) * 2.2;
  if (player.y > ARENA.height - margin) dirY -= ((player.y - (ARENA.height - margin)) / margin) * 2.2;
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
export function pilotStep(state, posture) {
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
  advance(state);
}

/** Scene setup only: refill lives so a later pose is reachable. Not a rule the player ever gets. */
export function revive(state) {
  if (state.phase === PHASE.dead) {
    state.lives = PLAYER.lives;
    state.phase = PHASE.playing;
    state.outcome = null;
  } else if (state.lives < PLAYER.lives) {
    state.lives = PLAYER.lives;
  }
}

/** Play until the requested wave starts. */
export function reachWave(state, wave) {
  const deadline = Math.round(480 / STEP);
  for (let i = 0; i < deadline; i += 1) {
    if (state.wave >= wave || state.phase === PHASE.won) return;
    revive(state);
    pilotStep(state, 'survive');
  }
}

/**
 * Hold the vault and catch until the ring holds `wanted` shards. Holding alone kills nothing, so the
 * wave cannot advance underneath a scene that only wants to pose.
 */
export function fillRing(state, wanted, seconds) {
  const deadline = Math.round(seconds / STEP);
  for (let i = 0; i < deadline; i += 1) {
    if (state.shards.length >= wanted) return;
    revive(state);
    pilotStep(state, 'hold');
  }
}

/** Keep the vault open and the ring up while the frame settles. */
export function presentRing(state, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    revive(state);
    pilotStep(state, 'hold');
  }
}

/** Translation only: slide the whole scene so the player sits at the arena centre. */
export function recenter(state) {
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

/** One fixed step of the real simulation, pinned to the shot scene's rate. */
function advance(state) {
  update(state, STEP);
}
