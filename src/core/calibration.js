/**
 * Pixel-to-real-world scale. Callers keep the source real length and pixel
 * length rather than only the derived ratio, so the scale can be
 * recomputed if the reference points are moved; this module only does the
 * arithmetic on those two numbers.
 */

import { toMillimetres, fromMillimetres, isValidUnit } from './units.js';

export function millimetresPerPixel(realLength, unit, pixelLength) {
  if (pixelLength <= 0 || realLength <= 0 || !isValidUnit(unit)) return NaN;
  return toMillimetres(realLength, unit) / pixelLength;
}

export function pixelsToReal(pixels, mmPerPixel, targetUnit) {
  if (!isCalibrated(mmPerPixel)) return NaN;
  return fromMillimetres(pixels * mmPerPixel, targetUnit);
}

export function realToPixels(value, unit, mmPerPixel) {
  if (!isCalibrated(mmPerPixel)) return NaN;
  return toMillimetres(value, unit) / mmPerPixel;
}

export function isCalibrated(mmPerPixel) {
  return Number.isFinite(mmPerPixel) && mmPerPixel > 0;
}
