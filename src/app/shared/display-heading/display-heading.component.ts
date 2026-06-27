import { Component, Input } from '@angular/core';

/**
 * Shared section eyebrow + headline pair (Nohemi).
 *
 * Renders the two-line `.section-header` block used at the top of routed
 * sections. Two string inputs: `pre` is the small uppercase eyebrow, `title`
 * is the headline.
 *
 * Usage: `<app-display-heading pre="Explore My" title="Experience" />`
 */
@Component({
  selector: 'app-display-heading',
  standalone: false,
  templateUrl: './display-heading.component.html',
  styleUrl: './display-heading.component.css',
})
export class DisplayHeadingComponent {
  @Input() pre = '';
  @Input() title = '';
  /** Optional id on the title element so the section can `aria-labelledby` it. */
  @Input() titleId?: string;
}
