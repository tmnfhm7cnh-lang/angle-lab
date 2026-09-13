/**
 * Pure 2D geometry. No DOM, no rendering, no app state.
 *
 * Coordinate convention: image space. Origin at the top-left pixel of the
 * source image, X grows right, Y grows DOWN (the canvas/image convention).
 *
 * Angles are reported in the convention a person sees when looking at the
 * photo: counter-clockwise is positive, "upwards in the picture" is positive.
 * That requires flipping Y in every signed computation below, because Y grows
 * down in the stored coordinates.
 *
 * Degenerate inputs (coincident points) return NaN rather than throwing: a
 * point can be dragged on top of another mid-gesture, and a thrown error there
 * would tear down the render loop. NaN propagates and the UI shows no value.
 */

export const RAD_TO_DEG = 180 / Math.PI;
export const DEG_TO_RAD = Math.PI / 180;

export function point(x, y) {
  return { x, y };
}

export function subtract(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function dot(u, v) {
  return u.x * v.x + u.y * v.y;
}

/** Z component of the 3D cross product of two 2D vectors. */
export function cross(u, v) {
  return u.x * v.y - u.y * v.x;
}

export function magnitude(v) {
  return Math.hypot(v.x, v.y);
}

/**
 * Euclidean distance. Math.hypot is used instead of sqrt(dx*dx + dy*dy)
 * because it avoids intermediate overflow/underflow on extreme coordinates.
 */
export function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Interior angle at vertex B, formed by rays B->A and B->C. Range [0, 180].
 *
 * Uses atan2(|cross|, dot) rather than acos(dot / (|u| |v|)). The acos form
 * loses most of its significant digits near 0 deg and 180 deg, where its
 * argument saturates at +-1; atan2 stays accurate across the whole range.
 * This matters here because near-straight limb segments are exactly the
 * measurement this app exists to take.
 */
export function angleAtVertex(a, b, c) {
  const u = subtract(a, b);
  const v = subtract(c, b);
  if ((u.x === 0 && u.y === 0) || (v.x === 0 && v.y === 0)) return NaN;
  return Math.atan2(Math.abs(cross(u, v)), dot(u, v)) * RAD_TO_DEG;
}

/**
 * Angle at vertex B carrying rotational direction, range (-180, 180].
 * Positive means B->C is counter-clockwise from B->A as seen in the photo.
 * Only the sign differs from angleAtVertex; the magnitude is identical.
 */
export function signedAngleAtVertex(a, b, c) {
  const u = subtract(a, b);
  const v = subtract(c, b);
  if ((u.x === 0 && u.y === 0) || (v.x === 0 && v.y === 0)) return NaN;
  // `0 - x` rather than `-x`: negating a zero cross product yields IEEE -0,
  // and atan2(-0, negative) returns -180 instead of the documented +180.
  return Math.atan2(0 - cross(u, v), dot(u, v)) * RAD_TO_DEG;
}

/**
 * Direction of segment A->B relative to the horizontal, range (-180, 180].
 * 0 points right, 90 points straight up in the photo, -90 straight down.
 */
export function lineOrientation(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return NaN;
  // `0 - dy` rather than `-dy`: see signedAngleAtVertex on IEEE negative zero.
  return Math.atan2(0 - dy, dx) * RAD_TO_DEG;
}

/**
 * Smallest angle between two segments treated as undirected lines, [0, 90].
 * Useful for symmetry checks, where A->B and B->A must read the same.
 */
export function angleBetweenLines(a1, a2, b1, b2) {
  const o1 = lineOrientation(a1, a2);
  const o2 = lineOrientation(b1, b2);
  if (Number.isNaN(o1) || Number.isNaN(o2)) return NaN;
  const diff = Math.abs(normalizeDegrees(o1 - o2));
  return diff > 90 ? 180 - diff : diff;
}

/** Wrap an angle into (-180, 180]. */
export function normalizeDegrees(deg) {
  if (!Number.isFinite(deg)) return NaN;
  const wrapped = ((((deg + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 ? 180 : wrapped;
}

/**
 * Perpendicular distance from point p to the infinite line through a and b.
 * Returns NaN if a and b coincide, since no line is defined.
 */
export function distanceToLine(p, a, b) {
  const ab = subtract(b, a);
  const len = magnitude(ab);
  if (len === 0) return NaN;
  return Math.abs(cross(ab, subtract(p, a))) / len;
}

/**
 * Distance from p to the finite segment a-b, clamping to the endpoints.
 * This is the hit-test primitive for selecting a drawn segment by touch.
 */
export function distanceToSegment(p, a, b) {
  const ab = subtract(b, a);
  const lenSq = dot(ab, ab);
  if (lenSq === 0) return distance(p, a);
  let t = dot(subtract(p, a), ab) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return distance(p, { x: a.x + ab.x * t, y: a.y + ab.y * t });
}
