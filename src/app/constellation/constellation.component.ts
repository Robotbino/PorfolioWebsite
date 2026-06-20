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
  signal,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { Constellation, Link, Star } from './constellation.model';

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
  // "pop" (the morph utility reuses the `from` figure's links). See ADR-0002.
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
  // listed in index order so the shared LINKS line up. Coordinates live in a
  // 300×300 viewBox.
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

  /** The destination figure for the active route. Drives the (OnPush) template. */
  readonly current = signal<Constellation>(this.byRoute.home);

  @ViewChildren('starEl') private starEls!: QueryList<ElementRef<SVGGElement>>;
  @ViewChildren('lineEl') private lineEls!: QueryList<ElementRef<SVGLineElement>>;

  private rafId = 0;
  private startTime = 0;
  private reduceMotion = false;
  private groups: SVGGElement[] = [];
  private segments: SVGLineElement[] = [];
  private stars: Star[] = [];
  private links: readonly Link[] = [];
  private readonly subs = new Subscription();

  constructor(
    private zone: NgZone,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.current.set(this.byRoute[this.routeKey(this.router.url)]);
    this.subs.add(
      this.router.events
        .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
        .subscribe((e) => this.current.set(this.byRoute[this.routeKey(e.urlAfterRedirects)])),
    );
  }

  ngAfterViewInit(): void {
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.sync();
    // Re-grab element refs whenever the route swaps the rendered figure.
    this.subs.add(this.starEls.changes.subscribe(() => this.sync()));

    if (this.reduceMotion) {
      // Honor accessibility preference: render the figure statically, no drift.
      return;
    }
    this.zone.runOutsideAngular(() => {
      this.startTime = performance.now();
      this.rafId = requestAnimationFrame(this.tick);
    });
  }

  /** Snap the rAF loop onto the currently-rendered figure and its DOM nodes. */
  private sync(): void {
    this.groups = this.starEls.map((e) => e.nativeElement);
    this.segments = this.lineEls.map((e) => e.nativeElement);
    this.stars = this.current().stars;
    this.links = this.current().links;
  }

  private tick = (now: number): void => {
    const t = (now - this.startTime) / 1000;
    const speed = 0.5;
    const stars = this.stars;
    const groups = this.groups;

    // During a route swap the DOM and data are briefly out of step — skip until aligned.
    if (groups.length === stars.length) {
      const dx = new Array<number>(stars.length);
      const dy = new Array<number>(stars.length);

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const ox = s.amp * Math.sin(t * speed + s.phx);
        const oy = s.amp * Math.cos(t * speed * 0.8 + s.phy);
        dx[i] = ox;
        dy[i] = oy;
        groups[i].setAttribute('transform', `translate(${ox.toFixed(2)},${oy.toFixed(2)})`);
      }

      const links = this.links;
      const segs = this.segments;
      if (segs.length === links.length) {
        for (let i = 0; i < links.length; i++) {
          const { a, b } = links[i];
          const seg = segs[i];
          seg.setAttribute('x1', (stars[a].x + dx[a]).toFixed(2));
          seg.setAttribute('y1', (stars[a].y + dy[a]).toFixed(2));
          seg.setAttribute('x2', (stars[b].x + dx[b]).toFixed(2));
          seg.setAttribute('y2', (stars[b].y + dy[b]).toFixed(2));
        }
      }
    }

    this.rafId = requestAnimationFrame(this.tick);
  };

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
    return { name, side: 'left', viewBox: '0 0 300 300', stars, links: ConstellationComponent.LINKS as Link[] };
  }

  private routeKey(url: string): RouteKey {
    const seg = url.split(/[?#]/)[0].replace(/^\/+/, '').split('/')[0];
    return seg === 'work' || seg === 'about' || seg === 'contact' ? seg : 'home';
  }
}
