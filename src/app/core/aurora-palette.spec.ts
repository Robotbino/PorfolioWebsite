import { auroraPalette } from './aurora-palette';

describe('auroraPalette', () => {
  it('returns the warm dark stops and tuning for dark mode', () => {
    const p = auroraPalette(true);
    expect(p.colorStops).toEqual(['#1E1C1A', '#3D312A', '#5A3D2B']);
    expect(p.blend).toBe(0.5);
    expect(p.amplitude).toBe(1.0);
    expect(p.speed).toBe(0.5);
  });

  it('returns the cream light stops and calmer tuning for light mode', () => {
    const p = auroraPalette(false);
    expect(p.colorStops).toEqual(['#FDFCFB', '#F5F2EE', '#FAF0E8']);
    expect(p.blend).toBe(1.0);
    expect(p.amplitude).toBe(0.25);
    expect(p.speed).toBe(0.5);
  });
});
