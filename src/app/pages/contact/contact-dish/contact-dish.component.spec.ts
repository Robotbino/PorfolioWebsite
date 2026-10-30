import { WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import {
  ContactDishComponent,
  IDLE_MS,
  SURVEY_START_MS,
  SURVEY_STOP_MS,
} from './contact-dish.component';
import { FramePulseService } from '../../../core/frame-pulse.service';
import { InViewCallback, InViewportService } from '../../../core/in-viewport.service';
import { MotionSettingsService } from '../../../core/motion-settings.service';
import { Aim, REST, STOW, SURVEY, dishGeometry } from './contact-dish.math';

/**
 * The dish draws itself: the template paints its first pose, then the
 * component rewrites the moving paths a frame at a time on the shared pulse,
 * only while a spring is moving. So these specs stand in for the pulse and
 * step it by hand, drive the two viewport watches and the pointer, and read
 * the drawn outline back against the pose it should have settled on.
 */
describe('ContactDishComponent', () => {
  let reducedMotion: WritableSignal<boolean>;
  let finePointer: WritableSignal<boolean>;
  let watches: Map<number, InViewCallback>;
  let released: Set<number>;
  let ticks: Set<(now: number, dt: number) => void>;

  const geometry = dishGeometry();
  const outlineOf = (aim: Aim) => geometry.pose(aim).outline;

  beforeEach(() => {
    reducedMotion = signal(false);
    finePointer = signal(true);
    watches = new Map();
    released = new Set();
    ticks = new Set();

    TestBed.configureTestingModule({
      imports: [ContactDishComponent],
      providers: [
        { provide: MotionSettingsService, useValue: { reducedMotion, finePointer } },
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
        {
          provide: FramePulseService,
          useValue: {
            onTick: (fn: (now: number, dt: number) => void) => {
              ticks.add(fn);
              return () => ticks.delete(fn);
            },
          },
        },
      ],
    });
  });

  function build(): ComponentFixture<ContactDishComponent> {
    const fixture = TestBed.createComponent(ContactDishComponent);
    // A box of its own: the stylesheet sizes it against the colophon, and hides
    // it on a window as narrow as the test runner's.
    fixture.nativeElement.style.cssText =
      'display:block;position:fixed;left:400px;top:300px;width:240px;';
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
    return fixture;
  }

  /** Steps the pulse until nothing is subscribed, or gives up. */
  function frames(max = 400): void {
    for (let i = 0; i < max && ticks.size > 0; i++) {
      [...ticks].forEach((fn) => fn(i * 16, 16));
    }
  }

  const outline = (f: ComponentFixture<unknown>) =>
    (f.nativeElement as HTMLElement).querySelector('[data-part="outline"]')!.getAttribute('d');

  function arrive(): void {
    watches.get(0)!(true);
    watches.get(0.35)!(true);
    frames();
  }

  function pointerAt(x: number, y: number): void {
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y }));
  }

  it('keeps the whole figure out of the accessibility tree, sized by its viewBox', () => {
    const f = build();
    const host = f.nativeElement as HTMLElement;
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    expect(host.style.aspectRatio).not.toBe('');
    expect(host.querySelectorAll('ellipse.dot.off').length).toBe(36);
  });

  it('paints stowed, then swings up to rest on arrival and leaves the pulse', () => {
    const f = build();
    expect(outline(f)).toBe(outlineOf(STOW));
    expect(ticks.size).toBe(0);

    watches.get(0)!(true);
    watches.get(0.35)!(true);
    expect(ticks.size).toBe(1);
    expect(released.has(0.35)).toBeTrue();

    frames();
    expect(ticks.size).toBe(0);
    expect(outline(f)).toBe(outlineOf(REST));
  });

  it('draws each arm once, behind the dish or in front of it', () => {
    const f = build();
    arrive();
    const host = f.nativeElement as HTMLElement;
    const shown = (part: string) =>
      Array.from(host.querySelectorAll(`[data-part="${part}"]`)).filter(
        (g) => g.getAttribute('display') !== 'none',
      ).length;
    expect(shown('behind') + shown('in-front')).toBe(2);
  });

  it('surveys the sky when left alone: each stop in turn', fakeAsync(() => {
    const f = build();
    arrive();

    tick(SURVEY_START_MS);
    frames();
    expect(outline(f)).toBe(outlineOf(SURVEY[0]));
    tick(SURVEY_STOP_MS);
    frames();
    expect(outline(f)).toBe(outlineOf(SURVEY[1]));
    f.destroy();
  }));

  it('turns to a moving mouse, then goes back to rest once it is still', fakeAsync(() => {
    const f = build();
    arrive();

    pointerAt(10, 10); // far up and to the left of the dish
    expect(ticks.size).toBe(1);
    frames();
    const aimed = outline(f);
    expect(aimed).not.toBe(outlineOf(REST));

    // The survey waits while the mouse is in charge.
    tick(IDLE_MS - 1);
    frames();
    expect(outline(f)).toBe(aimed);

    tick(1);
    frames();
    expect(outline(f)).toBe(outlineOf(REST));
    f.destroy();
  }));

  it('ignores a touch, and a pointer that is not a mouse', fakeAsync(() => {
    const f = build();
    arrive();
    window.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 10, clientY: 10, pointerType: 'touch' }),
    );
    expect(ticks.size).toBe(0);

    finePointer.set(false);
    TestBed.tick();
    pointerAt(10, 10);
    expect(ticks.size).toBe(0);
    f.destroy();
  }));

  it('holds still off screen: no survey, no pointer', fakeAsync(() => {
    const f = build();
    arrive();
    watches.get(0)!(false);

    tick(SURVEY_START_MS + SURVEY_STOP_MS);
    pointerAt(10, 10);
    expect(ticks.size).toBe(0);
    expect(outline(f)).toBe(outlineOf(REST));
    f.destroy();
  }));

  it('rests from the first paint and never moves under reduced motion', fakeAsync(() => {
    reducedMotion.set(true);
    const f = build();
    expect(outline(f)).toBe(outlineOf(REST));
    expect(watches.has(0.35)).toBeFalse();

    watches.get(0)!(true);
    pointerAt(10, 10);
    tick(SURVEY_START_MS + 3 * SURVEY_STOP_MS);
    expect(ticks.size).toBe(0);
    expect(outline(f)).toBe(outlineOf(REST));
    f.destroy();
  }));

  it('lets go of both watches and the pointer when destroyed', () => {
    const f = build();
    arrive();
    f.destroy();

    expect(released).toEqual(new Set([0, 0.35]));
    pointerAt(10, 10);
    expect(ticks.size).toBe(0);
  });
});
