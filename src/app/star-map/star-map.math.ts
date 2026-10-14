import { CAMERA_PERSPECTIVE_PX } from '../core/camera';
import { MAX_DEPTH } from '../constellation/constellation-depth';
import { easeToward } from '../motion.math';

/**
 * The star map's camera, projection and field, as pure functions: no DOM, no
 * WebGL. The component feeds in measurements and the renderer draws what comes
 * out, so every number that decides where a star lands is unit-tested here.
 *
 * World units are CSS pixels. The camera sits FOCAL px in front of the figure
 * plane (z = 0) with a vertical field of view of 2·atan((H/2)/FOCAL), which is
 * exactly the CSS perspective of the rest of the site, so z = -160 here and
 * translateZ(-160px) in a stylesheet are the same depth. See
 * docs/adr/0014-star-map-in-webgl-and-one-camera.md.
 */

export type Vec3 = [number, number, number];
/** A column-major 4×4 matrix, in the layout WebGL uniforms take. */
export type Mat4 = Float32Array;

/** Distance from the camera to the figure plane at rest, in CSS px. */
export const FOCAL = CAMERA_PERSPECTIVE_PX;

/** Side of the authored constellation charts, in figure units (their SVG viewBox). */
export const FIGURE_UNITS = 300;
const HALF_FIGURE = FIGURE_UNITS / 2;

const DEG = Math.PI / 180;

/** Clip planes, generous: nothing is depth-tested, so precision is irrelevant. */
export const CLIP = { near: 50, far: 20000 } as const;

/**
 * How the camera moves. The swing is the step aside during each morph; the
 * pointer orbit stands in for the hero's two-plane parallax.
 */
export const RIG = {
  pointerYawDeg: 4,
  pointerPitchDeg: 2.5,
  /** Pointer strength away from Home, as a share of its strength at Home. */
  pointerFloor: 0.3,
  /**
   * The pointer orbit pivots this far in front of the figure (CSS px), so the
   * figure drifts with the pointer by about 8px, as the SVG fallback's
   * parallax plane does, while the field behind it drifts several times further.
   */
  pointerPivotZ: 112,
  swingYawDeg: 15,
  swingPitchDeg: 2,
  /** Pull-back at the height of a swing, as a share of FOCAL. */
  swingDolly: 0.15,
  /** The entrance starts this many FOCALs back and settles to 1. */
  entranceDolly: 1.3,
  /**
   * Swing side per departing destination, alternating so successive morphs read
   * as a path. Five steps cannot alternate around a loop, so the two morphs
   * either side of the seam share a side.
   */
  swingDir: [1, -1, 1, -1, 1] as readonly (1 | -1)[],
} as const;

/** The background field, generated once in screen-relative units (see fieldPoints). */
export const FIELD = {
  seed: 0x5eed,
  /** Half-extent of u and v, in units of the view's half-width and half-height. */
  spread: 1.5,
  nearZ: -300,
  farZ: -3200,
  /** Point diameter in CSS px, faintest to brightest. */
  size: [1, 2.6] as readonly [number, number],
  /** Distance fog from camera (CSS px): full strength at the near end, `fogFloor` at the far. */
  fog: [1900, 4800] as readonly [number, number],
  fogFloor: 0.45,
  /** Brightness is t^exponent for uniform t, so most stars are faint. */
  brightnessExponent: 2.6,
  /**
   * Stars generated across the whole field. About a quarter are on screen at
   * once on a desktop (some 190); the rest is the margin the camera turns into.
   */
  count: 780,
  /** Phones and narrow windows: about 35 on screen, the margin is wider. */
  countCompact: 360,
} as const;

/** Device pixels the canvas may allocate before its pixel ratio is reduced. */
export const PIXEL_BUDGET = 3.5e6;

/**
 * Where the figure is framed on the canvas: the centre and width, in CSS px,
 * of the hidden box that carries the SVG constellation's box rules.
 */
export interface Framing {
  canvasW: number;
  canvasH: number;
  cx: number;
  cy: number;
  boxW: number;
}

/** CSS px per figure unit, as the SVG's viewBox scales into its box. */
export function framingScale(framing: Framing): number {
  return framing.boxW / FIGURE_UNITS;
}

/** Vertical field of view, in radians, for a canvas `canvasH` CSS px tall. */
export function fovY(canvasH: number): number {
  return 2 * Math.atan(canvasH / 2 / FOCAL);
}

/**
 * Perspective projection for the canvas, with the lens shifted so the camera
 * axis passes through the framing box's centre rather than the canvas centre.
 * Shifting the lens instead of turning the camera keeps the figure plane
 * parallel to the screen, which is what makes the rest pose land exactly on
 * the authored 2D chart wherever the box sits (upper right on phones).
 */
export function projectionMatrix(
  framing: Framing,
  near: number,
  far: number,
  out: Mat4 = new Float32Array(16),
): Mat4 {
  const { canvasW: w, canvasH: h } = framing;
  const tx = (framing.cx - w / 2) / (w / 2);
  const ty = -(framing.cy - h / 2) / (h / 2);
  out.fill(0);
  // 1/tan(fovY/2) is 2·FOCAL/h; dividing by the aspect gives 2·FOCAL/w.
  out[0] = (2 * FOCAL) / w;
  out[5] = (2 * FOCAL) / h;
  out[8] = -tx;
  out[9] = -ty;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

/**
 * World position of a star authored at (x, y) in figure units with `depth`
 * figure units toward the viewer, in a box scaled `s` px per unit.
 *
 * The star is slid along the line from the rest camera through its authored
 * point, so at rest it projects exactly where the flat chart draws it, at any
 * depth; only a camera move reveals how far apart the stars really are.
 */
export function placeStar(
  x: number,
  y: number,
  depth: number,
  s: number,
  out: Vec3 = [0, 0, 0],
): Vec3 {
  const z = s * depth;
  const along = (FOCAL - z) / FOCAL;
  out[0] = s * (x - HALF_FIGURE) * along;
  out[1] = s * (HALF_FIGURE - y) * along;
  out[2] = z;
  return out;
}

/**
 * How much bigger a star at world depth `z` draws than at rest, given its clip
 * w in the current pose: exactly 1 at rest, so the authored radii hold, and
 * smaller as the camera pulls back.
 */
export function sizeFactor(z: number, clipW: number): number {
  return (FOCAL - z) / clipW;
}

/**
 * 1 for a star on or in front of its figure's plane, falling to 0 at the
 * deepest a star may sit. Only stars behind the plane dim, so a shallow
 * figure keeps the SVG chart's full contrast.
 */
export function nearness(depth: number): number {
  return clamp01(1 + depth / MAX_DEPTH);
}

export interface PoseInput {
  /** Eased pointer, -1…1 across the window. */
  pointerX: number;
  pointerY: number;
  /** 1 at Home, 0 from half a destination away. */
  homeWeight: number;
  /** Progress through the current morph, 0…1. */
  frac: number;
  swingDir: 1 | -1;
  /** 0 holds the camera face-on whatever the morph does (a nav jump in flight). */
  swingGain: number;
  /** Entrance progress, 0…1. */
  entrance: number;
}

/**
 * The camera's orbit, in radians. Angles say where the camera goes, not how
 * the scene turns: positive yaw moves it to its right and positive pitch moves
 * it up, around the pivot in front of the figure (pointer) or the figure's
 * centre (swing). `dolly` scales its distance from the figure.
 */
export interface CameraPose {
  yawSwing: number;
  pitchSwing: number;
  yawPointer: number;
  pitchPointer: number;
  dolly: number;
}

/** How far into its swing the camera is for a morph at `frac`: sin²(π·frac). */
export function swingCurve(frac: number): number {
  const s = Math.sin(Math.PI * clamp01(frac));
  return s * s;
}

/**
 * The camera pose for one frame. The swing follows sin²(π·frac), which is zero
 * with zero slope at both ends of every morph, so the camera is face-on at each
 * destination and identical on both sides of the loop seam.
 */
export function cameraPose(
  input: PoseInput,
  out: CameraPose = { yawSwing: 0, pitchSwing: 0, yawPointer: 0, pitchPointer: 0, dolly: 1 },
): CameraPose {
  const swing = swingCurve(input.frac) * input.swingGain;
  const strength = RIG.pointerFloor + (1 - RIG.pointerFloor) * input.homeWeight;
  out.yawSwing = input.swingDir * RIG.swingYawDeg * DEG * swing;
  out.pitchSwing = RIG.swingPitchDeg * DEG * swing;
  out.yawPointer = RIG.pointerYawDeg * DEG * input.pointerX * strength;
  // Pointer down moves the camera down, so the figure follows the pointer down.
  out.pitchPointer = -RIG.pointerPitchDeg * DEG * input.pointerY * strength;
  out.dolly =
    (1 + RIG.swingDolly * swing) *
    (1 + (RIG.entranceDolly - 1) * (1 - easeOutExpo(clamp01(input.entrance))));
  return out;
}

const rotA = new Float64Array(9);
const rotB = new Float64Array(9);

/**
 * The view matrix for a pose:
 * V = T(0,0,−F·dolly) · [T(0,0,Zp)·Rx(pitchP)·Ry(−yawP)·T(0,0,−Zp)] · Rx(pitchS)·Ry(−yawS).
 * The swing pivots at the figure's centre so the morphing figure stays put; the
 * pointer pivots at Zp in front of it. The pose describes the camera and the
 * view applies the inverse of its motion: moving the camera right is Ry(+yaw),
 * so the view turns by −yaw, while moving it up is Rx(−pitch), so the view
 * turns by +pitch.
 */
export function viewMatrix(pose: CameraPose, out: Mat4 = new Float32Array(16)): Mat4 {
  const zp = RIG.pointerPivotZ;
  rotationXY(pose.pitchPointer, -pose.yawPointer, rotA);
  rotationXY(pose.pitchSwing, -pose.yawSwing, rotB);
  // Rotation part: A·B, written straight into the column-major output.
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out[c * 4 + r] =
        rotA[r * 3] * rotB[c] + rotA[r * 3 + 1] * rotB[3 + c] + rotA[r * 3 + 2] * rotB[6 + c];
    }
  }
  // Translation: A applied to (0, 0, −Zp), then the pivot and the dolly.
  out[12] = -zp * rotA[2];
  out[13] = -zp * rotA[5];
  out[14] = -zp * rotA[8] + zp - FOCAL * pose.dolly;
  out[3] = out[7] = out[11] = 0;
  out[15] = 1;
  return out;
}

/** Rx(pitch)·Ry(yaw), row-major. */
function rotationXY(pitch: number, yaw: number, out: Float64Array): void {
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  out[0] = cy;
  out[1] = 0;
  out[2] = sy;
  out[3] = sp * sy;
  out[4] = cp;
  out[5] = -sp * cy;
  out[6] = -cp * sy;
  out[7] = sp;
  out[8] = cp * cy;
}

/** A point projected to the canvas: CSS px from its top-left, and its clip w. */
export interface Projected {
  x: number;
  y: number;
  w: number;
}

/** Project a world point through `view` and `proj` onto the canvas. */
export function project(
  p: Readonly<Vec3>,
  view: Mat4,
  proj: Mat4,
  framing: Framing,
  out: Projected = { x: 0, y: 0, w: 0 },
): Projected {
  const vx = view[0] * p[0] + view[4] * p[1] + view[8] * p[2] + view[12];
  const vy = view[1] * p[0] + view[5] * p[1] + view[9] * p[2] + view[13];
  const vz = view[2] * p[0] + view[6] * p[1] + view[10] * p[2] + view[14];
  const cx = proj[0] * vx + proj[4] * vy + proj[8] * vz + proj[12];
  const cy = proj[1] * vx + proj[5] * vy + proj[9] * vz + proj[13];
  const cw = proj[3] * vx + proj[7] * vy + proj[11] * vz + proj[15];
  out.x = ((cx / cw + 1) * framing.canvasW) / 2;
  out.y = ((1 - cy / cw) * framing.canvasH) / 2;
  out.w = cw;
  return out;
}

/**
 * The background field: `n` stars as (u, v, z, brightness), deterministic per
 * seed so every visit sees the same sky.
 *
 * u and v are fractions of the view's tangent half-extents (see fieldExtent);
 * the vertex shader rebuilds world positions from them at each star's
 * distance, so the field fills any aspect ratio and a resize is only a
 * uniform. Distance is sampled on d³ because the view's cross-section grows
 * as d², which keeps the density even through the volume instead of
 * crowding the near end.
 */
export function fieldPoints(seed: number, n: number): Float32Array {
  const random = mulberry32(seed);
  const out = new Float32Array(n * 4);
  const nearCube = (FOCAL - FIELD.nearZ) ** 3;
  const farCube = (FOCAL - FIELD.farZ) ** 3;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    out[o] = (random() * 2 - 1) * FIELD.spread;
    out[o + 1] = (random() * 2 - 1) * FIELD.spread;
    const d = Math.cbrt(nearCube + random() * (farCube - nearCube));
    out[o + 2] = Math.min(FIELD.nearZ, Math.max(FIELD.farZ, FOCAL - d));
    out[o + 3] = random() ** FIELD.brightnessExponent;
  }
  return out;
}

// How far the camera can turn, in radians, at the height of a swing with the
// pointer at an edge. The field's boundary has to sit at least that far
// outside the view, measured as an angle: the camera rotates rather than
// slides, so the margin a turn uses up grows toward the edges of a wide view.
const FIELD_SWEEP_X = (RIG.swingYawDeg + RIG.pointerYawDeg) * DEG;
const FIELD_SWEEP_Y = (RIG.swingPitchDeg + RIG.pointerPitchDeg) * DEG;

/**
 * Tangent half-extents (x, y) that u = v = ±1 map to in the field shader. At
 * least the view's own, widened so the boundary at ±FIELD.spread stays off
 * screen through the lens shift, the camera's full turn and the swing's
 * pull-back (which shrinks the field's angular size by up to swingDolly).
 */
export function fieldExtent(
  framing: Framing,
  out: Float32Array = new Float32Array(2),
): Float32Array {
  const halfW = framing.canvasW / 2;
  const halfH = framing.canvasH / 2;
  const tanX = halfW / FOCAL;
  const tanY = halfH / FOCAL;
  const shiftX = Math.abs(framing.cx - halfW) / halfW;
  const shiftY = Math.abs(framing.cy - halfH) / halfH;
  const reach = (tan: number, shift: number, sweep: number) =>
    (Math.tan(Math.atan(tan * (1 + shift)) + sweep) * (1 + RIG.swingDolly)) / FIELD.spread;
  out[0] = Math.max(tanX, reach(tanX, shiftX, FIELD_SWEEP_X));
  // Turning sideways brings the near edge of the view closer by up to
  // tan·sin of the turn, which makes the field look taller there.
  const nearing = 1 + tanX * (1 + shiftX) * Math.sin(FIELD_SWEEP_X);
  out[1] = Math.max(tanY, reach(tanY, shiftY, FIELD_SWEEP_Y) * nearing);
  return out;
}

/**
 * Device pixel ratio for the canvas: the device's, capped (2, or 1.5 for touch,
 * where the stars are small and the GPU is shared with everything else), and
 * reduced on very large windows so the buffer stays within PIXEL_BUDGET. Never
 * below 1, where points and hairlines would blur.
 */
export function budgetDpr(cssW: number, cssH: number, deviceDpr: number, cap: number): number {
  const fit = Math.sqrt(PIXEL_BUDGET / Math.max(1, cssW * cssH));
  return Math.min(cap, Math.max(1, Math.min(deviceDpr, cap, fit)));
}

/**
 * Approximate blackbody colour for a temperature in kelvin, as 0–255 sRGB
 * (Tanner Helland's fit, good to a few percent between 1,000 and 40,000 K).
 */
export function kelvinRgb(kelvin: number, out: Vec3 = [0, 0, 0]): Vec3 {
  const t = kelvin / 100;
  out[0] = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  out[1] =
    t <= 66
      ? 99.4708025861 * Math.log(t) - 161.1195681661
      : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  out[2] = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  for (let i = 0; i < 3; i++) {
    out[i] = Math.min(255, Math.max(0, out[i]));
  }
  return out;
}

/** Distance between two loop positions the short way round, in destinations. */
export function loopDistance(a: number, b: number, count: number): number {
  if (count <= 0) {
    return Math.abs(a - b);
  }
  const d = a - b;
  return Math.abs(d - count * Math.round(d / count));
}

/**
 * The next swing gain. While `holding` (a nav jump is crossing several
 * destinations) the gain eases to 0, and is also capped so the visible swing,
 * `curve · gain`, never grows past last frame's: the morph sweeps through the
 * destinations in between, and an uncapped swing would whip one way, then the
 * other. Once released it eases back to 1.
 */
export function swingGainStep(
  gain: number,
  holding: boolean,
  curve: number,
  lastSwing: number,
  k: number,
): number {
  if (!holding) {
    return easeToward(gain, 1, k);
  }
  const eased = easeToward(gain, 0, k);
  return curve > 0 ? Math.min(eased, lastSwing / curve) : eased;
}

/** Fast out, long settle: the CSS --ease-out-expo, as a function of 0…1. */
export function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** Small, fast, seedable PRNG; plenty for scattering stars. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
