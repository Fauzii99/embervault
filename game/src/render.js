// The composition. It owns the canvas context and calls the draw modules in layer order; it paints
// nothing itself. Floor, then the shaken world, then banner, card and HUD undimmed on top.

import { PHASE } from './state.js';
import { drawArena } from './draw-arena.js';
import { drawControlHint, drawHud, drawWaveBanner } from './draw-hud.js';
import { drawDefeatCard, drawTitleScreen, drawVictoryCard } from './draw-cards.js';
import {
  drawEnemies,
  drawParticleField,
  drawPlayerCore,
  drawPopups,
  drawShockwaves,
} from './draw-entities.js';
import { drawProjectiles } from './draw-projectiles.js';
import { drawShardRing } from './draw-shard-ring.js';
import { drawVaultArc } from './draw-vault-arc.js';

const SHAKE_PIXELS = 13;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  return {
    draw(state) {
      renderFrame(ctx, state);
    },
  };
}

/** Which full-screen card the current phase wants. */
export function screenFor(state) {
  if (state.phase === PHASE.title) return 'title';
  if (state.phase === PHASE.dead) return 'over';
  if (state.phase === PHASE.won) return 'win';
  return 'play';
}

function renderFrame(ctx, state) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  drawArena(ctx, state);

  const shakeX = state.shake > 0 ? (Math.random() * 2 - 1) * state.shake * SHAKE_PIXELS : 0;
  const shakeY = state.shake > 0 ? (Math.random() * 2 - 1) * state.shake * SHAKE_PIXELS : 0;
  ctx.save();
  ctx.translate(shakeX, shakeY);
  drawShockwaves(ctx, state);
  drawParticleField(ctx, state);
  drawEnemies(ctx, state);
  drawVaultArc(ctx, state);
  drawProjectiles(ctx, state);
  drawShardRing(ctx, state);
  drawPlayerCore(ctx, state);
  drawPopups(ctx, state);
  ctx.restore();

  drawWaveBanner(ctx, state);
  drawControlHint(ctx, state);
  const screen = screenFor(state);
  if (screen === 'title') drawTitleScreen(ctx, state);
  if (screen === 'over') drawDefeatCard(ctx, state);
  if (screen === 'win') drawVictoryCard(ctx, state);
  // HUD last: the counters stay legible even with a dimming card over the arena.
  drawHud(ctx, state);
}
