/**
 * Image <-> view coordinate transform: a similarity transform (scale,
 * rotation, translation) applied to image space to produce view space.
 * view = R(rotation) * (image * scale) + (tx, ty)
 *
 * rotation stays 0 through the MVP, but is carried through every function
 * here so that adding image rotation later only means setting it, not
 * rewriting this module.
 */

import { DEG_TO_RAD } from './geometry.js';

// Shared with zoomAt's own defaults: fitImage must clamp to the same range,
// or a degenerate viewSize (a collapsed canvas mid-layout, a hidden pane)
// can hand out a scale zoomAt would never have produced on its own —
// negative for a viewSize smaller than the image, or exactly 0 at the point
// where availableWidth/availableHeight crosses zero.
export const MIN_SCALE = 0.05;
export const MAX_SCALE = 50;

export function createViewport({ scale = 1, tx = 0, ty = 0, rotation = 0 } = {}) {
  return { scale, tx, ty, rotation };
}

export function imageToView(p, vp) {
  const theta = vp.rotation * DEG_TO_RAD;
  const sx = p.x * vp.scale;
  const sy = p.y * vp.scale;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  return {
    x: sx * cos - sy * sin + vp.tx,
    y: sx * sin + sy * cos + vp.ty,
  };
}

export function viewToImage(p, vp) {
  const theta = vp.rotation * DEG_TO_RAD;
  const vx = p.x - vp.tx;
  const vy = p.y - vp.ty;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  // Inverse of the rotation applied in imageToView is R(-theta): swap the
  // sign of sin rather than recompute cos/sin of -theta.
  return {
    x: (vx * cos + vy * sin) / vp.scale,
    y: (-vx * sin + vy * cos) / vp.scale,
  };
}

export function imageToViewLength(len, vp) {
  return len * vp.scale;
}

export function viewToImageLength(len, vp) {
  return len / vp.scale;
}

export function fitImage(imageSize, viewSize, padding = 0) {
  const availableWidth = viewSize.width - 2 * padding;
  const availableHeight = viewSize.height - 2 * padding;
  const rawScale = Math.min(availableWidth / imageSize.width, availableHeight / imageSize.height);
  // A collapsed canvas (viewSize/padding leaving ~0 available space) makes
  // rawScale exactly 0 or negative. Clamped to the same range zoomAt uses:
  // unclamped, a 0 scale sends viewToImage to NaN (division by zero) and a
  // negative scale mirrors the photo, silently flipping every signed angle.
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, rawScale));
  const tx = (viewSize.width - imageSize.width * scale) / 2;
  const ty = (viewSize.height - imageSize.height * scale) / 2;
  return createViewport({ scale, tx, ty, rotation: 0 });
}

export function zoomAt(vp, viewAnchor, factor, { minScale = MIN_SCALE, maxScale = MAX_SCALE } = {}) {
  const newScale = Math.min(maxScale, Math.max(minScale, vp.scale * factor));
  const imageAnchor = viewToImage(viewAnchor, vp);
  const rescaled = createViewport({ scale: newScale, tx: 0, ty: 0, rotation: vp.rotation });
  const projected = imageToView(imageAnchor, rescaled);
  return {
    scale: newScale,
    tx: viewAnchor.x - projected.x,
    ty: viewAnchor.y - projected.y,
    rotation: vp.rotation,
  };
}

export function panBy(vp, dxView, dyView) {
  return { ...vp, tx: vp.tx + dxView, ty: vp.ty + dyView };
}

/**
 * Recovers a viewport that has gone non-finite — `scale`, `tx` or `ty` is
 * NaN or +-Infinity. This happens downstream of a zero/negative scale that
 * slipped past fitImage/zoomAt (viewToImage divides by scale) and, once it
 * happens, every corner computed from the viewport is also non-finite, so
 * clampToBounds's own min/max logic can't repair it — there is nothing
 * finite to compare against. Refitting to the image is the only recovery
 * that doesn't need a finite starting point.
 */
export function sanitizeViewport(vp, imageSize, viewSize) {
  if (Number.isFinite(vp.scale) && vp.scale > 0 && Number.isFinite(vp.tx) && Number.isFinite(vp.ty)) {
    return vp;
  }
  return fitImage(imageSize, viewSize, 16);
}

/**
 * Nudges the viewport so at least `minVisible` view pixels of the image's
 * (rotated) bounding box stay on screen along each axis. Not a hard fit —
 * it only pulls back a viewport that has drifted the image entirely away.
 */
export function clampToBounds(vp, imageSize, viewSize, minVisible = 40) {
  vp = sanitizeViewport(vp, imageSize, viewSize);
  const corners = [
    { x: 0, y: 0 },
    { x: imageSize.width, y: 0 },
    { x: 0, y: imageSize.height },
    { x: imageSize.width, y: imageSize.height },
  ].map((p) => imageToView(p, vp));

  const minX = Math.min(...corners.map((c) => c.x));
  const maxX = Math.max(...corners.map((c) => c.x));
  const minY = Math.min(...corners.map((c) => c.y));
  const maxY = Math.max(...corners.map((c) => c.y));

  let dx = 0;
  if (maxX < minVisible) dx = minVisible - maxX;
  else if (minX > viewSize.width - minVisible) dx = viewSize.width - minVisible - minX;

  let dy = 0;
  if (maxY < minVisible) dy = minVisible - maxY;
  else if (minY > viewSize.height - minVisible) dy = viewSize.height - minVisible - minY;

  return { ...vp, tx: vp.tx + dx, ty: vp.ty + dy };
}
