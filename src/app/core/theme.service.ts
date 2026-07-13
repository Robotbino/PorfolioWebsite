import { Injectable, signal } from '@angular/core';
import { resolveTheme } from './theme.decision';

const STORAGE_KEY = 'theme';

/**
 * Owns the site's dark/light theme: the source of truth that was previously
 * trapped inside LandingpageComponent. Lives at the app shell so the persistent
 * background (aurora/constellation) and the nav can all react to one signal.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  private hasManualOverride = false;

  /** True when dark mode is active. Read in templates as `theme.isDark()`. */
  readonly isDark = signal<boolean>(false);

  constructor() {
    const saved = localStorage.getItem(STORAGE_KEY);
    this.hasManualOverride = saved === 'dark' || saved === 'light';
    this.isDark.set(resolveTheme(saved, this.mediaQuery.matches) === 'dark');
    this.applyTheme();

    // Follow the OS preference only while the user hasn't made a manual choice.
    this.mediaQuery.addEventListener('change', (e) => {
      if (!this.hasManualOverride) {
        this.isDark.set(e.matches);
        this.applyTheme();
      }
    });
  }

  toggle(): void {
    this.isDark.set(!this.isDark());
    this.hasManualOverride = true;
    localStorage.setItem(STORAGE_KEY, this.isDark() ? 'dark' : 'light');
    this.applyTheme();
  }

  /** Pick the asset path that matches the current theme. */
  themeAsset(darkPath: string, lightPath: string): string {
    return this.isDark() ? darkPath : lightPath;
  }

  private applyTheme(): void {
    const root = document.documentElement;
    root.classList.toggle('dark-mode', this.isDark());
    root.classList.toggle('light-mode', !this.isDark());
  }
}
