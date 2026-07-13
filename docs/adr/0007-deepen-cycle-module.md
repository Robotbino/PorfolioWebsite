# Deepen the Cycle into `ScrollLoopService`

**Status:** accepted (2026-06-21). Renames/deepens the `ScrollStageService` referenced by
[ADR-0003](0003-looping-scroll-real-constellations.md) and
[ADR-0005](0005-loop-aware-nav-muting.md). No behaviour change.

## Context

`ScrollStageService` was a one-field mutable holder (`position = 0`). The actual **Cycle** truth
was scattered:

- `app.component.ts` owned `positionFor()` (the 0.85×viewport morph-band heuristic), `wrapAt`, and
  the seam wrap (`scrollTo`).
- `site-nav.component.ts` hardcoded `COUNT = 4`.
- `constellation.component.ts` used `order.length` for the same cycle length and did the
  shortest-path wrap.

So the number of destinations lived in three files, the band heuristic and wrap arithmetic were
reachable only by manually scrolling, and the "service" was a shallow pass-through — deleting it
would not have simplified anything.

## Decision

Promote it to the deep **Cycle module**, `ScrollLoopService` (`scroll-loop.service.ts`):

- **Seam: math in, DOM I/O out.** The shell still reads `scrollY` / section `offsetTop` /
  `innerHeight` and applies `scrollTo`; it passes those in. The module holds the truth and the math
  and **returns** results (it never touches the DOM), so the arithmetic is a unit-test surface.
- **Interface:** `position()` (read), `cycleLength`, `setAnchors(offsets)`, `update(scrollY,
  viewportHeight)`, `wrapOffset(scrollY): number | null`.
- **Pure math extracted** to `scroll-loop.math.ts` (`positionFor`, `wrapOffset`) with full
  coverage in `scroll-loop.math.spec.ts` — mirrors the `constellation-morph.ts` + spec precedent.
  The service holds state and delegates.
- **`cycleLength` is derived** from the measured sections (`offsets.length − 1`, the last being the
  Loop clone). The literal `4` is no longer written anywhere; adding a destination auto-corrects.
- **`position` is a signal**, but read via `position()` from the existing out-of-zone rAF loops, so
  the read is non-reactive and schedules no change detection. It must stay out of templates.

## Scope decisions

- **Shortest-path easing/inertia stays in the constellation.** That is rendering, not cycle truth;
  the constellation just reads `cycleLength` now instead of `order.length` (with that as a
  pre-measure fallback). Deepening the morph physics is a separate, deferred candidate.
- **The four out-of-zone rAF loops are untouched.** Consolidating them behind one frame seam is a
  separate candidate; not done here.
- **Reduced-motion handling stays in the consumers** (the module is pure math).

## Consequences

- `scroll-stage.service.ts` is removed; `app`, `site-nav`, and `constellation` inject
  `ScrollLoopService`. ADR-0003 and ADR-0005 references updated to the new name.
- The band heuristic, the wrap/overshoot edges, and the empty/pre-measure cases are now unit-tested
  (`scroll-loop.math.spec.ts`) — previously eyeball-only.
- Deletion test now passes: removing the module would scatter the cycle math back across three
  files. It earns its keep.
- A pre-measure window exists where `cycleLength` is `0`; the nav skips muting and the constellation
  falls back to its own figure count, so nothing divides by zero.

## Addendum (2026-07-13) — `activeDestination` joins the interface

The Cycle answered "how far along am I" (`position`) but not "which destination is that". Three
modules computed the latter independently — the nav ran its own midpoint probe over a cached list
of section tops (with a body `ResizeObserver` and a separate clone check), on top of the loop's
`position` and the shell's reveal observer. So "where am I" had three answers that could disagree
near the seam (candidate **C3**).

- **Interface widened by one derived member:** `activeDestination` — a `computed` over `position`
  and the destinations registry (see `destinations.ts`, candidate **C2**). It returns the id of the
  nearest resting destination, wrapping so the Loop clone reads as Home. The rounding lives in the
  pure `activeIndexFor(position, cycleLength)` in `scroll-loop.math.ts`, unit-tested like `positionFor`.
- **The nav is now an adapter:** it reads `activeDestination()` in the pulse tick and toggles
  `.active` / `aria-current`, and **deletes** its probe, its `targets`/`targetEls` tops cache,
  `measureTargets()`, the body `ResizeObserver`, and the `cloneEl`/`cloneTop` seam check (~60 lines).
  Because `activeDestination` only changes value ~once per destination, it is safe to bind (unlike
  `position`, which must stay out of templates).
- **Timing note:** rounding flips the highlight at the morph-band midpoint, ~0.42vh before a
  boundary vs the old probe's ~0.5vh — a sub-`0.1vh` shift, visually identical.
- **Scope kept tight:** the `#projects` sub-anchor (a position *inside* Work, which the loop does
  not model) stays a local nav concern — one dedicated `IntersectionObserver`, not taught to the
  loop. The shell's section-reveal observer is left alone; unifying the in-view observers is a
  separate candidate (**C9**).
- **Deletion test:** removing `activeDestination` would scatter the "which destination" logic back
  into the nav as bespoke geometry. It earns its keep.
