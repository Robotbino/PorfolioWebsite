import { byRoute } from '../constellation/constellation.figures';
import { Constellation } from '../constellation/constellation.model';
import { starMapPalette } from '../core/star-map-palette';
import {
  CLIP,
  Framing,
  Vec3,
  cameraPose,
  framingScale,
  kelvinRgb,
  projectionMatrix,
  viewMatrix,
} from './star-map.math';
import {
  ENTRANCE_MS,
  FigureFrame,
  LINK_STRIDE,
  STAR_STRIDE,
  StarMapScene,
  createScene,
  entranceFieldOpacity,
  haloColour,
  writeFigure,
} from './star-map.scene';

const DESKTOP: Framing = { canvasW: 1440, canvasH: 900, cx: 720, cy: 450, boxW: 520 };
const PHONE: Framing = { canvasW: 375, canvasH: 812, cx: 232.5, cy: 308.56, boxW: 180 };
const DARK = starMapPalette(true);

/** A scene with the camera at rest on `framing`. */
function restScene(framing: Framing): StarMapScene {
  const scene = createScene();
  const pose = cameraPose({
    pointerX: 0,
    pointerY: 0,
    homeWeight: 1,
    frac: 0,
    swingDir: 1,
    swingGain: 1,
    entrance: 1,
  });
  viewMatrix(pose, scene.view);
  projectionMatrix(framing, CLIP.near, CLIP.far, scene.proj);
  return scene;
}

/** Ursa Major on its own, settled, entrance over, no drift. */
function still(figure: Constellation = byRoute.home, overrides: Partial<FigureFrame> = {}) {
  return {
    stars: figure.stars,
    fromLinks: figure.links,
    toLinks: figure.links,
    frac: 0,
    transit: 0,
    time: 0,
    drift: 0,
    sinceEntrance: Infinity,
    ...overrides,
  } satisfies FigureFrame;
}

const star = (scene: StarMapScene, i: number) => scene.stars.subarray(i * STAR_STRIDE);
const link = (scene: StarMapScene, slot: number) => scene.links.subarray(slot * LINK_STRIDE);

describe('writeFigure', () => {
  it('draws each star where the SVG chart put it, at its authored size', () => {
    const scene = restScene(DESKTOP);
    writeFigure(scene, still(), DESKTOP, DARK);
    const s = framingScale(DESKTOP);

    byRoute.home.stars.forEach((authored, i) => {
      const [x, y, core, halo, alpha] = star(scene, i);
      expect(x).toBeCloseTo(DESKTOP.cx + s * (authored.x - 150), 2);
      expect(y).toBeCloseTo(DESKTOP.cy + s * (authored.y - 150), 2);
      expect(core).toBeCloseTo(authored.r * s, 4);
      expect(halo).toBeCloseTo(core * 4, 4);
      expect(alpha).toBeGreaterThanOrEqual(0.8);
      expect(alpha).toBeLessThanOrEqual(1);
    });
  });

  it('shrinks the stars as the morph speeds up, as the SVG settle does', () => {
    const scene = restScene(DESKTOP);
    writeFigure(scene, still(), DESKTOP, DARK);
    const atRest = star(scene, 0)[2];
    writeFigure(scene, still(byRoute.home, { transit: 0.5 }), DESKTOP, DARK);
    expect(star(scene, 0)[2]).toBeCloseTo(atRest * 0.91, 4);
  });

  it('cross-fades the departing figure’s lines into the arriving one’s', () => {
    const scene = restScene(DESKTOP);
    const frame = still(byRoute.home, { toLinks: byRoute.work.links, frac: 0.25 });
    writeFigure(scene, frame, DESKTOP, DARK);

    // Alpha at each layer's first A end: the palette's line alpha, the layer's
    // share of the cross-fade, and the depth fade of the star it starts from.
    const departingA = byRoute.home.links[0].a;
    const arrivingA = byRoute.work.links[0].a;
    expect(link(scene, 0)[4]).toBeCloseTo(DARK.lineAlpha * 0.75 * depthFadeAt(departingA), 6);
    expect(link(scene, 8)[4]).toBeCloseTo(DARK.lineAlpha * 0.25 * depthFadeAt(arrivingA), 6);
  });

  it('leaves the slots a figure does not use empty', () => {
    const scene = restScene(DESKTOP);
    writeFigure(scene, still(), DESKTOP, DARK);
    // Ursa Major has seven lines; its eighth slot and the hidden arriving layer are blank.
    expect(Array.from(link(scene, 7).subarray(0, LINK_STRIDE))).toEqual([0, 0, 0, 0, 0, 0]);
    expect(link(scene, 8)[4]).toBe(0);
  });

  it('keeps a phone’s hairlines at half a pixel and fades them to the same ink', () => {
    const scene = restScene(PHONE);
    writeFigure(scene, still(), PHONE, DARK);
    const s = framingScale(PHONE);
    expect(scene.lineHalfWidth).toBe(0.5);
    const [, , , , alphaA] = link(scene, 0);
    expect(alphaA).toBeLessThanOrEqual(DARK.lineAlpha * s + 1e-6);
  });

  it('starts the entrance from nothing and lands it complete', () => {
    const scene = restScene(DESKTOP);
    writeFigure(scene, still(byRoute.home, { sinceEntrance: 0 }), DESKTOP, DARK);
    for (let i = 0; i < 8; i++) {
      expect(star(scene, i)[4]).toBe(0);
      expect(star(scene, i)[5]).toBe(0);
    }
    const [ax, ay, bx, by, alphaA] = link(scene, 0);
    expect([bx, by]).toEqual([ax, ay]);
    expect(alphaA).toBe(0);
    expect(entranceFieldOpacity(0)).toBe(0);

    writeFigure(scene, still(byRoute.home, { sinceEntrance: ENTRANCE_MS }), DESKTOP, DARK);
    expect(star(scene, 7)[4]).toBeGreaterThanOrEqual(0.8);
    expect(link(scene, 6)[4]).toBeGreaterThan(0);
    expect(entranceFieldOpacity(ENTRANCE_MS)).toBe(1);
  });

  it('drifts the stars only when drift is on', () => {
    const scene = restScene(DESKTOP);
    writeFigure(scene, still(byRoute.home, { time: 3 }), DESKTOP, DARK);
    const fixed = star(scene, 0)[0];
    writeFigure(scene, still(byRoute.home, { time: 3, drift: 1 }), DESKTOP, DARK);
    expect(star(scene, 0)[0]).not.toBeCloseTo(fixed, 1);
  });
});

describe('haloColour', () => {
  const out: Vec3 = [0, 0, 0];

  it('is the palette halo exactly when the tint is off', () => {
    const light = starMapPalette(false);
    expect(haloColour(light, 3400, out)).toEqual([...light.halo]);
  });

  it('leans a cool star’s halo toward red in dark mode', () => {
    const [r, , b] = haloColour(DARK, 3400, out);
    const blackbody = kelvinRgb(3400);
    expect(r).toBeCloseTo(DARK.halo[0] + (blackbody[0] - DARK.halo[0]) * DARK.tint, 6);
    expect(r).toBeGreaterThan(DARK.halo[0]);
    expect(b).toBeLessThan(DARK.halo[2]);
  });
});

/** The link depth fade at Ursa Major's star `i`: 0.6 at the deepest, 1 on or before the plane. */
function depthFadeAt(i: number): number {
  const depth = byRoute.home.stars[i].depth;
  return 0.6 + 0.4 * Math.min(1, Math.max(0, 1 + depth / 140));
}
