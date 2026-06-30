# Seamless one-direction loop via a cloned Home buffer

**Status:** accepted (2026-06-20). Resolves the "loop seam still teleports content at the very
bottom — smoothing that (mask/clone) is a follow-up" consequence left open in
[ADR-0003](0003-looping-scroll-real-constellations.md).

## Context

The looping scroll wrapped by hard-snapping `scrollY` to 0 at the bottom
(`window.scrollTo(0, 0)`). Because the bottom of the page was a blank runway (originally a
"the map loops" cue, later hidden), the snap jumped from *empty starfield* to the *Home hero* —
a visible content teleport. The constellation glided across the seam (its rendered position eases
along the shortest path on the loop), but the page content did not, so the loop read as "not smooth."

## Decision

Make the wrap **seamless in one direction (downward only)** by replacing the blank runway with a
**clone of the Home section** placed after Contact:

- The clone is a second `<app-landingpage>` in an identical `.dest` wrapper. It doubles as (a) the
  scroll distance for the Contact→Home morph and (b) the seam buffer.
- It is the last measured `#dest`, so `positionFor` drives the Contact→Home morph over the
  Contact→clone segment (scroll units 3→4, where 4 ≡ 0 = Home on the looping constellation).
- When `scrollY` reaches the clone's top — exactly one **cycle** down, where the clone is
  pixel-identical to the real Home top — reset with `scrollTo(0, scrollY − cycle)` instead of
  `scrollTo(0, 0)`. Subtracting the cycle (rather than zeroing) **preserves scroll momentum**: an
  overshoot of N px past the seam lands N px into the real Home.
- The reset is **invisible**: clone-Home == real-Home and the constellation is already at Home, so
  no pixel changes at the swap frame.

**Scope decisions (settled in the grill-with-docs session):**

- **One direction only.** Scrolling *up* is normal native scroll and clamps at the real Home top.
  Fully bidirectional looping was considered and rejected: it needs a *leading* clone and
  intercepting "up-overscroll" at `scrollY: 0` (native scroll clamps there), which fights native
  scroll and is where trackpad-momentum / cross-browser jank lives. A flawless one-way loop beats a
  janky two-way one (Usability is 30% of the rubric).
- **Same behaviour for everyone — no reduced-motion special case.** The reset is instantaneous and
  pixel-identical, so it is not "motion" to reduce; the constellation already snaps and section
  reveals are already disabled under `prefers-reduced-motion`. A separate finite-page fallback was
  considered and rejected as a second layout path maintained for a weak reason.

## Consequences

- The `.loop-runway` element and its `.loop-cue` / `.loop-sub` styles are removed; the clone replaces
  them.
- The clone is `inert` + `aria-hidden="true"` so its duplicated hero (CV button, social links) adds
  **no** duplicate tab stops or landmarks. It is **not** observed by the reveal IntersectionObserver
  and is forced visible (`is-visible`), so a fast scroll to the seam never catches it mid-reveal
  (which would pop against the fully-revealed real Home).
- The **real Home is also pre-revealed** (`is-visible`, not IO-observed). It is a loop anchor that must
  always match the clone; otherwise, looping back would catch it in its scrolled-away hidden state
  and fade the hero in on every loop (IO re-reveals asynchronously, too late for the seam frame).
  Side benefit: an instantly-visible hero is better for LCP. Only Work/About/Contact scroll-reveal.
- The clone duplicates `landingpage`'s internal `id`s (`my-wrapper`, `hero`, `hero-greeting`).
  Tolerated because the clone is out of the a11y tree and nothing queries those `id`s; the nav
  targets the `dest-*` `id`s on the section wrappers, which the clone deliberately does **not** carry.
- The nav's `.scrolled` frosted backdrop was driven by raw `scrollY > 24`, which **faded the nav white
  on every loop** (the seam lands back at `scrollY 0`, so it re-faded in each cycle). Fix: the
  scroll-driven backdrop was **removed entirely — the nav is now always transparent**. No toggle, no
  fade, nothing to flicker at the seam. (Two earlier approaches — a loop-aware `min(scrollY, cycle −
  scrollY)` formula, then a latch — were discarded in favour of just dropping the backdrop.)
- The native scrollbar thumb still sweeps to the bottom and snaps to the top each loop — the one
  remaining visible "tell" of the trick, accepted as the cost of a native-scroll (non-jacked) loop.
- `positionFor`'s old runway final-segment math is removed; the clone is now a normal anchor.
