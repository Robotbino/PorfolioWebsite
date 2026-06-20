import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
} from '@angular/core';
import { ThemeService } from '../../core/theme.service';
import { ScrollStageService } from '../../scroll-stage.service';

/**
 * Persistent top navigation. Lives in the app shell so it survives scrolling.
 * Drives the theme toggle and scrolls the page to a destination section (the
 * conventional, always-operable wayfinding baseline alongside the star-map).
 *
 * It also fades while travelling away from Home: an out-of-zone rAF reads the
 * shared scroll position and writes a single `--nav-mute` (0..1) custom property
 * the CSS interpolates off. The driver is loop-aware (distance-from-Home, not raw
 * scrollY) so the nav is back to full before the loop seam and never pops there.
 * See docs/adr/0005-loop-aware-nav-muting.md.
 */
@Component({
  selector: 'app-site-nav',
  standalone: false,
  templateUrl: './site-nav.component.html',
  styleUrl: './site-nav.component.css',
})
export class SiteNavComponent implements AfterViewInit, OnDestroy {
  // Number of real destinations (Home, Work, About, Contact); position wraps at
  // this value (count ≡ 0 = Home again). Matches the constellation's order length.
  private static readonly COUNT = 4;
  // Travel fraction (in destination units) over which the nav fully fades.
  private static readonly FADE_RANGE = 0.5;

  private rafId = 0;
  private lastMute = -1;

  constructor(
    public theme: ThemeService,
    private stage: ScrollStageService,
    private el: ElementRef<HTMLElement>,
    private zone: NgZone,
  ) {}

  ngAfterViewInit(): void {
    // Reduced motion keeps the nav fully visible (the fade is an aesthetic
    // declutter, not essential) — so we simply never arm the rAF.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    this.zone.runOutsideAngular(() => {
      this.rafId = requestAnimationFrame(this.tick);
    });
  }

  private tick = (): void => {
    const count = SiteNavComponent.COUNT;
    const pos = this.stage.position;
    // Distance from Home on the loop (0 at Home on either side of the seam).
    const distance = Math.min(pos, count - pos);
    const mute = Math.min(1, distance / SiteNavComponent.FADE_RANGE);
    if (Math.abs(mute - this.lastMute) > 0.001) {
      this.lastMute = mute;
      this.el.nativeElement.style.setProperty('--nav-mute', mute.toFixed(3));
    }
    this.rafId = requestAnimationFrame(this.tick);
  };

  ngOnDestroy(): void {
    cancelAnimationFrame(this.rafId);
  }

  scrollToSection(id: string, event: Event): void {
    const el = document.getElementById(id);
    if (!el) {
      return;
    }
    event.preventDefault();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }
}
