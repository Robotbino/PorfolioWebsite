import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { ConstellationComponent } from '../constellation/constellation.component';
import { interpolateConstellation } from '../constellation/constellation-morph';
import { order } from '../constellation/constellation.figures';
import { MorphDriver } from '../constellation/morph-driver';
import { FramePulseService } from '../core/frame-pulse.service';
import { HeroParallaxService } from '../core/hero-parallax.service';
import { MotionSettingsService } from '../core/motion-settings.service';
import { NavTransitionService } from '../core/nav-transition.service';
import { StarMapPalette } from '../core/star-map-palette';
import { ThemeService } from '../core/theme.service';
import { smoothingK } from '../motion.math';
import { ScrollLoopService } from '../scroll-loop.service';
import {
  CLIP,
  FIELD,
  Framing,
  PoseInput,
  RIG,
  budgetDpr,
  cameraPose,
  fieldExtent,
  loopDistance,
  projectionMatrix,
  swingCurve,
  swingGainStep,
  viewMatrix,
} from './star-map.math';
import {
  ENTRANCE_MS,
  FigureFrame,
  createScene,
  entranceDollyProgress,
  entranceFieldOpacity,
  writeFigure,
} from './star-map.scene';
import { STAR_MAP_RENDERER, StarMapRenderer } from './star-map.renderer';

/** Per-frame easing of the swing gain at 60Hz. */
const SWING_EASE = 0.12;
/** A nav jump's swing hold ends once the morph is this close to its target, in destinations. */
const HOLD_RELEASE = 0.05;
/**
 * Frames a hold survives without seeing the target move. The scroll event
 * that moves it normally lands before the next tick; the grace covers one
 * that doesn't, and a jump to where the reader already is.
 */
const HOLD_GRACE_FRAMES = 2;
/** Below these, nothing on screen moves by a visible amount between frames. */
const SETTLED_TRANSIT = 1e-3;
const SETTLED_POINTER = 1e-4;
/** The frame-time check after the entrance: its length, and the median that counts as slow. */
const GUARD_FRAMES = 120;
const SLOW_FRAME_MS = 22;
/**
 * Frames sampled before the renderer exists, to learn the page's own cadence.
 * A browser that caps animation at 30fps (iOS Low Power Mode, an energy
 * saver) runs every page at ~33ms, so the guard measures the star map against
 * that rather than against 60fps, and SLOW_FACTOR is how much slower than it
 * the star map may make the page.
 */
const CADENCE_FRAMES = 12;
const SLOW_FACTOR = 1.3;
/** Narrow windows, matching the stylesheet's phone breakpoint, get the smaller field. */
const COMPACT_MAX_WIDTH = 600;

const STILL_POINTER = { x: 0, y: 0, homeWeight: 0 } as const;

/**
 * The star map: the site's constellation drawn in WebGL, with real depth, a
 * camera that steps aside during each morph and orbits gently with the
 * pointer, and a field of stars behind it. See
 * docs/adr/0014-star-map-in-webgl-and-one-camera.md.
 *
 * This component is the Angular shell around two pure parts: the morph and
 * camera math (star-map.math, star-map.scene) and the OGL renderer
 * (star-map.renderer). It measures, feeds one tick, and decides when to give
 * up: without a usable WebGL context, after a lost one, or when the first
 * frames after the entrance run slow, it renders the SVG constellation for
 * the rest of the session.
 */
@Component({
  selector: 'app-star-map',
  imports: [ConstellationComponent],
  templateUrl: './star-map.component.html',
  styleUrl: './star-map.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StarMapComponent {
  private readonly createRenderer = inject(STAR_MAP_RENDERER);
  private readonly loop = inject(ScrollLoopService);
  private readonly pulse = inject(FramePulseService);
  private readonly motion = inject(MotionSettingsService);
  private readonly parallax = inject(HeroParallaxService);
  private readonly nav = inject(NavTransitionService);
  private readonly theme = inject(ThemeService);
  private readonly zone = inject(NgZone);

  /** 'pending' until the frame after first render, then whichever renderer is drawing. */
  readonly mode = signal<'pending' | 'webgl' | 'svg'>('pending');
  /** The SVG is taking over from WebGL mid-visit rather than starting the page. */
  readonly resumed = signal(false);

  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private readonly framingBox = viewChild.required<ElementRef<HTMLElement>>('framing');

  private renderer: StarMapRenderer | null = null;
  private palette: StarMapPalette = this.theme.starMapPalette();
  private readonly scene = createScene();
  private readonly driver = new MorphDriver();
  private readonly framing: Framing = { canvasW: 0, canvasH: 0, cx: 0, cy: 0, boxW: 0 };
  private readonly poseInput: PoseInput = {
    pointerX: 0,
    pointerY: 0,
    homeWeight: 0,
    frac: 0,
    swingDir: 1,
    swingGain: 0,
    entrance: 0,
  };
  private readonly pose = cameraPose(this.poseInput);
  private readonly figure: FigureFrame = {
    stars: order[0].stars,
    fromLinks: order[0].links,
    toLinks: order[0].links,
    frac: 0,
    transit: 0,
    time: 0,
    drift: 0,
    sinceEntrance: 0,
  };

  private initFrame = 0;
  private destroyed = false;
  private releaseTick: (() => void) | null = null;
  private releaseTeleport: (() => void) | null = null;
  private sizedW = 0;
  private sizedH = 0;
  private sizedDpr = 0;

  /** Something other than the morph changed (resize, theme) and the next tick must draw. */
  private dirty = true;
  /** Last figure drawn on the reduced-motion path; -1 when motion is allowed. */
  private stillFigure = -1;
  /** Time of the first frame, NaN before it; -Infinity once reduced motion skips the entrance. */
  private entranceStart = NaN;
  private skipNext = false;
  private drawnPointerX = 0;
  private drawnPointerY = 0;

  private swingGain = 1;
  private lastSwing = 0;
  private swingHeld = false;
  private holdGrace = 0;
  /** Whether the current hold has seen how far its jump goes. */
  private holdSized = false;

  private degraded = false;
  private guardDone = false;
  private readonly cadence: number[] = [];
  private lastFrameAt = NaN;
  /** The median frame time before the star map drew anything, in ms. */
  private baselineFrame = 1000 / 60;
  private readonly frameTimes = new Float64Array(GUARD_FRAMES);
  private frameCount = 0;

  constructor() {
    // Creating the context and compiling the shaders is a 10–60 ms task.
    // Starting a few frames after first render keeps it off the hero's largest
    // paint, and those frames are the cadence sample the guard compares with.
    afterNextRender(() => {
      this.zone.runOutsideAngular(() => {
        this.initFrame = requestAnimationFrame(this.sampleCadence);
      });
    });

    effect(() => {
      const palette = this.theme.starMapPalette();
      untracked(() => this.applyPalette(palette));
    });

    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      cancelAnimationFrame(this.initFrame);
      this.stopWebgl();
    });
  }

  private readonly sampleCadence = (time: number): void => {
    this.initFrame = 0;
    if (this.destroyed) {
      return;
    }
    if (!Number.isNaN(this.lastFrameAt) && time > this.lastFrameAt) {
      this.cadence.push(time - this.lastFrameAt);
    }
    this.lastFrameAt = time;
    // Reduced motion never runs the guard, so it has no use for the sample.
    if (this.cadence.length < CADENCE_FRAMES && !this.motion.reducedMotion()) {
      this.initFrame = requestAnimationFrame(this.sampleCadence);
      return;
    }
    if (this.cadence.length > 0) {
      const sorted = this.cadence.slice().sort((a, b) => a - b);
      this.baselineFrame = sorted[sorted.length >> 1];
    }
    this.start();
  };

  private start(): void {
    let renderer: StarMapRenderer | null;
    try {
      renderer = this.createRenderer({ maxField: FIELD.count, seed: FIELD.seed });
    } catch {
      renderer = null;
    }
    if (!renderer) {
      this.setMode('svg');
      return;
    }

    this.renderer = renderer;
    this.stage().nativeElement.appendChild(renderer.canvas);
    renderer.onContextLost(() => this.fallBack());
    renderer.setPalette(this.palette);
    this.measure();
    // Already outside Angular (this runs from the rAF above): none of these
    // needs change detection.
    window.addEventListener('resize', this.onResize, { passive: true });
    this.releaseTeleport = this.nav.onTeleport(this.onTeleport);
    this.releaseTick = this.pulse.onTick(this.tick);
    this.setMode('webgl');
  }

  private readonly tick = (now: number, dt: number): void => {
    const renderer = this.renderer;
    if (!renderer || this.framing.canvasW <= 0 || this.framing.canvasH <= 0) {
      return;
    }
    const reduce = this.motion.reducedMotion();
    const count = this.loop.cycleLength || order.length;
    const target = this.loop.position();
    const frame = this.driver.advance(target, count, reduce);

    // As in ConstellationComponent.renderAt: under reduced motion the frame is
    // a function of the snapped figure alone, so it is drawn only when that
    // changes, or when a resize or theme flip has invalidated the canvas.
    if (reduce) {
      if (frame.fromIndex === this.stillFigure && !this.dirty) {
        return;
      }
      this.stillFigure = frame.fromIndex;
      this.entranceStart = -Infinity;
    } else {
      this.stillFigure = -1;
    }
    if (Number.isNaN(this.entranceStart)) {
      this.entranceStart = now;
    }
    const sinceEntrance = now - this.entranceStart;

    if (this.swingHeld) {
      const distance = loopDistance(target, frame.rendered, count);
      if (distance >= HOLD_RELEASE && !this.holdSized) {
        // The first tick that sees where the jump lands. A single hop has no
        // figures in between to whip through, so it swings like a scrolled one.
        this.holdSized = true;
        this.swingHeld = distance > 1 + HOLD_RELEASE;
      }
      if (this.swingHeld) {
        if (distance >= HOLD_RELEASE) {
          this.holdGrace = 0;
        } else if (this.holdGrace > 0) {
          this.holdGrace--;
        } else {
          this.swingHeld = false;
        }
      }
    }
    const curve = swingCurve(frame.frac);
    this.swingGain = swingGainStep(
      this.swingGain,
      this.swingHeld,
      curve,
      this.lastSwing,
      smoothingK(dt, SWING_EASE),
    );
    this.lastSwing = curve * this.swingGain;

    const pointer = reduce ? STILL_POINTER : this.parallax.pointer();
    const settled =
      !reduce &&
      !this.dirty &&
      sinceEntrance >= ENTRANCE_MS &&
      frame.transit < SETTLED_TRANSIT &&
      Math.abs(pointer.x - this.drawnPointerX) < SETTLED_POINTER &&
      Math.abs(pointer.y - this.drawnPointerY) < SETTLED_POINTER;
    // Settled, only the slow drift moves: half rate is indistinguishable and
    // halves the cost. The morph driver above still advances every tick, so
    // its easing keeps its 60Hz feel. Not before the frame-time check is done,
    // which must time the full-rate cost it is guarding.
    this.skipNext = settled && this.guardDone && !this.skipNext;
    if (!this.skipNext) {
      this.drawnPointerX = pointer.x;
      this.drawnPointerY = pointer.y;

      const input = this.poseInput;
      input.pointerX = pointer.x;
      input.pointerY = pointer.y;
      input.homeWeight = pointer.homeWeight;
      input.frac = frame.frac;
      input.swingDir = RIG.swingDir[frame.fromIndex % RIG.swingDir.length];
      input.swingGain = reduce ? 0 : this.swingGain;
      input.entrance = entranceDollyProgress(sinceEntrance);
      viewMatrix(cameraPose(input, this.pose), this.scene.view);

      const from = order[frame.fromIndex];
      const to = order[frame.toIndex];
      const figure = this.figure;
      figure.stars = interpolateConstellation(from, to, frame.eased).stars;
      figure.fromLinks = from.links;
      figure.toLinks = to.links;
      figure.frac = frame.frac;
      figure.transit = frame.transit;
      figure.time = now / 1000;
      figure.drift = reduce ? 0 : 1;
      figure.sinceEntrance = sinceEntrance;
      writeFigure(this.scene, figure, this.framing, this.palette);
      this.scene.fieldOpacity = entranceFieldOpacity(sinceEntrance);

      try {
        renderer.draw(this.scene);
      } catch {
        // An exception here would escape into FramePulseService's loop and
        // stop it for every subscriber on the page. OGL can throw on the first
        // draw (a WebGL 1 device without ANGLE_instanced_arrays), so a device
        // that can't draw gets the SVG instead.
        this.fallBack();
        return;
      }
      this.dirty = false;
    }

    // Reduced motion draws a handful of frames a session; its cadence says
    // nothing about what drawing costs.
    if (!reduce && sinceEntrance >= ENTRANCE_MS) {
      this.watchFrameTime(dt);
    }
  };

  /**
   * After the entrance, take the median frame time over GUARD_FRAMES frames.
   * It counts as slow past 22ms, or past 1.3x the page's own cadence where the
   * browser already runs slower than that. Slow once: halve the pixel ratio
   * and the field, and measure again. Slow twice: this device is better
   * served by the SVG.
   */
  private watchFrameTime(dt: number): void {
    if (this.guardDone || dt <= 0) {
      return;
    }
    this.frameTimes[this.frameCount++] = dt;
    if (this.frameCount < GUARD_FRAMES) {
      return;
    }
    this.frameCount = 0;
    const sorted = this.frameTimes.slice().sort();
    const median = (sorted[GUARD_FRAMES / 2 - 1] + sorted[GUARD_FRAMES / 2]) / 2;
    if (median <= Math.max(SLOW_FRAME_MS, this.baselineFrame * SLOW_FACTOR)) {
      this.guardDone = true;
    } else if (!this.degraded) {
      this.degraded = true;
      this.measure();
    } else {
      this.guardDone = true;
      this.fallBack();
    }
  }

  /** Read the stage and framing box, then size the buffer and the projection to them. */
  private measure(): void {
    const renderer = this.renderer;
    if (!renderer) {
      return;
    }
    const stage = this.stage().nativeElement.getBoundingClientRect();
    const box = this.framingBox().nativeElement.getBoundingClientRect();
    const framing = this.framing;
    framing.canvasW = stage.width;
    framing.canvasH = stage.height;
    framing.cx = box.left + box.width / 2 - stage.left;
    framing.cy = box.top + box.height / 2 - stage.top;
    framing.boxW = box.width;
    if (stage.width <= 0 || stage.height <= 0) {
      return;
    }

    const cap = this.motion.coarsePointer() ? 1.5 : 2;
    const dpr =
      budgetDpr(stage.width, stage.height, window.devicePixelRatio || 1, cap) *
      (this.degraded ? 0.5 : 1);
    if (stage.width !== this.sizedW || stage.height !== this.sizedH || dpr !== this.sizedDpr) {
      renderer.resize(stage.width, stage.height, dpr);
      this.sizedW = stage.width;
      this.sizedH = stage.height;
      this.sizedDpr = dpr;
    }
    projectionMatrix(framing, CLIP.near, CLIP.far, this.scene.proj);
    fieldExtent(framing, this.scene.fieldExtent);
    this.applyFieldCount();
    this.dirty = true;
  }

  private applyPalette(palette: StarMapPalette): void {
    this.palette = palette;
    if (this.renderer) {
      this.renderer.setPalette(palette);
      this.applyFieldCount();
      this.dirty = true;
    }
  }

  private applyFieldCount(): void {
    const compact = this.motion.coarsePointer() || this.framing.canvasW <= COMPACT_MAX_WIDTH;
    const budget = compact ? FIELD.countCompact : FIELD.count;
    this.renderer?.setFieldCount(
      Math.round(budget * this.palette.fieldCountFactor * (this.degraded ? 0.5 : 1)),
    );
  }

  private readonly onResize = (): void => this.measure();

  /**
   * A nav jump can land several destinations away in one frame, and the morph
   * then sweeps through every figure in between. Hold the swing until it
   * arrives, or the camera would whip from side to side; a jump of one
   * destination is let go as soon as its distance is known.
   */
  private readonly onTeleport = (): void => {
    this.swingHeld = true;
    this.holdGrace = HOLD_GRACE_FRAMES;
    this.holdSized = false;
  };

  /** Switch to the SVG constellation for the rest of the session. */
  private fallBack(): void {
    this.stopWebgl();
    this.resumed.set(true);
    this.setMode('svg');
  }

  private stopWebgl(): void {
    this.releaseTick?.();
    this.releaseTick = null;
    this.releaseTeleport?.();
    this.releaseTeleport = null;
    window.removeEventListener('resize', this.onResize);
    const renderer = this.renderer;
    this.renderer = null;
    if (renderer) {
      renderer.dispose();
      renderer.canvas.remove();
    }
  }

  /** The mode is read by an OnPush template, and every caller runs outside Angular. */
  private setMode(mode: 'webgl' | 'svg'): void {
    if (!this.destroyed) {
      this.zone.run(() => this.mode.set(mode));
    }
  }
}
