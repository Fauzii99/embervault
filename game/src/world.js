// The simulation, and nothing else: no DOM, no canvas, no audio. The loop feeds it a direction
// and vault presses, drains events for sound, and the renderer reads the same state for pixels.

import {
  ARENA,
  BOSS_WAVE,
  PALETTE,
  PLAYER,
  SCORE,
  SHARD_CAP,
  SPAWN_TABLE,
  VAULT,
  VOLLEY,
  WAVE_COUNT,
} from './config.js';
import { makeRng } from './random.js';

export const PHASE = { title: 'title', playing: 'playing', dead: 'dead', won: 'won' };
export const ENEMY = { spitter: 'spitter', orbiter: 'orbiter', lancer: 'lancer', warden: 'warden' };
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
const BULLET_LIFE = 9;
const BOSS_BULLET_SPEED = 205;
const SPAWN_STAGGER = 0.55;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function angleDelta(from, to) {
  let delta = (to - from) % TAU;
  if (delta > Math.PI) delta -= TAU;
  if (delta < -Math.PI) delta += TAU;
  return delta;
}

export function createGame(seed = 1) {
  return {
    phase: PHASE.title,
    time: 0,
    score: 0,
    best: 0,
    lives: PLAYER.lives,
    wave: 1,
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
    player: {
      x: ARENA.width / 2,
      y: ARENA.height / 2,
      vx: 0,
      vy: 0,
      radius: PLAYER.radius,
      invuln: 0,
      hurtFlash: 0,
    },
    shake: 0,
    spawnQueue: [],
    hintTimer: 0,
    totalAbsorbed: 0,
    events: [],
    outcome: null,
    rng: makeRng(seed),
  };
}

/** A new run reuses the object so the loop can keep one reference; only `best` survives. */
export function startRun(state, seed) {
  const best = state.best;
  const fresh = createGame(seed ?? Math.floor(Math.random() * 1e9));
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, fresh, { best, phase: PHASE.playing, hintTimer: 7.5 });
  beginWave(state, 1);
  return state;
}

/** Queue a wave's roster with staggered arrivals, shuffled so the mix interleaves. */
export function beginWave(state, wave) {
  state.wave = wave;
  state.waveTime = 0;
  state.waveBanner = 1.9;
  state.spawnQueue = [];
  if (wave >= BOSS_WAVE) {
    state.spawnQueue.push({ at: 1.1, kind: ENEMY.warden });
    return;
  }
  const table = SPAWN_TABLE[wave] ?? SPAWN_TABLE[WAVE_COUNT - 1];
  const roster = [];
  for (const kind of Object.keys(table)) {
    for (let i = 0; i < table[kind]; i += 1) roster.push(kind);
  }
  for (let i = roster.length - 1; i > 0; i -= 1) {
    const j = state.rng.int(0, i);
    [roster[i], roster[j]] = [roster[j], roster[i]];
  }
  roster.forEach((kind, index) => {
    state.spawnQueue.push({ at: 0.3 + index * SPAWN_STAGGER, kind });
  });
}

export function update(state, dt) {
  state.time += dt;
  state.waveBanner = Math.max(0, state.waveBanner - dt);
  state.shake = Math.max(0, state.shake - dt * 2.3);

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
  stepSpawn(state, dt);
  stepEnemies(state, dt);
  stepBullets(state, dt);
  stepEffects(state, dt);
  stepWave(state);
}

function stepPlayer(state, dt) {
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

export function openVault(state) {
  if (state.phase !== PHASE.playing) return;
  state.vaultOpen = true;
}

export function closeVaultAndFire(state) {
  if (state.phase !== PHASE.playing) return;
  state.vaultOpen = false;
  const count = state.shards.length;
  if (count === 0) return;
  const player = state.player;
  const middle = (count - 1) / 2;
  // The whole volley is fanned across roughly VOLLEY.spread radians, so a full ring still reads
  // as one fan rather than a wall of parallel shots.
  const step = count > 1 ? VOLLEY.spread / (count - 1) : 0;
  for (let i = 0; i < count; i += 1) {
    const angle = state.vaultAngle + (i - middle) * step;
    state.bullets.push({
      x: player.x + Math.cos(angle) * 20,
      y: player.y + Math.sin(angle) * 20,
      vx: Math.cos(angle) * VOLLEY.speed,
      vy: Math.sin(angle) * VOLLEY.speed,
      radius: VOLLEY.radius,
      homing: true,
      damage: VOLLEY.damage,
      life: VOLLEY.life,
      maxLife: VOLLEY.life,
      trail: [],
      angle,
    });
  }
  state.shards = [];
  state.shake = Math.min(1, state.shake + 0.3 + count * 0.018);
  addShockwave(state, player.x, player.y, 120 + count * 5, PALETTE.amber);
  addParticles(state, player.x, player.y, 10 + count, {
    speed: 400,
    life: 0.42,
    color: '#ffe6a8',
    size: 3.6,
  });
  state.events.push({ type: EVENTS.volley, count });
}

function stepVault(state, dt) {
  state.vaultArc += ((state.vaultOpen ? 1 : 0) - state.vaultArc) * Math.min(1, dt * VAULT.openEase);
  if (!state.vaultOpen) return;
  const player = state.player;
  const reach = VAULT.radius + VAULT.absorbPad;
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = state.bullets[i];
    if (bullet.homing) continue;
    const dx = bullet.x - player.x;
    const dy = bullet.y - player.y;
    if (Math.hypot(dx, dy) > reach) continue;
    if (Math.abs(angleDelta(state.vaultAngle, Math.atan2(dy, dx))) > VAULT.halfArc) continue;
    state.bullets.splice(i, 1);
    if (state.shards.length >= SHARD_CAP) {
      // A full ring refuses the catch: the shot still dies, and that catch is wasted.
      addParticles(state, bullet.x, bullet.y, 3, { speed: 80, life: 0.22, color: '#8b5cf6', size: 2 });
      continue;
    }
    const depth = state.shards.length;
    state.shards.push({ born: state.time });
    state.totalAbsorbed += 1;
    state.score += SCORE.absorb;
    state.combo += 1;
    state.comboTimer = SCORE.comboWindow;
    state.shake = Math.min(1, state.shake + 0.045);
    addShockwave(state, bullet.x, bullet.y, 44, '#ffe6a8');
    addParticles(state, bullet.x, bullet.y, 6, { speed: 180, life: 0.3, color: '#ffb347', size: 2.6 });
    state.events.push({ type: EVENTS.absorb, depth });
  }
}

function stepSpawn(state, dt) {
  if (state.spawnQueue.length === 0) return;
  const due = [];
  const rest = [];
  for (const item of state.spawnQueue) {
    if (item.at <= state.waveTime) due.push(item);
    else rest.push(item);
  }
  if (due.length === 0) return;
  state.spawnQueue = rest;
  for (const item of due) spawnEnemy(state, item.kind);
}

function edgePoint(state) {
  const inset = 110;
  const side = state.rng.int(0, 3);
  if (side === 0) return { x: state.rng.range(inset, ARENA.width - inset), y: 150 };
  if (side === 1) return { x: ARENA.width - inset, y: state.rng.range(180, ARENA.height - 170) };
  if (side === 2) return { x: state.rng.range(inset, ARENA.width - inset), y: ARENA.height - 170 };
  return { x: inset, y: state.rng.range(180, ARENA.height - 170) };
}

function spawnEnemy(state, kind) {
  if (kind === ENEMY.warden) {
    state.enemies.push({
      kind,
      x: ARENA.width / 2,
      y: 252,
      vx: 0,
      vy: 0,
      radius: 62,
      hp: 320,
      maxHp: 320,
      fireTimer: 1.5,
      flash: 0,
      angle: 0,
      spin: 1,
      phase: state.rng.angle(),
    });
    return;
  }
  const spot = edgePoint(state);
  const body = {
    kind,
    x: spot.x,
    y: spot.y,
    vx: 0,
    vy: 0,
    flash: 0,
    angle: state.rng.angle(),
    spin: state.rng.range(-1.1, 1.1),
  };
  if (kind === ENEMY.spitter) {
    state.enemies.push({
      ...body,
      radius: 22,
      hp: 4,
      maxHp: 4,
      fireTimer: state.rng.range(1.1, 2.2),
      drift: state.rng.range(0.6, 1.2),
    });
  } else if (kind === ENEMY.orbiter) {
    state.enemies.push({
      ...body,
      radius: 19,
      hp: 5,
      maxHp: 5,
      fireTimer: state.rng.range(1, 1.9),
      orbitDir: state.rng.chance(0.5) ? 1 : -1,
      orbitRadius: state.rng.range(210, 290),
    });
  } else {
    state.enemies.push({
      ...body,
      radius: 17,
      hp: 3,
      maxHp: 3,
      fireTimer: 0,
      charge: 0,
      dashSpeed: 540,
    });
  }
}

function spawnBullet(state, x, y, angle, speed, radius = 7) {
  state.bullets.push({
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    angle,
    radius,
    homing: false,
    damage: 1,
    life: BULLET_LIFE,
    maxLife: BULLET_LIFE,
    trail: null,
  });
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
      const push = (dist - 330) * 0.7 * (enemy.drift ?? 1);
      enemy.x += (dx / dist) * push * dt;
      enemy.y += (dy / dist) * push * dt;
      enemy.fireTimer -= dt;
      if (enemy.fireTimer <= 0) {
        enemy.fireTimer = state.rng.range(1.5, 2.6) * (1 - Math.min(0.35, state.wave * 0.03));
        const aim = Math.atan2(dy, dx) + state.rng.range(-0.08, 0.08);
        spawnBullet(state, enemy.x, enemy.y, aim, 250);
      }
    } else if (enemy.kind === ENEMY.orbiter) {
      const bearing = Math.atan2(enemy.y - player.y, enemy.x - player.x) + enemy.orbitDir * dt * 0.9;
      const radius = enemy.orbitRadius ?? 250;
      enemy.x = player.x + Math.cos(bearing) * radius;
      enemy.y = player.y + Math.sin(bearing) * radius;
      enemy.fireTimer -= dt;
      if (enemy.fireTimer <= 0) {
        enemy.fireTimer = state.rng.range(1.6, 2.7) * (1 - Math.min(0.3, state.wave * 0.025));
        const base = Math.atan2(dy, dx);
        for (let i = -1; i <= 1; i += 1) spawnBullet(state, enemy.x, enemy.y, base + i * 0.22, 290);
      }
    } else if (enemy.kind === ENEMY.lancer) {
      enemy.charge -= dt;
      if (enemy.charge <= 0) {
        const dash = dist < 380;
        const speed = dash ? enemy.dashSpeed : 120;
        enemy.vx = (dx / dist) * speed;
        enemy.vy = (dy / dist) * speed;
        enemy.charge = dash ? 1.7 : 0.5;
      }
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      enemy.vx *= Math.exp(-1.5 * dt);
      enemy.vy *= Math.exp(-1.5 * dt);
    } else if (enemy.kind === ENEMY.warden) {
      enemy.x = ARENA.width / 2 + Math.sin(state.time * 0.55 + enemy.phase) * 300;
      enemy.y = 268 + Math.sin(state.time * 0.9) * 24;
      enemy.fireTimer -= dt;
      if (enemy.fireTimer <= 0) {
        enemy.fireTimer = 1.2;
        const spin = state.time * 0.9;
        for (let i = 0; i < 16; i += 1) {
          spawnBullet(state, enemy.x, enemy.y, spin + (i / 16) * TAU, BOSS_BULLET_SPEED, 9);
        }
      }
    }
  }

  separateEnemies(state);
  clampEnemies(state);
  resolvePlayerContact(state);
}

/**
 * Keep bodies inside the arena's safe box: clear of the HUD band above, the counters below,
 * and inset from the walls by their own radius. Runs after separation so pushes cannot strand them.
 */
function clampEnemies(state) {
  for (const enemy of state.enemies) {
    const side = enemy.radius + 12;
    enemy.x = clamp(enemy.x, side, ARENA.width - side);
    enemy.y = clamp(enemy.y, 132, ARENA.height - 150);
  }
}

function separateEnemies(state) {
  for (let i = 0; i < state.enemies.length; i += 1) {
    const a = state.enemies[i];
    for (let j = i + 1; j < state.enemies.length; j += 1) {
      const b = state.enemies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      const min = a.radius + b.radius + 4;
      if (dist >= min) continue;
      const push = (min - dist) * 0.5;
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

function resolvePlayerContact(state) {
  const player = state.player;
  if (player.invuln > 0) return;
  for (const enemy of state.enemies) {
    if (Math.hypot(player.x - enemy.x, player.y - enemy.y) < enemy.radius + PLAYER.radius) {
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
  state.comboTimer = 0;
  state.shake = 1;
  addShockwave(state, player.x, player.y, 190, '#ff2e88');
  addParticles(state, player.x, player.y, 26, { speed: 330, life: 0.6, color: '#ff2e88', size: 4.2 });
  addPopup(state, player.x, player.y - 38, '-1 LIFE', '#ff2e88');
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

function stepBullets(state, dt) {
  const player = state.player;
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = state.bullets[i];
    bullet.life -= dt;
    if (bullet.homing) {
      steerHoming(state, bullet, dt);
      bullet.trail.push({ x: bullet.x, y: bullet.y });
      const keep = Math.max(3, Math.round(VOLLEY.trailSeconds / dt));
      while (bullet.trail.length > keep) bullet.trail.shift();
    } else {
      bullet.angle = Math.atan2(bullet.vy, bullet.vx);
    }
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;

    const out =
      bullet.x < -60 || bullet.x > ARENA.width + 60 || bullet.y < -60 || bullet.y > ARENA.height + 60;
    if (bullet.life <= 0 || out) {
      state.bullets.splice(i, 1);
      continue;
    }
    if (bullet.homing) {
      if (hitEnemyWith(state, bullet)) state.bullets.splice(i, 1);
      continue;
    }
    if (player.invuln <= 0) {
      if (Math.hypot(player.x - bullet.x, player.y - bullet.y) < bullet.radius + PLAYER.radius) {
        state.bullets.splice(i, 1);
        hurtPlayer(state);
      }
    }
  }
}

function steerHoming(state, bullet, dt) {
  let target = null;
  let bestDist = Infinity;
  for (const enemy of state.enemies) {
    const dist = Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y);
    if (dist < bestDist) {
      bestDist = dist;
      target = enemy;
    }
  }
  if (!target) return;
  const speed = Math.hypot(bullet.vx, bullet.vy);
  const current = Math.atan2(bullet.vy, bullet.vx);
  const desired = Math.atan2(target.y - bullet.y, target.x - bullet.x);
  const turn = clamp(angleDelta(current, desired), -VOLLEY.homingTurn * dt, VOLLEY.homingTurn * dt);
  bullet.vx = Math.cos(current + turn) * speed;
  bullet.vy = Math.sin(current + turn) * speed;
}

function hitEnemyWith(state, bullet) {
  for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = state.enemies[i];
    if (Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y) > enemy.radius + bullet.radius) continue;
    enemy.hp -= bullet.damage ?? 1;
    enemy.flash = 1;
    addParticles(state, bullet.x, bullet.y, 6, { speed: 210, life: 0.28, color: '#ffe6a8', size: 2.6 });
    if (enemy.hp <= 0) destroyEnemy(state, i);
    return true;
  }
  return false;
}

function destroyEnemy(state, index) {
  const enemy = state.enemies[index];
  state.enemies.splice(index, 1);
  const boss = enemy.kind === ENEMY.warden;
  const base = boss ? SCORE.bossKill : SCORE.kill;
  const multiplier = 1 + Math.min(state.combo, SCORE.comboCap) * 0.05;
  const points = Math.round(base * multiplier);
  state.score += points;
  state.combo += 1;
  state.comboTimer = SCORE.comboWindow;
  const color = boss ? '#ffb347' : '#ff2e88';
  addShockwave(state, enemy.x, enemy.y, boss ? 360 : 92, color);
  addParticles(state, enemy.x, enemy.y, boss ? 90 : 16, {
    speed: boss ? 520 : 270,
    life: boss ? 1.2 : 0.55,
    color,
    size: boss ? 6 : 3.4,
  });
  addPopup(state, enemy.x, enemy.y - enemy.radius, `+${points}`, boss ? '#ffe6a8' : '#ffb347');
  state.shake = Math.min(1, state.shake + (boss ? 1 : 0.15));
  state.events.push({ type: EVENTS.kill, boss });
  if (boss) {
    state.phase = PHASE.won;
    state.outcome = 'victory';
    state.best = Math.max(state.best, state.score);
    state.shake = 1;
    state.events.push({ type: EVENTS.victory });
  }
}

function stepWave(state) {
  if (state.spawnQueue.length > 0) return;
  if (state.enemies.length > 0) return;
  if (state.waveBanner > 0.35) return;
  if (state.wave >= WAVE_COUNT) return;
  state.score += SCORE.waveClear;
  addPopup(state, ARENA.width / 2, ARENA.height / 2 - 30, `WAVE CLEAR  +${SCORE.waveClear}`, '#ffe6a8');
  addShockwave(state, ARENA.width / 2, ARENA.height / 2, 260, '#ffb347');
  state.events.push({ type: EVENTS.waveClear, wave: state.wave });
  beginWave(state, state.wave + 1);
}

function addParticles(state, x, y, count, options) {
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

function addShockwave(state, x, y, radius, color) {
  state.shockwaves.push({ x, y, radius: radius * 0.25, target: radius, life: 0.5, maxLife: 0.5, color });
}

function addPopup(state, x, y, text, color) {
  state.popups.push({ x, y, text, color, life: 0.9, maxLife: 0.9 });
}

function stepEffects(state, dt) {
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

/** Ring slot position relative to the player, evenly spaced from the vault angle. */
export function shardOffset(index, count, angle) {
  const step = TAU / Math.max(1, count);
  const a = angle + index * step;
  const r = count > 10 ? VAULT.ringRadius + 8 : VAULT.ringRadius;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}

export function drainEvents(state) {
  const events = state.events;
  state.events = [];
  return events;
}
