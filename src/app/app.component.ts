import { Component } from '@angular/core';
import { ThemeService } from './core/theme.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: false,
  styleUrl: './app.component.css',
})
export class AppComponent {
  // Public so the persistent background layer can bind to the theme signal.
  constructor(public theme: ThemeService) {}
}
