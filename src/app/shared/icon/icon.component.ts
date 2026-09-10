import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ICONS, IconName } from './icons';

/**
 * One inline SVG glyph, sized and coloured by the surrounding text.
 *
 * Replaces the Font Awesome `<i class="fa-…">` idiom. The svg is `1em` square
 * with `fill: currentColor`, so every call site keeps working the way the icon
 * font did: set `font-size` and `color` on this element and the glyph follows.
 *
 * The one thing that does NOT carry over is `text-shadow` — a glyph drawn as a
 * path takes `filter: drop-shadow()` instead (see the About ledger's glow).
 */
@Component({
  selector: 'app-icon',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg
    [attr.viewBox]="icon.viewBox"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    <path [attr.d]="icon.path" />
  </svg>`,
  styles: [
    `
      :host {
        display: inline-block;
        /* Match the optical baseline an icon font sits on, so swapping the
           element in doesn't shift any row it shares with text. */
        vertical-align: -0.125em;
        line-height: 1;
      }
      svg {
        display: block;
        width: 1em;
        height: 1em;
        fill: currentColor;
      }
    `,
  ],
})
export class IconComponent {
  /** Which glyph to draw. Compile-checked against the ICONS map. */
  @Input({ required: true }) name!: IconName;

  get icon(): { viewBox: string; path: string } {
    return ICONS[this.name];
  }
}
