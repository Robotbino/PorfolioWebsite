import { NgZone } from '@angular/core';
import { InViewportService } from './in-viewport.service';

/**
 * The interface is `observe()` -> release handle; the test surface is how
 * targets are routed, when observers are shared vs. separate, and that a
 * release unobserves (then disconnects the shared observer once empty). A fake
 * IntersectionObserver lets us fire crossings and inspect observe/unobserve.
 */
describe('InViewportService', () => {
  class FakeIO {
    static instances: FakeIO[] = [];
    readonly observed = new Set<Element>();
    disconnected = false;
    constructor(
      readonly cb: IntersectionObserverCallback,
      readonly options: IntersectionObserverInit,
    ) {
      FakeIO.instances.push(this);
    }
    observe(el: Element): void {
      this.observed.add(el);
    }
    unobserve(el: Element): void {
      this.observed.delete(el);
    }
    disconnect(): void {
      this.disconnected = true;
      this.observed.clear();
    }
    fire(entries: { target: Element; isIntersecting: boolean }[]): void {
      this.cb(entries as unknown as IntersectionObserverEntry[], this as unknown as IntersectionObserver);
    }
  }

  let service: InViewportService;
  let original: typeof IntersectionObserver;
  let zone: NgZone;

  beforeEach(() => {
    FakeIO.instances = [];
    original = window.IntersectionObserver;
    window.IntersectionObserver = FakeIO as unknown as typeof IntersectionObserver;
    zone = { runOutsideAngular: (fn: () => unknown) => fn() } as NgZone;
    service = new InViewportService(zone);
  });

  afterEach(() => {
    window.IntersectionObserver = original;
  });

  const el = (): Element => document.createElement('div');

  it('routes a crossing to the matching target callback', () => {
    const a = el();
    const b = el();
    const seenA: boolean[] = [];
    const seenB: boolean[] = [];
    service.observe(a, { threshold: 0.15 }, (v) => seenA.push(v));
    service.observe(b, { threshold: 0.15 }, (v) => seenB.push(v));
    FakeIO.instances[0].fire([{ target: a, isIntersecting: true }]);
    expect(seenA).toEqual([true]);
    expect(seenB).toEqual([]); // b was not in this entry batch
  });

  it('shares one observer across targets with identical options', () => {
    service.observe(el(), { rootMargin: '-50% 0px -50% 0px', threshold: 0 }, () => {});
    service.observe(el(), { rootMargin: '-50% 0px -50% 0px', threshold: 0 }, () => {});
    expect(FakeIO.instances.length).toBe(1);
    expect(FakeIO.instances[0].observed.size).toBe(2);
  });

  it('creates separate observers for different options', () => {
    service.observe(el(), { threshold: 0.15 }, () => {});
    service.observe(el(), { rootMargin: '50% 0px' }, () => {});
    expect(FakeIO.instances.length).toBe(2);
  });

  it('unobserves the target on release but keeps the shared observer alive', () => {
    const a = el();
    const b = el();
    const releaseA = service.observe(a, { threshold: 0.15 }, () => {});
    service.observe(b, { threshold: 0.15 }, () => {});
    releaseA();
    const io = FakeIO.instances[0];
    expect(io.observed.has(a)).toBe(false);
    expect(io.observed.has(b)).toBe(true);
    expect(io.disconnected).toBe(false);
  });

  it('disconnects the shared observer when the last target releases', () => {
    const release = service.observe(el(), { threshold: 0.15 }, () => {});
    release();
    expect(FakeIO.instances[0].disconnected).toBe(true);
  });

  it('treats a double release as a no-op', () => {
    const a = el();
    const b = el();
    const releaseA = service.observe(a, { threshold: 0.15 }, () => {});
    service.observe(b, { threshold: 0.15 }, () => {});
    releaseA();
    releaseA(); // must not evict b or disconnect
    const io = FakeIO.instances[0];
    expect(io.observed.has(b)).toBe(true);
    expect(io.disconnected).toBe(false);
  });

  it('constructs its observers outside the Angular zone', () => {
    const spy = spyOn(zone, 'runOutsideAngular').and.callThrough();
    service.observe(el(), { threshold: 0.15 }, () => {});
    expect(spy).toHaveBeenCalled();
  });
});
