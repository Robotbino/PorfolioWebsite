import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  QueryList,
  ViewChildren,
} from '@angular/core';

@Component({
  selector: 'app-about',
  standalone: false,
  templateUrl: './about.component.html',
  styleUrl: './about.component.css',
})
export class AboutComponent implements AfterViewInit, OnDestroy {
  @ViewChildren('cardIcon') private icons!: QueryList<ElementRef<HTMLElement>>;
  private io?: IntersectionObserver;

  constructor(private zone: NgZone) {}

  ngAfterViewInit(): void {
    // The glow is a non-essential flourish, so reduced-motion users skip it.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    // Fire when an icon crosses the viewport's vertical middle: the negative
    // top/bottom margins collapse the observer root to a 1px line at centre.
    // Toggling the class (not (un)observing) re-arms the one-shot each crossing.
    // Run outside Angular so the per-crossing class toggle never trips change
    // detection.
    this.zone.runOutsideAngular(() => {
      this.io = new IntersectionObserver(
        (entries) =>
          entries.forEach((e) => e.target.classList.toggle('is-centered', e.isIntersecting)),
        { rootMargin: '-50% 0px -50% 0px', threshold: 0 },
      );
      this.icons.forEach((i) => this.io!.observe(i.nativeElement));
    });
  }

  ngOnDestroy(): void {
    this.io?.disconnect();
  }
}
