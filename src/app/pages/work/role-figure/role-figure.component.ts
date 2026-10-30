import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  InjectionToken,
  NgZone,
  OnDestroy,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
} from '@angular/core';
import { InViewportService } from '../../../core/in-viewport.service';
import { MotionSettingsService } from '../../../core/motion-settings.service';
import { Position } from '../work-data';
import { r2 } from './role-figure.iso';
import {
  BREATH,
  DROP,
  NOW_DROP,
  delayMs,
  figureGeometry,
  liftFor,
  plateIndex,
  yearMonthIn,
} from './role-figure.math';

/** The clock the scale is engraved up to. A spec swaps it for a fixed date. */
export const ROLE_FIGURE_NOW = new InjectionToken<() => Date>('ROLE_FIGURE_NOW', {
  providedIn: 'root',
  factory: () => () => new Date(),
});

// The entrance, in ms from the moment the figure is on screen. The drawing
// wipes in over --duration-rule (750ms); the quarters engrave in month order
// across ENGRAVE_SPAN_MS; the now mark drops onto the lip; then the plates
// land, oldest first.
const ENGRAVE_START_MS = 450;
const ENGRAVE_SPAN_MS = 600;
export const NOW_MS = ENGRAVE_START_MS + ENGRAVE_SPAN_MS + 120;
const PLATES_MS = NOW_MS + 250;
const PLATE_STEP_MS = 90;
/** When the last plate has landed: 700ms is the drop's own transition. */
export const ENTRANCE_MS = PLATES_MS + 2 * PLATE_STEP_MS + 700;

// The lap: Hairline's tour, played by the figure itself. It lifts each plate
// in turn, oldest first, holding each for LAP_STOP_MS, then rests for
// LAP_REST_MS before it goes round again.
export const LAP_STOP_MS = 1600;
export const LAP_REST_MS = 3200;
/** The pause before the lap starts again after a hover or a return to the screen. */
export const LAP_RESUME_MS = 1600;

/**
 * Plates 01–03: the figure under the SITA positions. The drawing is static
 * template SVG from role-figure.math.ts, and every motion is CSS: a lift is a
 * transition on a plate's transform, the entrance is a transition away from
 * the `.awaiting` pose, and the resting plate's float is a keyframe animation.
 * The script only decides which plate is lifted and when. While the figure is
 * on screen and nobody is hovering a position, it plays its own lap, and
 * tells WorkComponent which line that lights. Off screen everything holds;
 * under reduced motion there is no entrance, no lap and no float, and hover
 * still answers. See docs/adr/0016-experience-role-figure.md.
 */
@Component({
  selector: 'app-role-figure',
  templateUrl: './role-figure.component.html',
  styleUrl: './role-figure.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[class.awaiting]': 'awaiting()',
    '[class.on-screen]': 'onScreen()',
  },
})
export class RoleFigureComponent implements OnDestroy {
  private motion = inject(MotionSettingsService);
  private inView = inject(InViewportService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private zone = inject(NgZone);
  private now = inject(ROLE_FIGURE_NOW);

  readonly positions = input.required<readonly Position[]>();
  /** The position line under the pointer, counted as listed (newest first); null at rest. */
  readonly picked = input<number | null>(null);

  /** The line the lap is lifting, as listed, or null between stops and when it isn't playing. */
  readonly touring = output<number | null>();

  readonly geometry = computed(() => figureGeometry(this.positions(), yearMonthIn(this.now())));

  /** Distances in screen px, for the stylesheet's moves. */
  readonly moves = computed(() => {
    const { liftPx } = this.geometry();
    return {
      drop: `${r2(DROP * liftPx)}px`,
      nowDrop: `${r2(NOW_DROP * liftPx)}px`,
      breath: `${r2(BREATH * liftPx)}px`,
    };
  });

  readonly ticks = computed(() => {
    const { quarters } = this.geometry();
    const step = quarters.length > 1 ? ENGRAVE_SPAN_MS / (quarters.length - 1) : 0;
    return quarters.map((d, i) => ({ d, delay: `${Math.round(ENGRAVE_START_MS + i * step)}ms` }));
  });

  readonly nowDelay = `${NOW_MS}ms`;

  /**
   * Holds the entrance's starting pose until the figure is on screen. Under
   * reduced motion there is no entrance: the first paint is the rest pose.
   */
  readonly awaiting = signal(!this.motion.reducedMotion());

  /** Any of the figure in the viewport: the lap and the float run only then. */
  readonly onScreen = signal(false);

  private readonly lapLine = signal<number | null>(null);

  /** A hover wins over the lap. */
  private readonly line = computed(() => this.picked() ?? this.lapLine());

  private readonly plate = computed(() => {
    const line = this.line();
    return line === null ? null : plateIndex(line, this.positions().length);
  });

  /**
   * Where the stagger spreads from: the plate just picked, or, when the
   * pointer leaves, the one it let go. Before any pick, the newest.
   */
  private readonly origin = linkedSignal<number | null, number>({
    source: this.plate,
    computation: (plate, previous) => plate ?? previous?.source ?? this.positions().length - 1,
  });

  readonly plates = computed(() => {
    const { plates, liftPx } = this.geometry();
    const picked = this.plate();
    const origin = this.origin();
    const bright = picked ?? plates.length - 1;
    return plates.map((paths, i) => ({
      paths,
      bright: i === bright,
      breathing: picked === null && i === plates.length - 1,
      transform: `translateY(${r2(liftFor(picked, i, plates.length) * liftPx)}px)`,
      delay: `${delayMs(origin, i)}ms`,
      enter: `${PLATES_MS + i * PLATE_STEP_MS}ms`,
    }));
  });

  private readonly canTour = computed(
    () =>
      !this.motion.reducedMotion() && this.onScreen() && !this.awaiting() && this.picked() === null,
  );

  private lapTimer: ReturnType<typeof setTimeout> | null = null;
  /** The first lap waits for the entrance to finish; later ones only for a breath. */
  private toured = false;
  private releaseEntrance?: () => void;
  private releasePresence?: () => void;

  constructor() {
    afterNextRender(() => {
      const host = this.host.nativeElement;
      // The seam runs outside Angular; re-enter to write the signals.
      this.releasePresence = this.inView.observe(host, { threshold: 0 }, (visible) =>
        this.zone.run(() => this.onScreen.set(visible)),
      );
      if (this.awaiting()) {
        this.releaseEntrance = this.inView.observe(host, { threshold: 0.35 }, (visible) => {
          if (visible) {
            this.zone.run(() => this.awaiting.set(false));
            this.releaseEntrance?.(); // one-shot
            this.releaseEntrance = undefined;
          }
        });
      }
    });

    // The lap plays whenever it may and stops the moment it may not: a hover,
    // the figure leaving the screen, or reduced motion turning on.
    effect(() => {
      const play = this.canTour();
      untracked(() => {
        if (play) {
          this.startLap(this.toured ? LAP_RESUME_MS : ENTRANCE_MS + LAP_RESUME_MS);
          this.toured = true;
        } else {
          this.stopLap();
        }
      });
    });
  }

  ngOnDestroy(): void {
    this.stopLap();
    this.releaseEntrance?.();
    this.releasePresence?.();
  }

  /** Oldest plate first (the last line listed), up to the newest, then rest; round again. */
  private startLap(delay: number): void {
    this.stopLap();
    const count = this.positions().length;
    const stops = [...Array.from({ length: count }, (_, i) => count - 1 - i), null];
    let next = 0;
    const step = () => {
      const line = stops[next];
      next = (next + 1) % stops.length;
      this.setLap(line);
      this.lapTimer = setTimeout(step, line === null ? LAP_REST_MS : LAP_STOP_MS);
    };
    this.lapTimer = setTimeout(step, delay);
  }

  private stopLap(): void {
    if (this.lapTimer !== null) {
      clearTimeout(this.lapTimer);
      this.lapTimer = null;
    }
    this.setLap(null);
  }

  private setLap(line: number | null): void {
    if (line === this.lapLine()) {
      return;
    }
    this.lapLine.set(line);
    this.touring.emit(line);
  }
}
