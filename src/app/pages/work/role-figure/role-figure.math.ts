import {
  Cam,
  Projector,
  ScreenPoint,
  WorldPoint,
  facing,
  fillet,
  fit,
  open,
  poly,
  prism,
  proj,
  r2,
  rad,
  rings,
  seg,
} from './role-figure.iso';

/**
 * Plates 01–03: the figure under the SITA positions, as pure geometry. Three
 * glass photographic plates stand in the groove of a ruled ledge, one exposed
 * each time a position began. Every plate holds the same field, and one target
 * has crept up and to the right between exposures. The scale on the ledge's
 * front edge is engraved only up to now, and the ledge runs on empty to the
 * next June.
 *
 * It is a port of docs/hairline/plates/plates.js, built with the same kernel
 * functions and the same constants under the same names, so a change made with
 * Hairline carries straight across. Only the plates ever move, and only
 * straight up: under a parallel projection that is a plain translateY of the
 * seated drawing, so every path here is computed once and CSS does the motion.
 */

// The camera: off the 2:1 diagonal, so the ledge reads as a wide band.
const AZIMUTH = 25;
const ELEVATION_K = 0.5;
const SCALE = 1.06;

// The ledge: depth, height, corner radius, crease inset, and how far it runs
// past its last year mark. Its length follows the calendar.
const D = 22;
const LH = 8;
const LR = 6;
const B = 1.6;
const TAIL = 32;

// The calendar: x of the first June, world units per year.
const X0 = 40;
const YEAR = 76;

// A plate: width, height, thickness, corner radius, lean (negative leans back),
// and where its face meets the groove.
const W = 48;
const H = 40;
const TK = 2.5;
const R = 3;
const LEAN = -12;
const YB = 12.5;

/** The lift the bench slider's top end reaches; the camera is fitted to it, as on the bench. */
const LIFT_MAX = 26;

/** A picked plate's lift, in world units: the bench slider's middle. */
export const LIFT = 18;

/** At rest the newest plate stands half lifted, being measured now. */
export const REST_LIFT = LIFT / 2;

/** How far each plate falls into the groove as the figure enters. */
export const DROP = 14;

/** Lift by distance from the picked plate: a floor, so the reach is clamped. */
export const FALL: readonly number[] = [1, 0.31, 0.09];

/** The stagger, per plate of distance from the one picked or let go. */
export const STEP_MS = 45;

const SN = Math.sin(rad(LEAN));
const CS = Math.cos(rad(LEAN));

/** Room round the drawing for a 1px stroke. */
const PAD = 2;

export interface PlateGeometry {
  /** The plate's back edge, showing its thickness. */
  readonly back: string;
  readonly face: string;
  /** The two reference marks every plate shares. */
  readonly field: string;
  /** The mark that moved. */
  readonly target: string;
}

export interface FigureGeometry {
  readonly viewBox: string;
  readonly ledge: { readonly sil: string; readonly crease: string };
  readonly groove: string;
  readonly years: string;
  readonly quarters: string;
  /** The one mark that runs off the top and down over the lip. */
  readonly now: string;
  /** Seated, oldest first: the order they are painted in, back to front. */
  readonly plates: readonly PlateGeometry[];
  /** Screen units per world unit of lift: negative, because a lift moves up. */
  readonly liftPx: number;
}

const MONTH = new Intl.DateTimeFormat('en-GB', {
  year: 'numeric',
  month: '2-digit',
  timeZone: 'Africa/Johannesburg',
});

/** The date's year and month in Pretoria, as 'YYYY-MM'. */
export function yearMonthIn(date: Date): string {
  const parts = MONTH.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)!.value;
  return `${part('year')}-${part('month')}`;
}

/** Whole months from one 'YYYY-MM' to another. */
export function monthsBetween(from: string, to: string): number {
  const index = (ym: string) => {
    const [year, month] = ym.split('-').map(Number);
    return year * 12 + month - 1;
  };
  return index(to) - index(from);
}

/** The position lines run newest first; the plates run oldest first. */
export const plateIndex = (line: number, count: number): number => count - 1 - line;

/** Plate i's lift with `picked` chosen, or at rest when nothing is. */
export function liftFor(picked: number | null, i: number, count: number): number {
  if (picked === null) {
    return i === count - 1 ? REST_LIFT : 0;
  }
  return LIFT * FALL[Math.min(Math.abs(i - picked), FALL.length - 1)];
}

/** The delay that spreads a change outwards from the plate picked, or the one let go. */
export const delayMs = (origin: number, i: number): number => Math.abs(i - origin) * STEP_MS;

/** The x of a month on the scale, counted from the first June. */
const mx = (m: number) => X0 + (m * YEAR) / 12;

/** A plate's outline in its own plane, u across and v up, with n code notches cut into its top edge by the right-hand corner. */
function outline(n: number): ScreenPoint[] {
  const pts: ScreenPoint[] = [
    [0, 0],
    [W, 0],
    [W, H],
  ];
  const radii = [R, R, R];
  for (let k = 0; k < n; k++) {
    const u = W - 8 - k * 4.4;
    pts.push([u + 1.5, H], [u, H - 2.4], [u - 1.5, H]);
    radii.push(0.5, 0.6, 0.5);
  }
  pts.push([0, H]);
  radii.push(R);
  return fillet(pts, radii);
}

type PlanePoint = (u: number, v: number) => ScreenPoint;

/** An open reticle: four short strokes round a centre left empty, never a dot. */
const reticle = (w: PlanePoint, cu: number, cv: number): string =>
  [
    [-3, 0, -1.2, 0],
    [1.2, 0, 3, 0],
    [0, -3, 0, -1.2],
    [0, 1.2, 0, 3],
  ]
    .map(([a, b, c, d]) => seg(w(cu + a, cv + b), w(cu + c, cv + d)))
    .join('');

/** Plate i, centred on month m and lifted by z, in the plate's own plane and behind it. */
function planes(P: Projector, m: number, z: number): { w: PlanePoint; wb: PlanePoint } {
  const x0 = mx(m) - W / 2;
  return {
    w: (u, v) => P(x0 + u, YB + v * SN, LH + v * CS + z),
    wb: (u, v) => P(x0 + u, YB + v * SN - TK * CS, LH + v * CS + TK * SN + z),
  };
}

function plate(P: Projector, i: number, m: number): PlateGeometry {
  const shape = outline(i + 1);
  const { w, wb } = planes(P, m, 0);
  return {
    back: poly(shape.map((p) => wb(p[0], p[1]))),
    face: poly(shape.map((p) => w(p[0], p[1]))),
    field: reticle(w, 11, 29) + reticle(w, 37, 11),
    target: reticle(w, 20 + 5 * i, 15 + 3 * i),
  };
}

/**
 * The whole figure for these positions (newest first, as work-data.ts lists
 * them) on the month `now` ('YYYY-MM'). Each plate stands on the month its
 * position began, counted from the first; the ledge always runs on to the next
 * June after the newest plate and after now.
 */
export function figureGeometry(
  positions: readonly { readonly start: string }[],
  now: string,
): FigureGeometry {
  const first = positions[positions.length - 1].start;
  const months = positions.map((p) => monthsBetween(first, p.start)).reverse();
  const nowMonth = Math.max(0, monthsBetween(first, now));
  const lastMonth = 12 * (Math.floor(Math.max(months[months.length - 1], nowMonth) / 12) + 1);
  const L = mx(lastMonth) + TAIL;

  // Fitted exactly as the bench fits it, so the paths match the bench page's.
  const C = Cam(AZIMUTH, ELEVATION_K, SCALE);
  const tops = (z: number): WorldPoint[] =>
    months.flatMap((m) =>
      [-1, 1].map((s): WorldPoint => [mx(m) + (s * W) / 2, YB + H * SN - TK * CS, LH + H * CS + z]),
    );
  fit(
    C,
    [[0, 0, 0], [L, D, 0], [L, 0, 0], [0, D, 0], [0, 0, LH], [L, D, LH], ...tops(LIFT_MAX)],
    200,
    166,
  );
  const P = proj(C);
  const front = facing(C);

  const [ring, inner] = rings(0, 0, L, D, LR, B);
  const ledge = prism(P, front, ring, inner, 0, LH);
  const groove = open([P(4, YB - TK / 2, LH), P(L - 4, YB - TK / 2, LH)]);

  const yF = D - B;
  let years = '';
  let quarters = '';
  for (let m = 0; m <= lastMonth; m += 3) {
    if (m % 12 === 0) {
      years += seg(P(mx(m), yF, LH), P(mx(m), yF - 7, LH));
    } else if (m < nowMonth) {
      quarters += seg(P(mx(m), yF, LH), P(mx(m), yF - 3.5, LH));
    }
  }
  const nowMark = open([
    P(mx(nowMonth), yF - 7, LH),
    P(mx(nowMonth), D, LH),
    P(mx(nowMonth), D, 2.5),
  ]);

  const plates = months.map((m, i) => plate(P, i, m));
  const liftPx = P(0, 0, 1)[1] - P(0, 0, 0)[1];

  // Cropped to the drawing at its tallest: the ledge, and every plate at the
  // highest it ever reaches, a pick or the entrance's drop onto its rest.
  const reach = (i: number) => Math.max(LIFT, liftFor(null, i, months.length) + DROP);
  const extent: ScreenPoint[] = [
    ...[0, LH].flatMap((z) => ring.map((q) => P(q.u, q.v, z))),
    P(mx(nowMonth), D, 2.5),
    ...months.flatMap((m, i) => {
      const { w, wb } = planes(P, m, reach(i));
      return outline(i + 1).flatMap((p) => [w(p[0], p[1]), wb(p[0], p[1])]);
    }),
  ];
  const xs = extent.map((p) => p[0]);
  const ys = extent.map((p) => p[1]);
  const x = Math.min(...xs) - PAD;
  const y = Math.min(...ys) - PAD;
  const viewBox = [x, y, Math.max(...xs) + PAD - x, Math.max(...ys) + PAD - y].map(r2).join(' ');

  return { viewBox, ledge, groove, years, quarters, now: nowMark, plates, liftPx };
}
