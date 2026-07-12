import {
  easeOutCubic,
  flipTransform,
  maskScales,
  smoothingK,
  tiltFromVelocity,
} from './certifications.math';

describe('certifications.math', () => {
  describe('smoothingK', () => {
    it('returns the base fraction at the 60Hz reference frame time', () => {
      expect(smoothingK(1000 / 60, 0.12)).toBeCloseTo(0.12, 10);
    });

    it('closes the same total distance over one 60Hz frame as two 120Hz frames', () => {
      const oneFrame = smoothingK(1000 / 60, 0.12);
      const half = smoothingK(1000 / 120, 0.12);
      const twoHalves = 1 - (1 - half) * (1 - half);
      expect(twoHalves).toBeCloseTo(oneFrame, 10);
    });

    it('falls back to the base when dt is zero or negative', () => {
      expect(smoothingK(0, 0.12)).toBe(0.12);
      expect(smoothingK(-5, 0.12)).toBe(0.12);
    });
  });

  describe('tiltFromVelocity', () => {
    it('is zero at rest', () => {
      expect(tiltFromVelocity(0)).toBe(0);
    });

    it('scales with velocity inside the clamp', () => {
      expect(tiltFromVelocity(0.5)).toBeCloseTo(3, 10);
      expect(tiltFromVelocity(-0.5)).toBeCloseTo(-3, 10);
    });

    it('clamps a fling to the max tilt in both directions', () => {
      expect(tiltFromVelocity(100)).toBe(8);
      expect(tiltFromVelocity(-100)).toBe(-8);
    });
  });

  describe('maskScales', () => {
    it('inner is always the exact inverse of outer (no visible stretch)', () => {
      for (const p of [0.04, 0.2, 0.5, 0.83, 1]) {
        const { outer, inner } = maskScales(p);
        expect(outer * inner).toBeCloseTo(1, 10);
      }
    });

    it('floors progress at epsilon so the inverse never diverges', () => {
      const { outer, inner } = maskScales(0);
      expect(outer).toBe(0.04);
      expect(inner).toBeCloseTo(25, 10);
    });

    it('caps progress at 1', () => {
      expect(maskScales(2)).toEqual({ outer: 1, inner: 1 });
    });
  });

  describe('flipTransform', () => {
    it('is identity when source and destination coincide', () => {
      const r = { x: 10, y: 20, w: 300, h: 200 };
      expect(flipTransform(r, r)).toEqual({ tx: 0, ty: 0, sx: 1, sy: 1 });
    });

    it('scales down and translates toward a smaller offset source', () => {
      const src = { x: 100, y: 50, w: 150, h: 100 };
      const dst = { x: 400, y: 250, w: 600, h: 400 };
      expect(flipTransform(src, dst)).toEqual({ tx: -300, ty: -200, sx: 0.25, sy: 0.25 });
    });

    it('falls back to identity scale for degenerate rects (never Infinity)', () => {
      const src = { x: 0, y: 0, w: 0, h: 100 };
      const dst = { x: 0, y: 0, w: 600, h: 0 };
      const { sx, sy } = flipTransform(src, dst);
      expect(sx).toBe(1);
      expect(sy).toBe(1);
    });
  });

  describe('easeOutCubic', () => {
    it('anchors at 0 and 1', () => {
      expect(easeOutCubic(0)).toBe(0);
      expect(easeOutCubic(1)).toBe(1);
    });

    it('front-loads the motion (fast open, soft settle)', () => {
      expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
    });

    it('clamps out-of-range progress', () => {
      expect(easeOutCubic(-1)).toBe(0);
      expect(easeOutCubic(2)).toBe(1);
    });
  });
});
