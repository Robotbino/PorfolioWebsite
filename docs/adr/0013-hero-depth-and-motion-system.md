# Hero depth and one motion system

**Status:** accepted (2026-10-13).

## Context

The site had depth in one place (the projects drum, [ADR-0011](0011-projects-showcase-3d-cards.md))
and a hero that was strong typographically but flat: every piece of it rose the same 0.85rem on
entry, the primary call to action glowed orange on hover, and nothing separated the name from
the constellation behind it. Around it, motion had drifted: headers arrived as a slab that slid
58px (a destination translate stacked on a block translate), five copies of the kicker had
slipped to different weights, durations and curves were written out by hand, focus rings mixed
two colours, and under reduced motion the kill switch still waited out every delay — so the
hero held a blurred, half-faded frame for up to 0.4s before cutting in.

The goal was a more memorable hero and a coherent depth language without ornament: the
constellation stays the centrepiece, nothing grows rightward into it, and every effect stays
fail-open, seam-safe and off under reduced motion.

## Decision

- **Hero entrance by role.** The eyebrow and name lead, the name with the least travel on the
  page (0.06em), the supporting copy follows out of a soft blur, the controls settle last, the
  meta only fades.
  Every `from` state is at least 0.5 opacity, so the h1 (the LCP element) is never hidden and a
  stalled animation still leaves a readable hero.
- **Two-plane pointer parallax.** `HeroParallaxService` turns the pointer position into
  `--parallax-x/-y` (−1…1), eased on the shared `FramePulseService` tick, and writes the same
  string to every attached element: both copies of the hero (real and loop clone) and the
  constellation. The headline moves up to 3px against the pointer, the constellation up to 8px
  with it; the statement and controls never move. One writer is what keeps the seam invisible —
  the clone can never disagree with Home — and the value fades to zero with distance from Home,
  symmetric around the seam (`distanceFromHome`, shared with the nav's fade). Fine pointer and
  motion allowed only; a settled pointer writes nothing.
- **A label knock-out on the name.** A tight halo in the page colour breaks the constellation's
  lines around the letters where they cross, the way a star chart sets its labels.
- **The hero recedes into the drum's space on scroll.** A scroll-driven animation
  (`view-timeline` on the hero wrapper, named because the hero's own `overflow` would capture an
  anonymous one) moves the poster 160px back under a 1600px perspective — the drum's camera —
  and dims it to 0.7 as it leaves. It starts only once the hero's foot reaches the viewport
  bottom, which neither Home at the top of the page nor the clone on the wrap frame has done,
  so the seam stays pixel-identical. Unsupported browsers and reduced motion keep the static
  poster.
- **The certificate preview turns in the same camera** (±6° `rotateY`, a third of that as roll,
  matching the drum's pointer response), and the spotlight opens from that exact pose: the FLIP
  starts from the preview's untransformed centre and size with the same turn applied, and
  interpolates function by function back to identity.
- **A calmer primary action.** The CTA lifts 2px with one soft, accent-tinted cast that fades in
  by opacity, instead of a scale and a three-layer glow.
- **One motion vocabulary.** Duration tokens (`--duration-base/slow/reveal/rule/dest`, plus
  stagger tokens) replace hand-written values; stray `ease` curves and the theme toggle's
  overshoot move to the site's expo curve. Destinations arrive as a focus pull (blur + opacity)
  instead of a slide. Section headers share one definition in `styles.css`: the kicker's
  hairline draws across, the title settles a fifth of an em. Ledger rules on About,
  Certifications and Contact draw themselves like the Experience index's (`.rule`).
- **One focus ring and one pressed state.** The monochrome accent ring everywhere (about 12:1
  on the aurora's darkest stop, where the orange accent is under 3:1 in light mode);
  components set only the offset. Pressed text controls dim to 0.7.
- **Reduced motion really stops.** The kill switch now zeroes delays and covers pseudo-elements.

## Rejected

- **Masked "slot" reveals on the name and section titles.** At a 0.92 line height the first
  frame clips descenders, and a stalled animation would leave the LCP text clipped.
- **Orbit rings around the hero constellation** to echo the Toolset orbit: ornament on the layer
  that is the navigation, and it crosses the name.
- **Tilt on more elements** (cards, rows, the portrait plate, the CTA). 3D lives in four places —
  the drum, the certificate preview and spotlight, the Toolset orbit and the hero's exit — so
  it stays a language rather than an effect.
- **Writing the parallax on `<html>`.** It would restyle the whole document every frame; three
  targets are just as seam-safe.
- **A secondary hero call to action.** The owner kept a single primary action.

## Consequences

- The constellation component now attaches to `HeroParallaxService`; its `.cluster` composes a
  `translate` on top of its centring `transform`.
- Section header markup carries `section-header`, `kicker` and `kicker-index`; component
  stylesheets keep only header spacing and layout.
