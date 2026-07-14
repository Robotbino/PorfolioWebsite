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
import { MotionSettingsService } from './core/motion-settings.service';
import { InViewportService } from './core/in-viewport.service';
import { ScrollLoopService } from './scroll-loop.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: false,
  styleUrl: './app.component.css',
})
export class AppComponent implements AfterViewInit, OnDestroy {
  @ViewChildren('dest') private dests!: QueryList<ElementRef<HTMLElement>>;

  private reduce = false;
  private ro?: ResizeObserver;
  private revealReleases: (() => void)[] = [];

  // Public so the persistent background layer can bind to the theme signal.
  constructor(
    public theme: ThemeService,
    private loop: ScrollLoopService,
    private motion: MotionSettingsService,
    private inView: InViewportService,
  ) {}

  ngAfterViewInit(): void {
    this.reduce = this.motion.reducedMotion();
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
      this.dests.forEach((d) => {
        // Skip anything pre-revealed (real Home + its clone): both are loop
        // anchors that must always match, so a fast scroll can't catch them
        // mid-reveal. Only Work/About/Contact get the scroll-reveal.
        const el = d.nativeElement;
        if (!el.classList.contains('is-visible')) {
          this.revealReleases.push(
            this.inView.observe(el, { threshold: 0.15 }, (visible) =>
              el.classList.toggle('is-visible', visible),
            ),
          );
        }
      });
      document.body.classList.add('reveal-ready');
    }
  }

  @HostListener('window:scroll')
  onScroll(): void {
    // Seamless wrap: at the clone's top we are one cycle down on pixel-identical
    // content, so the loop hands back the offset to subtract (keeping momentum
    // overshoot) instead of snapping to the top. null = no wrap due.
    const adjustment = this.loop.wrapOffset(window.scrollY);
    if (adjustment !== null) {
      window.scrollTo(0, adjustment);
    }
    this.update();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.measure();
    this.update();
  }

  private measure(): void {
    // Hand the loop the section offsets (the last #dest is the Home clone); it
    // derives the cycle length + wrap point. DOM read stays here; math is the
    // loop's.
    this.loop.setAnchors(this.dests.map((d) => d.nativeElement.offsetTop));
  }

  private update(): void {
    this.loop.update(window.scrollY, window.innerHeight);
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
    this.revealReleases.forEach((release) => release());
  }
}
