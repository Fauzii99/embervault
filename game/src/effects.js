// Particles, shockwaves, floating score popups and the shake decay: pure feedback, no rules. Every
// cue here is fired by the simulation; nothing in this file reads or writes gameplay state.

export function emitParticles(state, x, y, count, options) {
  const { speed = 220, life = 0.5, color = '#ffb347', size = 3 } = options ?? {};
  for (let i = 0; i < count; i += 1) {
    const angle = state.rng.angle();
    const velocity = state.rng.range(speed * 0.3, speed);
    const span = state.rng.range(life * 0.55, life);
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      life: span,
      maxLife: span,
      color,
      size: state.rng.range(size * 0.45, size),
    });
  }
}

export function emitShockwave(state, x, y, radius, color) {
  state.shockwaves.push({ x, y, radius: radius * 0.25, target: radius, life: 0.5, maxLife: 0.5, color });
}

export function emitScorePopup(state, x, y, text, color) {
  state.popups.push({ x, y, text, color, life: 0.9, maxLife: 0.9 });
}

export function decayScreenShake(state, dt) {
  state.shake = Math.max(0, state.shake - dt * 2.3);
}

/** Age every cue one step: sparks drift and damp, rings swell, popups rise and fade. */
export function stepEffects(state, dt) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const p = state.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      state.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const damp = Math.exp(-2.3 * dt);
    p.vx *= damp;
    p.vy *= damp;
  }
  for (let i = state.shockwaves.length - 1; i >= 0; i -= 1) {
    const wave = state.shockwaves[i];
    wave.life -= dt;
    if (wave.life <= 0) {
      state.shockwaves.splice(i, 1);
      continue;
    }
    const t = 1 - wave.life / wave.maxLife;
    wave.radius = wave.radius + (wave.target - wave.radius) * Math.min(1, dt * 10 + t * 0.05);
  }
  for (let i = state.popups.length - 1; i >= 0; i -= 1) {
    const popup = state.popups[i];
    popup.life -= dt;
    popup.y -= dt * 32;
    if (popup.life <= 0) state.popups.splice(i, 1);
  }
}
