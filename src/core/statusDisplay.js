/**
 * Pure decisions behind the on-canvas status layers (no DOM, no translations):
 * which scale chip to show, what the project chip says, and what the floating
 * readout of the selected measurement contains. The UI turns the returned
 * keys into text with t().
 */
import { decimalsForSigma } from './uncertainty.js';
import { formatAngle, formatLength } from './units.js';

const QUALITY_KEY = { good: 'qualityGood', ok: 'qualityOk', poor: 'qualityPoor' };

// Scale chip: the scale when calibrated; an amber "uncalibrated" only when something on the
// photo actually needs a scale (a distance); nothing otherwise.
export function scaleChipState({ calibrated, mmPerPixel, hasDistance }) {
  if (calibrated) return { kind: 'calibrated', mmPerPixel };
  if (hasDistance) return { kind: 'uncalibrated' };
  return { kind: 'hidden' };
}

// Project chip: subject code plus "photo n of m". photoNumber is 0 when no photo is active.
export function projectChipInfo(project) {
  const images = project.images || [];
  const index = images.findIndex((img) => img.id === project.activeImageId);
  return {
    subjectCode: project.subjectCode || '',
    photoNumber: index + 1,
    photoCount: images.length,
  };
}

// Floating readout for one reading from readingsForImage (angle or distance). Null if none.
export function describeReadout(reading) {
  if (!reading) return null;
  const level = reading.quality?.level;
  const qualityKey = QUALITY_KEY[level] || QUALITY_KEY.poor;

  if (reading.type === 'angle') {
    const decimals = decimalsForSigma(reading.sigmaDegrees);
    return {
      labelKey: 'wordAngle',
      value: formatAngle(reading.degrees, decimals),
      sigmaText: Number.isFinite(reading.sigmaDegrees) ? `±${reading.sigmaDegrees.toFixed(decimals)}°` : '',
      qualityKey,
      level: level || 'poor',
    };
  }

  const calibrated = Number.isFinite(reading.real);
  const decimals = decimalsForSigma(reading.sigma);
  const unit = calibrated ? reading.unit : 'px';
  return {
    labelKey: 'wordDistance',
    value: calibrated ? formatLength(reading.real, reading.unit, decimals) : `${reading.pixels.toFixed(1)} px`,
    sigmaText: Number.isFinite(reading.sigma) ? `±${reading.sigma.toFixed(decimals)} ${unit}` : '',
    qualityKey,
    level: level || 'poor',
  };
}
