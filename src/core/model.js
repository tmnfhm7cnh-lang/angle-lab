/**
 * AnalysisProject: plain, JSON-serializable data. No computed values are
 * stored here — measurements hold point ids only; see measurements.js for
 * how a value is derived on read.
 */

export const SCHEMA_VERSION = 1;

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
    calibration: null,
  };
}

export function addImage(project, { blobKey, width, height, exifOrientation = 0, capturedAt = null } = {}) {
  const image = { id: generateId(), blobKey, width, height, exifOrientation, capturedAt };
  project.images.push(image);
  if (project.activeImageId === null) project.activeImageId = image.id;
  touch(project);
  return image;
}

export function addPoint(project, { imageId, x, y, label = '', source = 'manual', landmark = null } = {}) {
  const point = { id: generateId(), imageId, x, y, label, source, landmark };
  project.points.push(point);
  touch(project);
  return point;
}

export function movePoint(project, pointId, x, y) {
  const point = getPoint(project, pointId);
  if (!point) return null;
  point.x = x;
  point.y = y;
  touch(project);
  return point;
}

export function removePoint(project, pointId) {
  const before = project.points.length;
  project.points = project.points.filter((p) => p.id !== pointId);
  if (project.points.length === before) return false;

  project.segments = project.segments.filter((s) => s.aId !== pointId && s.bId !== pointId);
  project.measurements = project.measurements.filter((m) => {
    if (m.type === 'angle') return m.aId !== pointId && m.vertexId !== pointId && m.cId !== pointId;
    return m.aId !== pointId && m.bId !== pointId;
  });
  if (project.calibration && (project.calibration.aId === pointId || project.calibration.bId === pointId)) {
    project.calibration = null;
  }
  touch(project);
  return true;
}

export function addSegment(project, aId, bId) {
  const segment = { id: generateId(), aId, bId };
  project.segments.push(segment);
  touch(project);
  return segment;
}

export function addAngle(project, aId, vertexId, cId) {
  const measurement = { id: generateId(), type: 'angle', aId, vertexId, cId };
  project.measurements.push(measurement);
  touch(project);
  return measurement;
}

export function addDistance(project, aId, bId) {
  const measurement = { id: generateId(), type: 'distance', aId, bId };
  project.measurements.push(measurement);
  touch(project);
  return measurement;
}

export function setCalibration(project, { imageId, aId, bId, realLength, unit } = {}) {
  project.calibration = { id: generateId(), imageId, aId, bId, realLength, unit };
  touch(project);
  return project.calibration;
}

export function clearCalibration(project) {
  project.calibration = null;
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

function locateEntity(project, id) {
  if (project.points.some((p) => p.id === id)) return 'point';
  if (project.segments.some((s) => s.id === id)) return 'segment';
  if (project.measurements.some((m) => m.id === id)) return 'measurement';
  if (project.annotations.some((a) => a.id === id)) return 'annotation';
  if (project.calibration && project.calibration.id === id) return 'calibration';
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
      project.calibration = null;
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
  return JSON.parse(JSON.stringify(data));
}
