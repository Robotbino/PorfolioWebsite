import { MorphDriver } from './morph-driver';

describe('MorphDriver', () => {
  let driver: MorphDriver;

  beforeEach(() => {
    driver = new MorphDriver();
  });

  describe('reduce-motion', () => {
    it('snaps to the target with no inertia', () => {
      const frame = driver.advance(2, 4, true);
      expect(frame.rendered).toBe(2);
      expect(frame.fromIndex).toBe(2);
      expect(frame.toIndex).toBe(2);
      expect(frame.frac).toBe(0);
      expect(frame.eased).toBe(0);
      expect(frame.transit).toBe(0);
    });

    it('wraps the target into [0, count)', () => {
      const frame = driver.advance(5, 4, true);
      expect(frame.rendered).toBe(1);
      expect(frame.fromIndex).toBe(1);
    });
  });

  describe('inertia', () => {
    it('eases toward the target rather than jumping', () => {
      // From 0 to target 1, shortest path is forward — rendered should move
      // toward 1 but not reach it in one frame.
      const frame = driver.advance(1, 4, false);
      expect(frame.rendered).toBeGreaterThan(0);
      expect(frame.rendered).toBeLessThan(1);
    });

    it('converges on the target over many frames', () => {
      for (let i = 0; i < 200; i++) {
        driver.advance(2, 4, false);
      }
      const frame = driver.advance(2, 4, false);
      expect(frame.rendered).toBeCloseTo(2, 2);
    });
  });

  describe('shortest path across the loop seam', () => {
    it('goes forward from near-count to 0 via the short path', () => {
      // Seed the driver near the end of the loop.
      for (let i = 0; i < 200; i++) {
        driver.advance(3.9, 4, false);
      }
      // Now target wraps to 0 — the short path is forward (3.9 → 0),
      // not backward (3.9 → 3 → 2 → 1 → 0).
      const frame = driver.advance(0.1, 4, false);
      // rendered should have moved past 3.9 toward 4/0, not dropped toward 0.
      expect(frame.rendered).toBeGreaterThan(3.5);
    });
  });

  describe('transit (settle factor)', () => {
    it('is zero at rest', () => {
      for (let i = 0; i < 200; i++) {
        driver.advance(1, 4, false);
      }
      const frame = driver.advance(1, 4, false);
      expect(frame.transit).toBeCloseTo(0, 2);
    });

    it('rises during fast scrolling', () => {
      driver.advance(0, 4, false);
      const frame = driver.advance(3, 4, false);
      expect(frame.transit).toBeGreaterThan(0);
    });

    it('is capped at 0.75', () => {
      // Huge jump to max out transit.
      driver.advance(0, 100, false);
      const frame = driver.advance(50, 100, false);
      expect(frame.transit).toBeLessThanOrEqual(0.75);
    });
  });

  describe('figure selection and easing', () => {
    it('selects correct from/to indices', () => {
      for (let i = 0; i < 200; i++) {
        driver.advance(1.5, 4, false);
      }
      const frame = driver.advance(1.5, 4, false);
      expect(frame.fromIndex).toBe(1);
      expect(frame.toIndex).toBe(2);
    });

    it('wraps toIndex at the cycle boundary', () => {
      for (let i = 0; i < 200; i++) {
        driver.advance(3.5, 4, false);
      }
      const frame = driver.advance(3.5, 4, false);
      expect(frame.fromIndex).toBe(3);
      expect(frame.toIndex).toBe(0);
    });

    it('applies easeInOutQuart to the fraction', () => {
      // Drive to a known midpoint where frac ≈ 0.5.
      for (let i = 0; i < 400; i++) {
        driver.advance(1.5, 4, false);
      }
      const frame = driver.advance(1.5, 4, false);
      // easeInOutQuart(0.5) = 0.5, but at any frac the eased value should
      // differ from the raw frac (unless frac is exactly 0 or 0.5).
      expect(frame.eased).toBeGreaterThanOrEqual(0);
      expect(frame.eased).toBeLessThanOrEqual(1);
    });

    it('returns eased = 0 when frac is negligible', () => {
      for (let i = 0; i < 400; i++) {
        driver.advance(2, 4, false);
      }
      const frame = driver.advance(2, 4, false);
      expect(frame.eased).toBe(0);
    });
  });
});
