import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  InjectionToken,
  NgZone,
  OnDestroy,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { InViewportService } from '../../../core/in-viewport.service';
import { MotionSettingsService } from '../../../core/motion-settings.service';
import { Position } from '../work-data';
import { r2 } from './role-figure.iso';
import {
  DROP,
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

/** When each plate starts its drop into the groove, after the ledge begins to draw. */
const ENTER_MS = 150;
const ENTER_STEP_MS = 70;

/**
 * Plates 01–03: the figure under the SITA positions. The drawing is static
 * template SVG from role-figure.math.ts, and the only motion is CSS: a plate's
 * lift is a transition on its transform, and the entrance is a transition
 * away from the `.awaiting` pose. Nothing runs per frame, so nothing needs
 * pausing off screen. The script here only decides which plate is lifted and
 * when the entrance plays. See docs/adr/0016-experience-role-figure.md.
 */
@Component({
  selector: 'app-role-figure',
  templateUrl: './role-figure.component.html',
  styleUrl: './role-figure.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[class.awaiting]': 'awaiting()',
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

  readonly geometry = computed(() => figureGeometry(this.positions(), yearMonthIn(this.now())));

  /** How far a plate sits above its rest before the entrance drops it in. */
  readonly dropPx = computed(() => `${r2(DROP * this.geometry().liftPx)}px`);

  private readonly plate = computed(() => {
    const line = this.picked();
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
      transform: `translateY(${r2(liftFor(picked, i, plates.length) * liftPx)}px)`,
      delay: `${delayMs(origin, i)}ms`,
      enter: `${ENTER_MS + i * ENTER_STEP_MS}ms`,
    }));
  });

  /**
   * Holds the entrance's starting pose until the figure is on screen. Under
   * reduced motion there is no entrance: the first paint is the rest pose.
   */
  readonly awaiting = signal(!this.motion.reducedMotion());

  private releaseViewport?: () => void;

  constructor() {
    afterNextRender(() => {
      if (!this.awaiting()) {
        return;
      }
      this.releaseViewport = this.inView.observe(
        this.host.nativeElement,
        { threshold: 0.35 },
        (visible) => {
          if (visible) {
            // The seam runs outside Angular; re-enter to write the signal.
            this.zone.run(() => this.awaiting.set(false));
            this.release(); // one-shot
          }
        },
      );
    });
  }

  ngOnDestroy(): void {
    this.release();
  }

  private release(): void {
    this.releaseViewport?.();
    this.releaseViewport = undefined;
  }
}
