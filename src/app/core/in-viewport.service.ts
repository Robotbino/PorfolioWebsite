import { Injectable, NgZone, inject } from '@angular/core';

/** Notified with whether the target currently intersects the viewport. */
export type InViewCallback = (visible: boolean) => void;

/**
 * One place that owns "is this element in the viewport?" Five call sites each
 * used to `new IntersectionObserver`, wire up entry routing, and disconnect in
 * their own ngOnDestroy — with an inconsistent story about the Angular zone.
 * They now call `observe()` and keep the release handle.
 *
 * Observers are shared by their option set: every caller uses the viewport
 * root, so `rootMargin` + `threshold` fully identify a reusable observer, and
 * one instance can watch many targets (the nav's #projects anchor and the
 * about-glow icons ride the same shared observer). The callback runs outside
 * Angular so a viewport crossing never trips change detection; a consumer that
 * needs to touch a signal or binding wraps just that write in `zone.run`.
 *
 * The release handle mirrors ScrollLockService: idempotent, unobserves the
 * target, and disconnects the shared observer once its last target leaves.
 */
@Injectable({ providedIn: 'root' })
export class InViewportService {
  private zone = inject(NgZone);

  private readonly groups = new Map<
    string,
    { observer: IntersectionObserver; callbacks: Map<Element, InViewCallback> }
  >();

  /** Observer roots seen so far; the index is that root's identity in a key. */
  private readonly roots: (Element | Document | null)[] = [];

  /** Watch `target`; `onChange(visible)` fires on each crossing. Returns release. */
  observe(
    target: Element,
    options: IntersectionObserverInit,
    onChange: InViewCallback,
  ): () => void {
    const key = this.keyFor(options);
    let group = this.groups.get(key);
    if (!group) {
      const callbacks = new Map<Element, InViewCallback>();
      let observer!: IntersectionObserver;
      this.zone.runOutsideAngular(() => {
        observer = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            callbacks.get(entry.target)?.(entry.isIntersecting);
          }
        }, options);
      });
      group = { observer, callbacks };
      this.groups.set(key, group);
    }
    if (group.callbacks.has(target)) {
      // Two callers watching one element with the same options would share a
      // slot: the second silently replaces the first, and whichever releases
      // first unobserves the element out from under the other. Nothing does
      // this today; say so loudly if anything starts.
      console.warn('InViewportService: target already observed with these options.', target);
    }
    group.callbacks.set(target, onChange);
    group.observer.observe(target);

    return () => {
      const g = this.groups.get(key);
      if (!g || !g.callbacks.has(target)) {
        return; // idempotent: a second release is a no-op
      }
      g.observer.unobserve(target);
      g.callbacks.delete(target);
      if (g.callbacks.size === 0) {
        g.observer.disconnect();
        this.groups.delete(key);
      }
    };
  }

  /**
   * Shareable identity of an observer. Every caller uses the viewport root
   * today, but `root` is part of what makes two observers interchangeable — it
   * was left out of the key, so the first caller to pass a scroll container
   * would have been handed a viewport-rooted observer instead. Roots are
   * elements, not values, so they are identified by index in `roots`.
   */
  private keyFor(options: IntersectionObserverInit): string {
    const root = options.root ?? null;
    let rootId = this.roots.indexOf(root);
    if (rootId === -1) {
      rootId = this.roots.push(root) - 1;
    }
    return JSON.stringify({
      root: rootId,
      rootMargin: options.rootMargin ?? '',
      threshold: options.threshold ?? 0,
    });
  }
}
