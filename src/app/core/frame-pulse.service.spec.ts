import { FramePulseService } from './frame-pulse.service';
import { NgZone } from '@angular/core';

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

    const zone = { runOutsideAngular: (fn: () => void) => fn() } as NgZone;
    service = new FramePulseService(zone);
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  function fireFrame(now: number): void {
    const pending = rafCallbacks.splice(0);
    pending.forEach(cb => cb(now));
  }

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
});
