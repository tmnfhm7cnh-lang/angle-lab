/**
 * Derives measurement values from the model on every call. Nothing here
 * is cached: a measurement stores point ids, and the number is only ever
 * as stale as the points it reads right now.
 */

import { distance, angleAtVertex, signedAngleAtVertex, lineOrientation } from './geometry.js';
import { millimetresPerPixel, pixelsToReal, isCalibrated } from './calibration.js';
import { getPoint } from './model.js';

function findMeasurement(project, measurementId) {
  return project.measurements.find((m) => m.id === measurementId) || null;
}

function realValueFor(project, imageId, pixels) {
  const calibration = project.calibration;
  if (!calibration || calibration.imageId !== imageId) {
    return { real: NaN, unit: calibration ? calibration.unit : undefined };
  }
  const refA = getPoint(project, calibration.aId);
  const refB = getPoint(project, calibration.bId);
  if (!refA || !refB) return { real: NaN, unit: calibration.unit };
  const refPixelLength = distance(refA, refB);
  const mmPerPixel = millimetresPerPixel(calibration.realLength, calibration.unit, refPixelLength);
  if (!isCalibrated(mmPerPixel)) return { real: NaN, unit: calibration.unit };
  return { real: pixelsToReal(pixels, mmPerPixel, calibration.unit), unit: calibration.unit };
}

export function evaluateAngle(project, measurementId) {
  const measurement = findMeasurement(project, measurementId);
  if (!measurement || measurement.type !== 'angle') return null;
  const a = getPoint(project, measurement.aId);
  const vertex = getPoint(project, measurement.vertexId);
  const c = getPoint(project, measurement.cId);
  if (!a || !vertex || !c) return null;
  return {
    degrees: angleAtVertex(a, vertex, c),
    signedDegrees: signedAngleAtVertex(a, vertex, c),
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
  return { pixels, real, unit, a, b };
}

export function evaluateSegment(project, segmentId) {
  const segment = project.segments.find((s) => s.id === segmentId);
  if (!segment) return null;
  const a = getPoint(project, segment.aId);
  const b = getPoint(project, segment.bId);
  if (!a || !b) return null;
  const pixels = distance(a, b);
  const { real, unit } = realValueFor(project, a.imageId, pixels);
  return { pixels, real, unit, orientation: lineOrientation(a, b), a, b };
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
