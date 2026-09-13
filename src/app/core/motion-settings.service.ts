import { Injectable, Signal, WritableSignal, signal } from '@angular/core';

/**
 * One place that answers "may I animate, and how does the visitor point?", so
 * no renderer reimplements that decision against matchMedia privately.
 *
 * Each signal tracks live preference changes via its media query's `change`
 * event — the same pattern ThemeService uses for colour-scheme — so a consumer
 * can react to a mid-session flip.
 *
 * `finePointer` and `coarsePointer` are separate signals rather than one negated
 * flag: they test non-complementary conditions (a hybrid touch-laptop can
 * satisfy neither), so each consumer keeps its exact question.
 */
@Injectable({ providedIn: 'root' })
export class MotionSettingsService {
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
