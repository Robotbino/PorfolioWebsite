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
  /** 0 = ramp scaled by intensity (dark); 1 = ramp tints at full value (light). */
  lift: number;
}

export function auroraPalette(isDark: boolean): AuroraPalette {
  return isDark
    ? { colorStops: ['#1E1C1A', '#3D312A', '#5A3D2B'], blend: 0.5, amplitude: 1.0, speed: 0.5, lift: 0 }
    // Warm dawn ramp — cream → peach → amber. With lift:1 the stops paint as
    // their true colour, so they must carry real weight against the white page
    // or the aurora reads as invisible (a near-white ramp did). Deepens left→
    // right so the strongest amber falls in the negative space the hero leaves
    // clear, while the lighter left stop keeps the reading column's text at AA.
    // Amplitude lifted from a near-flat 0.25 so the bands actually move and
    // glow. See the offscreen-render contrast check in the polish pass.
    : { colorStops: ['#FBEAD9', '#F3D3AE', '#E8BC8C'], blend: 1.0, amplitude: 0.6, speed: 0.5, lift: 1 };
}
