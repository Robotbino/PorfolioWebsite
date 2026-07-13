import { resolveTheme } from './theme.decision';

describe('resolveTheme', () => {
  it('honours a saved dark choice over the OS preference', () => {
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('dark', true)).toBe('dark');
  });

  it('honours a saved light choice over the OS preference', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('light', false)).toBe('light');
  });

  it('falls back to the OS preference when nothing is saved', () => {
    expect(resolveTheme(null, true)).toBe('dark');
    expect(resolveTheme(null, false)).toBe('light');
  });

  it('treats an unrecognised saved value as no preference', () => {
    expect(resolveTheme('', true)).toBe('dark');
    expect(resolveTheme('midnight', false)).toBe('light');
  });
});
