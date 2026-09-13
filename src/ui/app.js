import { createViewport, fitImage, zoomAt, panBy, clampToBounds, viewToImage, viewToImageLength } from '../core/viewport.js';
import { loadDisplayImage } from '../render/imageLoader.js';
import { resizeCanvasBackingStore, renderFrame, renderMagnifierFrame } from '../render/canvasRenderer.js';
import { attachPointerGestures } from './pointerGestures.js';
import { createProject, addImage, addPoint, movePoint, removePoint } from '../core/model.js';
import { hitTest } from '../core/hittest.js';

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
const deletePointButton = document.getElementById('delete-point-button');
const magnifierCanvas = document.getElementById('magnifier');
const magnifierCtx = magnifierCanvas.getContext('2d');

let image = null;
let viewport = createViewport();
let dpr = 1;
let magnifierDpr = 1;
let renderScheduled = false;

let project = createProject();
let mode = 'select'; // 'select' | 'point' — F5 adds 'line' | 'angle' | 'distance' to this list.
let selectedPointId = null;
let draggingPointId = null;
let magnifierPointerType = null;

function cssSize() {
  const rect = canvas.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

function activePoints() {
  if (!project.activeImageId) return [];
  return project.points.filter((p) => p.imageId === project.activeImageId);
}

function scheduleRender() {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    renderFrame(ctx, dpr, cssSize(), viewport, image, {
      points: activePoints(),
      selectedPointId,
    });
    zoomReadout.textContent = `${Math.round(viewport.scale * 100)}%`;
    deletePointButton.disabled = !selectedPointId;
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
  const { displayBitmap, imageSize } = await loadDisplayImage(file);
  image = { displayBitmap, imageSize };
  const imageRef = addImage(project, {
    blobKey: file.name || 'local',
    width: imageSize.width,
    height: imageSize.height,
  });
  project.activeImageId = imageRef.id;
  selectedPointId = null;
  fitToScreen();
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
  for (const button of toolButtons) {
    button.classList.toggle('active', button.dataset.tool === mode);
  }
}

for (const button of toolButtons) {
  button.addEventListener('click', () => setMode(button.dataset.tool));
}
setMode(mode);

function deleteSelectedPoint() {
  if (!selectedPointId) return;
  removePoint(project, selectedPointId);
  selectedPointId = null;
  scheduleRender();
}

deletePointButton.addEventListener('click', deleteSelectedPoint);

window.addEventListener('keydown', (event) => {
  if (event.key !== 'Delete' && event.key !== 'Backspace') return;
  if (!selectedPointId) return;
  event.preventDefault();
  deleteSelectedPoint();
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
function onPointClaim(viewPoint, event) {
  if (!image || !project.activeImageId) return false;
  const imagePoint = viewToImage(viewPoint, viewport);

  if (mode === 'point') {
    const created = addPoint(project, {
      imageId: project.activeImageId,
      x: imagePoint.x,
      y: imagePoint.y,
    });
    selectedPointId = created.id;
    scheduleRender();
    return true;
  }

  // SELECT mode: hit-test in image space, tolerance converted from a
  // constant view-space radius (spec §4) so it is never impossible to hit a
  // point at high zoom nor ambiguous at low zoom.
  const toleranceImage = viewToImageLength(TOUCH_RADIUS_CSS_PX, viewport);
  const hit = hitTest(project, imagePoint, toleranceImage, project.activeImageId);

  if (hit && hit.type === 'point') {
    selectedPointId = hit.id;
    draggingPointId = hit.id;
    magnifierPointerType = event.pointerType;
    if (event.pointerType !== 'pen') showMagnifierAt(viewPoint, imagePoint);
    scheduleRender();
    return true;
  }

  selectedPointId = null;
  scheduleRender();
  return false;
}

function onPointDragMove(viewPoint) {
  if (!draggingPointId) return;
  const imagePoint = viewToImage(viewPoint, viewport);
  movePoint(project, draggingPointId, imagePoint.x, imagePoint.y);
  if (magnifierPointerType !== 'pen') showMagnifierAt(viewPoint, imagePoint);
  scheduleRender();
}

function onPointDragEnd() {
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
  },
  onPointClaim,
  onPointDragMove,
  onPointDragEnd,
});

new ResizeObserver(resizeCanvas).observe(canvas);
resizeCanvas();
setupMagnifierCanvas();

// Exposed for verification only (used by the JS console during manual and
// automated testing); not part of the app's public surface, and removable
// before ship.
window.__angleLab = {
  getViewport: () => viewport,
  viewToImage: (p) => viewToImage(p, viewport),
  getImage: () => image,
  getProject: () => project,
  getSelectedPointId: () => selectedPointId,
  getMode: () => mode,
  // Test-only: loads a synthetic Blob through the normal loadFile path,
  // standing in for the file-input picker that automated tools cannot drive.
  loadBlob: (blob) => loadFile(blob),
  // Test-only: exercises the magnifier's own show/position/draw path
  // directly, since a real pointer drag cannot be scripted (setPointerCapture
  // rejects synthetic PointerEvents, and left_click_drag is atomic).
  testShowMagnifier: (viewPoint, imagePoint) => showMagnifierAt(viewPoint, imagePoint),
  testHideMagnifier: () => hideMagnifier(),
};
