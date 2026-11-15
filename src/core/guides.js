/**
 * Measurement guides: named landmarks to tap in order, and which angle or distance each plan
 * builds once all the landmarks it needs have a point. It is what stops a different thing being
 * measured every session.
 *
 * A guide is plain data (see src/export/guides.js for the real ones): an ordered list of
 * landmarks and a list of plans. This module is the generic engine, with no knowledge of any
 * specific guide, sport or club.
 *
 * Nothing here is a new measurement kind: a plan's `kind` is 'angle' or 'distance', the two
 * model.js already supports end-to-end (cascade delete, naming, CSV export).
 */

import { addAngle, addDistance, setMeasurementLabel } from './model.js';

// The landmark a guide is waiting for next, or null once every landmark has a point.
// `placedIds` is the ordered list of landmark ids already placed (guide.landmarks is itself
// ordered, so "next" is just the landmark at that position — no separate cursor to keep in
// sync).
export function nextLandmark(guide, placedIds) {
  if (!guide || placedIds.length >= guide.landmarks.length) return null;
  return guide.landmarks[placedIds.length];
}

export function isGuideComplete(guide, placedIds) {
  return !!guide && placedIds.length >= guide.landmarks.length;
}

// Builds every plan's measurement once all its landmarks have a point — call only after
// isGuideComplete. `pointIdByLandmark` is a plain object { landmarkId: pointId }; a plan's own
// a/vertex/c (or a/b) already states which landmark plays which role, so the order the caller
// happened to place them in does not matter here.
//
// `labelFor(plan)` is optional: it returns the name to give that plan's measurement (the app
// passes the translated name of the angle). Omit it, or return an empty string, and the
// measurement comes out unnamed, like a freeform angle.
//
// A plan silently produces no measurement if a landmark id it names was never placed, or if
// addAngle/addDistance itself refuses (e.g. the points do not share an image) — the same
// "degenerate input is reported, not thrown" convention as the rest of core. The created
// measurements are ordinary project.measurements entries from here on, owned by the same
// cascade-delete rule as any other angle/distance.
export function applyGuide(project, guide, pointIdByLandmark, labelFor) {
  const created = [];
  const skipped = [];
  for (const plan of guide.plans) {
    const landmarkIds = plan.kind === 'angle' ? [plan.a, plan.vertex, plan.c] : [plan.a, plan.b];
    const pointIds = landmarkIds.map((landmarkId) => pointIdByLandmark[landmarkId]);
    if (pointIds.some((id) => !id)) {
      skipped.push(plan);
      continue;
    }
    const measurement =
      plan.kind === 'angle'
        ? addAngle(project, pointIds[0], pointIds[1], pointIds[2])
        : addDistance(project, pointIds[0], pointIds[1]);
    if (!measurement) {
      skipped.push(plan);
      continue;
    }
    const label = labelFor ? labelFor(plan) : '';
    if (label) setMeasurementLabel(project, measurement.id, label);
    created.push(measurement);
  }
  return { created, skipped };
}
