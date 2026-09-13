import { Injectable, computed, signal } from '@angular/core';
import { resolveTheme } from './theme.decision';
import { auroraPalette as auroraPaletteFor } from './aurora-palette';

const STORAGE_KEY = 'theme';

/**
 * Browser-chrome tint per palette, matching `--color-background` in styles.css.
 * The pre-paint guard in index.html hard-codes the same two values (it runs
 * before any module loads) — change them together.
 */
const THEME_COLOR = { dark: '#121212', light: '#ffffff' } as const;

/**
 * Owns the site's dark/light theme: the source of truth that was previously
 * trapped inside LandingpageComponent. Lives at the app shell so the persistent
 * background (aurora/constellation) and the nav can all react to one signal.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  private hasManualOverride = false;

  readonly isDark = signal<boolean>(false);

  /**
   * Aurora backdrop tuning for the current theme. Memoized so the aurora's
   * @Inputs change only on a theme flip, not every change-detection cycle —
   * this is what lets the raw hex + GLSL tuning leave the shell template.
   */
  readonly auroraPalette = computed(() => auroraPaletteFor(this.isDark()));

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

  themeAsset(darkPath: string, lightPath: string): string {
    return this.isDark() ? darkPath : lightPath;
  }

  private applyTheme(): void {
    const root = document.documentElement;
    root.classList.toggle('dark-mode', this.isDark());
    root.classList.toggle('light-mode', !this.isDark());

    // Mobile browser chrome follows the palette. One tag written here, not a
    // media-scoped pair: those track only the OS, so a visitor who toggles away
    // from their OS preference gets chrome that fights the page.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', this.isDark() ? THEME_COLOR.dark : THEME_COLOR.light);
  }
}
