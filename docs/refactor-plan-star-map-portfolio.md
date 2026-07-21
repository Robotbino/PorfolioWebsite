# Refactor Plan — Star-map wayfinding portfolio

> **Superseded (2026-06-20) — kept as a historical record. Do not follow as instructions.**
>
> This plan describes the **multipage** rebuild: four routes and a router-event `TravelService`.
> Phases A–C were delivered as written, but seen live the discrete page-to-page experience read as
> too plain, and [ADR-0003](adr/0003-looping-scroll-real-constellations.md) overturned the framing.
> What actually stands today differs on three load-bearing points:
>
> - **No routing.** The site is one continuous, downward-looping vertical scroll. The routes and the
>   `<router-outlet>` were made vestigial by the pivot and have since been removed entirely.
> - **No `TravelService`.** The morph is driven continuously by scroll position
>   (`ScrollLoopService`, see [ADR-0007](adr/0007-deepen-cycle-module.md)), not by navigation events.
> - **Real constellations, and five of them.** Ursa Major, Orion, Leo, Corona Borealis, and Cygnus —
>   not the four bespoke figures planned here. Certifications was added as a destination later.
>
> Still worth reading for the reasoning, the sequencing rationale, and the rejected alternatives.
> For the architecture as built, read `onboarding.html`; for the decisions, read `adr/`.

> *Original framing (2026-06-19):* Ready-to-file GitHub issue. Design decisions are settled in
> [CONTEXT.md](../CONTEXT.md), [ADR-0001](adr/0001-full-multipage-immersion-first.md), and
> [ADR-0002](adr/0002-star-map-wayfinding-concept.md). Sequencing: "pages first, wow last."

## Problem Statement

My portfolio is a single long scrolling Angular page with anchor-link navigation. I want to rebuild
it into an awwwards-level, **immersion-first multipage** experience with a "star-map wayfinding"
concept: each section is its own route, and navigating between routes plays a bespoke
constellation-morph **Travel** transition. The current code can't express that — there's only one
route, the background canvas lives inside the page (so it would reload on navigation), the
typography is utilitarian, and there are no transitions. I want to get there in tiny, safe steps
that always leave the site working, building the conventional multipage site first and layering the
"wow" on last so I don't drown in a months-long big-bang rewrite.

## Solution

Carve the single page into four routes (`/`, `/work`, `/about`, `/contact`) behind the existing
conventional nav, hoist the background canvas to the app shell so it persists across navigation,
upgrade to an editorial-serif type system, and only then build the signature star-map Travel
transition (bespoke equal-star-count constellations that morph 1:1 on navigation) plus
progressive-reveal map navigation and micro-craft. The conventional nav always works; the star-map
is an enhancement. A throwaway spike validates the make-or-break morph feel before any heavy
investment in it.

## Commits

Each commit leaves the site building and usable. Grouped into phases; ship after Phase A and again
after Phase B.

### Phase A — Multipage skeleton (conventional, fully working)

1. **Add the Netlify SPA-fallback redirect** so deep links and refreshes won't 404 once client-side
   routes exist. No visible change.
2. **Hoist the persistent background.** Render the aurora + constellation once in the app shell,
   above the router outlet, and remove the in-page instances. Visually identical, but the canvas now
   sits above routing (the precondition for surviving navigation).
3. **Create four empty route components** (Home, Work, About, Contact) rendering placeholders, and
   register their routes. Leave the existing page as the default and don't link the new routes in the
   nav yet. App unchanged; new routes reachable only by direct URL (harmless).
4. **Carve out Contact:** move the contact section into the Contact route, switch the Contact nav
   item from an anchor to a route link, and delete the section from the old page. Site works; Contact
   is now its own page.
5. **Carve out About** the same way (personal bio, education/qualifications).
6. **Carve out Work** the same way (the projects cards plus the technologies/skills block).
7. **Reduce Home to the hero** and retire the old combined page component; point `/` at Home. ✅
   **Milestone: a clean, conventionally-navigated four-route portfolio.**

### Phase B — Editorial type + motion foundation

8. **Add the display serif** (start with Instrument Serif) and apply it to headings only, through the
   existing typography tokens. Body face unchanged, so legibility/accessibility is preserved.
9. **Remove the smooth-scroll rule** (and the anchor-era scroll padding) now that navigation is
   route-based — this also pre-empts the known conflict with a smooth-scroll library later.
10. **Audition the alternate serif** (Fraunces) behind a one-line token swap; keep the preferred one.
    Trivial and reversible.
11. **Add a placeholder quiet route transition** — a short opacity/blur fade on the existing easing
    curve, with an instant-cut fallback under reduced-motion. ✅ **Milestone: typed, multipage, calm
    transitions.**

### Phase C — The signature: star-map Travel (make-or-break)

12. **Throwaway morph spike.** On a scratch route, hand-place two equal-count star sets and tween
    between them to confirm the morph *feels* tasteful. Not merged — a go/no-go check before
    investing further. (Cheap insurance against a late, expensive surprise.)
13. **Introduce the animation library and a pure morph utility:** given two equal-length star arrays
    and a progress value, return the interpolated star positions and link endpoints. Unit-tested;
    no UI wiring yet.
14. **Author the four bespoke constellations** (one per destination, identical star count, each shape
    evoking its page) in the existing star/link data format, and render the *current* route's
    constellation statically. Site works; each page shows its own figure, still no morph.
15. **Add the Travel service** that listens to router navigation events and exposes the from/to
    constellation and progress; wire it to drive the morph utility on the persistent canvas,
    replacing the placeholder fade. Runs outside the framework change-detection zone; reduced-motion
    collapses Travel to an instant cut. Unit-test the service's state transitions. ✅ **Signature
    Travel is live.**
16. **Layer the "quiet masked fade + star-settle"** treatment around the morph: outgoing content
    blur/lift a few pixels, the starfield slows and settles, new content resolves from a soft mask.

### Phase D — Progressive map reveal + micro-craft

17. **Progressive-reveal navigation:** reveal the star-map interaction as an enhancement (define the
    trigger — e.g. hero dwell or scroll), while the conventional nav stays fully operable.
18. **In-page scroll reveals** on longer routes (line-masked headings, staggered cards) via scroll
    triggers / intersection observers. Add a smooth-scroll library only if a route is long enough to
    benefit.
19. **Micro-craft**, one tiny commit each: magnetic CV button, refined hover states, optional custom
    cursor.
20. **Optional preloader** that counts in and masks the first WebGL init; reduced-motion aware.
21. **Content cleanup:** fix or remove the stale "Portfolio Website" project card (it describes a
    vanilla-JS site but links to this Angular repo), consistent with the shallow-cards decision.

## Decision Document

- **Architecture:** full multipage routing (`/`, `/work`, `/about`, `/contact`). Single-page and the
  scroll-home+`/work` hybrid were rejected — see ADR-0001.
- **Persistent background layer:** the aurora + constellation move to the app shell (z-0), above the
  router outlet, so they survive navigation. This is the highest-leverage structural change.
- **Three-layer model:** persistent background (z-0) · routed content (z-1) · transition/preloader
  overlay (z-100).
- **Concept:** star-map wayfinding with bespoke, equal-star-count constellations that morph 1:1
  during Travel — see ADR-0002. Real astronomical constellations and a literal navigable universe
  were rejected.
- **Travel transition:** driven by router navigation events; the morph is the centrepiece, wrapped in
  a restrained masked-fade/star-settle. Motion language is "less but better": long calm easing,
  opacity/blur/depth over distance, monochrome.
- **Navigation model:** progressive reveal — conventional labelled nav is the always-operable
  baseline; the star-map is an enhancement, never the only way to navigate.
- **Typography:** editorial serif display (Instrument Serif or Fraunces) over a clean, legible body
  face; the body face preserves accessibility.
- **Module seams introduced:** a pure constellation-morph function (data in → interpolated data out)
  and a Travel service (router events in → from/to + progress out). Keeping these as clean,
  framework-agnostic seams makes the make-or-break logic testable and swappable.
- **Sequencing:** pages first, wow last, with an early throwaway spike to de-risk the morph feel.

## Testing Decisions

- **Current coverage: none** (no spec files exist), so there is no prior art to mirror; this refactor
  introduces the first meaningful tests.
- **What makes a good test here:** assert external behaviour, not implementation. For the morph
  utility: given two equal-length star sets and progress 0 / 0.5 / 1, the returned positions equal
  the start, the midpoint, and the end — without asserting how it interpolates. For the Travel
  service: given a navigation start/end event sequence, it exposes the correct from/to and
  progress/phase — without asserting timer internals.
- **Modules to unit-test:** the constellation-morph function and the Travel service. These are the
  only pure-logic seams; everything else is visual/animation.
- **Everything else is verified manually:** run the dev server and watch in a browser — confirm the
  Travel feel, theme correctness, mobile layout, keyboard/screen-reader navigation, the
  reduced-motion path (Travel becomes an instant cut), and a Lighthouse pass (the rubric's Usability
  is 30% — performance and a11y are scored, not optional).

## Out of Scope

- Per-project case-study/detail pages — project cards stay shallow by decision.
- A literal navigable star-map "universe" (camera/zoom/pan) — symbolic per-page constellations only.
- Server-side rendering / prerendering, any backend, or a CMS — it stays a static SPA build.
- Real astronomical constellations.
- A smooth-scroll library as a headline feature — added only if a route grows long enough to need it.
- Deep content/copywriting work beyond fixing the stale project card.

## Further Notes

- The temp handoff written earlier (`portfolio-awwwards-handoff-2026-06-19.md`) is **superseded** by
  CONTEXT.md + the ADRs — it still assumes single-page/hybrid and "reuse the constellation code,"
  both of which the design grill overturned.
- **The make-or-break risk:** "wow last" means the Travel morph feel isn't validated until late.
  Commit 12 (the throwaway spike) is the mitigation — do it even though the polished version comes
  later.
- Section→route mapping (which content lands on Work vs About) is a recommendation in Phase A and is
  easy to adjust during the carve-out.
