# Toolset orbit — a still black hole with ten tools circling it

**Status:** accepted (2026-10-13). Replaces the Experience section's four-row "Non-Technical
Skills" ledger with an illustration headed "Toolset".

## Context

The second ledger beside Technologies listed four soft skills. Three of them already live in
the Technologies "Other Skills" row, and the slot read as a weaker copy of the table next to
it. It is replaced by a picture of the tools in daily use: a supplied black-hole image (one per
theme) with ten supplied logos (Claude, Visual Studio Code, Git, Obsidian, Figma, MySQL,
PostgreSQL, Netlify, Postman, IntelliJ IDEA) orbiting it.

The constraints: the black hole itself never moves or gets faked into 3D; only the logos
animate; no video, canvas or WebGL; it must fit the old ledger's footprint without making the
section taller; it must work in both themes; and reduced motion must leave a complete,
static picture.

## Decision

- **A standalone `app-tool-orbit` component** with its own stylesheet (the Work sheet is
  close to the per-component style budget), placed inside the old ledger's `.index-block`
  article (now `.index-toolset`) so the grid position and the article's reveal are
  unchanged.
- **4:3 stage sized in container units.** At ≥1400px it is 424 × 318, which ends inside the
  negative space beside the taller Technologies ledger (96 + 31 + 318 = 445 against 452), so
  the section's height does not change on desktop. Stacked under Technologies (≤968px) it is
  capped at 30rem and kept flush-left like the ledgers; there it is taller than the four-row
  list was (360px against about 250px on tablets), accepted so the logos stay legible.
- **Motion is four nested boxes and two keyframes, all `transform`.** Each logo hangs off a
  static plane (`rotate(tilt) scaleY(k)`), an arm that turns a full lap, a carrier that turns
  back by the same angle, and a disc that undoes the plane (`scaleY(1/k) rotate(-tilt)`). The
  rotations and scales cancel, so logos travel a 16° tilted ellipse while staying upright and
  round. Keyframes hold no `var()` and nothing is placed with `translate` (which would act
  inside the squashed space), the most reliably composited form across engines.
- **Two rings, four and six logos.** Inner: 29cqi radius, 52s per lap; outer: 44cqi, 96s.
  The counts follow the rings' circumferences, so spacing is even on both, and the minor-axis
  gap between rings is wider than a disc, so logos on different rings never overlap. Three
  rings at different speeds collided every few seconds in a 424px slot. The inner ring clears
  the photon ring by about 3cqi, so the hole is never covered.
- **Resting pose = start pose.** Each animated element's base `transform` is its own
  animation's starting angle (the phase is a negative `animation-delay`). Reduced motion sets
  `animation: none`, and the global reduced-motion rule cuts any animation short; either way
  the element falls back to its base style, which leaves every logo upright in its slot.
- **One rule pauses both halves of every orbit** (`:host(.is-offscreen)`, toggled through
  `InViewportService`), so an arm and its counter-turn can never drift apart and tip a logo.
- **The pocket is a mask, not a blend.** Both supplied images sit on black. The Work section
  is its own stacking context, so `mix-blend-mode` would only ever see a transparent backdrop,
  never the aurora. A radial `mask-image` dissolves the crop's edges into the page instead: a
  short, eased fade on light (a long fade from black reads as a grey smudge there) and a wide
  one on dark. Theme swap is two stacked images — light underneath at full opacity, dark
  fading over it — so there is no see-through dip mid-fade, and neither is ever
  `display: none`, so the first switch doesn't flash.
- **Backing discs.** One silhouette for ten differently shaped logos; they keep knockouts
  (Git, Netlify, Postman) from showing the disk behind them and restore the edges that
  IntelliJ's black tile and PostgreSQL's black outline lose on the dark page. Per-logo optical
  scale factors make all ten read as one size.
- **Faint orbit lines** trace the two rings (sized, not scaled, so the stroke stays 1px), in a
  mid tone that reads over both the pocket and the page; hidden under forced colours.
- **Assets** are cropped, resized and encoded once (no other pixel changes) into
  `src/assets/toolset/`: hole-centred 4:3 crops of each black hole (dark: x19–941, y417–1109;
  light: x0–1160, y180–1050) at 320w and 640w, and each logo at 64px tall. MySQL's hairline
  outline gets about 1px of alpha dilation so it holds at ~20px.

## Rejected

- **A generated video** of the same scene: heavy, impossible to theme, and it re-draws the
  supplied artwork rather than using it.
- **Near/far depth** (logos larger and brighter at the front of the ring): a stronger 3D
  read, but the brief asks for a calm orbit and a still centre.
- **A visible caption naming the tools.** Each logo carries its name as alt text in a real
  list instead.
- **A pause control.** WCAG 2.2.2 asks for one on motion that runs longer than five seconds
  beside other content; the owner chose a control-free illustration. It still stops under
  reduced motion and pauses whenever it is off screen.

## Consequences

- Twenty compositor animations run while the orbit is on screen and none while it isn't.
- The four soft-skill phrases are no longer on the page; the Technologies "Other Skills" row
  still carries communication, teamwork, problem solving and time management.
