import {
  AZ0,
  Aim,
  DishPose,
  EL0,
  REACH,
  REST,
  STOW,
  SURVEY,
  aimAt,
  dishGeometry,
  reachable,
} from './contact-dish.math';

/**
 * The dish's promises: a pointer's aim is clamped to the reach, every aim it
 * can take stays inside the viewBox, and at every aim each arm of the yoke is
 * drawn on exactly one side of the dish. A headless run can't judge the look
 * (the Hairline look sheet in docs/hairline/listening/ did), but it can
 * measure all of these from the path data.
 */
describe('contact-dish.math', () => {
  const geometry = dishGeometry();

  /** The coordinate pairs in a path string. */
  function points(d: string): [number, number][] {
    const n = (d.match(/-?[\d.]+/g) ?? []).map(Number);
    const out: [number, number][] = [];
    for (let i = 0; i + 1 < n.length; i += 2) {
      out.push([n[i], n[i + 1]]);
    }
    return out;
  }

  const drawn = (pose: DishPose) =>
    [
      pose.beam.sil,
      pose.outline,
      pose.rim,
      pose.struts,
      pose.feed.sil,
      ...pose.sides.flatMap((s) => [s.ring, s.arm.sil, s.trunnion]),
    ].flatMap(points);

  function expectInside(pts: [number, number][]): void {
    const [x, y, w, h] = geometry.viewBox.split(' ').map(Number);
    for (const [px, py] of pts) {
      expect(px).toBeGreaterThanOrEqual(x);
      expect(px).toBeLessThanOrEqual(x + w);
      expect(py).toBeGreaterThanOrEqual(y);
      expect(py).toBeLessThanOrEqual(y + h);
    }
  }

  describe('the aim', () => {
    it('faces the viewer when the pointer is on the pivot', () => {
      expect(aimAt(0, 0, 1440, 900)).toEqual({ az: AZ0, el: EL0 });
    });

    it('turns left for a pointer on the left, and up for one above', () => {
      const left = aimAt(-400, 0, 1440, 900);
      const above = aimAt(0, -300, 1440, 900);
      expect(left.az).toBeGreaterThan(AZ0);
      expect(left.el).toBeCloseTo(EL0, 6);
      expect(above.el).toBeGreaterThan(EL0);
      expect(above.az).toBeCloseTo(AZ0, 6);
    });

    it('never turns past its reach, however far away the pointer is', () => {
      for (const [dx, dy] of [
        [-1e5, -1e5],
        [1e5, 1e5],
        [-1e5, 1e5],
        [1e5, -1e5],
      ]) {
        const aim = aimAt(dx, dy, 1440, 900);
        expect(Math.abs(aim.az - AZ0)).toBeLessThanOrEqual(REACH);
        expect(Math.abs(aim.el - EL0)).toBeLessThanOrEqual(REACH / 2);
      }
    });

    it('rests up and to the left, and arrives from a stow facing the viewer', () => {
      expect(REST.az).toBeGreaterThan(AZ0);
      expect(REST.el).toBeGreaterThan(STOW.el);
      expect(STOW.az).toBe(AZ0);
    });
  });

  describe('the drawing', () => {
    it('samples every aim it can take: the reach, rest, the stow and the survey', () => {
      const aims = reachable();
      for (const aim of [REST, STOW, ...SURVEY]) {
        expect(aims).toContain(aim);
      }
      const az = aims.map((a) => a.az);
      const el = aims.map((a) => a.el);
      expect(Math.min(...az)).toBeLessThanOrEqual(AZ0 - REACH);
      expect(Math.max(...el)).toBeGreaterThanOrEqual(EL0 + REACH / 2);
      expect(Math.min(...el)).toBeLessThanOrEqual(EL0 - REACH / 2);
    });

    it('keeps the dish inside the viewBox at every aim, including ones between the samples', () => {
      const aims: Aim[] = [
        ...reachable(),
        aimAt(-1e5, -1e5, 1440, 900),
        aimAt(1e5, 1e5, 1440, 900),
        aimAt(-220, -130, 1440, 900),
        aimAt(60, -500, 1440, 900),
      ];
      for (const aim of aims) {
        expectInside(drawn(geometry.pose(aim)));
      }
      expectInside(points(geometry.base.sil));
      expectInside([geometry.pivot as [number, number]]);
    });

    it('draws each arm on exactly one side of the dish', () => {
      for (const aim of reachable()) {
        const [a, b] = geometry.pose(aim).sides;
        expect(a.near).not.toBe(b.near);
      }
    });

    it('turns the dish with its aim, and draws the same aim the same way', () => {
      expect(geometry.pose(REST).outline).not.toBe(geometry.pose(STOW).outline);
      expect(geometry.pose({ ...REST }).outline).toBe(geometry.pose(REST).outline);
    });

    it('engraves a 36-mark azimuth scale with a larger mark every quarter turn', () => {
      expect(geometry.scale.length).toBe(36);
      expect(geometry.scale.filter((d) => d.major).length).toBe(4);
    });
  });
});
