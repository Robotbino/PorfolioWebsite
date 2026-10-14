import { ApplicationRef, WritableSignal, computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StarMapComponent } from './star-map.component';
import { STAR_MAP_RENDERER, StarMapRenderer, StarMapRendererFactory } from './star-map.renderer';
import { StarMapScene } from './star-map.scene';
import { FramePulseService } from '../core/frame-pulse.service';
import { HeroParallaxService } from '../core/hero-parallax.service';
import { MotionSettingsService } from '../core/motion-settings.service';
import { NavTransitionService } from '../core/nav-transition.service';
import { ThemeService } from '../core/theme.service';
import { starMapPalette } from '../core/star-map-palette';
import { ScrollLoopService } from '../scroll-loop.service';

/** Stands in for the OGL renderer: a headless test browser has no WebGL. */
class FakeRenderer implements StarMapRenderer {
  readonly canvas = document.createElement('canvas');
  readonly resize = jasmine.createSpy('resize');
  readonly setPalette = jasmine.createSpy('setPalette');
  readonly setFieldCount = jasmine.createSpy('setFieldCount');
  readonly draw = jasmine.createSpy('draw');
  readonly dispose = jasmine.createSpy('dispose');
  lose: (() => void) | null = null;

  onContextLost(callback: () => void): void {
    this.lose = callback;
  }
}

/**
 * The component is the shell between the scroll, the pointer, the theme and a
 * renderer. These specs drive its tick by hand against a fake renderer and
 * check the decisions it owns: which renderer the visitor gets, when it
 * draws, and that it lets go of everything it took.
 */
describe('StarMapComponent', () => {
  let reducedMotion: WritableSignal<boolean>;
  let isDark: WritableSignal<boolean>;
  let position: number;
  let ticks: ((now: number, dt: number) => void)[];
  let teleports: (() => void)[];
  let frames: FrameRequestCallback[];
  let renderer: FakeRenderer;
  let now: number;

  beforeEach(() => {
    reducedMotion = signal(false);
    isDark = signal(true);
    position = 0;
    ticks = [];
    teleports = [];
    frames = [];
    renderer = new FakeRenderer();
    now = 0;
    // The component samples a few frames after first render before it starts;
    // queue them so each spec decides when they run.
    spyOn(window, 'requestAnimationFrame').and.callFake((cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    spyOn(window, 'cancelAnimationFrame');
  });

  function create(
    factory: StarMapRendererFactory = () => renderer,
  ): ComponentFixture<StarMapComponent> {
    TestBed.configureTestingModule({
      imports: [StarMapComponent],
      providers: [
        { provide: STAR_MAP_RENDERER, useValue: factory },
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
        {
          provide: MotionSettingsService,
          useValue: { reducedMotion, finePointer: signal(true), coarsePointer: signal(false) },
        },
        {
          provide: HeroParallaxService,
          useValue: { pointer: () => ({ x: 0, y: 0, homeWeight: 1 }), attach: () => () => {} },
        },
        {
          provide: NavTransitionService,
          useValue: {
            onTeleport: (fn: () => void) => {
              teleports.push(fn);
              return () => (teleports = teleports.filter((t) => t !== fn));
            },
          },
        },
        {
          provide: ThemeService,
          useValue: { starMapPalette: computed(() => starMapPalette(isDark())) },
        },
      ],
    });
    const fixture = TestBed.createComponent(StarMapComponent);
    fixture.detectChanges();
    // Runs the afterNextRender hook, which queues the start frame.
    TestBed.inject(ApplicationRef).tick();
    return fixture;
  }

  /** Run the queued start-up frames at a given cadence, then render whatever mode it chose. */
  function start(fixture: ComponentFixture<StarMapComponent>, frameMs = 1000 / 60): void {
    for (let k = 0; frames.length > 0 && k < 100; k++) {
      frames.splice(0).forEach((cb) => cb(k * frameMs));
    }
    fixture.detectChanges();
  }

  function build(factory?: StarMapRendererFactory): ComponentFixture<StarMapComponent> {
    const fixture = create(factory);
    start(fixture);
    return fixture;
  }

  /** The star map's own tick (the SVG fallback subscribes one of its own). */
  let starTick: (now: number, dt: number) => void;
  function runTicks(count: number, dt = 1000 / 60): void {
    for (let i = 0; i < count; i++) {
      now += dt;
      starTick(now, dt);
    }
  }

  const host = (f: ComponentFixture<StarMapComponent>) => f.nativeElement as HTMLElement;

  it('waits for first render before choosing a renderer', () => {
    const fixture = create();

    expect(fixture.componentInstance.mode()).toBe('pending');
    expect(host(fixture).querySelector('canvas')).toBeNull();
    expect(host(fixture).querySelector('app-constellation')).toBeNull();
  });

  it('renders the SVG constellation when no WebGL renderer can be made', () => {
    const fixture = build(() => null);

    expect(fixture.componentInstance.mode()).toBe('svg');
    expect(host(fixture).querySelector('app-constellation')).not.toBeNull();
    expect(host(fixture).querySelector('canvas')).toBeNull();
    // Starting the page, so the SVG plays its own entrance.
    expect(host(fixture).querySelector('app-constellation.resume')).toBeNull();
  });

  it('mounts the renderer canvas and sizes it when WebGL is available', () => {
    const fixture = build();

    expect(fixture.componentInstance.mode()).toBe('webgl');
    expect(host(fixture).querySelector('.stage canvas')).toBe(renderer.canvas);
    expect(host(fixture).querySelector('app-constellation')).toBeNull();
    expect(renderer.resize).toHaveBeenCalled();
    expect(renderer.setPalette).toHaveBeenCalledWith(starMapPalette(true));
    expect(ticks.length).toBe(1);
  });

  it('switches to the SVG for good when the context is lost', () => {
    const fixture = build();
    starTick = ticks[0];
    renderer.lose!();
    fixture.detectChanges();

    expect(fixture.componentInstance.mode()).toBe('svg');
    expect(ticks).not.toContain(starTick);
    expect(teleports.length).toBe(0);
    expect(renderer.dispose).toHaveBeenCalled();
    expect(renderer.canvas.isConnected).toBeFalse();
    // Mid-visit, so it picks up where the reader is, already drawn.
    expect(host(fixture).querySelector('app-constellation.resume')).not.toBeNull();
  });

  it('switches to the SVG, without breaking the frame loop, when a draw throws', () => {
    const fixture = build();
    starTick = ticks[0];
    renderer.draw.and.throwError('draw failed');

    expect(() => runTicks(1)).not.toThrow();
    fixture.detectChanges();

    expect(fixture.componentInstance.mode()).toBe('svg');
    expect(ticks).not.toContain(starTick);
    expect(renderer.dispose).toHaveBeenCalled();
    expect(host(fixture).querySelector('app-constellation')).not.toBeNull();
  });

  it('draws on every tick while the entrance plays', () => {
    build();
    starTick = ticks[0];
    runTicks(5);

    expect(renderer.draw).toHaveBeenCalledTimes(5);
  });

  it('draws at half rate once everything has settled', () => {
    build();
    starTick = ticks[0];
    runTicks(300); // past the entrance (2.4s) and the 120-frame check after it
    renderer.draw.calls.reset();
    runTicks(40);

    expect(renderer.draw).toHaveBeenCalledTimes(20);
  });

  it('keeps drawing every frame until the frame-time check is done, so it times the full cost', () => {
    build();
    starTick = ticks[0];
    runTicks(160); // just past the entrance, inside the check
    renderer.draw.calls.reset();
    runTicks(40);

    expect(renderer.draw).toHaveBeenCalledTimes(40);
  });

  describe('under reduced motion', () => {
    beforeEach(() => reducedMotion.set(true));

    it('draws only when the figure, the theme or the size changes', () => {
      const fixture = build();
      starTick = ticks[0];

      runTicks(10);
      expect(renderer.draw).toHaveBeenCalledTimes(1);

      position = 1;
      runTicks(10);
      expect(renderer.draw).toHaveBeenCalledTimes(2);

      isDark.set(false);
      fixture.detectChanges();
      runTicks(10);
      expect(renderer.setPalette).toHaveBeenCalledWith(starMapPalette(false));
      expect(renderer.draw).toHaveBeenCalledTimes(3);

      window.dispatchEvent(new Event('resize'));
      runTicks(10);
      expect(renderer.draw).toHaveBeenCalledTimes(4);
    });

    it('draws the finished picture straight away, with no entrance', () => {
      build();
      starTick = ticks[0];
      const drawn: StarMapScene[] = [];
      renderer.draw.and.callFake((scene: StarMapScene) => drawn.push(scene));
      runTicks(1);

      expect(drawn.length).toBe(1);
      expect(drawn[0].fieldOpacity).toBe(1);
      // Every star's core alpha (the fifth field of each record) is full or
      // dimmed by depth, never still fading in.
      for (let i = 0; i < 8; i++) {
        expect(drawn[0].stars[i * 9 + 4]).toBeGreaterThanOrEqual(0.8);
      }
    });
  });

  it('holds the camera face-on while a nav jump crosses several destinations', () => {
    build();
    starTick = ticks[0];
    runTicks(240);
    let maxTurn = 0;
    // view[8] is the sine of the camera's yaw while the pointer is still.
    renderer.draw.and.callFake((s: StarMapScene) => {
      maxTurn = Math.max(maxTurn, Math.abs(s.view[8]));
    });

    teleports.forEach((fn) => fn());
    position = 2;
    runTicks(120);
    // A trace of swing returns as the gain recovers on arrival: well under 0.3°.
    expect(maxTurn).toBeLessThan(0.005);

    // The same journey by scrolling swings the camera aside.
    maxTurn = 0;
    position = 4;
    runTicks(120);
    expect(maxTurn).toBeGreaterThan(0.05);
  });

  it('still steps aside on a nav jump of a single destination', () => {
    build();
    starTick = ticks[0];
    runTicks(240);
    let maxTurn = 0;
    renderer.draw.and.callFake((s: StarMapScene) => {
      maxTurn = Math.max(maxTurn, Math.abs(s.view[8]));
    });

    // One hop has no figures in between to whip through.
    teleports.forEach((fn) => fn());
    position = 1;
    runTicks(120);
    expect(maxTurn).toBeGreaterThan(0.05);
  });

  it('steps down, then falls back to the SVG, when frames stay slow', () => {
    const fixture = build();
    starTick = ticks[0];
    runTicks(100, 25); // the entrance
    const [, , dpr] = renderer.resize.calls.mostRecent().args as number[];

    runTicks(120, 40);
    const [, , halved] = renderer.resize.calls.mostRecent().args as number[];
    expect(halved).toBeCloseTo(dpr / 2, 6);
    expect(fixture.componentInstance.mode()).toBe('webgl');

    runTicks(120, 40);
    expect(fixture.componentInstance.mode()).toBe('svg');
    expect(renderer.dispose).toHaveBeenCalled();
  });

  it('measures itself against a browser that caps animation at 30fps', () => {
    const fixture = create();
    start(fixture, 1000 / 30);
    starTick = ticks[0];
    runTicks(80, 1000 / 30); // the entrance
    const resizes = renderer.resize.calls.count();

    // The whole page runs at ~33ms here, so the star map is not what is slow.
    runTicks(240, 1000 / 30);
    expect(renderer.resize.calls.count()).toBe(resizes);
    expect(fixture.componentInstance.mode()).toBe('webgl');
  });

  it('lets go of everything when destroyed', () => {
    const fixture = build();
    const removed = spyOn(window, 'removeEventListener').and.callThrough();
    fixture.destroy();

    expect(ticks.length).toBe(0);
    expect(teleports.length).toBe(0);
    expect(renderer.dispose).toHaveBeenCalled();
    expect(renderer.canvas.isConnected).toBeFalse();
    expect(removed).toHaveBeenCalledWith('resize', jasmine.any(Function));
  });

  it('never starts if it is destroyed before its first frame', () => {
    const factory = jasmine.createSpy('factory').and.returnValue(renderer);
    const fixture = create(factory);
    fixture.destroy();
    frames.splice(0).forEach((cb) => cb(0));

    expect(factory).not.toHaveBeenCalled();
    expect(ticks.length).toBe(0);
  });
});
