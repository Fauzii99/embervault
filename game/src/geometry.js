// Two pieces of arithmetic the simulation needs everywhere: a clamp and the shortest arc between
// two angles. Nothing here knows about the game.

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function angleDelta(from, to) {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}
