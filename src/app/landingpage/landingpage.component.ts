import { Component, HostListener } from '@angular/core';
import { ThemeService } from '../core/theme.service';

@Component({
  selector: 'app-landingpage',
  standalone: false,
  templateUrl: './landingpage.component.html',
  styleUrl: './landingpage.component.css',
})
export class LandingpageComponent {
  private link = document.createElement('a');
  public isScrolled = false;

  constructor(private theme: ThemeService) {}

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.isScrolled = window.scrollY > 24;
  }

  public toggleTheme(): void {
    this.theme.toggle();
  }

  public get isDarkModeActive(): boolean {
    return this.theme.isDark();
  }

  public downloadCV(): void {
    this.link.href = 'assets/Bino_FullStack_CV_April2026.pdf';
    this.link.download = 'Bino_FullStack_CV_April2026.pdf';
    this.link.click();
  }

  public get portfolioImageSrc(): string {
    return this.theme.isDark()
      ? '/assets/portfolio_dark_mode.png'
      : '/assets/portfolio_light_mode.png';
  }

  public get portfolioImageAlt(): string {
    return this.theme.isDark()
      ? 'Portfolio website in dark mode'
      : 'Portfolio website in light mode';
  }
}
