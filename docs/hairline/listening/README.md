# Listening: the Hairline source for the Contact dish

The site does not run anything in this folder. It is the design source of the
radio dish in the Contact section's bottom corner, kept so the figure can be
regenerated or changed with the same tool. The port the site ships lives in
`src/app/pages/contact/contact-dish/`. See
[ADR-0017](../../adr/0017-contact-listening-dish.md).

| File | What it is |
| --- | --- |
| `listening.js` | The figure, written for Hairline's `hairline-create` skill. The only file to edit. |
| `hairline-listening.html` | The bench page `build.mjs` made from it: kernel, bench and figure in one file. Open it in a browser and point at it; `?play=1` runs the tour. |
| `hairline-listening-look.png` | The eight-shot look sheet `look.mjs` took of this version. |

## Provenance

- Adapted from the **Dish** figure of `@lucasmarkes/hairline` 0.5.1 (MIT, © 2026
  Lucas Marques): the same solids and the same two-spring aim. The changes are
  the rest pose (up and to the left, at the sky over the page instead of off to
  the right) and the tour.
- Built and checked with the `hairline-create` skill from
  `github.com/lucasmarkes/hairline`, installed 2026-10-30, skill folder hash
  `9122ab45de4118de7c20fa762753234a3430c83f`.
- Kernel header: `sha256:346b48bdef2cdfafd5343eba01494255cf75f9c078e6fcd1aafc62bab62980a1`.
- The validator passed it. Rest covers 31% of the frame, the console stayed
  clean, and nothing flickered.

## Where the site departs from the bench

- **The aim.** On the bench the pointer aims the dish only over its own stage.
  On the site it aims it from anywhere in the viewport while the dish is on
  screen: `aimAt` in `contact-dish.math.ts` keeps the bench's `tanh` falloff, but
  measures the pointer's offset in px against a fraction of the viewport
  instead of 120 and 90 viewBox units.
- **Its own lap.** The bench's tour needs its play button. On the site, the
  dish arrives stowed and swings up to rest. When no mouse is moving, it then
  surveys three stops of sky and rests, on a timer (`SURVEY` in the math
  module).
- **The frame.** The viewBox is cropped to the aims the site can reach, not
  the bench's 400 × 320.

## Changing it

1. Install the skills once, outside this repo: `npx skills add lucasmarkes/hairline -g`.
2. Copy `listening.js` to a scratch folder and edit it there.
3. From that folder, run `node <skill folder>/look.mjs listening.js --answer 200,40 --edge 390,300 --edge 10,10`
   until it exits 0 and the sheet answers `look.md`.
4. Copy `listening.js`, the new page and the new sheet back here.
5. Carry the change into `contact-dish.math.ts`. The constants there keep this
   file's names: `R`, `FOC`, `SK`, `ZE`, `W`, `T`, `ZB`, `ZY`, `AZ0`, `EL0` and
   `REST`.
