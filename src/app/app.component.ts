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
  // Scroll offset of the Home-clone's top = one full loop "cycle". Reaching it
  // means we are exactly one cycle down, where the clone is pixel-identical to
  // the real Home, so we can reset by subtracting it invisibly.
  private wrapAt = 0;
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
      this.dests.forEach((d) => {
        // Skip anything pre-revealed (real Home + its clone): both are loop
        // anchors that must always match, so a fast scroll can't catch them
        // mid-reveal. Only Work/About/Contact get the scroll-reveal.
        if (!d.nativeElement.classList.contains('is-visible')) {
          this.io!.observe(d.nativeElement);
        }
      });
      document.body.classList.add('reveal-ready');
    }
  }

  @HostListener('window:scroll')
  onScroll(): void {
    // Seamless wrap: at the clone's top we are one cycle down on pixel-identical
    // content, so subtract the cycle (keeping any momentum overshoot of N px,
    // which lands N px into the real Home) instead of snapping to the top.
    if (this.wrapAt > 0 && window.scrollY >= this.wrapAt) {
      window.scrollTo(0, window.scrollY - this.wrapAt);
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
    // The last #dest is the Home clone; its top is one cycle down.
    this.wrapAt = this.anchors.length ? this.anchors[this.anchors.length - 1] : 0;
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
    // Morph over a fixed band (~one viewport) right before each boundary, so every
    // transition lasts the same scroll distance regardless of section height and
    // each figure RESTS while its section is in view. A plain proportional mapping
    // stretched the Orion→Leo morph across the whole (now very tall) Work showcase,
    // so the figure never settled and nav warps through it felt awkward.
    const band = window.innerHeight * 0.85;
    for (let k = 0; k < last; k++) {
      if (y < a[k + 1]) {
        const seg = Math.min(band, Math.max(1, a[k + 1] - a[k]));
        const start = a[k + 1] - seg;
        return y <= start ? k : k + (y - start) / seg;
      }
    }
    // At/after the clone's top (= count, which the looping constellation reads as
    // Home again). The wrap fires here, so this value barely renders.
    return last;
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
    this.io?.disconnect();
  }
}
