/**
 * The Toolset orbit's geometry: one perspective projection that both draws the
 * ring lines and generates every logo's keyframes, so a logo sits on its line at
 * every point of its lap by construction. Pure and DOM-free, like motion.math,
 * so the clearances the picture depends on are checked by specs rather than by
 * eye. See docs/adr/0015-toolset-orbit-in-perspective.md.
 *
 * Every length is in stage units (cqi): the stage is 100 wide and 75 tall (4:3),
 * so the same numbers serve the SVG viewBox, the inline rest pose and, times the
 * stage's pixels per unit, the keyframes.
 */

export interface OrbitGeometry {
  /** Tilt of the ring plane away from the viewer; 0 would be face-on. */
  readonly inclinationDeg: number;
  /** Turn of the tilted plane in the picture, toward the black hole's own disk. */
  readonly azimuthDeg: number;
  /** Distance from the camera to the plane through the orbit centre. */
  readonly cameraCqi: number;
  /** Where the rings are centred; the stylesheet places every logo box here. */
  readonly centre: { readonly x: number; readonly y: number };
  /** A logo's box before perspective; the stylesheet's clamp() uses the same 6cqi. */
  readonly iconCqi: number;
  /** Centre of the black hole's shadow; the two theme crops share one composition. */
  readonly hole: { readonly x: number; readonly y: number };
  /** Outer edge of the bright ring around the shadow, which a logo must never cover. */
  readonly photonRingCqi: number;
  /** Room a logo's contact shadow needs below and around its box. */
  readonly shadowMarginCqi: number;
}

/**
 * The hole and photon-ring figures are measured from the pocket crops: the
 * shadow is centred near (50, 36) with a radius of about 8, and the bright ring
 * reaches 11 to 12.7 depending on the side. The inclination and azimuth follow
 * the disk in the image, whose near side crosses below the shadow from upper
 * left to lower right.
 */
export const ORBIT = {
  inclinationDeg: 52,
  azimuthDeg: 20,
  cameraCqi: 240,
  centre: { x: 50, y: 35 },
  iconCqi: 6,
  hole: { x: 50, y: 36 },
  photonRingCqi: 12,
  shadowMarginCqi: 2,
} as const satisfies OrbitGeometry;

/**
 * Two rings, four logos inside and six outside. The outer radius is as large as
 * the stage allows: its left-most logo and shadow end within a unit of the edge.
 * The inner radius is what is left between two limits measured at 720 angles:
 * at 28 a logo's box still clears the photon ring (13.1 from the hole centre)
 * and the closest boxes on the two rings, where the azimuth turns the gap
 * between them diagonal in the upper right, stay 0.77 apart. At 31 those boxes
 * would overlap by half a unit.
 */
export const RINGS = {
  inner: { radius: 28, periodMs: 52000 },
  outer: { radius: 44, periodMs: 96000 },
} as const;

export type RingName = keyof typeof RINGS;

/**
 * Keyframes per lap: divisible by eight and by six, so every logo's slot (odd
 * eighths inside, sixths outside) lands exactly on a frame.
 */
export const ORBIT_SAMPLES = 72;

/** A ring point as drawn: stage position, perspective scale, and depth (-1 far … 1 near). */
export interface OrbitPoint {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly depth: number;
}

/** A logo's inline style at one point of its lap. */
export interface OrbitPose {
  readonly transform: string;
  readonly opacity: string;
}

const RAD = Math.PI / 180;

/**
 * Projects the point at `angle` on a ring of `radius` through the camera. The
 * ring is a circle in its own plane; tilting it puts the half at positive
 * angles toward the viewer (positive z), which lands below the centre, larger
 * and brighter. The turn by the azimuth happens in the picture plane, so it
 * leaves depth alone.
 */
export function projectOrbit(angle: number, radius: number, g: OrbitGeometry = ORBIT): OrbitPoint {
  const tilt = g.inclinationDeg * RAD;
  const turn = g.azimuthDeg * RAD;
  const x = radius * Math.cos(angle);
  const y = radius * Math.sin(angle) * Math.cos(tilt);
  const z = radius * Math.sin(angle) * Math.sin(tilt);
  const turnedX = x * Math.cos(turn) - y * Math.sin(turn);
  const turnedY = x * Math.sin(turn) + y * Math.cos(turn);
  const scale = g.cameraCqi / (g.cameraCqi - z);
  const reach = radius * Math.sin(tilt);
  return {
    x: g.centre.x + scale * turnedX,
    y: g.centre.y + scale * turnedY,
    scale,
    depth: reach === 0 ? 0 : z / reach,
  };
}

/**
 * The ring angle of a logo starting at `slot` (a fraction of a lap) once it
 * has travelled `lap` more. Angles decrease with time, which on a y-down screen
 * is counter-clockwise: from the right end the logos rise over the far side.
 */
export function angleAt(slot: number, lap = 0): number {
  return -2 * Math.PI * (slot + lap);
}

/** Far logos dim to 72%, so depth reads without any logo fading out of legibility. */
export function depthOpacity(depth: number): number {
  return 0.72 + (0.28 * (depth + 1)) / 2;
}

/** The pose at the start of a slot, in stage units from the orbit centre. */
export function restStyle(slot: number, radius: number): OrbitPose {
  const p = projectOrbit(angleAt(slot), radius);
  return {
    transform:
      `translate(${fixed(p.x - ORBIT.centre.x)}cqi, ${fixed(p.y - ORBIT.centre.y)}cqi) ` +
      `scale(${fixed(p.scale)})`,
    opacity: fixed(depthOpacity(p.depth)),
  };
}

/** The ring line as an SVG path in the stage's 100 × 75 viewBox. */
export function ringPath(radius: number, samples = 120): string {
  const points: string[] = [];
  for (let i = 0; i < samples; i++) {
    const p = projectOrbit(angleAt(0, i / samples), radius);
    points.push(`${fixed(p.x)} ${fixed(p.y)}`);
  }
  return `M ${points.join(' L ')} Z`;
}

/**
 * End points for the ring's stroke gradient: its far point to its near point,
 * so the line fades as it recedes, the same cue the logos get from opacity.
 */
export function ringGradient(radius: number): { x1: number; y1: number; x2: number; y2: number } {
  const far = projectOrbit(-Math.PI / 2, radius);
  const near = projectOrbit(Math.PI / 2, radius);
  return {
    x1: round(far.x),
    y1: round(far.y),
    x2: round(near.x),
    y2: round(near.y),
  };
}

/**
 * One lap of a ring as Web Animations keyframes, starting at angle 0. Offsets
 * are left implicit (evenly spaced) and the easing between frames is linear, so
 * a logo crosses each 5° chord at the ring's steady speed and strays at most a
 * quarter of a pixel from the true curve on the largest (480px) stage. The
 * translations are in pixels (`unitPx` per stage unit) because the compositor
 * needs absolute lengths; the component regenerates them when the stage
 * resizes. The closing frame is a copy of the first, so the loop has no seam.
 */
export function orbitKeyframes(
  radius: number,
  unitPx: number,
  samples = ORBIT_SAMPLES,
): Keyframe[] {
  const frames: Keyframe[] = [];
  for (let i = 0; i < samples; i++) {
    const p = projectOrbit(angleAt(0, i / samples), radius);
    frames.push({
      transform:
        `translate(${fixed((p.x - ORBIT.centre.x) * unitPx)}px, ` +
        `${fixed((p.y - ORBIT.centre.y) * unitPx)}px) scale(${fixed(p.scale)})`,
      opacity: round(depthOpacity(p.depth)),
    });
  }
  frames.push({ ...frames[0] });
  return frames;
}

/** Three decimals keeps every value within a hundredth of a pixel; `|| 0` drops "-0". */
function round(n: number): number {
  return Math.round(n * 1000) / 1000 || 0;
}

function fixed(n: number): string {
  return String(round(n));
}
