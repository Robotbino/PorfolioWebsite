/**
 * Hairline's continuous clock: one spring per moving number, k 100 · c 18 ·
 * m 1, sub-stepped at 240 Hz so a long frame can't make it overshoot. A
 * continuous input (where the pointer is) gets a spring rather than a timed
 * ease, because its target moves every frame and an ease would always be
 * chasing it. Reduced motion is the caller's business here: a component that
 * must not animate sets `x` to `t` itself.
 *
 * Vendored from @lucasmarkes/hairline 0.5.1, packages/hairline/src/core/motion.ts
 * (spring and stepS only), unchanged apart from the reduced-motion flag.
 * MIT License, Copyright (c) 2026 Lucas Marques: the full notice is in
 * hairline.iso.ts.
 */

export interface Spring {
  /** Where it is. */
  x: number;
  v: number;
  /** Where it is going: write this to retarget. */
  t: number;
  readonly k: number;
  readonly c: number;
  readonly m: number;
  /** When it counts as settled. */
  readonly eps: number;
}

export interface SpringOptions {
  readonly k?: number;
  readonly c?: number;
  readonly m?: number;
  readonly eps?: number;
}

/** A spring at rest on x. */
export function spring(x: number, o: SpringOptions = {}): Spring {
  return { x, v: 0, t: x, k: o.k ?? 100, c: o.c ?? 18, m: o.m ?? 1, eps: o.eps ?? 0.01 };
}

/** Advances a spring by dt seconds toward `sp.t`. Returns whether it is still moving. */
export function stepS(sp: Spring, dt: number): boolean {
  const n = Math.max(1, Math.ceil(dt * 240)),
    h = dt / n;
  for (let i = 0; i < n; i++) {
    const a = (-sp.k * (sp.x - sp.t) - sp.c * sp.v) / sp.m;
    sp.v += a * h;
    sp.x += sp.v * h;
  }
  if (Math.abs(sp.x - sp.t) < sp.eps && Math.abs(sp.v) < sp.eps * 10) {
    sp.x = sp.t;
    sp.v = 0;
    return false;
  }
  return true;
}
