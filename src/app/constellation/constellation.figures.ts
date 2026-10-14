import { DESTINATIONS } from '../destinations';
import { Constellation, Link, SpectralClass, Star } from './constellation.model';
import { SPECTRAL_TEMPERATURE, depthUnits } from './constellation-depth';

/**
 * The fixed star/link data for the five route constellations and the per-index
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

/** A star's distance in light-years and its spectral class. */
export type StarFact = readonly [ly: number, cls: SpectralClass];

/**
 * Build a constellation from index-ordered coordinates + its own real links,
 * and each star's real distance and class (same index order) for its depth
 * and tint in the WebGL star map.
 */
export function figure(
  name: string,
  coords: readonly (readonly [number, number])[],
  links: Link[],
  facts: readonly StarFact[],
): Constellation {
  if (facts.length !== coords.length) {
    throw new Error(
      `Constellation "${name}" has ${coords.length} stars but ${facts.length} star facts.`,
    );
  }
  const depths = depthUnits(facts.map(([ly]) => ly));
  const stars: Star[] = coords.map(([x, y], i) => ({
    name: `${name} ${i + 1}`,
    x,
    y,
    r: R[i],
    phx: PHX[i],
    phy: PHY[i],
    amp: AMP[i],
    depth: depths[i],
    temperature: SPECTRAL_TEMPERATURE[facts[i][1]],
  }));
  return { name, stars, links };
}

// Five real constellations (8 stars each), in a 300×300 viewBox. Stars are
// listed in index order; links are each figure's real connect-the-dots shape;
// facts are distance (ly) and spectral class. The supergiant distances (Deneb,
// Sadr, Alnilam, Eta Leonis) are uncertain by hundreds of light-years; on the
// log depth scale that is a modest shift, and Deneb and Sadr sit at the clamp
// either way.
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
    [
      [123, 'K'], // Dubhe
      [80, 'A'], // Merak
      [84, 'A'], // Phecda
      [81, 'A'], // Megrez
      [83, 'A'], // Alioth
      [78, 'A'], // Mizar
      [104, 'B'], // Alkaid
      [82, 'A'], // Alcor
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
    [
      [550, 'M'], // Betelgeuse
      [250, 'B'], // Bellatrix
      [1100, 'O'], // Meissa
      [1260, 'O'], // Alnitak
      [2000, 'B'], // Alnilam
      [1200, 'O'], // Mintaka
      [650, 'B'], // Saiph
      [860, 'B'], // Rigel
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
    [
      [79, 'B'], // Regulus
      [1270, 'A'], // Eta
      [130, 'K'], // Algieba
      [274, 'F'], // Zeta
      [133, 'K'], // Mu
      [247, 'G'], // Epsilon
      [58, 'A'], // Zosma
      [36, 'A'], // Denebola
    ],
  ),
  // Corona Borealis / the Northern Crown — the laurel of achievement
  // (Certifications). The seven-star arc opens upward; faint π floats free
  // above the western tip, unlinked like Alcor in Ursa Major.
  certifications: figure(
    'Corona Borealis',
    [
      [98, 190], // Alphecca (Gemma)
      [60, 146], // Nusakan
      [58, 92], // Theta
      [84, 52], // Pi (faint, unlinked)
      [150, 205], // Gamma
      [200, 192], // Delta
      [234, 152], // Epsilon
      [242, 98], // Iota
    ],
    [
      { a: 2, b: 1 },
      { a: 1, b: 0 },
      { a: 0, b: 4 },
      { a: 4, b: 5 },
      { a: 5, b: 6 },
      { a: 6, b: 7 },
    ],
    [
      [75, 'A'], // Alphecca
      [114, 'F'], // Nusakan
      [380, 'B'], // Theta
      [230, 'G'], // Pi
      [145, 'A'], // Gamma
      [165, 'G'], // Delta
      [230, 'K'], // Epsilon
      [310, 'A'], // Iota
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
      [45, 160], // Zeta (left wing tip)
      [215, 124], // Delta
      [258, 114], // Kappa (right wing tip)
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
    [
      [2600, 'A'], // Deneb
      [1800, 'F'], // Sadr
      [430, 'K'], // Albireo
      [140, 'K'], // Eta
      [72, 'K'], // Gienah
      [143, 'G'], // Zeta
      [165, 'B'], // Delta
      [125, 'K'], // Kappa
    ],
  ),
};

// Destinations in scroll order; the morph runs between adjacent entries and
// wraps from the last back to the first (the star map loops endlessly). Derived
// from the destinations registry so this order can never drift from the shell
// sections and nav links — the registry is the one source (see destinations.ts).
export const order: Constellation[] = DESTINATIONS.map((d) => byRoute[d.figure]);
