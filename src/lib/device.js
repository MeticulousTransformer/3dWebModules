/**
 * device.js — "how much can this device take?"
 *
 * One honest guess, made once, used by every module to size its particle
 * counts and geometry detail. Mobile first means we assume the small budget
 * and only spend more when we can see the machine can afford it.
 */

/** true on touch devices, where there is no hover and pixels are precious. */
export function isTouch() {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

/**
 * 'low' | 'high'. Deliberately only two tiers — more tiers means more branches
 * to reason about, and two is enough to keep phones smooth.
 */
export function qualityTier() {
  if (typeof navigator === 'undefined') return 'high';
  const cores = navigator.hardwareConcurrency || 4;
  const smallScreen = typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 700;
  if (isTouch() || cores <= 4 || smallScreen) return 'low';
  return 'high';
}

/** Pick between two values based on the tier. `scale(2000, 8000)` reads well. */
export function scale(low, high) {
  return qualityTier() === 'low' ? low : high;
}
