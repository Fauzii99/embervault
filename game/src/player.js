// The player body: where it drifts, the speed it gives up while the vault is open, its
// invulnerability window, and what a hit costs. Rules live here, pixels do not.

import { ARENA, PLAYER, VAULT } from './config.js';
import { emitParticles, emitScorePopup, emitShockwave } from './effects.js';
import { clamp } from './geometry.js';
import { EVENTS, PHASE } from './state.js';

/** Advance the body and age its invulnerability and hurt flash. */
export function stepPlayer(state, dt) {
  const player = state.player;
  player.invuln = Math.max(0, player.invuln - dt);
  player.hurtFlash = Math.max(0, player.hurtFlash - dt * PLAYER.hurtDecay);
  player.x = clamp(player.x + player.vx * dt, ARENA.margin, ARENA.width - ARENA.margin);
  player.y = clamp(player.y + player.vy * dt, ARENA.margin, ARENA.height - ARENA.margin);
}

/** Input hands the simulation a unit direction; the vault's 40% speed cut lives here. */
export function steer(state, dirX, dirY, dt) {
  const player = state.player;
  const length = Math.hypot(dirX, dirY);
  if (length < 1e-6) {
    const damp = Math.exp(-PLAYER.friction * dt);
    player.vx *= damp;
    player.vy *= damp;
    return;
  }
  const speed = PLAYER.speed * (state.vaultOpen ? VAULT.openSpeedScale : 1);
  const desiredX = (dirX / length) * speed;
  const desiredY = (dirY / length) * speed;
  const response = Math.min(1, (PLAYER.accel / PLAYER.speed) * dt);
  player.vx += (desiredX - player.vx) * response;
  player.vy += (desiredY - player.vy) * response;
}

/** Open the window that makes the body untouchable again after a hit. */
export function restorePlayerInvulnerability(player) {
  player.invuln = PLAYER.invulnSeconds;
  player.hurtFlash = 1;
}

/** A hit costs a life, the combo, and possibly the run. */
export function damagePlayer(state) {
  const player = state.player;
  restorePlayerInvulnerability(player);
  state.lives -= 1;
  state.combo = 0;
  state.comboTimer = 0;
  state.shake = 1;
  emitShockwave(state, player.x, player.y, 190, '#ff2e88');
  emitParticles(state, player.x, player.y, 26, { speed: 330, life: 0.6, color: '#ff2e88', size: 4.2 });
  emitScorePopup(state, player.x, player.y - 38, '-1 LIFE', '#ff2e88');
  state.events.push({ type: EVENTS.hit });
  if (state.lives <= 0) {
    state.lives = 0;
    state.vaultOpen = false;
    state.phase = PHASE.dead;
    state.outcome = 'defeat';
    state.best = Math.max(state.best, state.score);
    state.events.push({ type: EVENTS.death });
  }
}

/** Bodies touch the player only while the invulnerability window is shut. */
export function checkPlayerContact(state) {
  const player = state.player;
  if (player.invuln > 0) return;
  for (const enemy of state.enemies) {
    if (Math.hypot(player.x - enemy.x, player.y - enemy.y) < enemy.radius + PLAYER.radius) {
      damagePlayer(state);
      return;
    }
  }
}
