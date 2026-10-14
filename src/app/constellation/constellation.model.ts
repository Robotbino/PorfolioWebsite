/**
 * The star/link data format for the star-map constellations. Shared by the
 * rendering component and the pure morph utility so both speak one vocabulary.
 */

/** Harvard spectral class, hottest (O) to coolest (M). */
export type SpectralClass = 'O' | 'B' | 'A' | 'F' | 'G' | 'K' | 'M';

export interface Star {
  name: string;
  x: number;
  y: number;
  r: number;
  phx: number; // phase offset for x drift
  phy: number; // phase offset for y drift
  amp: number; // drift radius (local SVG user units)
  /**
   * Distance from the figure's plane in the same user units, positive toward
   * the viewer, from the star's real distance (see constellation-depth.ts).
   * Only the WebGL star map uses it; the flat SVG ignores it.
   */
  depth: number;
  /** Surface temperature in kelvin, from the spectral class; tints the WebGL halo. */
  temperature: number;
}

export interface Link {
  a: number;
  b: number;
}

export interface Constellation {
  name: string;
  stars: Star[];
  links: Link[];
}
