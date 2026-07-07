import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { ThemeService } from '../../core/theme.service';
import { FramePulseService } from '../../core/frame-pulse.service';
import { EXPERIENCE_GROUPS, ExperienceGroup, PROJECTS, Project } from './work-data';

@Component({
  selector: 'app-work',
  standalone: false,
  templateUrl: './work.component.html',
  styleUrl: './work.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkComponent implements AfterViewInit, OnDestroy {
  @ViewChild('projectsViewport') private viewportRef?: ElementRef<HTMLElement>;
  @ViewChild('projectsStage') private stageRef?: ElementRef<HTMLElement>;
  @ViewChild('projectsTrack') private trackRef?: ElementRef<HTMLElement>;
  // The live "02 / 03" readout. Updated imperatively (not via binding) so the
  // rAF loop never triggers Angular change detection.
  @ViewChild('showcaseCurrent') private currentRef?: ElementRef<HTMLElement>;

  readonly experienceGroups: readonly ExperienceGroup[] = EXPERIENCE_GROUPS;
  readonly projects: readonly Project[] = PROJECTS;

  // Only enabled on wide screens with motion allowed. Below that (or no-JS) the
  // host stays without `.showcase-on` and the cards render as a vertical stack —
  // fail-open, the same philosophy as the app shell's `reveal-ready`.
  // Vertical scroll budget = horizontal travel × this. >1 makes the cards drift
  // slightly slower than the scroll (calm, ~1:1 feel) and leaves room for the
  // eased transform to settle the first/last card cleanly at the pin's ends.
  private static readonly SCROLL_FACTOR = 1.2;

  private readonly mqWide = window.matchMedia('(min-width: 900px)');
  private reduce = false;
  private active = false;

  private unsub: (() => void) | null = null;
  private rendered = 0;
  private stickRange = 0;
  private maxX = 0;

  // Cached geometry for the per-frame focus pass, so the loop stays write-only
  // (no getBoundingClientRect churn while a transform is being written).
  private stageWidth = 0;
  private cards: { el: HTMLElement; center: number }[] = [];
  private activeIndex = -1;

  constructor(
    private theme: ThemeService,
    private pulse: FramePulseService,
    private host: ElementRef<HTMLElement>,
  ) {}

  projectImg(p: Project): string {
    return this.theme.themeAsset(p.img.dark, p.img.light);
  }

  projectAlt(p: Project): string {
    return this.theme.themeAsset(p.img.alt.dark, p.img.alt.light);
  }

  ngAfterViewInit(): void {
    this.reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.applyMode();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.applyMode();
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
      // Keyboard focus drives the pin: tabbing to an off-frame card's GitHub
      // link would otherwise land on a masked, invisible control. This brings
      // the focused card into frame instead.
      this.trackRef?.nativeElement.addEventListener('focusin', this.onFocusIn);
      this.unsub = this.pulse.onTick(this.tick);
    } else {
      host.classList.remove('showcase-on');
      this.unsub?.();
      this.unsub = null;
      this.trackRef?.nativeElement.removeEventListener('focusin', this.onFocusIn);
      this.rendered = 0;
      this.activeIndex = -1;
      if (this.trackRef) {
        this.trackRef.nativeElement.style.transform = '';
      }
      this.cards.forEach(c => c.el.style.removeProperty('--card-focus'));
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
    // screen-centre math in tick().
    this.cards = Array.from(track.querySelectorAll<HTMLElement>('.project-card')).map(el => ({
      el,
      center: el.offsetLeft + el.offsetWidth / 2,
    }));
    if (this.maxX > 0) {
      this.stickRange = Math.round(this.maxX * WorkComponent.SCROLL_FACTOR);
      viewport.style.height = stage.offsetHeight + this.stickRange + 'px';
    } else {
      this.stickRange = 0;
    }
  }

  private tick = (_now: number, dt: number): void => {
    const viewport = this.viewportRef?.nativeElement;
    const stage = this.stageRef?.nativeElement;
    const track = this.trackRef?.nativeElement;
    if (!viewport || !stage || !track || this.stickRange <= 0 || this.maxX <= 0) {
      return;
    }
    const p = Math.min(1, Math.max(0, -viewport.getBoundingClientRect().top / this.stickRange));
    const target = -p * this.maxX;
    // Frame-rate-independent exponential smoothing: keeps the calm ≈0.12/60fps
    // feel identical at 60Hz or 120Hz, so the sweep never reads faster or
    // "slippery" on high-refresh displays.
    const k = dt > 0 ? 1 - Math.pow(1 - 0.12, dt / (1000 / 60)) : 0.12;
    this.rendered += (target - this.rendered) * k;
    track.style.transform = `translate3d(${this.rendered.toFixed(2)}px,0,0)`;

    // Progress (0→1) drives the pinned HUD rail and the entry-hint fade — pure
    // CSS downstream, so no per-frame change detection.
    stage.style.setProperty('--showcase-progress', p.toFixed(4));

    // Focus emphasis: dim the cards peeking at the mask edges so the one nearest
    // the stage centre reads as the subject. Screen centre in track coords is
    // (stageWidth/2 − rendered); uses cached centres, so no layout reads here.
    const focusX = this.stageWidth / 2 - this.rendered;
    const half = this.stageWidth / 2 || 1;
    for (const card of this.cards) {
      const d = Math.abs(card.center - focusX) / half;
      const focus = Math.max(0, Math.min(1, 1 - d));
      card.el.style.setProperty('--card-focus', focus.toFixed(3));
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
  };

  /** Bring the card that just received focus into the pinned frame. */
  private onFocusIn = (event: FocusEvent): void => {
    if (!this.active || this.stickRange <= 0) {
      return;
    }
    const card = (event.target as HTMLElement | null)?.closest('.project-card') as HTMLElement | null;
    if (!card) {
      return;
    }
    const index = this.cards.findIndex(c => c.el === card);
    if (index >= 0) {
      this.scrollCardIntoFrame(index);
    }
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
    this.trackRef?.nativeElement.removeEventListener('focusin', this.onFocusIn);
  }
}
