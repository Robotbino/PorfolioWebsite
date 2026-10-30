import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  NgZone,
  OnDestroy,
  afterNextRender,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { FramePulseService } from '../../../core/frame-pulse.service';
import { InViewportService } from '../../../core/in-viewport.service';
import { MotionSettingsService } from '../../../core/motion-settings.service';
import { Spring, spring, stepS } from '../../../shared/hairline/hairline.motion';
import { Aim, DishPose, REST, STOW, SURVEY, aimAt, dishGeometry } from './contact-dish.math';

/** A pointer that has not moved for this long hands the dish back to its survey. */
export const IDLE_MS = 2500;
/** The pause before the survey starts: after the dish arrives, or after a pointer goes idle. */
export const SURVEY_START_MS = 1600;
/** How long each survey stop holds. */
export const SURVEY_STOP_MS = 2400;
/** How long it rests between surveys. */
export const SURVEY_REST_MS = 4000;
/** The longest step a spring takes in one frame, as Hairline's loop clamps it. */
const MAX_STEP_S = 0.05;

/** The geometry never changes, so it is built once for the page. */
const GEOMETRY = dishGeometry();

/** The two copies of one side of the yoke: behind the dish and in front of it. */
interface SideParts {
  readonly behind: SVGGElement;
  readonly inFront: SVGGElement;
}

/**
 * Listening: a radio dish standing on the Contact colophon's rule, in the
 * bottom corner. It arrives stowed and swings up to rest, listening at the sky
 * over the page. While a mouse moves anywhere on screen the dish turns to
 * listen where it is; left alone, it surveys the sky a stop at a time.
 *
 * An aim turns the dish, so unlike the role figure its outline has to be
 * recomputed as it moves. Azimuth and elevation each ride Hairline's spring on
 * the shared frame pulse, which the dish joins only while it is turning and
 * leaves as soon as it settles; each frame rewrites only the paths that
 * changed. The geometry is in contact-dish.math.ts. Off screen everything
 * holds; under reduced motion it rests, still. See
 * docs/adr/0017-contact-listening-dish.md.
 */
@Component({
  selector: 'app-contact-dish',
  templateUrl: './contact-dish.component.html',
  styleUrls: ['../../../shared/hairline/hairline.css', './contact-dish.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[style.aspect-ratio]': 'aspect',
  },
})
export class ContactDishComponent implements OnDestroy {
  private motion = inject(MotionSettingsService);
  private inView = inject(InViewportService);
  private pulse = inject(FramePulseService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private zone = inject(NgZone);
  private injector = inject(Injector);

  readonly geometry = GEOMETRY;
  readonly aspect = GEOMETRY.viewBox.split(' ').slice(2).join(' / ');

  /** The template's pose: stowed when the entrance will play, at rest when it won't. */
  private readonly start: Aim = this.motion.reducedMotion() ? REST : STOW;
  readonly first: DishPose = GEOMETRY.pose(this.start);

  private readonly az: Spring = spring(this.start.az);
  private readonly el: Spring = spring(this.start.el);

  private stage?: SVGSVGElement;
  private parts = new Map<string, Element>();
  private sides: SideParts[] = [];
  /** The last value written per element and attribute, so a frame only writes what changed. */
  private written = new WeakMap<Element, Map<string, string | null>>();
  private drawnKey = '';

  /** Arrived: the entrance has played, or there is none. */
  private entered = false;
  private onScreen = false;
  /** A mouse has moved recently: the dish follows it instead of surveying. */
  private tracking = false;
  private listening = false;

  private stopTicks: (() => void) | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private surveyTimer: ReturnType<typeof setTimeout> | null = null;
  private releaseEntrance?: () => void;
  private releasePresence?: () => void;

  constructor() {
    afterNextRender(() => {
      const host = this.host.nativeElement;
      this.stage = host.querySelector('svg') ?? undefined;
      host.querySelectorAll('[data-part]').forEach((el) => {
        const part = el.getAttribute('data-part')!;
        if (!this.parts.has(part)) {
          this.parts.set(part, el);
        }
      });
      const behind = Array.from(host.querySelectorAll<SVGGElement>('[data-part="behind"]'));
      const inFront = Array.from(host.querySelectorAll<SVGGElement>('[data-part="in-front"]'));
      this.sides = behind.map((g, i) => ({ behind: g, inFront: inFront[i] }));

      this.releasePresence = this.inView.observe(host, { threshold: 0 }, (visible) => {
        this.onScreen = visible;
        if (!visible) {
          this.endTracking();
        }
        this.update();
      });
      if (this.motion.reducedMotion()) {
        this.entered = true;
      } else {
        this.releaseEntrance = this.inView.observe(host, { threshold: 0.35 }, (visible) => {
          if (visible) {
            this.releaseEntrance?.(); // one-shot
            this.releaseEntrance = undefined;
            this.entered = true;
            this.aim(REST);
            this.update();
          }
        });
      }

      // Both preferences are live: reduced motion stills the dish at rest the
      // moment it is asked for, and a pointer that stops being a mouse stops
      // being followed.
      effect(
        () => {
          const still = this.motion.reducedMotion();
          this.motion.finePointer();
          untracked(() => {
            if (still) {
              this.entered = true;
              this.endTracking();
              this.jump(REST);
            }
            this.update();
          });
        },
        { injector: this.injector },
      );
    });
  }

  ngOnDestroy(): void {
    this.releaseEntrance?.();
    this.releasePresence?.();
    this.listen(false);
    this.stopSurvey();
    this.clearIdle();
    this.stopTicks?.();
    this.stopTicks = null;
  }

  /** Starts or stops the survey and the pointer for the current state. */
  private update(): void {
    const still = this.motion.reducedMotion();
    this.listen(this.entered && this.onScreen && !still && this.motion.finePointer());
    if (this.entered && this.onScreen && !still && !this.tracking) {
      if (this.surveyTimer === null) {
        this.survey(SURVEY_START_MS, 0);
      }
    } else {
      this.stopSurvey();
    }
    if (!this.onScreen) {
      // Holds wherever it is; it picks up from there on return.
      this.stopTicks?.();
      this.stopTicks = null;
    } else if (this.az.x !== this.az.t || this.el.x !== this.el.t) {
      this.turn();
    }
  }

  /** Each survey stop in turn, then rest; round again. */
  private survey(delay: number, stop: number): void {
    this.zone.runOutsideAngular(() => {
      this.surveyTimer = setTimeout(() => {
        const stops = [...SURVEY, REST];
        const aim = stops[stop];
        this.aim(aim);
        this.survey(aim === REST ? SURVEY_REST_MS : SURVEY_STOP_MS, (stop + 1) % stops.length);
      }, delay);
    });
  }

  private stopSurvey(): void {
    if (this.surveyTimer !== null) {
      clearTimeout(this.surveyTimer);
      this.surveyTimer = null;
    }
  }

  private listen(on: boolean): void {
    if (on === this.listening) {
      return;
    }
    this.listening = on;
    this.zone.runOutsideAngular(() => {
      if (on) {
        window.addEventListener('pointermove', this.onPointerMove, { passive: true });
        document.addEventListener('pointerout', this.onPointerOut, { passive: true });
      } else {
        window.removeEventListener('pointermove', this.onPointerMove);
        document.removeEventListener('pointerout', this.onPointerOut);
      }
    });
  }

  private onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') {
      return;
    }
    const aim = this.aimFor(event.clientX, event.clientY);
    if (!aim) {
      return;
    }
    this.tracking = true;
    this.stopSurvey();
    this.clearIdle();
    this.zone.runOutsideAngular(() => {
      this.idleTimer = setTimeout(() => this.goIdle(), IDLE_MS);
    });
    this.aim(aim);
  };

  /** The pointer left the window. */
  private onPointerOut = (event: PointerEvent): void => {
    if (event.relatedTarget === null && this.tracking) {
      this.goIdle();
    }
  };

  private goIdle(): void {
    this.endTracking();
    this.aim(REST);
    this.update();
  }

  private endTracking(): void {
    this.tracking = false;
    this.clearIdle();
  }

  private clearIdle(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  /**
   * The aim for a pointer at (x, y) in the viewport: its offset from the
   * pivot as drawn. The viewBox sits bottom-right in the svg (xMaxYMax meet).
   * One rect read per pointer event, never per frame.
   */
  private aimFor(x: number, y: number): Aim | null {
    const svg = this.stage;
    if (!svg) {
      return null;
    }
    const rect = svg.getBoundingClientRect();
    const [vx, vy, vw, vh] = GEOMETRY.viewBox.split(' ').map(Number);
    const s = Math.min(rect.width / vw, rect.height / vh);
    if (!(s > 0)) {
      return null;
    }
    const px = rect.right - vw * s + (GEOMETRY.pivot[0] - vx) * s;
    const py = rect.bottom - vh * s + (GEOMETRY.pivot[1] - vy) * s;
    return aimAt(x - px, y - py, window.innerWidth, window.innerHeight);
  }

  /** Retargets both springs; the frame pulse carries the dish there. */
  private aim(aim: Aim): void {
    if (this.motion.reducedMotion()) {
      this.jump(aim);
      return;
    }
    this.az.t = aim.az;
    this.el.t = aim.el;
    if (this.onScreen) {
      this.turn();
    }
  }

  /** Puts the dish at an aim at once, with no motion. */
  private jump(aim: Aim): void {
    this.az.x = this.az.t = aim.az;
    this.el.x = this.el.t = aim.el;
    this.az.v = this.el.v = 0;
    this.stopTicks?.();
    this.stopTicks = null;
    this.draw();
  }

  /** Joins the frame pulse until both springs settle. */
  private turn(): void {
    if (this.stopTicks) {
      return;
    }
    this.stopTicks = this.pulse.onTick((_now, dtMs) => {
      const dt = Math.min(dtMs / 1000, MAX_STEP_S);
      const moving = stepS(this.az, dt);
      const movingEl = stepS(this.el, dt);
      this.draw();
      if (!moving && !movingEl) {
        this.stopTicks?.();
        this.stopTicks = null;
      }
    });
  }

  private draw(): void {
    const key = `${this.az.x.toFixed(3)},${this.el.x.toFixed(3)}`;
    if (key === this.drawnKey || this.parts.size === 0) {
      return;
    }
    this.drawnKey = key;
    const pose = GEOMETRY.pose({ az: this.az.x, el: this.el.x });
    const part = (name: string) => this.parts.get(name)!;

    this.write(part('index'), 'cx', String(pose.index[0]));
    this.write(part('index'), 'cy', String(pose.index[1]));
    this.write(part('beam-sil'), 'd', pose.beam.sil);
    this.write(part('beam-crease'), 'd', pose.beam.crease);
    pose.sides.forEach((side, i) => {
      const { behind, inFront } = this.sides[i];
      const shown = side.near ? inFront : behind;
      this.write(shown, 'display', null);
      this.write(side.near ? behind : inFront, 'display', 'none');
      const child = (name: string) => shown.querySelector(`[data-part="${name}"]`)!;
      this.write(child('ring'), 'd', side.ring);
      this.write(child('arm-sil'), 'd', side.arm.sil);
      this.write(child('arm-crease'), 'd', side.arm.crease);
      this.write(child('trunnion'), 'd', side.trunnion);
    });
    this.write(part('outline'), 'd', pose.outline);
    this.write(part('seam'), 'd', pose.seam);
    this.write(part('hub'), 'd', pose.hub);
    this.write(part('rim'), 'd', pose.rim);
    this.write(part('struts'), 'd', pose.struts);
    this.write(part('feed-sil'), 'd', pose.feed.sil);
    this.write(part('feed-crease'), 'd', pose.feed.crease);
  }

  /** Sets (or, for null, removes) an attribute, skipping a write that changes nothing. */
  private write(el: Element, name: string, value: string | null): void {
    let last = this.written.get(el);
    if (!last) {
      last = new Map();
      this.written.set(el, last);
    }
    if (last.has(name) && last.get(name) === value) {
      return;
    }
    last.set(name, value);
    if (value === null) {
      el.removeAttribute(name);
    } else {
      el.setAttribute(name, value);
    }
  }
}
