/**
 * Static copy that drives the Certifications page, mirroring work-data.ts.
 *
 * Titles, issuers and verify URLs are credentials: they reproduce the issuer's
 * record verbatim and must not be embellished. `img`/`alt` are presentation
 * only — a scan of the certificate for the preview and spotlight.
 */

export interface Certification {
  readonly title: string;
  readonly issuer: string;
  /**
   * When it was issued, already formatted for display (e.g. 'March 2025').
   * Every credential here is currently undated, which leaves a reviewer unable
   * to tell a recent certificate from an old one. Null rather than guessed —
   * the row renders the date only when it is real.
   *
   * TODO(Bino): fill these in from the verify links; each one shows its date.
   */
  readonly issued: string | null;
  readonly href: string;
  readonly img: string;
  readonly alt: string;
}

export const CERTIFICATIONS: readonly Certification[] = [
  {
    title: 'Artificial Intelligence Fundamentals',
    issuer: 'IBM',
    issued: null,
    href: 'https://www.credly.com/badges/68d7322a-1584-4605-951d-e84b73cef357/public_url',
    img: '/assets/certs/ibm-ai-fundamentals.webp',
    alt: 'Artificial Intelligence Fundamentals certificate from IBM',
  },
  {
    title: 'JavaScript',
    issuer: 'Scrimba',
    issued: null,
    href: 'https://scrimba.com/u42ef1c4:certs;cert24zAwPPowS2rZVEfEZ2kSBedSKFrfvEXo19z4',
    img: '/assets/certs/scrimba-javascript.webp',
    alt: 'Learn JavaScript certificate from Scrimba',
  },
  {
    title: 'HTML and CSS Fundamentals',
    issuer: 'Scrimba',
    issued: null,
    href: 'https://scrimba.com/u42ef1c4:certs;cert24zAwPPowS2rZVEfEZ2kSBd99ByKWBUFmmm1J',
    img: '/assets/certs/scrimba-html-css.webp',
    alt: 'Learn HTML and CSS certificate from Scrimba',
  },
  {
    title: 'Claude 101',
    issuer: 'Anthropic Academy',
    issued: null,
    href: 'https://verify.skilljar.com/c/2qgjschtf8e8',
    img: '/assets/certs/anthropic-claude-101.webp',
    alt: 'Claude 101 certificate of completion from Anthropic',
  },
  {
    title: 'Claude Code 101',
    issuer: 'Anthropic Academy',
    issued: null,
    href: 'https://verify.skilljar.com/c/5zfaiayuzaeq',
    img: '/assets/certs/anthropic-claude-code-101.webp',
    alt: 'Claude Code 101 certificate of completion from Anthropic',
  },
] as const;
