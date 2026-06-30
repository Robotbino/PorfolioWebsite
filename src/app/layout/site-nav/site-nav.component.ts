import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
} from '@angular/core';
import { ThemeService } from '../../core/theme.service';
import { ScrollLoopService } from '../../scroll-loop.service';
import { FramePulseService } from '../../core/frame-pulse.service';

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
  // Travel fraction (in destination units) over which the nav fully fades.
  private static readonly FADE_RANGE = 0.5;

  menuOpen = false;
  private unsub: (() => void) | null = null;
  private lastMute = -1;

  constructor(
    public theme: ThemeService,
    private loop: ScrollLoopService,
    private el: ElementRef<HTMLElement>,
    private pulse: FramePulseService,
  ) {}

  ngAfterViewInit(): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    this.unsub = this.pulse.onTick(() => {
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
    });
  }

  ngOnDestroy(): void {
    this.unsub?.();
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
    document.body.style.overflow = this.menuOpen ? 'hidden' : '';
  }

  closeMenu(): void {
    this.menuOpen = false;
    document.body.style.overflow = '';
  }

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
}
