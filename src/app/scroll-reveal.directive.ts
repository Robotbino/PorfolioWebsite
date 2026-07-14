import { Directive, ElementRef, OnInit, OnDestroy } from '@angular/core';
import { InViewportService } from './core/in-viewport.service';

@Directive({
  selector: '[appScrollReveal]',
  standalone: false,
})
export class ScrollRevealDirective implements OnInit, OnDestroy {
  private release?: () => void;

  constructor(
    private el: ElementRef<HTMLElement>,
    private inView: InViewportService,
  ) {}

  ngOnInit(): void {
    const host = this.el.nativeElement;
    host.classList.add('scroll-reveal');

    this.release = this.inView.observe(host, { threshold: 0.15 }, (visible) => {
      if (visible) {
        host.classList.add('revealed');
        this.release?.(); // one-shot: stop watching once revealed
      }
    });
  }

  ngOnDestroy(): void {
    this.release?.();
  }
}
