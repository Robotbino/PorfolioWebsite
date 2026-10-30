/**
 * Plates: three glass photographic plates standing in the groove of a ruled
 * ledge, one exposed each June. Every plate holds the same field, and one
 * target has crept up and to the right between exposures: proper motion. The
 * pointer lifts the plate under it out of the groove; its neighbours rise less,
 * staggered outwards from it. The scale on the front edge is engraved only up
 * to now, and the ledge runs on empty to where a fourth plate would stand. Each
 * plate's number is cut into its top edge as code notches, the way sheet film
 * is coded. The slider is the lift.
 *
 * The pattern: discrete items, Riffle's, held still in a row. Only lifts move,
 * so every pose is the rest drawing translated straight up.
 */
const {
  Cam, clamp, facing, fillet, fit, open, poly, prism, proj, rad, rings, seg,
  tdone, tset, tval, tween, disposer, mk, pointer, put, register, solid,
} = HL;

// the ledge: length, depth, height, corner radius, crease inset
const L = 300, D = 22, LH = 8, LR = 6, B = 1.6;
// the calendar: x of month 0, world units per year, the month the scale is engraved up to
const X0 = 40, YEAR = 76, NOW = 28;
// a plate: width, height, thickness, corner radius, lean (negative leans back), where its face meets the groove
const W = 48, H = 40, TK = 2.5, R = 3, LEAN = -12, YB = 12.5;
const N = 3, STEP = 45, FALL = [1, 0.31, 0.09], LIFT_MAX = 26;
const SN = Math.sin(rad(LEAN)), CS = Math.cos(rad(LEAN));

/** The x of a month on the scale, counted from the first June. */
const mx = (m) => X0 + (m * YEAR) / 12;

/** A plate's outline in its own plane, u across and v up, with n code notches cut into its top edge by the right-hand corner. */
function outline(n) {
  const pts = [[0, 0], [W, 0], [W, H]], radii = [R, R, R];
  for (let k = 0; k < n; k++) {
    const u = W - 8 - k * 4.4;
    pts.push([u + 1.5, H], [u, H - 2.4], [u - 1.5, H]);
    radii.push(0.5, 0.6, 0.5);
  }
  pts.push([0, H]);
  radii.push(R);
  return fillet(pts, radii);
}

/** An open reticle: four short strokes round a centre left empty, never a dot. */
const reticle = (w, cu, cv) =>
  [[-3, 0, -1.2, 0], [1.2, 0, 3, 0], [0, -3, 0, -1.2], [0, 1.2, 0, 3]]
    .map(([a, b, c, d]) => seg(w(cu + a, cv + b), w(cu + c, cv + d))).join("");

/** Plate i lifted by z: its back, its face, the field every plate shares, and the target that moved. */
function pose(P, i, shape, z) {
  const x0 = mx(12 * i) - W / 2;
  const w = (u, v) => P(x0 + u, YB + v * SN, LH + v * CS + z);
  const wb = (u, v) => P(x0 + u, YB + v * SN - TK * CS, LH + v * CS + TK * SN + z);
  return {
    back: poly(shape.map((p) => wb(p[0], p[1]))),
    face: poly(shape.map((p) => w(p[0], p[1]))),
    field: reticle(w, 11, 29) + reticle(w, 37, 11),
    target: reticle(w, 20 + 5 * i, 15 + 3 * i),
  };
}

/** The ledge, which never moves: its body, the groove, the year marks, the quarters engraved so far, and now. */
function ledge(P, front, g) {
  const [ring, inner] = rings(0, 0, L, D, LR, B);
  put(solid(g), prism(P, front, ring, inner, 0, LH));
  mk("path", { d: open([P(4, YB - TK / 2, LH), P(L - 4, YB - TK / 2, LH)]), class: "nf lo" }, g);
  const yF = D - B;
  let year = "", quarter = "";
  for (let m = 0; m <= 36; m += 3) {
    if (m % 12 === 0) year += seg(P(mx(m), yF, LH), P(mx(m), yF - 7, LH));
    else if (m < NOW) quarter += seg(P(mx(m), yF, LH), P(mx(m), yF - 3.5, LH));
  }
  mk("path", { d: year, class: "nf" }, g);
  mk("path", { d: quarter, class: "nf lo" }, g);
  // now: the one mark that runs off the top and down over the lip
  mk("path", { d: open([P(mx(NOW), yF - 7, LH), P(mx(NOW), D, LH), P(mx(NOW), D, 2.5)]), class: "nf sil" }, g);
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let lift = clamp(value, 10, LIFT_MAX), act = -1;

  // The camera turns off the 2:1 diagonal so the ledge reads as a wide band; it is fitted with every plate at full lift.
  const C = Cam(25, 0.5, 1.06);
  const tops = [0, 1, 2].flatMap((i) => [-1, 1].map((s) =>
    [mx(12 * i) + (s * W) / 2, YB + H * SN - TK * CS, LH + H * CS + LIFT_MAX]));
  fit(C, [[0, 0, 0], [L, D, 0], [L, 0, 0], [0, D, 0], [0, 0, LH], [L, D, LH], ...tops], 200, 166);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  ledge(P, front, g);

  const rest = (i) => (i === N - 1 ? lift / 2 : 0);
  const plates = [];
  for (let i = 0; i < N; i++) {
    const grp = mk("g", {}, g);
    plates.push({
      shape: outline(i + 1),
      back: mk("path", { class: "lo" }, grp),
      face: mk("path", { class: "sil" }, grp),
      field: mk("path", { class: "nf lo" }, grp),
      target: mk("path", { class: "nf" }, grp),
      z: tween(rest(i)),
      drawn: null,
    });
  }

  function draw(p, i, z) {
    const q = pose(P, i, p.shape, z);
    p.back.setAttribute("d", q.back);
    p.face.setAttribute("d", q.face);
    p.field.setAttribute("d", q.field);
    p.target.setAttribute("d", q.target);
    p.drawn = z;
  }
  plates.forEach((p, i) => draw(p, i, rest(i)));

  // hit bands: the plates' seated centres on screen. They never move, and nothing draws them.
  const cx = plates.map((_, i) => P(mx(12 * i), YB + (H / 2) * SN, LH + (H / 2) * CS)[0]);
  const reach = (cx[1] - cx[0]) * 0.55;
  /** The plate nearest the pointer's x, or -1 past the ends of the row. */
  function hit([x]) {
    let a = -1, best = reach;
    cx.forEach((c, i) => {
      if (Math.abs(x - c) < best) { best = Math.abs(x - c); a = i; }
    });
    return a;
  }

  const loop = register(stage, (_dt, now) => {
    let moving = false;
    plates.forEach((p, i) => {
      const z = tval(p.z, now);
      if (z !== p.drawn) draw(p, i, z);
      if (!tdone(p.z, now)) moving = true;
    });
    return moving;
  });
  bag.add(loop.unregister);

  /** Lifts plate a (-1 is rest: the newest half up). The stagger spreads out from the plate picked, or the one let go. */
  function setActive(a, again) {
    if (a === act && !again) return;
    const now = performance.now(), from = a >= 0 ? a : act >= 0 ? act : N - 1;
    act = a;
    plates.forEach((p, i) => {
      tset(p.z, a < 0 ? rest(i) : lift * FALL[Math.abs(i - a)], now, Math.abs(i - from) * STEP);
      p.face.classList.toggle("hi", i === (a < 0 ? N - 1 : a));
    });
    read.textContent = a < 0 ? "rest" : String(2024 + a);
    loop.wake();
  }
  setActive(-1, true);

  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { lift = clamp(v, 10, LIFT_MAX); setActive(act, true); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "plates",
  means: "Three photographic plates, one a year, on a ledge ruled up to now: the pointer lifts a plate and its neighbours rise less.",
  rules: [1, 2, 3, 5],
  range: [10, 18, 26],
  tour: [[96, 146], [168, 163], [241, 180], null],
  mount,
});
