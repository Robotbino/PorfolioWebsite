import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChildren,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { Constellation, Link, Star } from './constellation.model';
import { interpolateConstellation } from './constellation-morph';
import { TravelService } from './travel.service';

type RouteKey = 'home' | 'work' | 'about' | 'contact';

@Component({
  selector: 'app-constellation',
  standalone: false,
  templateUrl: './constellation.component.html',
  styleUrl: './constellation.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConstellationComponent implements OnInit, AfterViewInit, OnDestroy {
  // One skeleton shared by every destination so any two morph 1:1 with no link
  // "pop" (the morph reuses the `from` figure's links). See ADR-0002.
  // Tree: head(0)→shoulders(1)→waist(2)→hips(3); arms off 1, legs off 3.
  private static readonly LINKS: readonly Link[] = [
    { a: 0, b: 1 },
    { a: 1, b: 2 },
    { a: 2, b: 3 },
    { a: 1, b: 4 },
    { a: 1, b: 5 },
    { a: 3, b: 6 },
    { a: 3, b: 7 },
  ];

  // Per-index drift/size traits, identical across figures so star i keeps its
  // character (and its drift stays continuous) all the way through a morph.
  private static readonly R = [3.3, 2.6, 2.2, 2.5, 2.7, 2.7, 2.6, 2.6];
  private static readonly AMP = [6, 5, 5, 6, 6, 6, 7, 7];
  private static readonly PHX = [0.0, 0.8, 1.6, 2.4, 3.2, 4.0, 4.8, 5.6];
  private static readonly PHY = [1.0, 2.2, 0.4, 1.7, 2.6, 0.9, 1.5, 3.0];

  // One bespoke, equal-count (8-star) constellation per destination. Stars are
  // listed in index order so the shared LINKS line up. 300×300 viewBox.
  private readonly byRoute: Record<RouteKey, Constellation> = {
    // Lodestar — a four-point compass star: the wayfinding origin.
    home: this.figure('Lodestar', [
      [150, 42],
      [150, 150],
      [150, 180],
      [150, 206],
      [52, 150],
      [248, 150],
      [106, 256],
      [194, 256],
    ]),
    // The Ascent — a mountain summit with a wide base: craft, things built.
    work: this.figure('The Ascent', [
      [150, 48],
      [150, 120],
      [150, 168],
      [150, 206],
      [92, 156],
      [208, 156],
      [50, 252],
      [250, 252],
    ]),
    // The Wanderer — a striding human figure (the lone asymmetric emblem).
    about: this.figure('The Wanderer', [
      [146, 52],
      [150, 116],
      [150, 165],
      [152, 196],
      [90, 80],
      [210, 150],
      [112, 254],
      [196, 242],
    ]),
    // The Messenger — a paper-plane dart pointing outward: reaching out.
    contact: this.figure('The Messenger', [
      [252, 150],
      [150, 150],
      [116, 150],
      [84, 150],
      [70, 92],
      [70, 208],
      [56, 120],
      [56, 180],
    ]),
  };

  // The rendered skeleton is fixed (count + topology are invariant), so the
  // template iterates these stable handles and the rAF positions them.
  readonly topology = ConstellationComponent.LINKS;
  readonly starIndices = [0, 1, 2, 3, 4, 5, 6, 7];
  readonly radii = ConstellationComponent.R;

  @ViewChildren('starEl') private starEls!: QueryList<ElementRef<SVGGElement>>;
  @ViewChildren('lineEl') private lineEls!: QueryList<ElementRef<SVGLineElement>>;

  private rafId = 0;
  private reduceMotion = false;
  private viewReady = false;
  private groups: SVGGElement[] = [];
  private segments: SVGLineElement[] = [];
  private readonly subs = new Subscription();

  constructor(
    private zone: NgZone,
    private router: Router,
    private travel: TravelService,
  ) {}

  ngOnInit(): void {
    this.travel.init(this.byRoute[this.routeKey(this.router.url)]);
    this.subs.add(
      this.router.events
        .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
        .subscribe((e) => {
          this.travel.travelTo(this.byRoute[this.routeKey(e.urlAfterRedirects)]);
          // With motion, the perpetual rAF picks the trip up; with reduced
          // motion there is no loop, so paint the instant cut once.
          if (this.reduceMotion && this.viewReady) {
            this.renderAt(performance.now());
          }
        }),
    );
  }

  ngAfterViewInit(): void {
    this.groups = this.starEls.map((el) => el.nativeElement);
    this.segments = this.lineEls.map((el) => el.nativeElement);
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.viewReady = true;

    // Paint the resting figure before the first frame so there is no flash.
    this.renderAt(performance.now());

    if (!this.reduceMotion) {
      this.zone.runOutsideAngular(() => {
        this.rafId = requestAnimationFrame(this.tick);
      });
    }
  }

  private tick = (now: number): void => {
    this.renderAt(now);
    this.rafId = requestAnimationFrame(this.tick);
  };

  /** Position every star/line for the morph frame at `now`, plus gentle drift. */
  private renderAt(now: number): void {
    const groups = this.groups;
    if (groups.length !== this.starIndices.length) {
      return;
    }

    // Advance the trip; when idle this is the resting figure (no allocation).
    const t = this.travel.easedProgressAt(now);
    const stars: Star[] =
      this.travel.phase() === 'travelling'
        ? interpolateConstellation(this.travel.from, this.travel.to, t).stars
        : this.travel.to.stars;

    const drift = this.reduceMotion ? 0 : 1;
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
      groups[i].setAttribute('transform', `translate(${px[i].toFixed(2)},${py[i].toFixed(2)})`);
    }

    const links = this.topology;
    const segs = this.segments;
    if (segs.length === links.length) {
      for (let i = 0; i < links.length; i++) {
        const { a, b } = links[i];
        const seg = segs[i];
        seg.setAttribute('x1', px[a].toFixed(2));
        seg.setAttribute('y1', py[a].toFixed(2));
        seg.setAttribute('x2', px[b].toFixed(2));
        seg.setAttribute('y2', py[b].toFixed(2));
      }
    }
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.rafId);
    this.subs.unsubscribe();
  }

  /** Build a constellation from index-ordered coordinates + the shared traits. */
  private figure(name: string, coords: ReadonlyArray<readonly [number, number]>): Constellation {
    const stars: Star[] = coords.map(([x, y], i) => ({
      name: `${name} ${i + 1}`,
      x,
      y,
      r: ConstellationComponent.R[i],
      phx: ConstellationComponent.PHX[i],
      phy: ConstellationComponent.PHY[i],
      amp: ConstellationComponent.AMP[i],
    }));
    return {
      name,
      side: 'left',
      viewBox: '0 0 300 300',
      stars,
      links: ConstellationComponent.LINKS as Link[],
    };
  }

  private routeKey(url: string): RouteKey {
    const seg = url.split(/[?#]/)[0].replace(/^\/+/, '').split('/')[0];
    return seg === 'work' || seg === 'about' || seg === 'contact' ? seg : 'home';
  }
}
