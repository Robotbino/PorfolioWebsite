import { Constellation, Link, Star } from './constellation.model';

/**
 * The fixed star/link data for the four route constellations and the per-index
 * drift traits they all share. Lives in its own file so the component file is
 * about *driving* the morph, not enumerating asterisms.
 *
 * Every figure has 8 stars so positions can morph 1:1, but each keeps its OWN
 * real asterism lines (counts/patterns differ), which cross-fade through the
 * dim point of each transition.
 */

export const STAR_COUNT = 8;
export const MAX_LINKS = 8;

// Per-index drift/size traits, shared across figures so a star keeps its
// character (and its drift stays continuous) all the way through a morph.
export const R = [3.3, 2.6, 2.2, 2.5, 2.7, 2.7, 2.6, 2.6];
export const AMP = [6, 5, 5, 6, 6, 6, 7, 7];
export const PHX = [0.0, 0.8, 1.6, 2.4, 3.2, 4.0, 4.8, 5.6];
export const PHY = [1.0, 2.2, 0.4, 1.7, 2.6, 0.9, 1.5, 3.0];

/** Build a constellation from index-ordered coordinates + its own real links. */
export function figure(
  name: string,
  coords: ReadonlyArray<readonly [number, number]>,
  links: Link[],
): Constellation {
  const stars: Star[] = coords.map(([x, y], i) => ({
    name: `${name} ${i + 1}`,
    x,
    y,
    r: R[i],
    phx: PHX[i],
    phy: PHY[i],
    amp: AMP[i],
  }));
  return { name, side: 'left', viewBox: '0 0 300 300', stars, links };
}

// Four real constellations (8 stars each), in a 300×300 viewBox. Stars are
// listed in index order; links are each figure's real connect-the-dots shape.
export const byRoute = {
  // Ursa Major / the Big Dipper — the navigator's constellation (Home).
  home: figure(
    'Ursa Major',
    [
      [60, 90], // Dubhe
      [72, 162], // Merak
      [142, 168], // Phecda
      [135, 100], // Megrez
      [196, 122], // Alioth
      [245, 150], // Mizar
      [288, 184], // Alkaid
      [255, 137], // Alcor
    ],
    [
      { a: 0, b: 1 },
      { a: 1, b: 2 },
      { a: 2, b: 3 },
      { a: 3, b: 0 },
      { a: 3, b: 4 },
      { a: 4, b: 5 },
      { a: 5, b: 6 },
    ],
  ),
  // Orion — the hunter (Work).
  work: figure(
    'Orion',
    [
      [96, 96], // Betelgeuse
      [176, 84], // Bellatrix
      [138, 48], // Meissa (head)
      [120, 166], // Alnitak (belt)
      [140, 176], // Alnilam (belt)
      [160, 186], // Mintaka (belt)
      [110, 250], // Saiph
      [186, 244], // Rigel
    ],
    [
      { a: 2, b: 0 },
      { a: 2, b: 1 },
      { a: 0, b: 3 },
      { a: 1, b: 5 },
      { a: 3, b: 4 },
      { a: 4, b: 5 },
      { a: 3, b: 6 },
      { a: 5, b: 7 },
    ],
  ),
  // Leo — the lion (About).
  about: figure(
    'Leo',
    [
      [215, 185], // Regulus
      [212, 158], // Eta
      [221, 128], // Algieba
      [205, 104], // Zeta
      [180, 90], // Mu
      [152, 102], // Epsilon
      [120, 150], // Zosma
      [58, 176], // Denebola
    ],
    [
      { a: 0, b: 1 },
      { a: 1, b: 2 },
      { a: 2, b: 3 },
      { a: 3, b: 4 },
      { a: 4, b: 5 },
      { a: 0, b: 6 },
      { a: 6, b: 7 },
      { a: 7, b: 0 },
    ],
  ),
  // Cygnus / the Northern Cross — the swan in flight (Contact).
  contact: figure(
    'Cygnus',
    [
      [150, 55], // Deneb
      [150, 135], // Sadr
      [150, 255], // Albireo (beak)
      [150, 196], // Eta
      [90, 150], // Gienah
      [45, 160], // left wing tip
      [215, 124], // Delta
      [258, 114], // right wing tip
    ],
    [
      { a: 0, b: 1 },
      { a: 1, b: 3 },
      { a: 3, b: 2 },
      { a: 5, b: 4 },
      { a: 4, b: 1 },
      { a: 1, b: 6 },
      { a: 6, b: 7 },
    ],
  ),
};

// Destinations in scroll order; the morph runs between adjacent entries and
// wraps from the last back to the first (the star map loops endlessly).
export const order: Constellation[] = [byRoute.home, byRoute.work, byRoute.about, byRoute.contact];
