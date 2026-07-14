import { ElementRef, SimpleChange, SimpleChanges } from '@angular/core';
import { AuroraComponent } from './aurora.component';
import { MotionSettingsService } from '../core/motion-settings.service';

/**
 * The mobile CSS fallback (coarse pointer, no WebGL) is the regression surface:
 * its blobs used to bake the page-load palette and never react to a theme flip,
 * stranding a brown aurora in light mode / a white one in dark. The fix routes
 * the flip through ngOnChanges like the shader path. A fake matchMedia forces
 * the fallback branch; the test asserts the blob gradients follow the palette.
 */
describe('AuroraComponent — mobile CSS fallback recolour', () => {
  const DARK: [string, string, string] = ['#1E1C1A', '#3D312A', '#5A3D2B'];
  const LIGHT: [string, string, string] = ['#FDFCFB', '#F5F2EE', '#FAF0E8'];

  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    // Coarse pointer + no hover ⇒ MotionSettings.coarsePointer() is true ⇒ the
    // component takes the CSS fallback, not WebGL.
    window.matchMedia = ((q: string) =>
      ({ matches: q.includes('coarse'), addEventListener() {} }) as unknown as MediaQueryList) as typeof window.matchMedia;
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
    // Real MotionSettingsService reads window.matchMedia (faked above).
    const aurora = new AuroraComponent(pulse, new MotionSettingsService());
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
