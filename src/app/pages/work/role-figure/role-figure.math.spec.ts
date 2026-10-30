import { ROLE } from '../work-data';
import {
  DROP,
  FALL,
  FigureGeometry,
  LIFT,
  REST_LIFT,
  delayMs,
  figureGeometry,
  liftFor,
  monthsBetween,
  plateIndex,
  yearMonthIn,
} from './role-figure.math';

/**
 * The figure's promises are a calendar's and a frame's: plates stand where
 * their positions began, the scale is engraved only up to now, and no pose the
 * figure can reach leaves its viewBox. A headless run can't judge the look (the
 * Hairline look sheet in docs/hairline/plates/ did), but it can measure all of
 * these from the path data.
 */
describe('role-figure.math', () => {
  type Point = [number, number];

  /** The coordinate pairs in a path string, in order. */
  function points(d: string): Point[] {
    const n = (d.match(/-?[\d.]+/g) ?? []).map(Number);
    const out: Point[] = [];
    for (let i = 0; i + 1 < n.length; i += 2) {
      out.push([n[i], n[i + 1]]);
    }
    return out;
  }

  const subpaths = (d: string) => (d.match(/M/g) ?? []).length;
  const centreX = (d: string) => {
    const xs = points(d).map((p) => p[0]);
    return (Math.min(...xs) + Math.max(...xs)) / 2;
  };

  /** Every path of the drawing, each plate moved by the lift it is given. */
  function drawing(g: FigureGeometry, lift: (i: number) => number): Point[] {
    const still = [g.ledge.sil, g.ledge.crease, g.groove, g.years, g.quarters, g.now].flatMap(
      points,
    );
    const plates = g.plates.flatMap((p, i) =>
      [p.back, p.face, p.field, p.target]
        .flatMap(points)
        .map(([x, y]): Point => [x, y + lift(i) * g.liftPx]),
    );
    return [...still, ...plates];
  }

  function expectInside(g: FigureGeometry, pts: Point[]): void {
    const [x, y, w, h] = g.viewBox.split(' ').map(Number);
    for (const [px, py] of pts) {
      expect(px).toBeGreaterThanOrEqual(x);
      expect(px).toBeLessThanOrEqual(x + w);
      expect(py).toBeGreaterThanOrEqual(y);
      expect(py).toBeLessThanOrEqual(y + h);
    }
  }

  const at = (...starts: string[]) => starts.map((start) => ({ start }));

  describe('the calendar', () => {
    it("reads the month in Pretoria, not in the visitor's zone", () => {
      // 22:30 UTC on 31 October is already 1 November in South Africa.
      expect(yearMonthIn(new Date('2026-10-31T22:30:00Z'))).toBe('2026-11');
      expect(yearMonthIn(new Date('2026-10-31T21:30:00Z'))).toBe('2026-10');
    });

    it('counts whole months across years', () => {
      expect(monthsBetween('2024-06', '2026-10')).toBe(28);
      expect(monthsBetween('2025-12', '2026-01')).toBe(1);
      expect(monthsBetween('2026-06', '2026-06')).toBe(0);
    });

    it("dates every position's start by the month its period begins with", () => {
      for (const position of ROLE.positions) {
        const [year, month] = position.start.split('-').map(Number);
        const name = new Date(Date.UTC(year, month - 1, 15)).toLocaleString('en-GB', {
          month: 'long',
          timeZone: 'UTC',
        });
        expect(position.period.startsWith(`${name} ${year}`)).toBeTrue();
      }
    });
  });

  describe('the drawing', () => {
    const g = figureGeometry(ROLE.positions, '2026-10');

    it('stands one plate per position, oldest at the back', () => {
      expect(g.plates.length).toBe(ROLE.positions.length);
      const xs = g.plates.map((p) => centreX(p.face));
      expect(xs).toEqual([...xs].sort((a, b) => a - b));
    });

    it('spaces the plates by the calendar, not evenly', () => {
      const yearly = figureGeometry(at('2026-06', '2025-06', '2024-06'), '2026-10');
      const yx = yearly.plates.map((p) => centreX(p.face));
      expect(yx[2] - yx[1]).toBeCloseTo(yx[1] - yx[0], 1);

      // Six months, then eighteen: three times the gap.
      const uneven = figureGeometry(at('2026-06', '2024-12', '2024-06'), '2026-10');
      const ux = uneven.plates.map((p) => centreX(p.face));
      expect((ux[2] - ux[1]) / (ux[1] - ux[0])).toBeCloseTo(3, 1);
    });

    it('numbers each plate with as many code notches as its place in the row', () => {
      // A notch adds three points to the outline, each filleted into five.
      const outline = g.plates.map((p) => points(p.face).length);
      expect(outline[1] - outline[0]).toBe(15);
      expect(outline[2] - outline[1]).toBe(15);
    });

    it('rules a year mark at every June, and quarters only up to now', () => {
      expect(subpaths(g.years)).toBe(4); // June 2024, 2025, 2026, 2027
      expect(subpaths(g.quarters)).toBe(7); // months 3, 6, 9, 15, 18, 21, 27
      const later = figureGeometry(ROLE.positions, '2027-04');
      expect(subpaths(later.quarters)).toBe(9); // and 30, 33
    });

    it('moves the now mark with the month', () => {
      const october = centreX(g.now);
      const december = centreX(figureGeometry(ROLE.positions, '2026-12').now);
      expect(december).toBeGreaterThan(october);
    });

    it('runs the ledge on to the next June after now', () => {
      const pastTheLastMark = figureGeometry(ROLE.positions, '2027-08');
      expect(subpaths(pastTheLastMark.years)).toBe(5);
      expect(centreX(pastTheLastMark.now)).toBeLessThan(
        Math.max(...points(pastTheLastMark.ledge.sil).map((p) => p[0])),
      );
    });

    it('lifts straight up the screen', () => {
      expect(g.liftPx).toBeLessThan(0);
      expect(g.liftPx).toBeCloseTo(-1.06 * Math.sqrt(1 - 0.25), 6);
    });

    it('keeps every pose it can reach inside the viewBox', () => {
      const n = g.plates.length;
      expectInside(
        g,
        drawing(g, (i) => liftFor(null, i, n)),
      );
      for (let picked = 0; picked < n; picked++) {
        expectInside(
          g,
          drawing(g, (i) => liftFor(picked, i, n)),
        );
      }
      // The entrance holds each plate DROP above its rest.
      expectInside(
        g,
        drawing(g, (i) => liftFor(null, i, n) + DROP),
      );
    });

    it('still fits a fourth position', () => {
      const four = figureGeometry(at('2027-06', '2026-06', '2025-06', '2024-06'), '2027-07');
      expect(four.plates.length).toBe(4);
      expectInside(
        four,
        drawing(four, (i) => liftFor(0, i, 4)),
      );
      expectInside(
        four,
        drawing(four, (i) => liftFor(null, i, 4) + DROP),
      );
    });
  });

  describe('the gesture', () => {
    it('maps the newest-first lines onto the oldest-first plates', () => {
      expect([0, 1, 2].map((line) => plateIndex(line, 3))).toEqual([2, 1, 0]);
    });

    it('rests with the newest plate half lifted and the others seated', () => {
      expect([0, 1, 2].map((i) => liftFor(null, i, 3))).toEqual([0, 0, REST_LIFT]);
      expect(REST_LIFT).toBe(LIFT / 2);
    });

    it('lifts the picked plate fully and its neighbours less, to a floor', () => {
      expect([0, 1, 2].map((i) => liftFor(0, i, 3))).toEqual([
        LIFT,
        LIFT * FALL[1],
        LIFT * FALL[2],
      ]);
      expect(liftFor(0, 3, 4)).toBe(LIFT * FALL[2]);
    });

    it('spreads a change outwards from where it started', () => {
      expect([0, 1, 2].map((i) => delayMs(1, i))).toEqual([45, 0, 45]);
      expect([0, 1, 2].map((i) => delayMs(2, i))).toEqual([90, 45, 0]);
    });
  });
});
