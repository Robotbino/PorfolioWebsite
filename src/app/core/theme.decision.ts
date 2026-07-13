/**
 * The one dark-or-light decision rule — pure and DOM-free so it can be unit
 * tested and single-sourced. A saved choice wins; otherwise fall back to the OS
 * preference.
 *
 * The inline FOUC guard in index.html is a hand-written mirror of this: it runs
 * pre-paint, before Angular loads, so it cannot import this module. Keep the two
 * in sync — this is the canonical version; the guard is its dumb adapter.
 */
export type Theme = 'dark' | 'light';

export function resolveTheme(saved: string | null, prefersDark: boolean): Theme {
  if (saved === 'dark' || saved === 'light') {
    return saved;
  }
  return prefersDark ? 'dark' : 'light';
}
