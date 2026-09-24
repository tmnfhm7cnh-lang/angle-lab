/**
 * Length units and conversion. Millimetres are the internal reference unit
 * because it lets calibration and the metric units convert by plain
 * multiplication, with inches as the one non-metric case.
 */

export const UNITS = { mm: 1, cm: 10, m: 1000, in: 25.4 };

export function isValidUnit(unit) {
  return Object.prototype.hasOwnProperty.call(UNITS, unit);
}

export function toMillimetres(value, unit) {
  if (!isValidUnit(unit)) return NaN;
  return value * UNITS[unit];
}

export function fromMillimetres(mm, unit) {
  if (!isValidUnit(unit)) return NaN;
  return mm / UNITS[unit];
}

export function convert(value, fromUnit, toUnit) {
  return fromMillimetres(toMillimetres(value, fromUnit), toUnit);
}

export function formatLength(value, unit, decimals = 1) {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(decimals)} ${unit}`;
}

export function formatAngle(degrees, decimals = 1) {
  if (!Number.isFinite(degrees)) return '—';
  return `${degrees.toFixed(decimals)}°`;
}
