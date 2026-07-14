import { Injectable, NgZone, OnDestroy } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class FramePulseService implements OnDestroy {
  private readonly subs = new Set<(now: number, dt: number) => void>();
  private rafId = 0;
  private lastTime = 0;

  constructor(private zone: NgZone) {
    // A hidden tab parks rAF anyway, but two things still need handling: stop the
    // loop deterministically (don't lean on the browser), and — the real defect —
    // reset the clock on return so the first tick back isn't handed the whole
    // hidden gap as `dt` and made to lurch. Registered outside Angular so a tab
    // switch never trips change detection.
    this.zone.runOutsideAngular(() => {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    });
  }

  onTick(fn: (now: number, dt: number) => void): () => void {
    this.subs.add(fn);
    if (this.subs.size === 1) {
      this.start();
    }
    return () => {
      this.subs.delete(fn);
      if (this.subs.size === 0) {
        this.stop();
      }
    };
  }

  private onVisibilityChange = (): void => {
    if (document.hidden) {
      this.pause();
    } else {
      this.resume();
    }
  };

  /** Park the loop while hidden, but keep the subscribers so we can resume. */
  private pause(): void {
    if (this.rafId !== 0) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  /** Re-arm on return if anyone still wants ticks, dropping the hidden gap. */
  private resume(): void {
    if (this.subs.size > 0 && this.rafId === 0) {
      // lastTime = 0 makes the first tick back report dt = 0 (see `tick`), so no
      // smoothing lurch from the time spent hidden.
      this.lastTime = 0;
      this.zone.runOutsideAngular(() => {
        this.rafId = requestAnimationFrame(this.tick);
      });
    }
  }

  private start(): void {
    this.lastTime = 0;
    this.zone.runOutsideAngular(() => {
      this.rafId = requestAnimationFrame(this.tick);
    });
  }

  private tick = (now: number): void => {
    const dt = this.lastTime ? now - this.lastTime : 0;
    this.lastTime = now;
    this.subs.forEach(fn => fn(now, dt));
    this.rafId = requestAnimationFrame(this.tick);
  };

  private stop(): void {
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.lastTime = 0;
  }

  ngOnDestroy(): void {
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.stop();
  }
}
