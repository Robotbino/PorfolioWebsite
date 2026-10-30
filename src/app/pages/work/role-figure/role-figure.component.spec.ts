import { WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ROLE_FIGURE_NOW, RoleFigureComponent } from './role-figure.component';
import { InViewCallback, InViewportService } from '../../../core/in-viewport.service';
import { MotionSettingsService } from '../../../core/motion-settings.service';
import { ROLE } from '../work-data';
import { FALL, LIFT, REST_LIFT, STEP_MS, figureGeometry } from './role-figure.math';

/**
 * The figure has no script running while it is on screen: its motion is CSS
 * transitions between the poses its bindings write. So these specs read the
 * poses back (each plate's transform, its stagger delay and which one is
 * bright) and the entrance's one-shot watch. The geometry itself is covered by
 * role-figure.math.spec.ts.
 */
describe('RoleFigureComponent', () => {
  let reducedMotion: WritableSignal<boolean>;
  let onChange: InViewCallback | undefined;
  let watchOptions: IntersectionObserverInit | undefined;
  let watched: number;
  let released: boolean;

  const liftPx = figureGeometry(ROLE.positions, '2026-10').liftPx;

  beforeEach(() => {
    reducedMotion = signal(false);
    onChange = undefined;
    watchOptions = undefined;
    watched = 0;
    released = false;

    TestBed.configureTestingModule({
      imports: [RoleFigureComponent],
      providers: [
        { provide: MotionSettingsService, useValue: { reducedMotion } },
        {
          provide: InViewportService,
          useValue: {
            observe: (_target: Element, options: IntersectionObserverInit, cb: InViewCallback) => {
              watched++;
              watchOptions = options;
              onChange = cb;
              return () => (released = true);
            },
          },
        },
        { provide: ROLE_FIGURE_NOW, useValue: () => new Date('2026-10-15T12:00:00Z') },
      ],
    });
  });

  /** Runs change detection and the after-render start-up. */
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

  const host = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;

  const round = (values: number[]) => values.map((v) => Math.round(v * 100) / 100);

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

  it('rests with the newest plate half lifted and the only bright one', () => {
    const f = build();
    expect(lifts(f)).toEqual([0, 0, REST_LIFT]);
    expect(bright(f)).toEqual([false, false, true]);
  });

  it('lifts the plate of the line under the pointer, its neighbours less', () => {
    const f = build();
    pick(f, 2); // the last line listed: the Intern, the oldest plate

    expect(lifts(f)).toEqual(round([LIFT, LIFT * FALL[1], LIFT * FALL[2]]));
    expect(bright(f)).toEqual([true, false, false]);
    expect(delays(f)).toEqual(['0ms', `${STEP_MS}ms`, `${2 * STEP_MS}ms`]);
  });

  it('returns to rest when the pointer leaves, spreading from the plate let go', () => {
    const f = build();
    pick(f, 2);
    pick(f, null);

    expect(lifts(f)).toEqual([0, 0, REST_LIFT]);
    expect(bright(f)).toEqual([false, false, true]);
    expect(delays(f)).toEqual(['0ms', `${STEP_MS}ms`, `${2 * STEP_MS}ms`]);
  });

  it('holds the entrance until a third of the figure is on screen, once', () => {
    const f = build();
    expect(host(f).classList).toContain('awaiting');
    expect(watchOptions).toEqual({ threshold: 0.35 });

    onChange!(false);
    settle(f);
    expect(host(f).classList).toContain('awaiting');
    expect(released).toBeFalse();

    onChange!(true);
    settle(f);
    expect(host(f).classList).not.toContain('awaiting');
    expect(released).toBeTrue();
  });

  it('starts at rest and watches nothing under reduced motion', () => {
    reducedMotion.set(true);
    const f = build();

    expect(host(f).classList).not.toContain('awaiting');
    expect(watched).toBe(0);
    expect(lifts(f)).toEqual([0, 0, REST_LIFT]);
  });

  it('lets go of the watch when destroyed before it fires', () => {
    const f = build();
    expect(released).toBeFalse();

    f.destroy();

    expect(released).toBeTrue();
  });
});
