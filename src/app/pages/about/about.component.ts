import {
  ChangeDetectionStrategy,
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  QueryList,
  ViewChildren,
  inject,
} from '@angular/core';
import { MotionSettingsService } from '../../core/motion-settings.service';
import { InViewportService } from '../../core/in-viewport.service';
import { ScrollRevealDirective } from '../../scroll-reveal.directive';
import { IconComponent } from '../../shared/icon/icon.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrl: './about.component.css',
  imports: [ScrollRevealDirective, IconComponent],
})
export class AboutComponent implements AfterViewInit, OnDestroy {
  private motion = inject(MotionSettingsService);
  private inView = inject(InViewportService);

  @ViewChildren('cardIcon') private icons!: QueryList<ElementRef<HTMLElement>>;
  private releases: (() => void)[] = [];

  ngAfterViewInit(): void {
    // The glow is a non-essential flourish, so reduced-motion users skip it.
    if (this.motion.reducedMotion()) {
      return;
    }
    // Fire when an icon crosses the viewport's vertical middle: the negative
    // top/bottom margins collapse the observer root to a 1px line at centre.
    // Toggling the class (not (un)observing) re-arms it on each crossing. The
    // seam runs the callback outside Angular, so the toggle never trips CD.
    this.icons.forEach((i) => {
      const el = i.nativeElement;
      this.releases.push(
        this.inView.observe(el, { rootMargin: '-50% 0px -50% 0px', threshold: 0 }, (visible) =>
          el.classList.toggle('is-centered', visible),
        ),
      );
    });
  }

  ngOnDestroy(): void {
    this.releases.forEach((release) => release());
  }
}
