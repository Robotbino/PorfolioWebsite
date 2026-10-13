import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { LocalClockService } from '../core/local-clock.service';
import { HeroParallaxService } from '../core/hero-parallax.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-landingpage',
  templateUrl: './landingpage.component.html',
  styleUrl: './landingpage.component.css',
})
export class LandingpageComponent implements OnInit, OnDestroy {
  clock = inject(LocalClockService);
  private parallax = inject(HeroParallaxService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private releaseParallax?: () => void;

  /**
   * True for the loop's seam clone (app.component.html), which renders a second
   * copy of this hero after Contact. The clone must look identical but must not
   * repeat anything the document can only have once — chiefly the `id`s, which
   * were duplicated into invalid HTML and made `aria-labelledby` on the clone
   * resolve to the real hero's heading.
   */
  @Input() clone = false;

  // The clone attaches too: both copies of the hero take their depth from the
  // one shared writer, so they stay identical across the loop seam.
  ngOnInit(): void {
    this.releaseParallax = this.parallax.attach(this.host.nativeElement);
  }

  ngOnDestroy(): void {
    this.releaseParallax?.();
  }
}
