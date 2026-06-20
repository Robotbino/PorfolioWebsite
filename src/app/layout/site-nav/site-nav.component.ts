import { Component, HostListener } from '@angular/core';
import { ThemeService } from '../../core/theme.service';

/**
 * Persistent top navigation. Lives in the app shell so it survives scrolling.
 * Drives the theme toggle and the scrolled-state backdrop off ThemeService, and
 * scrolls the page to a destination section (the conventional, always-operable
 * wayfinding baseline alongside the star-map).
 */
@Component({
  selector: 'app-site-nav',
  standalone: false,
  templateUrl: './site-nav.component.html',
  styleUrl: './site-nav.component.css',
})
export class SiteNavComponent {
  public isScrolled = false;

  constructor(public theme: ThemeService) {}

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.isScrolled = window.scrollY > 24;
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
