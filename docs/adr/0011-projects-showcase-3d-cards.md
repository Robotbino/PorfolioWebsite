# Projects showcase — cards in 3D space

**Status:** accepted (2026-10-13). Replaces the centre-focus dimming (`--card-focus`) of
[ADR-0008](0008-projects-showcase-legibility.md); the rest of 0008 (progress HUD, scrim,
focus framing) stands.

## Context

The pinned horizontal showcase moved the cards as flat panels. The goal was the feel of
ramp.design: physical cards in perspective that turn as they cross the stage, sit deeper
and fade off-centre, cast a shadow, catch the light, and respond to the cursor and to
keyboard focus. The constraints were fixed: scroll stays the only thing that moves the
cards horizontally, the existing `FramePulseService` tick stays the only motion engine (no
animation library), only `transform` and `opacity` animate, the centred card stays fully
legible, and reduced motion keeps the vertical-stack fallback.

## Decision

- **One number per card drives the pose.** The tick writes `--card-offset` (−1…1, distance
  from the stage centre in card steps, from the pure `cardOffset()` in `motion.math.ts`),
  plus `--card-lift` and `--pointer-x/-y` eased toward hover/focus targets with
  `easeToward()`. CSS composes the tilt (`rotateY`, slight `rotateZ`), depth
  (`translateZ`), fade, shadow and sheen from those. Writes are skipped when the rounded
  value is unchanged, so a settled showcase writes nothing per frame.
- **Drum, not cover-flow.** Side cards turn their outer edges away, matching the ramp.design
  reference. The centred card at rest has an identity transform, so its copy is never skewed.
- **Shared camera.** `perspective` sits on the sticky stage (vanishing point = screen
  centre) and the track is `preserve-3d`. Because the track's own box is then a plane at
  z = 0 that would swallow clicks on anything turned behind it, the track is
  `pointer-events: none` and the cards take the pointer back.
- **Shadow outside the box.** The card stops clipping; `.project-content` takes over the
  rounded clip, and a `::before` carries a static blurred shadow whose opacity and offset
  follow the tilt, so no shadow is repainted per frame.
- **Sheen that never touches the card being read.** A faint diagonal band slides across the
  face with `--card-offset` and is fully transparent on a centred card at rest. Its peak
  alpha is capped so the muted text under its brightest point still clears 4.5:1.
- **The whole card is one link** via a stretched `::after` on the main link (live demo, else
  GitHub), so the other link and the slideshow controls stay outside any `<a>`. Hovering the
  card no longer pauses the slideshow; pointing at its controls does.
- **Card width is capped at 960px** and the lead-in is derived from it, so the first and last
  card rest exactly centred and tilted neighbours peek in at every wide size.

## Rejected

- **Idle float.** It can share the tick without fighting the scroll (fade in after the track
  settles), but cards are only idle while someone reads the centred one, so a bob would move
  the very copy and screenshots being read. Bobbing only the off-centre cards would be
  invisible behind the stage mask. It would also keep the tick writing styles every frame
  on a page at rest.
- **Per-card `perspective()`.** Simpler stacking, but every card gets its own vanishing point,
  which reads as a row of separate tilts rather than one space.
- **CSS transitions for hover.** A transition on `transform` restarts every frame while the
  scroll-driven inputs change, trailing the scroll; easing in the tick avoids the conflict.

## Consequences

- The CSS depends on four custom properties written by `WorkComponent`, all with safe
  fallbacks, and all scoped under `:host(.showcase-on)`, so no-JS, narrow and reduced-motion
  renders are unaffected.
- `WorkComponent` now re-runs `applyMode()` when the reduced-motion preference flips, so the
  tilt and the pin never outlive the setting.
