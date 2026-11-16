// The open vault arc and its dashed catch radius: the shape that tells the player where fire will
// be swallowed. Painted only while the arc is above a hair's width.

import { VAULT } from './config.js';
import { PALETTE, withAlpha } from './palette.js';

const TAU = Math.PI * 2;

export function drawVaultArc(ctx, state) {
  const arc = state.vaultArc;
  if (arc < 0.01) return;
  const player = state.player;
  const radius = VAULT.radius;
  const from = state.vaultAngle - VAULT.halfArc;
  const to = state.vaultAngle + VAULT.halfArc;

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.globalCompositeOperation = 'lighter';

  const band = ctx.createRadialGradient(0, 0, radius - 34, 0, 0, radius + 26);
  band.addColorStop(0, withAlpha(PALETTE.amber, 0.02 * arc));
  band.addColorStop(0.45, withAlpha(PALETTE.amber, 0.24 * arc));
  band.addColorStop(0.78, withAlpha(PALETTE.amberHot, 0.3 * arc));
  band.addColorStop(1, withAlpha(PALETTE.ember, 0.03 * arc));
  ctx.strokeStyle = band;
  ctx.lineWidth = 60;
  ctx.beginPath();
  ctx.arc(0, 0, radius, from, to);
  ctx.stroke();

  ctx.globalAlpha = arc;
  ctx.strokeStyle = withAlpha(PALETTE.amberHot, 0.95);
  ctx.lineWidth = 4;
  ctx.shadowColor = PALETTE.amber;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(0, 0, radius + 26, from, to);
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = withAlpha(PALETTE.amber, 0.5);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, radius - 32, from, to);
  ctx.stroke();

  for (const sign of [-1, 1]) {
    const a = state.vaultAngle + sign * VAULT.halfArc;
    ctx.strokeStyle = withAlpha(PALETTE.amberHot, 0.5 * arc);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (radius - 30), Math.sin(a) * (radius - 30));
    ctx.lineTo(Math.cos(a) * (radius + 26), Math.sin(a) * (radius + 26));
    ctx.stroke();
  }

  if (arc > 0.82) {
    const t = (arc - 0.82) / 0.18;
    ctx.globalAlpha = t * 0.8;
    ctx.setLineDash([9, 13]);
    ctx.lineDashOffset = -state.time * 40;
    ctx.strokeStyle = PALETTE.amberHot;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius + VAULT.absorbPad, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}
