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
import { ScrollStageService } from '../scroll-stage.service';

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
  // Every figure has 8 stars so positions morph 1:1, but each keeps its OWN real
  // asterism lines (counts/patterns differ), which cross-fade through the dim
  // point of each transition. Supersedes the equal-topology note in ADR-0002.
  private static readonly STAR_COUNT = 8;
  private static readonly MAX_LINKS = 8;

  // Per-index drift/size traits, shared across figures so a star keeps its
  // character (and its drift stays continuous) all the way through a morph.
  private static readonly R = [3.3, 2.6, 2.2, 2.5, 2.7, 2.7, 2.6, 2.6];
  private static readonly AMP = [6, 5, 5, 6, 6, 6, 7, 7];
  private static readonly PHX = [0.0, 0.8, 1.6, 2.4, 3.2, 4.0, 4.8, 5.6];
  private static readonly PHY = [1.0, 2.2, 0.4, 1.7, 2.6, 0.9, 1.5, 3.0];

  // Four real constellations (8 stars each), in a 300×300 viewBox. Stars are
  // listed in index order; links are each figure's real connect-the-dots shape.
  private readonly byRoute = {
    // Ursa Major / the Big Dipper — the navigator's constellation (Home).
    home: this.figure(
      'Ursa Major',
      [
        [60, 90], // Dubhe
        [72, 162], // Merak
        [142, 168], // Phecda
        [135, 100], // Megrez
        [196, 122], // Alioth
        [245, 150], // Mizar
        [288, 184], // Alkaid
        [255, 137], // Alcor
      ],
      [
        { a: 0, b: 1 },
        { a: 1, b: 2 },
        { a: 2, b: 3 },
        { a: 3, b: 0 },
        { a: 3, b: 4 },
        { a: 4, b: 5 },
        { a: 5, b: 6 },
      ],
    ),
    // Orion — the hunter (Work).
    work: this.figure(
      'Orion',
      [
        [96, 96], // Betelgeuse
        [176, 84], // Bellatrix
        [138, 48], // Meissa (head)
        [120, 166], // Alnitak (belt)
        [140, 176], // Alnilam (belt)
        [160, 186], // Mintaka (belt)
        [110, 250], // Saiph
        [186, 244], // Rigel
      ],
      [
        { a: 2, b: 0 },
        { a: 2, b: 1 },
        { a: 0, b: 3 },
        { a: 1, b: 5 },
        { a: 3, b: 4 },
        { a: 4, b: 5 },
        { a: 3, b: 6 },
        { a: 5, b: 7 },
      ],
    ),
    // Leo — the lion (About).
    about: this.figure(
      'Leo',
      [
        [215, 185], // Regulus
        [212, 158], // Eta
        [221, 128], // Algieba
        [205, 104], // Zeta
        [180, 90], // Mu
        [152, 102], // Epsilon
        [120, 150], // Zosma
        [58, 176], // Denebola
      ],
      [
        { a: 0, b: 1 },
        { a: 1, b: 2 },
        { a: 2, b: 3 },
        { a: 3, b: 4 },
        { a: 4, b: 5 },
        { a: 0, b: 6 },
        { a: 6, b: 7 },
        { a: 7, b: 0 },
      ],
    ),
    // Cygnus / the Northern Cross — the swan in flight (Contact).
    contact: this.figure(
      'Cygnus',
      [
        [150, 55], // Deneb
        [150, 135], // Sadr
        [150, 255], // Albireo (beak)
        [150, 196], // Eta
        [90, 150], // Gienah
        [45, 160], // left wing tip
        [215, 124], // Delta
        [258, 114], // right wing tip
      ],
      [
        { a: 0, b: 1 },
        { a: 1, b: 3 },
        { a: 3, b: 2 },
        { a: 5, b: 4 },
        { a: 4, b: 1 },
        { a: 1, b: 6 },
        { a: 6, b: 7 },
      ],
    ),
  };

  // Destinations in scroll order; the morph runs between adjacent entries and
  // wraps from the last back to the first (the star map loops endlessly).
  private readonly order: Constellation[] = [
    this.byRoute.home,
    this.byRoute.work,
    this.byRoute.about,
    this.byRoute.contact,
  ];

  // Stable handles for the template; positions/links are set imperatively.
  readonly starIndices = Array.from({ length: ConstellationComponent.STAR_COUNT }, (_, i) => i);
  readonly linkSlots = Array.from({ length: ConstellationComponent.MAX_LINKS }, (_, i) => i);
  readonly radii = ConstellationComponent.R;

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
    private stage: ScrollStageService,
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

    const count = this.order.length;
    const target = this.stage.position;

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

  /** Build a constellation from index-ordered coordinates + its own real links. */
  private figure(
    name: string,
    coords: ReadonlyArray<readonly [number, number]>,
    links: Link[],
  ): Constellation {
    const stars: Star[] = coords.map(([x, y], i) => ({
      name: `${name} ${i + 1}`,
      x,
      y,
      r: ConstellationComponent.R[i],
      phx: ConstellationComponent.PHX[i],
      phy: ConstellationComponent.PHY[i],
      amp: ConstellationComponent.AMP[i],
    }));
    return { name, side: 'left', viewBox: '0 0 300 300', stars, links };
  }
}
