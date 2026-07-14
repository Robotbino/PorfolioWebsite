import { MotionSettingsService } from './motion-settings.service';

/**
 * The interface is three read-only signals; the test surface is what they
 * report from matchMedia at construction and whether they follow a live
 * preference change. A controllable matchMedia stand-in lets us seed the
 * initial `matches` and fire `change` events.
 */
describe('MotionSettingsService', () => {
  const REDUCE = '(prefers-reduced-motion: reduce)';
  const FINE = '(hover: hover) and (pointer: fine)';
  const COARSE = '(hover: none) and (pointer: coarse)';

  class FakeMql {
    matches = false;
    private listeners = new Set<(e: { matches: boolean }) => void>();
    addEventListener(_type: 'change', fn: (e: { matches: boolean }) => void): void {
      this.listeners.add(fn);
    }
    flip(matches: boolean): void {
      this.matches = matches;
      this.listeners.forEach((fn) => fn({ matches }));
    }
  }

  let mqls: Map<string, FakeMql>;
  let original: typeof window.matchMedia;

  /** Pre-create a query's MediaQueryList with a chosen initial state. */
  function seed(query: string, matches: boolean): void {
    const mql = new FakeMql();
    mql.matches = matches;
    mqls.set(query, mql);
  }

  beforeEach(() => {
    mqls = new Map();
    original = window.matchMedia;
    window.matchMedia = ((query: string) => {
      let mql = mqls.get(query);
      if (!mql) {
        mql = new FakeMql();
        mqls.set(query, mql);
      }
      return mql as unknown as MediaQueryList;
    }) as typeof window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = original;
  });

  it('seeds each signal from its media query', () => {
    seed(REDUCE, true);
    seed(FINE, true);
    seed(COARSE, false);
    const motion = new MotionSettingsService();
    expect(motion.reducedMotion()).toBe(true);
    expect(motion.finePointer()).toBe(true);
    expect(motion.coarsePointer()).toBe(false);
  });

  it('defaults each signal to false when its query does not match', () => {
    const motion = new MotionSettingsService();
    expect(motion.reducedMotion()).toBe(false);
    expect(motion.finePointer()).toBe(false);
    expect(motion.coarsePointer()).toBe(false);
  });

  it('follows a live reduced-motion change', () => {
    const motion = new MotionSettingsService();
    expect(motion.reducedMotion()).toBe(false);
    mqls.get(REDUCE)!.flip(true);
    expect(motion.reducedMotion()).toBe(true);
  });

  it('keeps fine and coarse pointer independent (a hybrid device matches neither)', () => {
    seed(FINE, false);
    seed(COARSE, false);
    const motion = new MotionSettingsService();
    expect(motion.finePointer()).toBe(false);
    expect(motion.coarsePointer()).toBe(false);
  });
});
