import { WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ORBIT_TOOLS, ToolOrbitComponent } from './tool-orbit.component';
import { InViewCallback, InViewportService } from '../../../core/in-viewport.service';
import { MotionSettingsService } from '../../../core/motion-settings.service';
import { RINGS, orbitKeyframes, restStyle } from './tool-orbit.math';

/**
 * The orbit is ten Web Animations the component creates and owns. A headless
 * run can't judge how they look, but it can read them back: how many there
 * are, their timing and keyframes, and whether they are running, paused or
 * gone. Those are the parts the still picture, the off-screen pause and the
 * reduced-motion contract depend on. The geometry itself is covered by
 * tool-orbit.math.spec.ts.
 */
describe('ToolOrbitComponent', () => {
  let reducedMotion: WritableSignal<boolean>;
  let onChange: InViewCallback | undefined;
  let watchOptions: IntersectionObserverInit | undefined;
  let released: boolean;
  let resize: ResizeObserverCallback | undefined;
  let disconnected: boolean;
  let originalResizeObserver: typeof ResizeObserver;

  beforeEach(() => {
    reducedMotion = signal(false);
    onChange = undefined;
    watchOptions = undefined;
    released = false;
    resize = undefined;
    disconnected = false;

    // A real observer reports whenever the Karma window lays out. The stand-in
    // reports only when a spec says so, with the width that spec chooses.
    originalResizeObserver = window.ResizeObserver;
    window.ResizeObserver = class {
      constructor(callback: ResizeObserverCallback) {
        resize = callback;
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {
        disconnected = true;
      }
    } as unknown as typeof ResizeObserver;

    TestBed.configureTestingModule({
      imports: [ToolOrbitComponent],
      providers: [
        { provide: MotionSettingsService, useValue: { reducedMotion } },
        {
          provide: InViewportService,
          useValue: {
            observe: (_target: Element, options: IntersectionObserverInit, cb: InViewCallback) => {
              watchOptions = options;
              onChange = cb;
              return () => (released = true);
            },
          },
        },
      ],
    });
  });

  afterEach(() => {
    window.ResizeObserver = originalResizeObserver;
  });

  /** Runs change detection, the after-render start-up and any effect it scheduled. */
  function settle(fixture: ComponentFixture<ToolOrbitComponent>): void {
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
  }

  function build(): ComponentFixture<ToolOrbitComponent> {
    const fixture = TestBed.createComponent(ToolOrbitComponent);
    settle(fixture);
    return fixture;
  }

  const logos = (f: ComponentFixture<unknown>) =>
    Array.from(f.nativeElement.querySelectorAll('ul.orbit-tools > li')) as HTMLLIElement[];

  const animationsOf = (f: ComponentFixture<unknown>) =>
    logos(f).flatMap((li) => li.getAnimations());

  /** The numbers in a transform, so serialisation details can't fail a spec. */
  const numbers = (value: string) => (value.match(/-?[\d.]+/g) ?? []).map(Number);

  function expectRestPoses(f: ComponentFixture<unknown>): void {
    logos(f).forEach((li, i) => {
      const tool = ORBIT_TOOLS[i];
      const rest = restStyle(tool.slot, RINGS[tool.ring].radius);
      expect(li.style.transform).toContain('cqi');
      expect(numbers(li.style.transform)).toEqual(numbers(rest.transform));
      expect(Number(li.style.opacity)).toBeCloseTo(Number(rest.opacity), 3);
    });
  }

  it('lists all ten tools by name, in ring order', () => {
    const f = build();
    const items = f.nativeElement.querySelectorAll('ul.orbit-tools > li');
    const alts = Array.from(
      f.nativeElement.querySelectorAll('ul.orbit-tools img') as NodeListOf<HTMLImageElement>,
    ).map((img) => img.alt);

    expect(items.length).toBe(10);
    expect(alts).toEqual(ORBIT_TOOLS.map((t) => t.name));
    expect(alts).toContain('IntelliJ IDEA');
  });

  it('keeps the black hole and the ring lines out of the accessibility tree', () => {
    const f = build();
    const pocket = f.nativeElement.querySelector('.orbit-pocket') as HTMLElement;
    const rings = f.nativeElement.querySelector('.orbit-rings') as SVGElement;
    const pocketImages = Array.from(pocket.querySelectorAll('img')) as HTMLImageElement[];

    expect(pocket.getAttribute('aria-hidden')).toBe('true');
    expect(rings.getAttribute('aria-hidden')).toBe('true');
    expect(pocketImages.length).toBe(2);
    expect(pocketImages.every((img) => img.getAttribute('alt') === '')).toBeTrue();
  });

  it('gives every logo a starting slot within one lap and an intrinsic size', () => {
    for (const tool of ORBIT_TOOLS) {
      expect(tool.slot).toBeGreaterThanOrEqual(0);
      expect(tool.slot).toBeLessThan(1);
      expect(tool.width).toBeGreaterThan(0);
      expect(tool.height).toBeGreaterThan(0);
    }
    expect(ORBIT_TOOLS.filter((t) => t.ring === 'inner').length).toBe(4);
    expect(ORBIT_TOOLS.filter((t) => t.ring === 'outer').length).toBe(6);
  });

  it('gives IntelliJ IDEA and PostgreSQL a rim, and no other logo', () => {
    const f = build();
    const rimmed = logos(f)
      .filter((li) => li.classList.contains('rim'))
      .map((li) => li.querySelector('img')!.alt);

    expect(rimmed).toEqual(['PostgreSQL', 'IntelliJ IDEA']);
  });

  it('draws each ring with its own gradient, unique to the instance', () => {
    const a = build();
    const b = build();
    const ids = (f: ComponentFixture<unknown>) =>
      Array.from(f.nativeElement.querySelectorAll('linearGradient') as NodeListOf<Element>).map(
        (g) => g.id,
      );

    expect(ids(a).length).toBe(2);
    expect(ids(b).length).toBe(2);
    expect(ids(a).filter((id) => ids(b).includes(id))).toEqual([]);

    for (const f of [a, b]) {
      const strokes = Array.from(
        f.nativeElement.querySelectorAll('path.orbit-ring') as NodeListOf<SVGPathElement>,
      ).map((path) => path.getAttribute('stroke'));
      expect(strokes).toEqual(ids(f).map((id) => `url(#${id})`));
    }
  });

  it('runs one animation per logo: a lap per ring period, starting at its slot', () => {
    const f = build();

    expect(animationsOf(f).length).toBe(10);
    logos(f).forEach((li, i) => {
      const tool = ORBIT_TOOLS[i];
      const ring = RINGS[tool.ring];
      const animations = li.getAnimations();
      expect(animations.length).toBe(1);

      const timing = animations[0].effect!.getTiming();
      expect(timing.duration).toBe(ring.periodMs);
      expect(timing.delay).toBeCloseTo(-tool.slot * ring.periodMs, 6);
      expect(timing.iterations).toBe(Infinity);
      expect(timing.easing).toBe('linear');
      expect((animations[0].effect as KeyframeEffect).getKeyframes().length).toBe(73);
    });
  });

  it('counts the orbit on screen from its first visible pixel', () => {
    build();
    expect(watchOptions).toEqual({ threshold: 0 });
  });

  it('pauses every animation while off screen and resumes them on return', () => {
    const f = build();
    expect(animationsOf(f).every((a) => a.playState === 'running')).toBeTrue();

    onChange!(false);
    expect(animationsOf(f).length).toBe(10);
    expect(animationsOf(f).every((a) => a.playState === 'paused')).toBeTrue();

    onChange!(true);
    expect(animationsOf(f).every((a) => a.playState === 'running')).toBeTrue();
  });

  it('shows the resting pose and runs nothing under reduced motion', () => {
    reducedMotion.set(true);
    const f = build();

    expect(animationsOf(f)).toEqual([]);
    expectRestPoses(f);
  });

  it('cancels the orbit when reduced motion turns on, and restarts it when it turns off', () => {
    const f = build();
    expect(animationsOf(f).length).toBe(10);

    reducedMotion.set(true);
    settle(f);
    expect(animationsOf(f)).toEqual([]);
    expectRestPoses(f);

    reducedMotion.set(false);
    settle(f);
    expect(animationsOf(f).length).toBe(10);
  });

  it('restarts paused if motion is allowed again while off screen', () => {
    const f = build();
    onChange!(false);
    reducedMotion.set(true);
    settle(f);
    reducedMotion.set(false);
    settle(f);

    expect(animationsOf(f).length).toBe(10);
    expect(animationsOf(f).every((a) => a.playState === 'paused')).toBeTrue();
  });

  it('regenerates the keyframes in pixels on resize, keeping each lap where it was', () => {
    const f = build();
    const first = logos(f)[0].getAnimations()[0];
    first.pause();
    first.currentTime = 1234;

    resize!(
      [{ contentRect: { width: 300 } }] as unknown as ResizeObserverEntry[],
      {} as ResizeObserver,
    );

    const tool = ORBIT_TOOLS[0];
    const expected = orbitKeyframes(RINGS[tool.ring].radius, 3);
    const frames = (first.effect as KeyframeEffect).getKeyframes();
    expect(frames.length).toBe(expected.length);
    expect(numbers(frames[9]['transform'] as string)).toEqual(
      numbers(expected[9]['transform'] as string),
    );
    // The same animation, updated in place, not a fresh one started at slot 0.
    expect(logos(f)[0].getAnimations().length).toBe(1);
    expect(logos(f)[0].getAnimations()[0]).toBe(first);
    expect(first.currentTime as number).toBeCloseTo(1234, 3);
  });

  it('stops everything and lets go of both observers when destroyed', () => {
    const f = build();
    const items = logos(f);
    expect(items.flatMap((li) => li.getAnimations()).length).toBe(10);

    f.destroy();

    expect(items.flatMap((li) => li.getAnimations())).toEqual([]);
    expect(released).toBeTrue();
    expect(disconnected).toBeTrue();
  });
});
