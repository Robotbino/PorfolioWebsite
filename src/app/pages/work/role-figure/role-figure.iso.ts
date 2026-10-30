/**
 * The static geometry of Hairline's kernel, typed: the camera, the rounded
 * solids and the path strings, and nothing else. The figure was designed with
 * Hairline (docs/hairline/plates/), and these are the functions its source
 * calls to draw. The loop, the springs, the pointer and the styles stay behind:
 * the role figure only ever translates, so CSS does its motion. See
 * docs/adr/0016-experience-role-figure.md.
 *
 * Vendored from @lucasmarkes/hairline 0.5.1, packages/hairline/src/core/iso.ts,
 * unchanged apart from the types.
 *
 * MIT License. Copyright (c) 2026 Lucas Marques.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/** A screen point in viewBox units: x to the right, y down. */
export type ScreenPoint = readonly [number, number];

/** A world point: x and y on the ground, z up. */
export type WorldPoint = readonly [number, number, number];

/** One sample of a rounded outline, with the outward normal it faces. */
export interface RingSample {
  readonly u: number;
  readonly v: number;
  readonly nu: number;
  readonly nv: number;
}

/** A parallel camera: azimuth in radians, k = sin(elevation), scale and origin. */
export interface Camera {
  readonly az: number;
  readonly k: number;
  readonly S: number;
  ox: number;
  oy: number;
}

export type Projector = (x: number, y: number, z: number) => ScreenPoint;

export const rad = (d: number): number => (d * Math.PI) / 180;

/** Two decimals: the precision every path string is written at. */
export const r2 = (n: number): number => Math.round(n * 100) / 100;

/** A closed path string. */
export const poly = (pts: readonly ScreenPoint[]): string =>
  'M' + pts.map((p) => r2(p[0]) + ' ' + r2(p[1])).join('L') + 'Z';

/** One segment between two screen points, as its own subpath. */
export const seg = (a: ScreenPoint, b: ScreenPoint): string =>
  `M${r2(a[0])} ${r2(a[1])}L${r2(b[0])} ${r2(b[1])}`;

/** An open polyline string. */
export const open = (pts: readonly ScreenPoint[]): string =>
  pts.length < 2 ? '' : 'M' + pts.map((p) => r2(p[0]) + ' ' + r2(p[1])).join('L');

export const Cam = (azDeg: number, k: number, S: number): Camera => ({
  az: rad(azDeg),
  k,
  S,
  ox: 0,
  oy: 0,
});

/** The camera's projection: P(x, y, z) gives [sx, sy]. */
export function proj(C: Camera): Projector {
  const c = Math.cos(C.az),
    s = Math.sin(C.az),
    zf = Math.sqrt(1 - C.k * C.k);
  return (x, y, z) => {
    const X = x * c - y * s,
      Y = x * s + y * c;
    return [C.ox + C.S * X, C.oy + C.S * (Y * C.k - z * zf)];
  };
}

/** Centres the box of `pts` on (cx, cy). It only centres; it never scales. */
export function fit(C: Camera, pts: readonly WorldPoint[], cx: number, cy: number): void {
  C.ox = 0;
  C.oy = 0;
  const P = proj(C);
  let a = 1e9,
    b = -1e9,
    c = 1e9,
    d = -1e9;
  for (const p of pts) {
    const q = P(p[0], p[1], p[2]);
    a = Math.min(a, q[0]);
    b = Math.max(b, q[0]);
    c = Math.min(c, q[1]);
    d = Math.max(d, q[1]);
  }
  C.ox = cx - (a + b) / 2;
  C.oy = cy - (c + d) / 2;
}

/** A rounded rectangle, as a ring of samples with n steps round each corner. */
export function rrect(
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  r: number,
  n = 4,
): RingSample[] {
  r = Math.max(0, Math.min(r, (u1 - u0) / 2, (v1 - v0) / 2));
  const out: RingSample[] = [];
  for (const [cu, cv, a0] of [
    [u1 - r, v1 - r, 0],
    [u0 + r, v1 - r, 90],
    [u0 + r, v0 + r, 180],
    [u1 - r, v0 + r, 270],
  ]) {
    for (let k = 0; k <= n; k++) {
      const a = rad(a0 + (90 * k) / n),
        ca = Math.cos(a),
        sa = Math.sin(a);
      out.push({ u: cu + r * ca, v: cv + r * sa, nu: ca, nv: sa });
    }
  }
  return out;
}

/** The convex hull of screen points. */
export function hull(input: readonly ScreenPoint[]): ScreenPoint[] {
  const pts = input.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const x = (o: ScreenPoint, a: ScreenPoint, b: ScreenPoint) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: ScreenPoint[] = [],
    up: ScreenPoint[] = [];
  for (const p of pts) {
    while (lo.length > 1 && x(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop();
    lo.push(p);
  }
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (up.length > 1 && x(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop();
    up.push(p);
  }
  lo.pop();
  up.pop();
  return lo.concat(up);
}

/** The ring's points, projected at height z. */
export const ringAt = (P: Projector, ring: readonly RingSample[], z: number): ScreenPoint[] =>
  ring.map((q) => P(q.u, q.v, z));

/** Whether a ring sample faces the camera. */
export const facing = (C: Camera): ((q: RingSample) => boolean) => {
  const s = Math.sin(C.az),
    c = Math.cos(C.az);
  return (q) => q.nu * s + q.nv * c >= -1e-6;
};

/** The one cyclic run of samples that pass `keep`. */
export function run(ring: readonly RingSample[], keep: (q: RingSample) => boolean): RingSample[] {
  const n = ring.length;
  let s = -1;
  for (let i = 0; i < n; i++) {
    if (keep(ring[i]) && !keep(ring[(i + n - 1) % n])) {
      s = i;
      break;
    }
  }
  if (s < 0) return keep(ring[0]) ? ring.slice() : [];
  const out: RingSample[] = [];
  for (let k = 0; k < n && keep(ring[(s + k) % n]); k++) out.push(ring[(s + k) % n]);
  return out;
}

/** A solid standing from z0 to z1: its silhouette and its one crease, as path strings. */
export function prism(
  P: Projector,
  front: (q: RingSample) => boolean,
  ring: readonly RingSample[],
  inner: readonly RingSample[] | null,
  z0: number,
  z1: number,
): { sil: string; crease: string } {
  return {
    sil: poly(hull(ringAt(P, ring, z1).concat(ringAt(P, ring, z0)))),
    crease: inner ? open(ringAt(P, run(inner, front), z1)) : '',
  };
}

/** A rounded footprint and its crease ring, inset by b. */
export const rings = (
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: number,
  b: number,
): [RingSample[], RingSample[]] => [
  rrect(x0, y0, x1, y1, r),
  rrect(x0 + b, y0 + b, x1 - b, y1 - b, Math.max(0.3, r - b)),
];

/** Rounds every vertex of a closed polygon, one radius per vertex, n steps round each. */
export function fillet(pts: readonly ScreenPoint[], rs: readonly number[], n = 4): ScreenPoint[] {
  const m = pts.length,
    out: ScreenPoint[] = [];
  for (let i = 0; i < m; i++) {
    const a = pts[(i + m - 1) % m],
      p = pts[i],
      b = pts[(i + 1) % m];
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]),
      lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const t = Math.min(rs[i], la / 2, lb / 2);
    const p1 = [p[0] + ((a[0] - p[0]) / la) * t, p[1] + ((a[1] - p[1]) / la) * t];
    const p2 = [p[0] + ((b[0] - p[0]) / lb) * t, p[1] + ((b[1] - p[1]) / lb) * t];
    for (let k = 0; k <= n; k++) {
      const s = k / n,
        w = 1 - s;
      out.push([
        w * w * p1[0] + 2 * w * s * p[0] + s * s * p2[0],
        w * w * p1[1] + 2 * w * s * p[1] + s * s * p2[1],
      ]);
    }
  }
  return out;
}
