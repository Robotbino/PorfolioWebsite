# Loop-aware (Home-anchored) navigation muting

**Status:** proposed (2026-06-21) — awaiting approval. **Supersedes** the "scroll-driven backdrop
removed — the nav is now *always* transparent, no toggle" consequence of
[ADR-0004](0004-seamless-loop-clone-wrap.md).

## Context

The hero nav is visually heavy while reading the lower destinations, working against the
*less but better* declutter goal. We want the nav to recede as the visitor travels: the Work /
About / Contact links fade to a faint ghost and the Home (house) icon shrinks and mutes — full
nav only at the Home destination.

This reintroduces scroll-responsive nav state, which ADR-0004 deliberately removed. ADR-0004's
problem was specific: a backdrop keyed to **raw `scrollY`** re-faded on every loop, because the
seam wraps `scrollY` back to ~0 each cycle and the Home clone must stay **pixel-identical** to
real Home. Anything keyed to raw `scrollY` *pops* at the seam and reveals the loop trick.

## Decision

Drive the nav state from **loop-aware distance-from-Home**, not raw `scrollY`:

- `SiteNavComponent` reads the existing `ScrollLoopService.position` (the cycle module — renamed
  from `ScrollStageService` in [ADR-0007](0007-deepen-cycle-module.md); 0 = Home, 1 = Work, 2 =
  About, 3 = Contact, 4 ≡ Home again) from a single **out-of-zone `requestAnimationFrame`** loop
  (the same pattern the constellation uses), so there is no change-detection thrash.
- It writes one CSS custom property, `--nav-mute` (0…1) =
  `min(1, distanceFromHome / FADE_RANGE)`, where `distanceFromHome = min(pos, count − pos)` and
  `FADE_RANGE = 0.5` destination-units. All visual muting is interpolated off this var in CSS.
- **Muted end-state** (`--nav-mute = 1`): links fade to a faint ghost (`opacity ≈ 0.12`) with a
  small `translateY(-6px)` lift; the house icon `scale(0.62)` + muted colour at `opacity ≈ 0.55`.
  The house icon's **resting size drops `--font-size-4xl` → `--font-size-2xl`**.
- **Seam-safe by construction:** because the driver is symmetric around Home, the nav is already
  back to full *before* the loop reaches the clone (`pos → count`), so the seam frame stays
  pixel-identical. This is the loop-aware idea ADR-0004 floated (`min(scrollY, cycle − scrollY)`)
  but rebuilt intentionally as a feature, not a backdrop.

**Scope decisions:**

- **Operability preserved.** Ghost links stay in the DOM and tab order; the nav un-mutes on
  `:hover` *or* `:focus-within`, so a keyboard / screen-reader user instantly gets the full,
  operable baseline. This upholds the CONTEXT.md **Wayfinding** rule ("always operable… never the
  only way to navigate"). The links are never `pointer-events: none` or `aria-hidden`.
- **Reduced motion → full nav always.** The mute is an aesthetic declutter, not essential, so
  under `prefers-reduced-motion: reduce` it is disabled and the nav stays fully visible. Failing
  to the stable, fully-operable baseline matches how the rest of the site disables enhancements.

## Consequences

- Adds a small out-of-zone rAF to `SiteNavComponent` (mirrors the constellation; cleaned up in
  `ngOnDestroy`).
- ADR-0004's "nav is always transparent, no toggle" consequence is superseded. There is still
  **no frosted backdrop** — this is opacity / scale / colour muting only — so there is nothing to
  flicker at the seam.
- A CSS transition on the `--nav-mute` hover/focus override gives a smooth reveal.
- Reduced-motion users get no declutter (full nav). Accepted.
