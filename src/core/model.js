/**
 * AnalysisProject: plain, JSON-serializable data. No computed values are
 * stored here — measurements hold point ids only; see measurements.js for
 * how a value is derived on read.
 */

import { isValidUnit } from './units.js';
import { distance } from './geometry.js';

export const SCHEMA_VERSION = 1;

export const DEFAULT_DISPLAY_UNIT = 'cm';

// A calibration reference shorter than this (in image pixels) is rejected:
// LOTE 2 audit, "una referencia de 2 px arrastra un 33% de error por pixel
// de ruido" — 1/2 = 50%, close enough to that 33% (their number likely used
// a slightly different pixel-noise estimate) to make the point that a 2 px
// reference is unusable. 10 px is this session's own floor, not a verified
// external threshold: at 10 px, one pixel of noise is a 10% error, which is
// still coarse but no longer absurd. Flagged so it reads as engineering
// judgement, not a measured constant.
export const MIN_CALIBRATION_REFERENCE_PX = 10;

let fallbackCounter = 0;

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  fallbackCounter += 1;
  return `id-${fallbackCounter}`;
}

function touch(project) {
  project.updatedAt = new Date().toISOString();
}

export function createProject({ subjectCode = '', title = '' } = {}) {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    schemaVersion: SCHEMA_VERSION,
    subjectCode,
    title,
    notes: '',
    images: [],
    activeImageId: null,
    points: [],
    segments: [],
    measurements: [],
    annotations: [],
    // Keyed by imageId, not a single project-wide value: a second photo used
    // to inherit the first photo's calibration silently (LOTE 2 audit).
    // Every image in a project needs its own reference length in view.
    calibrations: {},
    // The unit every real length is READ in, independent of the unit the
    // calibration reference was ENTERED in — see measurements.js.
    displayUnit: DEFAULT_DISPLAY_UNIT,
  };
}

export function setDisplayUnit(project, unit) {
  if (!isValidUnit(unit)) return false;
  project.displayUnit = unit;
  touch(project);
  return true;
}

export function addImage(project, { blobKey, width, height, exifOrientation = 0, capturedAt = null } = {}) {
  const image = { id: generateId(), blobKey, width, height, exifOrientation, capturedAt };
  project.images.push(image);
  if (project.activeImageId === null) project.activeImageId = image.id;
  touch(project);
  return image;
}

// LOTE 2 audit: a NaN coordinate used to be accepted, serialize() turned it
// into `null` (JSON.stringify(NaN) === 'null'), and reading it back left the
// point silently sitting at 0 — a distance that never existed, reported with
// full confidence. Rejecting non-finite input at the model boundary is
// cheaper than ever discovering it downstream.
function isFiniteCoordinate(x, y) {
  return Number.isFinite(x) && Number.isFinite(y);
}

export function addPoint(project, { imageId, x, y, label = '', source = 'manual', landmark = null, placementScale = null } = {}) {
  if (!isFiniteCoordinate(x, y)) return null;
  // placementScale is the viewport zoom (image->view scale) in effect when
  // the point was placed — the one input uncertainty.js needs to turn a
  // fixed finger-width error into an image-pixel error (see its module doc).
  // null means "unknown" (an older point, or one created off-screen) and is
  // treated there as the conservative scale-1 fallback, never as 0.
  const point = { id: generateId(), imageId, x, y, label, source, landmark, placementScale };
  project.points.push(point);
  touch(project);
  return point;
}

export function movePoint(project, pointId, x, y, placementScale = undefined) {
  const point = getPoint(project, pointId);
  if (!point) return null;
  if (!isFiniteCoordinate(x, y)) return null;
  point.x = x;
  point.y = y;
  // undefined (the default) leaves the point's existing placementScale
  // alone — most callers (e.g. removeEntity's cascade) never move a point.
  // A drag passes the current viewport scale explicitly so the recorded
  // placement reflects where the point actually ended up, not where it
  // started.
  if (placementScale !== undefined) point.placementScale = placementScale;
  touch(project);
  return point;
}

export function removePoint(project, pointId) {
  const removed = getPoint(project, pointId);
  if (!removed) return false;
  project.points = project.points.filter((p) => p.id !== pointId);

  project.segments = project.segments.filter((s) => s.aId !== pointId && s.bId !== pointId);
  project.measurements = project.measurements.filter((m) => {
    if (m.type === 'angle') return m.aId !== pointId && m.vertexId !== pointId && m.cId !== pointId;
    return m.aId !== pointId && m.bId !== pointId;
  });
  // Calibration is per-image (see setCalibration) — only that image's own
  // reference can possibly point at this point, so there is at most one
  // entry to check, not the whole map.
  const calibration = project.calibrations[removed.imageId];
  if (calibration && (calibration.aId === pointId || calibration.bId === pointId)) {
    delete project.calibrations[removed.imageId];
  }
  touch(project);
  return true;
}

// LOTE 2 audit: nothing stopped a measurement from being built out of points
// from two different photos, and it reported a number with full confidence
// — there is no such thing as an angle or a distance between two pictures.
function sameImage(project, ids) {
  const points = ids.map((id) => getPoint(project, id));
  if (points.some((p) => !p)) return false;
  return points.every((p) => p.imageId === points[0].imageId);
}

export function addSegment(project, aId, bId) {
  if (!sameImage(project, [aId, bId])) return null;
  const segment = { id: generateId(), aId, bId };
  project.segments.push(segment);
  touch(project);
  return segment;
}

export function addAngle(project, aId, vertexId, cId) {
  if (!sameImage(project, [aId, vertexId, cId])) return null;
  const measurement = { id: generateId(), type: 'angle', aId, vertexId, cId };
  project.measurements.push(measurement);
  touch(project);
  return measurement;
}

export function addDistance(project, aId, bId) {
  if (!sameImage(project, [aId, bId])) return null;
  const measurement = { id: generateId(), type: 'distance', aId, bId };
  project.measurements.push(measurement);
  touch(project);
  return measurement;
}

// LOTE 2 audit: setCalibration accepted two coincident points and a
// negative "-3 furlong" reference without complaint, and produced a scale
// from them anyway. All three checks below are pure input validation —
// they reject garbage, they never invent a sport-specific threshold.
export function setCalibration(project, { imageId, aId, bId, realLength, unit } = {}) {
  if (!Number.isFinite(realLength) || realLength <= 0) return null;
  if (!isValidUnit(unit)) return null;
  if (!sameImage(project, [aId, bId])) return null;
  const a = getPoint(project, aId);
  if (a.imageId !== imageId) return null;
  if (distance(a, getPoint(project, bId)) < MIN_CALIBRATION_REFERENCE_PX) return null;
  const calibration = { id: generateId(), imageId, aId, bId, realLength, unit };
  project.calibrations[imageId] = calibration;
  touch(project);
  return calibration;
}

export function getCalibration(project, imageId) {
  return project.calibrations[imageId] || null;
}

export function clearCalibration(project, imageId) {
  delete project.calibrations[imageId];
  touch(project);
}

export function addAnnotation(project, { imageId, x, y, text = '' } = {}) {
  const annotation = { id: generateId(), imageId, x, y, text };
  project.annotations.push(annotation);
  touch(project);
  return annotation;
}

export function updateAnnotation(project, id, text) {
  const annotation = project.annotations.find((a) => a.id === id);
  if (!annotation) return null;
  annotation.text = text;
  touch(project);
  return annotation;
}

function findCalibrationImage(project, id) {
  return Object.keys(project.calibrations).find((imageId) => project.calibrations[imageId].id === id) || null;
}

function locateEntity(project, id) {
  if (project.points.some((p) => p.id === id)) return 'point';
  if (project.segments.some((s) => s.id === id)) return 'segment';
  if (project.measurements.some((m) => m.id === id)) return 'measurement';
  if (project.annotations.some((a) => a.id === id)) return 'annotation';
  if (findCalibrationImage(project, id)) return 'calibration';
  return null;
}

export function removeEntity(project, id) {
  const kind = locateEntity(project, id);
  switch (kind) {
    case 'point':
      return removePoint(project, id);
    case 'segment':
      project.segments = project.segments.filter((s) => s.id !== id);
      touch(project);
      return true;
    case 'measurement':
      project.measurements = project.measurements.filter((m) => m.id !== id);
      touch(project);
      return true;
    case 'annotation':
      project.annotations = project.annotations.filter((a) => a.id !== id);
      touch(project);
      return true;
    case 'calibration':
      delete project.calibrations[findCalibrationImage(project, id)];
      touch(project);
      return true;
    default:
      return false;
  }
}

export function getPoint(project, id) {
  return project.points.find((p) => p.id === id) || null;
}

export function serialize(project) {
  return JSON.parse(JSON.stringify(project));
}

export function deserialize(data) {
  if (data.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`Unknown schema version: ${data.schemaVersion}`);
  }
  const project = JSON.parse(JSON.stringify(data));
  // displayUnit was added after the schema was first written. Nothing is
  // persisted yet, so there is no stored project to migrate; defaulting a
  // missing or invalid value here keeps the version at 1 instead of forcing
  // a breaking bump for a field that has a safe default.
  if (!isValidUnit(project.displayUnit)) project.displayUnit = DEFAULT_DISPLAY_UNIT;
  // calibration (singular, project-wide) became calibrations (per imageId)
  // in the same LOTE 2 change — again nothing is persisted yet, so this is
  // a defensive default plus a courtesy migration for any hand-built fixture
  // still using the old shape, not a real-world upgrade path.
  if (!project.calibrations || typeof project.calibrations !== 'object') {
    project.calibrations = {};
    if (project.calibration && project.calibration.imageId) {
      project.calibrations[project.calibration.imageId] = project.calibration;
    }
  }
  delete project.calibration;
  return project;
}
