/**
 * Derives measurement values from the model on every call. Nothing here
 * is cached: a measurement stores point ids, and the number is only ever
 * as stale as the points it reads right now.
 */

import { distance, angleAtVertex, signedAngleAtVertex, lineOrientation } from './geometry.js';
import { millimetresPerPixel, pixelsToReal, isCalibrated } from './calibration.js';
import { isValidUnit, fromMillimetres } from './units.js';
import { getPoint, getCalibration } from './model.js';
import { angleUncertaintyDegrees, distanceUncertaintyPixels, qualityForSigma } from './uncertainty.js';

// The unit a real length is READ in. It is the project's display unit, not
// the unit the calibration reference was ENTERED in: a 1 m reference must
// still be able to read a forearm in centimetres.
function displayUnitFor(project, calibration) {
  if (isValidUnit(project.displayUnit)) return project.displayUnit;
  return calibration ? calibration.unit : undefined;
}

function findMeasurement(project, measurementId) {
  return project.measurements.find((m) => m.id === measurementId) || null;
}

// mmPerPixel for imageId's own calibration, or NaN if that image has none —
// calibration is per-image (LOTE 2 audit: a second photo used to silently
// keep reading the first photo's reference).
function mmPerPixelFor(project, imageId) {
  const calibration = getCalibration(project, imageId);
  if (!calibration) return NaN;
  const refA = getPoint(project, calibration.aId);
  const refB = getPoint(project, calibration.bId);
  if (!refA || !refB) return NaN;
  return millimetresPerPixel(calibration.realLength, calibration.unit, distance(refA, refB));
}

function realValueFor(project, imageId, pixels) {
  const calibration = getCalibration(project, imageId);
  const unit = displayUnitFor(project, calibration);
  const mmPerPixel = mmPerPixelFor(project, imageId);
  if (!isCalibrated(mmPerPixel)) return { real: NaN, unit };
  return { real: pixelsToReal(pixels, mmPerPixel, unit), unit };
}

// sigma for a length, in whichever unit it will be displayed in — pixels if
// uncalibrated, the display unit if calibrated — so decimalsForSigma and
// qualityForSigma can be handed the same number the reading itself uses.
function lengthSigma(sigmaPixels, mmPerPixel, unit) {
  if (!isCalibrated(mmPerPixel)) return sigmaPixels;
  return fromMillimetres(sigmaPixels * mmPerPixel, unit);
}

export function evaluateAngle(project, measurementId) {
  const measurement = findMeasurement(project, measurementId);
  if (!measurement || measurement.type !== 'angle') return null;
  const a = getPoint(project, measurement.aId);
  const vertex = getPoint(project, measurement.vertexId);
  const c = getPoint(project, measurement.cId);
  if (!a || !vertex || !c) return null;
  const sigmaDegrees = angleUncertaintyDegrees(a, vertex, c);
  return {
    degrees: angleAtVertex(a, vertex, c),
    signedDegrees: signedAngleAtVertex(a, vertex, c),
    sigmaDegrees,
    quality: qualityForSigma(sigmaDegrees),
    vertex,
    a,
    c,
  };
}

export function evaluateDistance(project, measurementId) {
  const measurement = findMeasurement(project, measurementId);
  if (!measurement || measurement.type !== 'distance') return null;
  const a = getPoint(project, measurement.aId);
  const b = getPoint(project, measurement.bId);
  if (!a || !b) return null;
  const pixels = distance(a, b);
  const { real, unit } = realValueFor(project, a.imageId, pixels);
  const sigmaPixels = distanceUncertaintyPixels(a, b);
  const sigma = lengthSigma(sigmaPixels, mmPerPixelFor(project, a.imageId), unit);
  return { pixels, real, unit, sigma, quality: qualityForSigma(sigma), a, b };
}

export function evaluateSegment(project, segmentId) {
  const segment = project.segments.find((s) => s.id === segmentId);
  if (!segment) return null;
  const a = getPoint(project, segment.aId);
  const b = getPoint(project, segment.bId);
  if (!a || !b) return null;
  const pixels = distance(a, b);
  const { real, unit } = realValueFor(project, a.imageId, pixels);
  const sigmaPixels = distanceUncertaintyPixels(a, b);
  const sigma = lengthSigma(sigmaPixels, mmPerPixelFor(project, a.imageId), unit);
  return { pixels, real, unit, sigma, quality: qualityForSigma(sigma), orientation: lineOrientation(a, b), a, b };
}

export function evaluateAll(project) {
  const results = new Map();
  for (const measurement of project.measurements) {
    const value =
      measurement.type === 'angle'
        ? evaluateAngle(project, measurement.id)
        : evaluateDistance(project, measurement.id);
    results.set(measurement.id, value);
  }
  for (const segment of project.segments) {
    results.set(segment.id, evaluateSegment(project, segment.id));
  }
  return results;
}
