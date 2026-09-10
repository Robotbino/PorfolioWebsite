import { Injectable } from '@angular/core';

/**
 * Makes everything outside an open overlay unreachable, so Tab cannot walk out
 * of a modal and into the page behind it.
 *
 * Both overlays on this site promise they are modal and neither kept the
 * promise. The certifications spotlight is `aria-modal="true"` and wraps Tab
 * between its Verify and Close controls — but that handler is bound to the
 * dialog, so it only fires while focus is already inside: click the certificate
 * image (not focusable), focus falls to `<body>`, and the next Tab lands in the
 * page behind the overlay. The mobile menu never contained Tab at all — its
 * overlay is the last element in the DOM, so Tab from the last link walks
 * straight into the content behind the scrim.
 *
 * `inert` answers both, and answers them better than a hand-rolled trap: the
 * browser drops the subtree from the tab order AND from the accessibility tree.
 *
 * The mechanism is sibling isolation rather than "inert the page", because the
 * spotlight renders INSIDE `<main>` (it belongs to the certifications
 * component). Inerting `<main>` would disable the dialog along with everything
 * else, and `inert` cannot be lifted on a descendant. So `isolate()` walks from
 * the overlay up to `<body>` and inerts every sibling along that path, leaving
 * exactly one reachable branch: the overlay's own.
 *
 * Elements that were ALREADY inert are left alone and never cleared on release
 * — the loop clone (app.component.html) is permanently inert and sits inside
 * `<main>`, so a naive restore would quietly hand it back its tab stops and
 * duplicate the whole hero for keyboard users.
 *
 * Ref-counted like ScrollLockService, which these callers acquire alongside.
 * Nested overlays are honoured: the LAST isolate wins while it is held, and
 * releasing it restores the one underneath.
 */
@Injectable({ providedIn: 'root' })
export class PageInertService {
  /** One entry per live isolate(), innermost last. */
  private readonly held: HTMLElement[][] = [];

  /**
   * Inert everything outside the given elements' own branches of the DOM.
   *
   * Usually one element — the overlay. The mobile menu passes two: the overlay
   * AND its hamburger, because that button lives inside the `<header>` and
   * morphs into the menu's close control. Inerting the header wholesale would
   * make the visible way out unclickable, and `inert` cannot be lifted on a
   * descendant, so the trigger has to be named as a second protected path. Its
   * neighbours in the bar (the logo, the desktop links) still go inert, which is
   * the escape route that mattered.
   *
   * Returns an idempotent release handle.
   */
  isolate(...keep: HTMLElement[]): () => void {
    const touched: HTMLElement[] = [];

    // Every node on any protected path, so a sibling that IS such a path is
    // never inerted (the header is a sibling of the overlay and an ancestor of
    // the trigger).
    const onPath = new Set<Element>();
    for (const el of keep) {
      for (
        let node: Element | null = el;
        node && node !== document.body;
        node = node.parentElement
      ) {
        onPath.add(node);
      }
    }

    for (const el of keep) {
      for (let node: HTMLElement | null = el; node && node !== document.body;) {
        const parent: HTMLElement | null = node.parentElement;
        if (!parent) {
          break;
        }
        for (const sibling of Array.from(parent.children)) {
          // Skip protected paths, non-HTML elements, and anything already inert
          // (its own code owns that attribute, not us).
          if (!onPath.has(sibling) && sibling instanceof HTMLElement && !sibling.inert) {
            sibling.inert = true;
            touched.push(sibling);
          }
        }
        node = parent;
      }
    }

    this.held.push(touched);

    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      const index = this.held.indexOf(touched);
      if (index !== -1) {
        this.held.splice(index, 1);
      }
      for (const el of touched) {
        // Another live isolate may still need this element inert.
        if (!this.held.some((set) => set.includes(el))) {
          el.inert = false;
        }
      }
    };
  }
}
