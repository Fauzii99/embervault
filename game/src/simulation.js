// The top of the simulation: starting a run and stepping it. One place owns the order in which the
// player, the vault, the waves, the bodies and the shots move, so no module has to know the rest.

import { advanceWaveIfCleared, releaseDueSpawns, spawnWave } from './waves.js';
import { checkPlayerContact, stepPlayer } from './player.js';
import { clampEnemiesToArena, separateEnemies, updateEnemies } from './enemies.js';
import { decayScreenShake, stepEffects } from './effects.js';
import { PHASE, resetRunState } from './state.js';
import { stepVault } from './vault.js';
import { updateProjectiles } from './bullets.js';

/** A new run reuses the object so the loop can keep one reference; only `best` survives. */
export function startRun(state, seed) {
  resetRunState(state, seed);
  state.phase = PHASE.playing;
  state.hintTimer = 7.5;
  spawnWave(state, 1);
  return state;
}

export function update(state, dt) {
  state.time += dt;
  state.waveBanner = Math.max(0, state.waveBanner - dt);
  decayScreenShake(state, dt);

  if (state.phase !== PHASE.playing) {
    stepEffects(state, dt);
    return;
  }

  state.waveTime += dt;
  state.hintTimer = Math.max(0, state.hintTimer - dt);
  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) state.combo = 0;
  }

  stepPlayer(state, dt);
  stepVault(state, dt);
  releaseDueSpawns(state);
  updateEnemies(state, dt);
  separateEnemies(state);
  clampEnemiesToArena(state);
  checkPlayerContact(state);
  updateProjectiles(state, dt);
  stepEffects(state, dt);
  advanceWaveIfCleared(state);
}
