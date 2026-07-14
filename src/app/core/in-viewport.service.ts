import { Injectable, NgZone } from '@angular/core';

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
  private readonly groups = new Map<
    string,
    { observer: IntersectionObserver; callbacks: Map<Element, InViewCallback> }
  >();

  constructor(private zone: NgZone) {}

  /** Watch `target`; `onChange(visible)` fires on each crossing. Returns release. */
  observe(target: Element, options: IntersectionObserverInit, onChange: InViewCallback): () => void {
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

  /** Shareable identity of an observer. Root is always the viewport here. */
  private keyFor(options: IntersectionObserverInit): string {
    return JSON.stringify({
      rootMargin: options.rootMargin ?? '',
      threshold: options.threshold ?? 0,
    });
  }
}
