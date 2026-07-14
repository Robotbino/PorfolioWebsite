import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  QueryList,
  ViewChildren,
} from '@angular/core';
import { Constellation, Link, Star } from './constellation.model';
import { interpolateConstellation } from './constellation-morph';
import { MAX_LINKS, R, STAR_COUNT, order } from './constellation.figures';
import { MorphDriver } from './morph-driver';
import { ScrollLoopService } from '../scroll-loop.service';
import { FramePulseService } from '../core/frame-pulse.service';
import { MotionSettingsService } from '../core/motion-settings.service';

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

  private readonly driver = new MorphDriver();
  private unsub: (() => void) | null = null;
  private reduceMotion = false;
  private groups: SVGGElement[] = [];
  private fromSegs: SVGLineElement[] = [];
  private toSegs: SVGLineElement[] = [];

  constructor(
    private loop: ScrollLoopService,
    private pulse: FramePulseService,
    private motion: MotionSettingsService,
  ) {}

  ngAfterViewInit(): void {
    this.groups = this.starEls.map((el) => el.nativeElement);
    this.fromSegs = this.lineFromEls.map((el) => el.nativeElement);
    this.toSegs = this.lineToEls.map((el) => el.nativeElement);
    this.reduceMotion = this.motion.reducedMotion();

    this.renderAt(performance.now());
    this.unsub = this.pulse.onTick((now) => this.renderAt(now));
  }

  private renderAt(now: number): void {
    const groups = this.groups;
    if (groups.length !== this.starIndices.length) {
      return;
    }

    const count = this.loop.cycleLength || this.order.length;
    const target = this.loop.position();
    const frame = this.driver.advance(target, count, this.reduceMotion);

    const from = this.order[frame.fromIndex];
    const to = this.order[frame.toIndex];
    const stars: Star[] = interpolateConstellation(from, to, frame.eased).stars;

    const drift = this.reduceMotion ? 0 : 1;
    const settle = (1 - 0.18 * frame.transit).toFixed(3);
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

    const dim = 1 - 0.5 * frame.transit;
    this.drawLinks(this.fromSegs, from.links, px, py, dim * (1 - frame.frac));
    this.drawLinks(this.toSegs, to.links, px, py, dim * frame.frac);
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
    this.unsub?.();
  }
}
