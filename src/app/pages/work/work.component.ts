import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FramePulseService } from '../../core/frame-pulse.service';
import { MotionSettingsService } from '../../core/motion-settings.service';
import { NavTransitionService } from '../../core/nav-transition.service';
import { cardOffset, easeToward, smoothingK } from '../../motion.math';
import { EXPERIENCE_GROUPS, ExperienceGroup, PROJECTS, Project, ROLE, Role } from './work-data';
import { IconName } from '../../shared/icon/icons';
import { ScrollRevealDirective } from '../../scroll-reveal.directive';
import { IconComponent } from '../../shared/icon/icon.component';
import { ProjectScreenshotsComponent } from './project-screenshots/project-screenshots.component';
import { RoleFigureComponent } from './role-figure/role-figure.component';
import { ToolOrbitComponent } from './tool-orbit/tool-orbit.component';

/**
 * The per-card custom properties the showcase CSS turns into the 3D pose:
 * distance from the stage centre (-1…1), hover/focus lift (0…1) and where the
 * pointer sits on the card (-1…1 on each axis).
 */
type CardProperty = '--card-offset' | '--card-lift' | '--pointer-x' | '--pointer-y';
const CARD_PROPERTIES: readonly CardProperty[] = [
  '--card-offset',
  '--card-lift',
  '--pointer-x',
  '--pointer-y',
];

/** A card's cached geometry plus the hover state the loop eases. */
interface ShowcaseCard {
  el: HTMLElement;
  center: number;
  lift: number;
  pointerX: number;
  pointerY: number;
  /** Last value written per property, so a card at rest costs no style writes. */
  written: Partial<Record<CardProperty, string>>;
}

@Component({
  selector: 'app-work',
  templateUrl: './work.component.html',
  // Two stylesheets, one component: the pinned horizontal gallery is a
  // self-contained enhancement over the vertical card stack, and keeping it
  // separate also puts each file back inside the anyComponentStyle budget.
  // Encapsulation is per-component, not per-file, so :host(.showcase-on) in the
  // second sheet still resolves against this host.
  styleUrls: ['./work.component.css', './work.showcase.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ScrollRevealDirective,
    IconComponent,
    ProjectScreenshotsComponent,
    RoleFigureComponent,
    ToolOrbitComponent,
  ],
})
export class WorkComponent implements AfterViewInit, OnDestroy {
  private pulse = inject(FramePulseService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private motion = inject(MotionSettingsService);
  private navTransition = inject(NavTransitionService);
  private zone = inject(NgZone);

  @ViewChild('projectsViewport') private viewportRef?: ElementRef<HTMLElement>;
  @ViewChild('projectsStage') private stageRef?: ElementRef<HTMLElement>;
  @ViewChild('projectsTrack') private trackRef?: ElementRef<HTMLElement>;
  // The live "02 / 03" readout. Updated imperatively (not via binding) so the
  // rAF loop never triggers Angular change detection.
  @ViewChild('showcaseCurrent') private currentRef?: ElementRef<HTMLElement>;

  readonly role: Role = ROLE;
  readonly experienceGroups: readonly ExperienceGroup[] = EXPERIENCE_GROUPS;
  readonly projects: readonly Project[] = PROJECTS;

  /** The position line under a mouse, as listed; the role figure lifts its plate. */
  readonly picked = signal<number | null>(null);

  // Only enabled on wide screens with motion allowed. Below that (or no-JS) the
  // host stays without `.showcase-on` and the cards render as a vertical stack —
  // fail-open, the same philosophy as the app shell's `reveal-ready`.
  // Vertical scroll budget = horizontal travel × this. >1 makes the cards drift
  // slightly slower than the scroll (calm, ~1:1 feel) and leaves room for the
  // eased transform to settle the first/last card cleanly at the pin's ends.
  private static readonly SCROLL_FACTOR = 1.2;

  private readonly mqWide = window.matchMedia('(min-width: 900px)');
  // Live, not snapshotted at init: applyMode() re-runs on resize and on a
  // preference flip, so the showcase now arms and disarms with the setting.
  private get reduce(): boolean {
    return this.motion.reducedMotion();
  }
  private active = false;

  private unsub: (() => void) | null = null;
  private teleportRelease: (() => void) | null = null;
  private rendered = 0;
  private stickRange = 0;
  private maxX = 0;

  // Cached geometry for the per-frame card pass, so the loop stays write-only
  // (no getBoundingClientRect churn while a transform is being written).
  private stageWidth = 0;
  private cards: ShowcaseCard[] = [];
  // Distance between neighbouring card centres: one step of --card-offset.
  private cardPitch = 0;
  private activeIndex = -1;
  private resizeRelease: (() => void) | null = null;
  private trackListenersRelease: (() => void) | null = null;
  private viewReady = false;

  // Hover and keyboard focus only set targets; tick() eases each card toward
  // them, so the loop stays the one thing that moves a card.
  private hoveredCard: ShowcaseCard | null = null;
  private hoverX = 0;
  private hoverY = 0;
  private focusedCard: ShowcaseCard | null = null;

  constructor() {
    // Arm or disarm the moment the reduced-motion preference flips, not at the
    // next resize: the tilt and the pin must not outlive the setting.
    effect(() => {
      this.motion.reducedMotion();
      if (this.viewReady) {
        untracked(() => this.applyMode());
      }
    });
  }

  // Brand marks where one exists, a representative solid glyph otherwise.
  // Unmapped labels fall back to a generic code glyph.
  private static readonly TECH_ICONS: Readonly<Record<string, IconName>> = {
    Angular: 'angular',
    React: 'react',
    JavaScript: 'js',
    CSS3: 'css3',
    HTML5: 'html5',
    TypeScript: 'typescript',
    'Spring Boot': 'leaf',
    MySQL: 'database',
    JWT: 'key',
    WebGL: 'cube',
  };

  techIcon(name: string): IconName {
    return WorkComponent.TECH_ICONS[name] ?? 'code';
  }

  /**
   * Hover only: a tap has no hover to follow, so a touch screen leaves the
   * figure at rest. Letting go always returns it, whatever the pointer.
   */
  pickPosition(index: number | null): void {
    if (index !== null && !this.motion.finePointer()) {
      return;
    }
    this.picked.set(index);
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.applyMode();
    // A nav teleport lands the viewport somewhere new in one frame; the
    // exponentially-smoothed track would otherwise chase the new target with a
    // visible catch-up slide. Snap it to the landed geometry synchronously —
    // inside the view transition's update callback — so the captured snapshot
    // and the first live frames are already final.
    this.teleportRelease = this.navTransition.onTeleport(() => this.snapToTarget());
    this.listenForResize();
  }

  /**
   * Registered by hand outside the zone, matching AppComponent's scroll/resize
   * pair. As a @HostListener every resize event ticked the zone and ran a full
   * change-detection pass over the tree before doing the work below — which is
   * pure DOM measurement and style writes and needs no re-check at all.
   */
  private listenForResize(): void {
    this.zone.runOutsideAngular(() => {
      const onResize = () => this.applyMode();
      window.addEventListener('resize', onResize);
      this.resizeRelease = () => window.removeEventListener('resize', onResize);
    });
  }

  /**
   * Focus and pointer listeners for the armed showcase, outside the zone for
   * the same reason as resize: pointermove fires on every mouse movement, and
   * none of these handlers change anything a template binds to.
   *
   * Keyboard focus also drives the pin: tabbing to an off-frame card's link
   * would otherwise land on a masked, invisible control, so focusin brings the
   * focused card into frame.
   */
  private listenOnTrack(): void {
    const track = this.trackRef?.nativeElement;
    if (!track) {
      return;
    }
    this.zone.runOutsideAngular(() => {
      track.addEventListener('focusin', this.onFocusIn);
      track.addEventListener('focusout', this.onFocusOut);
      // pointerover as well as pointermove: when a scroll slides a card under a
      // pointer that hasn't moved, the browser sends boundary events but no
      // move, and the card arriving under the cursor should still turn.
      track.addEventListener('pointerover', this.onPointer);
      track.addEventListener('pointermove', this.onPointer);
      track.addEventListener('pointerleave', this.onPointerLeave);
    });
    this.trackListenersRelease = () => {
      track.removeEventListener('focusin', this.onFocusIn);
      track.removeEventListener('focusout', this.onFocusOut);
      track.removeEventListener('pointerover', this.onPointer);
      track.removeEventListener('pointermove', this.onPointer);
      track.removeEventListener('pointerleave', this.onPointerLeave);
    };
  }

  /** Idempotent: arm or disarm the horizontal showcase for the current viewport. */
  private applyMode(): void {
    const enable = !this.reduce && this.mqWide.matches;
    if (enable === this.active) {
      if (enable) {
        this.measure();
      }
      return;
    }
    this.active = enable;
    const host = this.host.nativeElement;
    if (enable) {
      host.classList.add('showcase-on');
      this.measure();
      this.listenOnTrack();
      this.unsub = this.pulse.onTick(this.tick);
    } else {
      host.classList.remove('showcase-on');
      this.unsub?.();
      this.unsub = null;
      this.trackListenersRelease?.();
      this.trackListenersRelease = null;
      this.rendered = 0;
      this.activeIndex = -1;
      this.hoveredCard = null;
      this.focusedCard = null;
      if (this.trackRef) {
        this.trackRef.nativeElement.style.transform = '';
      }
      for (const card of this.cards) {
        CARD_PROPERTIES.forEach((name) => card.el.style.removeProperty(name));
      }
      this.cards = [];
      this.stageRef?.nativeElement.style.removeProperty('--showcase-progress');
      if (this.viewportRef) {
        this.viewportRef.nativeElement.style.height = '';
      }
    }
  }

  private measure(): void {
    const viewport = this.viewportRef?.nativeElement;
    const stage = this.stageRef?.nativeElement;
    const track = this.trackRef?.nativeElement;
    if (!viewport || !stage || !track) {
      return;
    }
    // The track is wider than the frame; maxX is how far it must travel to bring
    // the last card into view. Derive the pinned scroll budget from that travel
    // (not a fixed vh) so the sweep stays ~1:1 with scroll at any width, then size
    // the viewport so the stage stays pinned for exactly that budget.
    this.maxX = track.scrollWidth - stage.clientWidth;
    this.stageWidth = stage.clientWidth;
    // Cache each card's centre in track-content coords. offsetLeft resolves
    // against the sticky stage (the nearest positioned ancestor), matching the
    // screen-centre math in tick(). Layout offsets ignore the card's own 3D
    // transform, so the pose never feeds back into the geometry. A card that was
    // already cached keeps its eased hover state, so a resize mid-hover doesn't
    // snap it flat.
    const cached = new Map(this.cards.map((card) => [card.el, card]));
    this.cards = Array.from(track.querySelectorAll<HTMLElement>('.project-card')).map((el) => {
      const center = el.offsetLeft + el.offsetWidth / 2;
      const card = cached.get(el) ?? {
        el,
        center,
        lift: 0,
        pointerX: 0,
        pointerY: 0,
        written: {},
      };
      card.center = center;
      return card;
    });
    this.cardPitch =
      this.cards.length > 1 ? this.cards[1].center - this.cards[0].center : this.stageWidth / 2;
    if (this.maxX > 0) {
      this.stickRange = Math.round(this.maxX * WorkComponent.SCROLL_FACTOR);
      viewport.style.height = stage.offsetHeight + this.stickRange + 'px';
    } else {
      this.stickRange = 0;
    }
  }

  /**
   * Pin progress (0→1) from live geometry, or null when the showcase isn't
   * runnable.
   *
   * This is the one layout read left on the frame path, and it stays live on
   * purpose: everything else here is measured once and cached, but the pin's
   * position depends on the height of everything above it, which moves as lazy
   * images below the fold resolve. A cached top would silently drift out of step
   * with the scroll after any such reflow, and the failure mode — a showcase
   * that tracks slightly wrong — is far worse than one rect read.
   */
  private progress(): number | null {
    const viewport = this.viewportRef?.nativeElement;
    if (!viewport || !this.stageRef || !this.trackRef || this.stickRange <= 0 || this.maxX <= 0) {
      return null;
    }
    return Math.min(1, Math.max(0, -viewport.getBoundingClientRect().top / this.stickRange));
  }

  private paint(p: number): void {
    const stage = this.stageRef?.nativeElement;
    const track = this.trackRef?.nativeElement;
    if (!stage || !track) {
      return;
    }
    track.style.transform = `translate3d(${this.rendered.toFixed(2)}px,0,0)`;

    // Progress (0→1) drives the pinned HUD rail and the entry-hint fade — pure
    // CSS downstream, so no per-frame change detection.
    stage.style.setProperty('--showcase-progress', p.toFixed(4));

    // Each card's pose inputs. CSS turns them into the tilt, depth, fade, shadow
    // and sheen, so this pass only writes numbers. Screen centre in track coords
    // is (stageWidth/2 − rendered); uses cached centres, so no layout reads here.
    const focusX = this.stageWidth / 2 - this.rendered;
    for (const card of this.cards) {
      this.writeCard(card, '--card-offset', cardOffset(card.center, focusX, this.cardPitch));
      this.writeCard(card, '--card-lift', card.lift);
      this.writeCard(card, '--pointer-x', card.pointerX);
      this.writeCard(card, '--pointer-y', card.pointerY);
    }

    // Numeric readout; write only when the nearest card changes.
    const n = this.cards.length;
    const active = n > 1 ? Math.round(p * (n - 1)) : 0;
    if (active !== this.activeIndex) {
      this.activeIndex = active;
      const readout = this.currentRef?.nativeElement;
      if (readout) {
        readout.textContent = '0' + (active + 1);
      }
    }
  }

  /**
   * Skips the write when the rounded value hasn't changed. Once the track and
   * the hover ease have settled, a resting showcase writes nothing per frame.
   */
  private writeCard(card: ShowcaseCard, name: CardProperty, value: number): void {
    const text = value.toFixed(3);
    if (card.written[name] !== text) {
      card.written[name] = text;
      card.el.style.setProperty(name, text);
    }
  }

  private tick = (_now: number, dt: number): void => {
    const p = this.progress();
    if (p === null) {
      return;
    }
    // Frame-rate-independent exponential smoothing: keeps the calm ≈0.12/60fps
    // feel identical at 60Hz or 120Hz, so the sweep never reads faster or
    // "slippery" on high-refresh displays.
    const k = smoothingK(dt, 0.12);
    this.rendered += (-p * this.maxX - this.rendered) * k;
    this.easeHover(smoothingK(dt, 0.15));
    this.paint(p);
  };

  /**
   * Eases every card toward its hover/focus targets. A card that loses the
   * pointer settles back over the next few frames rather than snapping flat.
   */
  private easeHover(k: number): void {
    for (const card of this.cards) {
      const hovered = card === this.hoveredCard;
      const lifted = hovered || card === this.focusedCard;
      card.lift = easeToward(card.lift, lifted ? 1 : 0, k);
      card.pointerX = easeToward(card.pointerX, hovered ? this.hoverX : 0, k);
      card.pointerY = easeToward(card.pointerY, hovered ? this.hoverY : 0, k);
    }
  }

  /**
   * A nav teleport just relocated the viewport: kill the smoothing lag by
   * writing the track (and everything downstream) at its exact target. Runs
   * synchronously inside the teleport, so the interleaved rAF tick becomes a
   * fixed-point write — no catch-up slide, correct readout on the first frame.
   */
  private snapToTarget(): void {
    if (!this.active) {
      return;
    }
    const p = this.progress();
    if (p === null) {
      return;
    }
    this.rendered = -p * this.maxX;
    this.paint(p);
  }

  private onFocusIn = (event: FocusEvent): void => {
    if (!this.active || this.stickRange <= 0) {
      return;
    }
    const target = event.target as HTMLElement | null;
    const card = target?.closest('.project-card') as HTMLElement | null;
    if (!target || !card) {
      return;
    }
    const index = this.cards.findIndex((c) => c.el === card);
    if (index >= 0) {
      // A mouse click focuses the link it opens too. Only keyboard focus lifts
      // the card, matching where the browser draws a focus ring.
      this.focusedCard = target.matches(':focus-visible') ? this.cards[index] : null;
      this.scrollCardIntoFrame(index);
    }
  };

  private onFocusOut = (event: FocusEvent): void => {
    const next = event.relatedTarget as Node | null;
    // Tabbing between two links on the same card keeps it lifted.
    if (this.focusedCard && !(next && this.focusedCard.el.contains(next))) {
      this.focusedCard = null;
    }
  };

  /**
   * Records which card is under a mouse and where on it (−1…1 on each axis),
   * for the hover turn. Touch is ignored: a tap has no hover to follow. The
   * one rect read happens here in the event handler, never in the loop.
   */
  private onPointer = (event: PointerEvent): void => {
    if (event.pointerType === 'touch' || !this.motion.finePointer()) {
      return;
    }
    const el = (event.target as Element | null)?.closest('.project-card');
    const card = el ? (this.cards.find((c) => c.el === el) ?? null) : null;
    this.hoveredCard = card;
    if (!card) {
      return;
    }
    const rect = card.el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      this.hoverX = Math.min(1, Math.max(-1, ((event.clientX - rect.left) / rect.width) * 2 - 1));
      this.hoverY = Math.min(1, Math.max(-1, ((event.clientY - rect.top) / rect.height) * 2 - 1));
    }
  };

  private onPointerLeave = (): void => {
    this.hoveredCard = null;
  };

  /**
   * Scroll the window so card `index` sits centred in the pin. The vertical
   * scroll position that yields horizontal progress `targetP` is derived by
   * inverting the tick's p = −viewportTop / stickRange.
   */
  private scrollCardIntoFrame(index: number): void {
    const viewport = this.viewportRef?.nativeElement;
    const n = this.cards.length;
    if (!viewport || this.stickRange <= 0 || n < 2) {
      return;
    }
    const targetP = index / (n - 1);
    const rectTop = viewport.getBoundingClientRect().top;
    const currentP = Math.min(1, Math.max(0, -rectTop / this.stickRange));
    // Already framed — skip so tabbing between links doesn't re-scroll.
    if (Math.abs(targetP - currentP) < 0.02) {
      return;
    }
    const targetScrollY = window.scrollY + rectTop + targetP * this.stickRange;
    window.scrollTo({ top: targetScrollY, behavior: 'smooth' });
  }

  ngOnDestroy(): void {
    this.unsub?.();
    this.teleportRelease?.();
    this.resizeRelease?.();
    this.trackListenersRelease?.();
  }
}
