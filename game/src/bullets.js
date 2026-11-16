// Projectile bodies: hostile bullets and the released volley shards. Motion, trails, homing
// steering, culling, and the contact tests that decide what a shot touched.

import { ARENA, PLAYER, VOLLEY } from './config.js';
import { emitParticles } from './effects.js';
import { angleDelta, clamp } from './geometry.js';
import { damageEnemy } from './enemies.js';
import { damagePlayer } from './player.js';

const BULLET_LIFE = 9;
const CULL_MARGIN = 60;

export function spawnEnemyBullet(state, x, y, angle, speed, radius = 7) {
  state.bullets.push({
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    angle,
    radius,
    homing: false,
    damage: 1,
    life: BULLET_LIFE,
    maxLife: BULLET_LIFE,
    trail: null,
  });
}

/**
 * One reverse pass, oldest last, so a shot that lands is resolved before the shot behind it moves:
 * that order is what makes a volley chew through a cluster instead of all shards arriving at once.
 */
export function updateProjectiles(state, dt) {
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = state.bullets[i];
    bullet.life -= dt;
    if (bullet.homing) {
      steerHomingShard(state, bullet, dt);
      bullet.trail.push({ x: bullet.x, y: bullet.y });
      const keep = Math.max(3, Math.round(VOLLEY.trailSeconds / dt));
      while (bullet.trail.length > keep) bullet.trail.shift();
    } else {
      bullet.angle = Math.atan2(bullet.vy, bullet.vx);
    }
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;

    if (isSpentOutsideArena(bullet)) {
      cullProjectiles(state, i);
      continue;
    }
    const touched = bullet.homing ? hitBodyWith(state, bullet) : hitPlayerWith(state, bullet);
    if (touched) cullProjectiles(state, i);
  }
}

/** Remove one shot by index; the caller is walking the list backwards. */
function cullProjectiles(state, index) {
  state.bullets.splice(index, 1);
}

/** Spent by age, or gone past the arena by more than a body's width. */
function isSpentOutsideArena(bullet) {
  return (
    bullet.life <= 0 ||
    bullet.x < -CULL_MARGIN ||
    bullet.x > ARENA.width + CULL_MARGIN ||
    bullet.y < -CULL_MARGIN ||
    bullet.y > ARENA.height + CULL_MARGIN
  );
}

/** Home toward the nearest body, turning no faster than the volley allows. */
function steerHomingShard(state, bullet, dt) {
  let target = null;
  let bestDist = Infinity;
  for (const enemy of state.enemies) {
    const dist = Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y);
    if (dist < bestDist) {
      bestDist = dist;
      target = enemy;
    }
  }
  if (!target) return;
  const speed = Math.hypot(bullet.vx, bullet.vy);
  const current = Math.atan2(bullet.vy, bullet.vx);
  const desired = Math.atan2(target.y - bullet.y, target.x - bullet.x);
  const turn = clamp(angleDelta(current, desired), -VOLLEY.homingTurn * dt, VOLLEY.homingTurn * dt);
  bullet.vx = Math.cos(current + turn) * speed;
  bullet.vy = Math.sin(current + turn) * speed;
}

/** A volley shard damages the first body it overlaps. */
function hitBodyWith(state, bullet) {
  for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = state.enemies[i];
    if (Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y) > enemy.radius + bullet.radius) continue;
    emitParticles(state, bullet.x, bullet.y, 6, { speed: 210, life: 0.28, color: '#ffe6a8', size: 2.6 });
    damageEnemy(state, i, bullet.damage ?? 1);
    return true;
  }
  return false;
}

/** A hostile bullet is spent on contact unless the body is still invulnerable. */
function hitPlayerWith(state, bullet) {
  const player = state.player;
  if (player.invuln > 0) return false;
  if (Math.hypot(player.x - bullet.x, player.y - bullet.y) >= bullet.radius + PLAYER.radius) return false;
  damagePlayer(state);
  return true;
}
