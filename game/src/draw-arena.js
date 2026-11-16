// The arena floor: void wash, the hex grid pattern, the light pool under the player, the vignette
// and the violet border. Built once into an offscreen tile; painted every frame.

import { ARENA } from './config.js';
import { PALETTE } from './palette.js';

const TAU = Math.PI * 2;
const HEX_TILE = 78;
const HEX_SIZE = 26;
const HEX_ROW = Math.sqrt(3) * HEX_SIZE;

let hexPattern = null;

/** Draw the whole floor, then the border that frames it. */
export function drawArena(ctx, state) {
  if (!hexPattern) hexPattern = buildHexPattern();
  drawVoidWash(ctx, state);
  drawHexGrid(ctx, state);
  drawLightPool(ctx, state);
  drawVignette(ctx);
  drawArenaBorder(ctx);
}

function drawVoidWash(ctx, state) {
  const wash = ctx.createRadialGradient(
    ARENA.width * 0.5,
    ARENA.height * 0.48,
    80,
    ARENA.width * 0.5,
    ARENA.height * 0.5,
    780,
  );
  wash.addColorStop(0, '#221135');
  wash.addColorStop(0.55, PALETTE.void);
  wash.addColorStop(1, PALETTE.deep);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, ARENA.width, ARENA.height);
}

function drawHexGrid(ctx, state) {
  if (!hexPattern) return;
  ctx.save();
  const pattern = ctx.createPattern(hexPattern, 'repeat');
  if (pattern) {
    ctx.globalAlpha = 0.3 + Math.sin(state.time * 0.9) * 0.06;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, ARENA.width, ARENA.height);
  }
  ctx.restore();
}

/** The amber pool the player stands in; it widens and brightens while the vault is open. */
function drawLightPool(ctx, state) {
  const player = state.player;
  const poolRadius = state.vaultOpen ? 330 : 250;
  const pool = ctx.createRadialGradient(player.x, player.y, 6, player.x, player.y, poolRadius);
  pool.addColorStop(0, state.vaultOpen ? 'rgba(255,179,71,0.22)' : 'rgba(255,179,71,0.13)');
  pool.addColorStop(1, 'rgba(255,179,71,0)');
  ctx.fillStyle = pool;
  ctx.fillRect(0, 0, ARENA.width, ARENA.height);
}

function drawVignette(ctx) {
  const vignette = ctx.createRadialGradient(
    ARENA.width * 0.5,
    ARENA.height * 0.5,
    300,
    ARENA.width * 0.5,
    ARENA.height * 0.5,
    760,
  );
  vignette.addColorStop(0, 'rgba(13,6,23,0)');
  vignette.addColorStop(1, 'rgba(6,3,11,0.72)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, ARENA.width, ARENA.height);
}

function drawArenaBorder(ctx) {
  ctx.strokeStyle = 'rgba(139,92,246,0.24)';
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, ARENA.width - 4, ARENA.height - 4);
}

function buildHexPattern() {
  const tile = document.createElement('canvas');
  tile.width = HEX_TILE;
  tile.height = HEX_ROW * 2;
  const g = tile.getContext('2d');
  g.strokeStyle = PALETTE.grid;
  g.lineWidth = 1.2;
  for (const row of [-1, 0, 1, 2]) {
    for (const col of [-1, 0, 1, 2]) {
      const x = col * HEX_TILE * 0.5;
      const y = row * HEX_ROW + (col % 2 === 0 ? 0 : HEX_ROW * 0.5);
      strokeHex(g, x, y, HEX_SIZE);
    }
  }
  return tile;
}

function strokeHex(g, cx, cy, r) {
  g.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * TAU;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.stroke();
}
