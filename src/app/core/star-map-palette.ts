/**
 * The theme → star map colour mapping, pure and DOM-free, the WebGL
 * counterpart of aurora-palette.ts. ThemeService exposes it as a memoized
 * computed, so the renderer is handed new values only on a theme flip.
 *
 * The figure's rest colours are the SVG constellation's (the `--c-*` custom
 * properties in constellation/constellation.component.css), so the WebGL map
 * and its SVG fallback read as the same chart. Change them together. The halo
 * alphas are not copied: the SVG blurs a flat disc, while this halo is a
 * gaussian whose peak has to be higher to carry the same glow (about the
 * SVG's in dark mode, a little lighter than it on paper).
 */

/** sRGB channels 0–255, written as the stylesheet values they mirror. */
export type Rgb = readonly [number, number, number];

export interface StarMapPalette {
  /** Star core, drawn opaque. */
  core: Rgb;
  /** Link stroke and its alpha. */
  line: Rgb;
  lineAlpha: number;
  /** Halo colour and its peak alpha, at the star's centre. */
  halo: Rgb;
  haloAlpha: number;
  /** Background field: its ink, alpha for its faintest and brightest stars, and the share drawn. */
  field: Rgb;
  fieldAlpha: readonly [number, number];
  fieldCountFactor: number;
  /** How far each halo leans toward its star's blackbody colour (0 = the palette halo only). */
  tint: number;
}

export function starMapPalette(isDark: boolean): StarMapPalette {
  return isDark
    ? {
        core: [238, 241, 246],
        line: [220, 228, 240],
        lineAlpha: 0.16,
        halo: [150, 190, 255],
        haloAlpha: 0.3,
        field: [223, 230, 242],
        fieldAlpha: [0.12, 0.85],
        fieldCountFactor: 1,
        tint: 0.35,
      }
    : // A printed star chart behind the scrims: fewer, fainter field stars in
      // ink, so the field never reads as dust behind body copy, and no
      // spectral tint, which on paper reads as a smudge rather than a star.
      {
        core: [38, 43, 54],
        line: [38, 43, 54],
        lineAlpha: 0.38,
        halo: [70, 80, 120],
        haloAlpha: 0.06,
        field: [58, 53, 48],
        fieldAlpha: [0.05, 0.24],
        fieldCountFactor: 0.45,
        tint: 0,
      };
}
