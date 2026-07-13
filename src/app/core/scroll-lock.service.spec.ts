import { NgZone } from '@angular/core';
import { ScrollLockService } from './scroll-lock.service';

/**
 * The interface is `acquire()` -> release handle; its test surface is the
 * observable lock state (root `overflow-y`) as holders come and go. This is the
 * bug's regression guard: the lock must survive until the LAST holder releases.
 */
describe('ScrollLockService', () => {
  const root = document.documentElement;
  let lock: ScrollLockService;

  beforeEach(() => {
    // Minimal zone: run the callback synchronously, no Angular bootstrap needed.
    const zone = { runOutsideAngular: (fn: () => unknown) => fn() } as NgZone;
    lock = new ScrollLockService(zone);
    root.style.overflowY = '';
  });

  afterEach(() => {
    root.style.overflowY = '';
  });

  it('locks the page on the first acquire', () => {
    lock.acquire();
    expect(root.style.overflowY).toBe('hidden');
  });

  it('stays locked while more than one holder is active', () => {
    const a = lock.acquire();
    lock.acquire(); // second holder
    a();
    expect(root.style.overflowY).toBe('hidden'); // the other still holds it
  });

  it('unlocks only when the last holder releases', () => {
    const a = lock.acquire();
    const b = lock.acquire();
    a();
    b();
    expect(root.style.overflowY).toBe('');
  });

  it('treats each release handle as idempotent (a double release is a no-op)', () => {
    const a = lock.acquire();
    lock.acquire(); // second holder
    a();
    a(); // must NOT decrement the count a second time
    expect(root.style.overflowY).toBe('hidden'); // the other holder is unharmed
  });

  it('adds and removes the iOS touchmove blocker with the lock', () => {
    const add = spyOn(document, 'addEventListener').and.callThrough();
    const remove = spyOn(document, 'removeEventListener').and.callThrough();
    const release = lock.acquire();
    expect(add).toHaveBeenCalledWith(
      'touchmove',
      jasmine.any(Function),
      jasmine.objectContaining({ passive: false }),
    );
    release();
    expect(remove).toHaveBeenCalledWith('touchmove', jasmine.any(Function));
  });
});
