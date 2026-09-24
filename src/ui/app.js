import { createViewport, fitImage, zoomAt, panBy, clampToBounds, viewToImage, viewToImageLength } from '../core/viewport.js';
import { loadDisplayImage, decodeDisplayBitmap, MAX_DISPLAY_SIDE } from '../render/imageLoader.js';
import { resizeCanvasBackingStore, renderFrame, renderMagnifierFrame } from '../render/canvasRenderer.js';
import { attachPointerGestures } from './pointerGestures.js';
import {
  createProject,
  addImage,
  addPoint,
  movePoint,
  removePoint,
  addSegment,
  addAngle,
  addDistance,
  removeEntity,
  getCalibration,
  getPoint,
  serialize,
  deserialize,
} from '../core/model.js';
import { evaluateSegment, evaluateAngle, evaluateDistance } from '../core/measurements.js';
import { hitTest } from '../core/hittest.js';
import { repeatabilityStats } from '../core/uncertainty.js';
import { millimetresPerPixel, pixelsToReal, isCalibrated } from '../core/calibration.js';
import { formatLength } from '../core/units.js';
import {
  saveActiveProject,
  loadActiveProject,
  saveBlob,
  loadBlob,
  clearAll,
  requestPersistence,
  estimateStorageRatio,
  STORAGE_WARNING_RATIO,
} from '../storage/db.js';

const TOUCH_RADIUS_CSS_PX = 22;
const MAGNIFIER_SIZE_CSS_PX = 120;
const MAGNIFIER_ZOOM = 3;

const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');
const fileInput = document.getElementById('file-input');
const cameraInput = document.getElementById('camera-input');
const fitButton = document.getElementById('fit-button');
const zoomReadout = document.getElementById('zoom-readout');
const toolButtons = Array.from(document.querySelectorAll('.tool-button[data-tool]'));
const deleteButton = document.getElementById('delete-selected-button');
const magnifierCanvas = document.getElementById('magnifier');
const magnifierCtx = magnifierCanvas.getContext('2d');
const repeatReadout = document.getElementById('repeat-readout');
const protocolButton = document.getElementById('protocol-button');
const protocolDialog = document.getElementById('protocol-dialog');
const protocolCloseButton = document.getElementById('protocol-close-button');
const startOverButton = document.getElementById('start-over-button');
const errorBar = document.getElementById('error-bar');
const storageBar = document.getElementById('storage-bar');

// LOTE 2 §2.3(a): a static checklist plus what the app does and doesn't
// guarantee — no ground truth here, just the physics of a single photo.
protocolButton.addEventListener('click', () => protocolDialog.showModal());
protocolCloseButton.addEventListener('click', () => protocolDialog.close());

let image = null;
let viewport = createViewport();
let dpr = 1;
let magnifierDpr = 1;
let renderScheduled = false;

let project = createProject();
let mode = 'select'; // 'select' | 'point' | 'line' | 'angle' | 'distance'
// The selected entity can be a point, segment, angle or distance — one id
// plus its type, since delete and highlighting both need to know which.
let selectedEntityId = null;
let selectedEntityType = null;
let draggingPointId = null;
let magnifierPointerType = null;
// Id of a point created by the current claim, in POINT mode, so it can be
// undone if the claim turns out to be cancelled (see onPointDragEnd) instead
// of a real single-finger tap.
let justCreatedPointId = null;
// Point ids picked so far for an in-progress LINE/ANGLE/DISTANCE measurement,
// in tap order (the second tap of an ANGLE is the vertex — see addAngle).
let pendingPointIds = [];
// Same undo-on-cancellation idea as justCreatedPointId, extended to
// LINE/ANGLE/DISTANCE taps: pendingSnapshotBeforeClaim is a copy of
// pendingPointIds from before the current claim touched it, so a cancelled
// claim can restore exactly that — whether the claim only added a pending
// pick or completed the measurement (which resets the array to empty) — and
// justCreatedMeasurementId is the model entity to remove in the latter case.
// See onPointDragEnd.
let pendingSnapshotBeforeClaim = null;
let justCreatedMeasurementId = null;
// LOTE 2 §2.2, the repeatability lab: taps collected while mode === 'repeat'.
// These never touch the project model — they are not a measurement of
// anything in the photo, only of how consistently the same landmark can be
// re-found, so there is nothing here for undo-on-cancel to protect.
let repeatTaps = [];
const REPEATABILITY_TAP_COUNT = 3;

// LOTE 3 §3/§7: persistence, storage health and load-error reporting.
function showError(message) {
  errorBar.hidden = false;
  errorBar.textContent = message;
}

function clearError() {
  errorBar.hidden = true;
  errorBar.textContent = '';
}

async function checkStorageHealth() {
  const ratio = await estimateStorageRatio();
  if (ratio === null || ratio < STORAGE_WARNING_RATIO) {
    storageBar.hidden = true;
    return;
  }
  storageBar.hidden = false;
  storageBar.textContent =
    `Device storage is ${Math.round(ratio * 100)}% full. Use "Start over" to free space, ` +
    `or export what you need, before the browser evicts it on its own.`;
}

// Debounced autosave, flushed synchronously on backgrounding — same shape as
// dryland-test-logger's LOTE 1 §1 fix, for the same reason: waiting out a
// debounce risks losing the last edits if iOS kills the tab while hidden.
const SAVE_DEBOUNCE_MS = 400;
let saveTimer = null;
let pendingSaveData = null;

function scheduleSave() {
  pendingSaveData = serialize(project);
  if (saveTimer) return;
  saveTimer = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
}

function flushSave() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (!pendingSaveData) return;
  const toSave = pendingSaveData;
  pendingSaveData = null;
  saveActiveProject(toSave).then((ok) => {
    if (ok) checkStorageHealth();
  });
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushSave();
});
window.addEventListener('pagehide', flushSave);

// Tracks the longest side (source pixels) the CURRENT image.displayBitmap
// actually holds, so ensureDetailForZoom knows whether a redecode would buy
// any real sharpness or would just re-decode the same resolution again.
let currentDetailLongestSide = MAX_DISPLAY_SIDE;
let detailDecodeInFlight = false;
// Below this margin over the currently-held resolution, a redecode isn't
// worth its cost — this session's own tolerance for "close enough", not a
// measured constant (same spirit as model.js's MIN_CALIBRATION_REFERENCE_PX).
const ZOOM_REDECODE_MARGIN = 1.5;
// Conservative cap: 4096×4096 is 16.78M px, at the edge of the ~16.7M px
// canvas-area limit older iOS Safari versions have enforced — a portrait or
// landscape (non-square) photo capped on its longest side alone stays safely
// under that total.
const MAX_ZOOM_DISPLAY_SIDE = 4096;

async function ensureDetailForZoom() {
  if (!image?.originalBlob || detailDecodeInFlight) return;
  const sourceLongestSide = Math.max(image.imageSize.width, image.imageSize.height);
  const requiredSourceLongestSide = sourceLongestSide * viewport.scale * dpr;
  const target = Math.min(MAX_ZOOM_DISPLAY_SIDE, sourceLongestSide);
  if (target <= currentDetailLongestSide) return;
  if (requiredSourceLongestSide <= currentDetailLongestSide * ZOOM_REDECODE_MARGIN) return;

  detailDecodeInFlight = true;
  try {
    const nextBitmap = await decodeDisplayBitmap(image.originalBlob, image.imageSize, target);
    if (!image) {
      nextBitmap.close();
      return;
    }
    const oldBitmap = image.displayBitmap;
    image.displayBitmap = nextBitmap;
    currentDetailLongestSide = Math.max(nextBitmap.width, nextBitmap.height);
    oldBitmap.close();
    scheduleRender();
  } catch (err) {
    showError(err.message);
  } finally {
    detailDecodeInFlight = false;
  }
}

function isMeasurementMode(m) {
  return m === 'line' || m === 'angle' || m === 'distance';
}

function requiredPointCount(m) {
  return m === 'angle' ? 3 : 2;
}

function cssSize() {
  const rect = canvas.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

function activePoints() {
  if (!project.activeImageId) return [];
  return project.points.filter((p) => p.imageId === project.activeImageId);
}

// Segments/angles/distances are evaluated fresh on every render — nothing
// is cached (core/measurements.js), so a point dragged in SELECT mode moves
// every measurement that references it on the very next frame. A null
// result (a dangling reference) is filtered out defensively, though
// core/model.js's cascade delete means one should never actually occur.
function activeSegments() {
  if (!project.activeImageId) return [];
  return project.segments
    .map((s) => {
      const result = evaluateSegment(project, s.id);
      if (!result || result.a.imageId !== project.activeImageId) return null;
      return { id: s.id, ...result };
    })
    .filter(Boolean);
}

function activeAngles() {
  if (!project.activeImageId) return [];
  return project.measurements
    .filter((m) => m.type === 'angle')
    .map((m) => {
      const result = evaluateAngle(project, m.id);
      if (!result || result.vertex.imageId !== project.activeImageId) return null;
      return { id: m.id, ...result };
    })
    .filter(Boolean);
}

function activeDistances() {
  if (!project.activeImageId) return [];
  return project.measurements
    .filter((m) => m.type === 'distance')
    .map((m) => {
      const result = evaluateDistance(project, m.id);
      if (!result || result.a.imageId !== project.activeImageId) return null;
      return { id: m.id, ...result };
    })
    .filter(Boolean);
}

function scheduleRender() {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    renderFrame(ctx, dpr, cssSize(), viewport, image, {
      points: activePoints(),
      selectedId: selectedEntityId,
      selectedType: selectedEntityType,
      pendingPointIds,
      segments: activeSegments(),
      angles: activeAngles(),
      distances: activeDistances(),
    });
    zoomReadout.textContent = `${Math.round(viewport.scale * 100)}%`;
    deleteButton.disabled = !selectedEntityId;
  });
}

function resizeCanvas() {
  const size = cssSize();
  dpr = resizeCanvasBackingStore(canvas, size.width, size.height);
  scheduleRender();
}

function fitToScreen() {
  if (!image) return;
  viewport = fitImage(image.imageSize, cssSize(), 16);
  scheduleRender();
}

async function loadFile(file) {
  if (!file) return;
  clearError();
  let decoded;
  try {
    decoded = await loadDisplayImage(file);
  } catch (err) {
    showError(err.message);
    return;
  }
  const { displayBitmap, imageSize, originalBlob } = decoded;
  if (image?.displayBitmap) image.displayBitmap.close();
  image = { displayBitmap, imageSize, originalBlob };
  currentDetailLongestSide = Math.max(displayBitmap.width, displayBitmap.height);
  // LOTE 3 §3: the model no longer stores the filename anywhere (see below) —
  // image.id (a UUID model.js already generates) is the only key IndexedDB
  // ever sees for this photo's Blob.
  const imageRef = addImage(project, { width: imageSize.width, height: imageSize.height });
  project.activeImageId = imageRef.id;
  selectedEntityId = null;
  selectedEntityType = null;
  pendingPointIds = [];
  fitToScreen();
  scheduleSave();
  saveBlob(imageRef.id, originalBlob).then((ok) => {
    if (ok) checkStorageHealth();
  });
}

fileInput.addEventListener('change', (event) => {
  loadFile(event.target.files[0]);
  event.target.value = '';
});

cameraInput.addEventListener('change', (event) => {
  loadFile(event.target.files[0]);
  event.target.value = '';
});

fitButton.addEventListener('click', fitToScreen);

function setMode(nextMode) {
  mode = nextMode;
  // Switching tools abandons any in-progress LINE/ANGLE/DISTANCE pick —
  // there is no well-defined meaning for a pending point picked under one
  // tool once a different tool is active. Same for an in-progress
  // repeatability run.
  pendingPointIds = [];
  repeatTaps = [];
  repeatReadout.hidden = true;
  for (const button of toolButtons) {
    button.classList.toggle('active', button.dataset.tool === mode);
  }
  scheduleRender();
}

for (const button of toolButtons) {
  button.addEventListener('click', () => setMode(button.dataset.tool));
}
setMode(mode);

function deleteSelected() {
  if (!selectedEntityId) return;
  // removeEntity dispatches by entity kind and, for a point, cascades to
  // every segment/angle/distance/calibration that referenced it — a
  // measurement never lingers with a dangling point reference.
  removeEntity(project, selectedEntityId);
  selectedEntityId = null;
  selectedEntityType = null;
  scheduleRender();
  scheduleSave();
}

deleteButton.addEventListener('click', deleteSelected);

window.addEventListener('keydown', (event) => {
  if (event.key !== 'Delete' && event.key !== 'Backspace') return;
  if (!selectedEntityId) return;
  event.preventDefault();
  deleteSelected();
});

function setupMagnifierCanvas() {
  magnifierDpr = resizeCanvasBackingStore(magnifierCanvas, MAGNIFIER_SIZE_CSS_PX, MAGNIFIER_SIZE_CSS_PX);
}

function positionMagnifier(viewPoint) {
  const area = cssSize();
  const gap = 24;
  let left = viewPoint.x - MAGNIFIER_SIZE_CSS_PX / 2;
  let top = viewPoint.y - MAGNIFIER_SIZE_CSS_PX - gap;
  if (top < 0) top = viewPoint.y + gap;
  left = Math.min(Math.max(left, 0), Math.max(0, area.width - MAGNIFIER_SIZE_CSS_PX));
  magnifierCanvas.style.left = `${left}px`;
  magnifierCanvas.style.top = `${top}px`;
}

function drawMagnifier(imagePoint) {
  renderMagnifierFrame(
    magnifierCtx,
    magnifierDpr,
    { width: MAGNIFIER_SIZE_CSS_PX, height: MAGNIFIER_SIZE_CSS_PX },
    image,
    imagePoint,
    viewport,
    MAGNIFIER_ZOOM,
  );
}

function showMagnifierAt(viewPoint, imagePoint) {
  magnifierCanvas.hidden = false;
  positionMagnifier(viewPoint);
  drawMagnifier(imagePoint);
}

function hideMagnifier() {
  magnifierCanvas.hidden = true;
}

// Single-pointer interception for the point tool, layered on top of the F3
// pan/pinch gestures via onPointClaim/onPointDragMove/onPointDragEnd — see
// pointerGestures.js. Returning true from onPointClaim tells that module
// "I own this pointer", which suppresses panning for it.
// Creates the measurement for the tool currently in `mode` from the three
// (or two) picked point ids, in tap order — the second tap of an ANGLE is
// the vertex, matching addAngle(project, aId, vertexId, cId).
function finishPendingMeasurement() {
  const [id1, id2, id3] = pendingPointIds;
  let created;
  let type;
  if (mode === 'line') {
    created = addSegment(project, id1, id2);
    type = 'segment';
  } else if (mode === 'distance') {
    created = addDistance(project, id1, id2);
    type = 'distance';
  } else {
    created = addAngle(project, id1, id2, id3);
    type = 'angle';
  }
  pendingPointIds = [];
  // addSegment/addAngle/addDistance return null if the picked points turn
  // out not to share an image (LOTE 2 §2.1) — not reachable through this
  // UI today, since hitTest only ever offers points from activeImageId, but
  // cheap to guard rather than assume that stays true forever.
  if (!created) {
    selectedEntityId = null;
    selectedEntityType = null;
    return null;
  }
  selectedEntityId = created.id;
  selectedEntityType = type;
  scheduleSave();
  return created;
}

// Real-world sigma for the repeatability readout, following the same rule
// evaluateDistance/evaluateSegment use: pixels if this image has no
// calibration yet (true for every image today — F6's interface isn't built),
// the project's display unit once it does.
function repeatabilityRealSigma(pixelSigma) {
  const calibration = getCalibration(project, project.activeImageId);
  if (!calibration) return null;
  const refA = getPoint(project, calibration.aId);
  const refB = getPoint(project, calibration.bId);
  if (!refA || !refB) return null;
  const mmPerPixel = millimetresPerPixel(
    calibration.realLength,
    calibration.unit,
    Math.hypot(refB.x - refA.x, refB.y - refA.y),
  );
  if (!isCalibrated(mmPerPixel)) return null;
  return pixelsToReal(pixelSigma, mmPerPixel, project.displayUnit);
}

// LOTE 2 §2.2, "un laboratorio de repetibilidad": tap the same landmark
// REPEATABILITY_TAP_COUNT times, blind (no crosshair carried over between
// taps — that would defeat the point), and read back how much they actually
// disagree. This is the one number in the whole feature that is measured
// rather than modelled (see uncertainty.js's module doc).
function handleRepeatabilityTap(imagePoint) {
  repeatTaps.push(imagePoint);
  if (repeatTaps.length < REPEATABILITY_TAP_COUNT) {
    repeatReadout.hidden = false;
    repeatReadout.textContent = `Tap the same point ${REPEATABILITY_TAP_COUNT - repeatTaps.length} more time${
      REPEATABILITY_TAP_COUNT - repeatTaps.length === 1 ? '' : 's'
    }.`;
    return;
  }
  const stats = repeatabilityStats(repeatTaps);
  const realSigma = repeatabilityRealSigma(stats.rmsPx);
  const realText = realSigma !== null ? ` (${formatLength(realSigma, project.displayUnit, 2)})` : '';
  repeatReadout.hidden = false;
  repeatReadout.textContent =
    `Your own repeatability: ±${stats.rmsPx.toFixed(1)} px${realText} typical, ` +
    `${stats.maxDeviationPx.toFixed(1)} px worst of ${REPEATABILITY_TAP_COUNT} taps. ` +
    `Tap again to redo.`;
  repeatTaps = [];
}

function onPointClaim(viewPoint, event) {
  if (!image || !project.activeImageId) return false;
  const imagePoint = viewToImage(viewPoint, viewport);

  if (mode === 'repeat') {
    handleRepeatabilityTap(imagePoint);
    scheduleRender();
    return true;
  }

  if (mode === 'point') {
    const created = addPoint(project, {
      imageId: project.activeImageId,
      x: imagePoint.x,
      y: imagePoint.y,
      // The zoom this point was placed at — uncertainty.js turns it into an
      // image-pixel error for the sigma shown on every angle/distance that
      // uses this point (LOTE 2 §2.2).
      placementScale: viewport.scale,
    });
    selectedEntityId = created.id;
    selectedEntityType = 'point';
    justCreatedPointId = created.id;
    scheduleRender();
    scheduleSave();
    return true;
  }

  const toleranceImage = viewToImageLength(TOUCH_RADIUS_CSS_PX, viewport);
  const hit = hitTest(project, imagePoint, toleranceImage, project.activeImageId);

  if (isMeasurementMode(mode)) {
    // LINE/ANGLE/DISTANCE: tap an existing point to add it to the
    // in-progress pick, in order, until enough points exist to create the
    // measurement. Tapping empty space abandons the current pick. The
    // pointer is always claimed here so a tap never starts a pan/drag.
    pendingSnapshotBeforeClaim = pendingPointIds.slice();
    if (hit && hit.type === 'point' && !pendingPointIds.includes(hit.id)) {
      pendingPointIds.push(hit.id);
      if (pendingPointIds.length === requiredPointCount(mode)) {
        const created = finishPendingMeasurement();
        justCreatedMeasurementId = created ? created.id : null;
      }
    } else if (!hit) {
      pendingPointIds = [];
    }
    scheduleRender();
    return true;
  }

  // SELECT mode: hit-test in image space, tolerance converted from a
  // constant view-space radius (spec §4) so it is never impossible to hit a
  // point at high zoom nor ambiguous at low zoom.
  if (hit && hit.type === 'point') {
    selectedEntityId = hit.id;
    selectedEntityType = 'point';
    draggingPointId = hit.id;
    justCreatedPointId = null;
    magnifierPointerType = event.pointerType;
    if (event.pointerType !== 'pen') showMagnifierAt(viewPoint, imagePoint);
    scheduleRender();
    return true;
  }

  if (hit && (hit.type === 'segment' || hit.type === 'angle' || hit.type === 'distance')) {
    // Segments/angles/distances aren't draggable in F5, so the pointer is
    // not claimed here — selection happens, and if the finger keeps moving
    // it pans the view, same as tapping empty space would.
    selectedEntityId = hit.id;
    selectedEntityType = hit.type;
    justCreatedPointId = null;
    scheduleRender();
    return false;
  }

  selectedEntityId = null;
  selectedEntityType = null;
  justCreatedPointId = null;
  scheduleRender();
  return false;
}

function onPointDragMove(viewPoint) {
  if (!draggingPointId) return;
  const imagePoint = viewToImage(viewPoint, viewport);
  movePoint(project, draggingPointId, imagePoint.x, imagePoint.y, viewport.scale);
  if (magnifierPointerType !== 'pen') showMagnifierAt(viewPoint, imagePoint);
  scheduleRender();
  scheduleSave();
}

function onPointDragEnd(point, event) {
  // A claim ends either by a genuine release of the same pointer (pointerup
  // /pointercancel) or by cancellation because a second finger arrived —
  // pointerGestures.js calls this hook with that second pointer's own
  // 'pointerdown' event in the cancellation case (see attachPointerGestures).
  // Only the cancellation case means the user never intended a one-finger
  // tap: resting a second finger down to start a pinch right after touching
  // down in POINT mode must not leave behind the point that the first
  // finger's touch had already created — and the same logic applies to a
  // LINE/ANGLE/DISTANCE tap that picked a point, or completed a measurement,
  // right before a second finger landed.
  if (event?.type === 'pointerdown') {
    let undidSomething = false;
    if (justCreatedPointId) {
      removePoint(project, justCreatedPointId);
      if (selectedEntityId === justCreatedPointId) {
        selectedEntityId = null;
        selectedEntityType = null;
      }
      scheduleRender();
      undidSomething = true;
    }
    if (justCreatedMeasurementId) {
      removeEntity(project, justCreatedMeasurementId);
      if (selectedEntityId === justCreatedMeasurementId) {
        selectedEntityId = null;
        selectedEntityType = null;
      }
      undidSomething = true;
    }
    if (pendingSnapshotBeforeClaim !== null) {
      // Restore exactly the array pendingPointIds held before this claim —
      // correct whether the claim only pushed one pending pick or completed
      // the measurement (finishPendingMeasurement reset it to empty).
      pendingPointIds = pendingSnapshotBeforeClaim;
    }
    scheduleRender();
    if (undidSomething) scheduleSave();
  }
  justCreatedPointId = null;
  pendingSnapshotBeforeClaim = null;
  justCreatedMeasurementId = null;
  draggingPointId = null;
  magnifierPointerType = null;
  hideMagnifier();
}

attachPointerGestures(canvas, {
  onZoomAt(viewAnchor, factor) {
    if (!image) return;
    viewport = zoomAt(viewport, viewAnchor, factor);
    scheduleRender();
  },
  onPanBy(dxView, dyView) {
    if (!image) return;
    viewport = panBy(viewport, dxView, dyView);
    scheduleRender();
  },
  onGestureEnd() {
    if (!image) return;
    viewport = clampToBounds(viewport, image.imageSize, cssSize());
    scheduleRender();
    ensureDetailForZoom();
  },
  onPointClaim,
  onPointDragMove,
  onPointDragEnd,
});

// pointerGestures' onGestureEnd only fires when a touch/pointer lifts — a
// wheel/trackpad zoom (its own "desktop testing" affordance, see that
// module's doc) never lifts a pointer, so it would otherwise never trigger a
// detail redecode. A short idle timer after the last wheel tick stands in
// for that missing "gesture end".
let wheelIdleTimer = null;
canvas.addEventListener('wheel', () => {
  clearTimeout(wheelIdleTimer);
  wheelIdleTimer = setTimeout(ensureDetailForZoom, 220);
}, { passive: true });

startOverButton.addEventListener('click', async () => {
  if (!confirm('Delete everything saved on this device (photos, points, measurements)? This cannot be undone.')) return;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  pendingSaveData = null;
  await clearAll();
  if (image?.displayBitmap) image.displayBitmap.close();
  image = null;
  project = createProject();
  viewport = createViewport();
  currentDetailLongestSide = MAX_DISPLAY_SIDE;
  selectedEntityId = null;
  selectedEntityType = null;
  pendingPointIds = [];
  clearError();
  storageBar.hidden = true;
  scheduleRender();
});

new ResizeObserver(resizeCanvas).observe(canvas);
resizeCanvas();
setupMagnifierCanvas();

// LOTE 3 §3: resume the last active project on load, one image at a time —
// only the active image's bitmap is ever rendered today (there is no
// switch-image UI yet, see db.js's module doc), so restoring just that one
// blob is all a startup actually needs.
async function restoreProject() {
  const data = await loadActiveProject();
  if (!data) return;
  let restored;
  try {
    restored = deserialize(data);
  } catch (err) {
    console.warn('angle-lab: saved project could not be restored', err);
    return;
  }
  project = restored;
  const activeImage = project.images.find((img) => img.id === project.activeImageId);
  if (!activeImage) return;
  const blob = await loadBlob(activeImage.id);
  if (!blob) return; // project metadata survived; its photo's Blob did not
  try {
    const { displayBitmap, imageSize, originalBlob } = await loadDisplayImage(blob);
    image = { displayBitmap, imageSize, originalBlob };
    currentDetailLongestSide = Math.max(displayBitmap.width, displayBitmap.height);
    fitToScreen();
  } catch (err) {
    showError(err.message);
  }
}

requestPersistence();
restoreProject().then(checkStorageHealth);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch((err) => console.warn('sw', err));
}
