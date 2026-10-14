# Star map in WebGL, and one shared camera

**Status:** accepted (2026-10-14). Revises [ADR-0013](0013-hero-depth-and-motion-system.md):
3D no longer lives in four places only, and the constellation's 8px CSS drift becomes a camera
move. The SVG constellation of [ADR-0003](0003-looping-scroll-real-constellations.md) stays as
the fallback.

## Context

The depth pass of ADR-0013 was right in direction but too quiet to notice. The star map is the
first thing a visitor sees and the site's navigation concept, yet it was a flat SVG: eight
points on a plane with an 8px pointer drift. Around it, the 3D effects each had their own idea
of depth (a 1600px perspective written out in four files, depths of −160px chosen per effect),
so they read as separate tricks rather than one space.

The constraints held from earlier decisions: each constellation must still read exactly as the
real figure at its destination; the figure stays in its viewport-centred box so the hero copy
is never crowded; the loop seam stays pixel-identical; reduced motion leaves a still picture;
no new libraries.

## Decision

- **OGL renders the star map.** OGL is already in the main bundle for the aurora, so the scene
  costs only its own code (three.js would add about 129 kB gzipped for the same points and
  lines). `StarMapComponent` owns a transparent canvas behind the content and three draw calls:
  a background star field, the constellation's links, and its eight stars.
- **One lens for the whole site.** `--camera-perspective: 1600px` in `styles.css`, mirrored by
  `CAMERA_PERSPECTIVE_PX`, is the perspective of the hero recede, the project drum, the
  certificate preview and the narrow-screen card tilt-in. The WebGL camera uses CSS pixels as
  world units and sits the same 1600px from the figure plane (`fovY = 2·atan((H/2)/1600)`), so
  a depth of −160px means the same thing in a stylesheet and in the star field.
- **Real stars on real sight lines.** Each star carries its distance in light-years and its
  spectral class. Depth is one global log scale, centred on each figure's median star and
  clamped, so the Big Dipper (a real moving group, 78–123 ly) is shallow and Cygnus (Gienah at
  72 ly, Deneb near 2,600) is deep. Every star sits on the line from the camera through its
  authored 2D point, so at rest each figure projects exactly onto the chart it always was, and
  any camera move reveals how far apart its stars really are. The spectral class tints the
  halo in dark mode (Betelgeuse red, Rigel blue).
- **The figure keeps its box.** A hidden element carries the constellation's CSS box rules
  (centred clamp on desktop, upper right and dimmed on phones), and the projection is shifted
  so the camera axis passes through that box. The hero's clearance is unchanged by construction.
- **The camera steps aside between destinations and settles at each one.** During a morph it
  swings up to 15° and pulls back 15% (`sin²(π·frac)`, so it is face-on with zero slope at every
  destination and at the seam), alternating sides (the two morphs either side of the seam share
  one: five steps cannot alternate around a loop). A navigation jump across two destinations
  holds the swing at zero until it lands, so it never whips back and forth.
- **The pointer orbits the camera around a pivot in front of the figure.** Four degrees of yaw
  and two and a half of pitch, full strength at Home and 30% elsewhere, read from
  `HeroParallaxService` so the site still has one pointer source. With the pivot 112px in front
  of the figure, the figure still drifts about 8px with the pointer, as before, while the far
  field moves up to about 77px: the two-plane parallax of ADR-0013, now with a real background.
- **Restraint in the field.** About 190 stars on screen on a desktop and 35 on a phone, most of
  them faint, with distance fog and no twinkle. The field reaches far enough past the edges that
  the camera's turn never shows its boundary. Light mode draws 45% of them as low-alpha ink, a
  printed star chart rather than dust behind body text.
- **Arrival and departure share the camera.** Leaving Home, the hero recedes 320px and tips back
  6° from its bottom edge. Each destination arrives from a 2.5% scale-down with the blur and fade
  of ADR-0013, anchored on the part of the section level with the top of the viewport, so a tall
  section never lurches. The reveal is measured against the viewport (its foot trimmed by 15%),
  not as a share of the section: Work is about seven viewports tall and could never show 15% of
  itself. Its hidden state is written with `:host-context`, because emulated encapsulation scopes
  a `body.reveal-ready` selector to the shell's own elements and it never matched; this is the
  first time the arrival actually runs.
- **The project drum turns harder in the same camera.** Neighbours sink 260px and turn 36°, fade
  to 55%, and cast a shadow that drops 26px with the turn; a hovered card rises 56px and follows
  the pointer by 9° and 6°. The centred card at rest stays flat, and the sheen keeps its contrast
  cap. Below 900px, where the cards stack, each tips up 12° from its foot as it enters the
  viewport (scroll-driven, CSS only, released once it is a third of the way in).
- **The certificate preview turns like a card.** Up to 14° with a third of that as roll, plus a
  sheen and a shadow that follow the turn. Both sit on a face cut to the certificate's real
  proportions, so nothing lights or shades the empty letterbox around a square badge or a wide
  scan. The spotlight opens from the same face with a static shadow.
- **Cheap, and it steps down when it has to.** The canvas asks for a low-power context with no
  antialiasing or depth buffer, caps its pixel count, draws at half rate once settled, and starts
  a dozen frames after first render, off the LCP path. Those frames also measure the page's own
  cadence. After the entrance, a median frame slower than 22ms, or 1.3× that cadence where the
  browser already caps animation at 30fps, halves the pixel ratio and the field; slow again, or
  software rendering (`failIfMajorPerformanceCaveat`), a lost context or a draw that throws,
  switches the page to the SVG constellation for the session.
- **Reduced motion keeps the map but stills it.** No drift, swing, pointer orbit or entrance; it
  draws once per destination, on resize and on a theme flip.

## Rejected

- **three.js.** A tenth of its weight does everything the star map needs.
- **Merging the star map into the aurora's canvas.** One context, but the aurora's per-pixel
  shader would run at the star map's pixel ratio, and their fallbacks (a CSS aurora on touch,
  an SVG map without WebGL) would have to fail together.
- **Normalising each figure's depth to the same range.** Every constellation would look equally
  deep, which is not true of the sky; the background field carries Home's parallax instead.
- **Circling the camera once per loop.** More dramatic, but the whole field would sweep behind
  every paragraph while reading.
- **A scroll-driven animation on the destinations.** An active transform animation would make
  each section the containing block for the certificate preview and spotlight, which are fixed.
- **Twinkle and dense particle fields.** Constant movement behind content, and generic.

## Consequences

- `constellation.figures.ts` carries a distance and a spectral class for every star; the morph
  interpolates both. Depth is positive toward the viewer, and only stars behind a figure's plane
  dim, so the shallow Home figure keeps the SVG's brightness. The SVG fallback ignores both.
- ADR-0008 and ADR-0011 say every showcase rule is scoped under `.showcase-on`; the narrow-screen
  tilt-in is the one exception, and it lives in the showcase stylesheet with them.
- Every content destination now starts hidden until it reaches the viewport. Without script,
  under reduced motion and in print nothing is hidden.
- `HeroParallaxService` exposes the eased pointer and the Home weight as well as writing its CSS
  properties; the hero and the SVG fallback still use the properties.
- Two WebGL canvases run on desktop (aurora and star map). Phones keep the CSS aurora and get the
  star map at a capped pixel ratio, with the SVG as the fallback if the first frames run slow.
