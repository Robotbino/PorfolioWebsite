import { Injectable, signal } from '@angular/core';
import { Constellation } from './constellation.model';

export type TravelPhase = 'idle' | 'travelling';

/** The locked spike easing — the caller of the morph utility owns the easing. */
const easeInOutQuart = (t: number): number =>
  t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;

/**
 * The star-map "Travel" between destinations, as a pure tween state machine.
 *
 * Deliberately free of Router, DOM and real timers: it just holds the from/to
 * figures and a start timestamp, and answers "how far along are we at time T?".
 * The component supplies router navigation (via {@link travelTo}) and a clock
 * (via {@link easedProgressAt} inside its rAF loop). That keeps the make-or-break
 * transition logic unit-testable without mocking Angular or fake-ticking timers.
 */
@Injectable({ providedIn: 'root' })
export class TravelService {
  /** Locked morph duration per the validated spike feel (ms). */
  readonly DURATION = 1600;

  private fromC!: Constellation;
  private toC!: Constellation;
  private startMs = 0;

  /** Coarse state for any UI that reacts to a trip (e.g. the C16 content mask). */
  readonly phase = signal<TravelPhase>('idle');

  get from(): Constellation {
    return this.fromC;
  }
  get to(): Constellation {
    return this.toC;
  }

  /** Seed the resting figure — the active route at startup. */
  init(figure: Constellation): void {
    this.fromC = figure;
    this.toC = figure;
    this.startMs = 0;
    this.phase.set('idle');
  }

  /** Begin travelling to `target`. No-op when it is already the destination. */
  travelTo(target: Constellation, now: number = performance.now()): void {
    if (target === this.toC) {
      return;
    }
    this.fromC = this.toC;
    this.toC = target;

    if (this.prefersReducedMotion()) {
      this.fromC = target; // instant cut — never render an in-between frame
      this.phase.set('idle');
      return;
    }

    this.startMs = now;
    this.phase.set('travelling');
  }

  /** Eased 0..1 progress at `now`; completes the trip once it reaches the end. */
  easedProgressAt(now: number): number {
    return easeInOutQuart(this.rawProgressAt(now));
  }

  private rawProgressAt(now: number): number {
    if (this.phase() !== 'travelling') {
      return 1;
    }
    const raw = (now - this.startMs) / this.DURATION;
    if (raw >= 1) {
      this.fromC = this.toC; // settle so subsequent frames hold the target
      this.phase.set('idle');
      return 1;
    }
    return raw < 0 ? 0 : raw;
  }

  private prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}
