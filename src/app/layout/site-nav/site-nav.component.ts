import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { ThemeService } from '../../core/theme.service';
import { ScrollLoopService } from '../../scroll-loop.service';
import { FramePulseService } from '../../core/frame-pulse.service';
import { MotionSettingsService } from '../../core/motion-settings.service';
import { NavTransitionService } from '../../core/nav-transition.service';
import { InViewportService } from '../../core/in-viewport.service';
import { ScrollLockService } from '../../core/scroll-lock.service';
import { PageInertService } from '../../core/page-inert.service';
import { DESTINATIONS } from '../../destinations';
import { ThemeToggleComponent } from '../../shared/theme-toggle/theme-toggle.component';

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
 *   Runs only where it can be undone — fine pointer, motion allowed; see
 *   `muteAllowed`.
 * - Active destination: the link for `ScrollLoopService.activeDestination()` is
 *   underlined (`.active`) and marked `aria-current`. The nav is a pure reader
 *   of that one signal — it keeps no section geometry of its own; the loop
 *   already handles the seam (inside the Home clone it reads as Home). The one
 *   exception is the `#projects` sub-anchor inside Work: a single
 *   IntersectionObserver flags when it passes the viewport middle, and it then
 *   takes the highlight from Work (it is not a destination the loop knows about).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-site-nav',
  templateUrl: './site-nav.component.html',
  styleUrl: './site-nav.component.css',
  imports: [ThemeToggleComponent],
})
export class SiteNavComponent implements AfterViewInit, OnDestroy {
  theme = inject(ThemeService);
  private loop = inject(ScrollLoopService);
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private pulse = inject(FramePulseService);
  private scrollLock = inject(ScrollLockService);
  private pageInert = inject(PageInertService);
  private motion = inject(MotionSettingsService);
  private navTransition = inject(NavTransitionService);
  private inView = inject(InViewportService);

  // Travel fraction (in destination units) over which the nav fully fades.
  private static readonly FADE_RANGE = 0.5;

  // The real destinations, from the one registry. Both nav lists render these;
  // the `#projects` sub-anchor and the desktop logo-as-Home stay hand-written
  // exceptions in the template (they aren't destinations). See destinations.ts.
  readonly destinations = DESTINATIONS;

  // A signal because it flips from a document-level Escape handler as well as
  // from this template's own clicks; the template read keeps the view honest
  // under OnPush either way.
  readonly menuOpen = signal(false);

  @ViewChild('menuTrigger') private menuTrigger?: ElementRef<HTMLButtonElement>;
  @ViewChild('mobileOverlay') private mobileOverlay?: ElementRef<HTMLElement>;

  private unsub: (() => void) | null = null;
  private lastDistance = -1;
  // The travel-fade only runs where its escape hatch exists. ADR-0005 makes
  // operability a condition of the mute: "the nav un-mutes on :hover or
  // :focus-within, so a keyboard / screen-reader user instantly gets the full,
  // operable baseline", upholding CONTEXT.md's Wayfinding rule. On a hover-less
  // viewport wider than the hamburger breakpoint (a tablet in landscape) there is
  // neither hover nor focus to trigger it, and no hamburger either — so the links
  // sat at opacity 0.12 with no way back. Same shape as the reduced-motion gate
  // the ADR already specifies: when the declutter can't be undone, don't apply it.
  // Read live rather than snapshotted at init, so docking a mouse or flipping
  // the OS reduced-motion switch takes effect without a reload. A signal read
  // inside the out-of-zone rAF has no reactive consumer, so it costs a property
  // access and schedules no change detection.
  private get muteAllowed(): boolean {
    return !this.motion.reducedMotion() && this.motion.finePointer();
  }

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
  private menuInertRelease: (() => void) | null = null;

  ngAfterViewInit(): void {
    this.collectLinks();
    this.observeProjects();

    this.unsub = this.pulse.onTick(() => {
      this.updateActiveLink();
      // Legibility, not motion: the scrim behind the bar runs on every device,
      // including touch and reduced-motion, where the travel FADE is suppressed.
      this.updateNavDistance();
    });
  }

  ngOnDestroy(): void {
    this.unsub?.();
    this.projectsRelease?.();
    this.releaseMenuLock();
  }

  toggleMenu(): void {
    this.menuOpen.set(!this.menuOpen());
    if (this.menuOpen()) {
      this.menuLockRelease = this.scrollLock.acquire();
      if (this.mobileOverlay) {
        // The trigger is protected alongside the overlay: it lives in the
        // header and morphs into this menu's close button, so inerting the bar
        // wholesale would strand the visible way out.
        this.menuInertRelease = this.pageInert.isolate(
          this.mobileOverlay.nativeElement,
          ...(this.menuTrigger ? [this.menuTrigger.nativeElement] : []),
        );
      }
      // Next frame, once the overlay's `visibility` has flipped, move focus in.
      requestAnimationFrame(() => {
        this.el.nativeElement.querySelector<HTMLElement>('.mobile-link')?.focus();
      });
    } else {
      this.releaseMenuLock();
    }
  }

  /**
   * Close only when the scrim ITSELF was clicked, not the menu panel inside it.
   *
   * Comparing target to currentTarget rather than stopping propagation on the
   * inner <nav>: a listener there would do nothing but block, and it is enough
   * for a11y tooling to treat a plain <nav> as an interactive element with no
   * keyboard path.
   */
  onScrimClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeMenu();
    }
  }

  closeMenu(): void {
    if (!this.menuOpen()) {
      return;
    }
    this.menuOpen.set(false);
    this.releaseMenuLock();
    this.menuTrigger?.nativeElement.focus();
  }

  private releaseMenuLock(): void {
    this.menuLockRelease?.();
    this.menuLockRelease = null;
    this.menuInertRelease?.();
    this.menuInertRelease = null;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.menuOpen()) {
      this.closeMenu();
    }
  }

  scrollToSection(id: string, event: Event): void {
    // While the mobile overlay is open the transition is suppressed: the jump
    // lands instantly behind the scrim, and closeMenu()'s overlay fade is the
    // reveal — two stacked animations would fight each other.
    if (this.navTransition.navigateTo(id, { suppressTransition: this.menuOpen() })) {
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
   * writes are rare. The loop owns "where am I"; the nav keeps no geometry.
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

  /**
   * Writes both loop-aware custom properties from one distance-from-Home.
   *
   * `--nav-travel` drives the legibility scrim behind the bar and is ALWAYS
   * written: it keeps body copy readable behind the persistent nav on every
   * device. `--nav-mute` drives the travel FADE and is written only where that
   * fade is allowed (fine pointer, no reduced-motion preference). Both are the
   * same number — this was two methods computing identical arithmetic into two
   * caches, sixty times a second.
   *
   * Symmetric around the seam, so neither pops at the wrap.
   */
  private updateNavDistance(): void {
    const count = this.loop.cycleLength;
    if (count <= 0) {
      return;
    }
    const pos = this.loop.position();
    const distance = Math.min(pos, count - pos);
    const value = Math.min(1, distance / SiteNavComponent.FADE_RANGE);

    // A frame that moved the value by less than a thousandth would write a
    // string the browser parses to the same number — skip the style write.
    if (Math.abs(value - this.lastDistance) <= 0.001) {
      return;
    }
    this.lastDistance = value;

    const style = this.el.nativeElement.style;
    const text = value.toFixed(3);
    style.setProperty('--nav-travel', text);
    if (this.muteAllowed) {
      style.setProperty('--nav-mute', text);
    } else {
      // The gate can close mid-session (mouse unplugged, reduced-motion turned
      // on). Clear the property rather than leaving the bar stuck at the last
      // mute it wrote, which would strand the links faded with no way back.
      style.removeProperty('--nav-mute');
    }
  }
}
