import { FramePulseService } from './frame-pulse.service';
import { NgZone } from '@angular/core';
import { TestBed } from '@angular/core/testing';

describe('FramePulseService', () => {
  let service: FramePulseService;
  let rafCallbacks: ((now: number) => void)[];
  let cancelledIds: Set<number>;
  let nextId: number;

  beforeEach(() => {
    rafCallbacks = [];
    cancelledIds = new Set();
    nextId = 1;

    spyOn(window, 'requestAnimationFrame').and.callFake((cb: FrameRequestCallback) => {
      const id = nextId++;
      rafCallbacks.push((now) => {
        if (!cancelledIds.has(id)) cb(now);
      });
      return id;
    });
    spyOn(window, 'cancelAnimationFrame').and.callFake((id: number) => {
      cancelledIds.add(id);
    });

    // The service takes NgZone via inject(), so it comes from an injector now.
    // TestBed's REAL NgZone is used rather than the old hand-rolled stub:
    // overriding the provider replaces the zone the framework itself runs on,
    // and runOutsideAngular already invokes its callback synchronously, which
    // is all these specs needed the stub for.
    TestBed.resetTestingModule();
    service = TestBed.inject(FramePulseService);
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  function fireFrame(now: number): void {
    const pending = rafCallbacks.splice(0);
    pending.forEach(cb => cb(now));
  }

  function setHidden(hidden: boolean): void {
    Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }

  afterEach(() => {
    // Leave `document.hidden` back at its real value for other specs.
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });

  it('calls subscribers on each frame', () => {
    const spy = jasmine.createSpy('tick');
    service.onTick(spy);
    fireFrame(1000);
    fireFrame(1016);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('passes now and dt', () => {
    const calls: [number, number][] = [];
    service.onTick((now, dt) => calls.push([now, dt]));
    fireFrame(1000);
    fireFrame(1016);
    expect(calls[0][0]).toBe(1000);
    expect(calls[0][1]).toBe(0); // first frame has no previous
    expect(calls[1][0]).toBe(1016);
    expect(calls[1][1]).toBe(16);
  });

  it('stops calling after unsubscribe', () => {
    const spy = jasmine.createSpy('tick');
    const unsub = service.onTick(spy);
    fireFrame(1000);
    unsub();
    fireFrame(1016);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('supports multiple subscribers', () => {
    const a = jasmine.createSpy('a');
    const b = jasmine.createSpy('b');
    service.onTick(a);
    service.onTick(b);
    fireFrame(1000);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('stops the rAF loop when the last subscriber unsubscribes', () => {
    const unsub = service.onTick(() => {});
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
    unsub();
    expect(window.cancelAnimationFrame).toHaveBeenCalled();
  });

  it('restarts the loop when a new subscriber joins after all left', () => {
    const unsub1 = service.onTick(() => {});
    unsub1();
    (window.requestAnimationFrame as jasmine.Spy).calls.reset();
    service.onTick(() => {});
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
  });

  it('parks the loop while the tab is hidden', () => {
    service.onTick(() => {});
    (window.requestAnimationFrame as jasmine.Spy).calls.reset();
    setHidden(true);
    expect(window.cancelAnimationFrame).toHaveBeenCalled();
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it('re-arms the loop when the tab becomes visible again', () => {
    service.onTick(() => {});
    setHidden(true);
    (window.requestAnimationFrame as jasmine.Spy).calls.reset();
    setHidden(false);
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
  });

  it('hands the first tick back a dt of 0 (no spike from the hidden gap)', () => {
    const calls: [number, number][] = [];
    service.onTick((now, dt) => calls.push([now, dt]));
    fireFrame(1000);
    fireFrame(1016); // dt 16 while visible
    setHidden(true);
    setHidden(false);
    fireFrame(50000); // long gap, but the clock was reset on resume
    expect(calls[calls.length - 1]).toEqual([50000, 0]);
  });

  it('does not re-arm on visibility when there are no subscribers', () => {
    const unsub = service.onTick(() => {});
    unsub();
    (window.requestAnimationFrame as jasmine.Spy).calls.reset();
    setHidden(true);
    setHidden(false);
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });

  // The certifications spotlight releases its subscription from inside its own
  // tick. At that moment `rafId` holds the id of the frame already executing, so
  // cancelling it does nothing — the loop has to notice the empty set itself or
  // it runs forever with no subscribers.
  it('stops when the last subscriber unsubscribes from inside a tick', () => {
    let unsub = () => {};
    unsub = service.onTick(() => unsub());

    fireFrame(1000);
    (window.requestAnimationFrame as jasmine.Spy).calls.reset();
    fireFrame(1016);

    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it('restarts cleanly after unsubscribing from inside a tick', () => {
    let unsub = () => {};
    unsub = service.onTick(() => unsub());
    fireFrame(1000);

    const spy = jasmine.createSpy('tick');
    service.onTick(spy);
    fireFrame(2000);
    fireFrame(2016);

    // The clock restarted, so the first tick back reports dt 0, not a 1s spike.
    expect(spy.calls.argsFor(0)).toEqual([2000, 0]);
    expect(spy.calls.argsFor(1)).toEqual([2016, 16]);
  });
});
