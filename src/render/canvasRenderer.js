/**
 * Draws the current image onto a 2D canvas using a viewport transform
 * (see core/viewport.js), plus the point overlay added in F4. Angle/segment
 * overlays arrive in F5.
 *
 * Point markers are drawn in view space (after the image transform is
 * restored), at a fixed CSS-pixel radius — they transform in position with
 * the image but never scale with zoom (spec §4, "overlays transform but do
 * not scale").
 */

import { DEG_TO_RAD } from '../core/geometry.js';
import { imageToView } from '../core/viewport.js';

const POINT_RADIUS = 6;
const SELECTED_RING_RADIUS = 11;

export function resizeCanvasBackingStore(canvas, cssWidth, cssHeight) {
  const dpr = window.devicePixelRatio || 1;
  const targetWidth = Math.round(cssWidth * dpr);
  const targetHeight = Math.round(cssHeight * dpr);
  if (canvas.width !== targetWidth) canvas.width = targetWidth;
  if (canvas.height !== targetHeight) canvas.height = targetHeight;
  return dpr;
}

export function renderFrame(ctx, dpr, cssSize, viewport, image, overlay = null) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssSize.width, cssSize.height);

  if (!image) return;

  ctx.save();
  ctx.translate(viewport.tx, viewport.ty);
  ctx.rotate(viewport.rotation * DEG_TO_RAD);
  ctx.scale(viewport.scale, viewport.scale);
  ctx.drawImage(image.displayBitmap, 0, 0, image.imageSize.width, image.imageSize.height);
  ctx.restore();

  if (overlay?.points?.length) {
    drawPoints(ctx, viewport, overlay.points, overlay.selectedPointId);
  }
}

function drawPoints(ctx, viewport, points, selectedPointId) {
  for (const point of points) {
    drawMarker(ctx, imageToView(point, viewport), point.id === selectedPointId);
  }
}

// Every overlay is drawn twice — a dark halo then a bright stroke/fill — so
// it stays legible over both a dark swimsuit and bright water (spec §4).
function drawMarker(ctx, view, isSelected) {
  ctx.save();

  if (isSelected) {
    ctx.beginPath();
    ctx.arc(view.x, view.y, SELECTED_RING_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(view.x, view.y, POINT_RADIUS, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(view.x, view.y, POINT_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = isSelected ? '#ffd23f' : '#00e5ff';
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = isSelected ? 2 : 1.5;
  ctx.stroke();

  ctx.restore();
}

/**
 * Renders a magnified, circular crop of the image centred on `imagePoint`
 * into its own small canvas — the precision loupe shown while dragging a
 * point with a finger (spec §4, "the magnifier"). `zoomFactor` multiplies
 * the current viewport scale, so the loupe zooms in step with the main view.
 */
export function renderMagnifierFrame(ctx, dpr, cssSize, image, imagePoint, viewport, zoomFactor) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssSize.width, cssSize.height);
  if (!image) return;

  const radius = Math.min(cssSize.width, cssSize.height) / 2;
  const cx = cssSize.width / 2;
  const cy = cssSize.height / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 1, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, cssSize.width, cssSize.height);

  const effectiveScale = viewport.scale * zoomFactor;
  const bitmapScale = image.displayBitmap.width / image.imageSize.width;
  ctx.translate(cx - imagePoint.x * effectiveScale, cy - imagePoint.y * effectiveScale);
  ctx.scale(effectiveScale / bitmapScale, effectiveScale / bitmapScale);
  ctx.drawImage(image.displayBitmap, 0, 0);
  ctx.restore();

  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy);
  ctx.lineTo(cx + 8, cy);
  ctx.moveTo(cx, cy - 8);
  ctx.lineTo(cx, cy + 8);
  ctx.stroke();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 7, cy);
  ctx.lineTo(cx + 7, cy);
  ctx.moveTo(cx, cy - 7);
  ctx.lineTo(cx, cy + 7);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, radius - 1, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}
