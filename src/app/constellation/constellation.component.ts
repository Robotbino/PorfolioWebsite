import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  QueryList,
  ViewChildren,
} from '@angular/core';
import { Constellation, Link, Star } from './constellation.model';
import { interpolateConstellation } from './constellation-morph';
import { MAX_LINKS, R, STAR_COUNT, order } from './constellation.figures';
import { ScrollLoopService } from '../scroll-loop.service';

/** The locked spike easing — applied per scroll segment so figures settle at rest. */
const easeInOutQuart = (t: number): number =>
  t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;

@Component({
  selector: 'app-constellation',
  standalone: false,
  templateUrl: './constellation.component.html',
  styleUrl: './constellation.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConstellationComponent implements AfterViewInit, OnDestroy {
  // The morph cycles through these in scroll order; figure data lives in
  // constellation.figures.ts so this file stays focused on driving the morph.
  private readonly order: Constellation[] = order;

  // Stable handles for the template; positions/links are set imperatively.
  readonly starIndices = Array.from({ length: STAR_COUNT }, (_, i) => i);
  readonly linkSlots = Array.from({ length: MAX_LINKS }, (_, i) => i);
  readonly radii = R;

  @ViewChildren('starEl') private starEls!: QueryList<ElementRef<SVGGElement>>;
  @ViewChildren('lineFrom') private lineFromEls!: QueryList<ElementRef<SVGLineElement>>;
  @ViewChildren('lineTo') private lineToEls!: QueryList<ElementRef<SVGLineElement>>;

  private rafId = 0;
  private reduceMotion = false;
  private groups: SVGGElement[] = [];
  private fromSegs: SVGLineElement[] = [];
  private toSegs: SVGLineElement[] = [];
  // Eased scroll position (inertia) + smoothed scroll speed (the star-settle).
  private rendered = 0;
  private smoothedVel = 0;

  constructor(
    private zone: NgZone,
    private loop: ScrollLoopService,
  ) {}

  ngAfterViewInit(): void {
    this.groups = this.starEls.map((el) => el.nativeElement);
    this.fromSegs = this.lineFromEls.map((el) => el.nativeElement);
    this.toSegs = this.lineToEls.map((el) => el.nativeElement);
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Paint once before the first frame so there is no flash, then drive the
    // morph off scroll position from a single out-of-zone rAF.
    this.renderAt(performance.now());
    this.zone.runOutsideAngular(() => {
      this.rafId = requestAnimationFrame(this.tick);
    });
  }

  private tick = (now: number): void => {
    this.renderAt(now);
    this.rafId = requestAnimationFrame(this.tick);
  };

  /** Position the stars for the scroll-driven morph and cross-fade the lines. */
  private renderAt(now: number): void {
    const groups = this.groups;
    if (groups.length !== this.starIndices.length) {
      return;
    }

    // The loop is the single source of the cycle length; fall back to this
    // figure set's own length before the shell has measured (loop length 0).
    const count = this.loop.cycleLength || this.order.length;
    const target = this.loop.position();

    let transit = 0;
    if (this.reduceMotion) {
      this.rendered = ((target % count) + count) % count; // snap, no inertia
    } else {
      // Ease the rendered position toward the scroll target along the SHORTEST
      // path on the looping circle, so the morph glides and the wrap seam stays
      // continuous (instead of unwinding backwards through every figure).
      let delta = target - this.rendered;
      delta -= count * Math.round(delta / count);
      const step = delta * 0.12;
      this.rendered = (((this.rendered + step) % count) + count) % count;

      // Scroll speed shrinks the stars + dims the links; they settle at rest.
      this.smoothedVel += (Math.abs(step) - this.smoothedVel) * 0.2;
      transit = Math.min(0.75, this.smoothedVel * 6);
    }

    const base = this.rendered;
    const idx = Math.floor(base);
    let from: Constellation;
    let to: Constellation;
    let frac: number;
    if (this.reduceMotion) {
      from = to = this.order[Math.round(base) % count]; // snap to nearest figure
      frac = 0;
    } else {
      from = this.order[idx];
      to = this.order[(idx + 1) % count];
      frac = base - idx;
    }

    const eased = frac < 1e-4 ? 0 : easeInOutQuart(frac);
    const stars: Star[] = interpolateConstellation(from, to, eased).stars;

    const drift = this.reduceMotion ? 0 : 1;
    const settle = (1 - 0.18 * transit).toFixed(3);
    const time = now / 1000;
    const speed = 0.5;
    const px = new Array<number>(stars.length);
    const py = new Array<number>(stars.length);

    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const ox = drift * s.amp * Math.sin(time * speed + s.phx);
      const oy = drift * s.amp * Math.cos(time * speed * 0.8 + s.phy);
      px[i] = s.x + ox;
      py[i] = s.y + oy;
      groups[i].setAttribute(
        'transform',
        `translate(${px[i].toFixed(2)},${py[i].toFixed(2)}) scale(${settle})`,
      );
    }

    // The outgoing figure's lines fade out as the incoming figure's fade in,
    // so the line pattern can change without a pop. Scroll speed dims both.
    const dim = 1 - 0.5 * transit;
    this.drawLinks(this.fromSegs, from.links, px, py, dim * (1 - frac));
    this.drawLinks(this.toSegs, to.links, px, py, dim * frac);
  }

  private drawLinks(
    segs: SVGLineElement[],
    links: Link[],
    px: number[],
    py: number[],
    opacity: number,
  ): void {
    const op = opacity.toFixed(3);
    for (let s = 0; s < segs.length; s++) {
      const seg = segs[s];
      if (s < links.length) {
        const { a, b } = links[s];
        seg.setAttribute('x1', px[a].toFixed(2));
        seg.setAttribute('y1', py[a].toFixed(2));
        seg.setAttribute('x2', px[b].toFixed(2));
        seg.setAttribute('y2', py[b].toFixed(2));
        seg.style.opacity = op;
      } else {
        seg.style.opacity = '0';
      }
    }
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.rafId);
  }
}
