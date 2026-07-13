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
