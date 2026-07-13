/**
 * The star-map's destinations — the single source of truth for the looping
 * cycle's list: which stops exist, their order, their labels, and which
 * constellation figure each shows. The shell sections, the nav links, and the
 * constellation `order` all derive from this one list instead of hand-syncing
 * three parallel copies, so adding a destination is one edit and the ids can't
 * drift. See docs/adr/0007 and the C2 Decision Document.
 *
 * Deliberately imports nothing from the constellation: the figure key is a plain
 * string union so the dependency runs one way (constellation.figures consumes
 * THIS to build its order). `destinations.spec.ts` guards that every key here
 * resolves to a real figure, so the loose type can't silently drift.
 *
 * Not modelled here (explicit template exceptions, by design): the `#projects`
 * sub-anchor inside Work, and the desktop bar omitting Home (the logo is Home).
 * Those two one-offs stay hand-written in the nav template.
 */

/** A constellation figure key — must resolve in `byRoute` (spec-guarded). */
export type DestinationFigure = 'home' | 'work' | 'about' | 'certifications' | 'contact';

export interface Destination {
  /** DOM id of the section and the target of its nav-link `href`. */
  id: string;
  /** Visible nav-link text (not always the capitalised id — Work is "Experience"). */
  label: string;
  /** Which constellation figure this destination shows (key into `byRoute`). */
  figure: DestinationFigure;
}

/** The five destinations, in scroll order. Order = position in this array. */
export const DESTINATIONS: readonly Destination[] = [
  { id: 'dest-home', label: 'Home', figure: 'home' },
  { id: 'dest-work', label: 'Experience', figure: 'work' },
  { id: 'dest-about', label: 'About', figure: 'about' },
  { id: 'dest-certifications', label: 'Certifications', figure: 'certifications' },
  { id: 'dest-contact', label: 'Contact', figure: 'contact' },
];
