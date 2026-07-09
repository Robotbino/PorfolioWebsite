import { positionFor, wrapOffset } from './scroll-loop.math';

describe('positionFor', () => {
  // Home, Work, About, Contact, Home-clone with even 1000px gaps. With vh 800
  // the band (0.85 * vh = 680) is the limiting factor, so morphs are banded.
  const anchors = [0, 1000, 2000, 3000, 4000];
  const vh = 800;

  it('clamps at Home at or above the top', () => {
    expect(positionFor(-50, anchors, vh)).toBe(0);
    expect(positionFor(0, anchors, vh)).toBe(0);
  });

  it('rests at an integer while a section is in view (before the band)', () => {
    // Boundary 1->2 at anchor 2000; band starts at 2000 - 680 = 1320.
    // y = 1100 is in view but before the band, so the figure rests at 1 exactly.
    expect(positionFor(1100, anchors, vh)).toBe(1);
  });

  it('returns a fraction inside the morph band', () => {
    // Halfway through the 680px band before the 1->2 boundary: 1320 + 340 = 1660.
    expect(positionFor(1660, anchors, vh)).toBeCloseTo(1.5, 5);
  });

  it('reaches the next integer exactly at the boundary', () => {
    expect(positionFor(2000, anchors, vh)).toBe(2);
  });

  it('morphs only over the last ~0.85vh of a very tall section (rest of it is a rest)', () => {
    // A tall Work section: 0, 1000, then a 5000px section to 6000, clone at 7000.
    const tall = [0, 1000, 6000, 7000];
    const v = 1000; // band = 850; boundary 1->2 at 6000, band starts at 5150.
    expect(positionFor(3000, tall, v)).toBe(1); // deep in the tall section: rests
    expect(positionFor(5150, tall, v)).toBe(1); // exactly at band start: still 1
    expect(positionFor(5575, tall, v)).toBeCloseTo(1.5, 5); // mid-band
    expect(positionFor(6000, tall, v)).toBe(2); // boundary
  });

  it('returns cycleLength (the last index) at or past the clone top', () => {
    // last index = anchors.length - 1 = 4 = cycleLength; read as Home again.
    expect(positionFor(4000, anchors, vh)).toBe(4);
    expect(positionFor(4200, anchors, vh)).toBe(4);
  });

  it('returns 0 when there are no anchors (pre-measure)', () => {
    expect(positionFor(1234, [], vh)).toBe(0);
  });

  it('handles a five-destination cycle (Certifications between About and Contact)', () => {
    // Home, Work, About, Certifications, Contact, clone — cycleLength 5.
    const five = [0, 1000, 2000, 3000, 4000, 5000];
    expect(positionFor(3100, five, vh)).toBe(3); // rests at Certifications
    expect(positionFor(3660, five, vh)).toBeCloseTo(3.5, 5); // mid-band 3->4
    expect(positionFor(5000, five, vh)).toBe(5); // clone top = cycleLength
    expect(wrapOffset(5025, 5000)).toBe(25); // seam wrap preserves overshoot
  });
});

describe('wrapOffset', () => {
  it('returns null below the seam', () => {
    expect(wrapOffset(3999, 4000)).toBeNull();
  });

  it('preserves momentum overshoot at or past the seam', () => {
    expect(wrapOffset(4000, 4000)).toBe(0);
    expect(wrapOffset(4015, 4000)).toBe(15);
  });

  it('returns null before measurement (wrapAt <= 0)', () => {
    expect(wrapOffset(5000, 0)).toBeNull();
    expect(wrapOffset(5000, -1)).toBeNull();
  });
});
