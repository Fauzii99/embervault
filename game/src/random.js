// Deterministic randomness: xorshift32. Screenshot scenes replay from their seed, and a restart
// is a new but reproducible run. No Math.random in the simulation.

export function makeRng(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    pick: (list) => list[Math.floor(next() * list.length)],
    angle: () => next() * Math.PI * 2,
    chance: (p) => next() < p,
  };
}
