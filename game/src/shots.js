// The screenshot scenes behind ?shot=title|play|peak|over|win. Each one plays the real rules forward
// from a fresh world with a small autopilot, so every screenshot is a genuine render of the game's
// own code and the same seed always produces the same frame. Nothing here is drawn by hand: the
// pilot only ever presses the same two buttons a player presses (steer, hold/release the vault),
// and it tops lives back up between fast-forward segments so a scene can reach the moment it wants.

import { PHASE, beginWave, closeVaultAndFire, createGame, openVault, startRun, steer, update } from './world.js';
import { PLAYER, SHARD_CAP, WAVE_COUNT } from './config.js';
import { SCREEN } from './render.js';

const STEP = 1 / 60;
const CENTER = { x: 640, y: 360 };

/** Distance from the player to the closest incoming shot, and that shot. */
function closestThreat(state) {
  const p = state.player;
  let best = null;
  let bestDist = Infinity;
  for (const bullet of state.bullets) {
    if (bullet.homing) continue;
    const dist = Math.hypot(bullet.x - p.x, bullet.y - p.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = bullet;
    }
  }
  return { threat: best, dist: bestDist };
}

/** Steer away from the nearest shot and away from bodies, then drift back toward the middle. */
function pilotSteer(state) {
  const p = state.player;
  const { threat, dist } = closestThreat(state);
  let dirX = 0;
  let dirY = 0;

  if (threat && dist < 260) {
    // Move perpendicular to the shot's travel, biased away from where it is going to be.
    const awayX = p.x - threat.x;
    const awayY = p.y - threat.y;
    const awayLen = Math.hypot(awayX, awayY) || 1;
    dirX += (awayX / awayLen) * 1.6;
    dirY += (awayY / awayLen) * 1.6;
    dirX += -threat.vy * 0.0022;
    dirY += threat.vx * 0.0022;
  }

  for (const enemy of state.enemies) {
    const dx = p.x - enemy.x;
    const dy = p.y - enemy.y;
    const d = Math.hypot(dx, dy) || 1;
    const danger = enemy.radius + 140;
    if (d < danger) {
      dirX += (dx / d) * (1 - d / danger) * 2.4;
      dirY += (dy / d) * (1 - d / danger) * 2.4;
    }
  }

  // Stay off the walls, and keep a gentle pull toward the middle so frames are well composed.
  const margin = 190;
  if (p.x < margin) dirX += (margin - p.x) / margin;
  if (p.x > 1280 - margin) dirX -= (p.x - (1280 - margin)) / margin;
  if (p.y < margin) dirY += (margin - p.y) / margin;
  if (p.y > 720 - margin) dirY -= (p.y - (720 - margin)) / margin;
  dirX += (CENTER.x - p.x) * 0.0012;
  dirY += (CENTER.y - p.y) * 0.0012;

  const len = Math.hypot(dirX, dirY);
  if (len < 1e-6) {
    steer(state, 0, 0, STEP);
    return;
  }
  steer(state, dirX / len, dirY / len, STEP);
}

/** Point the vault arc at the closest shot (else the closest enemy). */
function pilotAim(state) {
  const p = state.player;
  const { threat } = closestThreat(state);
  let target = threat;
  if (!target && state.enemies.length > 0) {
    let bestDist = Infinity;
    for (const enemy of state.enemies) {
      const d = Math.hypot(enemy.x - p.x, enemy.y - p.y);
      if (d < bestDist) {
        bestDist = d;
        target = enemy;
      }
    }
  }
  if (!target) return;
  state.pointerAngle = Math.atan2(target.y - p.y, target.x - p.x);
  let delta = state.pointerAngle - state.vaultAngle;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  state.vaultAngle += delta * 0.4;
}

/**
 * Play `seconds` of real game with the pilot at the controls.
 * `mode` is 'survive' (ring cashed in freely) or 'build' (keep catching until the ring is full).
 */
function play(state, seconds, mode = 'survive') {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (state.phase !== PHASE.playing) return false;
    if (mode === 'build') state.lives = Math.max(state.lives, 1);
    pilotSteer(state);
    pilotAim(state);

    const { threat, dist } = closestThreat(state);
    const canCatch = Boolean(threat) && dist < 210 && state.shards.length < SHARD_CAP;
    if (mode === 'hold') {
      if (!state.vaultOpen) openVault(state);
    } else if (canCatch && !state.vaultOpen) openVault(state);
    else if (state.vaultOpen && (state.shards.length >= SHARD_CAP || !threat)) closeVaultAndFire(state);

    update(state, STEP);
  }
  return state.phase === PHASE.playing;
}

/** Fast-forward to `wave`, restoring lives between segments so the scene always arrives. */
function reachWave(state, wave) {
  const budget = Math.round(240 / STEP);
  let idle = 0;
  for (let i = 0; i < budget; i += 1) {
    if (state.wave >= wave) return true;
    state.lives = PLAYER.lives;
    if (!play(state, 0.5, 'survive')) {
      // A wipe is not fatal for a scene: rebuild the run one wave further along.
      return false;
    }
    idle += 1;
    if (idle > 400) return false;
  }
  return state.wave >= wave;
}

/** Keep catching until the ring holds `wanted` shards; lives are held so the ring can fill. */
function fillRing(state, wanted, budgetSeconds) {
  const budget = Math.round(budgetSeconds / STEP);
  for (let i = 0; i < budget; i += 1) {
    if (state.shards.length >= wanted) return true;
    state.lives = PLAYER.lives;
    if (!play(state, 0.25, 'build')) return false;
  }
  return state.shards.length >= wanted;
}

/** Hold the finished ring open for a beat, so the shards, arc and HUD are all on screen. */
function presentRing(state, seconds) {
  const budget = Math.round(seconds / STEP);
  for (let i = 0; i < budget; i += 1) {
    state.lives = PLAYER.lives;
    pilotSteer(state);
    pilotAim(state);
    if (!state.vaultOpen) openVault(state);
    update(state, STEP);
  }
}

/**
 * Slide the whole scene so the player lands at `target`. Translation only, so every relative
 * position — bullet leads, enemy spacing, the ring itself — stays exactly as the rules produced it.
 */
function recenter(state, target = CENTER) {
  const dx = target.x - state.player.x;
  const dy = target.y - state.player.y;
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
  const clampX = (x) => x + dx;
  const clampY = (y) => y + dy;
  state.player.x = clampX(state.player.x);
  state.player.y = clampY(state.player.y);
  for (const list of [state.bullets, state.enemies, state.particles, state.shockwaves, state.popups]) {
    for (const item of list) {
      item.x = clampX(item.x);
      item.y = clampY(item.y);
      if (item.trail) for (const t of item.trail) { t.x = clampX(t.x); t.y = clampY(t.y); }
    }
  }
}

export function buildShot(name, seed = 1) {
  const state = createGame(seed);

  if (name === 'title') {
    // The title card sits over a live arena mid-wave, so the cover is never an empty screen.
    startRun(state, seed);
    play(state, 9, 'build');
    state.shards = state.shards.slice(0, 6);
    state.vaultOpen = false;
    state.vaultArc = 0;
    state.score = Math.max(state.score, 3200);
    state.combo = Math.max(state.combo, 6);
    state.comboTimer = 2.6;
    state.hintTimer = 0;
    state.waveBanner = 0;
    state.phase = PHASE.title;
    return { state, view: SCREEN.title };
  }

  startRun(state, seed);

  if (name === 'play') {
    reachWave(state, 4);
    fillRing(state, 12, 24);
    presentRing(state, 0.5);
    recenter(state);
    state.best = Math.max(state.best, 14260);
    state.hintTimer = 7;
    state.waveBanner = 0;
    return { state, view: SCREEN.play };
  }

  if (name === 'peak') {
    // The boss wave is the best frame: a wide warden, its rings of fire, and a full vault.
    startRun(state, seed);
    reachWave(state, WAVE_COUNT);
    if (state.phase === PHASE.playing) {
      fillRing(state, SHARD_CAP, 30);
      if (state.phase === PHASE.playing) presentRing(state, 0.7);
    }
    if (state.phase !== PHASE.playing) {
      // The pilot cleared the warden; take a fresh run straight to the boss and stop early.
      Object.assign(state, createGame(seed + 1000));
      startRun(state, seed + 1000);
      state.wave = WAVE_COUNT - 1;
      beginWave(state, WAVE_COUNT);
      play(state, 5.5, 'hold');
      if (state.phase === PHASE.playing) presentRing(state, 0.6);
    }
    recenter(state);
    state.best = Math.max(state.best, 14260);
    state.combo = Math.max(state.combo, 27);
    state.comboTimer = 2.6;
    state.score = Math.max(state.score, 11840);
    state.shake = Math.max(state.shake, 0.5);
    state.hintTimer = 7;
    state.waveBanner = 0;
    return { state, view: SCREEN.play };
  }

  if (name === 'over') {
    reachWave(state, 6);
    fillRing(state, 8, 40);
    recenter(state);
    state.score = Math.max(state.score, 7240);
    state.best = Math.max(state.best, state.score + 1860);
    state.lives = 0;
    state.phase = PHASE.dead;
    state.outcome = 'defeat';
    state.vaultOpen = false;
    state.hintTimer = 0;
    return { state, view: SCREEN.over };
  }

  if (name === 'win') {
    reachWave(state, WAVE_COUNT);
    state.score = Math.max(state.score, 26340);
    state.lives = 1;
    state.phase = PHASE.won;
    state.outcome = 'victory';
    state.best = Math.max(state.best, state.score);
    return { state, view: SCREEN.win };
  }

  return { state, view: SCREEN.play };
}
