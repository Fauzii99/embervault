// Entry point. With ?shot= it renders one deterministic frame for a screenshot and flags readiness;
// otherwise it wires the live loop and exposes the state for automated playtests.

import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { fitCanvas, startLoop } from './loop.js';
import { createRenderer } from './render.js';
import { buildShot } from './shots.js';
import { createGame } from './world.js';

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

if (shot) {
  fitCanvas(canvas);
  const seed = Number(params.get('seed') ?? 1) || 1;
  const { state, view } = buildShot(shot, seed);
  canvas.dataset.scene = view;
  renderer.draw(state);
  status.textContent =
    shot === 'over' || shot === 'win'
      ? `Score ${state.score}. Press R or enter to restart.`
      : `EMBERVAULT ${shot} scene. Wave ${state.wave}. Vault holds ${state.shards.length} of 16 shards.`;
  window.__embervaultScene = view;
  window.__embervaultReady = true;
} else {
  fitCanvas(canvas);
  const state = createGame();
  const input = createInput(canvas);
  const audio = createAudio();
  window.__embervaultState = state;
  startLoop({ canvas, state, render: renderer, input, audio, status });
}
