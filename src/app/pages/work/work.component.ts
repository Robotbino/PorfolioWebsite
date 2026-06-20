import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  NgZone,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { ThemeService } from '../../core/theme.service';

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

  // Only enabled on wide screens with motion allowed. Below that (or no-JS) the
  // host stays without `.showcase-on` and the cards render as a vertical stack —
  // fail-open, the same philosophy as the app shell's `reveal-ready`.
  // Vertical scroll budget = horizontal travel × this. >1 makes the cards drift
  // slightly slower than the scroll (calm, ~1:1 feel) and leaves room for the
  // eased transform to settle the first/last card cleanly at the pin's ends.
  private static readonly SCROLL_FACTOR = 1.2;

  private readonly mqWide = window.matchMedia('(min-width: 769px)');
  private reduce = false;
  private active = false;

  private rafId = 0;
  private rendered = 0; // eased translateX (px), lerped toward the scroll target
  // Cached so the per-frame work is one rect read + one transform write; the
  // expensive layout reads only happen on (re)measure.
  private stickRange = 0;
  private maxX = 0;

  constructor(
    private theme: ThemeService,
    private zone: NgZone,
    private host: ElementRef<HTMLElement>,
  ) {}

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
      this.zone.runOutsideAngular(() => {
        this.rafId = requestAnimationFrame(this.tick);
      });
    } else {
      host.classList.remove('showcase-on');
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
      this.rendered = 0;
      if (this.trackRef) {
        this.trackRef.nativeElement.style.transform = '';
      }
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
    if (this.maxX > 0) {
      this.stickRange = Math.round(this.maxX * WorkComponent.SCROLL_FACTOR);
      viewport.style.height = stage.offsetHeight + this.stickRange + 'px';
    } else {
      this.stickRange = 0;
    }
  }

  private tick = (): void => {
    const viewport = this.viewportRef?.nativeElement;
    const track = this.trackRef?.nativeElement;
    if (viewport && track && this.stickRange > 0 && this.maxX > 0) {
      // viewport.top runs from 0 (sweep start) to -stickRange (sweep end).
      const p = Math.min(1, Math.max(0, -viewport.getBoundingClientRect().top / this.stickRange));
      const target = -p * this.maxX;
      // Same 0.12 inertia as the constellation glide, so the two motions feel kin.
      this.rendered += (target - this.rendered) * 0.12;
      track.style.transform = `translate3d(${this.rendered.toFixed(2)}px,0,0)`;
    }
    this.rafId = requestAnimationFrame(this.tick);
  };

  ngOnDestroy(): void {
    cancelAnimationFrame(this.rafId);
  }

  public get portfolioImageSrc(): string {
    return this.theme.isDark()
      ? '/assets/portfolio_dark_mode.png'
      : '/assets/portfolio_light_mode.png';
  }

  public get portfolioImageAlt(): string {
    return this.theme.isDark()
      ? 'Portfolio website in dark mode'
      : 'Portfolio website in light mode';
  }
}
