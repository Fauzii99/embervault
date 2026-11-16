// The title screen and the two end cards, all three dimming a live arena behind their copy.

import { ARENA } from './config.js';
import { PALETTE } from './palette.js';
import { formatScore, FONT } from './typeset.js';

export function drawTitleScreen(ctx, state) {
  ctx.save();
  dimArena(ctx, 0.46);
  const cx = ARENA.width / 2;
  ctx.textAlign = 'center';

  // A soft scrim behind the copy keeps the rules legible over whatever the arena is doing.
  const scrim = ctx.createRadialGradient(cx, 340, 120, cx, 340, 560);
  scrim.addColorStop(0, 'rgba(9,4,17,0.78)');
  scrim.addColorStop(0.7, 'rgba(9,4,17,0.42)');
  scrim.addColorStop(1, 'rgba(9,4,17,0)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 90, ARENA.width, 520);

  ctx.shadowColor = 'rgba(255,179,71,0.55)';
  ctx.shadowBlur = 44;
  ctx.font = `800 104px ${FONT}`;
  ctx.fillStyle = PALETTE.white;
  ctx.fillText('EMBERVAULT', cx, 186);

  ctx.shadowBlur = 0;
  ctx.font = `700 21px ${FONT}`;
  ctx.fillStyle = PALETTE.amber;
  ctx.fillText('Catch the fire. Spend it back.', cx, 226);

  const rows = [
    ['HOLD', 'open the vault — it swallows enemy fire into a ring of shards'],
    ['RELEASE', 'fire the whole ring as a homing volley'],
    ['TRADE-OFF', 'the vault costs you your gun and 40% of your speed'],
  ];
  const labelX = 372;
  rows.forEach(([key, copy], i) => {
    const y = 306 + i * 46;
    ctx.textAlign = 'right';
    ctx.font = `800 17px ${FONT}`;
    ctx.fillStyle = PALETTE.amber;
    ctx.fillText(key, labelX, y);
    ctx.textAlign = 'left';
    ctx.font = `600 18px ${FONT}`;
    ctx.fillStyle = 'rgba(255,244,226,0.92)';
    ctx.fillText(copy, labelX + 30, y);
  });

  ctx.textAlign = 'center';
  ctx.font = `700 14px ${FONT}`;
  ctx.fillStyle = 'rgba(255,230,168,0.72)';
  ctx.fillText('S U R V I V E   1 0   W A V E S   ·   T H E   W A R D E N   W A I T S   A T   T H E   L A S T', cx, 478);

  const pulse = 0.62 + Math.sin(state.time * 3.4) * 0.32;
  ctx.globalAlpha = pulse;
  ctx.shadowColor = PALETTE.amber;
  ctx.shadowBlur = 22;
  ctx.font = `800 22px ${FONT}`;
  ctx.fillStyle = PALETTE.amberHot;
  ctx.fillText('CLICK OR PRESS SPACE TO BEGIN', cx, 556);
  ctx.restore();
}

export function drawDefeatCard(ctx, state) {
  drawEndCard(ctx, state, false);
}

export function drawVictoryCard(ctx, state) {
  drawEndCard(ctx, state, true);
}

function drawEndCard(ctx, state, won) {
  ctx.save();
  dimArena(ctx, 0.72);
  const cx = ARENA.width / 2;
  ctx.textAlign = 'center';

  ctx.shadowBlur = 40;
  if (won) {
    ctx.shadowColor = 'rgba(255,179,71,0.6)';
    ctx.font = `800 78px ${FONT}`;
    ctx.fillStyle = PALETTE.amber;
    ctx.fillText('VAULT SEALED', cx, 208);
    ctx.shadowBlur = 0;
    ctx.font = `600 20px ${FONT}`;
    ctx.fillStyle = PALETTE.white;
    ctx.fillText('You held the line through all ten waves.', cx, 248);
  } else {
    ctx.shadowColor = 'rgba(255,46,136,0.6)';
    ctx.font = `800 72px ${FONT}`;
    ctx.fillStyle = PALETTE.magenta;
    ctx.fillText('THE VAULT BREAKS', cx, 208);
    ctx.shadowBlur = 0;
    ctx.font = `600 20px ${FONT}`;
    ctx.fillStyle = PALETTE.white;
    ctx.fillText(`You fell on wave ${state.wave}.`, cx, 248);
  }

  ctx.font = `700 13px ${FONT}`;
  ctx.fillStyle = PALETTE.amber;
  ctx.fillText('F I N A L   S C O R E', cx, 322);

  ctx.shadowColor = 'rgba(255,230,168,0.4)';
  ctx.shadowBlur = 30;
  ctx.font = `800 86px ${FONT}`;
  ctx.fillStyle = PALETTE.white;
  ctx.fillText(formatScore(state.score), cx, 406);
  ctx.shadowBlur = 0;

  ctx.font = `700 14px ${FONT}`;
  ctx.fillStyle = 'rgba(255,250,242,0.7)';
  ctx.fillText(
    `BEST ${formatScore(Math.max(state.best, state.score))}   ·   SHOTS CAUGHT ${state.totalAbsorbed}`,
    cx,
    446,
  );

  const pulse = 0.82 + Math.sin(state.time * 3.2) * 0.18;
  ctx.globalAlpha = pulse;
  ctx.shadowColor = PALETTE.amber;
  ctx.shadowBlur = 20;
  ctx.font = `800 21px ${FONT}`;
  ctx.fillStyle = PALETTE.amberHot;
  ctx.fillText('PRESS R OR ENTER TO RESTART', cx, 528);
  ctx.restore();
}

function dimArena(ctx, alpha) {
  ctx.fillStyle = `rgba(9,4,17,${alpha})`;
  ctx.fillRect(0, 0, ARENA.width, ARENA.height);
}
