/**
 * Decodes a photo File/Blob into a display-ready ImageBitmap.
 *
 * Two distinct sizes matter here and must never be conflated:
 * - imageSize: the true, EXIF-corrected pixel dimensions. This is the
 *   coordinate space every point will be stored in from F4 onward.
 * - displayBitmap: a downscaled copy (longest side ~2048px) kept only
 *   because iOS Safari caps total canvas area and a 48MP photo exceeds it.
 *   It is drawn stretched to fill imageSize, so it never changes what
 *   coordinates mean.
 */

const MAX_DISPLAY_SIDE = 2048;

export async function loadDisplayImage(fileOrBlob) {
  const fullBitmap = await createImageBitmap(fileOrBlob, { imageOrientation: 'from-image' });
  const imageSize = { width: fullBitmap.width, height: fullBitmap.height };
  const longestSide = Math.max(imageSize.width, imageSize.height);

  if (longestSide <= MAX_DISPLAY_SIDE) {
    return { displayBitmap: fullBitmap, imageSize };
  }

  const displayScale = MAX_DISPLAY_SIDE / longestSide;
  const displayBitmap = await createImageBitmap(fullBitmap, {
    resizeWidth: Math.round(imageSize.width * displayScale),
    resizeHeight: Math.round(imageSize.height * displayScale),
    resizeQuality: 'high',
  });
  fullBitmap.close();
  return { displayBitmap, imageSize };
}
