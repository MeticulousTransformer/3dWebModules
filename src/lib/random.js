/**
 * random.js — the same "random" numbers every time you ask.
 *
 * Math.random() cannot be seeded, so anything built with it comes out
 * different on every rebuild. When a module rebuilds because someone moved a
 * slider, you want the thing you were looking at back — with one change, not a
 * whole new one. This is mulberry32: small, fast, good enough for scattering.
 *
 *   const random = createRandom(7);
 *   random();            // 0..1
 *   random.between(2, 5);
 *   random.pick(['a', 'b', 'c']);
 */
export function createRandom(seed = 1) {
  let state = seed >>> 0;

  function random() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  random.between = (low, high) => low + random() * (high - low);
  random.pick = (list) => list[Math.floor(random() * list.length)];
  random.chance = (probability) => random() < probability;

  return random;
}
