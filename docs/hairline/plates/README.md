# Plates 01–03: the Hairline source for the Experience role figure

The site does not run anything in this folder. It is the design source of the
figure under the three SITA positions, kept so the figure can be regenerated or
changed with the same tool. The port the site ships lives in
`src/app/pages/work/role-figure/`. See
[ADR-0016](../../adr/0016-experience-role-figure.md).

| File | What it is |
| --- | --- |
| `plates.js` | The figure, written for Hairline's `hairline-create` skill. The only file to edit. |
| `hairline-plates.html` | The bench page `build.mjs` made from it: kernel, bench and figure in one file. Open it in a browser; `?play=1` runs the tour. |
| `hairline-plates-look.png` | The eight-shot look sheet `look.mjs` took of the approved version. |

## Provenance

- Hairline `@lucasmarkes/hairline` 0.5.1, MIT, © 2026 Lucas Marques.
- Skill `hairline-create` from `github.com/lucasmarkes/hairline`, installed
  2026-10-30, skill folder hash `9122ab45de4118de7c20fa762753234a3430c83f`.
- Kernel header: `sha256:346b48bdef2cdfafd5343eba01494255cf75f9c078e6fcd1aafc62bab62980a1`.
- The validator passed it, and all of `look.md`'s questions that apply were
  answered yes.

## Decisions

- **Camera `Cam(25, 0.5, 1.06)`**, not the house `Cam(45, 0.5)`. The 45° view
  caps a figure aligned to the ground axes at about 2:1. The slot under the
  positions is wider than that, so the ledge turns towards the viewer until it
  reads as a band. The fitted box is about 2.2:1 with a plate at the site's
  lift.
- **`NOW = 28`** is October 2026, months since June 2024. The site computes it
  from the date, so this file only fixes the month the look sheet shows.
- **Lift**: 10 / 18 / 26 on the bench slider. The site uses 18.

## The prompt

```
/hairline-create Plates. Three thin glass photographic plates propped in the groove of a long, low rounded viewing ledge, faces toward the viewer, each leaning back 12 degrees, like prints on a picture rail. Use Cam(25, .5, S) instead of the default so the ledge reads as a wide band receding gently to the upper left, and fit the extreme pose to a box about 2.4:1. The ledge is about 300 long, 22 deep and 8 high, with one groove crease along its top. Its front edge carries an engraved scale: a long tick at four evenly spaced year marks (months 0, 12, 24, 36), short ticks every 3 months engraved only up to month 29, and one now tick at month 29 that drops over the front lip; nothing is engraved past it. The plates (about 48 wide, 40 tall, 2.5 thick, r 3) stand centred on year marks 0, 12 and 24, numbered by 1, 2 and 3 punched notches in their top-right corners. Every plate face carries the same two faint reference crosses in lo at the same spot, and one target cross in mid that sits 5 units right and 3 up further from them on each later plate; all crosses are open four-stroke marks about 6 across, never dots. The ledge runs on empty past the third plate to the last year mark. Gesture, one of many: pointer x picks a plate from static bands at the plates' rest x, never the lifted plate; the picked plate lifts straight up out of the groove on the 700 ms curve and takes the bright edge; neighbours lift by falloff 1 / .31 / .09, staggered 45 ms by distance. Rest: plate 3 lifted half the range with the bright edge, plates 1 and 2 seated. Read-out 2024, 2025, 2026, rest when idle. Range: lift 10 / 18 / 26. Tour: plate 1, plate 2, plate 3, leave. Plates only translate; nothing rotates at runtime. No dashed lines, no words.
```

## Changing it

1. Install the skills once, outside this repo: `npx skills add lucasmarkes/hairline -g`.
2. Copy `plates.js` to a scratch folder and edit it there.
3. From that folder, run `node <skill folder>/look.mjs plates.js --answer 40,4,47 --edge 16,4,47 --edge 16,4,47`
   until it exits 0 and the sheet answers `look.md`.
4. Copy `plates.js`, the new page and the new sheet back here.
5. Carry the change into `role-figure.math.ts`. The constants there keep this
   file's names: `L`, `D`, `LH`, `X0`, `YEAR`, `W`, `H`, `TK`, `LEAN` and `YB`.
