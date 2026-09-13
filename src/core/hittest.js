/**
 * Finds what a tap landed on, in image space. Priority is points, then
 * annotations, then line-like entities (segments, angles, distances) —
 * points are small and easy to miss, so they win over a line that happens to
 * pass near the same spot. Among the line-like entities the nearest wins,
 * regardless of which of the three it is: an angle's two rays and a
 * distance's segment are hit-tested the same way a plain segment is (F5).
 */

import { distance, distanceToSegment } from './geometry.js';
import { getPoint } from './model.js';

function nearest(candidates) {
  if (candidates.length === 0) return null;
  return candidates.reduce((best, c) => (c.distance < best.distance ? c : best));
}

export function hitTest(project, imagePoint, toleranceImage, imageId) {
  const points = project.points
    .filter((p) => p.imageId === imageId)
    .map((p) => ({ type: 'point', id: p.id, distance: distance(imagePoint, p) }))
    .filter((c) => c.distance <= toleranceImage);
  const pointHit = nearest(points);
  if (pointHit) return pointHit;

  const annotations = project.annotations
    .filter((a) => a.imageId === imageId)
    .map((a) => ({ type: 'annotation', id: a.id, distance: distance(imagePoint, a) }))
    .filter((c) => c.distance <= toleranceImage);
  const annotationHit = nearest(annotations);
  if (annotationHit) return annotationHit;

  const segments = project.segments
    .map((s) => {
      const a = getPoint(project, s.aId);
      const b = getPoint(project, s.bId);
      if (!a || !b || a.imageId !== imageId || b.imageId !== imageId) return null;
      return { type: 'segment', id: s.id, distance: distanceToSegment(imagePoint, a, b) };
    })
    .filter((c) => c && c.distance <= toleranceImage);

  const measurementHits = project.measurements
    .map((m) => {
      if (m.type === 'distance') {
        const a = getPoint(project, m.aId);
        const b = getPoint(project, m.bId);
        if (!a || !b || a.imageId !== imageId || b.imageId !== imageId) return null;
        return { type: 'distance', id: m.id, distance: distanceToSegment(imagePoint, a, b) };
      }
      if (m.type === 'angle') {
        const vertex = getPoint(project, m.vertexId);
        const a = getPoint(project, m.aId);
        const c = getPoint(project, m.cId);
        if (!vertex || !a || !c) return null;
        if (vertex.imageId !== imageId || a.imageId !== imageId || c.imageId !== imageId) return null;
        const d = Math.min(distanceToSegment(imagePoint, vertex, a), distanceToSegment(imagePoint, vertex, c));
        return { type: 'angle', id: m.id, distance: d };
      }
      return null;
    })
    .filter((c) => c && c.distance <= toleranceImage);

  return nearest([...segments, ...measurementHits]);
}
