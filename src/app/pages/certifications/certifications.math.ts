/**
 * Pure motion math for the certifications hover preview. Kept out of the
 * component (same split as scroll-loop.math / morph-driver) so the tick stays
 * a thin write-only shell and the numbers are unit-testable without a DOM.
 */

/**
 * Frame-rate-independent exponential smoothing factor: the fraction of the
 * remaining distance to close this frame. `base` is the per-frame fraction at
 * a 60Hz reference, so the feel is identical at 60Hz and 120Hz (same formula
 * as the Work showcase sweep).
 */
export function smoothingK(dt: number, base: number): number {
  if (dt <= 0) {
    return base;
  }
  return 1 - Math.pow(1 - base, dt / (1000 / 60));
}

/**
 * Map smoothed horizontal cursor velocity (px/ms) to a tilt in degrees,
 * clamped so a violent fling never flips the preview into a spin.
 */
export function tiltFromVelocity(vx: number, maxDeg = 8, degPerPxMs = 6): number {
  const deg = vx * degPerPxMs;
  return Math.max(-maxDeg, Math.min(maxDeg, deg));
}

/**
 * Shutter-mask scale pair for reveal progress p (0 closed → 1 open): the
 * overflow-hidden mask scales to `outer` while its child counter-scales to
 * `inner`, so the image itself never appears stretched. Progress is floored
 * at epsilon because inner = 1/outer diverges at 0 — at the floor the mask is
 * a hairline slit, visually closed.
 */
export function maskScales(p: number, epsilon = 0.04): { outer: number; inner: number } {
  const clamped = Math.max(epsilon, Math.min(1, p));
  return { outer: clamped, inner: 1 / clamped };
}

/** easeOutCubic — the reveal opens fast and settles softly. */
export function easeOutCubic(p: number): number {
  const t = Math.max(0, Math.min(1, p));
  return 1 - Math.pow(1 - t, 3);
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * FLIP transform for the spotlight open: the values that, applied to the
 * destination element (transform-origin top-left), make it occupy the source
 * rect — it then transitions back to identity, so the certificate appears to
 * grow out of the cursor preview. Degenerate rects fall back to identity
 * scale so a hidden source can never produce Infinity/NaN.
 */
export function flipTransform(
  src: Rect,
  dst: Rect,
): { tx: number; ty: number; sx: number; sy: number } {
  return {
    tx: src.x - dst.x,
    ty: src.y - dst.y,
    sx: dst.w > 0 && src.w > 0 ? src.w / dst.w : 1,
    sy: dst.h > 0 && src.h > 0 ? src.h / dst.h : 1,
  };
}
