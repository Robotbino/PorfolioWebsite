# Toolset orbit in perspective

**Status:** accepted (2026-10-14). Revises [ADR-0012](0012-toolset-orbit.md): its near/far
rejection, the backing discs and the four-box keyframes. The still black hole, the two rings of
four and six logos, the off-screen pause and the still picture under reduced motion stand.

## Context

The orbit read as a flat diagram: circles squashed into ellipses, with each logo on a round disc
that made it a button sitting over the picture rather than an object in it. The owner asked for
the discs to go, for the logos to sit on the orbit lines themselves, and for them to travel
through the same space as the black hole, while staying in front of it: no logo is ever hidden.

## Decision

- **One projection draws everything.** A pure module projects a point on a ring through a real
  perspective camera: the ring plane is inclined 52° and turned 20° toward the black hole's own
  disk, and the camera sits 240 stage units away. The near side of each ring passes below the
  hole, as the disk in the image does, so logos there are larger (up to about 1.17×) and the far
  side smaller (about 0.87×). The logos dim slightly with distance, to 72% at the far point.
- **The rings are drawn from the same function.** They are static SVG paths with a non-scaling
  1px stroke and a gradient that brightens toward the viewer, so a logo sits exactly on its line
  at every point of its lap.
- **Web Animations, generated, on the compositor.** Each logo gets one animation of 73 keyframes
  (`translate` and `scale` plus `opacity`) sampled from the projection, looped at the ring's
  period with its starting slot as a negative delay. The motion runs with no script per frame, as
  the CSS version did, with ten animations instead of twenty and no counter-rotation pairs that
  could drift apart. A resize regenerates the keyframes in pixels and keeps their timing.
- **The resting pose is the first keyframe.** Each logo's inline style is its starting pose, so
  first paint, no script and reduced motion all show the complete still picture. The global
  reduced-motion rule cannot reach Web Animations, so the component cancels them itself.
- **No containers; contrast from light instead.** Each logo carries a soft contact shadow in the
  theme's ink. IntelliJ IDEA's black tile and PostgreSQL's black outline get a hairline light rim
  in dark mode, where they would otherwise vanish.
- **Geometry checked, not eyeballed.** Specs sample both rings at every angle and assert that the
  logos stay inside the stage, never cover the photon ring, and never touch a logo on the other
  ring.

## Rejected

- **Passing behind the black hole.** The strongest depth cue, but logos would disappear for part
  of every lap. The owner chose to keep every tool visible.
- **Real CSS 3D (`preserve-3d` and a perspective).** Compositor-friendly, but the ring lines would
  have to be projected separately to match, 1px borders blur when rotated in 3D, and opacity
  inside a 3D context flattens it.
- **A script-driven tick.** Exact, but it would put ten style writes per frame on a main thread
  already running two canvases.

## Consequences

- `tool-orbit.math.ts` is the single source of the orbit's geometry; changing an angle or radius
  there moves the rings and the logos together, and the specs re-check clearance and overlap.
- The component creates and owns its animations: it pauses them off screen, cancels them under
  reduced motion and on destroy, and regenerates them on resize.
