import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CertificationsComponent } from './certifications.component';
import { CERTIFICATIONS } from './certifications-data';
import { CAMERA_PERSPECTIVE_PX } from '../../core/camera';
import { FramePulseService } from '../../core/frame-pulse.service';
import { MotionSettingsService } from '../../core/motion-settings.service';
import { InViewCallback, InViewportService } from '../../core/in-viewport.service';
import { NavTransitionService } from '../../core/nav-transition.service';
import { ScrollLockService } from '../../core/scroll-lock.service';
import { PageInertService } from '../../core/page-inert.service';

type Tick = (now: number, dt: number) => void;

/**
 * The preview's motion is written imperatively on the shared tick, which a
 * headless run never advances on its own, so these specs drive the tick by
 * hand and read what it wrote. They pin down the parts the stylesheet depends
 * on: each certificate's own proportions reaching its face, the --turn the
 * sheen and the shadow read, and the spotlight opening at the right shape.
 */
describe('CertificationsComponent', () => {
  let tick: Tick | null;
  let watchers: Map<Element, InViewCallback>;

  function build(
    options: { reducedMotion?: boolean } = {},
  ): ComponentFixture<CertificationsComponent> {
    tick = null;
    watchers = new Map();
    TestBed.configureTestingModule({
      imports: [CertificationsComponent],
      providers: [
        {
          provide: FramePulseService,
          useValue: {
            onTick: (fn: Tick) => {
              tick = fn;
              return () => {
                if (tick === fn) {
                  tick = null;
                }
              };
            },
          },
        },
        {
          provide: MotionSettingsService,
          useValue: {
            reducedMotion: signal(options.reducedMotion ?? false),
            finePointer: signal(true),
            coarsePointer: signal(false),
          },
        },
        {
          provide: InViewportService,
          useValue: {
            observe: (target: Element, _options: IntersectionObserverInit, cb: InViewCallback) => {
              watchers.set(target, cb);
              return () => watchers.delete(target);
            },
          },
        },
        { provide: NavTransitionService, useValue: { onNavigate: () => () => {} } },
        { provide: ScrollLockService, useValue: { acquire: () => () => {} } },
        { provide: PageInertService, useValue: { isolate: () => () => {} } },
      ],
    });
    const fixture = TestBed.createComponent(CertificationsComponent);
    fixture.detectChanges();
    return fixture;
  }

  /** The section comes within reach of the viewport: the preview stacks mount. */
  function arm(fixture: ComponentFixture<CertificationsComponent>): void {
    const onChange = watchers.get(fixture.nativeElement);
    expect(onChange).toBeDefined();
    onChange!(true);
    fixture.detectChanges();
  }

  it('fits each certificate in the preview to its own proportions, out of the a11y tree', () => {
    const f = build();
    const host = f.nativeElement as HTMLElement;
    arm(f);

    const faces = Array.from(host.querySelectorAll<HTMLElement>('.certs-preview-face'));
    const shadows = Array.from(host.querySelectorAll<HTMLElement>('.certs-preview-shadow'));
    expect(faces.length).toBe(CERTIFICATIONS.length);
    expect(shadows.length).toBe(CERTIFICATIONS.length);
    CERTIFICATIONS.forEach((cert, i) => {
      const ratio = cert.width / cert.height;
      expect(Number(faces[i].style.getPropertyValue('--cert-ratio'))).toBeCloseTo(ratio, 6);
      expect(Number(shadows[i].style.getPropertyValue('--cert-ratio'))).toBeCloseTo(ratio, 6);
      expect(faces[i].querySelector('img')?.getAttribute('alt')).toBe('');
    });
    expect(host.querySelector('.certs-preview')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('mounts no preview under reduced motion, where it can never show', () => {
    const f = build({ reducedMotion: true });
    const host = f.nativeElement as HTMLElement;
    arm(f);

    expect(host.querySelectorAll('.certs-preview-face').length).toBe(0);
    expect(host.querySelectorAll('.certs-preview-shadow').length).toBe(0);
  });

  describe('the preview turn', () => {
    /**
     * Opens the preview on the first row and aims the tether `targetX` px from
     * where it appeared. The target is set past the tether's viewport clamp,
     * so the first frames are a fling of a known size whatever the width of
     * the test window.
     */
    function openPreview(targetX: number): { tilt: HTMLElement; turnWrites: () => number } {
      const f = build();
      const host = f.nativeElement as HTMLElement;
      const tilt = host.querySelector('.certs-preview-tilt') as HTMLElement;
      const setProperty = spyOn(tilt.style, 'setProperty').and.callThrough();
      f.componentInstance.onRowEnter(0);
      (f.componentInstance as unknown as { targetX: number }).targetX = targetX;
      expect(tick).not.toBeNull();
      return {
        tilt,
        turnWrites: () => setProperty.calls.allArgs().filter(([name]) => name === '--turn').length,
      };
    }

    it('turns 14deg at most, through the shared camera, and writes that as --turn 1', () => {
      const { tilt } = openPreview(5000);
      tick!(0, 16);

      expect(tilt.style.getPropertyValue('--turn')).toBe('1.000');
      expect(tilt.style.transform).toContain(`perspective(${CAMERA_PERSPECTIVE_PX}px)`);
      expect(tilt.style.transform).toContain('rotateY(14deg)');
      expect(tilt.style.transform).toContain('rotateZ(4.67deg)');
    });

    it('writes --turn -1 for a fling the other way', () => {
      const { tilt } = openPreview(-5000);
      tick!(0, 16);

      expect(tilt.style.getPropertyValue('--turn')).toBe('-1.000');
      expect(tilt.style.transform).toContain('rotateY(-14deg)');
    });

    it('skips the --turn write while the rounded value holds', () => {
      const { tilt, turnWrites } = openPreview(5000);
      tick!(0, 16);
      expect(turnWrites()).toBe(1);

      // Still pinned at the cap: the transform keeps being written, --turn not.
      tick!(16, 16);
      tick!(32, 16);
      expect(tilt.style.getPropertyValue('--turn')).toBe('1.000');
      expect(turnWrites()).toBe(1);
    });

    it('stays square to the viewer while the pointer is still', () => {
      const { tilt, turnWrites } = openPreview(0);
      tick!(0, 16);
      tick!(16, 16);

      expect(tilt.style.getPropertyValue('--turn')).toBe('0.000');
      expect(turnWrites()).toBe(1);
    });
  });

  it('opens the spotlight at the shape of the certificate it shows', () => {
    const f = build();
    const host = f.nativeElement as HTMLElement;
    const frame = host.querySelector('.certs-spotlight-frame') as HTMLElement;
    const cert = CERTIFICATIONS[1];

    host.querySelectorAll<HTMLButtonElement>('.certs-trigger')[1].click();

    expect(Number(frame.style.getPropertyValue('--cert-ratio'))).toBeCloseTo(
      cert.width / cert.height,
      6,
    );
    const img = frame.querySelector('.certs-spotlight-face > img') as HTMLImageElement;
    expect(img.getAttribute('alt')).toBe(cert.alt);

    f.destroy();
    expect(document.body.classList.contains('certs-spotlight-open')).toBeFalse();
  });
});
