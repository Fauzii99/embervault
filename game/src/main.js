// Entry point. Two modes: the live game (default) and the deterministic screenshot scenes behind
// ?shot=title|play|peak|over|win, which render one frame of the real simulation for the dossier.

import { ARENA } from './config.js';
import { createLoop } from './loop.js';
import { createRenderer } from './render.js';
import { buildShot } from './shots.js';

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

if (shot) {
  document.documentElement.dataset.shot = shot;
  const seed = Number(params.get('seed') ?? 1) || 1;
  const renderer = createRenderer(canvas);
  const { state, view } = buildShot(shot, seed);
  canvas.width = ARENA.width;
  canvas.height = ARENA.height;
  renderer.render(state, view);
  // A frame of the real game, frozen: nothing animates, so the screenshot is stable.
  window.__embervaultReady = true;
} else {
  const loop = createLoop(canvas, status);
  // A read-only handle for automated play-tests; the game itself never uses it.
  window.__embervaultState = loop.state;
}
