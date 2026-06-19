import { Component, HostListener } from '@angular/core';
import { ThemeService } from '../../core/theme.service';

/**
 * Persistent top navigation. Lives in the app shell (above the router outlet)
 * so it survives navigation between destinations. Drives the theme toggle and
 * the scrolled-state backdrop directly off ThemeService.
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
}
