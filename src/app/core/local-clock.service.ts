import { Injectable, OnDestroy, signal } from '@angular/core';

/**
 * Bino's local wall-clock, at minute precision, as one signal.
 *
 * It lives here rather than in LandingpageComponent because the hero is mounted
 * TWICE: once as Home and once as the loop's seam clone. A per-component timer
 * therefore ran two clocks for one displayed time, the second of them inside an
 * inert, aria-hidden subtree nobody can read.
 *
 * One owner also keeps the seam honest. The clone has to be pixel-identical to
 * real Home at the wrap, and two independent timers can tick on either side of a
 * minute boundary — so the two copies could briefly disagree by a minute at the
 * exact moment the wrap swaps one for the other.
 *
 * SAST is a fixed UTC+2 with no DST, but the IANA zone keeps it honest.
 */
@Injectable({ providedIn: 'root' })
export class LocalClockService implements OnDestroy {
  private static readonly FORMAT = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Africa/Johannesburg',
  });

  private readonly _localTime = signal(LocalClockService.FORMAT.format(new Date()));

  /** HH:mm in Pretoria. Safe to bind — it changes once a minute, not per frame. */
  readonly localTime = this._localTime.asReadonly();

  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.scheduleTick();
  }

  /** Wake on the minute flip rather than polling — one timer a minute, total. */
  private scheduleTick(): void {
    const msToNextMinute = 60_000 - (Date.now() % 60_000) + 250;
    this.timer = setTimeout(() => {
      this._localTime.set(LocalClockService.FORMAT.format(new Date()));
      this.scheduleTick();
    }, msToNextMinute);
  }

  ngOnDestroy(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
  }
}
