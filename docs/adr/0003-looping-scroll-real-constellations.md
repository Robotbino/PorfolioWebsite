# Looping-scroll immersion with real constellations

**Status:** accepted (2026-06-20). Supersedes [ADR-0001](0001-full-multipage-immersion-first.md)
(multipage routing) and revises [ADR-0002](0002-star-map-wayfinding-concept.md) (bespoke,
equal-topology constellations).

## Context

Phases A–C delivered the multipage build: four routes, a persistent background, and a
nav-driven constellation **morph** between destinations. Seen live, the discrete page-to-page
experience read as "too plain" — the goal of *felt, continuous immersion* wasn't landing. The
ask: simulate an endless scroll with cool transitions.

## Decision

The site is **one continuous, endlessly-looping vertical scroll**. All four destinations stack as
full-viewport sections in the app shell; navigating *is* scrolling. The persistent constellation
morphs **continuously with scroll position**, with inertia (the rendered position eases toward the
scroll target along the shortest path on the loop, so the wrap seam stays continuous) and a
**star-settle** keyed to scroll speed (stars shrink, links dim while moving; settle at rest). At
the bottom a short runway carries the last→first morph, then the scroll wraps to the top.

I now use **real constellations** — Ursa Major (Home), Orion (Work), Leo (About), Cygnus
(Contact). Each is drawn with **8 stars** so positions still morph 1:1, but keeps its **own real
asterism lines**, which **cross-fade** (outgoing → incoming) through each transition.

## Why this revises the earlier ADRs

- **ADR-0001 (multipage):** chosen for deep-links + usability. Those are preserved differently —
  native scroll (no scroll-jacking), a conventional nav that smooth-scrolls to sections, and a
  reduced-motion path that snaps. Immersive continuity won over discrete routing.
- **ADR-0002 (real constellations rejected):** the rejection was about mismatched star counts (the
  1:1 morph) and differing line patterns. Both are solved here: fixed 8-star sets + per-figure
  cross-fading links.

## Consequences

- `<router-outlet>` is replaced by a scrolling shell; the Angular routes are now vestigial and
  per-destination URL deep-linking is a follow-up.
- The time-based `TravelService` is removed; the morph is driven by `ScrollLoopService.position`
  (the cycle module — renamed/deepened from `ScrollStageService` in
  [ADR-0007](0007-deepen-cycle-module.md); written by the shell on scroll, sampled by the
  constellation's rAF). `interpolateConstellation` is unchanged and still unit-tested.
- The loop seam still teleports content at the very bottom — smoothing that (mask/clone) is a
  follow-up.
- `CONTEXT.md` and the refactor plan describe the multipage framing and need a later alignment pass.
  *(Closed 2026-07-21: `CONTEXT.md` realigned to the loop framing; the refactor plan marked
  superseded and kept as a historical record.)*
