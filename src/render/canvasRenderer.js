/**
 * Draws the current image onto a 2D canvas using a viewport transform
 * (see core/viewport.js), plus the point, segment, angle and distance
 * overlays.
 *
 * All overlay geometry is drawn in view space (after the image transform is
 * restored), at fixed CSS-pixel sizes — it transforms in position with the
 * image but never scales with zoom (spec §4, "overlays transform but do not
 * scale").
 *
 * Colours: renderFrame takes an optional `theme` (LOTE 5 §1) that app.js reads once from the
 * --al-* tokens; anything it leaves out falls back to DEFAULT_THEME below, so the renderer still
 * works with no CSS at all (tests, the PNG export of an old build).
 */

import { DEG_TO_RAD } from '../core/geometry.js';
import { imageToView } from '../core/viewport.js';
import { formatAngle, formatLength } from '../core/units.js';
import { decimalsForSigma } from '../core/uncertainty.js';
import { angleLabelPosition } from '../core/labelPlacement.js';

// Same values as tokens.css (--al-mark, --al-mark-active, --al-halo, --al-plaque, --al-plaque-edge,
// --al-mark-calibration, --al-mark-pending).
export const DEFAULT_THEME = {
  mark: '#00e5ff',
  markActive: '#ffd23f',
  halo: 'rgba(0, 0, 0, 0.78)',
  plaque: 'rgba(11, 14, 19, 0.86)',
  plaqueEdge: 'rgba(255, 255, 255, 0.22)',
  markCalibration: '#7cff6b',
  markPending: '#ffffff',
};

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
const ANGLE_LABEL_OFFSET = 20;
// LOTE 5 §2: numeric font, on a rounded plaque.
const LABEL_FONT_PX = 14;
const LABEL_FONT_FAMILY = 'ui-monospace, "SF Mono", Menlo, monospace';
const LABEL_PAD_X = 7;
const LABEL_PAD_Y = 5;
const LABEL_RADIUS = 8;
const LABEL_OFFSET_ABOVE = 20;

export function resizeCanvasBackingStore(canvas, cssWidth, cssHeight) {
  const dpr = window.devicePixelRatio || 1;
  const targetWidth = Math.round(cssWidth * dpr);
  const targetHeight = Math.round(cssHeight * dpr);
  if (canvas.width !== targetWidth) canvas.width = targetWidth;
  if (canvas.height !== targetHeight) canvas.height = targetHeight;
  return dpr;
}

// overlayScale multiplies EVERY size of the marks (radii, stroke widths, the angle arc, label
// distance and font size). 1 on screen; the PNG export passes a larger value so the marks stay
// readable on an image of thousands of pixels. Positions are never scaled, only mark sizes.
export function renderFrame(ctx, dpr, cssSize, viewport, image, overlay = null, overlayScale = 1, theme = {}) {
  const th = { ...DEFAULT_THEME, ...theme };
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssSize.width, cssSize.height);

  if (!image) return;

  ctx.save();
  ctx.translate(viewport.tx, viewport.ty);
  ctx.rotate(viewport.rotation * DEG_TO_RAD);
  ctx.scale(viewport.scale, viewport.scale);
  ctx.drawImage(image.displayBitmap, 0, 0, image.imageSize.width, image.imageSize.height);
  ctx.restore();

  if (overlay?.calibration) {
    drawCalibrationReference(ctx, viewport, overlay.calibration, overlayScale, th);
  }
  if (overlay?.segments?.length) {
    drawSegments(ctx, viewport, overlay.segments, overlay.selectedId, overlay.selectedType, overlayScale, th);
  }
  if (overlay?.distances?.length) {
    drawDistances(ctx, viewport, overlay.distances, overlay.selectedId, overlay.selectedType, overlayScale, th);
  }
  if (overlay?.angles?.length) {
    drawAngles(ctx, viewport, overlay.angles, overlay.selectedId, overlay.selectedType, overlayScale, th);
  }
  if (overlay?.points?.length) {
    drawPoints(
      ctx,
      viewport,
      overlay.points,
      overlay.selectedId,
      overlay.selectedType,
      overlay.pendingPointIds,
      overlayScale,
      th,
    );
  }
}

function drawPoints(ctx, viewport, points, selectedId, selectedType, pendingPointIds = [], k = 1, th = DEFAULT_THEME) {
  for (const point of points) {
    const isSelected = selectedType === 'point' && point.id === selectedId;
    const isPending = pendingPointIds.includes(point.id);
    drawMarker(ctx, imageToView(point, viewport), isSelected, isPending, k, th);
  }
}

// Halo-then-stroke line, the same double-draw convention as point markers
// (spec §4): legible over both a dark swimsuit and bright water. Selected
// entities get a heavier stroke rather than a different colour.
function drawHaloLine(ctx, from, to, selected, k = 1, th = DEFAULT_THEME) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.strokeStyle = th.halo;
  ctx.lineWidth = (selected ? LINE_WIDTH_HALO + 2 : LINE_WIDTH_HALO) * k;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.strokeStyle = selected ? th.markActive : th.mark;
  ctx.lineWidth = (selected ? LINE_WIDTH_STROKE + 1.5 : LINE_WIDTH_STROKE) * k;
  ctx.stroke();
  ctx.restore();
}

// Rounded rectangle path by hand: ctx.roundRect is missing from older Safari versions.
function roundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

// LOTE 5 §2: the value in a numeric font on a rounded plaque (dark in both themes). The text
// colour still carries the quality; the plaque is what keeps it readable on any photo.
function drawLabel(ctx, view, text, color = '#fff', k = 1, th = DEFAULT_THEME) {
  ctx.save();
  ctx.font = `600 ${LABEL_FONT_PX * k}px ${LABEL_FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const width = ctx.measureText(text).width + 2 * LABEL_PAD_X * k;
  const height = LABEL_FONT_PX * k + 2 * LABEL_PAD_Y * k;
  roundedRectPath(ctx, view.x - width / 2, view.y - height / 2, width, height, LABEL_RADIUS * k);
  ctx.fillStyle = th.plaque;
  ctx.fill();
  ctx.strokeStyle = th.plaqueEdge;
  ctx.lineWidth = Math.max(1, k);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillText(text, view.x, view.y + 0.5 * k);
  ctx.restore();
}

// F6: the calibration reference — dashed and green so it reads as a reference, not a measurement.
// The dash is reset afterwards: the canvas context is shared with every other layer.
function drawCalibrationReference(ctx, viewport, calibration, k = 1, th = DEFAULT_THEME) {
  const from = imageToView(calibration.a, viewport);
  const to = imageToView(calibration.b, viewport);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.setLineDash([6 * k, 4 * k]);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.strokeStyle = th.halo;
  ctx.lineWidth = LINE_WIDTH_HALO * k;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.strokeStyle = th.markCalibration;
  ctx.lineWidth = LINE_WIDTH_STROKE * k;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  drawLabel(
    ctx,
    { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - LABEL_OFFSET_ABOVE * k },
    calibration.label,
    th.markCalibration,
    k,
    th,
  );
}

function drawSegments(ctx, viewport, segments, selectedId, selectedType, k = 1, th = DEFAULT_THEME) {
  for (const segment of segments) {
    const selected = selectedType === 'segment' && segment.id === selectedId;
    drawHaloLine(ctx, imageToView(segment.a, viewport), imageToView(segment.b, viewport), selected, k, th);
  }
}

function drawDistances(ctx, viewport, distances, selectedId, selectedType, k = 1, th = DEFAULT_THEME) {
  for (const dist of distances) {
    const selected = selectedType === 'distance' && dist.id === selectedId;
    const aView = imageToView(dist.a, viewport);
    const bView = imageToView(dist.b, viewport);
    drawHaloLine(ctx, aView, bView, selected, k, th);

    const mid = { x: (aView.x + bView.x) / 2, y: (aView.y + bView.y) / 2 };
    // Real-world length is NaN until a calibration exists for this image —
    // show the pixel count alone rather than printing "NaN" on screen.
    // Decimals come from sigma (LOTE 2 §2.2): a coarse reading no longer
    // prints a false decimal of precision it doesn't have.
    const decimals = decimalsForSigma(dist.sigma);
    // Calibrated: only the real length — the pixel count is noise next to the number the user asked for.
    const label = Number.isFinite(dist.real)
      ? formatLength(dist.real, dist.unit, decimals)
      : `${dist.pixels.toFixed(1)} px`;
    drawLabel(ctx, { x: mid.x, y: mid.y - LABEL_OFFSET_ABOVE * k }, label, qualityColor(dist.quality), k, th);
  }
}

// An angle draws an arc between the two rays at a fixed view-space radius
// (spec §4), the numeric value near the arc, and an emphasised vertex.
// signedDegrees decides which way to sweep: view space preserves image
// space's handedness (pure scale/translate/rotation, no flip), so its sign
// also tells us the visually-correct sweep direction on screen.
function drawAngles(ctx, viewport, angles, selectedId, selectedType, k = 1, th = DEFAULT_THEME) {
  for (const angle of angles) {
    const selected = selectedType === 'angle' && angle.id === selectedId;
    const vertexView = imageToView(angle.vertex, viewport);
    const aView = imageToView(angle.a, viewport);
    const cView = imageToView(angle.c, viewport);

    drawHaloLine(ctx, vertexView, aView, selected, k, th);
    drawHaloLine(ctx, vertexView, cView, selected, k, th);
    drawMarker(ctx, vertexView, selected, false, k, th);

    if (!Number.isNaN(angle.signedDegrees)) {
      const startAngle = Math.atan2(aView.y - vertexView.y, aView.x - vertexView.x);
      const endAngle = Math.atan2(cView.y - vertexView.y, cView.x - vertexView.x);
      const anticlockwise = angle.signedDegrees > 0;

      ctx.save();
      ctx.beginPath();
      ctx.arc(vertexView.x, vertexView.y, ANGLE_ARC_RADIUS * k, startAngle, endAngle, anticlockwise);
      ctx.strokeStyle = th.halo;
      ctx.lineWidth = (selected ? LINE_WIDTH_HALO + 1 : LINE_WIDTH_HALO - 1) * k;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(vertexView.x, vertexView.y, ANGLE_ARC_RADIUS * k, startAngle, endAngle, anticlockwise);
      ctx.strokeStyle = selected ? th.markActive : th.mark;
      ctx.lineWidth = (selected ? LINE_WIDTH_STROKE + 1 : LINE_WIDTH_STROKE - 0.5) * k;
      ctx.stroke();
      ctx.restore();

      // The label goes on the bisector, beyond the arc, upright regardless of the geometry
      // (spec §4). In an angle under 40 degrees the rays are too close for that, so it moves to
      // the far side of the vertex instead (core/labelPlacement.js) and covers neither ray.
      const labelPos = angleLabelPosition(
        vertexView,
        aView,
        cView,
        angle.degrees,
        (ANGLE_ARC_RADIUS + ANGLE_LABEL_OFFSET) * k,
      );
      // Decimals and colour both come from sigmaDegrees (LOTE 2 §2.2): a
      // reading built from a short ray or a low zoom shows fewer decimals
      // and reads amber/red rather than a falsely precise "127.4°".
      const decimals = decimalsForSigma(angle.sigmaDegrees);
      drawLabel(ctx, labelPos, formatAngle(angle.degrees, decimals), qualityColor(angle.quality), k, th);
    }
  }
}

// Every overlay is drawn twice — a dark halo then a bright stroke/fill — so
// it stays legible over both a dark swimsuit and bright water (spec §4).
// `isPending` marks a point already picked while building a LINE/ANGLE/
// DISTANCE measurement, before enough points exist to create it: a white dashed ring, so it is
// not mistaken for the calibration reference (green) — LOTE 5 §1.
function drawMarker(ctx, view, isSelected, isPending = false, k = 1, th = DEFAULT_THEME) {
  ctx.save();

  if (isSelected) {
    ctx.beginPath();
    ctx.arc(view.x, view.y, SELECTED_RING_RADIUS * k, 0, Math.PI * 2);
    ctx.strokeStyle = th.halo;
    ctx.lineWidth = 4 * k;
    ctx.stroke();
    ctx.strokeStyle = th.markActive;
    ctx.lineWidth = 2 * k;
    ctx.stroke();
  } else if (isPending) {
    ctx.beginPath();
    ctx.arc(view.x, view.y, PENDING_RING_RADIUS * k, 0, Math.PI * 2);
    ctx.strokeStyle = th.halo;
    ctx.lineWidth = 4 * k;
    ctx.stroke();
    ctx.setLineDash([4 * k, 3 * k]);
    ctx.strokeStyle = th.markPending;
    ctx.lineWidth = 2 * k;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.beginPath();
  ctx.arc(view.x, view.y, POINT_RADIUS * k, 0, Math.PI * 2);
  ctx.strokeStyle = th.halo;
  ctx.lineWidth = 4 * k;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(view.x, view.y, POINT_RADIUS * k, 0, Math.PI * 2);
  ctx.fillStyle = isSelected ? th.markActive : th.mark;
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = (isSelected ? 2 : 1.5) * k;
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
