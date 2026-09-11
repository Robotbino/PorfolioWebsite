import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  QueryList,
  ViewChildren,
  inject,
} from '@angular/core';
import { ThemeService } from './core/theme.service';
import { MotionSettingsService } from './core/motion-settings.service';
import { InViewportService } from './core/in-viewport.service';
import { ScrollLoopService } from './scroll-loop.service';
import { AuroraComponent } from './aurora/aurora.component';
import { ConstellationComponent } from './constellation/constellation.component';
import { SiteNavComponent } from './layout/site-nav/site-nav.component';
import { LandingpageComponent } from './landingpage/landingpage.component';
import { WorkComponent } from './pages/work/work.component';
import { AboutComponent } from './pages/about/about.component';
import { CertificationsComponent } from './pages/certifications/certifications.component';
import { ContactComponent } from './pages/contact/contact.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  imports: [
    AuroraComponent,
    ConstellationComponent,
    SiteNavComponent,
    LandingpageComponent,
    WorkComponent,
    AboutComponent,
    CertificationsComponent,
    ContactComponent,
  ],
  // The shell's own template is static (the aurora's inputs change only on a
  // theme flip, which is a signal read). Nothing here needs to be re-checked on
  // an unrelated event, and the scroll/resize listeners below deliberately run
  // outside the zone, so OnPush matches how this component actually behaves.
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements AfterViewInit, OnDestroy {
  theme = inject(ThemeService);
  private loop = inject(ScrollLoopService);
  private motion = inject(MotionSettingsService);
  private inView = inject(InViewportService);
  private zone = inject(NgZone);

  @ViewChildren('dest') private dests!: QueryList<ElementRef<HTMLElement>>;

  private reduce = false;
  private ro?: ResizeObserver;
  // innerHeight is a layout-flushing read and only changes on resize, but
  // update() ran on every scroll event and read it each time.
  private viewportHeight = 0;
  private revealReleases: (() => void)[] = [];
  private teardown: (() => void)[] = [];
  private measureFrame = 0;

  ngAfterViewInit(): void {
    this.reduce = this.motion.reducedMotion();
    this.viewportHeight = window.innerHeight;
    this.measure();
    this.update();

    // Scroll and resize are the app's hottest events and neither needs change
    // detection: the loop is a plain service the out-of-zone rAF consumers read
    // with a non-reactive `position()`, and the seam wrap is a scrollTo. Running
    // them through @HostListener meant every scroll event ticked the zone and
    // re-checked the whole default-strategy tree. Registered by hand outside the
    // zone instead, matching FramePulseService and InViewportService.
    this.zone.runOutsideAngular(() => {
      const onScroll = () => this.onScroll();
      const onResize = () => {
        this.viewportHeight = window.innerHeight;
        this.measure();
        this.update();
      };
      // passive: this listener never calls preventDefault, so let the browser
      // scroll without waiting on it.
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onResize);
      this.teardown.push(
        () => window.removeEventListener('scroll', onScroll),
        () => window.removeEventListener('resize', onResize),
      );

      // Section heights shift as lazy images load, so re-measure on any reflow.
      // Coalesced to one frame: measure() writes nothing itself, but the Work
      // showcase's own measure sets `viewport.style.height`, which can retrigger
      // this observer — without the guard the two can chase each other.
      this.ro = new ResizeObserver(() => this.scheduleMeasure());
      this.ro.observe(document.body);
    });

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

  private onScroll(): void {
    // Seamless wrap: at the clone's top we are one cycle down on pixel-identical
    // content, so the loop hands back the offset to subtract (keeping momentum
    // overshoot) instead of snapping to the top. null = no wrap due.
    const adjustment = this.loop.wrapOffset(window.scrollY);
    if (adjustment !== null) {
      window.scrollTo(0, adjustment);
    }
    this.update();
  }

  /** Collapse a burst of reflows into a single measure on the next frame. */
  private scheduleMeasure(): void {
    if (this.measureFrame !== 0) {
      return;
    }
    this.measureFrame = requestAnimationFrame(() => {
      this.measureFrame = 0;
      // Refreshed here too, not just on `resize`: mobile browser chrome
      // collapsing changes innerHeight, and this coalesced reflow pass is the
      // one place that is cheap enough to re-read it outside a resize event.
      this.viewportHeight = window.innerHeight;
      this.measure();
      this.update();
    });
  }

  private measure(): void {
    // Hand the loop the section offsets (the last #dest is the Home clone); it
    // derives the cycle length + wrap point. DOM read stays here; math is the
    // loop's.
    //
    // These are `offsetTop` against a POSITIONED <main>, so they are main-
    // relative, not document-relative — main sits one --nav-height down the page
    // because `.navigation-bar` is `position: sticky` and therefore in flow.
    // That is deliberate: main-relative IS the scroll-position frame. A section
    // rests where its top clears the bar, i.e. at `scrollY === offsetTop`, which
    // is why every destination frames identically (its top at viewport y =
    // nav-height) and why Home rests at scrollY 0.
    //
    // Do NOT "correct" these to document space (`scrollY + rect.top`). Both
    // consumers use the anchors as DIFFERENCES, so the uniform nav-height
    // cancels — and re-adding it breaks the seam: `wrapOffset` subtracts
    // `wrapAt` from `scrollY`, which is only continuous while
    // `wrapAt === cloneTop - homeTop`. Home's anchor is 0, so the raw clone
    // offsetTop already IS that span; a document-space `wrapAt` would overshoot
    // it by a nav-height and pop the wrap ADR-0004 promises is invisible.
    this.loop.setAnchors(this.dests.map((d) => d.nativeElement.offsetTop));
  }

  private update(): void {
    this.loop.update(window.scrollY, this.viewportHeight);
  }

  ngOnDestroy(): void {
    if (this.measureFrame !== 0) {
      cancelAnimationFrame(this.measureFrame);
    }
    this.ro?.disconnect();
    this.teardown.forEach((off) => off());
    this.revealReleases.forEach((release) => release());
  }
}
