import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  OnDestroy,
  afterNextRender,
  effect,
  inject,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { InViewportService } from '../../../core/in-viewport.service';
import { MotionSettingsService } from '../../../core/motion-settings.service';
import {
  RINGS,
  RingName,
  orbitKeyframes,
  restStyle,
  ringGradient,
  ringPath,
} from './tool-orbit.math';

/** One orbiting tool: its logo, which ring it rides, and where on that ring it starts. */
export interface OrbitTool {
  readonly name: string;
  readonly src: string;
  /** Intrinsic size of the exported logo, so the browser knows its ratio before it loads. */
  readonly width: number;
  readonly height: number;
  readonly ring: RingName;
  /** Starting position as a fraction of a lap (0…1), counted counter-clockwise. */
  readonly slot: number;
  /**
   * Optical size correction. The logos are edge-to-edge in their canvases, so a
   * full-bleed circle (Postman) reads larger than a thin outline (MySQL) at the
   * same box size; these factors make all ten read as one size.
   */
  readonly fit: number;
  /**
   * A hairline light edge in dark mode, for a logo whose silhouette is black
   * and would vanish into the dark page. MySQL's outline is a mid blue (about
   * 50% luminance at its edge) and holds without one.
   */
  readonly rim?: boolean;
}

const ICON = '/assets/toolset/';

/**
 * Four on the inner ring and six on the outer: the counts match the two rings'
 * circumferences, so neighbours sit about the same distance apart on both.
 * Warm and cool logos alternate around each ring.
 */
export const ORBIT_TOOLS: readonly OrbitTool[] = [
  {
    name: 'Claude',
    src: `${ICON}claude.webp`,
    width: 64,
    height: 64,
    ring: 'inner',
    slot: 0.125,
    fit: 0.94,
  },
  {
    name: 'Visual Studio Code',
    src: `${ICON}vscode.webp`,
    width: 64,
    height: 64,
    ring: 'inner',
    slot: 0.375,
    fit: 0.92,
  },
  {
    name: 'Git',
    src: `${ICON}git.webp`,
    width: 64,
    height: 64,
    ring: 'inner',
    slot: 0.625,
    fit: 1,
  },
  {
    name: 'Obsidian',
    src: `${ICON}obsidian.webp`,
    width: 50,
    height: 64,
    ring: 'inner',
    slot: 0.875,
    fit: 1,
  },
  {
    name: 'Postman',
    src: `${ICON}postman.webp`,
    width: 64,
    height: 64,
    ring: 'outer',
    slot: 0,
    fit: 0.88,
  },
  {
    name: 'PostgreSQL',
    src: `${ICON}postgresql.webp`,
    width: 64,
    height: 64,
    ring: 'outer',
    slot: 1 / 6,
    fit: 0.92,
    rim: true,
  },
  {
    name: 'Figma',
    src: `${ICON}figma.webp`,
    width: 43,
    height: 64,
    ring: 'outer',
    slot: 2 / 6,
    fit: 1,
  },
  {
    name: 'MySQL',
    src: `${ICON}mysql.webp`,
    width: 64,
    height: 64,
    ring: 'outer',
    slot: 3 / 6,
    fit: 1.12,
  },
  {
    name: 'IntelliJ IDEA',
    src: `${ICON}intellij.webp`,
    width: 64,
    height: 64,
    ring: 'outer',
    slot: 4 / 6,
    fit: 0.88,
    rim: true,
  },
  {
    name: 'Netlify',
    src: `${ICON}netlify.webp`,
    width: 64,
    height: 64,
    ring: 'outer',
    slot: 5 / 6,
    fit: 1,
  },
];

const RING_NAMES: readonly RingName[] = ['inner', 'outer'];

/** The ring lines never change, so every instance shares one set of paths. */
const RING_LINES = RING_NAMES.map((name) => ({
  name,
  path: ringPath(RINGS[name].radius),
  gradient: ringGradient(RINGS[name].radius),
}));

/** Gradient ids are document-wide; a second orbit must not paint with the first one's. */
let orbitInstanceId = 0;

/**
 * The Toolset illustration: a still black hole with ten tool logos orbiting it
 * on two rings seen in perspective. Each logo is one Web Animation generated
 * from tool-orbit.math.ts, so the motion runs on the compositor with no script
 * per frame. The script here only starts, pauses, regenerates and cancels those
 * animations. See docs/adr/0015-toolset-orbit-in-perspective.md.
 */
@Component({
  selector: 'app-tool-orbit',
  templateUrl: './tool-orbit.component.html',
  styleUrl: './tool-orbit.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolOrbitComponent implements OnDestroy {
  private motion = inject(MotionSettingsService);
  private inView = inject(InViewportService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private injector = inject(Injector);

  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private readonly logos = viewChildren<ElementRef<HTMLElement>>('logo');

  /** Each tool with its resting pose: the first frame of its own animation. */
  readonly orbits = ORBIT_TOOLS.map((tool) => ({
    tool,
    rest: restStyle(tool.slot, RINGS[tool.ring].radius),
  }));

  private readonly instance = orbitInstanceId++;
  readonly rings = RING_LINES.map((line) => ({
    ...line,
    gradientId: `orbit-ring-${line.name}-${this.instance}`,
  }));

  /** One per entry in `orbits`, in the same order; empty while still. */
  private animations: Animation[] = [];
  /** Stage pixels per stage unit (cqi), the scale the keyframes are generated at. */
  private unitPx = 0;
  /** The viewport watch reports within a frame of starting; until then the orbit runs. */
  private onScreen = true;
  private resizeObserver?: ResizeObserver;
  private releaseViewport?: () => void;

  constructor() {
    // After the first render, because the keyframes are in pixels and need the
    // stage's laid-out width. Until then, and whenever no animation runs, the
    // inline rest poses already show the complete picture.
    afterNextRender(() => {
      const stage = this.stage().nativeElement;
      this.unitPx = stage.clientWidth / 100;

      this.resizeObserver = new ResizeObserver((entries) =>
        this.resize(entries[entries.length - 1].contentRect.width),
      );
      this.resizeObserver.observe(stage);

      this.releaseViewport = this.inView.observe(
        this.host.nativeElement,
        { threshold: 0 },
        (visible) => {
          this.onScreen = visible;
          for (const animation of this.animations) {
            if (visible) {
              animation.play();
            } else {
              animation.pause();
            }
          }
        },
      );

      // The global reduced-motion rule in styles.css only shortens CSS
      // animations; it never reaches Web Animations, so the preference is
      // honoured here, live, in both directions.
      effect(
        () => {
          const still = this.motion.reducedMotion();
          untracked(() => {
            if (still) {
              this.stop();
            } else {
              this.start();
            }
          });
        },
        { injector: this.injector },
      );
    });
  }

  ngOnDestroy(): void {
    this.stop();
    this.resizeObserver?.disconnect();
    this.releaseViewport?.();
  }

  private start(): void {
    if (this.animations.length > 0) {
      return;
    }
    const frames = this.keyframes();
    const logos = this.logos();
    this.animations = this.orbits.map(({ tool }, i) => {
      const ring = RINGS[tool.ring];
      // A negative delay starts the lap part-way through, at the logo's slot,
      // which is exactly its inline rest pose: starting never makes it jump.
      const animation = logos[i].nativeElement.animate(frames[tool.ring], {
        duration: ring.periodMs,
        delay: -tool.slot * ring.periodMs,
        iterations: Infinity,
        easing: 'linear',
      });
      if (!this.onScreen) {
        animation.pause();
      }
      return animation;
    });
  }

  /** Cancelling drops each logo back to its inline rest pose. */
  private stop(): void {
    for (const animation of this.animations) {
      animation.cancel();
    }
    this.animations = [];
  }

  private resize(stageWidth: number): void {
    const unitPx = stageWidth / 100;
    if (unitPx === this.unitPx) {
      return;
    }
    this.unitPx = unitPx;
    if (this.animations.length === 0) {
      return;
    }
    // setKeyframes keeps each animation's timing, so the logos carry on from
    // where they were rather than restarting their laps.
    const frames = this.keyframes();
    this.animations.forEach((animation, i) =>
      (animation.effect as KeyframeEffect).setKeyframes(frames[this.orbits[i].tool.ring]),
    );
  }

  private keyframes(): Record<RingName, Keyframe[]> {
    return {
      inner: orbitKeyframes(RINGS.inner.radius, this.unitPx),
      outer: orbitKeyframes(RINGS.outer.radius, this.unitPx),
    };
  }
}
