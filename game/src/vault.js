// The vault and the shard ring: the whole game. It opens, swallows a bullet into the ring up to the
// 16 cap, releases the ring as one homing fan, and knows the ring's geometry.

import { SCORE, SHARD_CAP, VAULT, VOLLEY } from './config.js';
import { PALETTE } from './palette.js';
import { emitParticles, emitShockwave } from './effects.js';
import { angleDelta } from './geometry.js';
import { EVENTS, PHASE } from './state.js';

export function openVault(state) {
  if (state.phase !== PHASE.playing) return;
  state.vaultOpen = true;
}

/** Release: the ring leaves as one fan, every shard homing, then the ring is empty. */
export function closeVaultAndFire(state) {
  if (state.phase !== PHASE.playing) return;
  state.vaultOpen = false;
  const count = state.shards.length;
  if (count === 0) return;
  releaseVolley(state, count);
  state.shards = [];
  state.shake = Math.min(1, state.shake + 0.3 + count * 0.018);
  emitShockwave(state, state.player.x, state.player.y, 120 + count * 5, PALETTE.amber);
  emitParticles(state, state.player.x, state.player.y, 10 + count, {
    speed: 400,
    life: 0.42,
    color: '#ffe6a8',
    size: 3.6,
  });
  state.events.push({ type: EVENTS.volley, count });
}

/** Fan `count` shards across roughly VOLLEY.spread radians, so a full ring still reads as one fan. */
function releaseVolley(state, count) {
  const player = state.player;
  const middle = (count - 1) / 2;
  const step = count > 1 ? VOLLEY.spread / (count - 1) : 0;
  for (let i = 0; i < count; i += 1) {
    const angle = state.vaultAngle + (i - middle) * step;
    state.bullets.push({
      x: player.x + Math.cos(angle) * 20,
      y: player.y + Math.sin(angle) * 20,
      vx: Math.cos(angle) * VOLLEY.speed,
      vy: Math.sin(angle) * VOLLEY.speed,
      radius: VOLLEY.radius,
      homing: true,
      damage: VOLLEY.damage,
      life: VOLLEY.life,
      maxLife: VOLLEY.life,
      trail: [],
      angle,
    });
  }
}

/** Animate the arc and, while it is open, catch every hostile shot inside it. */
export function stepVault(state, dt) {
  state.vaultArc += ((state.vaultOpen ? 1 : 0) - state.vaultArc) * Math.min(1, dt * VAULT.openEase);
  if (!state.vaultOpen) return;
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = state.bullets[i];
    if (!isBulletInsideVaultArc(state, bullet)) continue;
    state.bullets.splice(i, 1);
    absorbBulletIntoRing(state, bullet);
  }
}

/** A shot is catchable when it is hostile, inside the reach, and inside the arc's angle. */
function isBulletInsideVaultArc(state, bullet) {
  if (bullet.homing) return false;
  const player = state.player;
  const dx = bullet.x - player.x;
  const dy = bullet.y - player.y;
  if (Math.hypot(dx, dy) > VAULT.radius + VAULT.absorbPad) return false;
  return Math.abs(angleDelta(state.vaultAngle, Math.atan2(dy, dx))) <= VAULT.halfArc;
}

/** A catch becomes one shard; a ring already at the cap refuses it, so the shot dies wasted. */
function absorbBulletIntoRing(state, bullet) {
  if (state.shards.length >= SHARD_CAP) {
    emitParticles(state, bullet.x, bullet.y, 3, { speed: 80, life: 0.22, color: '#8b5cf6', size: 2 });
    return;
  }
  const depth = state.shards.length;
  state.shards.push({ born: state.time });
  state.totalAbsorbed += 1;
  state.score += SCORE.absorb;
  state.combo += 1;
  state.comboTimer = SCORE.comboWindow;
  state.shake = Math.min(1, state.shake + 0.045);
  emitShockwave(state, bullet.x, bullet.y, 44, '#ffe6a8');
  emitParticles(state, bullet.x, bullet.y, 6, { speed: 180, life: 0.3, color: '#ffb347', size: 2.6 });
  state.events.push({ type: EVENTS.absorb, depth });
}

/** Ring slot position relative to the player, evenly spaced from the vault angle. */
export function shardRingOffset(index, count, angle) {
  const step = (Math.PI * 2) / Math.max(1, count);
  const a = angle + index * step;
  const r = count > 10 ? VAULT.ringRadius + 8 : VAULT.ringRadius;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}
