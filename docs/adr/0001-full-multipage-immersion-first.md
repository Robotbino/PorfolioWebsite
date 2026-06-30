# Full multipage routing, immersion-first

**Status:** accepted (2026-06-19)

The portfolio was a single scrolling page with anchor links. The goal is an awwwards-level
experience with karak.at-style page-to-page transitions, while project content is intentionally
kept shallow (no per-project case studies — see the projects on `/work`).

**Decision:** Every top-level nav section becomes its own route — `/`, `/work`, `/about`,
`/contact` — and a transition plays on each navigation. We optimise for an engaged _Visitor_:
**immersion outranks recruiter scan-speed, even in Phase 1.**

**Considered and rejected:**
- *Single-page* — no surface for page-to-page transitions (the owner's core wish).
- *Hybrid (scroll home + `/work`)* — one transition only; less immersive. Was the lower-friction
  option but the owner chose maximum transition surface.

**Consequences:**
- Requires a **persistent background layer** (starfield + aurora hoisted out of `landingpage` into
  `app.component`, z-0) so it survives navigation.
- Requires a **router-event transition service** (NavigationStart → cover, NavigationEnd → reveal).
- Requires a Netlify `public/_redirects` with `/*  /index.html  200` so deep links don't 404.
- Trades recruiter scan-speed for immersion. We deliberately do **not** mitigate this with a
  "fast lane" — the bet is that craft impresses more than a fast skim would.
