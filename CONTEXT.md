# Portfolio — Design Language

Glossary for Bino Hlongwana's personal portfolio. It pins fuzzy words ("awwwards-worthy",
"tasteful", "the visitor") to precise meanings so design and motion decisions stay consistent.
This file is a glossary only — decisions live in `docs/adr/`; the architecture as built is walked
through in `docs/onboarding.html`.

## Language

**Awwwards-worthy**:
Built to the craft bar implied by the Awwwards rubric (Design 40% · Usability 30% ·
Creativity 20% · Content 10%) — not necessarily submitted. Pursued in two phases (see _Phase 1_,
_Phase 2_).
_Avoid_: "award-winning" (overclaims), "flashy", "fancy"

**Phase 1**:
The hiring portfolio, built to awwwards-craft standard. Optimises for the _Visitor_. The hiring
goal is served by impressing through craft and experience — not by fast information scanning.

**Phase 2**:
Pushing the concept far enough for an actual juried submission (the _Juror_). Sequenced after
Phase 1; same immersion-first priorities, higher polish and originality bar.

**Visitor** (who I optimise for):
Someone who engages with the experience. **Immersion outranks information scan-speed — even in
Phase 1.** (Supersedes an earlier "recruiter-speed wins" rule, dropped 2026-06-19.)

**Recruiter**:
A hiring reviewer doing a fast skim. Acknowledged, but explicitly **not** the optimisation target
— I bet on impressing them through craft, not catering to a 5-second skim.
_Avoid_: "user" (too vague)

**Juror**:
An Awwwards evaluator (or design peer) who gives ~60s to an immersive concept and rewards
originality + craft over information speed.
_Avoid_: "judge"

**Page** (retired):
The multipage framing — one URL per destination (`/`, `/work`, `/about`, `/contact`) with a
transition on entry/exit. Routing was removed when the site pivoted to the loop; there are no routes
in the app. Use _Destination_.
_Avoid_: "page", "route" (both describe the superseded framing)

**Less but better**:
The site's anchor principle (Dieter Rams), stated in the About copy. For motion it means restraint
over spectacle: opacity / blur / depth over distance, long calm `--ease-out-expo`, monochrome.
High-drama ideas (hyperspace warp, supernova) are explicitly rejected.
_Avoid_: "minimalist" used alone (implies sparse, which is not the point)

## The concept — Star-map wayfinding

**Star-map wayfinding**:
The unifying concept: the cosmos is the navigation system, not decoration. Each section of the loop
is a _Destination_; moving between them is _Travel_ across the star map; the constellation morph IS
the transition, driven continuously by scroll position.

**Destination**:
A full-viewport section of the looping scroll, presented as a place in the star map — Home, Work
(labelled "Experience"), About, Certifications, Contact. Each owns a constellation. Defined once in
`destinations.ts`, the single source of truth the shell sections, nav links, and constellation order
all derive from.
_Avoid_: "route" / "page" (that was the superseded multipage framing)

**Travel**:
Moving across the starfield from one _Destination_'s constellation to the next. Now scroll-driven:
the morph tracks scroll position continuously rather than firing on a navigation event. Must have a
reduced-motion / text-nav fallback.
_Avoid_: "page transition" (there is no routing); "background stars" (they are the map now, not a
backdrop)

**Constellation** (a Destination's emblem):
A **real** astronomical figure, one per _Destination_ — Ursa Major (Home), Orion (Work), Leo
(About), Corona Borealis (Certifications), Cygnus (Contact). All share the **same star count**
(`STAR_COUNT = 8`) so any two morph 1:1, but each keeps its **own real asterism lines**, which
cross-fade through the dim point of each transition. Authored in the `Star`/`Link` data format in
`constellation.figures.ts`. (Bespoke, meaning-evoking figures were the original plan; ADR-0003
replaced them with real ones — see [ADR-0003](adr/0003-looping-scroll-real-constellations.md).)

**Wayfinding** (how nav reveals):
**Progressive.** A conventional labeled nav is the baseline and always operable (keyboard,
screen-reader, reduced-motion). The star-map interaction is revealed as an enhancement for visitors
who explore. The map is **never the only way** to navigate.

## The loop

> The site is now ONE continuous, downward-looping vertical scroll. The multipage routes were first
> made vestigial by the pivot and have since been removed entirely — there is no router in the app.
> See [ADR-0003](adr/0003-looping-scroll-real-constellations.md) for the pivot and
> [ADR-0004](adr/0004-seamless-loop-clone-wrap.md) for the seamless wrap.

**Cycle**:
One full pass through the five _Destinations_ (Home → Work → About → Certifications → Contact). In pixels it is the
scroll offset of the _Loop clone_'s top; the wrap subtracts exactly one cycle.

**Seam**:
The wrap point where the bottom of the loop rejoins the top. It is _invisible_: the reset happens on
a frame where the _Loop clone_ is pixel-identical to the real Home.
_Avoid_: "teleport" / "snap" (that was the old, visible behaviour I replaced).

**Loop clone**:
A second, non-interactive copy of the Home section placed after Contact. It gives the Contact→Home
morph its scroll distance _and_ acts as the seam buffer. It is `inert` + `aria-hidden` (no duplicate
tab stops or landmarks) and always visible (never caught mid-reveal).

**One-direction**:
The loop only wraps **downward**; scrolling up is normal native scroll and clamps at Home. Fully
bidirectional looping was rejected (fights native scroll at the top; jank risk).

## Interaction states & surfaces

**Nav fade**:
While scrolled away from Home, the Work/About/Certifications/Contact links fade to a faint ghost (still
focusable) and the Home (house) icon shrinks and mutes; full nav appears only at the Home
_Destination_. Driven by loop-aware distance-from-Home (not raw `scrollY`), so it is symmetric
around the _Seam_ and never pops there. Reveals to full on hover / focus; off under reduced
motion. See [ADR-0005](adr/0005-loop-aware-nav-muting.md).

**Icon at viewport centre**:
The instant a card's icon crosses the vertical middle of the viewport — an `IntersectionObserver`
with `rootMargin: -50% 0 -50% 0`. It triggers the icon glow.

**Icon glow on centre**:
The one-shot icon animation played each time an icon reaches viewport centre — a small `scale`
pop with the glow ramping on, then settling back. Replaces the old hover-only infinite glow
(hover still works). Re-arms on exit, so it recurs each loop. Off under reduced motion.

**Glass card**:
The frosted content-card surface: a high-opacity warm tint + conservative `backdrop-filter` blur,
hairline border with a top highlight, and a depth shadow, with an opaque `@supports` fallback.
Keeps text contrast and performance safe. See [ADR-0006](adr/0006-glass-card-surface.md).
