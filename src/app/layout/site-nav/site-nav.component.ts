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
import { MotionSettingsService } from '../../core/motion-settings.service';
import { NavTransitionService } from '../../core/nav-transition.service';
import { InViewportService } from '../../core/in-viewport.service';
import { ScrollLockService } from '../../core/scroll-lock.service';
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
 * - Active destination: the link for `ScrollLoopService.activeDestination()` is
 *   underlined (`.active`) and marked `aria-current`. The nav is a pure reader
 *   of that one signal — it keeps no section geometry of its own; the loop
 *   already handles the seam (inside the Home clone it reads as Home). The one
 *   exception is the `#projects` sub-anchor inside Work: a single
 *   IntersectionObserver flags when it passes the viewport middle, and it then
 *   takes the highlight from Work (it is not a destination the loop knows about).
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

  // Every in-page link grouped by the destination id it targets, so desktop,
  // mobile and the logo all light up together for the active destination.
  private linksByTarget = new Map<string, HTMLAnchorElement[]>();
  private activeId = '';

  // Projects is a sub-anchor inside Work (not a destination the loop tracks).
  // The InViewport seam flags when its section sits under the viewport middle;
  // the tick then gives it the highlight in place of Work.
  private projectsInView = false;
  private projectsRelease?: () => void;

  // Held while the mobile menu is open; releasing it lets the shared lock go.
  private menuLockRelease: (() => void) | null = null;

  constructor(
    public theme: ThemeService,
    private loop: ScrollLoopService,
    private el: ElementRef<HTMLElement>,
    private pulse: FramePulseService,
    private scrollLock: ScrollLockService,
    private motion: MotionSettingsService,
    private navTransition: NavTransitionService,
    private inView: InViewportService,
  ) {}

  ngAfterViewInit(): void {
    this.reduce = this.motion.reducedMotion();
    this.collectLinks();
    this.observeProjects();

    this.unsub = this.pulse.onTick(() => {
      this.updateActiveLink();
      if (!this.reduce) {
        this.updateMute();
      }
    });
  }

  ngOnDestroy(): void {
    this.unsub?.();
    this.projectsRelease?.();
    this.releaseMenuLock();
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
    if (this.menuOpen) {
      this.menuLockRelease = this.scrollLock.acquire();
      // Next frame, once the overlay's `visibility` has flipped, move focus in.
      requestAnimationFrame(() => {
        this.el.nativeElement.querySelector<HTMLElement>('.mobile-link')?.focus();
      });
    } else {
      this.releaseMenuLock();
    }
  }

  closeMenu(): void {
    if (!this.menuOpen) {
      return;
    }
    this.menuOpen = false;
    this.releaseMenuLock();
    this.menuTrigger?.nativeElement.focus();
  }

  /** Release this component's hold on the shared scroll lock, if it has one. */
  private releaseMenuLock(): void {
    this.menuLockRelease?.();
    this.menuLockRelease = null;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.menuOpen) {
      this.closeMenu();
    }
  }

  scrollToSection(id: string, event: Event): void {
    // While the mobile overlay is open the transition is suppressed: the jump
    // lands instantly behind the scrim, and closeMenu()'s overlay fade is the
    // reveal — two stacked animations would fight each other.
    if (this.navTransition.navigateTo(id, { suppressTransition: this.menuOpen })) {
      event.preventDefault();
    }
  }

  /** Group every in-page link (logo, desktop, mobile) by the destination id it targets. */
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
  }

  /**
   * Watch the one sub-anchor the loop can't see. Root shrunk to a line at the
   * viewport middle (`-50%` top and bottom) means `#projects` "intersects"
   * exactly while its section sits under the midpoint — the same line the old
   * probe used. The callback just flips a flag; the pulse tick applies it, so
   * the two never fight.
   */
  private observeProjects(): void {
    const projects = document.getElementById('projects');
    if (!projects) {
      return;
    }
    this.projectsRelease = this.inView.observe(
      projects,
      { rootMargin: '-50% 0px -50% 0px', threshold: 0 },
      (visible) => (this.projectsInView = visible),
    );
  }

  /**
   * Reflect the loop's single active-destination answer onto the links. Reading
   * the computed here (out of zone, like `position()`) schedules no change
   * detection, and it only changes value ~once per destination, so the class
   * writes are rare. Replaces the old midpoint probe + section-tops cache +
   * ResizeObserver + clone check — the loop owns "where am I" now.
   */
  private updateActiveLink(): void {
    let active = this.loop.activeDestination();
    // Projects lives inside Work: while its section is under the viewport middle
    // it takes the highlight from Work. The loop leaving Work ends this for free.
    if (this.projectsInView && active === 'dest-work') {
      active = 'projects';
    }
    if (active === this.activeId) {
      return;
    }
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
