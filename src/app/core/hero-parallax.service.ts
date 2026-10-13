import { Injectable, NgZone, effect, inject, untracked } from '@angular/core';
import { FramePulseService } from './frame-pulse.service';
import { MotionSettingsService } from './motion-settings.service';
import { ScrollLoopService } from '../scroll-loop.service';
import { distanceFromHome } from '../scroll-loop.math';
import { easeToward, smoothingK } from '../motion.math';

/**
 * Two-plane depth for the hero: where the pointer sits over the window, eased,
 * written as `--parallax-x` / `--parallax-y` (-1…1) onto every element that
 * attaches. The hero moves its headline a few pixels against the pointer and
 * the constellation moves with it, so the name and the star map separate.
 *
 * One writer for every target is what keeps the loop seam invisible: the real
 * Home and its clone receive the same string in the same frame, so they can
 * never disagree at the wrap. The values fade to zero with distance from Home,
 * symmetric around the seam (see distanceFromHome), so nothing is offset while
 * another destination is on screen.
 *
 * Runs only for a fine pointer with motion allowed. When that changes mid
 * session the listeners and the tick are dropped and the properties removed,
 * so CSS falls back to its zero defaults. A settled pointer writes nothing.
 */
@Injectable({ providedIn: 'root' })
export class HeroParallaxService {
  /** Distance from Home (in destinations) at which the parallax has faded out. */
  static readonly FADE_RANGE = 0.5;
  /** Per-frame easing at 60Hz; low, so the layers drift after the pointer. */
  private static readonly EASE = 0.06;

  private pulse = inject(FramePulseService);
  private motion = inject(MotionSettingsService);
  private loop = inject(ScrollLoopService);
  private zone = inject(NgZone);

  private readonly targets = new Set<HTMLElement>();
  private enabled = false;
  private stopTick: (() => void) | null = null;
  private targetX = 0;
  private targetY = 0;
  private x = 0;
  private y = 0;
  private written: [string, string] | null = null;

  constructor() {
    effect(() => {
      const allowed = this.motion.finePointer() && !this.motion.reducedMotion();
      untracked(() => (allowed ? this.enable() : this.disable()));
    });
  }

  /** Start receiving the parallax properties on `el`. Returns release. */
  attach(el: HTMLElement): () => void {
    this.targets.add(el);
    if (this.written) {
      el.style.setProperty('--parallax-x', this.written[0]);
      el.style.setProperty('--parallax-y', this.written[1]);
    }
    return () => {
      if (this.targets.delete(el)) {
        this.clear(el);
      }
    };
  }

  private enable(): void {
    if (this.enabled) {
      return;
    }
    this.enabled = true;
    this.zone.runOutsideAngular(() => {
      window.addEventListener('pointermove', this.onPointerMove, { passive: true });
      document.addEventListener('pointerout', this.onPointerOut, { passive: true });
    });
    this.stopTick = this.pulse.onTick(this.tick);
  }

  private disable(): void {
    if (!this.enabled) {
      return;
    }
    this.enabled = false;
    window.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('pointerout', this.onPointerOut);
    this.stopTick?.();
    this.stopTick = null;
    this.targetX = this.targetY = this.x = this.y = 0;
    this.written = null;
    this.targets.forEach((el) => this.clear(el));
  }

  private onPointerMove = (e: PointerEvent): void => {
    if (e.pointerType === 'touch') {
      return;
    }
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    this.targetX = Math.max(-1, Math.min(1, (e.clientX / w) * 2 - 1));
    this.targetY = Math.max(-1, Math.min(1, (e.clientY / h) * 2 - 1));
  };

  /** Pointer left the window: drift back to centre rather than freezing off-axis. */
  private onPointerOut = (e: PointerEvent): void => {
    if (!e.relatedTarget) {
      this.targetX = this.targetY = 0;
    }
  };

  private tick = (_now: number, dt: number): void => {
    const distance = distanceFromHome(this.loop.position(), this.loop.cycleLength);
    const weight = 1 - Math.min(1, distance / HeroParallaxService.FADE_RANGE);
    const k = smoothingK(dt, HeroParallaxService.EASE);
    this.x = easeToward(this.x, this.targetX * weight, k);
    this.y = easeToward(this.y, this.targetY * weight, k);

    const sx = this.x.toFixed(3);
    const sy = this.y.toFixed(3);
    if (this.written && this.written[0] === sx && this.written[1] === sy) {
      return;
    }
    this.written = [sx, sy];
    for (const el of this.targets) {
      el.style.setProperty('--parallax-x', sx);
      el.style.setProperty('--parallax-y', sy);
    }
  };

  private clear(el: HTMLElement): void {
    el.style.removeProperty('--parallax-x');
    el.style.removeProperty('--parallax-y');
  }
}
