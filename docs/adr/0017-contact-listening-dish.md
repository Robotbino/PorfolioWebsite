# A listening dish in the Contact corner

**Status:** accepted (2026-10-30). Builds on [ADR-0016](0016-experience-role-figure.md): the same
design tool, the same vendored kernel, now shared, and the same palette.

## Context

After Plates 01–03, the owner asked for more Hairline figures, starting with one in the bottom
corner of Contact. The owner also asked for it to be automated and to need no questions answered.

Contact ends the loop. It has a poster title, a lead, two channel links, a large email marquee with
a Copy button, and a colophon rule. The space right of the Copy button and below the channels is
empty: about 232 × 255 at 1440px, standing on the colophon's top border. The section's
constellation hangs mid-page, up and to the left of that corner.

Hairline's catalogue already has the right object. **Dish** is a radio dish on a two-axis gimbal
that aims at the pointer, and the earlier research marked it as the catalogue's fit for a contact
or footer moment on a star-map site. A dish in the corner, listening at the sky over the page,
says "I'm listening" without a word.

## Decision

- **Designed with Hairline, adapted from its Dish.** `docs/hairline/listening/listening.js` is the
  package's Dish with its MIT notice. It keeps the same solids and the same two-spring aim, rests
  up and to the left at the sky instead of off to the right, and has a tour that sweeps that sky.
  It was built and checked with `hairline-create`: the validator, the frame check, the read-out, a
  clean console and no flicker.
- **The dish turns, so it is drawn by script while it moves.** An aim rotates the dish, and a
  rotation changes the silhouette, so the role figure's static-paths-plus-CSS port cannot carry it.
  - `contact-dish.math.ts` ports the figure as pure geometry: `pose(aim)` returns every path at an
    aim, and the viewBox is cropped to every aim the site can reach.
  - The component templates the first pose, so the first paint is complete.
  - Azimuth and elevation each ride Hairline's spring (k 100 · c 18 · m 1, vendored as
    `hairline.motion.ts`).
  - The dish joins the shared `FramePulseService` only while a spring is moving, and leaves the
    moment both settle.
  - Each frame recomputes the pose and writes only the attributes that changed, straight to the
    DOM, with no change detection.
  - At rest, nothing runs.
- **The arms change sides without moving DOM nodes.** As the dish turns, each arm of the yoke
  moves from behind it to in front of it. The template draws each arm twice, before and after the
  dish, and a frame shows the copy on the right side. Hairline instead re-appends the group, which
  would move nodes Angular created.
- **It listens to the visitor.**
  - **Arrival:** it paints stowed (facing the viewer, tipped down). When a third of it is on
    screen, it swings up to rest.
  - **Pointer:** while it is on screen, a mouse moving anywhere in the viewport aims it. The
    offset is measured from the pivot as drawn, with one rect read per pointer event, never per
    frame. It uses the bench's `tanh` falloff, scaled to the viewport, so it never turns past its
    reach.
  - **Going still:** after 2.5 seconds without a move, or when the pointer leaves the window, it
    goes back to rest.
  - **Left alone:** it surveys three stops of sky, 2.4 seconds each, rests for 4 seconds, and goes
    round again.
  - **Touch:** it ignores touch. Without a fine pointer it only surveys.
- **Off screen everything holds; reduced motion keeps the picture.** Off screen there is no pointer
  listener, no survey and no frames. Under reduced motion it rests from the first paint and never
  moves: no arrival, no survey, and it doesn't follow the pointer. The preference is live.
- **It stands on the colophon's rule.** The host is absolutely positioned on `.contact-colophon`,
  right-aligned, with its foot on the border. Its width is `min(14.5rem, 100% - 62rem)`. The
  email marquee's capped address, arrow and Copy button take about 62rem, so the dish never
  reaches them, and at 14.5rem its top stops short of the channel list. Below 1240px the corner
  is gone, and the dish is hidden.
- **One Hairline kit, shared.** The kernel subset moves from `role-figure.iso.ts` to
  `shared/hairline/hairline.iso.ts`, which also gains `circ`. Hairline's spring joins it as
  `hairline.motion.ts`, and its palette and class rules move to `shared/hairline/hairline.css`,
  which both figures list first in their `styleUrls`. The forced-colours rule lives there too.

## Rejected

- **The npm package's `dish()`.** It would bring its own frame loop and pointer listener beside
  `FramePulseService`, it only aims while the pointer is over its own box, and its rest looks
  away from the page.
- **Precomputed poses with CSS between them.** The silhouette of a turning dish is not an
  interpolation of two silhouettes, so it would fold mid-turn.
- **A per-frame loop that never stops**, the one ADR-0015 rejected. The dish runs frames only while
  a spring moves, which is about a second per retarget.
- **A post box, a mast with rings, keycaps.** Weighed as concepts. Only the dish reads at once in a
  corner, belongs to the star map, and answers the visitor.

## Consequences

- No CSP change, and no new runtime dependency. The initial bundle grows by about 14kB raw (about
  4kB over the wire), to 447kB against the 500kB warning.
- The motion starts by itself and lasts more than five seconds, as the role figure's lap does.
  The owner's stance from ADR-0012 and ADR-0016 holds: no control. It stops off screen and under
  reduced motion, a mouse takes it over, and it is decoration beside text that never changes.
- `contact-dish.math.ts` is the single source of the drawing. To change the dish, change
  `docs/hairline/listening/listening.js` with the skill, then carry the constants across. They keep
  the source's names.
