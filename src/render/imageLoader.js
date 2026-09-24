/**
 * Decodes a photo File/Blob into a display-ready ImageBitmap.
 *
 * Two distinct sizes matter here and must never be conflated:
 * - imageSize: the true, EXIF-corrected pixel dimensions. This is the
 *   coordinate space every point will be stored in from F4 onward.
 * - displayBitmap: a downscaled copy kept only because iOS Safari caps
 *   total canvas area and a 48MP photo exceeds it. It is drawn stretched to
 *   fill imageSize, so it never changes what coordinates mean.
 *
 * LOTE 3 §2: the original Blob is kept (imageSource.originalBlob) instead of
 * being discarded once a downscaled displayBitmap exists. Zooming in past
 * what that downscaled copy can render sharply used to mean tapping on
 * pixels invented by interpolation — decodeDisplayBitmap re-decodes straight
 * from the original Blob at whatever resolution the current zoom actually
 * needs, on demand, and is also what a future full-resolution export (F7)
 * will read from.
 */

const MAX_DISPLAY_SIDE = 2048;

// Verified against real Chrome behaviour (not assumed): a truncated/garbage
// file and a genuinely unsupported codec both throw the SAME
// InvalidStateError ("The source image could not be decoded") — there is no
// DOMException name that reliably tells those two failure causes apart, so
// the message below doesn't pretend to diagnose which one it was. size===0
// is the one cause this function can actually verify on its own.
function decodeError(cause, fileOrBlob) {
  const size = fileOrBlob?.size ?? 0;
  const message =
    size === 0
      ? 'This file is empty (0 bytes) and cannot be opened.'
      : "This photo couldn't be read — the file may be damaged, or its format " +
        "isn't supported (some HEIC files, for example). Try a different photo, " +
        'or a JPEG/PNG re-export of this one.';
  const error = new Error(message);
  error.cause = cause;
  return error;
}

async function decodeFullBitmap(fileOrBlob) {
  try {
    return await createImageBitmap(fileOrBlob, { imageOrientation: 'from-image' });
  } catch (cause) {
    throw decodeError(cause, fileOrBlob);
  }
}

export async function loadDisplayImage(fileOrBlob, targetLongestSide = MAX_DISPLAY_SIDE) {
  const fullBitmap = await decodeFullBitmap(fileOrBlob);
  const imageSize = { width: fullBitmap.width, height: fullBitmap.height };
  const longestSide = Math.max(imageSize.width, imageSize.height);

  if (longestSide <= targetLongestSide) {
    return { displayBitmap: fullBitmap, imageSize, originalBlob: fileOrBlob };
  }

  const displayScale = targetLongestSide / longestSide;
  const displayBitmap = await createImageBitmap(fullBitmap, {
    resizeWidth: Math.round(imageSize.width * displayScale),
    resizeHeight: Math.round(imageSize.height * displayScale),
    resizeQuality: 'high',
  });
  fullBitmap.close();
  return { displayBitmap, imageSize, originalBlob: fileOrBlob };
}

/**
 * Re-decodes straight from the original Blob at (up to) targetLongestSide,
 * for when the viewport has zoomed in past what the current displayBitmap
 * can render sharply. imageSize is already known at this point (from the
 * initial loadDisplayImage), so — unlike that first decode — this needs no
 * intermediate full-resolution bitmap: createImageBitmap accepts resize
 * options directly against a Blob source.
 */
export async function decodeDisplayBitmap(originalBlob, imageSize, targetLongestSide) {
  const longestSide = Math.max(imageSize.width, imageSize.height);
  const clampedTarget = Math.min(targetLongestSide, longestSide);
  try {
    if (clampedTarget >= longestSide) {
      return await createImageBitmap(originalBlob, { imageOrientation: 'from-image' });
    }
    const scale = clampedTarget / longestSide;
    return await createImageBitmap(originalBlob, {
      imageOrientation: 'from-image',
      resizeWidth: Math.max(1, Math.round(imageSize.width * scale)),
      resizeHeight: Math.max(1, Math.round(imageSize.height * scale)),
      resizeQuality: 'high',
    });
  } catch (cause) {
    throw decodeError(cause, originalBlob);
  }
}

export { MAX_DISPLAY_SIDE };
