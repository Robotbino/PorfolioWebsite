import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ThemeService } from '../../core/theme.service';

/** Drop-in theme toggle button; reads and writes ThemeService directly. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-theme-toggle',
  templateUrl: './theme-toggle.component.html',
  styleUrl: './theme-toggle.component.css',
})
export class ThemeToggleComponent {
  theme = inject(ThemeService);
}
