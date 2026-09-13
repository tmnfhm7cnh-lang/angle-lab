/**
 * Draws the current image onto a 2D canvas using a viewport transform
 * (see core/viewport.js). Overlay rendering (points, angles) arrives in F4+;
 * this module only ever draws the photo.
 */

import { DEG_TO_RAD } from '../core/geometry.js';

export function resizeCanvasBackingStore(canvas, cssWidth, cssHeight) {
  const dpr = window.devicePixelRatio || 1;
  const targetWidth = Math.round(cssWidth * dpr);
  const targetHeight = Math.round(cssHeight * dpr);
  if (canvas.width !== targetWidth) canvas.width = targetWidth;
  if (canvas.height !== targetHeight) canvas.height = targetHeight;
  return dpr;
}

export function renderFrame(ctx, dpr, cssSize, viewport, image) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssSize.width, cssSize.height);

  if (!image) return;

  ctx.save();
  ctx.translate(viewport.tx, viewport.ty);
  ctx.rotate(viewport.rotation * DEG_TO_RAD);
  ctx.scale(viewport.scale, viewport.scale);
  ctx.drawImage(image.displayBitmap, 0, 0, image.imageSize.width, image.imageSize.height);
  ctx.restore();
}
