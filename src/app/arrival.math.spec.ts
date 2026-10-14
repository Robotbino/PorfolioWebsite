import { arrivalOrigin } from './arrival.math';

describe('arrivalOrigin', () => {
  const viewport = 900;
  const work = 6300; // roughly seven viewports, the tallest destination

  it('anchors on the top edge while the section starts in or below the viewport', () => {
    expect(arrivalOrigin(0, work)).toBe(0);
    expect(arrivalOrigin(viewport - 1, work)).toBe(0);
    expect(arrivalOrigin(4 * viewport, work)).toBe(0);
  });

  it('anchors on the bottom edge once the section is entirely above the viewport', () => {
    expect(arrivalOrigin(-work, work)).toBe(100);
    expect(arrivalOrigin(-work - viewport, work)).toBe(100);
  });

  it('anchors at (nearly) the bottom edge when a section enters from above', () => {
    // The observer reports a frame late, so a sliver is already in view.
    expect(arrivalOrigin(-viewport + 40, viewport)).toBeGreaterThan(95);
  });

  it('anchors on the line at the top of the viewport after a jump into the middle', () => {
    expect(arrivalOrigin(-1800, work)).toBeCloseTo((1800 / work) * 100, 10);
    expect(arrivalOrigin(-work / 2, work)).toBeCloseTo(50, 10);
  });

  it('keeps the on-screen part of a tall section nearly still', () => {
    // A point moves by (1 − scale) × its distance from the anchor while the
    // scale settles from 0.975 to 1.
    const drift = (anchorPx: number, pointPx: number) => 0.025 * Math.abs(pointPx - anchorPx);
    const top = -1800;
    const anchor = (arrivalOrigin(top, work) / 100) * work;
    const firstInView = -top;
    const lastInView = -top + viewport;

    expect(drift(anchor, firstInView)).toBeCloseTo(0, 6);
    expect(drift(anchor, lastInView)).toBeLessThan(23);
    // Anchoring on the bottom edge instead would slide the whole screen.
    expect(drift(work, firstInView)).toBeGreaterThan(100);
  });

  it('stays within 0..100 for any position', () => {
    for (let top = -2 * work; top <= 2 * work; top += 137) {
      const origin = arrivalOrigin(top, work);
      expect(origin).toBeGreaterThanOrEqual(0);
      expect(origin).toBeLessThanOrEqual(100);
    }
  });

  it('falls back to the top edge for a section with no height', () => {
    expect(arrivalOrigin(-50, 0)).toBe(0);
    expect(arrivalOrigin(-50, Number.NaN)).toBe(0);
  });
});
