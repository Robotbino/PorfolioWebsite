import { Constellation, Star } from './constellation.model';

/**
 * The interpolated figure at one point in a morph. Named for what it is rather
 * than `MorphFrame`, which is also the name of MorphDriver's per-frame output —
 * two exported interfaces with one name in the same folder.
 *
 * Deliberately carries no precomputed link segments: the component draws its
 * own lines in `drawLinks` from the star positions AFTER drift is applied, which
 * a segment array built here could not account for. Building one would be pure
 * allocation on the 60fps path.
 */
export interface MorphedFigure {
  stars: Star[];
}

const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

export function interpolateConstellation(
  from: Constellation,
  to: Constellation,
  t: number,
): MorphedFigure {
  if (from.stars.length !== to.stars.length) {
    throw new Error(
      `Constellation morph requires equal star counts: ` +
        `"${from.name}" has ${from.stars.length}, "${to.name}" has ${to.stars.length}.`,
    );
  }

  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;

  const stars: Star[] = from.stars.map((s, i) => {
    const d = to.stars[i];
    return {
      name: s.name,
      x: lerp(s.x, d.x, clamped),
      y: lerp(s.y, d.y, clamped),
      r: lerp(s.r, d.r, clamped),
      phx: lerp(s.phx, d.phx, clamped),
      phy: lerp(s.phy, d.phy, clamped),
      amp: lerp(s.amp, d.amp, clamped),
    };
  });

  return { stars };
}
