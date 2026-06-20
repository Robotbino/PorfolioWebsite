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

@Component({
  selector: 'app-constellation',
  standalone: false,
  templateUrl: './constellation.component.html',
  styleUrl: './constellation.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConstellationComponent implements AfterViewInit, OnDestroy {
  readonly constellations: Constellation[] = [
    {
      name: 'Big Dipper',
      side: 'left',
      viewBox: '0 0 360 200',
      stars: [
        { name: 'Dubhe', x: 30, y: 40, r: 3.2, phx: 0.0, phy: 1.1, amp: 6 },
        { name: 'Merak', x: 40, y: 120, r: 2.8, phx: 0.8, phy: 2.0, amp: 5 },
        { name: 'Phecda', x: 140, y: 130, r: 2.6, phx: 1.6, phy: 0.4, amp: 6 },
        { name: 'Megrez', x: 125, y: 55, r: 2.4, phx: 2.3, phy: 1.7, amp: 5 },
        { name: 'Alioth', x: 200, y: 75, r: 2.9, phx: 3.0, phy: 2.6, amp: 6 },
        { name: 'Mizar', x: 265, y: 105, r: 2.8, phx: 3.7, phy: 0.9, amp: 7 },
        { name: 'Alkaid', x: 330, y: 145, r: 3.0, phx: 4.4, phy: 1.5, amp: 7 },
      ],
      links: [
        { a: 0, b: 1 },
        { a: 1, b: 2 },
        { a: 2, b: 3 },
        { a: 3, b: 0 },
        { a: 3, b: 4 },
        { a: 4, b: 5 },
        { a: 5, b: 6 },
      ],
    },
    {
      name: 'Orion',
      side: 'right',
      viewBox: '0 0 200 420',
      stars: [
        { name: 'Meissa', x: 110, y: 30, r: 2.3, phx: 0.5, phy: 2.2, amp: 5 },
        { name: 'Betelgeuse', x: 50, y: 110, r: 3.4, phx: 1.2, phy: 0.7, amp: 6 },
        { name: 'Bellatrix', x: 170, y: 120, r: 3.0, phx: 1.9, phy: 1.9, amp: 6 },
        { name: 'Alnitak', x: 70, y: 230, r: 2.7, phx: 2.6, phy: 0.3, amp: 5 },
        { name: 'Alnilam', x: 105, y: 250, r: 2.7, phx: 3.3, phy: 1.2, amp: 5 },
        { name: 'Mintaka', x: 140, y: 270, r: 2.7, phx: 4.0, phy: 2.4, amp: 5 },
        { name: 'Saiph', x: 55, y: 360, r: 3.0, phx: 4.7, phy: 0.6, amp: 6 },
        { name: 'Rigel', x: 165, y: 380, r: 3.5, phx: 5.4, phy: 1.8, amp: 6 },
      ],
      links: [
        { a: 0, b: 1 },
        { a: 0, b: 2 },
        { a: 1, b: 3 },
        { a: 2, b: 5 },
        { a: 3, b: 4 },
        { a: 4, b: 5 },
        { a: 3, b: 6 },
        { a: 5, b: 7 },
      ],
    },
  ];

  @ViewChildren('starEl') private starEls!: QueryList<ElementRef<SVGGElement>>;
  @ViewChildren('lineEl') private lineEls!: QueryList<ElementRef<SVGLineElement>>;

  private rafId = 0;
  private startTime = 0;
  private groups: SVGGElement[] = [];
  private segments: SVGLineElement[] = [];
  // Flattened, in template render order, with global star indices for the rAF loop.
  private flatStars: Star[] = [];
  private flatLinks: Link[] = [];

  constructor(private zone: NgZone) {}

  ngAfterViewInit(): void {
    this.groups = this.starEls.map((e) => e.nativeElement);
    this.segments = this.lineEls.map((e) => e.nativeElement);

    let offset = 0;
    for (const c of this.constellations) {
      for (const s of c.stars) {
        this.flatStars.push(s);
      }
      for (const l of c.links) {
        this.flatLinks.push({ a: offset + l.a, b: offset + l.b });
      }
      offset += c.stars.length;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      // Honor accessibility preference: render the static constellations, no drift.
      return;
    }

    this.zone.runOutsideAngular(() => {
      this.startTime = performance.now();
      this.rafId = requestAnimationFrame(this.tick);
    });
  }

  private tick = (now: number): void => {
    const t = (now - this.startTime) / 1000;
    const speed = 0.5;
    const stars = this.flatStars;
    const dx = new Array<number>(stars.length);
    const dy = new Array<number>(stars.length);

    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const ox = s.amp * Math.sin(t * speed + s.phx);
      const oy = s.amp * Math.cos(t * speed * 0.8 + s.phy);
      dx[i] = ox;
      dy[i] = oy;
      this.groups[i].setAttribute('transform', `translate(${ox.toFixed(2)},${oy.toFixed(2)})`);
    }

    for (let i = 0; i < this.flatLinks.length; i++) {
      const { a, b } = this.flatLinks[i];
      const seg = this.segments[i];
      seg.setAttribute('x1', (stars[a].x + dx[a]).toFixed(2));
      seg.setAttribute('y1', (stars[a].y + dy[a]).toFixed(2));
      seg.setAttribute('x2', (stars[b].x + dx[b]).toFixed(2));
      seg.setAttribute('y2', (stars[b].y + dy[b]).toFixed(2));
    }

    this.rafId = requestAnimationFrame(this.tick);
  };

  ngOnDestroy(): void {
    cancelAnimationFrame(this.rafId);
  }
}
