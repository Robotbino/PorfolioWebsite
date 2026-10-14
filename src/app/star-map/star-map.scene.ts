import { Link, Star } from '../constellation/constellation.model';
import { MAX_LINKS, STAR_COUNT } from '../constellation/constellation.figures';
import { StarMapPalette } from '../core/star-map-palette';
import {
  Framing,
  Projected,
  Vec3,
  clamp01,
  easeOutExpo,
  framingScale,
  kelvinRgb,
  nearness,
  placeStar,
  project,
  sizeFactor,
} from './star-map.math';

/**
 * One frame of the star map as plain numbers: the camera matrices and every
 * star and link already projected to CSS pixels. The scene builder below
 * writes it; the renderer only uploads it, so everything about where and how
 * bright things are is decided (and tested) here, outside WebGL.
 */
export interface StarMapScene {
  readonly view: Float32Array;
  readonly proj: Float32Array;
  /** Tangent half-extents the field's u and v scale by (see fieldExtent). */
  readonly fieldExtent: Float32Array;
  fieldOpacity: number;
  lineHalfWidth: number;
  /** STAR_STRIDE floats per star: centre x, y; core and halo radius; core and halo alpha; halo r, g, b (0–1). */
  readonly stars: Float32Array;
  /** LINK_STRIDE floats per slot: ends A and B (x, y); alpha at A and at B. */
  readonly links: Float32Array;
}

export const STAR_STRIDE = 9;
export const LINK_STRIDE = 6;
/** Two layers of link slots: the departing figure's lines, then the arriving one's. */
export const LINK_SLOTS = 2 * MAX_LINKS;

/** Entrance timings, in ms from the first frame; the SVG's draw-on, retimed. */
export const ENTRANCE = {
  dollyMs: 2400,
  starFadeMs: 1000,
  starStaggerMs: 70,
  linkDelayMs: 300,
  linkStaggerMs: 80,
  linkDrawMs: 1200,
  fieldFadeMs: 1200,
} as const;

/** When the last part of the entrance has landed. */
export const ENTRANCE_MS = Math.max(
  ENTRANCE.dollyMs,
  (STAR_COUNT - 1) * ENTRANCE.starStaggerMs + ENTRANCE.starFadeMs,
  ENTRANCE.linkDelayMs + (MAX_LINKS - 1) * ENTRANCE.linkStaggerMs + ENTRANCE.linkDrawMs,
  ENTRANCE.fieldFadeMs,
);

export function createScene(): StarMapScene {
  return {
    view: new Float32Array(16),
    proj: new Float32Array(16),
    fieldExtent: new Float32Array(2),
    fieldOpacity: 0,
    lineHalfWidth: 0.5,
    stars: new Float32Array(STAR_COUNT * STAR_STRIDE),
    links: new Float32Array(LINK_SLOTS * LINK_STRIDE),
  };
}

/** The morph state for one frame, as ConstellationComponent.renderAt reads it. */
export interface FigureFrame {
  /** The interpolated figure. */
  stars: readonly Star[];
  fromLinks: readonly Link[];
  toLinks: readonly Link[];
  frac: number;
  transit: number;
  /** Drift clock, in seconds. */
  time: number;
  /** 1 to drift, 0 for the still picture of reduced motion. */
  drift: number;
  /** Time since the entrance began, in ms; Infinity when it was skipped. */
  sinceEntrance: number;
}

/** Field fade-in at `since` ms into the entrance. */
export function entranceFieldOpacity(since: number): number {
  return easeOutExpo(clamp01(since / ENTRANCE.fieldFadeMs));
}

/** Entrance progress for the camera dolly, 0…1 (cameraPose applies the easing). */
export function entranceDollyProgress(since: number): number {
  return clamp01(since / ENTRANCE.dollyMs);
}

const world: Vec3 = [0, 0, 0];
const projected: Projected = { x: 0, y: 0, w: 0 };
const halo: Vec3 = [0, 0, 0];
const screenX = new Float64Array(STAR_COUNT);
const screenY = new Float64Array(STAR_COUNT);
const near = new Float64Array(STAR_COUNT);

/**
 * Project the figure into `scene.stars` and `scene.links`, using the scene's
 * current view and projection. The numbers shared with the SVG constellation
 * (drift, the 0.18 settle, the 0.5 link dim, the cross-fade) are
 * ConstellationComponent.renderAt's; change them together so the two read
 * the same.
 */
export function writeFigure(
  scene: StarMapScene,
  frame: FigureFrame,
  framing: Framing,
  palette: StarMapPalette,
): void {
  const s = framingScale(framing);
  const settle = 1 - 0.18 * frame.transit;
  const stars = scene.stars;

  for (let i = 0; i < STAR_COUNT; i++) {
    const star = frame.stars[i];
    const ox = frame.drift * star.amp * Math.sin(frame.time * 0.5 + star.phx);
    const oy = frame.drift * star.amp * Math.cos(frame.time * 0.4 + star.phy);
    placeStar(star.x + ox, star.y + oy, star.depth, s, world);
    project(world, scene.view, scene.proj, framing, projected);

    const fade = easeOutExpo(
      clamp01((frame.sinceEntrance - i * ENTRANCE.starStaggerMs) / ENTRANCE.starFadeMs),
    );
    near[i] = nearness(star.depth);
    // Stars behind their figure's plane dim a little, to 0.8 at the deepest.
    const alpha = fade * (0.8 + 0.2 * near[i]);
    const core = star.r * s * settle * sizeFactor(world[2], projected.w);
    haloColour(palette, star.temperature, halo);

    const o = i * STAR_STRIDE;
    screenX[i] = projected.x;
    screenY[i] = projected.y;
    stars[o] = projected.x;
    stars[o + 1] = projected.y;
    stars[o + 2] = core;
    // The SVG halo is a circle four times the core's radius.
    stars[o + 3] = core * 4;
    stars[o + 4] = alpha;
    stars[o + 5] = palette.haloAlpha * alpha;
    stars[o + 6] = halo[0] / 255;
    stars[o + 7] = halo[1] / 255;
    stars[o + 8] = halo[2] / 255;
  }

  // The SVG strokes its links 1 figure unit wide. Thinner than a pixel, a
  // coverage-antialiased line breaks up into uneven partial pixels, so narrow
  // boxes draw it a pixel wide and fade it by the difference: the same ink.
  const halfWidth = Math.max(0.5, 0.5 * s);
  scene.lineHalfWidth = halfWidth;
  const ink = palette.lineAlpha * ((0.5 * s) / halfWidth);
  const dim = 1 - 0.5 * frame.transit;
  writeLinks(scene.links, 0, frame.fromLinks, ink * dim * (1 - frame.frac), frame.sinceEntrance);
  writeLinks(scene.links, MAX_LINKS, frame.toLinks, ink * dim * frame.frac, frame.sinceEntrance);
}

function writeLinks(
  out: Float32Array,
  firstSlot: number,
  links: readonly Link[],
  opacity: number,
  sinceEntrance: number,
): void {
  for (let k = 0; k < MAX_LINKS; k++) {
    const o = (firstSlot + k) * LINK_STRIDE;
    if (k >= links.length || opacity <= 0) {
      out.fill(0, o, o + LINK_STRIDE);
      continue;
    }
    const { a, b } = links[k];
    // Drawn on from A toward B, as the SVG's dash offset draws them.
    const drawn = easeOutExpo(
      clamp01(
        (sinceEntrance - ENTRANCE.linkDelayMs - k * ENTRANCE.linkStaggerMs) / ENTRANCE.linkDrawMs,
      ),
    );
    const alphaA = opacity * depthFade(near[a]);
    const alphaB = opacity * depthFade(near[b]);
    out[o] = screenX[a];
    out[o + 1] = screenY[a];
    out[o + 2] = screenX[a] + (screenX[b] - screenX[a]) * drawn;
    out[o + 3] = screenY[a] + (screenY[b] - screenY[a]) * drawn;
    out[o + 4] = drawn > 0 ? alphaA : 0;
    out[o + 5] = drawn > 0 ? alphaA + (alphaB - alphaA) * drawn : 0;
  }
}

/** Links into the back of a figure fade to 0.6, a touch more than its stars. */
function depthFade(near01: number): number {
  return 0.6 + 0.4 * near01;
}

/** The palette halo, leaned toward the star's blackbody colour by `palette.tint`. */
export function haloColour(palette: StarMapPalette, kelvin: number, out: Vec3): Vec3 {
  kelvinRgb(kelvin, out);
  const t = palette.tint;
  for (let c = 0; c < 3; c++) {
    out[c] = palette.halo[c] + (out[c] - palette.halo[c]) * t;
  }
  return out;
}
