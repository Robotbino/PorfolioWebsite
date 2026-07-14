import { Injectable, Signal, WritableSignal, signal } from '@angular/core';

/**
 * One place that answers "may I animate, and how does the visitor point?" Every
 * renderer used to re-read matchMedia privately (reduced-motion across seven
 * call sites, pointer capability across two), so the "may I animate" decision
 * was reimplemented in isolation all over the app. They now read one of these
 * signals instead.
 *
 * The signals track live preference changes via the media query's `change`
 * event — the same pattern ThemeService uses for colour-scheme — so a consumer
 * can react to a mid-session flip. Reading a signal once at init stays
 * value-identical to the old direct matchMedia read, so adopting it is safe
 * even for consumers that don't (yet) react live.
 *
 * `finePointer` and `coarsePointer` are kept as separate signals rather than
 * one negated flag: they test non-complementary conditions (a hybrid
 * touch-laptop can satisfy neither), so each consumer keeps its exact question.
 */
@Injectable({ providedIn: 'root' })
export class MotionSettingsService {
  /** True when the visitor asked the OS to reduce motion. */
  readonly reducedMotion: Signal<boolean>;
  /** True for a precise, hovering pointer (mouse / trackpad). */
  readonly finePointer: Signal<boolean>;
  /** True for a coarse, non-hovering pointer (touch). */
  readonly coarsePointer: Signal<boolean>;

  constructor() {
    this.reducedMotion = this.track('(prefers-reduced-motion: reduce)');
    this.finePointer = this.track('(hover: hover) and (pointer: fine)');
    this.coarsePointer = this.track('(hover: none) and (pointer: coarse)');
  }

  /** A signal seeded from a media query and kept live by its `change` event. */
  private track(query: string): Signal<boolean> {
    const mq = window.matchMedia(query);
    const state: WritableSignal<boolean> = signal(mq.matches);
    mq.addEventListener('change', (e) => state.set(e.matches));
    return state.asReadonly();
  }
}
