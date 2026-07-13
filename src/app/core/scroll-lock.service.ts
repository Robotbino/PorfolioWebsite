import { Injectable, NgZone } from '@angular/core';

/**
 * Single owner of the page scroll lock used by full-screen overlays (the mobile
 * nav menu, the certifications spotlight). Ref-counted: the first `acquire()`
 * engages the lock and it releases only when the last holder lets go, so two
 * overlays open at once can't clobber each other's lock — the bug the two
 * copy-pasted implementations had, where whoever released first unlocked the
 * page under the other. `acquire()` returns an idempotent release handle.
 *
 * What it locks and why: root `overflow-y` (not `overflow`) so html's
 * `overflow-x: clip` — which the Work showcase's sticky pin depends on —
 * survives, and the scroll loop's `scrollY` is left untouched (no scroll event,
 * no reset). iOS ignores root overflow for touch panning, so a non-passive
 * `touchmove` block backs it up; safe because these overlays have no scrollable
 * content. Written once here instead of once per caller. See ADR-0005.
 */
@Injectable({ providedIn: 'root' })
export class ScrollLockService {
  private count = 0;

  constructor(private zone: NgZone) {}

  /** Lock the page (if not already locked); returns an idempotent release handle. */
  acquire(): () => void {
    if (this.count++ === 0) {
      this.engage();
    }
    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      if (--this.count === 0) {
        this.disengage();
      }
    };
  }

  private engage(): void {
    document.documentElement.style.overflowY = 'hidden';
    // Out of zone: touchmove would otherwise schedule change detection per event
    // while an overlay is open. The handler only calls preventDefault.
    this.zone.runOutsideAngular(() => {
      document.addEventListener('touchmove', this.blockTouch, { passive: false });
    });
  }

  private disengage(): void {
    document.documentElement.style.overflowY = '';
    document.removeEventListener('touchmove', this.blockTouch);
  }

  private blockTouch = (e: TouchEvent): void => {
    e.preventDefault();
  };
}
