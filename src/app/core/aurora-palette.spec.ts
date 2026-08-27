import { auroraPalette } from './aurora-palette';

describe('auroraPalette', () => {
  it('returns the warm dark stops and tuning for dark mode', () => {
    const p = auroraPalette(true);
    expect(p.colorStops).toEqual(['#1E1C1A', '#3D312A', '#5A3D2B']);
    expect(p.blend).toBe(0.5);
    expect(p.amplitude).toBe(1.0);
    expect(p.speed).toBe(0.5);
    // Dark mode scales the ramp by intensity — no lift.
    expect(p.lift).toBe(0);
  });

  it('returns the warm dawn light stops and tuning for light mode', () => {
    const p = auroraPalette(false);
    expect(p.colorStops).toEqual(['#FBEAD9', '#F3D3AE', '#E8BC8C']);
    expect(p.blend).toBe(1.0);
    expect(p.amplitude).toBe(0.6);
    expect(p.speed).toBe(0.5);
    // Light mode tints at full value so the warm ramp actually paints.
    expect(p.lift).toBe(1);
  });
});
