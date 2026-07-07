import { Constellation, Star } from './constellation.model';

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}


export interface MorphFrame {
  stars: Star[];
  segments: Segment[];
}

const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;


export function interpolateConstellation(
  from: Constellation,
  to: Constellation,
  t: number,
): MorphFrame {
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

  const segments: Segment[] = from.links.map((l) => ({
    x1: stars[l.a].x,
    y1: stars[l.a].y,
    x2: stars[l.b].x,
    y2: stars[l.b].y,
  }));

  return { stars, segments };
}
