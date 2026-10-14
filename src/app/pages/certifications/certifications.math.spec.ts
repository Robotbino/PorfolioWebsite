import {
  PREVIEW_MAX_TURN,
  easeOutCubic,
  flipFromCentre,
  maskScales,
  previewPose,
  tiltFromVelocity,
} from './certifications.math';

describe('certifications.math', () => {
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

  describe('flipFromCentre', () => {
    it('is identity when source and destination coincide', () => {
      const dst = { x: 10, y: 20, w: 300, h: 200 };
      const src = { cx: 160, cy: 120, w: 300, h: 200 };
      expect(flipFromCentre(src, dst)).toEqual({ tx: 0, ty: 0, sx: 1, sy: 1 });
    });

    it('moves the destination centre onto the source centre and scales to it', () => {
      const dst = { x: 400, y: 250, w: 600, h: 400 }; // centre (700, 450)
      const src = { cx: 175, cy: 100, w: 150, h: 100 };
      expect(flipFromCentre(src, dst)).toEqual({ tx: -525, ty: -350, sx: 0.25, sy: 0.25 });
    });

    it('falls back to identity scale for degenerate boxes (never Infinity)', () => {
      const src = { cx: 0, cy: 0, w: 0, h: 100 };
      const dst = { x: 0, y: 0, w: 600, h: 0 };
      const { sx, sy } = flipFromCentre(src, dst);
      expect(sx).toBe(1);
      expect(sy).toBe(1);
    });
  });

  describe('previewPose', () => {
    it('is flat at rest', () => {
      expect(previewPose(0)).toEqual({ turn: 0, roll: 0, turnRatio: 0 });
    });

    it('caps the turn at 14deg in both directions', () => {
      expect(PREVIEW_MAX_TURN).toBe(14);
      expect(previewPose(100).turn).toBe(14);
      expect(previewPose(-100).turn).toBe(-14);
      expect(tiltFromVelocity(100, 14, 9)).toBe(14);
    });

    it('turns 9deg per px/ms below the cap', () => {
      expect(previewPose(0.5).turn).toBeCloseTo(4.5, 10);
      expect(previewPose(-1).turn).toBeCloseTo(-9, 10);
    });

    it('rolls a third of the turn', () => {
      for (const vx of [0.2, -0.7, 1.2, 100, -100]) {
        const { turn, roll } = previewPose(vx);
        expect(roll).toBeCloseTo(turn / 3, 10);
      }
      expect(previewPose(100).roll).toBeCloseTo(14 / 3, 10);
    });

    it('reports the turn as -1..1 for the stylesheet, reaching the ends at the cap', () => {
      expect(previewPose(100).turnRatio).toBe(1);
      expect(previewPose(-100).turnRatio).toBe(-1);
      expect(previewPose(0.5).turnRatio).toBeCloseTo(4.5 / 14, 10);
      for (const vx of [-50, -1, -0.1, 0.1, 1, 50]) {
        const { turnRatio } = previewPose(vx);
        expect(Math.abs(turnRatio)).toBeLessThanOrEqual(1);
      }
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
