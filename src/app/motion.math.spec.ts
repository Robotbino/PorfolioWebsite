import { smoothingK } from './motion.math';

describe('motion.math', () => {
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
});
