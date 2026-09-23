import { WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProjectScreenshotsComponent } from './project-screenshots.component';
import { ThemeService } from '../../../core/theme.service';
import { MotionSettingsService } from '../../../core/motion-settings.service';
import { InViewportService } from '../../../core/in-viewport.service';
import { ProjectImage } from '../work-data';

/**
 * The slideshow's timer is a CSS animation, and a headless run can't be relied
 * on to play one — so these specs fire `animationend` by hand, which is exactly
 * the signal the component acts on. What they pin down is the part CSS can't:
 * which screenshot comes next, and when the timer must not advance at all.
 */
describe('ProjectScreenshotsComponent', () => {
  let reducedMotion: WritableSignal<boolean>;

  function shot(label: string): ProjectImage {
    const path = `/assets/${label}.webp`;
    return {
      dark: path,
      light: path,
      width: 1600,
      height: 900,
      alt: { dark: label, light: label },
      label,
    };
  }

  const THREE = [shot('Store'), shot('Game details'), shot('Checkout')];

  function build(screenshots: readonly ProjectImage[]): ComponentFixture<ProjectScreenshotsComponent> {
    TestBed.configureTestingModule({
      imports: [ProjectScreenshotsComponent],
      providers: [
        { provide: ThemeService, useValue: { themeAsset: (dark: string) => dark } },
        { provide: MotionSettingsService, useValue: { reducedMotion } },
        // Viewport crossings only pause the bar (a CSS concern); keep the real
        // observer out so a spec's outcome can't depend on the Karma window.
        { provide: InViewportService, useValue: { observe: () => () => {} } },
      ],
    });
    const fixture = TestBed.createComponent(ProjectScreenshotsComponent);
    fixture.componentRef.setInput('screenshots', screenshots);
    fixture.componentRef.setInput('projectTitle', 'Game Store');
    fixture.detectChanges();
    return fixture;
  }

  const images = (f: ComponentFixture<unknown>) =>
    Array.from(f.nativeElement.querySelectorAll('img.shot')) as HTMLImageElement[];
  const buttons = (f: ComponentFixture<unknown>) =>
    Array.from(f.nativeElement.querySelectorAll('.shots-bar')) as HTMLButtonElement[];
  const fills = (f: ComponentFixture<unknown>) =>
    Array.from(f.nativeElement.querySelectorAll('.shots-bar-fill')) as HTMLElement[];
  const caption = (f: ComponentFixture<unknown>) =>
    (f.nativeElement.querySelector('.shots-caption') as HTMLElement).textContent!.trim();
  const shown = (f: ComponentFixture<unknown>) =>
    images(f).findIndex((img) => img.classList.contains('is-active'));

  function barRunsOut(f: ComponentFixture<unknown>, index: number): void {
    fills(f)[index].dispatchEvent(new Event('animationend'));
    f.detectChanges();
  }

  beforeEach(() => {
    reducedMotion = signal(false);
  });

  it('renders a single screenshot as a plain image, with no controls', () => {
    const f = build([shot('Store')]);
    expect(images(f).length).toBe(1);
    expect(shown(f)).toBe(0);
    expect(f.nativeElement.querySelector('.shots-controls')).toBeNull();
  });

  it('keeps the chosen part of a screenshot in view, and centres the rest', () => {
    const f = build([{ ...shot('Store'), position: '30% 50%' }, shot('Game details')]);
    expect(images(f)[0].style.objectPosition).toBe('30% 50%');
    expect(images(f)[1].style.objectPosition).toBe('');
  });

  it('opens on the cover and hides the others from assistive tech', () => {
    const f = build(THREE);
    expect(shown(f)).toBe(0);
    expect(caption(f)).toBe('Store');
    expect(images(f).map((img) => img.getAttribute('aria-hidden'))).toEqual([null, 'true', 'true']);
    expect(buttons(f).map((b) => b.getAttribute('aria-current'))).toEqual(['true', null, null]);
    expect(buttons(f)[1].getAttribute('aria-label')).toBe('Show Game details');
  });

  it('brings up the next screenshot when the running bar runs out, wrapping at the end', () => {
    const f = build(THREE);
    expect(fills(f)[0].classList).toContain('is-running');

    barRunsOut(f, 0);
    expect(shown(f)).toBe(1);
    expect(caption(f)).toBe('Game details');
    expect(fills(f)[1].classList).toContain('is-running');
    expect(fills(f)[0].classList).not.toContain('is-running');

    barRunsOut(f, 1);
    barRunsOut(f, 2);
    expect(shown(f)).toBe(0);
  });

  it('ignores a bar that is not the one running', () => {
    const f = build(THREE);
    barRunsOut(f, 2);
    expect(shown(f)).toBe(0);
  });

  it('hands control to the visitor once they pick a screenshot', () => {
    const f = build(THREE);
    buttons(f)[2].click();
    f.detectChanges();

    expect(shown(f)).toBe(2);
    expect(caption(f)).toBe('Checkout');
    expect(fills(f).some((fill) => fill.classList.contains('is-running'))).toBeFalse();
    expect(f.nativeElement.querySelector('.shots-caption').getAttribute('aria-live')).toBe('polite');

    // A bar ending after the choice (the animation it had begun) must not
    // take the screenshot away from them.
    barRunsOut(f, 2);
    expect(shown(f)).toBe(2);
  });

  it('never runs the timer under reduced motion', () => {
    reducedMotion.set(true);
    const f = build(THREE);
    expect(fills(f).some((fill) => fill.classList.contains('is-running'))).toBeFalse();

    // The global kill-switch ends any animation after 0.01ms; that end must
    // not be mistaken for a finished screenshot.
    barRunsOut(f, 0);
    expect(shown(f)).toBe(0);
  });
});
