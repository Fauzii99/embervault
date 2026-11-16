// The simulation. One self-contained state object mutated by update(); no rendering, no DOM, no
// audio calls. The renderer reads it, and the screenshot scenes fast-forward it, so the rules exist
// in exactly one place.

import {
  ARENA,
  BOSS_WAVE,
  PLAYER,
  SCORE,
  SHARD_CAP,
  VAULT,
  VOLLEY,
  WAVE_COUNT,
} from './config.js';
import { makeRng } from './random.js';

export const PHASE = {
  title: 'title',
  playing: 'playing',
  dead: 'dead',
  won: 'won',
};

export const ENEMY = {
  spitter: 'spitter',
  orbiter: 'orbiter',
  lancer: 'lancer',
  warden: 'warden',
};

export const EVENTS = {
  absorb: 'absorb',
  volley: 'volley',
  kill: 'kill',
  hit: 'hit',
  waveClear: 'waveClear',
  death: 'death',
  victory: 'victory',
};

const TAU = Math.PI * 2;

/** Shortest signed angle from a to b, in (-PI, PI]. */
function angleDelta(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

const clamp = (value, min, max) => (value < min ? min : value > max ? max : value);

/**
 * The roster. Each wave spawns a mix of these; the mix and the count are the difficulty curve, and
 * every type is readable apart in a still: spitters sit still and aim, orbiters circle, lancers rush.
 */
const SPAWN_TABLE = {
  1: { spitter: 3, orbiter: 0, lancer: 0 },
  2: { spitter: 4, orbiter: 0, lancer: 1 },
  3: { spitter: 4, orbiter: 2, lancer: 1 },
  4: { spitter: 5, orbiter: 2, lancer: 2 },
  5: { spitter: 6, orbiter: 3, lancer: 2 },
  6: { spitter: 6, orbiter: 4, lancer: 3 },
  7: { spitter: 7, orbiter: 5, lancer: 3 },
  8: { spitter: 8, orbiter: 6, lancer: 4 },
  9: { spitter: 9, orbiter: 7, lancer: 5 },
};

export function createGame(seed = 1) {
  const rng = makeRng(seed);
  const state = {
    rng,
    phase: PHASE.title,
    time: 0,
    score: 0,
    best: 0,
    lives: PLAYER.lives,
    wave: 0,
    waveTime: 0,
    waveBanner: 0,
    combo: 0,
    comboTimer: 0,
    vaultOpen: false,
    vaultArc: 0,
    vaultAngle: -Math.PI / 2,
    shards: [],
    bullets: [],
    enemies: [],
    particles: [],
    shockwaves: [],
    popups: [],
    player: { x: ARENA.width / 2, y: ARENA.height / 2, vx: 0, vy: 0, invuln: 0, hurtFlash: 0, cooldown: 0 },
    shake: 0,
    spawnQueue: [],
    hintTimer: 0,
    totalAbsorbed: 0,
    events: [],
    outcome: null,
  };
  return state;
}

export function startRun(state, seed) {
  const fresh = createGame(seed ?? Math.floor(Math.random() * 1e9));
  Object.assign(state, fresh, { best: state.best, phase: PHASE.playing });
  state.hintTimer = 7;
  beginWave(state, 1);
  return state;
}

/** Begin a wave: queue its roster with staggered spawn delays and announce it on screen. */
export function beginWave(state, wave) {
  state.wave = wave;
  state.waveTime = 0;
  state.waveBanner = 1.6;
  state.spawnQueue = [];
  if (wave >= BOSS_WAVE) {
    state.spawnQueue.push({ at: 1.2, kind: ENEMY.warden });
    return;
  }
  const table = SPAWN_TABLE[wave] ?? SPAWN_TABLE[9];
  const entries = [];
  for (const [kind, count] of Object.entries(table)) {
    for (let i = 0; i < count; i += 1) entries.push(kind);
  }
  // Shuffle so each wave's arrivals are mixed rather than grouped by type.
  for (let i = entries.length - 1; i > 0; i -= 1) {
    const j = state.rng.int(0, i);
    [entries[i], entries[j]] = [entries[j], entries[i]];
  }
  entries.forEach((kind, index) => {
    state.spawnQueue.push({ at: 0.25 + index * 0.55, kind });
  });
}

/** A point on the arena's edge, inset a little, used for spawns. */
function edgePoint(state, kind) {
  const inset = 120;
  const side = state.rng.int(0, 3);
  if (side === 0) return { x: state.rng.range(inset, ARENA.width - inset), y: inset };
  if (side === 1) return { x: ARENA.width - inset, y: state.rng.range(inset, ARENA.height - inset) };
  if (side === 2) return { x: state.rng.range(inset, ARENA.width - inset), y: ARENA.height - inset };
  return { x: inset, y: state.rng.range(inset, ARENA.height - inset) };
}

function spawnEnemy(state, kind) {
  if (kind === ENEMY.warden) {
    state.enemies.push({
      kind,
      x: ARENA.width / 2,
      y: 150,
      vx: 0,
      vy: 0,
      radius: 62,
      hp: 320,
      maxHp: 320,
      fireTimer: 1.4,
      spin: 0,
      angle: 0,
      flash: 0,
      drift: 1,
    });
    return;
  }
  const spot = edgePoint(state, kind);
  const common = { kind, x: spot.x, y: spot.y, vx: 0, vy: 0, flash: 0, hp: 1, radius: 20, angle: state.rng.angle(), spin: state.rng.range(-0.8, 0.8) };
  if (kind === ENEMY.spitter) {
    state.enemies.push({ ...common, hp: 4, radius: 22, fireTimer: state.rng.range(1.2, 2.4), drift: state.rng.range(0.5, 1.1) });
  } else if (kind === ENEMY.orbiter) {
    state.enemies.push({ ...common, hp: 5, radius: 19, fireTimer: state.rng.range(0.9, 1.8), orbitDir: state.rng.chance(0.5) ? 1 : -1, orbitRadius: state.rng.range(210, 290) });
  } else {
    state.enemies.push({ ...common, hp: 3, radius: 17, fireTimer: state.rng.range(1.6, 2.8), charge: 0, dashSpeed: 540 });
  }
}

function spawnBullet(state, x, y, angle, speed, radius = 7, color = 'magenta') {
  state.bullets.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius, color, life: 9, spin: state.rng.angle() });
}

function addParticles(state, x, y, count, options = {}) {
  const { speed = 210, life = 0.5, color = '#ffb347', size = 3, spread = TAU, angle = 0, gravity = 0 } = options;
  for (let i = 0; i < count; i += 1) {
    const a = angle + state.rng.range(-spread / 2, spread / 2);
    const v = state.rng.range(speed * 0.35, speed);
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life,
      maxLife: life,
      color,
      size: state.rng.range(size * 0.5, size),
      gravity,
    });
  }
}

function addShockwave(state, x, y, radius, color) {
  state.shockwaves.push({ x, y, radius: radius * 0.2, target: radius, life: 0.45, maxLife: 0.45, color });
}

function addPopup(state, x, y, text, color) {
  state.popups.push({ x, y, text, color, life: 0.85, maxLife: 0.85 });
}

function bumpCombo(state) {
  state.combo += 1;
  state.comboTimer = 2.6;
}

/** Shard ring slot position, as a fraction of the vault radius. */
export function shardOffset(index, count, angle) {
  const step = TAU / Math.max(1, count);
  const a = angle + index * step;
  const r = VAULT.ringBase + (count > 8 ? 10 : 0);
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}

export function update(state, dt) {
  if (state.phase !== PHASE.playing) {
    state.time += dt;
    stepEffects(state, dt);
    return;
  }
  state.time += dt;
  state.waveTime += dt;
  state.waveBanner = Math.max(0, state.waveBanner - dt);
  state.hintTimer = Math.max(0, state.hintTimer - dt);

  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0 && state.combo > 0) {
      state.combo = 0;
    }
  }

  stepPlayer(state, dt);
  stepVault(state, dt);
  stepSpawning(state, dt);
  stepEnemies(state, dt);
  stepBullets(state, dt);
  stepEffects(state, dt);
  stepWave(state, dt);
}

function stepPlayer(state, dt) {
  const player = state.player;
  player.cooldown = Math.max(0, player.cooldown - dt);
  player.invuln = Math.max(0, player.invuln - dt);
  player.hurtFlash = Math.max(0, player.hurtFlash - dt * 2.4);
  player.vx *= Math.exp(-PLAYER.friction * dt);
  player.vy *= Math.exp(-PLAYER.friction * dt);
  player.x = clamp(player.x + player.vx * dt, ARENA.margin, ARENA.width - ARENA.margin);
  player.y = clamp(player.y + player.vy * dt, ARENA.margin, ARENA.height - ARENA.margin);
}

/** Steering comes from input.js; the game only consumes a desired direction so it stays testable. */
export function steer(state, dirX, dirY, dt) {
  const player = state.player;
  const length = Math.hypot(dirX, dirY) || 1;
  const speed = PLAYER.speed * (state.vaultOpen ? VAULT.openSpeedScale : 1);
  const ax = (dirX / length) * PLAYER.accel;
  const ay = (dirY / length) * PLAYER.accel;
  player.vx = clamp(player.vx + ax * dt, -speed, speed);
  player.vy = clamp(player.vy + ay * dt, -speed, speed);
  if (dirX === 0 && dirY === 0) {
    player.vx *= Math.exp(-PLAYER.friction * dt * 1.6);
    player.vy *= Math.exp(-PLAYER.friction * dt * 1.6);
  }
}

/** Open the vault: bullets in its arc are swallowed into the ring. Firing and speed are traded away. */
export function openVault(state) {
  if (state.phase !== PHASE.playing) return;
  state.vaultOpen = true;
}

/** Close the vault and spend the whole ring as one homing volley. */
export function closeVaultAndFire(state) {
  if (state.phase !== PHASE.playing) return;
  state.vaultOpen = false;
  if (state.shards.length === 0) return;
  const count = state.shards.length;
  state.shards.forEach((shard, index) => {
    const spread = (index - (count - 1) / 2) * 0.13;
    const angle = state.vaultAngle + spread;
    state.bullets.push({
      x: state.player.x + Math.cos(angle) * 18,
      y: state.player.y + Math.sin(angle) * 18,
      vx: Math.cos(angle) * VOLLEY.speed,
      vy: Math.sin(angle) * VOLLEY.speed,
      radius: 6,
      color: 'amber',
      life: 3.2,
      homing: true,
      damage: VOLLEY.damage,
      trail: [],
      spin: angle,
    });
  });
  state.shards = [];
  state.shake = Math.min(1, state.shake + 0.35 + count * 0.02);
  addShockwave(state, state.player.x, state.player.y, 120 + count * 5, '#ffb347');
  addParticles(state, state.player.x, state.player.y, 14 + count, { speed: 380, life: 0.4, color: '#ffe6a8', size: 3.4 });
  state.events.push({ type: EVENTS.volley, count });
}

function stepVault(state, dt) {
  state.vaultArc += ((state.vaultOpen ? 1 : 0) - state.vaultArc) * Math.min(1, dt * 14);
  if (!state.vaultOpen) return;
  const player = state.player;
  const reach = VAULT.radius + VAULT.absorbRadiusPad;
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = state.bullets[i];
    if (bullet.homing) continue;
    const dx = bullet.x - player.x;
    const dy = bullet.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > reach) continue;
    const relative = angleDelta(state.vaultAngle, Math.atan2(dy, dx));
    if (Math.abs(relative) > VAULT.halfArc) continue;
    if (state.shards.length >= SHARD_CAP) {
      // A full ring cannot hold more: the shot still dies, but it gives nothing.
      state.bullets.splice(i, 1);
      addParticles(state, bullet.x, bullet.y, 4, { speed: 90, life: 0.25, color: '#8b5cf6', size: 2 });
      continue;
    }
    state.bullets.splice(i, 1);
    const depth = state.shards.length;
    state.shards.push({ born: 0, index: depth });
    state.totalAbsorbed += 1;
    state.score += SCORE.absorb;
    bumpCombo(state);
    addShockwave(state, bullet.x, bullet.y, 46, '#ffe6a8');
    addParticles(state, bullet.x, bullet.y, 6, { speed: 170, life: 0.3, color: '#ffb347', size: 2.6 });
    state.shake = Math.min(1, state.shake + 0.05);
    state.events.push({ type: EVENTS.absorb, depth });
  }
}

function stepSpawning(state, dt) {
  if (state.spawnQueue.length === 0) return;
  const due = state.spawnQueue.filter((item) => item.at <= state.waveTime);
  if (due.length === 0) return;
  state.spawnQueue = state.spawnQueue.filter((item) => item.at > state.waveTime);
  for (const item of due) spawnEnemy(state, item.kind);
}

function stepEnemies(state, dt) {
  const player = state.player;
  for (const enemy of state.enemies) {
    enemy.flash = Math.max(0, enemy.flash - dt * 3);
    enemy.angle += enemy.spin * dt;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;

    if (enemy.kind === ENEMY.spitter) {
      const target = 330;
      const push = (dist - target) * 0.7;
      enemy.x += (dx / dist) * push * dt * (enemy.drift ?? 1);
      enemy.y += (dy / dist) * push * dt * (enemy.drift ?? 1);
      enemy.fireTimer -= dt;
      if (enemy.fireTimer <= 0 && dist < 700) {
        enemy.fireTimer = state.rng.range(1.5, 2.6) * (1 - Math.min(0.35, state.wave * 0.03));
        const lead = Math.atan2(dy, dx) + state.rng.range(-0.09, 0.09);
        spawnBullet(state, enemy.x, enemy.y, lead, 250);
      }
    } else if (enemy.kind === ENEMY.orbiter) {
      const orbitAngle = Math.atan2(enemy.y - player.y, enemy.x - player.x) + enemy.orbitDir * dt * 0.9;
      const desired = enemy.orbitRadius ?? 250;
      enemy.x = player.x + Math.cos(orbitAngle) * desired;
      enemy.y = player.y + Math.sin(orbitAngle) * desired;
      enemy.fireTimer -= dt;
      if (enemy.fireTimer <= 0) {
        enemy.fireTimer = state.rng.range(1.6, 2.7) * (1 - Math.min(0.3, state.wave * 0.025));
        const base = Math.atan2(dy, dx);
        for (let i = -1; i <= 1; i += 1) spawnBullet(state, enemy.x, enemy.y, base + i * 0.22, 290);
      }
    } else if (enemy.kind === ENEMY.lancer) {
      enemy.charge -= dt;
      if (enemy.charge <= 0) {
        if (dist < 380) {
          enemy.vx = (dx / dist) * (enemy.dashSpeed ?? 540);
          enemy.vy = (dy / dist) * (enemy.dashSpeed ?? 540);
          enemy.charge = 1.9;
        } else {
          enemy.vx = (dx / dist) * 130;
          enemy.vy = (dy / dist) * 130;
          enemy.charge = 0.4;
        }
      }
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      enemy.vx *= Math.exp(-1.4 * dt);
      enemy.vy *= Math.exp(-1.4 * dt);
    } else if (enemy.kind === ENEMY.warden) {
      // The final wave: a wide body that drifts side to side and spits slow rings the vault can eat.
      enemy.spin += dt * 0.6;
      enemy.x = ARENA.width / 2 + Math.sin(state.time * 0.55) * 300;
      enemy.y = 150 + Math.sin(state.time * 0.9) * 46;
      enemy.fireTimer -= dt;
      if (enemy.fireTimer <= 0) {
        enemy.fireTimer = 1.2;
        const count = 16;
        const offset = state.time * 0.8;
        for (let i = 0; i < count; i += 1) {
          spawnBullet(state, enemy.x, enemy.y, offset + (i / count) * TAU, 205, 9);
        }
      }
    }

  }
  separateEnemies(state);
  clampEnemies(state);
  resolveEnemyContact(state);
}

/** Bodies live inside a safe box: clear of the HUD band on top, the counters below, and the walls. */
function clampEnemies(state) {
  for (const enemy of state.enemies) {
    const safe = enemy.radius + 16;
    enemy.x = Math.min(Math.max(enemy.x, safe + 12), ARENA.width - safe - 12);
    enemy.y = Math.min(Math.max(enemy.y, 132), ARENA.height - 150);
  }
}

/** Keep bodies from stacking, so a still frame always shows distinct silhouettes. */
function separateEnemies(state) {
  for (let i = 0; i < state.enemies.length; i += 1) {
    for (let j = i + 1; j < state.enemies.length; j += 1) {
      const a = state.enemies[i];
      const b = state.enemies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const min = a.radius + b.radius + 6;
      if (dist >= min) continue;
      const push = (min - dist) / 2;
      const nx = dx / dist;
      const ny = dy / dist;
      if (a.kind !== ENEMY.warden) {
        a.x -= nx * push;
        a.y -= ny * push;
      }
      if (b.kind !== ENEMY.warden) {
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }
}

function resolveEnemyContact(state) {
  const player = state.player;
  if (player.invuln > 0) return;
  for (const enemy of state.enemies) {
    const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    if (dist < enemy.radius + PLAYER.radius) {
      hurtPlayer(state);
      return;
    }
  }
}

function hurtPlayer(state) {
  const player = state.player;
  player.invuln = PLAYER.invulnSeconds;
  player.hurtFlash = 1;
  state.lives -= 1;
  state.combo = 0;
  state.shake = 1;
  addShockwave(state, player.x, player.y, 180, '#ff2e88');
  addParticles(state, player.x, player.y, 26, { speed: 320, life: 0.6, color: '#ff2e88', size: 4 });
  addPopup(state, player.x, player.y - 34, '-1 LIFE', '#ff2e88');
  state.events.push({ type: EVENTS.hit });
  if (state.lives <= 0) {
    state.phase = PHASE.dead;
    state.outcome = 'defeat';
    state.best = Math.max(state.best, state.score);
    state.events.push({ type: EVENTS.death });
  }
}

function stepBullets(state, dt) {
  const player = state.player;
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = state.bullets[i];
    if (bullet.homing && bullet.trail) {
      bullet.trail.push({ x: bullet.x, y: bullet.y });
      const keep = Math.max(2, Math.floor(VOLLEY.trailSeconds / Math.max(dt, 1 / 120)));
      while (bullet.trail.length > keep) bullet.trail.shift();
    }
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    if (bullet.homing) {
      stepHomingBullet(state, bullet, dt);
    }

    const out = bullet.x < -40 || bullet.x > ARENA.width + 40 || bullet.y < -40 || bullet.y > ARENA.height + 40;
    if (bullet.life <= 0 || out) {
      state.bullets.splice(i, 1);
      continue;
    }

    if (!bullet.homing && player.invuln <= 0) {
      if (Math.hypot(player.x - bullet.x, player.y - bullet.y) < bullet.radius + PLAYER.radius) {
        state.bullets.splice(i, 1);
        hurtPlayer(state);
      }
    }
  }
}

/** A released shard curves toward the nearest enemy; without one it simply flies on. */
function stepHomingBullet(state, bullet, dt) {
  let best = null;
  let bestDist = Infinity;
  for (const enemy of state.enemies) {
    const dist = Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = enemy;
    }
  }
  if (best) {
    const speed = Math.hypot(bullet.vx, bullet.vy);
    const current = Math.atan2(bullet.vy, bullet.vx);
    const desired = Math.atan2(best.y - bullet.y, best.x - bullet.x);
    const turn = clamp(angleDelta(current, desired), -VOLLEY.homingTurn * dt, VOLLEY.homingTurn * dt);
    const next = current + turn;
    bullet.vx = Math.cos(next) * speed;
    bullet.vy = Math.sin(next) * speed;
  }
  for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = state.enemies[i];
    if (Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y) > enemy.radius + bullet.radius) continue;
    bullet.life = 0;
    enemy.hp -= bullet.damage ?? 1;
    enemy.flash = 1;
    addParticles(state, bullet.x, bullet.y, 7, { speed: 200, life: 0.3, color: '#ffe6a8', size: 2.6 });
    if (enemy.hp <= 0) destroyEnemy(state, i);
    return;
  }
}

function destroyEnemy(state, index) {
  const enemy = state.enemies[index];
  state.enemies.splice(index, 1);
  const boss = enemy.kind === ENEMY.warden;
  const points = boss ? SCORE.bossKill : SCORE.kill;
  const multiplier = 1 + Math.min(state.combo, 40) * 0.05;
  state.score += Math.round(points * multiplier);
  state.combo += 2;
  state.comboTimer = 2.6;
  addShockwave(state, enemy.x, enemy.y, boss ? 340 : 90, boss ? '#ffb347' : '#ff2e88');
  addParticles(state, enemy.x, enemy.y, boss ? 90 : 16, {
    speed: boss ? 520 : 260,
    life: boss ? 1.2 : 0.55,
    color: boss ? '#ffb347' : '#ff2e88',
    size: boss ? 6 : 3.4,
  });
  addPopup(state, enemy.x, enemy.y - 20, `+${Math.round(points * multiplier)}`, boss ? '#ffe6a8' : '#ffb347');
  state.shake = Math.min(1, state.shake + (boss ? 1 : 0.14));
  state.events.push({ type: EVENTS.kill, boss });
  if (boss) winRun(state);
}

function winRun(state) {
  state.phase = PHASE.won;
  state.outcome = 'victory';
  state.best = Math.max(state.best, state.score);
  state.events.push({ type: EVENTS.victory });
}

function stepWave(state, dt) {
  if (state.phase !== PHASE.playing) return;
  if (state.spawnQueue.length > 0) return;
  if (state.enemies.length > 0) return;
  if (state.waveBanner > 0.9) return;
  if (state.wave >= WAVE_COUNT) return;
  state.score += SCORE.waveClear;
  addPopup(state, ARENA.width / 2, ARENA.height / 2 - 40, `WAVE CLEAR  +${SCORE.waveClear}`, '#ffe6a8');
  state.events.push({ type: EVENTS.waveClear, wave: state.wave });
  beginWave(state, state.wave + 1);
}

function stepEffects(state, dt) {
  state.shake = Math.max(0, state.shake - dt * 2.2);
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const p = state.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      state.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.exp(-2.2 * dt);
    p.vy = p.vy * Math.exp(-2.2 * dt) + p.gravity * dt;
  }
  for (let i = state.shockwaves.length - 1; i >= 0; i -= 1) {
    const wave = state.shockwaves[i];
    wave.life -= dt;
    if (wave.life <= 0) {
      state.shockwaves.splice(i, 1);
      continue;
    }
    const t = 1 - wave.life / wave.maxLife;
    wave.radius = wave.radius + (wave.target - wave.radius) * Math.min(1, dt * 9 + t * 0.06);
  }
  for (let i = state.popups.length - 1; i >= 0; i -= 1) {
    const popup = state.popups[i];
    popup.life -= dt;
    popup.y -= dt * 34;
    if (popup.life <= 0) state.popups.splice(i, 1);
  }
}

export function drainEvents(state) {
  const events = state.events;
  state.events = [];
  return events;
}
