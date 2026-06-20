# Frosted-glass surface for content cards

**Status:** proposed (2026-06-21) — awaiting approval.

## Context

The About cards are plain opaque boxes (`background: var(--color-card-bg)` + a 2px border). They
sit on top of the live aurora gradient + constellation but ignore it, reading as generic panels
rather than part of the star-map. We want a premium, readable surface that complements the
backdrop while honouring *less but better*.

Glassmorphism is the obvious fit but carries two real risks over an **animated WebGL** backdrop:
**contrast** (text over a moving, varying background) and **performance** (`backdrop-filter:
blur()` forces a GPU recomposite every frame, on top of the aurora + constellation + nav rAFs).

## Decision

Adopt a **measured glassmorphism** for content cards — tuned so the two risks are resolved by
design rather than hoped away:

- **High-opacity tint** (≈`0.62` alpha, warm) — *not* a faint 0.2 glass — so text contrast is
  guaranteed (WCAG AA) no matter what scrolls behind the card.
- **Conservative blur:** `backdrop-filter: blur(14px) saturate(1.25)`.
- **Edge & depth:** a 1px hairline border (`rgba(255,255,255,.14)`) with an inset top highlight,
  plus a soft layered drop shadow; `border-radius: var(--radius-lg)`.
- **`@supports (backdrop-filter)` fallback** to the opaque tint, so unsupported / low-power
  browsers still get a readable card. The blur is a *subtle enhancement*, never load-bearing for
  readability — which also means it can be dropped under a future low-power media query.

**Scope decisions:**

- Introduces a small **glass token set** (surface tint, hairline border, top highlight, shadow),
  defined for both light and dark themes.
- **Applied first to the About `.card`** only (component-scoped). The Work project/experience
  cards keep their current styling for now; the tokens are reusable and *could* be adopted there
  later for consistency — noted, not done in this change.
- The blur is **static** (not animated), so there is no motion to reduce; reduced-motion is
  unaffected.

## Consequences

- First translucent / `backdrop-filter` surface in the app. Small continuous GPU cost over the
  aurora, bounded to the 2 small About cards.
- A second card visual language now exists (glass About vs. solid Work). Accepted as transitional;
  the ADR records the intent to converge if it reads well.
- Card text colours move to glass-appropriate values; verified for contrast in both themes.
