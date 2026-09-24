/**
 * Draws the current image onto a 2D canvas using a viewport transform
 * (see core/viewport.js), plus the point, segment, angle and distance
 * overlays.
 *
 * All overlay geometry is drawn in view space (after the image transform is
 * restored), at fixed CSS-pixel sizes — it transforms in position with the
 * image but never scales with zoom (spec §4, "overlays transform but do not
 * scale").
 */

import { DEG_TO_RAD, subtract, magnitude } from '../core/geometry.js';
import { imageToView } from '../core/viewport.js';
import { formatAngle, formatLength } from '../core/units.js';
import { decimalsForSigma } from '../core/uncertainty.js';

// LOTE 2 §2.2: red/amber/green mirrors qualityForSigma's 'poor'/'ok'/'good'.
// Selected entities keep their own highlight colour (drawn separately);
// this only colours the reading label.
const QUALITY_COLOR = { good: '#7cff6b', ok: '#ffd23f', poor: '#ff5f5f' };

function qualityColor(quality) {
  return QUALITY_COLOR[quality?.level] || '#fff';
}

const POINT_RADIUS = 6;
const SELECTED_RING_RADIUS = 11;
const PENDING_RING_RADIUS = 11;
const LINE_WIDTH_HALO = 4;
const LINE_WIDTH_STROKE = 2;
const ANGLE_ARC_RADIUS = 28;
const ANGLE_LABEL_OFFSET = 14;
const LABEL_FONT = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

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

  if (overlay?.segments?.length) {
    drawSegments(ctx, viewport, overlay.segments, overlay.selectedId, overlay.selectedType);
  }
  if (overlay?.distances?.length) {
    drawDistances(ctx, viewport, overlay.distances, overlay.selectedId, overlay.selectedType);
  }
  if (overlay?.angles?.length) {
    drawAngles(ctx, viewport, overlay.angles, overlay.selectedId, overlay.selectedType);
  }
  if (overlay?.points?.length) {
    drawPoints(
      ctx,
      viewport,
      overlay.points,
      overlay.selectedId,
      overlay.selectedType,
      overlay.pendingPointIds,
    );
  }
}

function drawPoints(ctx, viewport, points, selectedId, selectedType, pendingPointIds = []) {
  for (const point of points) {
    const isSelected = selectedType === 'point' && point.id === selectedId;
    const isPending = pendingPointIds.includes(point.id);
    drawMarker(ctx, imageToView(point, viewport), isSelected, isPending);
  }
}

// Halo-then-stroke line, the same double-draw convention as point markers
// (spec §4): legible over both a dark swimsuit and bright water. Selected
// entities get a heavier stroke rather than a different colour.
function drawHaloLine(ctx, from, to, selected) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.lineWidth = selected ? LINE_WIDTH_HALO + 2 : LINE_WIDTH_HALO;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.strokeStyle = selected ? '#ffd23f' : '#00e5ff';
  ctx.lineWidth = selected ? LINE_WIDTH_STROKE + 1.5 : LINE_WIDTH_STROKE;
  ctx.stroke();
  ctx.restore();
}

function drawLabel(ctx, view, text, color = '#fff') {
  ctx.save();
  ctx.font = LABEL_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.strokeText(text, view.x, view.y);
  ctx.fillStyle = color;
  ctx.fillText(text, view.x, view.y);
  ctx.restore();
}

function drawSegments(ctx, viewport, segments, selectedId, selectedType) {
  for (const segment of segments) {
    const selected = selectedType === 'segment' && segment.id === selectedId;
    drawHaloLine(ctx, imageToView(segment.a, viewport), imageToView(segment.b, viewport), selected);
  }
}

function drawDistances(ctx, viewport, distances, selectedId, selectedType) {
  for (const dist of distances) {
    const selected = selectedType === 'distance' && dist.id === selectedId;
    const aView = imageToView(dist.a, viewport);
    const bView = imageToView(dist.b, viewport);
    drawHaloLine(ctx, aView, bView, selected);

    const mid = { x: (aView.x + bView.x) / 2, y: (aView.y + bView.y) / 2 };
    // Real-world length is NaN until a calibration exists for this image —
    // show the pixel count alone rather than printing "NaN" on screen.
    // Decimals come from sigma (LOTE 2 §2.2): a coarse reading no longer
    // prints a false decimal of precision it doesn't have.
    const decimals = decimalsForSigma(dist.sigma);
    const label = Number.isFinite(dist.real)
      ? `${dist.pixels.toFixed(1)} px (${formatLength(dist.real, dist.unit, decimals)})`
      : `${dist.pixels.toFixed(1)} px`;
    drawLabel(ctx, { x: mid.x, y: mid.y - 12 }, label, qualityColor(dist.quality));
  }
}

function unitVector(v) {
  const m = magnitude(v);
  return m === 0 ? { x: 0, y: 0 } : { x: v.x / m, y: v.y / m };
}

// An angle draws an arc between the two rays at a fixed view-space radius
// (spec §4), the numeric value near the arc, and an emphasised vertex.
// signedDegrees decides which way to sweep: view space preserves image
// space's handedness (pure scale/translate/rotation, no flip), so its sign
// also tells us the visually-correct sweep direction on screen.
function drawAngles(ctx, viewport, angles, selectedId, selectedType) {
  for (const angle of angles) {
    const selected = selectedType === 'angle' && angle.id === selectedId;
    const vertexView = imageToView(angle.vertex, viewport);
    const aView = imageToView(angle.a, viewport);
    const cView = imageToView(angle.c, viewport);

    drawHaloLine(ctx, vertexView, aView, selected);
    drawHaloLine(ctx, vertexView, cView, selected);
    drawMarker(ctx, vertexView, selected, false);

    if (!Number.isNaN(angle.signedDegrees)) {
      const startAngle = Math.atan2(aView.y - vertexView.y, aView.x - vertexView.x);
      const endAngle = Math.atan2(cView.y - vertexView.y, cView.x - vertexView.x);
      const anticlockwise = angle.signedDegrees > 0;

      ctx.save();
      ctx.beginPath();
      ctx.arc(vertexView.x, vertexView.y, ANGLE_ARC_RADIUS, startAngle, endAngle, anticlockwise);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.lineWidth = selected ? LINE_WIDTH_HALO + 1 : LINE_WIDTH_HALO - 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(vertexView.x, vertexView.y, ANGLE_ARC_RADIUS, startAngle, endAngle, anticlockwise);
      ctx.strokeStyle = selected ? '#ffd23f' : '#00e5ff';
      ctx.lineWidth = selected ? LINE_WIDTH_STROKE + 1 : LINE_WIDTH_STROKE - 0.5;
      ctx.stroke();
      ctx.restore();

      // Label placed outside the arc, offset along the interior bisector,
      // and never rotated — upright regardless of the geometry (spec §4).
      const uA = unitVector(subtract(aView, vertexView));
      const uC = unitVector(subtract(cView, vertexView));
      let bisector = { x: uA.x + uC.x, y: uA.y + uC.y };
      let bm = magnitude(bisector);
      if (bm < 1e-9) {
        bisector = { x: -uA.y, y: uA.x };
        bm = 1;
      }
      bisector = { x: bisector.x / bm, y: bisector.y / bm };
      const labelPos = {
        x: vertexView.x + bisector.x * (ANGLE_ARC_RADIUS + ANGLE_LABEL_OFFSET),
        y: vertexView.y + bisector.y * (ANGLE_ARC_RADIUS + ANGLE_LABEL_OFFSET),
      };
      // Decimals and colour both come from sigmaDegrees (LOTE 2 §2.2): a
      // reading built from a short ray or a low zoom shows fewer decimals
      // and reads amber/red rather than a falsely precise "127.4°".
      const decimals = decimalsForSigma(angle.sigmaDegrees);
      drawLabel(ctx, labelPos, formatAngle(angle.degrees, decimals), qualityColor(angle.quality));
    }
  }
}

// Every overlay is drawn twice — a dark halo then a bright stroke/fill — so
// it stays legible over both a dark swimsuit and bright water (spec §4).
// `isPending` marks a point already picked while building a LINE/ANGLE/
// DISTANCE measurement, before enough points exist to create it.
function drawMarker(ctx, view, isSelected, isPending = false) {
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
  } else if (isPending) {
    ctx.beginPath();
    ctx.arc(view.x, view.y, PENDING_RING_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.strokeStyle = '#7cff6b';
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
