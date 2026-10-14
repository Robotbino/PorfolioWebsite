import { starMapPalette } from './star-map-palette';

/**
 * The figure's colours are pinned to the SVG constellation's custom properties
 * (constellation.component.css) so the WebGL map and its fallback read as the
 * same chart; the hex values below are copied from that stylesheet.
 */
describe('starMapPalette', () => {
  const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

  it("matches the SVG constellation's colours in dark mode", () => {
    const p = starMapPalette(true);
    expect(p.core).toEqual(hex('#eef1f6'));
    expect(p.line).toEqual([220, 228, 240]);
    expect(p.lineAlpha).toBe(0.16);
    expect(p.halo).toEqual([150, 190, 255]);
  });

  it("matches the SVG constellation's colours in light mode", () => {
    const p = starMapPalette(false);
    expect(p.core).toEqual(hex('#262b36'));
    expect(p.line).toEqual([38, 43, 54]);
    expect(p.lineAlpha).toBe(0.38);
    expect(p.halo).toEqual([70, 80, 120]);
  });

  it('keeps the halo a glow behind the core, fainter on paper than at night', () => {
    const dark = starMapPalette(true);
    const light = starMapPalette(false);
    expect(dark.haloAlpha).toBeGreaterThan(light.haloAlpha);
    expect(dark.haloAlpha).toBeLessThan(0.5);
  });

  it('keeps the light-mode field a faint, sparse ink with no spectral tint', () => {
    const light = starMapPalette(false);
    const dark = starMapPalette(true);
    expect(light.field).toEqual(hex('#3a3530'));
    expect(light.fieldAlpha[1]).toBeLessThanOrEqual(0.25);
    expect(light.fieldCountFactor).toBeLessThan(dark.fieldCountFactor);
    expect(light.tint).toBe(0);
  });

  it('gives the dark-mode field its full count and a tinted halo', () => {
    const p = starMapPalette(true);
    expect(p.field).toEqual(hex('#dfe6f2'));
    expect(p.fieldAlpha[1]).toBeGreaterThan(starMapPalette(false).fieldAlpha[1]);
    expect(p.fieldCountFactor).toBe(1);
    expect(p.tint).toBe(0.35);
  });
});
