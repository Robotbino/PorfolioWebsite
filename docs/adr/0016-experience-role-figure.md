# A Hairline figure under the SITA positions

**Status:** accepted (2026-10-30).

## Context

On desktop the SITA role is an editorial split: the lockup and the three position lines on the
left, the three bullets on the right. The bullets run taller, which left an empty block under the
positions, about 538 × 171 at 1400px and wider. The owner wanted a hairline animation there that
belonged to the star-map theme and made the section feel considered and fun, and wanted it built
with Hairline (`@lucasmarkes/hairline` and its `hairline-create` skill): isometric line drawings
of rounded solids, drawn to ten rules, that answer the pointer.

Twelve concepts went through a panel judging art direction, fit with Hairline and fit with this
codebase. The owner chose **Plates 01–03**. Three glass photographic plates stand in the groove of
a ruled ledge, one exposed each June a position began. Every plate holds the same field, and one
target has crept between exposures, which is how astronomers measure proper motion. The scale is
engraved only up to now, and the ledge runs on empty to where Plate 04 would stand.

## Decision

- **Hairline is the design tool, not a runtime dependency.** The figure was made with
  `hairline-create`, passed its validator and its eight-shot look, and was approved on the bench
  page. Its source, page and look sheet are kept in `docs/hairline/plates/` with the prompt and
  the kernel hash, so it can be regenerated or changed with the same tool.
- **The port is the kernel's static geometry plus CSS.** `role-figure.iso.ts` vendors the camera,
  rounded solids and path functions the figure calls, typed and with Hairline's MIT notice.
  `role-figure.math.ts` builds the figure from them with the source's constants under the same
  names. Every runtime move is a straight lift, and under a parallel projection that is a plain
  `translateY` of the seated drawing. So every path is computed once, a lift is a CSS transition
  on a plate's transform, and the stagger is that transition's delay. Nothing runs per frame.
- **Hairline's motion rules carry over.**
  - A pick or a release rides 700ms on `cubic-bezier(.32,.72,0,1)`.
  - It spreads outwards from the plate picked, or the one let go, 45ms per plate.
  - Neighbours rise by a falloff of 1, .31 and .09, which ends in a floor.
  - At rest the newest plate stands half lifted and carries the one bright edge.
  - The figure is ink only. It uses Hairline's five tones mapped to the site's palette, and no
    accent colour.
- **Hover comes from the position lines, not the drawing.** A line under a fine pointer sets
  `WorkComponent.picked`. The figure lifts that plate, and the line steps from muted to primary
  text. The figure itself takes no pointer input and is `aria-hidden`; the lines stay plain text.
- **It enters once.** When a third of the figure is on screen, a one-shot `InViewportService`
  watch drops the starting pose. The drawing wipes in from the left over `--duration-rule`, like
  the site's drawn rules, and the plates drop into the groove one after another. Under reduced
  motion there is no starting pose: the first paint is the rest pose, and hover changes land at
  once through the global rule.
- **The grid makes the room.** `.role` gains a third, flexible row, and the bullets span rows 2
  and 3. The figure fills row 3 with `contain: size`, so the bullets, the positions and the
  section's height are unchanged at every two-column width. The drawing is anchored bottom-left,
  level with the last bullet.
- **Hidden at 968px and below.** Stacked, there is no spare row, and the figure would only add
  height to a phone's scroll. The same change gives `.role-meta` the single-column reset it was
  missing: left at `1 / 6` it made four empty implicit columns, and their gaps took 96px from the
  title and the bullets.
- **The "now" is the date in Pretoria.** The scale is engraved up to the current month in
  Africa/Johannesburg, and the ledge always runs on to the next June. A position's `start`
  (`'YYYY-MM'`) in `work-data.ts` places its plate, and a spec holds it to the month its `period`
  names.

## Rejected

- **The npm package.** It exports only its thirty-three built-in figures and has no way to mount
  a custom one. Its runtime would also bring a second frame loop and its own pointer listener
  beside `FramePulseService`.
- **The skill's standalone page, inlined or framed.** Its three inline scripts have no CSP hash,
  and `frame-ancestors 'none'` refuses an iframe, even from the same origin.
- **Vendoring the whole kernel with its loop.** A plate that only translates needs no springs,
  tweens or per-frame path rewrites. ADR-0015 already turned down a script-driven tick in this
  section.
- **SMIL.** The global reduced-motion rule cannot stop it.
- **The house 45° camera.** It caps a figure laid along the ground axes at about 2:1, and the
  slot is wider. The camera turns to 25° so the ledge reads as a band, which is a deliberate
  departure from Hairline's frame convention, recorded with the source.

## Consequences

- No CSP change, and no new runtime dependency. The initial bundle grows by about 11kB raw
  (about 3.5kB over the wire).
- `role-figure.math.ts` is the single source of the drawing. To change the figure, change
  `docs/hairline/plates/plates.js` with the skill, then carry the constants across. They keep the
  source's names.
- A fourth position adds a fourth plate on its start month, with four code notches. The ledge
  runs on, and the viewBox refits.
