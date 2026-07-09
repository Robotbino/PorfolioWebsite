/**
 * Static copy that drives the Certifications page, mirroring work-data.ts.
 * Render this list verbatim — titles, issuers and verify URLs are credentials
 * and must never be embellished or extended here.
 */

export interface Certification {
  readonly title: string;
  readonly issuer: string;
  readonly href: string;
}

export const CERTIFICATIONS: readonly Certification[] = [
  {
    title: 'Artificial Intelligence Fundamentals',
    issuer: 'IBM',
    href: 'https://www.credly.com/badges/68d7322a-1584-4605-951d-e84b73cef357/public_url',
  },
  {
    title: 'JavaScript',
    issuer: 'Scrimba',
    href: 'https://scrimba.com/u42ef1c4:certs;cert24zAwPPowS2rZVEfEZ2kSBedSKFrfvEXo19z4',
  },
  {
    title: 'HTML and CSS Fundamentals',
    issuer: 'Scrimba',
    href: 'https://scrimba.com/u42ef1c4:certs;cert24zAwPPowS2rZVEfEZ2kSBd99ByKWBUFmmm1J',
  },
  {
    title: 'Claude 101',
    issuer: 'Anthropic Academy',
    href: 'https://verify.skilljar.com/c/2qgjschtf8e8',
  },
  {
    title: 'Claude Code 101',
    issuer: 'Anthropic Academy',
    href: 'https://verify.skilljar.com/c/5zfaiayuzaeq',
  },
] as const;
