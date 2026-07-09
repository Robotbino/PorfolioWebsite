# Portfolio — Design Language

Glossary for Bino Hlongwana's personal portfolio. It pins fuzzy words ("awwwards-worthy",
"tasteful", "the visitor") to precise meanings so design and motion decisions stay consistent.
This file is a glossary only — decisions live in `docs/adr/`, scope lives in the handoff/plan.

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

**Visitor** (who we optimise for):
Someone who engages with the experience. **Immersion outranks information scan-speed — even in
Phase 1.** (Supersedes an earlier "recruiter-speed wins" rule, dropped 2026-06-19.)

**Recruiter**:
A hiring reviewer doing a fast skim. Acknowledged, but explicitly **not** the optimisation target
— we bet on impressing them through craft, not catering to a 5-second skim.
_Avoid_: "user" (too vague)

**Juror**:
An Awwwards evaluator (or design peer) who gives ~60s to an immersive concept and rewards
originality + craft over information speed.
_Avoid_: "judge"

**Page** (a.k.a. route):
A top-level destination with its own URL (`/`, `/work`, `/about`, `/contact`) and a transition on
entry/exit. **Not** a per-project detail page — those were ruled out by keeping cards shallow.

**Less but better**:
The site's anchor principle (Dieter Rams), stated in the About copy. For motion it means restraint
over spectacle: opacity / blur / depth over distance, long calm `--ease-out-expo`, monochrome.
High-drama ideas (hyperspace warp, supernova) are explicitly rejected.
_Avoid_: "minimalist" used alone (implies sparse, which is not the point)

## The concept — Star-map wayfinding

**Star-map wayfinding**:
The unifying concept: the cosmos is the navigation system, not decoration. Each _Page_ is a
_Destination_; navigating between them is _Travel_ across the star map; the constellation
morph / camera move IS the page transition.

**Destination**:
A route presented as a place in the star map — Home, Work, About, Contact. Each owns a
constellation.
_Avoid_: "section" (that was the single-page framing)

**Travel**:
The page transition, reframed: moving across the starfield from one _Destination_'s constellation
to the next (pan + morph). Must have a reduced-motion / text-nav fallback.
_Avoid_: "page transition" (use _Travel_); "background stars" (they are the map now, not a backdrop)

**Constellation** (a Destination's emblem):
A **bespoke** star figure (not a real astronomical one), one per _Destination_, all sharing the
**same star count** so any two morph 1:1 during _Travel_. Each shape evokes its page. Authored in
the existing `Star`/`Link` data format in `constellation.component.ts`.

**Wayfinding** (how nav reveals):
**Progressive.** A conventional labeled nav is the baseline and always operable (keyboard,
screen-reader, reduced-motion). The star-map interaction is revealed as an enhancement for visitors
who explore. The map is **never the only way** to navigate.

## The loop

> The site is now ONE continuous, downward-looping vertical scroll (the multipage routes are
> vestigial). See [ADR-0003](adr/0003-looping-scroll-real-constellations.md) for the pivot and
> [ADR-0004](adr/0004-seamless-loop-clone-wrap.md) for the seamless wrap.

**Cycle**:
One full pass through the five _Destinations_ (Home → Work → About → Certifications → Contact). In pixels it is the
scroll offset of the _Loop clone_'s top; the wrap subtracts exactly one cycle.

**Seam**:
The wrap point where the bottom of the loop rejoins the top. It is _invisible_: the reset happens on
a frame where the _Loop clone_ is pixel-identical to the real Home.
_Avoid_: "teleport" / "snap" (that was the old, visible behaviour we replaced).

**Loop clone**:
A second, non-interactive copy of the Home section placed after Contact. It gives the Contact→Home
morph its scroll distance _and_ acts as the seam buffer. It is `inert` + `aria-hidden` (no duplicate
tab stops or landmarks) and always visible (never caught mid-reveal).

**One-direction**:
The loop only wraps **downward**; scrolling up is normal native scroll and clamps at Home. Fully
bidirectional looping was rejected (fights native scroll at the top; jank risk).

## Interaction states & surfaces

**Nav fade**:
While scrolled away from Home, the Work/About/Contact links fade to a faint ghost (still
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
