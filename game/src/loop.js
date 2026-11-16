// The loop and its phase machine: a fixed 120 Hz accumulator drives the simulation, input becomes
// a direction and vault presses, drained events become sounds, and the status line stays current.

import { WAVE_COUNT } from './config.js';
import { EVENTS, PHASE, drainEvents } from './state.js';
import { startRun, update } from './simulation.js';
import { steer } from './player.js';
import { closeVaultAndFire, openVault } from './vault.js';

const STEP = 1 / 120;
const MAX_STEPS = 8;
const MAX_FRAME = 0.1;

export function startLoop({ state, render, input, audio, status }) {
  let accumulator = 0;
  let last = performance.now();
  let statusKey = '';
  let seed = Math.floor(Math.random() * 1e9);

  const beginRun = () => {
    seed = Math.floor(Math.random() * 1e9);
    startRun(state, seed);
    statusKey = '';
  };

  const syncStatus = () => {
    let text;
    if (state.phase === PHASE.title) {
      text = 'EMBERVAULT title screen. Hold to open the vault, release to fire the ring. Click or press space to begin.';
    } else if (state.phase === PHASE.playing) {
      text = `Wave ${state.wave} of ${WAVE_COUNT}. Score ${state.score}. Vault holds ${state.shards.length} of 16 shards. Lives ${state.lives}.`;
    } else if (state.phase === PHASE.dead) {
      text = `The vault breaks. You fell on wave ${state.wave}. Final score ${state.score}. Best ${Math.max(state.best, state.score)}. Press R or enter to restart.`;
    } else {
      text = `Vault sealed. You held the line through all ten waves. Final score ${state.score}. Best ${Math.max(state.best, state.score)}. Press R or enter to restart.`;
    }
    if (text !== statusKey) {
      statusKey = text;
      status.textContent = text;
    }
  };

  input.on('vaultDown', () => {
    audio.unlock();
    if (state.phase === PHASE.title) {
      beginRun();
      return;
    }
    openVault(state);
  });
  input.on('vaultUp', () => {
    closeVaultAndFire(state);
  });
  input.on('confirm', () => {
    audio.unlock();
    if (state.phase === PHASE.playing) return;
    beginRun();
  });

  const audioFor = (event) => {
    if (event.type === EVENTS.absorb) audio.absorb(event.depth);
    else if (event.type === EVENTS.volley) audio.volley(event.count);
    else if (event.type === EVENTS.kill) audio.kill();
    else if (event.type === EVENTS.hit) audio.hit();
    else if (event.type === EVENTS.waveClear) audio.waveClear();
    else if (event.type === EVENTS.death) audio.death();
    else if (event.type === EVENTS.victory) audio.victory();
  };

  const aimVault = () => {
    if (state.phase !== PHASE.playing) return;
    const player = state.player;
    const dx = input.pointer.x - player.x;
    const dy = input.pointer.y - player.y;
    if (Math.hypot(dx, dy) < 6) return;
    const target = Math.atan2(dy, dx);
    let delta = (target - state.vaultAngle) % (Math.PI * 2);
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    state.vaultAngle += delta * 0.22;
  };

  const frame = (now) => {
    const elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    accumulator += elapsed;

    let steps = 0;
    while (accumulator >= STEP && steps < MAX_STEPS) {
      if (state.phase === PHASE.playing) {
        const move = input.move;
        steer(state, (move.right ? 1 : 0) - (move.left ? 1 : 0), (move.down ? 1 : 0) - (move.up ? 1 : 0), STEP);
        aimVault();
      }
      update(state, STEP);
      accumulator -= STEP;
      steps += 1;
    }
    if (steps === MAX_STEPS) accumulator = 0;

    for (const event of drainEvents(state)) audioFor(event);
    render.draw(state);
    syncStatus();
    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
  return { beginRun };
}

/** Letterbox: the backing store stays 1280x720, CSS fits it inside the viewport at 16:9. */
export function fitCanvas(canvas) {
  const apply = () => {
    const scale = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    canvas.style.width = `${Math.floor(1280 * scale)}px`;
    canvas.style.height = `${Math.floor(720 * scale)}px`;
  };
  apply();
  window.addEventListener('resize', apply);
  return apply;
}
