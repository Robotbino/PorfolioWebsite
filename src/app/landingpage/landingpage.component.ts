import { Component, Input } from '@angular/core';
import { LocalClockService } from '../core/local-clock.service';

@Component({
  selector: 'app-landingpage',
  standalone: false,
  templateUrl: './landingpage.component.html',
  styleUrl: './landingpage.component.css',
})
export class LandingpageComponent {
  /**
   * True for the loop's seam clone (app.component.html), which renders a second
   * copy of this hero after Contact. The clone must look identical but must not
   * repeat anything the document can only have once — chiefly the `id`s, which
   * were duplicated into invalid HTML and made `aria-labelledby` on the clone
   * resolve to the real hero's heading.
   */
  @Input() clone = false;

  constructor(public clock: LocalClockService) {}
}
