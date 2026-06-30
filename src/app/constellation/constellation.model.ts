/**
 * The star/link data format for the star-map constellations. Shared by the
 * rendering component and the pure morph utility so both speak one vocabulary.
 */

export interface Star {
  name: string;
  x: number;
  y: number;
  r: number;
  phx: number; // phase offset for x drift
  phy: number; // phase offset for y drift
  amp: number; // drift radius (local viewBox units)
}

export interface Link {
  a: number;
  b: number;
}

export interface Constellation {
  name: string;
  side: 'left' | 'right';
  viewBox: string;
  stars: Star[];
  links: Link[];
}
