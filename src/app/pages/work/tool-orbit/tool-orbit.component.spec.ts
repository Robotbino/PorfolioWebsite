import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ORBIT_TOOLS, ToolOrbitComponent } from './tool-orbit.component';
import { InViewCallback, InViewportService } from '../../../core/in-viewport.service';

/**
 * The orbit itself is CSS keyframes, which a headless run can't be relied on
 * to play. These specs pin down the parts that aren't: what assistive
 * technology is told, and that leaving the viewport pauses the animation.
 */
describe('ToolOrbitComponent', () => {
  let onChange: InViewCallback | undefined;
  let released: boolean;

  function build(): ComponentFixture<ToolOrbitComponent> {
    onChange = undefined;
    released = false;
    TestBed.configureTestingModule({
      imports: [ToolOrbitComponent],
      providers: [
        {
          provide: InViewportService,
          useValue: {
            observe: (_target: Element, _options: IntersectionObserverInit, cb: InViewCallback) => {
              onChange = cb;
              return () => (released = true);
            },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ToolOrbitComponent);
    fixture.detectChanges();
    return fixture;
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
    const rings = f.nativeElement.querySelector('.orbit-rings') as HTMLElement;
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

  it('pauses while off screen and resumes on return', () => {
    const f = build();
    const host = f.nativeElement as HTMLElement;

    expect(host.classList.contains('is-offscreen')).toBeFalse();
    onChange!(false);
    expect(host.classList.contains('is-offscreen')).toBeTrue();
    onChange!(true);
    expect(host.classList.contains('is-offscreen')).toBeFalse();
  });

  it('stops watching the viewport when destroyed', () => {
    const f = build();
    f.destroy();
    expect(released).toBeTrue();
  });
});
