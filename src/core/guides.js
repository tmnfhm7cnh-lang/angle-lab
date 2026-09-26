/**
 * LOTE 5 §2 of the prompt maestro: "protocolos de medición... plantillas con landmarks
 * nombrados que piden los puntos en orden. Es lo que impide medir una cosa distinta cada
 * sesión, y es el diferencial frente a cualquier app de ángulos."
 *
 * A MeasurementGuide is plain data (see src/export/guides.js for the real ones): an ordered
 * list of named landmarks and a list of plans — which angle or distance to build, and which
 * dryland-test-logger test/metric to tag it with, once every landmark it needs has a point.
 * This module is the generic engine, with no knowledge of any specific guide's content — the
 * same separation LOTE 5 §1 used for the battery (data in one file, a thin engine reading it).
 *
 * Nothing here is a new measurement kind: a plan's `kind` is 'angle' or 'distance', the exact
 * two model.js already supports end-to-end (cascade delete, tagging, CSV export). A plan that
 * would need a different kind of measurement (e.g. a segment's orientation against a real-world
 * vertical reference) is simply left out of a guide's `plans` until that kind exists — see
 * ESTADO.md's "desviación del brazo" note.
 */

import { addAngle, addDistance, setMeasurementTag } from './model.js';

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
// A plan silently produces no measurement if a landmark id it names was never placed, or if
// addAngle/addDistance itself refuses (e.g. the points do not share an image) — same
// "degenerate input is reported, not thrown" convention as the rest of core (model.js,
// geometry.js). Nothing here is cached or cascades on its own: the created measurements are
// ordinary project.measurements entries from here on, owned by the same cascade-delete rule as
// any other angle/distance.
export function applyGuide(project, guide, pointIdByLandmark) {
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
    if (plan.tag) setMeasurementTag(project, measurement.id, plan.tag);
    created.push(measurement);
  }
  return { created, skipped };
}
