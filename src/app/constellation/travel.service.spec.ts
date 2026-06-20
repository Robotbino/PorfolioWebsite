import { Constellation } from './constellation.model';
import { TravelService } from './travel.service';

function fig(name: string): Constellation {
  return {
    name,
    side: 'left',
    viewBox: '0 0 300 300',
    stars: Array.from({ length: 8 }, (_, i) => ({
      name: `${name}${i}`,
      x: i * 10,
      y: i * 5,
      r: 2,
      phx: 0,
      phy: 0,
      amp: 0,
    })),
    links: [{ a: 0, b: 1 }],
  };
}

describe('TravelService', () => {
  let svc: TravelService;
  const home = fig('home');
  const work = fig('work');
  const about = fig('about');

  beforeEach(() => {
    svc = new TravelService();
    svc.init(home);
  });

  it('rests on the initial figure', () => {
    expect(svc.from).toBe(home);
    expect(svc.to).toBe(home);
    expect(svc.phase()).toBe('idle');
    expect(svc.easedProgressAt(1234)).toBe(1);
  });

  it('begins travelling from the current figure to the target', () => {
    svc.travelTo(work, 1000);
    expect(svc.from).toBe(home);
    expect(svc.to).toBe(work);
    expect(svc.phase()).toBe('travelling');
    expect(svc.easedProgressAt(1000)).toBe(0);
  });

  it('eases to the exact midpoint halfway through the duration', () => {
    svc.travelTo(work, 0);
    expect(svc.easedProgressAt(svc.DURATION / 2)).toBeCloseTo(0.5, 6);
  });

  it('completes and settles on the target at the end of the duration', () => {
    svc.travelTo(work, 0);
    expect(svc.easedProgressAt(svc.DURATION)).toBe(1);
    expect(svc.phase()).toBe('idle');
    expect(svc.from).toBe(work);
    expect(svc.to).toBe(work);
  });

  it('clamps progress before the start and after the end', () => {
    svc.travelTo(work, 100);
    expect(svc.easedProgressAt(50)).toBe(0);
    expect(svc.easedProgressAt(100 + svc.DURATION * 2)).toBe(1);
  });

  it('redirects mid-travel: the new origin is the in-flight target', () => {
    svc.travelTo(work, 0);
    svc.easedProgressAt(svc.DURATION / 2);
    svc.travelTo(about, svc.DURATION / 2);
    expect(svc.from).toBe(work);
    expect(svc.to).toBe(about);
    expect(svc.phase()).toBe('travelling');
    expect(svc.easedProgressAt(svc.DURATION / 2)).toBe(0);
  });

  it('ignores a trip to the figure already shown', () => {
    svc.travelTo(work, 0);
    svc.easedProgressAt(svc.DURATION);
    svc.travelTo(work, 5000);
    expect(svc.phase()).toBe('idle');
    expect(svc.to).toBe(work);
  });

  it('cuts instantly under reduced motion (no travelling phase)', () => {
    spyOn(svc as unknown as { prefersReducedMotion(): boolean }, 'prefersReducedMotion').and.returnValue(
      true,
    );
    svc.travelTo(work, 0);
    expect(svc.phase()).toBe('idle');
    expect(svc.from).toBe(work);
    expect(svc.to).toBe(work);
    expect(svc.easedProgressAt(10)).toBe(1);
  });
});
