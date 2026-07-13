import { ScrollLoopService } from './scroll-loop.service';

/**
 * The service is the stateful seam over the pure cycle math: feed it section
 * offsets + a scroll position, read back the truth. `activeDestination` is the
 * interface C3 adds — one answer to "which destination is in view" — so its
 * test surface is: feed a scrollY, read the id. No DOM; the shell's geometry is
 * passed in as plain numbers, exactly as the real shell does.
 */
describe('ScrollLoopService.activeDestination', () => {
  // Home, Work, About, Certifications, Contact, Loop clone — even 1000px gaps.
  const anchors = [0, 1000, 2000, 3000, 4000, 5000];
  const vh = 800; // band = 0.85 * 800 = 680, the limiting factor.

  let loop: ScrollLoopService;

  beforeEach(() => {
    loop = new ScrollLoopService();
    loop.setAnchors(anchors);
  });

  function activeAt(scrollY: number): string {
    loop.update(scrollY, vh);
    return loop.activeDestination();
  }

  it('rests on each destination while its section is in view', () => {
    expect(activeAt(0)).toBe('dest-home');
    expect(activeAt(1000)).toBe('dest-work');
    expect(activeAt(2100)).toBe('dest-about');
    expect(activeAt(3100)).toBe('dest-certifications');
    expect(activeAt(4100)).toBe('dest-contact');
  });

  it('flips at the morph-band midpoint, not at the section edge', () => {
    // 1->2 band midpoint (position ~1.5): highlight moves to About.
    expect(activeAt(1660)).toBe('dest-about');
    // Just before the midpoint it is still Work.
    expect(activeAt(1400)).toBe('dest-work');
  });

  it('reads Home again at the seam (inside the Loop clone)', () => {
    // At/after the clone top, position === cycleLength, which wraps to Home.
    expect(activeAt(5000)).toBe('dest-home');
  });

  it('defaults to Home before the shell has measured (no anchors)', () => {
    const fresh = new ScrollLoopService();
    expect(fresh.activeDestination()).toBe('dest-home');
  });
});
