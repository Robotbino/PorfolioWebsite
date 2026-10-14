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
import { NavTransitionService } from './core/nav-transition.service';
import { ScrollLoopService } from './scroll-loop.service';
import { arrivalOrigin } from './arrival.math';
import { AuroraComponent } from './aurora/aurora.component';
import { StarMapComponent } from './star-map/star-map.component';
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
    StarMapComponent,
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
  private navTransition = inject(NavTransitionService);
  private zone = inject(NgZone);

  @ViewChildren('dest') private dests!: QueryList<ElementRef<HTMLElement>>;

  private reduce = false;
  private ro?: ResizeObserver;
  // innerHeight is a layout-flushing read that only changes on resize, so it is
  // cached here rather than read by update() on every scroll event.
  private viewportHeight = 0;
  private revealReleases: (() => void)[] = [];
  /** The destinations the scroll reveal hides until they arrive. */
  private arriving: HTMLElement[] = [];
  private teardown: (() => void)[] = [];
  private measureFrame = 0;

  constructor() {
    // A nav teleport reveals its landing section itself, ahead of the observer
    // below, so the arrival anchors are refreshed in the same task. Registered
    // at construction so this runs before any destination's own teleport
    // listener: the Work showcase measures its pin in one, and has to see the
    // section scaled about its fresh anchor rather than the last crossing's.
    this.teardown.push(this.navTransition.onTeleport(() => this.anchorArrivals(this.arriving)));
  }

  ngAfterViewInit(): void {
    this.reduce = this.motion.reducedMotion();
    this.viewportHeight = window.innerHeight;
    this.measure();
    this.update();

    // Scroll and resize are the app's hottest events and neither needs change
    // detection: the loop is a plain service the out-of-zone rAF consumers read
    // with a non-reactive `position()`, and the seam wrap is a scrollTo. A
    // @HostListener would tick the zone on every scroll event, so these are
    // registered by hand outside it — as FramePulseService and InViewportService
    // are.
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
        // mid-reveal. Only the four content destinations get the scroll-reveal.
        const el = d.nativeElement;
        if (!el.classList.contains('is-visible')) {
          this.arriving.push(el);
          this.revealReleases.push(
            // Measured against the viewport, not the section: a ratio threshold
            // can never be met by a section taller than the viewport divided by
            // it (Work is ~7 viewports, so it never shows 15% of itself), and
            // that section would stay hidden. Trimming the viewport's foot by
            // 15% reveals a section once it is properly in view, not when its
            // first pixel enters.
            this.inView.observe(el, { threshold: 0, rootMargin: '0px 0px -15% 0px' }, (visible) => {
              // The first report arrives as soon as the section is observed;
              // re-anchoring on a report that changes nothing would nudge a
              // section that is still settling.
              if (visible === el.classList.contains('is-visible')) {
                return;
              }
              // Anchor the arrival scale on the edge crossing the viewport, so
              // the edge seen first holds still. A tall section (Work is ~7
              // viewports) then never lurches, and nothing at that edge travels
              // to stack with the blocks' own rise, which is why ADR-0013
              // rejected a destination-level translate. Exits are anchored the
              // same way, so a section that reverses mid-fade keeps its anchor.
              this.anchorArrivals([el]);
              el.classList.toggle('is-visible', visible);
            }),
          );
        }
      });
      document.body.classList.add('reveal-ready');
    }
  }

  /** Point each section's arrival scale at its part level with the top of the viewport. */
  private anchorArrivals(sections: readonly HTMLElement[]): void {
    // Every rect is read before any anchor is written. A custom property is
    // inherited by the whole subtree, so each write re-styles its section
    // (Work's reaches the drum and the orbit), and a rect read after it would
    // force that recalculation on the spot, once per section, inside the view
    // transition's update callback, which holds the page frozen until it ends.
    const origins = sections.map((el) => {
      const { top, height } = el.getBoundingClientRect();
      return arrivalOrigin(top, height);
    });
    sections.forEach((el, i) => el.style.setProperty('--arrive-from', `${origins[i]}%`));
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
    // These `offsetTop`s are main-relative, not document-relative, because
    // `.navigation-bar` is `position: sticky` and therefore in flow above
    // <main>. That frame is deliberate: a section rests at `scrollY ===
    // offsetTop`, which is why Home rests at scrollY 0.
    //
    // Do NOT "correct" them to document space (`scrollY + rect.top`). Both
    // consumers use the anchors as DIFFERENCES, so the uniform nav-height
    // cancels — and re-adding it breaks the seam: `wrapOffset` is only
    // continuous while `wrapAt === cloneTop - homeTop`, which the raw clone
    // offsetTop already is. A document-space `wrapAt` overshoots by a
    // nav-height and pops the wrap ADR-0004 promises is invisible.
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
