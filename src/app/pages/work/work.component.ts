import { Component } from '@angular/core';
import { ThemeService } from '../../core/theme.service';

@Component({
  selector: 'app-work',
  standalone: false,
  templateUrl: './work.component.html',
  styleUrl: './work.component.css',
})
export class WorkComponent {
  constructor(private theme: ThemeService) {}

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
