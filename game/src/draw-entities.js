// Bodies: the four enemy silhouettes, the player triangle, sparks, shockwaves and floating popups.
// Each function paints one thing and returns; the boss bar is the only text here.

import { PALETTE } from './palette.js';
import { ENEMY } from './state.js';
import { FONT } from './typeset.js';

const TAU = Math.PI * 2;

export function drawEnemies(ctx, state) {
  for (const enemy of state.enemies) {
    if (enemy.kind === ENEMY.warden) drawWarden(ctx, state, enemy);
    else drawEnemyBody(ctx, enemy);
  }
}

/** The shared body, then the silhouette that belongs to the kind. */
function drawEnemyBody(ctx, enemy) {
  const flash = enemy.flash;
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.rotate(enemy.angle);
  ctx.shadowColor = PALETTE.magenta;
  ctx.shadowBlur = 22 + flash * 20;
  ctx.fillStyle = flash > 0.1 ? '#ffd3e6' : PALETTE.magenta;
  ctx.strokeStyle = 'rgba(255,236,246,0.9)';
  ctx.lineWidth = 2;
  if (enemy.kind === ENEMY.spitter) drawSpitter(ctx, enemy);
  else if (enemy.kind === ENEMY.orbiter) drawOrbiter(ctx, enemy, flash);
  else drawLancer(ctx, enemy);
  ctx.restore();
  if (enemy.hp < enemy.maxHp) drawEnemyHealthBar(ctx, enemy);
}

/** A blunt triangle with a dark eye. */
function drawSpitter(ctx, enemy) {
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
}

/** An open ring with a bright core: it reads as a crescent at any rotation. */
function drawOrbiter(ctx, enemy, flash) {
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
}

/** A long dart aimed along its travel. */
function drawLancer(ctx, enemy) {
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

function drawEnemyHealthBar(ctx, enemy) {
  const width = enemy.radius * 1.8;
  const x = enemy.x - width / 2;
  const y = enemy.y - enemy.radius - 12;
  ctx.fillStyle = 'rgba(13,6,23,0.7)';
  ctx.fillRect(x, y, width, 3);
  ctx.fillStyle = PALETTE.magenta;
  ctx.fillRect(x, y, width * (enemy.hp / enemy.maxHp), 3);
}

/** The Warden: a glowing concentric ring, a bright core, and a named health bar. */
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
  drawWardenBar(ctx, enemy);
}

function drawWardenBar(ctx, enemy) {
  const width = 300;
  const x = enemy.x - width / 2;
  const y = enemy.y - enemy.radius - 42;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = `700 15px ${FONT}`;
  ctx.fillStyle = PALETTE.white;
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 6;
  ctx.fillText('THE WARDEN', enemy.x, y - 10);
  ctx.restore();
  ctx.fillStyle = 'rgba(13,6,23,0.85)';
  ctx.fillRect(x, y, width, 10);
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, 9);
  const fill = ctx.createLinearGradient(x, 0, x + width, 0);
  fill.addColorStop(0, PALETTE.ember);
  fill.addColorStop(1, PALETTE.amberHot);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 1, y + 1, (width - 2) * Math.max(0, enemy.hp / enemy.maxHp), 8);
}

/** The player: a small white triangle in an amber halo, blinking while invulnerable. */
export function drawPlayerCore(ctx, state) {
  const player = state.player;
  if (player.invuln > 0 && Math.floor(state.time * 14) % 2 === 0) return;
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
  if (player.hurtFlash > 0) drawHurtFlash(ctx, player);
}

function drawHurtFlash(ctx, player) {
  ctx.save();
  ctx.globalAlpha = Math.min(1, player.hurtFlash) * 0.9;
  ctx.strokeStyle = PALETTE.magenta;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(player.x, player.y, 26 + (1 - player.hurtFlash) * 16, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

/** Sparks, additive, shrinking as they age. */
export function drawParticleField(ctx, state) {
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

/** Expanding rings from catches, kills and hits. */
export function drawShockwaves(ctx, state) {
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

/** Floating score and status text, rising and fading. */
export function drawPopups(ctx, state) {
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
