import { Injectable, NgZone } from '@angular/core';
import { MotionSettingsService } from './motion-settings.service';

/** Hops ≤ this many viewport-heights keep native smooth scroll; longer ones
 *  teleport behind a view transition. 0 ⇒ every nav click transitions. */
const SMOOTH_HOP_MAX_VH = 1.75;

/**
 * One place that answers "how does a nav click travel?" Short hops keep the
 * native smooth scroll — the destination is already in reach and watching the
 * page glide there reads as continuity. Long hops used to smooth-scroll too,
 * which dragged the viewport through the pinned Projects showcase (cards
 * whipping sideways, HUD flashing) on every cross-page jump. Those now
 * teleport instantly inside a View Transition: the browser cross-fades a
 * snapshot of the old viewport into the new one with a slight directional
 * drift, so the journey is implied without replaying the terrain in between.
 *
 * Anything that renders from scroll position with its own smoothing (the
 * showcase track) goes stale on a teleport — `onTeleport` lets those renderers
 * snap to the new geometry synchronously, before the browser captures the
 * new-state snapshot.
 */
@Injectable({ providedIn: 'root' })
export class NavTransitionService {
  private activeTransition: ViewTransition | null = null;
  private readonly teleportListeners = new Set<() => void>();

  constructor(
    private zone: NgZone,
    private motion: MotionSettingsService,
  ) {}

  /**
   * Scroll destination `id` into view, choosing the least jarring vehicle.
   * Returns false when the element doesn't exist (caller keeps the browser's
   * default anchor behaviour, matching the old inline handler's semantics).
   */
  navigateTo(id: string, options: { suppressTransition?: boolean } = {}): boolean {
    const el = document.getElementById(id);
    if (!el) {
      return false;
    }
    const delta = el.getBoundingClientRect().top;
    if (this.motion.reducedMotion()) {
      // Reduced motion: no scroll animation and no transition animation.
      this.jump(el);
    } else if (Math.abs(delta) <= SMOOTH_HOP_MAX_VH * window.innerHeight) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (options.suppressTransition || !('startViewTransition' in document)) {
      // Suppressed (mobile overlay owns the reveal) or unsupported browser:
      // a clean cut still beats a multi-thousand-pixel whip.
      this.jump(el);
    } else {
      this.startTransition(el, delta > 0 ? 'down' : 'up');
    }
    return true;
  }

  /**
   * Run `listener` synchronously after every instant teleport, inside the view
   * transition's update callback — i.e. before the new-state snapshot is
   * captured. Returns a release handle (same pattern as FramePulseService.onTick).
   */
  onTeleport(listener: () => void): () => void {
    this.teleportListeners.add(listener);
    return () => {
      this.teleportListeners.delete(listener);
    };
  }

  private startTransition(el: HTMLElement, direction: 'down' | 'up'): void {
    // Click mid-flight: fast-forward the running transition, then restart.
    this.activeTransition?.skipTransition();
    document.documentElement.setAttribute('data-nav-transition', direction);
    // zone.js 0.15 doesn't patch startViewTransition; keep its promise chain
    // out of Angular so the animation never schedules change detection.
    this.zone.runOutsideAngular(() => {
      const t = document.startViewTransition(() => this.jump(el));
      this.activeTransition = t;
      t.finished.catch(() => {}).finally(() => {
        // Identity guard: a skipped predecessor's cleanup must not strip the
        // successor's direction attribute.
        if (this.activeTransition === t) {
          this.activeTransition = null;
          document.documentElement.removeAttribute('data-nav-transition');
        }
      });
    });
  }

  /**
   * Instant relocation. `behavior: 'instant'` applies synchronously (and
   * aborts any in-flight smooth scroll), so when this runs inside a view
   * transition's update callback the landing state — including the section
   * reveal and every teleport listener's repaint — is what gets captured.
   */
  private jump(el: HTMLElement): void {
    el.scrollIntoView({ behavior: 'instant', block: 'start' });
    // Don't capture the landing section mid-reveal: the IntersectionObserver
    // that adds this class only fires after the snapshot would be taken.
    el.closest('.dest')?.classList.add('is-visible');
    for (const listener of this.teleportListeners) {
      try {
        listener();
      } catch {
        // A listener failure must never poison the jump or the transition.
      }
    }
  }
}
