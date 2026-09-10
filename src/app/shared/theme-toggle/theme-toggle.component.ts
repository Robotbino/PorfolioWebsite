import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ThemeService } from '../../core/theme.service';

/**
 * Drop-in theme toggle button; reads/writes ThemeService.
 *
 * No inputs or outputs — the component is fully self-contained. It binds to the
 * existing `ThemeService.isDark` signal for label/icon state and calls
 * `ThemeService.toggle()` on click, so any consumer renders the same button
 * shape and behaviour by dropping the selector in.
 *
 * Usage: `<app-theme-toggle></app-theme-toggle>`
 */
@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-theme-toggle',
    templateUrl: './theme-toggle.component.html',
    styleUrl: './theme-toggle.component.css',
})
export class ThemeToggleComponent {
  theme = inject(ThemeService);

}
