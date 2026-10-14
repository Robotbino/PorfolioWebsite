import { DESTINATIONS } from '../destinations';
import { order } from '../constellation/constellation.figures';
import {
  CLIP,
  CameraPose,
  FIELD,
  Framing,
  PoseInput,
  RIG,
  Vec3,
  budgetDpr,
  cameraPose,
  fieldExtent,
  fieldPoints,
  fovY,
  framingScale,
  kelvinRgb,
  loopDistance,
  nearness,
  placeStar,
  project,
  projectionMatrix,
  sizeFactor,
  swingGainStep,
  viewMatrix,
} from './star-map.math';

const DEG = 180 / Math.PI;

/** A 1440×900 desktop with the figure box centred, as the stylesheet frames it. */
const DESKTOP: Framing = { canvasW: 1440, canvasH: 900, cx: 720, cy: 450, boxW: 520 };
/** A 375×812 phone with the box upper right (top 38%, left 62%). */
const PHONE: Framing = { canvasW: 375, canvasH: 812, cx: 375 * 0.62, cy: 812 * 0.38, boxW: 180 };

const pose = (input: Partial<PoseInput> = {}): CameraPose =>
  cameraPose({
    pointerX: 0,
    pointerY: 0,
    homeWeight: 1,
    frac: 0,
    swingDir: 1,
    swingGain: 1,
    entrance: 1,
    ...input,
  });

/** Where a world point lands on `framing`'s canvas for a pose. */
const screen = (p: Vec3, framing: Framing, input: Partial<PoseInput> = {}) =>
  project(p, viewMatrix(pose(input)), projectionMatrix(framing, CLIP.near, CLIP.far), framing);

describe('star map projection', () => {
  for (const [label, framing] of [
    ['desktop', DESKTOP],
    ['phone', PHONE],
  ] as const) {
    it(`draws every figure exactly on its 2D chart at rest (${label})`, () => {
      const s = framingScale(framing);
      for (const figure of order) {
        for (const star of figure.stars) {
          const world = placeStar(star.x, star.y, star.depth, s);
          const p = screen(world, framing);
          // The SVG draws the 300-unit chart into the box from its top-left.
          expect(p.x).toBeCloseTo(framing.cx + s * (star.x - 150), 2);
          expect(p.y).toBeCloseTo(framing.cy + s * (star.y - 150), 2);
          expect(sizeFactor(world[2], p.w)).toBeCloseTo(1, 5);
        }
      }
    });

    it(`puts the camera axis through the framing box (${label})`, () => {
      const p = screen([0, 0, 0], framing);
      expect(p.x).toBeCloseTo(framing.cx, 3);
      expect(p.y).toBeCloseTo(framing.cy, 3);
    });
  }

  it('keeps a star on its sight line at any depth', () => {
    const s = framingScale(DESKTOP);
    const flat = screen(placeStar(60, 90, 0, s), DESKTOP);
    for (const z of [-300, 0, 200]) {
      const p = screen(placeStar(60, 90, z / s, s), DESKTOP);
      expect(p.x).toBeCloseTo(flat.x, 2);
      expect(p.y).toBeCloseTo(flat.y, 2);
    }
  });

  it('shares the CSS camera: a 900px-tall view sees 31.4° vertically', () => {
    expect(fovY(900) * DEG).toBeCloseTo(31.42, 2);
  });

  it('shrinks the stars as the camera pulls back', () => {
    const s = framingScale(DESKTOP);
    const world = placeStar(150, 150, 0, s);
    const pulledBack = screen(world, DESKTOP, { entrance: 0 });
    expect(sizeFactor(world[2], pulledBack.w)).toBeCloseTo(1 / 1.3, 4);
  });

  it('dims only the stars behind their figure', () => {
    expect(nearness(40)).toBe(1);
    expect(nearness(0)).toBe(1);
    expect(nearness(-70)).toBeCloseTo(0.5, 10);
    expect(nearness(-140)).toBe(0);
  });
});

describe('cameraPose', () => {
  it('is face-on with no pull-back at both ends of a morph', () => {
    for (const frac of [0, 1]) {
      const p = pose({ frac });
      expect(p.yawSwing).toBeCloseTo(0, 10);
      expect(p.pitchSwing).toBeCloseTo(0, 10);
      expect(p.dolly).toBeCloseTo(1, 10);
    }
  });

  it('swings 15° aside and pulls back 15% halfway through a morph', () => {
    const p = pose({ frac: 0.5 });
    expect(p.yawSwing * DEG).toBeCloseTo(15, 6);
    expect(p.pitchSwing * DEG).toBeCloseTo(2, 6);
    expect(p.dolly).toBeCloseTo(1.15, 6);
    expect(pose({ frac: 0.5, swingDir: -1 }).yawSwing * DEG).toBeCloseTo(-15, 6);
  });

  it('is symmetric about the middle of a morph and flat at its ends', () => {
    expect(pose({ frac: 0.3 }).yawSwing).toBeCloseTo(pose({ frac: 0.7 }).yawSwing, 10);
    expect(pose({ frac: 0.3 }).dolly).toBeCloseTo(pose({ frac: 0.7 }).dolly, 10);
    expect(Math.abs(pose({ frac: 0.01 }).yawSwing * DEG)).toBeLessThan(0.02);
    expect(Math.abs(pose({ frac: 0.99 }).yawSwing * DEG)).toBeLessThan(0.02);
  });

  it('turns with the pointer at full strength at Home and 30% elsewhere', () => {
    expect(pose({ pointerX: 1 }).yawPointer * DEG).toBeCloseTo(4, 6);
    expect(pose({ pointerX: 1, homeWeight: 0 }).yawPointer * DEG).toBeCloseTo(1.2, 6);
    expect(pose({ pointerY: 1 }).pitchPointer * DEG).toBeCloseTo(-2.5, 6);
  });

  it('starts the entrance 30% further back', () => {
    expect(pose({ entrance: 0 }).dolly).toBeCloseTo(1.3, 10);
    expect(pose({ entrance: 1 }).dolly).toBe(1);
  });

  it('follows only the pointer when the swing gain is zero', () => {
    const p = pose({ frac: 0.5, swingGain: 0, pointerX: 1 });
    expect(p.yawSwing).toBe(0);
    expect(p.dolly).toBe(1);
    expect(p.yawPointer * DEG).toBeCloseTo(4, 6);
  });

  it('has a swing side for every destination', () => {
    expect(RIG.swingDir.length).toBe(DESTINATIONS.length);
  });
});

describe('the camera on screen', () => {
  const shift = (z: number, input: Partial<PoseInput>) => {
    const rest = screen([0, 0, z], DESKTOP);
    const moved = screen([0, 0, z], DESKTOP, input);
    return { x: moved.x - rest.x, y: moved.y - rest.y };
  };

  it('moves the figure with the pointer by about as much as the SVG parallax does', () => {
    const right = shift(0, { pointerX: 1 });
    expect(right.x).toBeGreaterThan(6);
    expect(right.x).toBeLessThan(10);
    expect(right.y).toBeCloseTo(0, 6);

    const down = shift(0, { pointerY: 1 });
    expect(down.y).toBeGreaterThan(3);
    expect(down.y).toBeLessThan(7);
  });

  it('pivots the pointer orbit in front of the figure, so the far field moves most', () => {
    expect(shift(RIG.pointerPivotZ, { pointerX: 1 }).x).toBeCloseTo(0, 2);
    const figure = shift(0, { pointerX: 1 }).x;
    const nearField = shift(FIELD.nearZ, { pointerX: 1 }).x;
    const farField = shift(FIELD.farZ, { pointerX: 1 }).x;
    expect(nearField).toBeGreaterThan(figure);
    expect(farField).toBeGreaterThan(nearField);
  });

  it('keeps the figure centre still while the camera swings around it', () => {
    for (const frac of [0.25, 0.5, 0.75]) {
      const p = screen([0, 0, 0], DESKTOP, { frac });
      expect(p.x).toBeCloseTo(DESKTOP.cx, 3);
      expect(p.y).toBeCloseTo(DESKTOP.cy, 3);
    }
  });
});

describe('fieldPoints', () => {
  const points = fieldPoints(FIELD.seed, FIELD.count);
  const column = (c: number) => Array.from({ length: FIELD.count }, (_, i) => points[i * 4 + c]);

  it('is the same sky on every visit, and a different one for another seed', () => {
    expect(fieldPoints(FIELD.seed, FIELD.count)).toEqual(points);
    expect(fieldPoints(FIELD.seed + 1, FIELD.count)).not.toEqual(points);
  });

  it('keeps every star inside its ranges', () => {
    for (const u of [...column(0), ...column(1)]) {
      expect(Math.abs(u)).toBeLessThanOrEqual(FIELD.spread);
    }
    for (const z of column(2)) {
      expect(z).toBeLessThanOrEqual(FIELD.nearZ);
      expect(z).toBeGreaterThanOrEqual(FIELD.farZ);
    }
    for (const b of column(3)) {
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(1);
    }
  });

  it('makes most stars faint', () => {
    const bright = column(3).sort((a, b) => a - b);
    expect(bright[FIELD.count >> 1]).toBeLessThan(0.3);
  });

  it('fills the far end as densely as the near end, so most stars sit in its back half', () => {
    const middle = (FIELD.nearZ + FIELD.farZ) / 2;
    const back = column(2).filter((z) => z < middle).length;
    expect(back / FIELD.count).toBeGreaterThan(0.6);
  });

  it('reaches at least as far as the view on every screen', () => {
    for (const framing of [DESKTOP, PHONE]) {
      const ext = fieldExtent(framing);
      expect(ext[0]).toBeGreaterThanOrEqual(framing.canvasW / 2 / 1600);
      expect(ext[1]).toBeGreaterThanOrEqual(framing.canvasH / 2 / 1600);
    }
  });

  it('keeps its boundary off screen at the height of a swing, with the pointer at any corner', () => {
    for (const framing of [DESKTOP, PHONE]) {
      const ext = fieldExtent(framing);
      const proj = projectionMatrix(framing, CLIP.near, CLIP.far);
      const edgeX = FIELD.spread * ext[0];
      const edgeY = FIELD.spread * ext[1];
      for (const swingDir of [1, -1] as const) {
        for (const pointerX of [-1, 1]) {
          for (const pointerY of [-1, 1]) {
            const view = viewMatrix(pose({ frac: 0.5, swingDir, pointerX, pointerY }));
            for (let z = FIELD.farZ; z <= FIELD.nearZ; z += 290) {
              const d = 1600 - z;
              for (const t of [-1, -0.5, 0, 0.5, 1]) {
                for (const side of [-1, 1]) {
                  // A point on the left or right boundary, wherever it is on screen vertically.
                  const across = project([side * edgeX * d, t * edgeY * d, z], view, proj, framing);
                  if (across.y > 0 && across.y < framing.canvasH) {
                    expect(side < 0 ? across.x : framing.canvasW - across.x).toBeLessThan(0);
                  }
                  // A point on the top or bottom boundary.
                  const down = project([t * edgeX * d, side * edgeY * d, z], view, proj, framing);
                  if (down.x > 0 && down.x < framing.canvasW) {
                    expect(side > 0 ? down.y : framing.canvasH - down.y).toBeLessThan(0);
                  }
                }
              }
            }
          }
        }
      }
    }
  });
});

describe('budgetDpr', () => {
  it('uses the device ratio up to the cap', () => {
    expect(budgetDpr(800, 600, 2, 2)).toBe(2);
    expect(budgetDpr(375, 812, 3, 1.5)).toBe(1.5);
    expect(budgetDpr(800, 600, 1, 2)).toBe(1);
  });

  it('lowers the ratio on large windows to stay within the pixel budget', () => {
    const dpr = budgetDpr(1440, 900, 2, 2);
    expect(dpr).toBeLessThan(2);
    expect(1440 * 900 * dpr * dpr).toBeCloseTo(3.5e6, -3);
  });

  it('never drops below 1', () => {
    expect(budgetDpr(3840, 2160, 2, 2)).toBe(1);
    expect(budgetDpr(800, 600, 0.75, 2)).toBe(1);
  });
});

describe('kelvinRgb', () => {
  it('runs from red-orange for cool stars to blue for hot ones', () => {
    const cool = kelvinRgb(3400);
    const sunlike = kelvinRgb(5600);
    const hot = kelvinRgb(30000);
    expect(cool[0]).toBeGreaterThan(cool[2]);
    expect(hot[2]).toBeGreaterThan(hot[0]);
    expect(Math.min(...sunlike)).toBeGreaterThan(215);
  });
});

describe('swing hold', () => {
  it('measures loop distance the short way round', () => {
    expect(loopDistance(0.1, 4.9, 5)).toBeCloseTo(0.2, 10);
    expect(loopDistance(2, 0, 5)).toBe(2);
    expect(loopDistance(5, 0, 5)).toBe(0);
  });

  it('never lets the visible swing grow while held', () => {
    let gain = 1;
    let swing = 0.2;
    for (const curve of [0.3, 0.6, 0.9, 1, 0.5, 0.1, 0.4]) {
      gain = swingGainStep(gain, true, curve, swing, 0.12);
      expect(curve * gain).toBeLessThanOrEqual(swing + 1e-12);
      swing = curve * gain;
    }
  });

  it('eases back to full once released', () => {
    let gain = 0;
    for (let i = 0; i < 200; i++) {
      gain = swingGainStep(gain, false, 0.5, 0, 0.12);
    }
    expect(gain).toBe(1);
  });
});
