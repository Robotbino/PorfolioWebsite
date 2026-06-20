import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  QueryList,
  ViewChildren,
} from '@angular/core';
import { ThemeService } from './core/theme.service';
import { ScrollStageService } from './scroll-stage.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: false,
  styleUrl: './app.component.css',
})
export class AppComponent implements AfterViewInit, OnDestroy {
  @ViewChildren('dest') private dests!: QueryList<ElementRef<HTMLElement>>;

  private anchors: number[] = [];
  private scrollMax = 1;
  private reduce = false;
  private ro?: ResizeObserver;
  private io?: IntersectionObserver;

  // Public so the persistent background layer can bind to the theme signal.
  constructor(
    public theme: ThemeService,
    private stage: ScrollStageService,
  ) {}

  ngAfterViewInit(): void {
    this.reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.measure();
    this.update();

    // Section heights shift as lazy images load, so re-measure on any reflow.
    this.ro = new ResizeObserver(() => {
      this.measure();
      this.update();
    });
    this.ro.observe(document.body);

    // Reveal each destination as it enters (fail-open: only hidden once JS arms it).
    if (!this.reduce) {
      this.io = new IntersectionObserver(
        (entries) =>
          entries.forEach((e) => e.target.classList.toggle('is-visible', e.isIntersecting)),
        { threshold: 0.15 },
      );
      this.dests.forEach((d) => this.io!.observe(d.nativeElement));
      document.body.classList.add('reveal-ready');
    }
  }

  @HostListener('window:scroll')
  onScroll(): void {
    // Seamless wrap: hitting the bottom of the runway teleports back to the top.
    if (window.scrollY >= this.scrollMax - 1) {
      window.scrollTo(0, 0);
      this.stage.position = 0;
      return;
    }
    this.update();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.measure();
    this.update();
  }

  private measure(): void {
    this.anchors = this.dests.map((d) => d.nativeElement.offsetTop);
    this.scrollMax = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  }

  private update(): void {
    this.stage.position = this.positionFor(window.scrollY);
  }

  /** Map a scroll offset to continuous destination units (0..count). */
  private positionFor(y: number): number {
    const a = this.anchors;
    if (a.length === 0) {
      return 0;
    }
    const last = a.length - 1;
    if (y <= a[0]) {
      return 0;
    }
    for (let k = 0; k < last; k++) {
      if (y < a[k + 1]) {
        return k + (y - a[k]) / Math.max(1, a[k + 1] - a[k]);
      }
    }
    // Final segment runs through the runway, morphing the last figure home.
    const denom = Math.max(1, this.scrollMax - a[last]);
    return last + Math.min(1, (y - a[last]) / denom);
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
    this.io?.disconnect();
  }
}
