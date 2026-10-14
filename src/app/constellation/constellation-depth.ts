import { SpectralClass } from './constellation.model';

/**
 * Real star facts turned into the two numbers the WebGL star map renders with:
 * a depth for each star and a temperature for its tint. Pure, so the scale is
 * unit-tested rather than judged by eye.
 */

/** Figure units of depth per unit of ln(light-years). */
export const DEPTH_PER_LN_LY = 90;

/**
 * The furthest a star may sit from its figure's plane, in figure units. Deneb
 * (about 2,600 ly) would otherwise sit 250 units behind Cygnus and slide a
 * sixth of the figure's width out of place during each camera swing; clamped,
 * the deepest star moves about a tenth.
 */
export const MAX_DEPTH = 140;

/**
 * Depth per star, in figure units, positive toward the viewer.
 *
 * Logarithmic, because a figure's distances span up to two orders of magnitude
 * (Gienah at 72 ly, Deneb near 2,600) and a linear scale would flatten
 * everything but the supergiants. One scale for every figure, so the Big
 * Dipper, a real moving group, stays shallow while Cygnus is deep. Centred on
 * each figure's median so the figure's mass sits on the plane the camera
 * swings around, keeping the morphing figure in place.
 */
export function depthUnits(lightYears: readonly number[]): number[] {
  const logs = lightYears.map((ly) => Math.log(ly));
  const centre = median(logs);
  return logs.map((l) => clamp(DEPTH_PER_LN_LY * (centre - l), -MAX_DEPTH, MAX_DEPTH));
}

/** A representative surface temperature, in kelvin, for each spectral class. */
export const SPECTRAL_TEMPERATURE: Readonly<Record<SpectralClass, number>> = {
  O: 30000,
  B: 15000,
  A: 9000,
  F: 7000,
  G: 5600,
  K: 4500,
  M: 3400,
};

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
