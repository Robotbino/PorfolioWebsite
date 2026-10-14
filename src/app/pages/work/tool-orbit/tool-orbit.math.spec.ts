import {
  ORBIT,
  ORBIT_SAMPLES,
  OrbitPoint,
  RINGS,
  angleAt,
  depthOpacity,
  orbitKeyframes,
  projectOrbit,
  restStyle,
  ringGradient,
  ringPath,
} from './tool-orbit.math';

/**
 * The orbit's promises are geometric: the logos stay inside the stage, never
 * cover the black hole's bright ring, never touch a logo on the other ring, and
 * ride exactly on the drawn lines. A headless run can't judge any of that by
 * looking, so these specs sample every ring at 720 angles and measure it.
 */
describe('tool-orbit.math', () => {
  const SAMPLES = 720;
  const STAGE = { width: 100, height: 75 };

  function sampleRing(radius: number, count = SAMPLES): OrbitPoint[] {
    return Array.from({ length: count }, (_, i) => projectOrbit(angleAt(0, i / count), radius));
  }

  /** Half the side of a logo's box once perspective has scaled it. */
  const half = (p: OrbitPoint) => (ORBIT.iconCqi * p.scale) / 2;

  /** Distance between two axis-aligned boxes; negative when they overlap. */
  function boxGap(a: OrbitPoint, b: OrbitPoint): number {
    const reach = half(a) + half(b);
    const dx = Math.abs(a.x - b.x) - reach;
    const dy = Math.abs(a.y - b.y) - reach;
    return dx > 0 && dy > 0 ? Math.hypot(dx, dy) : Math.max(dx, dy);
  }

  /** The numbers in a transform string, in order. */
  const numbers = (value: string) => (value.match(/-?[\d.]+/g) ?? []).map(Number);

  const inner = sampleRing(RINGS.inner.radius);
  const outer = sampleRing(RINGS.outer.radius);

  describe('projectOrbit', () => {
    it('puts the near side below the centre, larger, and the far side above, smaller', () => {
      const near = projectOrbit(Math.PI / 2, RINGS.outer.radius);
      const far = projectOrbit(-Math.PI / 2, RINGS.outer.radius);

      expect(near.y).toBeGreaterThan(ORBIT.centre.y);
      expect(near.scale).toBeGreaterThan(1);
      expect(near.depth).toBeCloseTo(1, 10);
      expect(far.y).toBeLessThan(ORBIT.centre.y);
      expect(far.scale).toBeLessThan(1);
      expect(far.depth).toBeCloseTo(-1, 10);
    });

    it('leaves the two ends of the ring at full size', () => {
      expect(projectOrbit(0, RINGS.outer.radius).scale).toBeCloseTo(1, 10);
      expect(projectOrbit(Math.PI, RINGS.outer.radius).scale).toBeCloseTo(1, 10);
    });

    it('scales the outer ring between about 0.87 and 1.17', () => {
      const scales = outer.map((p) => p.scale);
      expect(Math.abs(Math.min(...scales) - 0.87)).toBeLessThanOrEqual(0.02);
      expect(Math.abs(Math.max(...scales) - 1.17)).toBeLessThanOrEqual(0.02);
    });

    it('keeps every logo and its shadow inside the 100 × 75 stage', () => {
      for (const p of [...inner, ...outer]) {
        const reach = half(p) + ORBIT.shadowMarginCqi;
        expect(p.x - reach).toBeGreaterThanOrEqual(0);
        expect(p.x + reach).toBeLessThanOrEqual(STAGE.width);
        expect(p.y - reach).toBeGreaterThanOrEqual(0);
        expect(p.y + reach).toBeLessThanOrEqual(STAGE.height);
      }
    });

    it('keeps the inner logos clear of the photon ring', () => {
      let closest = Infinity;
      for (const p of inner) {
        const h = half(p);
        const dx = Math.max(p.x - h - ORBIT.hole.x, 0, ORBIT.hole.x - (p.x + h));
        const dy = Math.max(p.y - h - ORBIT.hole.y, 0, ORBIT.hole.y - (p.y + h));
        closest = Math.min(closest, Math.hypot(dx, dy));
      }
      expect(closest).toBeGreaterThanOrEqual(ORBIT.photonRingCqi + 1);
    });

    it('never lets a logo on one ring touch a logo on the other', () => {
      // The rings turn at different speeds, so over time every inner angle meets
      // every outer angle: check all the pairs, not just matching angles.
      let gap = Infinity;
      for (const a of inner) {
        for (const b of outer) {
          gap = Math.min(gap, boxGap(a, b));
        }
      }
      expect(gap).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe('angleAt', () => {
    it('runs counter-clockwise on screen: from the right end, logos rise', () => {
      const start = projectOrbit(angleAt(0), RINGS.outer.radius);
      const next = projectOrbit(angleAt(0.01), RINGS.outer.radius);
      expect(next.y).toBeLessThan(start.y);
    });

    it('adds the lap travelled to the starting slot', () => {
      expect(angleAt(0.25, 0.5)).toBeCloseTo(angleAt(0.75), 10);
    });
  });

  describe('depthOpacity', () => {
    it('dims the far point to 0.72 and keeps the near point opaque', () => {
      expect(depthOpacity(-1)).toBeCloseTo(0.72, 10);
      expect(depthOpacity(0)).toBeCloseTo(0.86, 10);
      expect(depthOpacity(1)).toBeCloseTo(1, 10);
    });
  });

  describe('orbitKeyframes', () => {
    const UNIT_PX = 4.24;
    const frames = orbitKeyframes(RINGS.outer.radius, UNIT_PX);

    it('is one lap of 73 frames that ends where it starts', () => {
      expect(frames.length).toBe(ORBIT_SAMPLES + 1);
      expect(frames.length).toBe(73);
      expect(frames[frames.length - 1]).toEqual(frames[0]);
    });

    it('animates only transform and opacity, leaving the offsets evenly spaced', () => {
      for (const frame of frames) {
        expect(Object.keys(frame).sort()).toEqual(['opacity', 'transform']);
      }
    });

    it('writes plain pixel transforms the compositor can take', () => {
      for (const frame of frames) {
        expect(frame['transform']).toMatch(/^translate\(-?[\d.]+px, -?[\d.]+px\) scale\([\d.]+\)$/);
      }
    });

    it('keeps opacity between 0.72 and 1', () => {
      for (const frame of frames) {
        expect(frame['opacity']).toBeGreaterThanOrEqual(0.72);
        expect(frame['opacity']).toBeLessThanOrEqual(1);
      }
    });

    it('places each frame on the projected ring, in pixels from the orbit centre', () => {
      frames.slice(0, ORBIT_SAMPLES).forEach((frame, i) => {
        const p = projectOrbit(angleAt(0, i / ORBIT_SAMPLES), RINGS.outer.radius);
        const [x, y, scale] = numbers(frame['transform'] as string);
        expect(x).toBeCloseTo((p.x - ORBIT.centre.x) * UNIT_PX, 2);
        expect(y).toBeCloseTo((p.y - ORBIT.centre.y) * UNIT_PX, 2);
        expect(scale).toBeCloseTo(p.scale, 2);
      });
    });

    it('goes over the far side first, then round to the near side', () => {
      const [, startY] = numbers(frames[0]['transform'] as string);
      const [, quarterY] = numbers(frames[ORBIT_SAMPLES / 4]['transform'] as string);
      const [, threeQuarterY, nearScale] = numbers(
        frames[(ORBIT_SAMPLES * 3) / 4]['transform'] as string,
      );
      // Counter-clockwise: a quarter lap goes over the far side (up), three
      // quarters reaches the near side (down, and larger).
      expect(quarterY).toBeLessThan(startY);
      expect(threeQuarterY).toBeGreaterThan(startY);
      expect(nearScale).toBeGreaterThan(1);
    });
  });

  describe('restStyle', () => {
    // Every slot the ten tools start from: quarters-plus-eighths inside, sixths outside.
    const INNER_SLOTS = [0.125, 0.375, 0.625, 0.875];
    const OUTER_SLOTS = [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6];

    function expectRestMatchesFrame(slot: number, radius: number): void {
      const rest = restStyle(slot, radius);
      // With one pixel per unit the keyframe numbers are the cqi numbers.
      const frame = orbitKeyframes(radius, 1)[Math.round(slot * ORBIT_SAMPLES)];
      expect(rest.transform).toMatch(/^translate\(-?[\d.]+cqi, -?[\d.]+cqi\) scale\([\d.]+\)$/);
      expect(numbers(rest.transform)).toEqual(numbers(frame['transform'] as string));
      expect(Number(rest.opacity)).toBe(frame['opacity'] as number);
    }

    it('lands every starting slot exactly on a keyframe', () => {
      for (const slot of [...INNER_SLOTS, ...OUTER_SLOTS]) {
        expect(slot * ORBIT_SAMPLES).toBeCloseTo(Math.round(slot * ORBIT_SAMPLES), 9);
      }
    });

    it('equals the pose its animation starts from, on both rings', () => {
      INNER_SLOTS.forEach((slot) => expectRestMatchesFrame(slot, RINGS.inner.radius));
      OUTER_SLOTS.forEach((slot) => expectRestMatchesFrame(slot, RINGS.outer.radius));
    });
  });

  describe('ringPath', () => {
    const d = ringPath(RINGS.inner.radius);

    it('is a closed path of 120 segments', () => {
      expect(d).toMatch(/^M [\d. L]+ Z$/);
      expect(d.match(/M/g)?.length).toBe(1);
      expect(d.match(/L/g)?.length).toBe(119);
    });

    it('traces the same ring the logos travel, inside the viewBox', () => {
      const points = d
        .replace(/^M /, '')
        .replace(/ Z$/, '')
        .split(' L ')
        .map((pair) => pair.split(' ').map(Number));

      expect(points.length).toBe(120);
      points.forEach(([x, y], i) => {
        const p = projectOrbit(angleAt(0, i / 120), RINGS.inner.radius);
        expect(x).toBeCloseTo(p.x, 2);
        expect(y).toBeCloseTo(p.y, 2);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(STAGE.width);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(STAGE.height);
      });
    });
  });

  describe('ringGradient', () => {
    it('runs from the far point above the centre to the near point below it', () => {
      const g = ringGradient(RINGS.outer.radius);
      const far = projectOrbit(-Math.PI / 2, RINGS.outer.radius);
      const near = projectOrbit(Math.PI / 2, RINGS.outer.radius);

      expect(g.x1).toBeCloseTo(far.x, 2);
      expect(g.y1).toBeCloseTo(far.y, 2);
      expect(g.x2).toBeCloseTo(near.x, 2);
      expect(g.y2).toBeCloseTo(near.y, 2);
      expect(g.y1).toBeLessThan(ORBIT.centre.y);
      expect(g.y2).toBeGreaterThan(ORBIT.centre.y);
    });
  });
});
