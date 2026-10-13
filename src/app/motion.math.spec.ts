import { cardOffset, easeToward, smoothingK } from './motion.math';

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

  describe('easeToward', () => {
    it('closes k of the remaining distance', () => {
      expect(easeToward(0, 1, 0.25)).toBeCloseTo(0.25, 10);
      expect(easeToward(1, 0, 0.25)).toBeCloseTo(0.75, 10);
    });

    it('lands exactly on the target once within 0.001', () => {
      expect(easeToward(0.9995, 1, 0.1)).toBe(1);
      expect(easeToward(-0.0005, 0, 0.1)).toBe(0);
    });

    it('stays put when already at the target', () => {
      expect(easeToward(0.4, 0.4, 0.15)).toBe(0.4);
    });
  });

  describe('cardOffset', () => {
    it('is zero for the centred card', () => {
      expect(cardOffset(500, 500, 800)).toBe(0);
    });

    it('is one step either side for a neighbouring card', () => {
      expect(cardOffset(1300, 500, 800)).toBe(1);
      expect(cardOffset(-300, 500, 800)).toBe(-1);
    });

    it('scales linearly between the centre and one step', () => {
      expect(cardOffset(900, 500, 800)).toBeCloseTo(0.5, 10);
      expect(cardOffset(100, 500, 800)).toBeCloseTo(-0.5, 10);
    });

    it('holds at ±1 for cards further out', () => {
      expect(cardOffset(2900, 500, 800)).toBe(1);
      expect(cardOffset(-2900, 500, 800)).toBe(-1);
    });

    it('returns zero when there is no step to measure against', () => {
      expect(cardOffset(900, 500, 0)).toBe(0);
      expect(cardOffset(900, 500, -10)).toBe(0);
    });
  });
});
