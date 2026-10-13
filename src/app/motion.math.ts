/**
 * Pure motion math shared across the app's rAF systems (the Work showcase sweep,
 * the certifications hover preview). Kept DOM-free — like scroll-loop.math and
 * constellation-morph — so the ticks that use it stay thin write-only shells and
 * the numbers are unit-testable without a browser.
 */

/**
 * Frame-rate-independent exponential smoothing factor: the fraction of the
 * remaining distance to close this frame. `base` is the per-frame fraction at a
 * 60Hz reference, so the feel is identical at 60Hz and 120Hz — the total
 * distance closed over one 60Hz frame equals that of two 120Hz frames.
 */
export function smoothingK(dt: number, base: number): number {
  if (dt <= 0) {
    return base;
  }
  return 1 - Math.pow(1 - base, dt / (1000 / 60));
}

/**
 * One smoothing step from `current` toward `target` (`k` from smoothingK), landing
 * exactly on the target once within 0.001. Without the snap an exponential ease
 * never arrives, and a caller that skips unchanged writes would keep writing
 * ever-smaller differences forever.
 */
export function easeToward(current: number, target: number, k: number): number {
  const next = current + (target - current) * k;
  return Math.abs(target - next) < 0.001 ? target : next;
}

/**
 * How far a showcase card sits from the middle of the stage, in card steps:
 * 0 when centred, ±1 once it is a whole step (`pitch`, the distance between
 * neighbouring card centres) to the right or left. Clamped, because a card two
 * steps out is already behind the stage mask and should hold its end pose
 * rather than keep turning.
 */
export function cardOffset(center: number, focusX: number, pitch: number): number {
  if (pitch <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(-1, (center - focusX) / pitch));
}
