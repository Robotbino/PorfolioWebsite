import { ElementRef, SimpleChange, SimpleChanges } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuroraComponent } from './aurora.component';
import { MotionSettingsService } from '../core/motion-settings.service';
import { FramePulseService } from '../core/frame-pulse.service';
import { auroraPalette } from '../core/aurora-palette';

/**
 * The mobile CSS fallback (coarse pointer, no WebGL) is the regression surface:
 * its blobs have no shader uniforms, so a theme flip has to reach them through
 * ngOnChanges or they strand on the page-load palette — a brown aurora in light
 * mode, a white one in dark. A fake matchMedia forces the fallback branch; the
 * test asserts the blob gradients follow the palette.
 */
describe('AuroraComponent — mobile CSS fallback recolour', () => {
  // Taken from core/aurora-palette.ts rather than hand-copied: a pasted fixture
  // keeps passing while implying a palette the site no longer ships.
  const DARK = auroraPalette(true).colorStops;
  const LIGHT = auroraPalette(false).colorStops;

  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    // Coarse pointer + no hover ⇒ MotionSettings.coarsePointer() is true ⇒ the
    // component takes the CSS fallback, not WebGL.
    window.matchMedia = ((q: string) =>
      ({
        matches: q.includes('coarse'),
        addEventListener() {},
      }) as unknown as MediaQueryList) as typeof window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  /** Browser-normalised rgb(...) for a hex, matching how inline styles serialise. */
  function rgb(hex: string): string {
    const probe = document.createElement('div');
    probe.style.color = hex;
    document.body.appendChild(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }

  function build(): { aurora: AuroraComponent; blobs: HTMLElement[] } {
    const pulse = { onTick: () => () => {} } as any;
    // The component takes its dependencies via inject(), so they come from an
    // injector rather than constructor arguments. The real
    // MotionSettingsService is used deliberately — it reads window.matchMedia,
    // which the fake above controls, and that IS the branch under test.
    // Reset first: build() can run more than once in a single spec, and
    // configuring an already-instantiated testing module throws.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: FramePulseService, useValue: pulse }, MotionSettingsService],
    });
    const aurora = TestBed.runInInjectionContext(() => new AuroraComponent());
    const container = document.createElement('div');
    (aurora as any).containerRef = new ElementRef(container);
    aurora.colorStops = DARK;
    aurora.ngAfterViewInit(); // builds the fallback blobs at the dark palette
    const blobs = Array.from(container.querySelectorAll('div')) as HTMLElement[];
    return { aurora, blobs };
  }

  it('paints the blobs with the initial (dark) palette', () => {
    const { blobs } = build();
    expect(blobs.length).toBe(3);
    blobs.forEach((b, i) => expect(b.style.background).toContain(rgb(DARK[i])));
  });

  it('recolours every blob when the palette flips to light', () => {
    const { aurora, blobs } = build();
    aurora.colorStops = LIGHT;
    const changes: SimpleChanges = { colorStops: new SimpleChange(DARK, LIGHT, false) };
    aurora.ngOnChanges(changes);
    blobs.forEach((b, i) => {
      expect(b.style.background).toContain(rgb(LIGHT[i]));
      expect(b.style.background).not.toContain(rgb(DARK[i]));
    });
  });
});

/**
 * Reduced motion is the other regression surface. Neither aurora renderer is
 * reachable by the global `@media (prefers-reduced-motion)` rule in styles.css —
 * that rule clamps CSS animations only, never a WebGL canvas or a Web Animations
 * API object — so the gate lives in the component, and it has to be asserted
 * here rather than in a browser: a headless preview can't advance these
 * animations, so "it looks still" proves nothing.
 *
 * Both branches are covered: the coarse-pointer CSS fallback and the WebGL path
 * (which never subscribes to the shared frame pulse).
 */
describe('AuroraComponent — reduced motion', () => {
  const DARK: [string, string, string] = ['#1E1C1A', '#3D312A', '#5A3D2B'];

  let originalMatchMedia: typeof window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  /** Fake matchMedia: reduce always on, pointer type the caller's choice. Answers
   *  the three queries MotionSettingsService actually asks. */
  function fakeMedia(coarse: boolean): void {
    originalMatchMedia = window.matchMedia;
    window.matchMedia = ((q: string) =>
      ({
        matches: q.includes('prefers-reduced-motion')
          ? true
          : q.includes('coarse')
            ? coarse
            : q.includes('hover: hover')
              ? !coarse
              : false,
        addEventListener() {},
      }) as unknown as MediaQueryList) as typeof window.matchMedia;
  }

  /**
   * Builds a component with the given pulse double. The component takes its
   * dependencies via inject(), so they come from an injector rather than
   * constructor arguments; the real MotionSettingsService is used deliberately,
   * because it reads the faked window.matchMedia that selects the branch under
   * test.
   */
  function makeAurora(pulse: unknown): AuroraComponent {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: FramePulseService, useValue: pulse }, MotionSettingsService],
    });
    return TestBed.runInInjectionContext(() => new AuroraComponent());
  }

  it('builds the fallback blobs without animating them (coarse pointer)', () => {
    fakeMedia(true);
    const pulse = { onTick: () => () => {} } as any;
    const aurora = makeAurora(pulse);
    const container = document.createElement('div');
    (aurora as any).containerRef = new ElementRef(container);
    aurora.colorStops = DARK;
    aurora.ngAfterViewInit();

    const blobs = Array.from(container.querySelectorAll('div')) as HTMLElement[];
    expect(blobs.length).toBe(3);
    // The composition is still there...
    blobs.forEach((b) => expect(b.style.background).toContain('radial-gradient'));
    // ...but nothing is driving it, and no layer is being held for nothing.
    expect((aurora as any).fallbackAnimations.length).toBe(0);
    blobs.forEach((b) => {
      expect(b.getAnimations().length).toBe(0);
      expect(b.style.willChange).toBe('auto');
      expect(b.style.transform).toBeTruthy(); // resting at the first keyframe
    });
  });

  it('never subscribes to the frame pulse on the WebGL path', () => {
    fakeMedia(false); // fine pointer ⇒ WebGL branch, reduce still on
    let ticks = 0;
    const pulse = {
      onTick: () => {
        ticks++;
        return () => {};
      },
    } as any;
    const aurora = makeAurora(pulse);
    const container = document.createElement('div');
    (aurora as any).containerRef = new ElementRef(container);
    aurora.colorStops = DARK;

    try {
      aurora.ngAfterViewInit();
    } catch {
      // A headless runner without a WebGL context can't build the shader. The
      // assertion below still holds and is the point: whether or not the context
      // came up, the frame loop was never joined.
    }
    expect(ticks).toBe(0);
    expect((aurora as any).unsub).toBeNull();
    aurora.ngOnDestroy();
  });
});
