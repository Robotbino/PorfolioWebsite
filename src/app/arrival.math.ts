/**
 * Where a destination's arrival scale is anchored (its `--arrive-from`), as a
 * percentage of the section's height from its top: the point of the section
 * level with the top of the viewport, clamped to the section. `top` and
 * `height` are the section's viewport rect, which the scale never touches (it
 * is applied to the section's child, not the section).
 *
 * At an IntersectionObserver crossing that is the edge coming into view: 0
 * when the section enters from below, 100 (less the sliver the observer's
 * one-frame lag lets in) when it enters from above. The edge seen first holds
 * still and the rest settles toward it. A nav jump can land partway down a
 * section instead (the Projects link stops inside Work, which is ~7 viewports
 * tall), and anchoring that on an edge thousands of pixels off screen would
 * turn a 2.5% scale into a ~100px slide of everything in view; anchoring on
 * the viewport keeps what is on screen in place.
 */
export function arrivalOrigin(top: number, height: number): number {
  if (!(height > 0)) {
    return 0;
  }
  return Math.min(100, Math.max(0, (-top / height) * 100));
}
