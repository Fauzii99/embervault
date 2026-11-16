// Every HUD block: score, best, wave progress, the vault counter with its pips, combo, lives, the
// wave banner and the teaching pill. Amber accents and white numbers, never magenta.

import { ARENA, SHARD_CAP, WAVE_COUNT } from './config.js';
import { PALETTE } from './palette.js';
import { formatScore, FONT } from './typeset.js';
import { PHASE } from './state.js';

export function drawHud(ctx, state) {
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.75)';
  ctx.shadowBlur = 8;
  drawScoreBlock(ctx, state);
  drawWaveBlock(ctx, state);
  drawBestBlock(ctx, state);
  drawVaultCounter(ctx, state);
  drawComboBlock(ctx, state);
  drawLivesPips(ctx, state);
  ctx.restore();
}

function label(ctx, text, x, y, align = 'left') {
  ctx.textAlign = align;
  ctx.font = `700 13px ${FONT}`;
  ctx.fillStyle = PALETTE.amber;
  ctx.fillText(text, x, y);
}

function value(ctx, text, x, y, size, color = PALETTE.white, align = 'left') {
  ctx.textAlign = align;
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function drawScoreBlock(ctx, state) {
  label(ctx, 'SCORE', 46, 46);
  value(ctx, formatScore(state.score), 46, 78, 32);
}

/** Wave number plus the progress bar that fills as waves are cleared. */
function drawWaveBlock(ctx, state) {
  label(ctx, 'WAVE', ARENA.width / 2, 46, 'center');
  value(ctx, `${state.wave} / ${WAVE_COUNT}`, ARENA.width / 2, 78, 28, PALETTE.white, 'center');
  const barX = ARENA.width / 2 - 95;
  const barY = 90;
  ctx.fillStyle = 'rgba(255,250,242,0.14)';
  ctx.fillRect(barX, barY, 190, 5);
  ctx.fillStyle = PALETTE.amber;
  ctx.fillRect(barX, barY, 190 * Math.min(1, state.wave / WAVE_COUNT), 5);
}

function drawBestBlock(ctx, state) {
  label(ctx, 'BEST', ARENA.width - 46, 46, 'right');
  value(ctx, formatScore(Math.max(state.best, state.score)), ARENA.width - 46, 78, 32, PALETTE.amberHot, 'right');
}

/** The ring counter, and one pip per possible shard so the cap is visible. */
function drawVaultCounter(ctx, state) {
  label(ctx, 'VAULT', 46, ARENA.height - 66);
  value(ctx, `${state.shards.length} / ${SHARD_CAP}`, 46, ARENA.height - 38, 26);
  for (let i = 0; i < SHARD_CAP; i += 1) {
    const x = 46 + i * 16;
    const y = ARENA.height - 30;
    ctx.fillStyle = i < state.shards.length ? PALETTE.amber : 'rgba(255,250,242,0.22)';
    ctx.fillRect(x, y, 13, 9);
  }
}

function drawComboBlock(ctx, state) {
  label(ctx, 'COMBO', ARENA.width / 2, ARENA.height - 66, 'center');
  value(
    ctx,
    `x ${state.combo}`,
    ARENA.width / 2,
    ARENA.height - 38,
    26,
    state.combo > 1 ? PALETTE.amber : 'rgba(255,250,242,0.45)',
    'center',
  );
}

function drawLivesPips(ctx, state) {
  label(ctx, 'LIVES', ARENA.width - 46, ARENA.height - 66, 'right');
  for (let i = 0; i < 3; i += 1) {
    const x = ARENA.width - 46 - (2 - i) * 24;
    const y = ARENA.height - 36;
    ctx.beginPath();
    ctx.moveTo(x, y - 11);
    ctx.lineTo(x + 8, y + 4);
    ctx.lineTo(x - 8, y + 4);
    ctx.closePath();
    if (i < state.lives) {
      ctx.fillStyle = PALETTE.white;
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(255,250,242,0.3)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
  }
}

export function drawWaveBanner(ctx, state) {
  const t = state.waveBanner;
  if (t <= 0 || state.phase === PHASE.title) return;
  const appear = Math.min(1, (1.9 - t) * 3.2);
  const fade = Math.min(1, t / 0.5);
  const alpha = Math.min(appear, fade);
  const boss = state.wave >= WAVE_COUNT;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 14;
  ctx.font = `800 64px ${FONT}`;
  ctx.fillStyle = boss ? PALETTE.amberHot : PALETTE.white;
  ctx.fillText(boss ? 'FINAL WAVE' : `WAVE ${state.wave}`, ARENA.width / 2, 268);
  if (boss) {
    ctx.font = `800 40px ${FONT}`;
    ctx.fillStyle = PALETTE.magenta;
    ctx.fillText('THE WARDEN', ARENA.width / 2, 314);
    ctx.font = `600 17px ${FONT}`;
    ctx.fillStyle = 'rgba(255,250,242,0.72)';
    ctx.fillText('HOLD to catch, RELEASE to fire', ARENA.width / 2, 350);
  } else {
    ctx.font = `600 17px ${FONT}`;
    ctx.fillStyle = 'rgba(255,250,242,0.72)';
    ctx.fillText('HOLD to catch, RELEASE to fire', ARENA.width / 2, 308);
  }
  ctx.restore();
}

/** The teaching pill, clear of both the enemy band and the combo row. */
export function drawControlHint(ctx, state) {
  if (state.hintTimer <= 0 || state.phase !== PHASE.playing) return;
  const text = state.vaultOpen
    ? 'VAULT OPEN — no gun, half speed · RELEASE to fire the ring'
    : 'HOLD to catch, RELEASE to fire · the ring is your ammo';
  const alpha = Math.min(1, state.hintTimer / 0.8);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `600 15px ${FONT}`;
  const width = ctx.measureText(text).width + 52;
  const height = 40;
  const x = ARENA.width / 2 - width / 2;
  const y = 584;
  ctx.fillStyle = 'rgba(13,6,23,0.82)';
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 20);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,179,71,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.amberHot;
  ctx.fillText(text, ARENA.width / 2, y + height / 2 + 1);
  ctx.restore();
}
