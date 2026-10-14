import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { ThemeService } from './core/theme.service';
import { MotionSettingsService } from './core/motion-settings.service';
import { InViewCallback, InViewportService } from './core/in-viewport.service';
import { NavTransitionService } from './core/nav-transition.service';
import { ScrollLoopService } from './scroll-loop.service';

/**
 * The shell's real template mounts the whole site. The arrival wiring only
 * needs the #dest sections, with Home and its clone pre-revealed as they are
 * there, so the template is swapped for bare sections and every collaborator
 * the reveal talks to is faked: the observer and the teleport are fired by
 * hand, and each section's rect is pinned.
 */
const SECTIONS = `
  <section #dest class="dest is-visible" data-dest="home"></section>
  <section #dest class="dest" data-dest="work"></section>
  <section #dest class="dest" data-dest="about"></section>
  <section #dest class="dest dest-clone is-visible" data-dest="clone"></section>
`;

describe('AppComponent destination arrival', () => {
  let watchers: Map<Element, InViewCallback>;
  let watchOptions: Map<Element, IntersectionObserverInit>;
  let teleport: (() => void) | null;
  let rects: Map<Element, DOMRect>;

  function build(options: { reducedMotion?: boolean } = {}): ComponentFixture<AppComponent> {
    watchers = new Map();
    watchOptions = new Map();
    teleport = null;
    rects = new Map();
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        { provide: ThemeService, useValue: {} },
        {
          provide: ScrollLoopService,
          useValue: {
            setAnchors: () => undefined,
            update: () => undefined,
            wrapOffset: () => null,
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
            observe: (target: Element, options: IntersectionObserverInit, cb: InViewCallback) => {
              watchers.set(target, cb);
              watchOptions.set(target, options);
              return () => watchers.delete(target);
            },
          },
        },
        {
          provide: NavTransitionService,
          useValue: {
            onTeleport: (fn: () => void) => {
              teleport = fn;
              return () => {
                if (teleport === fn) {
                  teleport = null;
                }
              };
            },
          },
        },
      ],
    });
    TestBed.overrideTemplate(AppComponent, SECTIONS);
    TestBed.overrideComponent(AppComponent, { set: { imports: [] } });
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    return fixture;
  }

  function section(fixture: ComponentFixture<AppComponent>, name: string): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      `[data-dest="${name}"]`,
    )!;
  }

  /** Pin where `el` sits in the viewport for the next anchor read. */
  function placeAt(el: HTMLElement, top: number, height: number): void {
    if (!rects.has(el)) {
      spyOn(el, 'getBoundingClientRect').and.callFake(() => rects.get(el)!);
    }
    rects.set(el, new DOMRect(0, top, 1200, height));
  }

  const anchorOf = (el: HTMLElement) => el.style.getPropertyValue('--arrive-from');

  beforeEach(() => document.body.classList.remove('reveal-ready'));
  afterEach(() => document.body.classList.remove('reveal-ready'));

  it('arms the reveal for the content destinations only', () => {
    const fixture = build();

    expect(document.body.classList.contains('reveal-ready')).toBeTrue();
    expect(watchers.size).toBe(2);
    expect(watchers.has(section(fixture, 'work'))).toBeTrue();
    expect(watchers.has(section(fixture, 'about'))).toBeTrue();
    expect(watchers.has(section(fixture, 'home'))).toBeFalse();
    expect(watchers.has(section(fixture, 'clone'))).toBeFalse();
  });

  it('anchors a section on its top edge as it enters from below, before revealing it', () => {
    const fixture = build();
    const work = section(fixture, 'work');
    placeAt(work, 880, 6300);
    const mutations = new MutationObserver(() => undefined);
    mutations.observe(work, { attributes: true, attributeFilter: ['style', 'class'] });

    watchers.get(work)!(true);
    const order = mutations.takeRecords().map((record) => record.attributeName);
    mutations.disconnect();

    expect(anchorOf(work)).toBe('0%');
    expect(work.classList.contains('is-visible')).toBeTrue();
    // The anchor has to be in place when the scale transition starts.
    expect(order).toEqual(['style', 'class']);
  });

  it('anchors a section near its bottom edge as it enters from above', () => {
    const fixture = build();
    const about = section(fixture, 'about');
    placeAt(about, -860, 900);

    watchers.get(about)!(true);

    expect(parseFloat(anchorOf(about))).toBeCloseTo((860 / 900) * 100, 6);
  });

  it('keeps the anchor when the observer re-reports a section that already arrived', () => {
    const fixture = build();
    const work = section(fixture, 'work');
    placeAt(work, 880, 6300);
    watchers.get(work)!(true);

    // A repeat report for a section that is already in: still visible, now partway in.
    placeAt(work, -400, 6300);
    watchers.get(work)!(true);

    expect(anchorOf(work)).toBe('0%');
  });

  it('reveals on entering the viewport, never on a share of the section', () => {
    const fixture = build();
    const work = section(fixture, 'work');
    const options = watchOptions.get(work)!;

    // A ratio threshold above zero is unreachable for a section several
    // viewports tall, which would leave it hidden for good.
    expect(options.threshold ?? 0).toBe(0);
    expect(options.rootMargin).toBeTruthy();
  });

  it('re-anchors and hides a section once it has left the viewport', () => {
    const fixture = build();
    const work = section(fixture, 'work');
    placeAt(work, 880, 6300);
    watchers.get(work)!(true);

    placeAt(work, -6400, 6300);
    watchers.get(work)!(false);

    expect(anchorOf(work)).toBe('100%');
    expect(work.classList.contains('is-visible')).toBeFalse();
  });

  it('refreshes the anchors when a nav jump lands partway down a section', () => {
    const fixture = build();
    const work = section(fixture, 'work');
    const about = section(fixture, 'about');
    placeAt(work, -1800, 6300);
    placeAt(about, 4500, 900);

    expect(teleport).not.toBeNull();
    teleport!();

    expect(parseFloat(anchorOf(work))).toBeCloseTo((1800 / 6300) * 100, 6);
    expect(anchorOf(about)).toBe('0%');
    expect(anchorOf(section(fixture, 'home'))).toBe('');
  });

  it('hides and anchors nothing under reduced motion', () => {
    const fixture = build({ reducedMotion: true });

    expect(document.body.classList.contains('reveal-ready')).toBeFalse();
    expect(watchers.size).toBe(0);

    teleport!();
    expect(anchorOf(section(fixture, 'work'))).toBe('');
  });

  it('releases the observers and the teleport listener on destroy', () => {
    const fixture = build();
    expect(watchers.size).toBe(2);

    fixture.destroy();

    expect(watchers.size).toBe(0);
    expect(teleport).toBeNull();
  });
});
