import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  createViewport,
  imageToView,
  viewToImage,
  imageToViewLength,
  viewToImageLength,
  fitImage,
  zoomAt,
  panBy,
  clampToBounds,
} from '../src/core/viewport.js';

const close = (actual, expected, tolerance = 1e-9) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${expected}, got ${actual} (diff ${Math.abs(actual - expected)})`,
  );
};

const closePoint = (actual, expected, tolerance = 1e-9) => {
  close(actual.x, expected.x, tolerance);
  close(actual.y, expected.y, tolerance);
};

describe('createViewport', () => {
  test('defaults to identity', () => {
    const vp = createViewport();
    assert.deepEqual(vp, { scale: 1, tx: 0, ty: 0, rotation: 0 });
  });

  test('accepts explicit values', () => {
    const vp = createViewport({ scale: 2, tx: 10, ty: -5, rotation: 15 });
    assert.deepEqual(vp, { scale: 2, tx: 10, ty: -5, rotation: 15 });
  });
});

describe('imageToView / viewToImage round-trip', () => {
  const cases = [
    createViewport(),
    createViewport({ scale: 2.5, tx: 100, ty: -50 }),
    createViewport({ scale: 0.3, tx: -200, ty: 300 }),
    createViewport({ scale: 1, tx: 0, ty: 0, rotation: 37 }),
    createViewport({ scale: 4.2, tx: -12.5, ty: 88.8, rotation: -90 }),
    createViewport({ scale: 0.05, tx: 0, ty: 0, rotation: 180 }),
  ];

  const points = [
    { x: 0, y: 0 },
    { x: 100, y: 200 },
    { x: -50, y: -75 },
    { x: 1234.5, y: -987.6 },
    { x: -0.001, y: 0.001 },
  ];

  for (const vp of cases) {
    for (const p of points) {
      test(`vp=${JSON.stringify(vp)} p=${JSON.stringify(p)}`, () => {
        const view = imageToView(p, vp);
        const back = viewToImage(view, vp);
        closePoint(back, p, 1e-7);
      });
    }
  }

  test('identity viewport is a no-op both ways', () => {
    const vp = createViewport();
    const p = { x: 42, y: -17 };
    closePoint(imageToView(p, vp), p);
    closePoint(viewToImage(p, vp), p);
  });
});

describe('non-zero rotation is handled correctly', () => {
  test('a 90 degree rotation maps image-right to view-down or view-up consistently', () => {
    const vp = createViewport({ scale: 1, tx: 0, ty: 0, rotation: 90 });
    const view = imageToView({ x: 10, y: 0 }, vp);
    close(magnitudeOf(view), 10, 1e-9);
    closePoint(viewToImage(view, vp), { x: 10, y: 0 }, 1e-9);
  });

  function magnitudeOf(v) {
    return Math.hypot(v.x, v.y);
  }

  test('rotation preserves distances from the origin', () => {
    const vp = createViewport({ scale: 2, tx: 5, ty: 5, rotation: 33.7 });
    const origin = imageToView({ x: 0, y: 0 }, vp);
    const p = imageToView({ x: 7, y: -3 }, vp);
    const dx = p.x - origin.x;
    const dy = p.y - origin.y;
    close(Math.hypot(dx, dy), Math.hypot(7, -3) * vp.scale, 1e-9);
  });
});

describe('imageToViewLength / viewToImageLength', () => {
  test('scale a length by the viewport scale', () => {
    const vp = createViewport({ scale: 3 });
    close(imageToViewLength(10, vp), 30);
    close(viewToImageLength(30, vp), 10);
  });

  test('round-trip', () => {
    const vp = createViewport({ scale: 0.37 });
    close(viewToImageLength(imageToViewLength(22, vp), vp), 22, 1e-9);
  });

  test('match the point transform for an axis-aligned segment', () => {
    const vp = createViewport({ scale: 2.5, tx: 10, ty: 20 });
    const a = imageToView({ x: 0, y: 0 }, vp);
    const b = imageToView({ x: 40, y: 0 }, vp);
    const viaPoints = Math.hypot(b.x - a.x, b.y - a.y);
    close(viaPoints, imageToViewLength(40, vp), 1e-9);
  });
});

describe('fitImage', () => {
  test('centres a wide image in a tall viewport', () => {
    const vp = fitImage({ width: 2000, height: 500 }, { width: 800, height: 800 });
    close(vp.scale, 800 / 2000);
    const topLeft = imageToView({ x: 0, y: 0 }, vp);
    const bottomRight = imageToView({ x: 2000, y: 500 }, vp);
    close(topLeft.x, 0, 1e-9);
    close(bottomRight.x, 800, 1e-9);
    const usedHeight = bottomRight.y - topLeft.y;
    close(topLeft.y, (800 - usedHeight) / 2, 1e-9);
  });

  test('centres a tall image in a wide viewport', () => {
    const vp = fitImage({ width: 500, height: 2000 }, { width: 800, height: 800 });
    close(vp.scale, 800 / 2000);
    const topLeft = imageToView({ x: 0, y: 0 }, vp);
    const bottomRight = imageToView({ x: 500, y: 2000 }, vp);
    close(topLeft.y, 0, 1e-9);
    close(bottomRight.y, 800, 1e-9);
    const usedWidth = bottomRight.x - topLeft.x;
    close(topLeft.x, (800 - usedWidth) / 2, 1e-9);
  });

  test('respects padding', () => {
    const vp = fitImage({ width: 1000, height: 1000 }, { width: 1000, height: 1000 }, 100);
    close(vp.scale, 800 / 1000);
  });

  test('rotation defaults to 0', () => {
    const vp = fitImage({ width: 100, height: 100 }, { width: 200, height: 200 });
    assert.equal(vp.rotation, 0);
  });
});

describe('zoomAt anchor invariance — the critical test', () => {
  test('the image point under the anchor does not move', () => {
    const vp = createViewport({ scale: 1.7, tx: 33, ty: -12 });
    const anchor = { x: 250, y: 400 };
    const before = viewToImage(anchor, vp);
    const after = viewToImage(anchor, zoomAt(vp, anchor, 2.5));
    closePoint(after, before, 1e-9);
  });

  test('holds for a large zoom-out too', () => {
    const vp = createViewport({ scale: 5, tx: -80, ty: 60 });
    const anchor = { x: 10, y: 900 };
    const before = viewToImage(anchor, vp);
    const after = viewToImage(anchor, zoomAt(vp, anchor, 0.1));
    closePoint(after, before, 1e-9);
  });

  test('holds with non-zero rotation', () => {
    const vp = createViewport({ scale: 1, tx: 0, ty: 0, rotation: 42 });
    const anchor = { x: 150, y: -75 };
    const before = viewToImage(anchor, vp);
    const after = viewToImage(anchor, zoomAt(vp, anchor, 3));
    closePoint(after, before, 1e-9);
  });

  test('holds across many anchors and factors', () => {
    const vp = createViewport({ scale: 0.8, tx: 12, ty: 34 });
    const anchors = [
      { x: 0, y: 0 },
      { x: 500, y: 500 },
      { x: -20, y: 300 },
      { x: 999.25, y: -14.5 },
    ];
    const factors = [0.5, 1, 1.001, 4, 10];
    for (const anchor of anchors) {
      for (const factor of factors) {
        const before = viewToImage(anchor, vp);
        const after = viewToImage(anchor, zoomAt(vp, anchor, factor));
        closePoint(after, before, 1e-9);
      }
    }
  });

  test('respects minScale', () => {
    const vp = createViewport({ scale: 1 });
    const zoomed = zoomAt(vp, { x: 0, y: 0 }, 0.001, { minScale: 0.2, maxScale: 10 });
    close(zoomed.scale, 0.2);
  });

  test('respects maxScale', () => {
    const vp = createViewport({ scale: 1 });
    const zoomed = zoomAt(vp, { x: 0, y: 0 }, 1000, { minScale: 0.05, maxScale: 15 });
    close(zoomed.scale, 15);
  });

  test('anchor invariance still holds when clamped against minScale', () => {
    const vp = createViewport({ scale: 1, tx: 20, ty: 20 });
    const anchor = { x: 60, y: 40 };
    const before = viewToImage(anchor, vp);
    const after = viewToImage(anchor, zoomAt(vp, anchor, 0.001, { minScale: 0.2, maxScale: 10 }));
    closePoint(after, before, 1e-9);
  });
});

describe('panBy', () => {
  test('moves by exactly the requested view distance, regardless of scale', () => {
    for (const scale of [0.2, 1, 7.5]) {
      const vp = createViewport({ scale, tx: 5, ty: 5 });
      const panned = panBy(vp, 30, -20);
      close(panned.tx, vp.tx + 30);
      close(panned.ty, vp.ty - 20);
      close(panned.scale, vp.scale);
    }
  });

  test('a point shifts by the pan amount in view space', () => {
    const vp = createViewport({ scale: 2 });
    const p = { x: 10, y: 10 };
    const before = imageToView(p, vp);
    const after = imageToView(p, panBy(vp, 15, 25));
    close(after.x - before.x, 15);
    close(after.y - before.y, 25);
  });
});

describe('clampToBounds', () => {
  test('leaves an in-bounds viewport untouched', () => {
    const vp = fitImage({ width: 1000, height: 1000 }, { width: 800, height: 800 });
    const clamped = clampToBounds(vp, { width: 1000, height: 1000 }, { width: 800, height: 800 });
    close(clamped.tx, vp.tx, 1e-9);
    close(clamped.ty, vp.ty, 1e-9);
  });

  test('pulls back a viewport panned far off to one side', () => {
    const vp = createViewport({ scale: 1, tx: -100000, ty: 0 });
    const imageSize = { width: 500, height: 500 };
    const viewSize = { width: 800, height: 800 };
    const clamped = clampToBounds(vp, imageSize, viewSize, 40);
    const corners = [
      imageToView({ x: 0, y: 0 }, clamped),
      imageToView({ x: imageSize.width, y: imageSize.height }, clamped),
    ];
    const maxX = Math.max(...corners.map((c) => c.x));
    assert.ok(maxX >= 40, `expected some part of the image visible, maxX=${maxX}`);
  });

  test('pulls back a viewport panned far off vertically', () => {
    const vp = createViewport({ scale: 1, tx: 0, ty: 100000 });
    const imageSize = { width: 500, height: 500 };
    const viewSize = { width: 800, height: 800 };
    const clamped = clampToBounds(vp, imageSize, viewSize, 40);
    const corners = [
      imageToView({ x: 0, y: 0 }, clamped),
      imageToView({ x: imageSize.width, y: imageSize.height }, clamped),
    ];
    const minY = Math.min(...corners.map((c) => c.y));
    assert.ok(minY <= viewSize.height - 40, `expected some part visible, minY=${minY}`);
  });
});
