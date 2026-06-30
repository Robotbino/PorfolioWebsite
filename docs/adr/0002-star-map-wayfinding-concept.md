# Star-map wayfinding as the unifying concept

**Status:** accepted (2026-06-19)

We needed a concept to justify the cosmic theme and the multipage nav, and to lift Creativity above
the generic-starfield baseline that scores poorly on Awwwards.

**Decision:** The cosmos *is* the navigation system. Each route is a _Destination_ with a **bespoke**
constellation; all constellations share the same star count so they morph 1:1, and the page
transition (_Travel_) pans + morphs between them. The map is **symbolic** (per-page constellations +
travel), not a single literal navigable universe.

**Considered and rejected:**
- *Cosmic-as-decoration* — stars stay a backdrop; generic, low Creativity.
- *Real astronomical constellations* — mismatched star counts make the morph glitchy; carry no
  meaning about the work.
- *Literal navigable universe* (camera/zoom/pan) — too large a build for now; risk of half-finished.

**Consequences:**
- Author bespoke `Star`/`Link` data per destination (equal counts), evoking each page's meaning.
- Morph + starfield pan implemented via GSAP, run `outsideAngular`.
- Hard usability requirement: a clear text-nav fallback and a `prefers-reduced-motion` path —
  wayfinding-by-stars must never be the *only* way to navigate.
