# Projects showcase — progress, focus, and keyboard framing

**Status:** accepted (2026-07-02). Refines the horizontal projects showcase in
`WorkComponent` (`.projects-viewport` / `.projects-stage` / `.projects-container`).
Builds on the shared rAF pulse (`FramePulseService`) and the sticky-pin transform
pattern; adjacent to the looping scroll of [ADR-0003](0003-looping-scroll-real-constellations.md)
and the seam wrap of [ADR-0004](0004-seamless-loop-clone-wrap.md).

## Context

The Projects section pins a stage and translates a card track on the X-axis as the
page scrolls vertically — a scroll-jacked horizontal showcase. It reads as premium
but had three recruiter-facing problems:

1. **No orientation.** Nothing signalled how far through the set you were or that it
   was finite — the classic "am I lost?" of scroll-jacking.
2. **Flat legibility over the star-map.** The constellation is `position: fixed` and
   keeps morphing site-wide; behind the moving cards it competed with the copy, and
   every card read at equal weight so nothing was clearly the subject.
3. **A keyboard / masking trap.** Movement is a CSS transform, not a native
   scrollport, and the stage edges are masked. Tabbing to an off-frame card's GitHub
   link put focus on an invisible control the browser could not scroll into view.

Native CSS `scroll-snap` was considered and rejected: there is no scrollport to snap
(the track is transform-driven), so snapping would have to be faked in JS and would
fight the continuous vertical gesture — the opposite of the "not slippery" goal.

## Decision

Keep the horizontal mechanic; layer four refinements, all gated on the existing
`.showcase-on` host class so the vertical-stack fallback (no-JS / reduced-motion /
narrow) is untouched.

- **Progress HUD (orientation).** The rAF tick writes `--showcase-progress` (0→1) to
  the stage; a pinned, `aria-hidden` HUD renders a fill rail with one notch per
  project, a live "0n / 0N" counter (updated imperatively, never through change
  detection), and a "Scroll to explore" hint that fades as soon as the sweep begins.
- **Centre-focus emphasis (legibility).** The tick writes a per-card `--card-focus`
  (1 = centred) from cached card centres — no per-frame layout reads — and CSS dims
  the edge cards so the framed one is unmistakably the subject.
- **Constellation scrim (legibility).** `.projects-stage::before` radial-dims the
  fixed star-map locally toward the page colour (the same `--scrim-rgb` idiom as
  `.role::before`), sitting above the map and below the opaque cards. Cards also gain
  a resting border + shadow so they read as lifted objects.
- **Focus framing (accessibility).** A `focusin` handler on the track inverts the
  scroll↔progress math and `scrollTo`s the focused card into frame, so keyboard
  tabbing walks the gallery visibly instead of landing under the mask. The gallery is
  a `role="list"` for an announced item count.

Physics: the eased lerp is now frame-rate-independent (exponential smoothing on `dt`)
so the settle feels identical at 60 and 120 Hz rather than faster / "slippier" on
high-refresh displays.

## Scope decisions

- **HUD is decorative.** It duplicates the scroll, so the whole cluster is
  `aria-hidden` and `pointer-events: none`; the accessible path through the projects
  is the card links themselves (kept in-frame by the focus handler), not the HUD.
- **No native snap / no forced settle.** Rejected as gesture-fighting; the calm comes
  from the eased transform, not from snapping.
- **Focus scroll uses native smooth `scrollTo`** within the Work section, clear of the
  seam wrap ([ADR-0004](0004-seamless-loop-clone-wrap.md)).

## Consequences

- Recruiters get finiteness + position at a glance, a clearly-framed card, and a
  keyboard path that never disappears under the mask.
- The tick stays write-only per frame (cached geometry in `measure()`), so the added
  focus / progress work introduces no layout thrash.
- The fallback is fully preserved: everything new is scoped under `:host(.showcase-on)`
  or hidden by default, and the hint arrow animation is disabled under reduced motion.
- New coupling: the CSS depends on two custom properties (`--showcase-progress`,
  `--card-focus`) written by `WorkComponent`. Both carry safe fallbacks
  (e.g. `var(--card-focus, 1)`), so a no-JS render is still correct.
