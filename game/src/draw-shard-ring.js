// Everything that lives in the arena: the ring of caught shards, its spokes and highlight. This is
// the game's signature visual, so it is alone in its own file and reads the state as truth.

import { shardRingOffset } from './vault.js';
import { PALETTE } from './palette.js';

const TAU = Math.PI * 2;

/** One dot per shard, evenly spaced from the vault angle, with a faint spoke back to the core. */
export function drawShardRing(ctx, state) {
  const count = state.shards.length;
  if (count === 0) return;
  const player = state.player;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.globalCompositeOperation = 'lighter';

  for (let i = 0; i < count; i += 1) {
    const offset = shardRingOffset(i, count, state.vaultAngle);
    ctx.strokeStyle = 'rgba(255,179,71,0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(offset.x * 0.36, offset.y * 0.36);
    ctx.lineTo(offset.x, offset.y);
    ctx.stroke();
  }

  for (let i = 0; i < count; i += 1) {
    const offset = shardRingOffset(i, count, state.vaultAngle);
    const pulse = 1 + Math.sin(state.time * 5 + i * 0.7) * 0.12;
    const radius = 7 * pulse;
    const glow = ctx.createRadialGradient(offset.x, offset.y, 1, offset.x, offset.y, radius * 2.6);
    glow.addColorStop(0, 'rgba(255,230,168,0.95)');
    glow.addColorStop(0.4, 'rgba(255,179,71,0.55)');
    glow.addColorStop(1, 'rgba(255,122,41,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(offset.x, offset.y, radius * 2.6, 0, TAU);
    ctx.fill();

    ctx.fillStyle = PALETTE.amber;
    ctx.beginPath();
    ctx.arc(offset.x, offset.y, radius, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PALETTE.core;
    ctx.beginPath();
    ctx.arc(offset.x - radius * 0.25, offset.y - radius * 0.3, radius * 0.36, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}
