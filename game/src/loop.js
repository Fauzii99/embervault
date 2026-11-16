// The loop. It owns the phase machine (title → playing → over/won → restart), wires input to the
// simulation, drains the simulation's events into sound, and keeps the canvas letterboxed at 16:9.

import { ARENA } from './config.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { createRenderer, SCREEN } from './render.js';
import { PHASE, closeVaultAndFire, createGame, drainEvents, openVault, startRun, steer, update } from './world.js';

const STEP = 1 / 120;

export function createLoop(canvas, statusEl) {
  const renderer = createRenderer(canvas);
  const audio = createAudio();
  const input = createInput(canvas);
  const state = createGame(1);
  let lastTime = 0;
  let accumulator = 0;
  let running = true;

  function fitCanvas() {
    const scale = Math.min(window.innerWidth / ARENA.width, window.innerHeight / ARENA.height);
    const width = Math.max(320, Math.floor(ARENA.width * scale));
    const height = Math.max(180, Math.floor(ARENA.height * scale));
    canvas.width = ARENA.width;
    canvas.height = ARENA.height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }

  function describe(text) {
    if (statusEl && statusEl.textContent !== text) statusEl.textContent = text;
  }

  function announcePhase() {
    if (state.phase === PHASE.title) describe('EMBERVAULT. Hold to open the vault and catch enemy fire, release to fire the ring back. Click or press space to begin.');
    else if (state.phase === PHASE.dead) describe(`Game over. Final score ${state.score}. Press R or Enter to restart.`);
    else if (state.phase === PHASE.won) describe(`Victory. Final score ${state.score}. Press R or Enter to restart.`);
    else describe(`Wave ${state.wave}. Score ${state.score}. Vault ${state.shards.length} of 16 shards.`);
  }

  function beginRun() {
    audio.unlock();
    startRun(state, Math.floor(Math.random() * 1e9));
    announcePhase();
  }

  input.on('vaultDown', () => {
    audio.unlock();
    if (state.phase === PHASE.title) beginRun();
    else openVault(state);
  });

  input.on('vaultUp', () => {
    closeVaultAndFire(state);
    announcePhase();
  });

  input.on('confirm', () => {
    if (state.phase === PHASE.dead || state.phase === PHASE.won || state.phase === PHASE.title) beginRun();
  });

  /** Missile-command style aim: the arc tracks the mouse, so the vault sweeps where you look. */
  function aimVaultAtPointer() {
    const p = state.player;
    let delta = state.pointerAngle - state.vaultAngle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    state.vaultAngle += delta * 0.34;
  }

  state.pointerAngle = -Math.PI / 2;

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * ARENA.width;
    const y = ((event.clientY - rect.top) / rect.height) * ARENA.height;
    state.pointerAngle = Math.atan2(y - state.player.y, x - state.player.x);
  });

  function frame(now) {
    if (!running) return;
    const dt = lastTime === 0 ? STEP : Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    accumulator += dt;

    let steps = 0;
    while (accumulator >= STEP && steps < 8) {
      const phaseBefore = state.phase;
      if (state.phase === PHASE.playing) {
        const mx = (input.move.right ? 1 : 0) - (input.move.left ? 1 : 0);
        const my = (input.move.down ? 1 : 0) - (input.move.up ? 1 : 0);
        steer(state, mx, my, STEP);
        aimVaultAtPointer();
      }
      update(state, STEP);
      accumulator -= STEP;
      steps += 1;
      if (state.phase !== phaseBefore) announcePhase();
    }

    for (const event of drainEvents(state)) {
      if (event.type === 'absorb') audio.absorb(event.depth ?? 0);
      else if (event.type === 'volley') audio.volley(event.count ?? 1);
      else if (event.type === 'kill') audio.kill();
      else if (event.type === 'hit') audio.hit();
      else if (event.type === 'waveClear') audio.waveClear();
      else if (event.type === 'death') audio.death();
      else if (event.type === 'victory') audio.victory();
    }

    renderer.render(state, renderer.screenFor(state));
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', fitCanvas);
  fitCanvas();
  announcePhase();
  requestAnimationFrame(frame);

  return {
    state,
    stop() {
      running = false;
    },
    /** Used by the screenshot scenes: replace the live state without restarting the loop. */
    adopt(nextState, view) {
      Object.assign(state, nextState);
      renderer.render(state, view ?? renderer.screenFor(state));
    },
  };
}

export { SCREEN };
