/**
 * LOTE 5 §2 of the prompt maestro: "protocolos de medición... plantillas con landmarks
 * nombrados que piden los puntos en orden. Es lo que impide medir una cosa distinta cada
 * sesión, y es el diferencial frente a cualquier app de ángulos."
 *
 * A MeasurementGuide is plain data (see src/export/guides.js for the real ones): an ordered
 * list of named landmarks and a list of plans — which angle or distance to build, once every
 * landmark it needs has a point. This module is the generic engine, with no knowledge of any
 * specific guide's content, and — since 2026-09-27 — no knowledge of any specific *battery*
 * either: a plan names a body-generic `key` (e.g. 'flexion_rodilla'), not a battery's test/metric
 * pair. Whether and how that key becomes an exported tag is a separate concern, resolved by the
 * optional `resolveTag` argument below — see src/export/batteryTags.js for AQUAMAD's mapping.
 * Daniel asked for this split on 2026-09-27: he wants `angle-lab` sellable on its own, and a
 * guide that auto-tags straight into AQUAMAD's private CSV vocabulary would have to be rebuilt
 * for every other battery (or none). Same separation LOTE 5 §1 already used for the battery
 * itself (data in one file, a thin engine reading it) — this just extends it one layer further.
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
// `resolveTag(guideId, planKey)` is optional and battery-specific — this module never imports
// one itself. Omit it (or return a falsy value) and the measurement comes out untagged, exactly
// like a freeform angle drawn without any guide: a caller with no battery loaded, or a commercial
// build with a different one, gets the same generic angle either way. Pass
// resolveAquamadTag from src/export/batteryTags.js to get today's Daniel-facing behaviour back.
//
// A plan silently produces no measurement if a landmark id it names was never placed, or if
// addAngle/addDistance itself refuses (e.g. the points do not share an image) — same
// "degenerate input is reported, not thrown" convention as the rest of core (model.js,
// geometry.js). Nothing here is cached or cascades on its own: the created measurements are
// ordinary project.measurements entries from here on, owned by the same cascade-delete rule as
// any other angle/distance.
export function applyGuide(project, guide, pointIdByLandmark, resolveTag) {
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
    const tag = resolveTag && plan.key ? resolveTag(guide.id, plan.key) : null;
    if (tag) setMeasurementTag(project, measurement.id, tag);
    created.push(measurement);
  }
  return { created, skipped };
}
