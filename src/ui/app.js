import { createViewport, fitImage, zoomAt, panBy, clampToBounds, viewToImage } from '../core/viewport.js';
import { loadDisplayImage } from '../render/imageLoader.js';
import { resizeCanvasBackingStore, renderFrame } from '../render/canvasRenderer.js';
import { attachPointerGestures } from './pointerGestures.js';

const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');
const fileInput = document.getElementById('file-input');
const cameraInput = document.getElementById('camera-input');
const fitButton = document.getElementById('fit-button');
const zoomReadout = document.getElementById('zoom-readout');

let image = null;
let viewport = createViewport();
let dpr = 1;
let renderScheduled = false;

function cssSize() {
  const rect = canvas.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

function scheduleRender() {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    renderFrame(ctx, dpr, cssSize(), viewport, image);
    zoomReadout.textContent = `${Math.round(viewport.scale * 100)}%`;
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
});

new ResizeObserver(resizeCanvas).observe(canvas);
resizeCanvas();

// Exposed for verification only (used by the JS console during manual and
// automated testing of zoom-anchor invariance); not part of the app's
// public surface.
window.__angleLab = {
  getViewport: () => viewport,
  viewToImage: (p) => viewToImage(p, viewport),
  getImage: () => image,
};
