/**
 * The theme → aurora tuning mapping, pure and DOM-free. The aurora backdrop's
 * palette and feel ARE a theme decision (dark vs light), so they live behind the
 * theme seam here instead of being authored as raw hex + GLSL tuning in the
 * shell template. ThemeService exposes this as a memoized computed; the aurora
 * keeps its plain @Input seam and never learns where the values come from.
 */
export interface AuroraPalette {
  colorStops: [string, string, string];
  blend: number;
  amplitude: number;
  speed: number;
}

export function auroraPalette(isDark: boolean): AuroraPalette {
  return isDark
    ? { colorStops: ['#1E1C1A', '#3D312A', '#5A3D2B'], blend: 0.5, amplitude: 1.0, speed: 0.5 }
    : { colorStops: ['#FDFCFB', '#F5F2EE', '#FAF0E8'], blend: 1.0, amplitude: 0.25, speed: 0.5 };
}
