import { Constellation, Star } from './constellation.model';
import { interpolateConstellation } from './constellation-morph';

function star(
  name: string,
  x: number,
  y: number,
  r = 2,
  amp = 5,
  depth = 0,
  temperature = 5600,
): Star {
  return { name, x, y, r, phx: 0, phy: 0, amp, depth, temperature };
}

function constellation(name: string, stars: Star[]): Constellation {
  return { name, stars, links: [{ a: 0, b: 1 }] };
}

describe('interpolateConstellation', () => {
  const from = constellation('A', [star('a0', 0, 0), star('a1', 10, 20)]);
  const to = constellation('B', [star('b0', 100, 50), star('b1', 30, 0)]);

  it('clamps progress outside [0, 1]', () => {
    expect(interpolateConstellation(from, to, -1).stars[0].x).toBe(0);
    expect(interpolateConstellation(from, to, 2).stars[0].x).toBe(100);
  });

  it('carries depth and temperature through the morph, clamped like position', () => {
    const near = constellation('near', [star('n0', 0, 0, 2, 5, 40, 3400), star('n1', 0, 0)]);
    const far = constellation('far', [star('f0', 0, 0, 2, 5, -120, 15000), star('f1', 0, 0)]);

    const mid = interpolateConstellation(near, far, 0.25).stars[0];
    expect(mid.depth).toBeCloseTo(0, 10);
    expect(mid.temperature).toBeCloseTo(6300, 10);

    expect(interpolateConstellation(near, far, -1).stars[0].depth).toBe(40);
    expect(interpolateConstellation(near, far, 2).stars[0].temperature).toBe(15000);
  });

  it('throws when the two constellations have different star counts', () => {
    const single = constellation('single', [star('s', 0, 0)]);
    expect(() => interpolateConstellation(from, single, 0.5)).toThrowError(/equal star counts/);
  });
});
