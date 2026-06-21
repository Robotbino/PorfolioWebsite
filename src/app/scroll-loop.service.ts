import { Injectable, signal } from '@angular/core';
import { positionFor, wrapOffset as computeWrapOffset } from './scroll-loop.math';

/**
 * Owns the looping star-map's **Cycle**: the reader's continuous scroll position
 * (in "destination" units — 0 = first figure, 1 = second, …, wrapping at
 * `cycleLength`), the cycle length itself, and the seam wrap. The app shell does
 * the DOM I/O (reads `scrollY` / section `offsetTop` / `innerHeight`, applies
 * `scrollTo`) and feeds it in here; this module holds the truth and the math.
 * The arithmetic lives in the pure `scroll-loop.math.ts` (unit-tested); this
 * class is the stateful seam its callers depend on. See docs/adr/0007.
 *
 * `position` is a signal, but it is read ~60×/s from out-of-zone rAF loops (the
 * constellation morph and the nav mute) via `position()` — a NON-reactive read,
 * so it does not schedule change detection. Keep it OUT of templates: binding it
 * would reintroduce 60fps change detection on the animation hot path (the reason
 * the predecessor `ScrollStageService` used a plain field).
 */
@Injectable({ providedIn: 'root' })
export class ScrollLoopService {
  private readonly _position = signal(0);
  /** Continuous scroll position in destination units (0..cycleLength). Hot path. */
  readonly position = this._position.asReadonly();

  /** Real destinations (Home, Work, About, Contact) = measured sections − the clone. */
  cycleLength = 0;

  private anchors: readonly number[] = [];
  // Scroll offset of the Home-clone's top = one full cycle; reaching it wraps.
  private wrapAt = 0;

  /** The shell measured the section offsets (the last one is the Loop clone). */
  setAnchors(offsets: readonly number[]): void {
    this.anchors = offsets;
    this.cycleLength = Math.max(0, offsets.length - 1);
    this.wrapAt = offsets.length ? offsets[offsets.length - 1] : 0;
  }

  /** Recompute the position from a fresh scroll offset + viewport height. */
  update(scrollY: number, viewportHeight: number): void {
    this._position.set(positionFor(scrollY, this.anchors, viewportHeight));
  }

  /** Offset to `scrollTo` for the seam wrap, or null when no wrap is due. */
  wrapOffset(scrollY: number): number | null {
    return computeWrapOffset(scrollY, this.wrapAt);
  }
}
