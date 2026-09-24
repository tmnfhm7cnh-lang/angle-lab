/**
 * How much a measurement is worth trusting, derived from geometry alone —
 * no ground truth, no external calibration rig. The one physical number
 * this module is built on (LOTE 2 audit, verified by executing the
 * geometry): moving a ray's endpoint by one image pixel changes the angle
 * at its vertex by very close to (180/pi) / rayLengthPx degrees — 0.14 deg
 * at 400 px, 0.57 deg at 100 px, 2.29 deg at 25 px. Everything below scales
 * that one relationship by how many image pixels a fingertip actually
 * misses by, which depends on how zoomed in the point was when it was
 * placed.
 *
 * PLACEMENT_ERROR_VIEW_PX and the quality/decimal thresholds are this
 * session's own engineering judgement, not a verified external source —
 * flagged here and in the app so nobody mistakes them for a measured
 * constant the way the sport-specific thresholds in the other app must
 * never be invented.
 */

import { RAD_TO_DEG, distance } from './geometry.js';

// A fingertip's touch imprecision, in *view* (CSS) pixels — the audit's own
// worked example ("+-3 px de dedo"). Converted to image pixels by the zoom
// level the point was placed at: the same finger error covers far more
// image the further zoomed out you were.
export const PLACEMENT_ERROR_VIEW_PX = 3;

export function pointPlacementErrorImagePx(point) {
  const scale = point && Number.isFinite(point.placementScale) && point.placementScale > 0
    ? point.placementScale
    : 1;
  return PLACEMENT_ERROR_VIEW_PX / scale;
}

/**
 * sigma in degrees for an angle at `vertex` between rays to `a` and `c`.
 * Driven by the *shorter* ray, because that is the one a fixed pixel error
 * swings furthest — an angle with one long arm and one short one is only
 * ever as good as the short one.
 */
export function angleUncertaintyDegrees(a, vertex, c) {
  const rayA = distance(vertex, a);
  const rayC = distance(vertex, c);
  const shortestRay = Math.min(rayA, rayC);
  if (!(shortestRay > 0)) return Infinity;
  const errorPx = Math.max(
    pointPlacementErrorImagePx(a),
    pointPlacementErrorImagePx(vertex),
    pointPlacementErrorImagePx(c),
  );
  return (RAD_TO_DEG * errorPx) / shortestRay;
}

/**
 * sigma in image pixels for the length of segment a-b. Combines the two
 * endpoints' independent placement errors in quadrature (each point can
 * miss in any direction; only the component along the segment matters, and
 * summing two independent errors that way is the standard propagation for
 * a difference of two uncertain quantities).
 */
export function distanceUncertaintyPixels(a, b) {
  const errorA = pointPlacementErrorImagePx(a);
  const errorB = pointPlacementErrorImagePx(b);
  return Math.sqrt(errorA * errorA + errorB * errorB);
}

/**
 * How many decimals are honest to print. Below `fine`, the reading is
 * precise enough for a second decimal; above `coarse`, even the first
 * decimal is noise and whole units are all that's defensible. Same two
 * thresholds serve degrees and any length unit — the caller passes sigma
 * already expressed in the unit being displayed.
 */
export function decimalsForSigma(sigma, { coarse = 0.5, fine = 0.05 } = {}) {
  if (!Number.isFinite(sigma)) return 1;
  if (sigma > coarse) return 0;
  if (sigma > fine) return 1;
  return 2;
}

/**
 * A traffic-light read of the same sigma, plus the one lever that actually
 * shrinks it: zoom in before placing the point, or pick a longer segment/ray
 * if the geometry itself is short.
 */
export function qualityForSigma(sigma, { good = 0.5, ok = 2 } = {}) {
  if (!Number.isFinite(sigma)) return { level: 'poor', action: 'degenerate — move a point apart' };
  if (sigma <= good) return { level: 'good', action: null };
  if (sigma <= ok) return { level: 'ok', action: 'zoom in for a tighter reading' };
  return { level: 'poor', action: 'zoom in, or pick a longer segment' };
}

/**
 * Dispersion of repeated placements of what should be the same landmark —
 * the "place it 3 times blind" lab. This is the one number in the whole
 * module that is measured rather than modelled: it is the operator's own
 * hand, not a formula.
 */
export function repeatabilityStats(points) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const n = points.length;
  const mean = {
    x: points.reduce((sum, p) => sum + p.x, 0) / n,
    y: points.reduce((sum, p) => sum + p.y, 0) / n,
  };
  const deviations = points.map((p) => distance(p, mean));
  const maxDeviationPx = Math.max(...deviations);
  const rmsPx = Math.sqrt(deviations.reduce((sum, d) => sum + d * d, 0) / n);
  return { mean, maxDeviationPx, rmsPx };
}
