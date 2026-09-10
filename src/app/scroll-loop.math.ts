/**
 * Pure cycle math for the looping star-map scroll. No DOM, no framework, no
 * `window` — the app shell reads `scrollY` / section `offsetTop` / `innerHeight`
 * and passes them in; these functions only compute. That keeps the band
 * heuristic and the seam-wrap arithmetic a unit-test surface
 * (see scroll-loop.math.spec.ts), mirroring `constellation-morph.ts`.
 */

/**
 * Map a scroll offset to continuous destination units (0..cycleLength).
 *
 * `anchors` are the section offsets in scroll order; the LAST is the Loop clone,
 * so `anchors.length - 1 === cycleLength` and this returns that value at/past the
 * clone (the looping constellation reads it as Home again).
 *
 * Each figure RESTS at an integer while its section is in view and only morphs
 * over a fixed band (~one viewport) right before each boundary, so every Travel
 * lasts the same scroll distance regardless of section height — without it a tall
 * section (the Work showcase) would stretch one morph across the whole section
 * and the figure would never settle.
 */
export function positionFor(
  scrollY: number,
  anchors: readonly number[],
  viewportHeight: number,
): number {
  if (anchors.length === 0) {
    return 0;
  }
  const last = anchors.length - 1;
  if (scrollY <= anchors[0]) {
    return 0;
  }
  const band = viewportHeight * 0.85;
  for (let k = 0; k < last; k++) {
    if (scrollY < anchors[k + 1]) {
      const seg = Math.min(band, Math.max(1, anchors[k + 1] - anchors[k]));
      const start = anchors[k + 1] - seg;
      return scrollY <= start ? k : k + (scrollY - start) / seg;
    }
  }
  // At/after the clone's top (= cycleLength, read as Home again); the wrap fires
  // here, so this value barely renders.
  return last;
}

/**
 * The active destination index for a continuous `position` (0..cycleLength):
 * the nearest resting destination, wrapping at the seam.
 *
 * Destinations rest at integers 0..cycleLength−1; `position === cycleLength` is
 * the Loop clone, which reads as destination 0 (Home) again — so the rounded
 * value is taken modulo `cycleLength`. Rounding means the active index flips at
 * the midpoint of each morph band (k+0.5), which lands within ~0.08vh of the old
 * nav midpoint-probe crossing (see ADR-0007). Returns 0 before the shell has
 * measured (`cycleLength <= 0`), matching the pre-measure fallback elsewhere.
 */
export function activeIndexFor(position: number, cycleLength: number): number {
  if (cycleLength <= 0) {
    return 0;
  }
  return Math.round(position) % cycleLength;
}

/**
 * How close to the seam still counts as reaching it, in CSS pixels.
 *
 * `scrollY` is fractional on a non-integer device pixel ratio and under browser
 * zoom, and `offsetTop` is rounded — so the bottom of the page can settle a
 * fraction of a pixel short of `wrapAt` and never satisfy a strict `>=`. One
 * pixel of slack is far below the seam's visual tolerance (the clone is
 * pixel-identical to Home for a whole viewport around this point) and turns a
 * loop that could silently dead-end into one that always closes.
 */
const SEAM_EPSILON = 1;

/**
 * The seamless one-direction wrap. At/past the clone's top — one cycle down,
 * where the clone is pixel-identical to real Home — return the offset the shell
 * should `scrollTo`: `scrollY - wrapAt`, which preserves any momentum overshoot
 * (N px past the seam lands N px into the real Home). Below the seam, or before
 * the shell has measured (`wrapAt <= 0`), return null (no wrap).
 *
 * The clamp is deliberately NOT applied to the returned offset: overshoot is
 * real scroll distance and must survive the wrap, while a sub-pixel undershoot
 * lands within a pixel of Home's top, which is indistinguishable.
 */
export function wrapOffset(scrollY: number, wrapAt: number): number | null {
  if (wrapAt > 0 && scrollY >= wrapAt - SEAM_EPSILON) {
    return Math.max(0, scrollY - wrapAt);
  }
  return null;
}
