import { Constellation, Star } from './constellation.model';
import { interpolateConstellation } from './constellation-morph';

function star(name: string, x: number, y: number, r = 2, amp = 5): Star {
  return { name, x, y, r, phx: 0, phy: 0, amp };
}

function constellation(name: string, stars: Star[]): Constellation {
  return { name, side: 'left', viewBox: '0 0 100 100', stars, links: [{ a: 0, b: 1 }] };
}

describe('interpolateConstellation', () => {
  const from = constellation('A', [star('a0', 0, 0), star('a1', 10, 20)]);
  const to = constellation('B', [star('b0', 100, 50), star('b1', 30, 0)]);

  it('returns the start positions at t = 0', () => {
    const { stars } = interpolateConstellation(from, to, 0);
    expect(stars[0].x).toBe(0);
    expect(stars[0].y).toBe(0);
    expect(stars[1].x).toBe(10);
    expect(stars[1].y).toBe(20);
  });

  it('returns the end positions at t = 1', () => {
    const { stars } = interpolateConstellation(from, to, 1);
    expect(stars[0].x).toBe(100);
    expect(stars[0].y).toBe(50);
    expect(stars[1].x).toBe(30);
    expect(stars[1].y).toBe(0);
  });

  it('returns the exact midpoint at t = 0.5', () => {
    const { stars } = interpolateConstellation(from, to, 0.5);
    expect(stars[0].x).toBe(50);
    expect(stars[0].y).toBe(25);
    expect(stars[1].x).toBe(20);
    expect(stars[1].y).toBe(10);
  });

  it('derives link endpoints from the interpolated star positions', () => {
    const { segments } = interpolateConstellation(from, to, 0.5);
    expect(segments.length).toBe(1);
    expect(segments[0]).toEqual({ x1: 50, y1: 25, x2: 20, y2: 10 });
  });

  it('clamps progress outside [0, 1]', () => {
    expect(interpolateConstellation(from, to, -1).stars[0].x).toBe(0);
    expect(interpolateConstellation(from, to, 2).stars[0].x).toBe(100);
  });

  it('throws when the two constellations have different star counts', () => {
    const single = constellation('single', [star('s', 0, 0)]);
    expect(() => interpolateConstellation(from, single, 0.5)).toThrowError(/equal star counts/);
  });
});
