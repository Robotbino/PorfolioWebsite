import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { ThemeService } from '../../core/theme.service';
import { ScrollLoopService } from '../../scroll-loop.service';
import { FramePulseService } from '../../core/frame-pulse.service';
import { DESTINATIONS } from '../../destinations';

/**
 * Persistent top navigation. Lives in the app shell so it survives scrolling.
 * Drives the theme toggle and scrolls the page to a destination section (the
 * conventional, always-operable wayfinding baseline alongside the star-map).
 *
 * Two things ride the shared rAF tick, both writing straight to the DOM so the
 * hot path never schedules change detection:
 * - Travel fade: while moving away from Home the nav mutes via a single
 *   `--nav-mute` (0..1) custom property the CSS interpolates off. Loop-aware
 *   (distance-from-Home, not raw scrollY) so the nav is back to full before the
 *   loop seam and never pops there. See docs/adr/0005-loop-aware-nav-muting.md.
 * - Active destination: whichever section sits under the viewport midpoint gets
 *   its link underlined (`.active`) and marked `aria-current`. Inside the Home
 *   clone past the seam it reads as Home, matching the wrap.
 */
@Component({
  selector: 'app-site-nav',
  standalone: false,
  templateUrl: './site-nav.component.html',
  styleUrl: './site-nav.component.css',
})
export class SiteNavComponent implements AfterViewInit, OnDestroy {
  // Travel fraction (in destination units) over which the nav fully fades.
  private static readonly FADE_RANGE = 0.5;

  // The real destinations, from the one registry. Both nav lists render these;
  // the `#projects` sub-anchor and the desktop logo-as-Home stay hand-written
  // exceptions in the template (they aren't destinations). See destinations.ts.
  readonly destinations = DESTINATIONS;

  menuOpen = false;

  @ViewChild('menuTrigger') private menuTrigger?: ElementRef<HTMLButtonElement>;

  private unsub: (() => void) | null = null;
  private lastMute = -1;
  private reduce = false;

  // Sections the nav links point at (id → absolute top), plus every link per id
  // so desktop, mobile and the logo all reflect the same active destination.
  private targetEls: { id: string; el: HTMLElement }[] = [];
  private targets: { id: string; top: number }[] = [];
  private linksByTarget = new Map<string, HTMLAnchorElement[]>();
  private cloneEl: HTMLElement | null = null;
  private cloneTop = Infinity;
  private activeId = '';
  private ro?: ResizeObserver;

  constructor(
    public theme: ThemeService,
    private loop: ScrollLoopService,
    private el: ElementRef<HTMLElement>,
    private pulse: FramePulseService,
  ) {}

  ngAfterViewInit(): void {
    this.reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.collectLinks();
    this.measureTargets();
    // Section heights shift as lazy images load, so re-measure on any reflow
    // (same trigger the app shell uses for the loop anchors).
    this.ro = new ResizeObserver(() => this.measureTargets());
    this.ro.observe(document.body);

    this.unsub = this.pulse.onTick(() => {
      this.updateActiveLink();
      if (!this.reduce) {
        this.updateMute();
      }
    });
  }

  ngOnDestroy(): void {
    this.unsub?.();
    this.ro?.disconnect();
    this.setScrollLock(false);
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
    this.setScrollLock(this.menuOpen);
    if (this.menuOpen) {
      // Next frame, once the overlay's `visibility` has flipped, move focus in.
      requestAnimationFrame(() => {
        this.el.nativeElement.querySelector<HTMLElement>('.mobile-link')?.focus();
      });
    }
  }

  closeMenu(): void {
    if (!this.menuOpen) {
      return;
    }
    this.menuOpen = false;
    this.setScrollLock(false);
    this.menuTrigger?.nativeElement.focus();
  }

  /**
   * Scroll lock while the mobile menu is open. Two constraints shape it:
   * - `html` carries `overflow-x: clip` (see styles.css), which stops body →
   *   viewport overflow propagation — so `body { overflow: hidden }` never
   *   reaches the viewport. The lock must sit on the root element.
   * - The `position: fixed` body technique would zero `scrollY`, which the
   *   scroll loop and the constellation morph driver read continuously; root
   *   `overflow-y: hidden` keeps the offset and fires no scroll event.
   * iOS ignores root overflow for touch panning, hence the non-passive
   * touchmove block — safe because the overlay has no scrollable content.
   */
  private setScrollLock(lock: boolean): void {
    document.documentElement.style.overflowY = lock ? 'hidden' : '';
    if (lock) {
      document.addEventListener('touchmove', this.blockTouchScroll, { passive: false });
    } else {
      document.removeEventListener('touchmove', this.blockTouchScroll);
    }
  }

  private blockTouchScroll = (e: TouchEvent): void => {
    e.preventDefault();
  };

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.menuOpen) {
      this.closeMenu();
    }
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

  /** Group every in-page link (logo, desktop, mobile) by the section it targets. */
  private collectLinks(): void {
    const links = Array.from(
      this.el.nativeElement.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'),
    );
    for (const link of links) {
      const id = link.getAttribute('href')!.slice(1);
      const group = this.linksByTarget.get(id);
      if (group) {
        group.push(link);
      } else {
        this.linksByTarget.set(id, [link]);
      }
    }
    this.targetEls = [...this.linksByTarget.keys()]
      .map((id) => ({ id, el: document.getElementById(id) as HTMLElement }))
      .filter((t) => t.el !== null);
    this.cloneEl = document.querySelector<HTMLElement>('.dest-clone');
  }

  /** Rect-based (not offsetTop) so nested anchors like #projects measure true. */
  private measureTargets(): void {
    const scrollY = window.scrollY;
    this.targets = this.targetEls
      .map(({ id, el }) => ({ id, top: el.getBoundingClientRect().top + scrollY }))
      .sort((a, b) => a.top - b.top);
    this.cloneTop = this.cloneEl
      ? this.cloneEl.getBoundingClientRect().top + scrollY
      : Infinity;
  }

  private updateActiveLink(): void {
    if (this.targets.length === 0) {
      return;
    }
    const probe = window.scrollY + window.innerHeight * 0.5;
    let active = this.targets[0].id;
    if (probe >= this.cloneTop) {
      // Past the seam buffer's top we are visually on Home again.
      active = 'dest-home';
    } else {
      for (const t of this.targets) {
        if (t.top > probe) {
          break;
        }
        active = t.id;
      }
    }
    if (active !== this.activeId) {
      this.linksByTarget.get(this.activeId)?.forEach((a) => {
        a.classList.remove('active');
        a.removeAttribute('aria-current');
      });
      this.linksByTarget.get(active)?.forEach((a) => {
        a.classList.add('active');
        a.setAttribute('aria-current', 'true');
      });
      this.activeId = active;
    }
  }

  private updateMute(): void {
    const count = this.loop.cycleLength;
    if (count > 0) {
      const pos = this.loop.position();
      const distance = Math.min(pos, count - pos);
      const mute = Math.min(1, distance / SiteNavComponent.FADE_RANGE);
      if (Math.abs(mute - this.lastMute) > 0.001) {
        this.lastMute = mute;
        this.el.nativeElement.style.setProperty('--nav-mute', mute.toFixed(3));
      }
    }
  }
}
