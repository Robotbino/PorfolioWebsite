import { DESTINATIONS } from './destinations';
import { byRoute, order } from './constellation/constellation.figures';

/**
 * The registry's interface is a plain list, so its test surface is its own
 * consistency and its alignment with the constellation it feeds. This is the
 * drift guard: it fails loudly the day a destination is added in one place and
 * not the other.
 */
describe('DESTINATIONS registry', () => {
  it('has unique ids', () => {
    const ids = DESTINATIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('maps every destination to a real constellation figure', () => {
    for (const d of DESTINATIONS) {
      expect(byRoute[d.figure]).toBeDefined();
    }
  });

  it('matches the constellation order one-to-one', () => {
    expect(DESTINATIONS.length).toBe(order.length);
    DESTINATIONS.forEach((d, i) => {
      expect(order[i]).toBe(byRoute[d.figure]);
    });
  });
});
