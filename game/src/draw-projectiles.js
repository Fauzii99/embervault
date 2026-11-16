// Shots on screen: hostile bullets and the homing volley shards with their trails. Both are
// additive light, so they share one composite pass and differ only in palette.

import { PALETTE } from './palette.js';

const TAU = Math.PI * 2;

export function drawProjectiles(ctx, state) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const bullet of state.bullets) {
    if (bullet.homing) drawVolleyShard(ctx, bullet);
    else drawEnemyBullet(ctx, bullet);
  }
  ctx.restore();
}

/** A spent shard coming home: a cooling trail behind an amber core. */
function drawVolleyShard(ctx, bullet) {
  for (let i = 0; i < bullet.trail.length; i += 1) {
    const t = (i + 1) / (bullet.trail.length + 1);
    const p = bullet.trail[i];
    ctx.globalAlpha = t * 0.5;
    ctx.fillStyle = t > 0.6 ? PALETTE.amberHot : PALETTE.ember;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.5 + t * 4, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.shadowColor = PALETTE.amber;
  ctx.shadowBlur = 18;
  ctx.fillStyle = PALETTE.amber;
  ctx.beginPath();
  ctx.arc(bullet.x, bullet.y, 7, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = PALETTE.core;
  ctx.beginPath();
  ctx.arc(bullet.x, bullet.y, 3, 0, TAU);
  ctx.fill();
}

/** Hostile fire: a magenta bead with one white specular dot. */
function drawEnemyBullet(ctx, bullet) {
  ctx.globalAlpha = 1;
  ctx.shadowColor = PALETTE.magenta;
  ctx.shadowBlur = 16;
  ctx.fillStyle = PALETTE.magenta;
  ctx.beginPath();
  ctx.arc(bullet.x, bullet.y, bullet.radius, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,250,242,0.92)';
  ctx.beginPath();
  ctx.arc(bullet.x - bullet.radius * 0.28, bullet.y - bullet.radius * 0.3, bullet.radius * 0.32, 0, TAU);
  ctx.fill();
}
