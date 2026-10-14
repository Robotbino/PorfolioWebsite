import { MAX_DEPTH, SPECTRAL_TEMPERATURE, depthUnits } from './constellation-depth';
import { byRoute, figure, order } from './constellation.figures';
import { Constellation } from './constellation.model';

describe('depthUnits', () => {
  it('puts nearer stars further forward', () => {
    const depths = depthUnits([100, 50, 400, 200]);
    // Sorted by distance, nearest first: 50, 100, 200, 400.
    expect(depths[1]).toBeGreaterThan(depths[0]);
    expect(depths[0]).toBeGreaterThan(depths[3]);
    expect(depths[3]).toBeGreaterThan(depths[2]);
  });

  it('centres each figure on its median star', () => {
    // Odd count: the median star sits exactly on the plane.
    expect(depthUnits([80, 120, 200])[1]).toBe(0);
    // Even count: the middle pair straddles the plane symmetrically.
    const even = depthUnits([60, 80, 120, 300]);
    expect(even[1] + even[2]).toBeCloseTo(0, 10);
  });

  it('uses one scale for every figure, so a figure twice as far is no deeper', () => {
    const near = depthUnits([50, 100, 200]);
    const far = depthUnits([500, 1000, 2000]);
    near.forEach((d, i) => expect(far[i]).toBeCloseTo(d, 10));
  });

  it('clamps outliers to the depth limit', () => {
    const depths = depthUnits([10, 100, 100, 100, 100000]);
    expect(depths[0]).toBe(MAX_DEPTH);
    expect(depths[4]).toBe(-MAX_DEPTH);
  });
});

describe('constellation figures', () => {
  const spread = (c: Constellation) => {
    const depths = c.stars.map((s) => s.depth);
    return Math.max(...depths) - Math.min(...depths);
  };

  it('gives every star a depth within the limit and a known temperature', () => {
    const temperatures = Object.values(SPECTRAL_TEMPERATURE);
    for (const c of order) {
      expect(c.stars.length).toBe(8);
      for (const s of c.stars) {
        expect(Math.abs(s.depth)).toBeLessThanOrEqual(MAX_DEPTH);
        expect(temperatures).toContain(s.temperature);
      }
    }
  });

  it('reads the Big Dipper as shallow and Cygnus as deep', () => {
    expect(spread(byRoute.home)).toBeLessThan(50);
    expect(spread(byRoute.contact)).toBeGreaterThan(150);
    expect(spread(byRoute.home)).toBeLessThan(spread(byRoute.contact));
  });

  it('places Deneb, the most distant star, at the back of Cygnus', () => {
    const deneb = byRoute.contact.stars[0];
    expect(deneb.depth).toBe(-MAX_DEPTH);
    expect(byRoute.contact.stars.every((s) => s.depth >= deneb.depth)).toBeTrue();
  });

  it('tints by class: Betelgeuse is cool and Rigel is hot', () => {
    expect(byRoute.work.stars[0].temperature).toBe(SPECTRAL_TEMPERATURE.M);
    expect(byRoute.work.stars[7].temperature).toBe(SPECTRAL_TEMPERATURE.B);
  });

  it('refuses star facts that do not match the star count', () => {
    expect(() =>
      figure(
        'Broken',
        [
          [0, 0],
          [10, 10],
        ],
        [{ a: 0, b: 1 }],
        [[100, 'A']],
      ),
    ).toThrowError(/2 stars but 1 star facts/);
  });
});
