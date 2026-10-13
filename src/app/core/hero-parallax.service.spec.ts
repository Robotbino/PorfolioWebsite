import { WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HeroParallaxService } from './hero-parallax.service';
import { FramePulseService } from './frame-pulse.service';
import { MotionSettingsService } from './motion-settings.service';
import { ScrollLoopService } from '../scroll-loop.service';

/**
 * The parallax is a pointer → eased value → style write pipeline. These specs
 * drive the tick by hand and read the written properties, which is everything
 * the seam and the reduced-motion contract depend on.
 */
describe('HeroParallaxService', () => {
  let finePointer: WritableSignal<boolean>;
  let reducedMotion: WritableSignal<boolean>;
  let position: number;
  let ticks: ((now: number, dt: number) => void)[];
  let service: HeroParallaxService;

  beforeEach(() => {
    finePointer = signal(true);
    reducedMotion = signal(false);
    position = 0;
    ticks = [];
    TestBed.configureTestingModule({
      providers: [
        { provide: MotionSettingsService, useValue: { finePointer, reducedMotion } },
        {
          provide: FramePulseService,
          useValue: {
            onTick: (fn: (now: number, dt: number) => void) => {
              ticks.push(fn);
              return () => (ticks = ticks.filter((t) => t !== fn));
            },
          },
        },
        {
          provide: ScrollLoopService,
          useValue: { position: () => position, cycleLength: 5 },
        },
      ],
    });
    service = TestBed.inject(HeroParallaxService);
    TestBed.tick();
  });

  afterEach(() => {
    // Drop the window listeners between specs.
    finePointer.set(false);
    TestBed.tick();
  });

  const pointAt = (fx: number, fy: number) =>
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: window.innerWidth * fx,
        clientY: window.innerHeight * fy,
        pointerType: 'mouse',
      }),
    );
  /** Run enough 60Hz frames for the ease to land on its target. */
  const settle = () => {
    for (let i = 0; i < 400; i++) {
      ticks.forEach((t) => t(i * 16.7, 16.7));
    }
  };
  const read = (el: HTMLElement) => [
    el.style.getPropertyValue('--parallax-x'),
    el.style.getPropertyValue('--parallax-y'),
  ];

  it('writes the same value to every attached element', () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    service.attach(a);
    service.attach(b);
    pointAt(1, 0.5);
    settle();

    expect(read(a)).toEqual(['1.000', '0.000']);
    expect(read(b)).toEqual(read(a));
  });

  it('skips the style write when the eased value has not changed', () => {
    const a = document.createElement('div');
    service.attach(a);
    pointAt(0.75, 0.25);
    settle();
    const spy = spyOn(a.style, 'setProperty').and.callThrough();
    settle();

    expect(spy).not.toHaveBeenCalled();
  });

  it('fades to zero away from Home, the same on both sides of the seam', () => {
    const a = document.createElement('div');
    service.attach(a);
    pointAt(1, 1);

    position = 0.6;
    settle();
    expect(read(a)).toEqual(['0.000', '0.000']);

    position = 0.1;
    settle();
    const nearHome = read(a);
    position = 4.9;
    settle();
    expect(read(a)).toEqual(nearHome);
    expect(nearHome[0]).toBe('0.800');
  });

  it('ignores touch input', () => {
    const a = document.createElement('div');
    service.attach(a);
    window.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 0, clientY: 0, pointerType: 'touch' }),
    );
    settle();

    expect(read(a)).toEqual(['0.000', '0.000']);
  });

  it('removes its properties and stops ticking when motion is reduced', () => {
    const a = document.createElement('div');
    service.attach(a);
    pointAt(1, 1);
    settle();
    expect(ticks.length).toBe(1);

    reducedMotion.set(true);
    TestBed.tick();

    expect(ticks.length).toBe(0);
    expect(read(a)).toEqual(['', '']);
  });

  it('clears an element when it detaches', () => {
    const a = document.createElement('div');
    const release = service.attach(a);
    pointAt(1, 1);
    settle();
    release();

    expect(read(a)).toEqual(['', '']);
  });
});
