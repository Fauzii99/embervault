// The renderer: every pixel of EMBERVAULT, drawn with Canvas 2D. It reads the simulation and never
// writes to it, so the art can be pushed as far as it needs to go without touching the rules.
// Layers, bottom to top: void wash, hex grid, shockwaves, particles, enemies, bullets, shards,
// vault arc, player, popups, HUD, and the full-screen title / end cards.

import { ARENA, PALETTE, PLAYER, SHARD_CAP, TARGET_SCORE, VAULT, WAVE_COUNT } from './config.js';
import { ENEMY, PHASE, shardOffset } from './world.js';

export const SCREEN = { title: 'title', play: 'play', over: 'over', win: 'win' };

const FONT_DISPLAY = '900 64px ui-sans-serif, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const FONT_HUD = '700 20px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
const FONT_HUD_SMALL = '600 14px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
const FONT_HUD_VALUE = '800 30px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
const FONT_HINT = '600 19px ui-sans-serif, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

function hexToRgba(hex, alpha) {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let gridPattern = null;

  /** The hex grid is drawn once into an offscreen tile and reused, so it costs nothing per frame. */
  function buildGrid() {
    const tile = document.createElement('canvas');
    const size = 56;
    tile.width = size * 2;
    tile.height = Math.round(size * Math.sqrt(3));
    const g = tile.getContext('2d');
    g.strokeStyle = PALETTE.grid;
    g.lineWidth = 1.2;
    const r = size;
    const h = tile.height;
    for (const cx of [0, size * 2]) {
      for (let row = -1; row <= 1; row += 1) {
        const cy = (h / 2) * row * 2 + h / 2;
        g.beginPath();
        for (let i = 0; i < 6; i += 1) {
          const a = (Math.PI / 3) * i - Math.PI / 6;
          const x = cx + Math.cos(a) * r * 0.62;
          const y = cy + Math.sin(a) * r * 0.62;
          if (i === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.closePath();
        g.stroke();
      }
    }
    return ctx.createPattern(tile, 'repeat');
  }

  function drawBackground(state) {
    const g = ctx.createRadialGradient(ARENA.width * 0.5, ARENA.height * 0.52, 80, ARENA.width * 0.5, ARENA.height * 0.5, ARENA.width * 0.72);
    g.addColorStop(0, '#241035');
    g.addColorStop(0.55, PALETTE.void);
    g.addColorStop(1, PALETTE.voidDeep);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, ARENA.width, ARENA.height);

    if (!gridPattern) gridPattern = buildGrid();
    ctx.save();
    ctx.globalAlpha = 0.5 + Math.sin(state.time * 0.7) * 0.06;
    ctx.fillStyle = gridPattern;
    ctx.fillRect(0, 0, ARENA.width, ARENA.height);
    ctx.restore();

    // A soft amber pool of light under the player anchors every frame.
    const p = state.player;
    const pool = ctx.createRadialGradient(p.x, p.y, 6, p.x, p.y, 340);
    pool.addColorStop(0, hexToRgba(PALETTE.amber, state.vaultOpen ? 0.22 : 0.13));
    pool.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = pool;
    ctx.fillRect(0, 0, ARENA.width, ARENA.height);

    ctx.strokeStyle = hexToRgba(PALETTE.gridBright, 0.7);
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, ARENA.width - 4, ARENA.height - 4);
  }

  function drawShockwaves(state) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const wave of state.shockwaves) {
      const t = wave.life / wave.maxLife;
      ctx.strokeStyle = hexToRgba(wave.color, t * 0.75);
      ctx.lineWidth = 2 + t * 5;
      ctx.beginPath();
      ctx.arc(wave.x, wave.y, Math.max(1, wave.radius), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawParticles(state) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of state.particles) {
      const t = p.life / p.maxLife;
      ctx.fillStyle = hexToRgba(p.color, t * 0.9);
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, p.size * t), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** Each enemy type has its own silhouette, so a still frame names its own threat. */
  function drawEnemies(state) {
    for (const enemy of state.enemies) {
      const flash = enemy.flash;
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.rotate(enemy.angle);
      ctx.shadowColor = hexToRgba(PALETTE.magenta, 0.8);
      ctx.shadowBlur = 18;

      if (enemy.kind === ENEMY.spitter) {
        ctx.fillStyle = flash > 0 ? PALETTE.white : PALETTE.magenta;
        ctx.beginPath();
        for (let i = 0; i < 3; i += 1) {
          const a = (Math.PI * 2 * i) / 3 - Math.PI / 2;
          const x = Math.cos(a) * enemy.radius;
          const y = Math.sin(a) * enemy.radius;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = hexToRgba(PALETTE.magentaDeep, 0.9);
        ctx.lineWidth = 3;
        ctx.stroke();
      } else if (enemy.kind === ENEMY.orbiter) {
        ctx.strokeStyle = flash > 0 ? PALETTE.white : PALETTE.magenta;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, enemy.radius, 0.4, Math.PI * 1.6);
        ctx.stroke();
        ctx.fillStyle = hexToRgba(PALETTE.magentaDeep, 0.9);
        ctx.beginPath();
        ctx.arc(0, 0, enemy.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (enemy.kind === ENEMY.lancer) {
        ctx.fillStyle = flash > 0 ? PALETTE.white : PALETTE.magenta;
        ctx.beginPath();
        ctx.moveTo(enemy.radius * 1.35, 0);
        ctx.lineTo(-enemy.radius * 0.7, enemy.radius * 0.8);
        ctx.lineTo(-enemy.radius * 0.7, -enemy.radius * 0.8);
        ctx.closePath();
        ctx.fill();
      } else {
        // Warden: a wide double ring with a bright core, unmistakably the last wave.
        ctx.strokeStyle = PALETTE.amber;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = hexToRgba(PALETTE.magenta, 0.9);
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, enemy.radius * 0.68, 0.3, Math.PI * 1.7);
        ctx.stroke();
        ctx.fillStyle = hexToRgba(PALETTE.amberHot, 0.95);
        ctx.beginPath();
        ctx.arc(0, 0, enemy.radius * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      if (enemy.kind === ENEMY.warden) {
        const width = 300;
        const ratio = Math.max(0, enemy.hp / enemy.maxHp);
        ctx.fillStyle = hexToRgba(PALETTE.voidDeep, 0.9);
        ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 34, width, 12);
        ctx.fillStyle = PALETTE.amber;
        ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 34, width * ratio, 12);
        ctx.strokeStyle = hexToRgba(PALETTE.amberHot, 0.6);
        ctx.lineWidth = 1.5;
        ctx.strokeRect(enemy.x - width / 2, enemy.y - enemy.radius - 34, width, 12);
        ctx.font = FONT_HUD_SMALL;
        ctx.fillStyle = PALETTE.amberHot;
        ctx.textAlign = 'center';
        ctx.fillText('THE WARDEN', enemy.x, enemy.y - enemy.radius - 44);
      }
    }
  }

  function drawBullets(state) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const bullet of state.bullets) {
      if (bullet.homing) {
        // Volley shards drag a bright trail: the release reads as a burst of light.
        const trail = bullet.trail ?? [];
        for (let i = 0; i < trail.length; i += 1) {
          const t = i / Math.max(1, trail.length);
          ctx.fillStyle = hexToRgba(PALETTE.amber, t * 0.45);
          ctx.beginPath();
          ctx.arc(trail[i].x, trail[i].y, 2 + t * 4.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = PALETTE.amberHot;
        ctx.shadowColor = PALETTE.amber;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = hexToRgba(PALETTE.white, 0.8);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.fillStyle = PALETTE.magenta;
        ctx.shadowColor = PALETTE.magenta;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hexToRgba(PALETTE.white, 0.85);
        ctx.beginPath();
        ctx.arc(bullet.x - bullet.radius * 0.2, bullet.y - bullet.radius * 0.2, bullet.radius * 0.42, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /** The shard ring: the game's signature. One amber shard per captured shot, spinning slowly. */
  function drawShards(state) {
    const count = state.shards.length;
    if (count === 0) return;
    const p = state.player;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < count; i += 1) {
      const offset = shardOffset(i, count, state.vaultAngle);
      const x = p.x + offset.x;
      const y = p.y + offset.y;
      const pulse = 0.75 + Math.sin(state.time * 6 + i * 0.7) * 0.25;
      ctx.strokeStyle = hexToRgba(PALETTE.amber, 0.28);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = PALETTE.amber;
      ctx.shadowColor = PALETTE.ember;
      ctx.shadowBlur = 18 + pulse * 10;
      ctx.beginPath();
      ctx.arc(x, y, 6.2 + pulse * 1.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.amberHot;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(x - 1, y - 1, 2.4 + pulse, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** The open vault arc: a bright amber wall on the side the mouse aims. */
  function drawVault(state) {
    const arc = state.vaultArc;
    if (arc < 0.02) return;
    const p = state.player;
    const alpha = Math.min(1, arc);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = hexToRgba(PALETTE.amber, 0.16 * alpha);
    ctx.lineWidth = 26 * arc;
    ctx.beginPath();
    ctx.arc(p.x, p.y, VAULT.radius, state.vaultAngle - VAULT.halfArc, state.vaultAngle + VAULT.halfArc);
    ctx.stroke();
    ctx.strokeStyle = hexToRgba(PALETTE.amberHot, 0.85 * alpha);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, VAULT.radius, state.vaultAngle - VAULT.halfArc, state.vaultAngle + VAULT.halfArc);
    ctx.stroke();
    // Faint reach circle at full open so the catch range is always legible.
    if (arc > 0.6) {
      ctx.strokeStyle = hexToRgba(PALETTE.amberHot, 0.42 * alpha);
      ctx.lineWidth = 2.2;
      ctx.setLineDash([9, 9]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, VAULT.radius + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function drawPlayer(state) {
    const p = state.player;
    const blinking = p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0;
    if (blinking) return;
    ctx.save();
    ctx.translate(p.x, p.y);

    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 60);
    glow.addColorStop(0, hexToRgba(PALETTE.amberHot, 0.55));
    glow.addColorStop(0.45, hexToRgba(PALETTE.amber, 0.22));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 60, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(state.time * 0.9);
    ctx.fillStyle = PALETTE.core;
    ctx.shadowColor = PALETTE.amber;
    ctx.shadowBlur = 22;
    ctx.beginPath();
    for (let i = 0; i < 3; i += 1) {
      const a = (Math.PI * 2 * i) / 3 - Math.PI / 2;
      const x = Math.cos(a) * PLAYER.radius * 1.15;
      const y = Math.sin(a) * PLAYER.radius * 1.15;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    if (p.hurtFlash > 0) {
      ctx.strokeStyle = hexToRgba(PALETTE.magenta, p.hurtFlash);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, PLAYER.radius * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPopups(state) {
    ctx.save();
    ctx.textAlign = 'center';
    for (const popup of state.popups) {
      const t = popup.life / popup.maxLife;
      ctx.font = FONT_HINT;
      ctx.fillStyle = hexToRgba(popup.color, t);
      ctx.fillText(popup.text, popup.x, popup.y);
    }
    ctx.restore();
  }

  /** A labelled HUD block: caption above, loud value below. Readable when the sheet is shrunk. */
  function hudBlock(x, y, caption, value, color, align = 'left') {
    ctx.textAlign = align;
    ctx.font = FONT_HUD_SMALL;
    ctx.fillStyle = hexToRgba(PALETTE.amber, 0.72);
    ctx.fillText(caption, x, y);
    ctx.font = FONT_HUD_VALUE;
    ctx.fillStyle = color;
    ctx.fillText(value, x, y + 30);
  }

  function drawHud(state) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 10;

    hudBlock(40, 44, 'SCORE', state.score.toLocaleString('en-US'), PALETTE.white);
    hudBlock(ARENA.width / 2, 44, 'WAVE', `${Math.min(state.wave, WAVE_COUNT)} / ${WAVE_COUNT}`, PALETTE.white, 'center');
    const waveBarWidth = 190;
    const waveRatio = Math.min(1, state.wave / WAVE_COUNT);
    ctx.fillStyle = hexToRgba(PALETTE.white, 0.16);
    ctx.fillRect(ARENA.width / 2 - waveBarWidth / 2, 82, waveBarWidth, 5);
    ctx.fillStyle = PALETTE.amber;
    ctx.fillRect(ARENA.width / 2 - waveBarWidth / 2, 82, waveBarWidth * waveRatio, 5);
    hudBlock(ARENA.width - 40, 44, 'BEST', Math.max(state.best, state.score).toLocaleString('en-US'), hexToRgba(PALETTE.amber, 0.9), 'right');

    // VAULT counter: the mechanic in one number, with a pip bar so a full ring is obvious.
    const filled = state.shards.length;
    const vaultColor = filled >= SHARD_CAP ? PALETTE.amberHot : filled > 0 ? PALETTE.amber : hexToRgba(PALETTE.white, 0.55);
    hudBlock(40, ARENA.height - 84, 'VAULT', `${filled} / ${SHARD_CAP}`, vaultColor);
    const pipWidth = 13;
    const pipGap = 4;
    for (let i = 0; i < SHARD_CAP; i += 1) {
      const x = 40 + i * (pipWidth + pipGap);
      const y = ARENA.height - 38;
      ctx.fillStyle = i < filled ? PALETTE.amber : hexToRgba(PALETTE.white, 0.14);
      ctx.shadowBlur = i < filled ? 12 : 0;
      ctx.fillRect(x, y, pipWidth, 9);
    }
    ctx.shadowBlur = 10;

    // COMBO, loud only when it is worth reading.
    const comboValue = state.combo > 1 ? `x${state.combo}` : '—';
    hudBlock(ARENA.width / 2, ARENA.height - 84, 'COMBO', comboValue, state.combo > 1 ? PALETTE.amberHot : hexToRgba(PALETTE.white, 0.5), 'center');

    // LIVES as pips, so it reads at a glance without counting words.
    ctx.textAlign = 'right';
    ctx.font = FONT_HUD_SMALL;
    ctx.fillStyle = hexToRgba(PALETTE.amber, 0.72);
    ctx.fillText('LIVES', ARENA.width - 40, ARENA.height - 84);
    for (let i = 0; i < PLAYER.lives; i += 1) {
      const x = ARENA.width - 52 - i * 34;
      const y = ARENA.height - 44;
      ctx.fillStyle = i < state.lives ? PALETTE.white : hexToRgba(PALETTE.white, 0.16);
      ctx.shadowColor = PALETTE.amber;
      ctx.shadowBlur = i < state.lives ? 14 : 0;
      ctx.beginPath();
      ctx.moveTo(x, y - 10);
      ctx.lineTo(x + 9, y + 8);
      ctx.lineTo(x - 9, y + 8);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    if (state.waveBanner > 0) drawWaveBanner(state);
    if (state.hintTimer > 0) drawHint(state);
  }

  function drawWaveBanner(state) {
    const t = Math.min(1, state.waveBanner * 1.6);
    const isBoss = state.wave >= WAVE_COUNT;
    ctx.save();
    ctx.globalAlpha = t;
    ctx.textAlign = 'center';
    ctx.font = FONT_DISPLAY;
    ctx.fillStyle = isBoss ? PALETTE.amber : PALETTE.white;
    ctx.shadowColor = isBoss ? PALETTE.amber : PALETTE.violet;
    ctx.shadowBlur = 28;
    const label = isBoss ? 'FINAL WAVE — THE WARDEN' : `WAVE ${state.wave}`;
    ctx.fillText(label, ARENA.width / 2, ARENA.height / 2 - 150);
    if (!isBoss) {
      ctx.font = FONT_HINT;
      ctx.fillStyle = hexToRgba(PALETTE.amber, 0.9);
      ctx.shadowBlur = 12;
      ctx.fillText('HOLD to catch, RELEASE to fire', ARENA.width / 2, ARENA.height / 2 - 108);
    }
    ctx.restore();
  }

  /** The permanent teaching line: the mechanic stated in words, always on screen early on. */
  function drawHint(state) {
    const alpha = Math.min(1, state.hintTimer / 1.5) * 0.9;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.font = FONT_HINT;
    const text = state.vaultOpen
      ? 'VAULT OPEN — no gun, half speed · RELEASE to fire the ring'
      : 'HOLD to catch, RELEASE to fire · the ring is your ammo';
    const width = ctx.measureText(text).width + 44;
    ctx.fillStyle = 'rgba(10, 4, 16, 0.72)';
    ctx.beginPath();
    ctx.roundRect(ARENA.width / 2 - width / 2, ARENA.height - 148, width, 34, 17);
    ctx.fill();
    ctx.fillStyle = PALETTE.amberHot;
    ctx.shadowColor = PALETTE.ember;
    ctx.shadowBlur = 16;
    ctx.fillText(text, ARENA.width / 2, ARENA.height - 125);
    ctx.restore();
  }

  function drawTitle(state) {
    ctx.save();
    ctx.fillStyle = 'rgba(8, 4, 16, 0.62)';
    ctx.fillRect(0, 0, ARENA.width, ARENA.height);
    ctx.textAlign = 'center';

    ctx.font = FONT_DISPLAY;
    ctx.fillStyle = PALETTE.white;
    ctx.shadowColor = PALETTE.amber;
    ctx.shadowBlur = 36;
    ctx.fillText('EMBERVAULT', ARENA.width / 2, 232);

    ctx.font = FONT_HINT;
    ctx.fillStyle = PALETTE.amber;
    ctx.shadowBlur = 14;
    ctx.fillText('Catch the fire. Spend it back.', ARENA.width / 2, 274);

    const lines = [
      ['HOLD', 'open the vault — it swallows enemy fire into a ring of shards'],
      ['RELEASE', 'fire the whole ring as a homing volley'],
      ['TRADE-OFF', 'the vault costs you your gun and 40% of your speed'],
    ];
    ctx.textAlign = 'left';
    lines.forEach(([key, text], i) => {
      const y = 348 + i * 40;
      ctx.font = FONT_HUD;
      ctx.fillStyle = PALETTE.amberHot;
      ctx.shadowBlur = 10;
      ctx.fillText(key, ARENA.width / 2 - 320, y);
      ctx.font = FONT_HINT;
      ctx.fillStyle = hexToRgba(PALETTE.white, 0.86);
      ctx.fillText(text, ARENA.width / 2 - 168, y);
    });

    ctx.textAlign = 'center';
    ctx.font = FONT_HUD;
    ctx.fillStyle = hexToRgba(PALETTE.white, 0.7);
    ctx.shadowBlur = 8;
    ctx.fillText('SURVIVE 10 WAVES · THE WARDEN WAITS AT THE LAST', ARENA.width / 2, 500);

    const pulse = 0.6 + Math.sin(state.time * 3.4) * 0.4;
    ctx.font = FONT_HUD_VALUE;
    ctx.fillStyle = hexToRgba(PALETTE.amberHot, 0.55 + pulse * 0.45);
    ctx.shadowColor = PALETTE.amber;
    ctx.shadowBlur = 22;
    ctx.fillText('CLICK OR PRESS SPACE TO BEGIN', ARENA.width / 2, 580);
    ctx.restore();
  }

  function drawEndCard(state, won) {
    ctx.save();
    ctx.fillStyle = won ? 'rgba(28, 12, 6, 0.74)' : 'rgba(10, 4, 16, 0.78)';
    ctx.fillRect(0, 0, ARENA.width, ARENA.height);
    ctx.textAlign = 'center';

    ctx.font = FONT_DISPLAY;
    ctx.fillStyle = won ? PALETTE.amber : PALETTE.magenta;
    ctx.shadowColor = won ? PALETTE.amber : PALETTE.magenta;
    ctx.shadowBlur = 34;
    ctx.fillText(won ? 'VAULT SEALED' : 'THE VAULT BREAKS', ARENA.width / 2, 216);

    ctx.font = FONT_HINT;
    ctx.fillStyle = hexToRgba(PALETTE.white, 0.82);
    ctx.shadowBlur = 10;
    ctx.fillText(won ? 'You held the line through all ten waves.' : `You fell on wave ${Math.min(state.wave, WAVE_COUNT)}.`, ARENA.width / 2, 256);

    ctx.font = FONT_HUD_SMALL;
    ctx.fillStyle = hexToRgba(PALETTE.amber, 0.75);
    ctx.fillText('FINAL SCORE', ARENA.width / 2, 320);
    ctx.font = '900 88px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
    ctx.fillStyle = PALETTE.white;
    ctx.shadowBlur = 26;
    ctx.fillText(state.score.toLocaleString('en-US'), ARENA.width / 2, 400);

    ctx.font = FONT_HUD;
    ctx.fillStyle = hexToRgba(PALETTE.white, 0.72);
    ctx.shadowBlur = 8;
    ctx.fillText(`BEST ${state.best.toLocaleString('en-US')}   ·   SHOTS CAUGHT ${state.totalAbsorbed}`, ARENA.width / 2, 448);
    if (!won && state.score >= TARGET_SCORE) {
      ctx.fillStyle = PALETTE.amber;
      ctx.fillText(`TARGET ${TARGET_SCORE.toLocaleString('en-US')} REACHED`, ARENA.width / 2, 484);
    }

    const pulse = 0.6 + Math.sin(state.time * 3.4) * 0.4;
    ctx.font = FONT_HUD_VALUE;
    ctx.fillStyle = hexToRgba(PALETTE.amberHot, 0.55 + pulse * 0.45);
    ctx.shadowColor = PALETTE.amber;
    ctx.shadowBlur = 20;
    ctx.fillText('PRESS R OR ENTER TO RESTART', ARENA.width / 2, 562);
    ctx.restore();
  }

  function render(state, view) {
    const shakeX = (Math.random() - 0.5) * state.shake * 16;
    const shakeY = (Math.random() - 0.5) * state.shake * 16;
    ctx.save();
    ctx.translate(shakeX, shakeY);
    drawBackground(state);
    drawShockwaves(state);
    drawParticles(state);
    drawEnemies(state);
    drawVault(state);
    drawBullets(state);
    drawShards(state);
    drawPlayer(state);
    drawPopups(state);
    ctx.restore();

    if (view === SCREEN.title) {
      drawTitle(state);
      return;
    }
    drawHud(state);
    if (view === SCREEN.over) drawEndCard(state, false);
    else if (view === SCREEN.win) drawEndCard(state, true);
  }

  /** Which full-screen card the current phase wants. */
  function screenFor(state) {
    if (state.phase === PHASE.title) return SCREEN.title;
    if (state.phase === PHASE.dead) return SCREEN.over;
    if (state.phase === PHASE.won) return SCREEN.win;
    return SCREEN.play;
  }

  return { render, screenFor, resize: () => {} };
}
