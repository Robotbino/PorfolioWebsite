import {
  Cam,
  Projector,
  RingSample,
  ScreenPoint,
  circ,
  facing,
  fit,
  hull,
  open,
  poly,
  prism,
  proj,
  r2,
  rad,
  ringAt,
  rings,
  rrect,
  run,
  seg,
} from '../../../shared/hairline/hairline.iso';

/**
 * Listening: the radio dish in Contact's bottom corner, as pure geometry. A
 * base plate engraved with an azimuth scale, a turntable with an index dot, a
 * yoke whose arms hold the elevation axis, and the dish on two trunnions with
 * a feed horn on three struts at its focus. An aim is an azimuth and an
 * elevation; `pose` turns one into every path the dish draws at it.
 *
 * It is a port of docs/hairline/listening/listening.js, itself adapted from
 * the Dish of @lucasmarkes/hairline (MIT, (c) 2026 Lucas Marques), with the
 * same constants under the same names. Unlike the role figure, an aim turns
 * the dish, so its outline is recomputed at every pose: the rim circle
 * projected, and the hull of the rim and the back.
 */

type Vec3 = readonly [number, number, number];

// The dish: rim radius, focal length, skin, depth, the elevation axis's
// height, the yoke's half-span and arm thickness, the turntable's top and the
// beam's top.
const R = 26;
const FOC = 17;
const SK = 1.4;
const DEP = (R * R) / (4 * FOC);
const ZE = 46;
const W = 31;
const T = 5;
const ZB = 10;
const ZY = 16;
const PIV: Vec3 = [0, 0, ZE];
const BACK = [0, 0.35, 0.6, 0.78, 0.9, 0.97, 1];
const SCALE = 2.5;

export interface Aim {
  /** Azimuth, in degrees: 45 faces the viewer, higher turns it to the left. */
  readonly az: number;
  /** Elevation, in degrees above the horizon. */
  readonly el: number;
}

/** Straight at the viewer, the aim a pointer on the pivot gives. */
export const AZ0 = 45;
export const EL0 = 40;

/** How far a pointer can turn it from straight on: the bench slider's middle. */
export const REACH = 50;

/** At rest it listens up and to the left, at the sky over the page. */
export const REST: Aim = { az: 100, el: 44 };

/** Before it arrives: facing the viewer and tipped down, stowed. */
export const STOW: Aim = { az: 45, el: 12 };

/** Left alone, it surveys the sky over the page, a stop at a time, then rests. */
export const SURVEY: readonly Aim[] = [
  { az: 88, el: 64 },
  { az: 62, el: 56 },
  { az: 106, el: 58 },
];

/**
 * How far across the screen the aim spreads: a pointer this fraction of the
 * viewport away from the pivot turns the dish about three quarters of its
 * reach.
 */
const AIM_SPREAD = 0.35;

/** The aim a pointer gives, from its offset in px from the pivot on screen and the viewport's size. */
export function aimAt(dx: number, dy: number, width: number, height: number): Aim {
  return {
    az: AZ0 - REACH * Math.tanh(dx / (AIM_SPREAD * width)),
    el: EL0 + (REACH / 2) * Math.tanh(-dy / (AIM_SPREAD * height)),
  };
}

export interface Solid {
  readonly sil: string;
  readonly crease: string;
}

export interface SidePose {
  /** Whether this side's outer face looks at the viewer: it then paints after the dish. */
  readonly near: boolean;
  /** The bearing ring round the trunnion. */
  readonly ring: string;
  readonly arm: Solid;
  readonly trunnion: string;
}

export interface DishPose {
  /** The turntable's index dot. */
  readonly index: ScreenPoint;
  readonly beam: Solid;
  readonly sides: readonly [SidePose, SidePose];
  readonly outline: string;
  /** A panel seam, seen through the aperture. */
  readonly seam: string;
  /** The hub at the dish's vertex, seen through the aperture. */
  readonly hub: string;
  /** The dish's one bright line. */
  readonly rim: string;
  readonly struts: string;
  readonly feed: Solid;
}

export interface ScaleDot {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
  /** Every ninth mark, a quarter turn, is larger. */
  readonly major: boolean;
}

export interface DishGeometry {
  /** Cropped to every pose the dish can reach, so nothing ever leaves it. */
  readonly viewBox: string;
  readonly base: Solid;
  readonly scale: readonly ScaleDot[];
  readonly turntable: Solid;
  /** The index dot's radii: a dot lying on the turntable. */
  readonly indexR: readonly [number, number];
  /** The pivot on screen, in viewBox units: where an aim is measured from. */
  readonly pivot: ScreenPoint;
  readonly pose: (aim: Aim) => DishPose;
}

const ax = (p: Vec3, q: Vec3, s: number): Vec3 => [
  p[0] + q[0] * s,
  p[1] + q[1] * s,
  p[2] + q[2] * s,
];
const dot3 = (p: Vec3, q: Vec3) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];

interface Frame {
  readonly h: Vec3;
  /** The elevation axis. */
  readonly e: Vec3;
  /** The dish's axis. */
  readonly a: Vec3;
  /** The rim's up. */
  readonly u: Vec3;
}

/** An aim's frame: h and e on the ground, a the dish's axis, u the rim's up. */
function frame(aim: Aim): Frame {
  const t = rad(aim.az),
    f = rad(aim.el),
    c = Math.cos(f),
    s = Math.sin(f);
  const h: Vec3 = [Math.cos(t), Math.sin(t), 0];
  const e: Vec3 = [-Math.sin(t), Math.cos(t), 0];
  return { h, e, a: [h[0] * c, h[1] * c, s], u: [-h[0] * s, -h[1] * s, c] };
}

/** A point of the dish: `along` its axis from the rim's centre, rho out from it at angle psi. */
const onDish = (F: Frame, along: number, rho: number, psi: number): Vec3 =>
  ax(ax(ax(PIV, F.a, along), F.e, rho * Math.cos(psi)), F.u, rho * Math.sin(psi));

/** A circle of n points about centre c, in the plane of x and y. */
const disc = (c: Vec3, x: Vec3, y: Vec3, r: number, n: number): Vec3[] =>
  Array.from({ length: n }, (_, i) =>
    ax(ax(c, x, r * Math.cos((2 * Math.PI * i) / n)), y, r * Math.sin((2 * Math.PI * i) / n)),
  );

/** A ring drawn in the (h, e) frame turned onto the ground. */
const turn = (ring: readonly RingSample[], F: Frame): RingSample[] =>
  ring.map((q) => ({
    u: q.u * F.h[0] + q.v * F.e[0],
    v: q.u * F.h[1] + q.v * F.e[1],
    nu: q.nu * F.h[0] + q.nv * F.e[0],
    nv: q.nu * F.h[1] + q.nv * F.e[1],
  }));

/**
 * Every aim the dish can take, sampled: whatever a pointer can give, rest, the
 * stow and the survey. The viewBox is cropped to these, so nothing ever leaves
 * it, and no wider, so the dish is as large as its corner allows.
 */
export function reachable(): Aim[] {
  const all = [REST, STOW, ...SURVEY];
  const az = [AZ0 - REACH, ...all.map((a) => a.az)];
  const el = [EL0 - REACH / 2, EL0 + REACH / 2, ...all.map((a) => a.el)];
  const span = (v: number[], k: number) => {
    const lo = Math.min(...v),
      hi = Math.max(...v);
    return Array.from({ length: k }, (_, i) => lo + ((hi - lo) * i) / (k - 1));
  };
  const out: Aim[] = [...all];
  for (const a of span(az, 9)) {
    for (const e of span(el, 7)) {
      out.push({ az: a, el: e });
    }
  }
  return out;
}

/** Room round the drawing for a 1px stroke. */
const PAD = 2;

/** The dish, built once: its static base and the function that poses the rest. */
export function dishGeometry(): DishGeometry {
  // Fitted exactly as the bench fits it, so the paths match the bench page's.
  const C = Cam(45, 0.5, SCALE);
  const fitted: Vec3[] = [
    [-30, -30, 0],
    [30, 30, 0],
    [30, -30, 0],
    [-30, 30, 0],
  ];
  for (const aim of [
    { az: -25, el: 5 },
    { az: -25, el: 75 },
    { az: 115, el: 5 },
    { az: 115, el: 75 },
    REST,
  ]) {
    const F = frame(aim);
    fitted.push(...disc(PIV, F.e, F.u, R, 16), onDish(F, FOC - DEP + 3, 0, 0));
    for (const s of [-1, 1]) fitted.push(ax(ax(PIV, F.e, s * (W + T / 2)), [0, 0, 1], 6));
  }
  fit(C, fitted, 200, 166);
  const P: Projector = proj(C);
  const front = facing(C);
  const Pv = (q: Vec3) => P(q[0], q[1], q[2]);

  // The direction toward the camera, from the projection itself.
  const o = P(0, 0, 0),
    cx = P(1, 0, 0),
    cy = P(0, 1, 0),
    cz = P(0, 0, 1);
  const r1 = [cx[0] - o[0], cy[0] - o[0], cz[0] - o[0]];
  const r2v = [cx[1] - o[1], cy[1] - o[1], cz[1] - o[1]];
  const cross = [
    r1[1] * r2v[2] - r1[2] * r2v[1],
    r1[2] * r2v[0] - r1[0] * r2v[2],
    r1[0] * r2v[1] - r1[1] * r2v[0],
  ];
  const vl = Math.hypot(...cross) * Math.sign(cross[2]);
  const VD: Vec3 = [cross[0] / vl, cross[1] / vl, cross[2] / vl];

  // Static: the base, its azimuth scale, the turntable.
  const [br, bi] = rings(-30, -30, 30, 30, 9, 2);
  const base = prism(P, front, br, bi, 0, 5);
  const scale: ScaleDot[] = Array.from({ length: 36 }, (_, i) => {
    const t = (i / 36) * 2 * Math.PI,
      major = i % 9 === 0,
      r = major ? 26.5 : 25.5,
      dotR = major ? 0.75 : 0.5,
      [x, y] = P(r * Math.cos(t), r * Math.sin(t), 5);
    return { cx: r2(x), cy: r2(y), rx: r2(dotR * SCALE), ry: r2(dotR * SCALE * 0.5), major };
  });
  const turntable = prism(P, front, circ(20, 48), circ(18.8, 48), 5, ZB);

  const yb = W + T / 2 + 1;
  const [bmr, bmi] = rings(-9, -yb, 9, yb, 4, 1.4);
  const sideRings = [-1, 1].map((s) => ({
    s,
    foot: rrect(-8, s * W - T / 2, 8, s * W + T / 2, 2.5, 4),
    top: rrect(-5.5, s * W - T / 2, 5.5, s * W + T / 2, 2.5, 4),
    inner: rrect(-4.5, s * W - T / 2 + 1, 4.5, s * W + T / 2 - 1, 1.5, 4),
  }));

  /** The seam at rho: the run of it seen through the aperture, its ends cut where the sight line meets the rim. */
  function seen(F: Frame, rho: number, n: number): string {
    const along = (rho * rho) / (4 * FOC) - DEP,
      t = -along / dot3(F.a, VD),
      q: Vec3[] = [],
      s: number[] = [];
    for (let i = 0; i < n; i++) {
      q.push(onDish(F, along, rho, (2 * Math.PI * i) / n));
      const hit = ax(q[i], VD, t);
      s.push(R - Math.hypot(hit[0] - PIV[0], hit[1] - PIV[1], hit[2] - PIV[2]));
    }
    if (s.every((x) => x > 0)) return poly(q.map(Pv));
    const i0 = s.findIndex((x, i) => x > 0 && s[(i + n - 1) % n] <= 0);
    if (i0 < 0) return '';
    const cut = (i: number, j: number) =>
      Pv(ax(q[i], [q[j][0] - q[i][0], q[j][1] - q[i][1], q[j][2] - q[i][2]], s[i] / (s[i] - s[j])));
    const out = [cut((i0 + n - 1) % n, i0)];
    let i = i0;
    while (s[i] > 0) {
      out.push(Pv(q[i]));
      i = (i + 1) % n;
    }
    out.push(cut((i + n - 1) % n, i));
    return open(out);
  }

  function pose(aim: Aim): DishPose {
    const F = frame(aim);
    const zz: Vec3 = [0, 0, 1];
    const sides = sideRings.map(({ s, foot, top, inner }): SidePose => {
      const out = ax(PIV, F.e, s * (W + T / 2));
      return {
        near: s * dot3(F.e, VD) > 0,
        ring: poly(disc(out, F.h, zz, 3.4, 24).map(Pv)),
        arm: {
          sil: poly(hull(ringAt(P, turn(foot, F), ZY).concat(ringAt(P, turn(top, F), ZE + 6)))),
          crease: open(ringAt(P, run(turn(inner, F), front), ZE + 6)),
        },
        trunnion: poly(
          hull(
            disc(ax(PIV, F.e, s * R), F.h, zz, 2.2, 16)
              .concat(disc(ax(PIV, F.e, s * (W - T / 2)), F.h, zz, 2.2, 16))
              .map(Pv),
          ),
        ),
      };
    }) as [SidePose, SidePose];
    // The bowl's outline is the hull of the rim and the back, a skin SK thick.
    const lip = disc(PIV, F.e, F.u, R, 72);
    const back: Vec3[] = [];
    for (const f of BACK) {
      for (let i = 0; i < 40; i++) {
        back.push(onDish(F, (f * f * R * R) / (4 * FOC) - DEP - SK, f * R, (2 * Math.PI * i) / 40));
      }
    }
    const mouth = onDish(F, FOC - DEP - 3, 0, 0),
      tail = onDish(F, FOC - DEP + 3, 0, 0);
    const index = P(18 * F.h[0], 18 * F.h[1], ZB);
    return {
      index: [r2(index[0]), r2(index[1])],
      beam: prism(P, front, turn(bmr, F), turn(bmi, F), ZB, ZY),
      sides,
      outline: poly(hull(lip.concat(back).map(Pv))),
      seam: seen(F, 0.62 * R, 48),
      hub: seen(F, 3.2, 20),
      rim: poly(lip.map(Pv)),
      struts: [90, 210, 330].map((d) => seg(Pv(onDish(F, 0, R, rad(d))), Pv(mouth))).join(''),
      feed: {
        sil: poly(
          hull(
            disc(mouth, F.e, F.u, 3.6, 16)
              .concat(disc(tail, F.e, F.u, 2.4, 16))
              .map(Pv),
          ),
        ),
        crease: poly(disc(tail, F.e, F.u, 1.3, 16).map(Pv)),
      },
    };
  }

  // Cropped to the drawing at every pose it can reach.
  const numbers = (d: string) => (d.match(/-?[\d.]+/g) ?? []).map(Number);
  const xs: number[] = [];
  const ys: number[] = [];
  const add = (d: string) => {
    const n = numbers(d);
    for (let i = 0; i + 1 < n.length; i += 2) {
      xs.push(n[i]);
      ys.push(n[i + 1]);
    }
  };
  add(base.sil);
  for (const aim of reachable()) {
    const p = pose(aim);
    [p.outline, p.feed.sil, ...p.sides.flatMap((s) => [s.arm.sil, s.ring, s.trunnion])].forEach(
      add,
    );
  }
  const x = Math.min(...xs) - PAD;
  const y = Math.min(...ys) - PAD;
  const viewBox = [x, y, Math.max(...xs) + PAD - x, Math.max(...ys) + PAD - y].map(r2).join(' ');

  const pivot = P(0, 0, ZE);
  return {
    viewBox,
    base,
    scale,
    turntable,
    indexR: [r2(0.8 * SCALE), r2(0.8 * SCALE * 0.5)],
    pivot: [r2(pivot[0]), r2(pivot[1])],
    pose,
  };
}
