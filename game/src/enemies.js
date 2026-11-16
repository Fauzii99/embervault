// The three enemy types and the boss: how each one moves, when it fires, how bodies push apart,
// the safe-box clamp, and what a kill is worth. Contact with the player is the player's business.

import { ARENA, BOSS_BULLET_SPEED, SCORE } from './config.js';
import { emitParticles, emitScorePopup, emitShockwave } from './effects.js';
import { clamp } from './geometry.js';
import { spawnEnemyBullet } from './bullets.js';
import { ENEMY, EVENTS, PHASE } from './state.js';

const TAU = Math.PI * 2;

export function spawnEnemy(state, kind) {
  if (kind === ENEMY.warden) {
    state.enemies.push({
      kind,
      x: ARENA.width / 2,
      y: 252,
      vx: 0,
      vy: 0,
      radius: 62,
      hp: 320,
      maxHp: 320,
      fireTimer: 1.5,
      flash: 0,
      angle: 0,
      spin: 1,
      phase: state.rng.angle(),
    });
    return;
  }
  const spot = edgePoint(state);
  const body = {
    kind,
    x: spot.x,
    y: spot.y,
    vx: 0,
    vy: 0,
    flash: 0,
    angle: state.rng.angle(),
    spin: state.rng.range(-1.1, 1.1),
  };
  if (kind === ENEMY.spitter) {
    state.enemies.push({
      ...body,
      radius: 22,
      hp: 4,
      maxHp: 4,
      fireTimer: state.rng.range(1.1, 2.2),
      drift: state.rng.range(0.6, 1.2),
    });
  } else if (kind === ENEMY.orbiter) {
    state.enemies.push({
      ...body,
      radius: 19,
      hp: 5,
      maxHp: 5,
      fireTimer: state.rng.range(1, 1.9),
      orbitDir: state.rng.chance(0.5) ? 1 : -1,
      orbitRadius: state.rng.range(210, 290),
    });
  } else {
    state.enemies.push({
      ...body,
      radius: 17,
      hp: 3,
      maxHp: 3,
      fireTimer: 0,
      charge: 0,
      dashSpeed: 540,
    });
  }
}

/** One arrival point on a random arena edge, inset from the corners. */
function edgePoint(state) {
  const inset = 110;
  const side = state.rng.int(0, 3);
  if (side === 0) return { x: state.rng.range(inset, ARENA.width - inset), y: 150 };
  if (side === 1) return { x: ARENA.width - inset, y: state.rng.range(180, ARENA.height - 170) };
  if (side === 2) return { x: state.rng.range(inset, ARENA.width - inset), y: ARENA.height - 170 };
  return { x: inset, y: state.rng.range(180, ARENA.height - 170) };
}

/** Run every body's behaviour one step. Callers keep separation and the clamp in this module. */
export function updateEnemies(state, dt) {
  for (const enemy of state.enemies) {
    enemy.flash = Math.max(0, enemy.flash - dt * 3);
    enemy.angle += enemy.spin * dt;
    if (enemy.kind === ENEMY.spitter) updateSpitter(state, enemy, dt);
    else if (enemy.kind === ENEMY.orbiter) updateOrbiter(state, enemy, dt);
    else if (enemy.kind === ENEMY.lancer) updateLancer(state, enemy, dt);
    else if (enemy.kind === ENEMY.warden) updateWarden(state, enemy, dt);
  }
}

/** Holds a preferred ring distance and takes single aimed shots. */
function updateSpitter(state, enemy, dt) {
  const { dx, dy, dist } = offsetToPlayer(state, enemy);
  const push = (dist - 330) * 0.7 * (enemy.drift ?? 1);
  enemy.x += (dx / dist) * push * dt;
  enemy.y += (dy / dist) * push * dt;
  enemy.fireTimer -= dt;
  if (enemy.fireTimer > 0) return;
  enemy.fireTimer = state.rng.range(1.5, 2.6) * (1 - Math.min(0.35, state.wave * 0.03));
  const aim = Math.atan2(dy, dx) + state.rng.range(-0.08, 0.08);
  spawnEnemyBullet(state, enemy.x, enemy.y, aim, 250);
}

/** Circles the player at a fixed radius and sprays a three-shot arc. */
function updateOrbiter(state, enemy, dt) {
  const player = state.player;
  const { dx, dy, dist } = offsetToPlayer(state, enemy);
  const bearing = Math.atan2(enemy.y - player.y, enemy.x - player.x) + enemy.orbitDir * dt * 0.9;
  const radius = enemy.orbitRadius ?? 250;
  enemy.x = player.x + Math.cos(bearing) * radius;
  enemy.y = player.y + Math.sin(bearing) * radius;
  enemy.fireTimer -= dt;
  if (enemy.fireTimer > 0) return;
  enemy.fireTimer = state.rng.range(1.6, 2.7) * (1 - Math.min(0.3, state.wave * 0.025));
  const base = Math.atan2(dy, dx);
  for (let i = -1; i <= 1; i += 1) spawnEnemyBullet(state, enemy.x, enemy.y, base + i * 0.22, 290);
}

/** A dart: charges in while near, coasts at a walk while far. */
function updateLancer(state, enemy, dt) {
  const { dx, dy, dist } = offsetToPlayer(state, enemy);
  enemy.charge -= dt;
  if (enemy.charge <= 0) {
    const dash = dist < 380;
    const speed = dash ? enemy.dashSpeed : 120;
    enemy.vx = (dx / dist) * speed;
    enemy.vy = (dy / dist) * speed;
    enemy.charge = dash ? 1.7 : 0.5;
  }
  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
  enemy.vx *= Math.exp(-1.5 * dt);
  enemy.vy *= Math.exp(-1.5 * dt);
}

/** The boss sweeps the top band and fires a rotating sixteen-shot ring. */
function updateWarden(state, enemy, dt) {
  enemy.x = ARENA.width / 2 + Math.sin(state.time * 0.55 + enemy.phase) * 300;
  enemy.y = 268 + Math.sin(state.time * 0.9) * 24;
  enemy.fireTimer -= dt;
  if (enemy.fireTimer > 0) return;
  enemy.fireTimer = 1.2;
  const spin = state.time * 0.9;
  for (let i = 0; i < 16; i += 1) {
    spawnEnemyBullet(state, enemy.x, enemy.y, spin + (i / 16) * TAU, BOSS_BULLET_SPEED, 9);
  }
}

function offsetToPlayer(state, enemy) {
  const player = state.player;
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;
  return { dx, dy, dist };
}

export function separateEnemies(state) {
  for (let i = 0; i < state.enemies.length; i += 1) {
    const a = state.enemies[i];
    for (let j = i + 1; j < state.enemies.length; j += 1) {
      const b = state.enemies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      const min = a.radius + b.radius + 4;
      if (dist >= min) continue;
      const push = (min - dist) * 0.5;
      const nx = dx / dist;
      const ny = dy / dist;
      if (a.kind !== ENEMY.warden) {
        a.x -= nx * push;
        a.y -= ny * push;
      }
      if (b.kind !== ENEMY.warden) {
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }
}

/**
 * Keep bodies inside the arena's safe box: clear of the HUD band above, the counters below,
 * and inset from the walls by their own radius. Runs after separation so pushes cannot strand them.
 */
export function clampEnemiesToArena(state) {
  for (const enemy of state.enemies) {
    const side = enemy.radius + 12;
    enemy.x = clamp(enemy.x, side, ARENA.width - side);
    enemy.y = clamp(enemy.y, 132, ARENA.height - 150);
  }
}

/** Apply damage, flash the body, and hand a dead one to the scoring path. */
export function damageEnemy(state, index, amount) {
  const enemy = state.enemies[index];
  enemy.hp -= amount;
  enemy.flash = 1;
  if (enemy.hp <= 0) destroyEnemy(state, index);
}

function destroyEnemy(state, index) {
  const enemy = state.enemies[index];
  state.enemies.splice(index, 1);
  const boss = enemy.kind === ENEMY.warden;
  const base = boss ? SCORE.bossKill : SCORE.kill;
  const multiplier = 1 + Math.min(state.combo, SCORE.comboCap) * 0.05;
  const points = Math.round(base * multiplier);
  state.score += points;
  state.combo += 1;
  state.comboTimer = SCORE.comboWindow;
  const color = boss ? '#ffb347' : '#ff2e88';
  emitShockwave(state, enemy.x, enemy.y, boss ? 360 : 92, color);
  emitParticles(state, enemy.x, enemy.y, boss ? 90 : 16, {
    speed: boss ? 520 : 270,
    life: boss ? 1.2 : 0.55,
    color,
    size: boss ? 6 : 3.4,
  });
  emitScorePopup(state, enemy.x, enemy.y - enemy.radius, `+${points}`, boss ? '#ffe6a8' : '#ffb347');
  state.shake = Math.min(1, state.shake + (boss ? 1 : 0.15));
  state.events.push({ type: EVENTS.kill, boss });
  if (boss) {
    state.phase = PHASE.won;
    state.outcome = 'victory';
    state.best = Math.max(state.best, state.score);
    state.shake = 1;
    state.events.push({ type: EVENTS.victory });
  }
}
