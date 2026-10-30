import { WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import {
  ENTRANCE_MS,
  LAP_REST_MS,
  LAP_RESUME_MS,
  LAP_STOP_MS,
  ROLE_FIGURE_NOW,
  RoleFigureComponent,
} from './role-figure.component';
import { InViewCallback, InViewportService } from '../../../core/in-viewport.service';
import { MotionSettingsService } from '../../../core/motion-settings.service';
import { ROLE } from '../work-data';
import { FALL, LIFT, REST_LIFT, STEP_MS, figureGeometry } from './role-figure.math';

/**
 * The figure's motion is CSS transitions and one keyframe float between the
 * poses its bindings write, and a timer that steps its lap. So these specs
 * read the poses back (each plate's transform, its stagger delay, which one is
 * bright, which one floats), drive the lap with fake time, and drive the two
 * viewport watches by hand. The geometry itself is covered by
 * role-figure.math.spec.ts.
 */
describe('RoleFigureComponent', () => {
  let reducedMotion: WritableSignal<boolean>;
  /** The viewport watches, by threshold: 0 for presence, 0.35 for the entrance. */
  let watches: Map<number, InViewCallback>;
  let released: Set<number>;

  const liftPx = figureGeometry(ROLE.positions, '2026-10').liftPx;

  beforeEach(() => {
    reducedMotion = signal(false);
    watches = new Map();
    released = new Set();

    TestBed.configureTestingModule({
      imports: [RoleFigureComponent],
      providers: [
        { provide: MotionSettingsService, useValue: { reducedMotion } },
        {
          provide: InViewportService,
          useValue: {
            observe: (_target: Element, options: IntersectionObserverInit, cb: InViewCallback) => {
              const threshold = options.threshold as number;
              watches.set(threshold, cb);
              return () => released.add(threshold);
            },
          },
        },
        { provide: ROLE_FIGURE_NOW, useValue: () => new Date('2026-10-15T12:00:00Z') },
      ],
    });
  });

  /** Runs change detection, the after-render start-up and any effect it scheduled. */
  function settle(fixture: ComponentFixture<RoleFigureComponent>): void {
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
  }

  function build(): ComponentFixture<RoleFigureComponent> {
    const fixture = TestBed.createComponent(RoleFigureComponent);
    fixture.componentRef.setInput('positions', ROLE.positions);
    settle(fixture);
    return fixture;
  }

  function pick(fixture: ComponentFixture<RoleFigureComponent>, line: number | null): void {
    fixture.componentRef.setInput('picked', line);
    settle(fixture);
  }

  /** Reports the figure in or out of the viewport, as the presence watch would. */
  function show(fixture: ComponentFixture<RoleFigureComponent>, visible: boolean): void {
    watches.get(0)!(visible);
    settle(fixture);
  }

  /** Puts the figure on screen and lets the entrance play out, up to the lap's first stop. */
  function arrive(fixture: ComponentFixture<RoleFigureComponent>): void {
    show(fixture, true);
    watches.get(0.35)!(true);
    settle(fixture);
    tick(ENTRANCE_MS + LAP_RESUME_MS);
    settle(fixture);
  }

  function wait(fixture: ComponentFixture<RoleFigureComponent>, ms: number): void {
    tick(ms);
    settle(fixture);
  }

  const plates = (f: ComponentFixture<unknown>) =>
    Array.from(f.nativeElement.querySelectorAll('g.plate')) as SVGGElement[];

  /** Each plate's lift back out of its transform, in world units. Abs: a seated plate reads -0. */
  const lifts = (f: ComponentFixture<unknown>) =>
    plates(f).map((g) => {
      const px = Number((g.style.transform.match(/-?[\d.]+/) ?? ['0'])[0]);
      return Math.abs(Math.round((px / liftPx) * 100) / 100);
    });

  const delays = (f: ComponentFixture<unknown>) =>
    plates(f).map((g) => g.style.getPropertyValue('--lift-delay'));

  const bright = (f: ComponentFixture<unknown>) =>
    plates(f).map((g) => g.classList.contains('is-bright'));

  const breathing = (f: ComponentFixture<unknown>) =>
    plates(f).map((g) => g.classList.contains('is-breathing'));

  const host = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;

  const ms = (el: Element, property: string) =>
    parseFloat((el as SVGElement).style.getPropertyValue(property));

  const round = (values: number[]) => values.map((v) => Math.round(v * 100) / 100);

  const REST = [0, 0, REST_LIFT];
  const OLDEST = round([LIFT, LIFT * FALL[1], LIFT * FALL[2]]);
  const MIDDLE = round([LIFT * FALL[1], LIFT, LIFT * FALL[1]]);
  const NEWEST = round([LIFT * FALL[2], LIFT * FALL[1], LIFT]);

  it('keeps the whole figure out of the accessibility tree', () => {
    const f = build();
    expect(host(f).getAttribute('aria-hidden')).toBe('true');
    expect(host(f).querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('stands one plate per position', () => {
    const f = build();
    expect(plates(f).length).toBe(ROLE.positions.length);
    expect(host(f).querySelectorAll('g.plate path.face').length).toBe(ROLE.positions.length);
  });

  it('rests with the newest plate half lifted, the only bright one, and floating', () => {
    const f = build();
    expect(lifts(f)).toEqual(REST);
    expect(bright(f)).toEqual([false, false, true]);
    expect(breathing(f)).toEqual([false, false, true]);
  });

  it('lifts the plate of the line under the pointer, its neighbours less', () => {
    const f = build();
    pick(f, 2); // the last line listed: the Intern, the oldest plate

    expect(lifts(f)).toEqual(OLDEST);
    expect(bright(f)).toEqual([true, false, false]);
    expect(breathing(f)).toEqual([false, false, false]);
    expect(delays(f)).toEqual(['0ms', `${STEP_MS}ms`, `${2 * STEP_MS}ms`]);
  });

  it('returns to rest when the pointer leaves, spreading from the plate let go', () => {
    const f = build();
    pick(f, 2);
    pick(f, null);

    expect(lifts(f)).toEqual(REST);
    expect(bright(f)).toEqual([false, false, true]);
    expect(delays(f)).toEqual(['0ms', `${STEP_MS}ms`, `${2 * STEP_MS}ms`]);
  });

  it('engraves the quarters in turn, then drops the now mark, then lands the plates', () => {
    const f = build();
    const ticks = Array.from(host(f).querySelectorAll('path.tick')).map((t) =>
      ms(t, '--tick-delay'),
    );
    const now = ms(host(f).querySelector('path.now')!, '--now-delay');
    const landings = Array.from(host(f).querySelectorAll('g.seat')).map((s) =>
      ms(s, '--enter-delay'),
    );

    expect(ticks.length).toBe(7);
    expect(ticks).toEqual([...ticks].sort((a, b) => a - b));
    expect(now).toBeGreaterThan(Math.max(...ticks));
    expect(Math.min(...landings)).toBeGreaterThan(now);
    expect(landings).toEqual([...landings].sort((a, b) => a - b));
  });

  it('holds the entrance until a third of the figure is on screen, once', () => {
    const f = build();
    expect(host(f).classList).toContain('awaiting');

    watches.get(0.35)!(false);
    settle(f);
    expect(host(f).classList).toContain('awaiting');
    expect(released.has(0.35)).toBeFalse();

    watches.get(0.35)!(true);
    settle(f);
    expect(host(f).classList).not.toContain('awaiting');
    expect(released.has(0.35)).toBeTrue();
  });

  it('plays a lap after the entrance: each plate in turn, oldest first, then rest', fakeAsync(() => {
    const f = build();
    const lit: (number | null)[] = [];
    f.componentInstance.touring.subscribe((line) => lit.push(line));

    show(f, true);
    watches.get(0.35)!(true);
    settle(f);
    wait(f, ENTRANCE_MS + LAP_RESUME_MS - 1);
    expect(lifts(f)).toEqual(REST);

    wait(f, 1);
    expect(lifts(f)).toEqual(OLDEST);
    expect(bright(f)).toEqual([true, false, false]);
    wait(f, LAP_STOP_MS);
    expect(lifts(f)).toEqual(MIDDLE);
    wait(f, LAP_STOP_MS);
    expect(lifts(f)).toEqual(NEWEST);
    wait(f, LAP_STOP_MS);
    expect(lifts(f)).toEqual(REST);
    expect(breathing(f)).toEqual([false, false, true]);
    wait(f, LAP_REST_MS);
    expect(lifts(f)).toEqual(OLDEST);

    // Lines as listed, newest first: the Intern, the Trainee, the Junior, rest.
    expect(lit).toEqual([2, 1, 0, null, 2]);
    f.destroy();
  }));

  it('gives way to a hover at once and picks the lap up again after it', fakeAsync(() => {
    const f = build();
    arrive(f);
    expect(lifts(f)).toEqual(OLDEST);

    pick(f, 0); // the Junior line
    expect(lifts(f)).toEqual(NEWEST);
    wait(f, 3 * LAP_STOP_MS);
    expect(lifts(f)).toEqual(NEWEST);

    pick(f, null);
    expect(lifts(f)).toEqual(REST);
    wait(f, LAP_RESUME_MS);
    expect(lifts(f)).toEqual(OLDEST);
    f.destroy();
  }));

  it('holds everything while off screen, and starts again on return', fakeAsync(() => {
    const f = build();
    arrive(f);
    expect(host(f).classList).toContain('on-screen');

    show(f, false);
    expect(host(f).classList).not.toContain('on-screen');
    expect(lifts(f)).toEqual(REST);
    wait(f, 4 * LAP_STOP_MS);
    expect(lifts(f)).toEqual(REST);

    show(f, true);
    wait(f, LAP_RESUME_MS);
    expect(lifts(f)).toEqual(OLDEST);
    f.destroy();
  }));

  it('never plays the entrance or the lap under reduced motion, and still answers', fakeAsync(() => {
    reducedMotion.set(true);
    const f = build();

    expect(host(f).classList).not.toContain('awaiting');
    expect(watches.has(0.35)).toBeFalse();
    show(f, true);
    wait(f, 10_000);
    expect(lifts(f)).toEqual(REST);

    pick(f, 2);
    expect(lifts(f)).toEqual(OLDEST);
    f.destroy();
  }));

  it('lets go of both watches when destroyed', () => {
    const f = build();
    expect(released.size).toBe(0);

    f.destroy();

    expect(released).toEqual(new Set([0, 0.35]));
  });
});
