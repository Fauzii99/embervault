// Every pixel. The renderer reads a state and paints it in layers; it never writes to the state.
// The colour split is deliberate: amber and white belong to the player and HUD, magenta to enemies.

import { ARENA, PALETTE, SHARD_CAP, VAULT, WAVE_COUNT } from './config.js';
import { ENEMY, PHASE, shardOffset } from './world.js';

const TAU = Math.PI * 2;
const FONT = 'ui-sans-serif, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const HEX_TILE = 78;
const HEX_SIZE = 26;
const HEX_ROW = Math.sqrt(3) * HEX_SIZE;

let hexPattern = null;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  if (!hexPattern) hexPattern = buildHexPattern();
  return {
    draw(state) {
      drawFrame(ctx, state);
    },
  };
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

function drawFrame(ctx, state) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  drawBackground(ctx, state);

  const shakeX = state.shake > 0 ? (Math.random() * 2 - 1) * state.shake * 13 : 0;
  const shakeY = state.shake > 0 ? (Math.random() * 2 - 1) * state.shake * 13 : 0;
  ctx.save();
  ctx.translate(shakeX, shakeY);
  drawShockwaves(ctx, state);
  drawParticles(ctx, state);
  drawEnemies(ctx, state);
  drawVault(ctx, state);
  drawBullets(ctx, state);
  drawShards(ctx, state);
  drawPlayer(ctx, state);
  drawPopups(ctx, state);
  ctx.restore();

  drawWaveBanner(ctx, state);
  drawHint(ctx, state);
  if (state.phase === PHASE.title) drawTitle(ctx, state);
  if (state.phase === PHASE.dead) drawEnd(ctx, state, false);
  if (state.phase === PHASE.won) drawEnd(ctx, state, true);
  // HUD last: the counters stay legible even with a dimming card over the arena.
  drawHud(ctx, state);
}

/* Layer 1: arena floor. */
function drawBackground(ctx, state) {
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

  if (hexPattern) {
    ctx.save();
    const pattern = ctx.createPattern(hexPattern, 'repeat');
    if (pattern) {
      ctx.globalAlpha = 0.3 + Math.sin(state.time * 0.9) * 0.06;
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, ARENA.width, ARENA.height);
    }
    ctx.restore();
  }

  const player = state.player;
  const poolRadius = state.vaultOpen ? 330 : 250;
  const pool = ctx.createRadialGradient(player.x, player.y, 6, player.x, player.y, poolRadius);
  pool.addColorStop(0, state.vaultOpen ? 'rgba(255,179,71,0.22)' : 'rgba(255,179,71,0.13)');
  pool.addColorStop(1, 'rgba(255,179,71,0)');
  ctx.fillStyle = pool;
  ctx.fillRect(0, 0, ARENA.width, ARENA.height);

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

  ctx.strokeStyle = 'rgba(139,92,246,0.24)';
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, ARENA.width - 4, ARENA.height - 4);
}

/* Layer 2: expanding rings from catches, kills and hits. */
function drawShockwaves(ctx, state) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const wave of state.shockwaves) {
    const t = 1 - wave.life / wave.maxLife;
    ctx.globalAlpha = (1 - t) * 0.7;
    ctx.strokeStyle = wave.color;
    ctx.lineWidth = 3 + (1 - t) * 3;
    ctx.beginPath();
    ctx.arc(wave.x, wave.y, wave.radius, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

/* Layer 3: sparks. */
function drawParticles(ctx, state) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of state.particles) {
    const t = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = t * 0.9;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.4 + t * 0.6), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/* Layer 4: enemies, each a different silhouette. */
function drawEnemies(ctx, state) {
  for (const enemy of state.enemies) {
    if (enemy.kind === ENEMY.warden) drawWarden(ctx, state, enemy);
    else drawEnemyBody(ctx, state, enemy);
  }
}

function drawEnemyBody(ctx, state, enemy) {
  const flash = enemy.flash;
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.rotate(enemy.angle);
  ctx.shadowColor = PALETTE.magenta;
  ctx.shadowBlur = 22 + flash * 20;
  ctx.fillStyle = flash > 0.1 ? '#ffd3e6' : PALETTE.magenta;
  ctx.strokeStyle = 'rgba(255,236,246,0.9)';
  ctx.lineWidth = 2;

  if (enemy.kind === ENEMY.spitter) {
    ctx.beginPath();
    for (let i = 0; i < 3; i += 1) {
      const a = (i / 3) * TAU - Math.PI / 2;
      const x = Math.cos(a) * enemy.radius;
      const y = Math.sin(a) * enemy.radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.fillStyle = 'rgba(21,10,36,0.55)';
    ctx.beginPath();
    ctx.arc(0, 2, enemy.radius * 0.3, 0, TAU);
    ctx.fill();
  } else if (enemy.kind === ENEMY.orbiter) {
    // An open ring with a bright core: it reads as a crescent at any rotation.
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius * 0.78, -2.3, 2.3);
    ctx.lineWidth = 7;
    ctx.strokeStyle = flash > 0.1 ? '#ffd3e6' : PALETTE.magenta;
    ctx.stroke();
    ctx.shadowBlur = 16;
    ctx.fillStyle = flash > 0.1 ? '#fff2f8' : '#ff86b8';
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius * 0.32, 0, TAU);
    ctx.fill();
  } else {
    // Lancer: a long dart aimed along its travel.
    const heading = Math.atan2(enemy.vy, enemy.vx) || 0;
    ctx.rotate(heading);
    ctx.beginPath();
    ctx.moveTo(enemy.radius * 1.45, 0);
    ctx.lineTo(-enemy.radius * 0.55, enemy.radius * 0.62);
    ctx.lineTo(-enemy.radius * 0.15, 0);
    ctx.lineTo(-enemy.radius * 0.55, -enemy.radius * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.fillStyle = 'rgba(21,10,36,0.6)';
    ctx.beginPath();
    ctx.arc(-enemy.radius * 0.1, 0, 3, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  if (enemy.hp < enemy.maxHp) {
    const width = enemy.radius * 1.8;
    ctx.fillStyle = 'rgba(13,6,23,0.7)';
    ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 12, width, 3);
    ctx.fillStyle = PALETTE.magenta;
    ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 12, width * (enemy.hp / enemy.maxHp), 3);
  }
}

function drawWarden(ctx, state, enemy) {
  const pulse = 1 + Math.sin(state.time * 2.2) * 0.015;
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.scale(pulse, pulse);
  ctx.rotate(enemy.angle * 0.35);

  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(0, 0, enemy.radius * 0.3, 0, 0, enemy.radius * 2.1);
  glow.addColorStop(0, 'rgba(255,46,136,0.28)');
  glow.addColorStop(1, 'rgba(255,46,136,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, enemy.radius * 2.1, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  ctx.strokeStyle = 'rgba(255,46,136,0.95)';
  ctx.shadowColor = PALETTE.magenta;
  ctx.shadowBlur = 26;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(0, 0, enemy.radius, 0, TAU);
  ctx.stroke();

  ctx.shadowBlur = 14;
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(255,134,184,0.9)';
  ctx.beginPath();
  ctx.arc(0, 0, enemy.radius * 0.7, 0.4, 0.4 + Math.PI * 1.45);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, enemy.radius * 0.7, 3.6, 3.6 + Math.PI * 1.1);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,236,246,0.35)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * TAU;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * enemy.radius * 0.42, Math.sin(a) * enemy.radius * 0.42);
    ctx.lineTo(Math.cos(a) * enemy.radius * 0.62, Math.sin(a) * enemy.radius * 0.62);
    ctx.stroke();
  }

  const core = ctx.createRadialGradient(0, 0, 2, 0, 0, enemy.radius * 0.4);
  core.addColorStop(0, PALETTE.core);
  core.addColorStop(1, 'rgba(255,46,136,0.15)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, enemy.radius * 0.4, 0, TAU);
  ctx.fill();
  ctx.restore();

  const barWidth = 300;
  const barX = enemy.x - barWidth / 2;
  const barY = enemy.y - enemy.radius - 42;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = `700 15px ${FONT}`;
  ctx.fillStyle = PALETTE.white;
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 6;
  ctx.fillText('THE WARDEN', enemy.x, barY - 10);
  ctx.restore();

  ctx.fillStyle = 'rgba(13,6,23,0.85)';
  ctx.fillRect(barX, barY, barWidth, 10);
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1;
  ctx.strokeRect(barX + 0.5, barY + 0.5, barWidth - 1, 9);
  const ratio = Math.max(0, enemy.hp / enemy.maxHp);
  const fill = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
  fill.addColorStop(0, PALETTE.ember);
  fill.addColorStop(1, PALETTE.amberHot);
  ctx.fillStyle = fill;
  ctx.fillRect(barX + 1, barY + 1, (barWidth - 2) * ratio, 8);
}

/* Layer 5: the vault arc — the single most important shape on screen. */
function drawVault(ctx, state) {
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
  band.addColorStop(0, `rgba(255,179,71,${0.02 * arc})`);
  band.addColorStop(0.45, `rgba(255,179,71,${0.24 * arc})`);
  band.addColorStop(0.78, `rgba(255,230,168,${0.3 * arc})`);
  band.addColorStop(1, `rgba(255,122,41,${0.03 * arc})`);
  ctx.strokeStyle = band;
  ctx.lineWidth = 60;
  ctx.beginPath();
  ctx.arc(0, 0, radius, from, to);
  ctx.stroke();

  ctx.globalAlpha = arc;
  ctx.strokeStyle = 'rgba(255,230,168,0.95)';
  ctx.lineWidth = 4;
  ctx.shadowColor = PALETTE.amber;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(0, 0, radius + 26, from, to);
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = 'rgba(255,179,71,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, radius - 32, from, to);
  ctx.stroke();

  for (const sign of [-1, 1]) {
    const a = state.vaultAngle + sign * VAULT.halfArc;
    ctx.strokeStyle = `rgba(255,230,168,${0.5 * arc})`;
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

/* Layer 6: shots. Magenta is hostile; the amber ones are spent shards coming home. */
function drawBullets(ctx, state) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const bullet of state.bullets) {
    if (bullet.homing) {
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
      continue;
    }
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
  ctx.restore();
}

/* Layer 7: the ring of caught shards, always legible as separate dots. */
function drawShards(ctx, state) {
  const count = state.shards.length;
  if (count === 0) return;
  const player = state.player;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.globalCompositeOperation = 'lighter';

  for (let i = 0; i < count; i += 1) {
    const offset = shardOffset(i, count, state.vaultAngle);
    ctx.strokeStyle = 'rgba(255,179,71,0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(offset.x * 0.36, offset.y * 0.36);
    ctx.lineTo(offset.x, offset.y);
    ctx.stroke();
  }

  for (let i = 0; i < count; i += 1) {
    const offset = shardOffset(i, count, state.vaultAngle);
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

/* Layer 8: the player — a small white triangle with an amber halo. */
function drawPlayer(ctx, state) {
  const player = state.player;
  const blink = player.invuln > 0 && Math.floor(state.time * 14) % 2 === 0;
  if (blink) return;

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createRadialGradient(0, 0, 3, 0, 0, 46);
  halo.addColorStop(0, 'rgba(255,230,168,0.55)');
  halo.addColorStop(0.45, 'rgba(255,179,71,0.2)');
  halo.addColorStop(1, 'rgba(255,122,41,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, 46, 0, TAU);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(state.time * 0.7);
  ctx.shadowColor = PALETTE.amber;
  ctx.shadowBlur = 16;
  ctx.fillStyle = PALETTE.white;
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(12.5, 11);
  ctx.lineTo(0, 5.5);
  ctx.lineTo(-12.5, 11);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();

  if (player.hurtFlash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, player.hurtFlash) * 0.9;
    ctx.strokeStyle = PALETTE.magenta;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 26 + (1 - player.hurtFlash) * 16, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

/* Layer 9: floating score and status text. */
function drawPopups(ctx, state) {
  ctx.save();
  ctx.textAlign = 'center';
  for (const popup of state.popups) {
    const t = Math.max(0, popup.life / popup.maxLife);
    ctx.globalAlpha = Math.min(1, t * 1.6);
    ctx.font = `800 20px ${FONT}`;
    ctx.fillStyle = popup.color;
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 8;
    ctx.fillText(popup.text, popup.x, popup.y);
  }
  ctx.restore();
}

/* Layer 10: HUD. Amber accents and white numbers, never magenta. */
function drawHud(ctx, state) {
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.75)';
  ctx.shadowBlur = 8;

  const label = (text, x, y, align = 'left') => {
    ctx.textAlign = align;
    ctx.font = `700 13px ${FONT}`;
    ctx.fillStyle = PALETTE.amber;
    ctx.fillText(text, x, y);
  };
  const value = (text, x, y, size, color = PALETTE.white, align = 'left') => {
    ctx.textAlign = align;
    ctx.font = `800 ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  };

  label('SCORE', 46, 46);
  value(formatScore(state.score), 46, 78, 32);

  label('WAVE', ARENA.width / 2, 46, 'center');
  value(`${state.wave} / ${WAVE_COUNT}`, ARENA.width / 2, 78, 28, PALETTE.white, 'center');
  const barX = ARENA.width / 2 - 95;
  const barY = 90;
  ctx.fillStyle = 'rgba(255,250,242,0.14)';
  ctx.fillRect(barX, barY, 190, 5);
  ctx.fillStyle = PALETTE.amber;
  ctx.fillRect(barX, barY, 190 * Math.min(1, state.wave / WAVE_COUNT), 5);

  label('BEST', ARENA.width - 46, 46, 'right');
  value(formatScore(Math.max(state.best, state.score)), ARENA.width - 46, 78, 32, PALETTE.amberHot, 'right');

  label('VAULT', 46, ARENA.height - 66);
  value(`${state.shards.length} / ${SHARD_CAP}`, 46, ARENA.height - 38, 26);
  for (let i = 0; i < SHARD_CAP; i += 1) {
    const x = 46 + i * 16;
    const y = ARENA.height - 30;
    ctx.fillStyle = i < state.shards.length ? PALETTE.amber : 'rgba(255,250,242,0.22)';
    ctx.fillRect(x, y, 13, 9);
  }

  label('COMBO', ARENA.width / 2, ARENA.height - 66, 'center');
  value(`x ${state.combo}`, ARENA.width / 2, ARENA.height - 38, 26, state.combo > 1 ? PALETTE.amber : 'rgba(255,250,242,0.45)', 'center');

  label('LIVES', ARENA.width - 46, ARENA.height - 66, 'right');
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
  ctx.restore();
}

/* Layer 11: wave announcement. */
function drawWaveBanner(ctx, state) {
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

/* Layer 12: the teaching pill, clear of both the enemy band and the combo row. */
function drawHint(ctx, state) {
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

/* Layer 13: title and end cards, both over a live arena. */
function dimArena(ctx, alpha) {
  ctx.fillStyle = `rgba(9,4,17,${alpha})`;
  ctx.fillRect(0, 0, ARENA.width, ARENA.height);
}

function drawTitle(ctx, state) {
  ctx.save();
  dimArena(ctx, 0.46);
  const cx = ARENA.width / 2;
  ctx.textAlign = 'center';

  // A soft scrim behind the copy keeps the rules legible over whatever the arena is doing.
  const scrim = ctx.createRadialGradient(cx, 340, 120, cx, 340, 560);
  scrim.addColorStop(0, 'rgba(9,4,17,0.78)');
  scrim.addColorStop(0.7, 'rgba(9,4,17,0.42)');
  scrim.addColorStop(1, 'rgba(9,4,17,0)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 90, ARENA.width, 520);

  ctx.shadowColor = 'rgba(255,179,71,0.55)';
  ctx.shadowBlur = 44;
  ctx.font = `800 104px ${FONT}`;
  ctx.fillStyle = PALETTE.white;
  ctx.fillText('EMBERVAULT', cx, 186);

  ctx.shadowBlur = 0;
  ctx.font = `700 21px ${FONT}`;
  ctx.fillStyle = PALETTE.amber;
  ctx.fillText('Catch the fire. Spend it back.', cx, 226);

  const rows = [
    ['HOLD', 'open the vault — it swallows enemy fire into a ring of shards'],
    ['RELEASE', 'fire the whole ring as a homing volley'],
    ['TRADE-OFF', 'the vault costs you your gun and 40% of your speed'],
  ];
  const labelX = 372;
  rows.forEach(([key, copy], i) => {
    const y = 306 + i * 46;
    ctx.textAlign = 'right';
    ctx.font = `800 17px ${FONT}`;
    ctx.fillStyle = PALETTE.amber;
    ctx.fillText(key, labelX, y);
    ctx.textAlign = 'left';
    ctx.font = `600 18px ${FONT}`;
    ctx.fillStyle = 'rgba(255,244,226,0.92)';
    ctx.fillText(copy, labelX + 30, y);
  });

  ctx.textAlign = 'center';
  ctx.font = `700 14px ${FONT}`;
  ctx.fillStyle = 'rgba(255,230,168,0.72)';
  ctx.fillText('S U R V I V E   1 0   W A V E S   ·   T H E   W A R D E N   W A I T S   A T   T H E   L A S T', cx, 478);

  const pulse = 0.62 + Math.sin(state.time * 3.4) * 0.32;
  ctx.globalAlpha = pulse;
  ctx.shadowColor = PALETTE.amber;
  ctx.shadowBlur = 22;
  ctx.font = `800 22px ${FONT}`;
  ctx.fillStyle = PALETTE.amberHot;
  ctx.fillText('CLICK OR PRESS SPACE TO BEGIN', cx, 556);
  ctx.restore();
}

function drawEnd(ctx, state, won) {
  ctx.save();
  dimArena(ctx, 0.72);
  const cx = ARENA.width / 2;
  ctx.textAlign = 'center';

  ctx.shadowBlur = 40;
  if (won) {
    ctx.shadowColor = 'rgba(255,179,71,0.6)';
    ctx.font = `800 78px ${FONT}`;
    ctx.fillStyle = PALETTE.amber;
    ctx.fillText('VAULT SEALED', cx, 208);
    ctx.shadowBlur = 0;
    ctx.font = `600 20px ${FONT}`;
    ctx.fillStyle = PALETTE.white;
    ctx.fillText('You held the line through all ten waves.', cx, 248);
  } else {
    ctx.shadowColor = 'rgba(255,46,136,0.6)';
    ctx.font = `800 72px ${FONT}`;
    ctx.fillStyle = PALETTE.magenta;
    ctx.fillText('THE VAULT BREAKS', cx, 208);
    ctx.shadowBlur = 0;
    ctx.font = `600 20px ${FONT}`;
    ctx.fillStyle = PALETTE.white;
    ctx.fillText(`You fell on wave ${state.wave}.`, cx, 248);
  }

  ctx.font = `700 13px ${FONT}`;
  ctx.fillStyle = PALETTE.amber;
  ctx.fillText('F I N A L   S C O R E', cx, 322);

  ctx.shadowColor = 'rgba(255,230,168,0.4)';
  ctx.shadowBlur = 30;
  ctx.font = `800 86px ${FONT}`;
  ctx.fillStyle = PALETTE.white;
  ctx.fillText(formatScore(state.score), cx, 406);
  ctx.shadowBlur = 0;

  ctx.font = `700 14px ${FONT}`;
  ctx.fillStyle = 'rgba(255,250,242,0.7)';
  ctx.fillText(
    `BEST ${formatScore(Math.max(state.best, state.score))}   ·   SHOTS CAUGHT ${state.totalAbsorbed}`,
    cx,
    446,
  );

  const pulse = 0.82 + Math.sin(state.time * 3.2) * 0.18;
  ctx.globalAlpha = pulse;
  ctx.shadowColor = PALETTE.amber;
  ctx.shadowBlur = 20;
  ctx.font = `800 21px ${FONT}`;
  ctx.fillStyle = PALETTE.amberHot;
  ctx.fillText('PRESS R OR ENTER TO RESTART', cx, 528);
  ctx.restore();
}

function formatScore(value) {
  const text = String(Math.max(0, Math.round(value)));
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    if (i > 0 && (text.length - i) % 3 === 0) out += ',';
    out += text[i];
  }
  return out;
}
