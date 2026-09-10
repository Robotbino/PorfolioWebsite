# Inline SVG icon set instead of an icon font

**Status:** accepted (2026-09-10). Removes the `@fortawesome/fontawesome-free` dependency and the
three `@import`s at the top of `styles.css`.

## Context

The site draws sixteen glyphs: brand marks for the tech pills (Angular, React, JS, CSS3, HTML5,
TypeScript), representative solid glyphs where no brand mark exists (a leaf for Spring, a database
for MySQL, a key for JWT, a cube for WebGL), the GitHub and LinkedIn channel icons, the About
ledger's bulb and `</>`, and the copy/check pair on the clipboard button.

They arrived as Font Awesome. The previous author was already conscious of the cost and had
avoided `all.min.css` specifically to skip two unused webfonts, and that reasoning was sound — but
what remained still dominated the payload:

| | |
|---|---|
| `fontawesome.min.css` + `brands.min.css` + `solid.min.css` | 74 kB |
| `fa-solid-900.woff2` | 115 kB |
| `fa-brands-400.woff2` | 110 kB |
| **Total, for sixteen shapes** | **~299 kB** |

For comparison, the entire self-hosted Nohemi ladder — eight weights, the typeface that sets every
word on the site — is 179 kB. The icon font cost more than the typography.

Two whole webfonts were also fetched to render sixteen of their several thousand glyphs, and the
three `@import`s serialise rather than fetching in parallel.

## Decision

Ship the sixteen paths as data.

- `shared/icon/icons.ts` holds a `const ICONS` map of `{ viewBox, path }`, lifted from the Font
  Awesome Free SVGs at authoring time. `IconName` is `keyof typeof ICONS`, so a misspelled icon is
  a compile error rather than an invisible missing glyph.
- `shared/icon/icon.component.ts` renders one `<svg>`, `1em` square with `fill: currentColor`, so
  every call site keeps sizing and colouring it exactly as it did the font glyph: set `font-size`
  and `color` on the element and the icon follows.

Attribution stays in the file: the artwork is Font Awesome Free, CC BY 4.0. No Font Awesome code
ships — only the path data.

## Consequences

- Stylesheet transfer fell from 18.7 kB to 2.2 kB; the webfont payload went from 225 kB to zero.
  Two render-blocking font fetches disappeared from the critical path.
- The icons cost ~9 kB inside the JS bundle and no request of their own.
- **`text-shadow` no longer works on them.** A glyph is text; a path is not. The About ledger's
  bulb and code glow — including both `infinite alternate` keyframe loops — are converted to
  `filter: drop-shadow()`, which takes the same offset/blur/colour triples and reads identically.
  Anything added later that wants to glow must reach for `drop-shadow` too.
- Adding an icon is a two-line edit to `icons.ts`. Every entry is a single path; a multi-path glyph
  would need the component's template widened, so prefer one that isn't.
