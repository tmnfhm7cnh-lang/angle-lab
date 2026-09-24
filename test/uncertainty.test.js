import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLACEMENT_ERROR_VIEW_PX,
  pointPlacementErrorImagePx,
  angleUncertaintyDegrees,
  distanceUncertaintyPixels,
  decimalsForSigma,
  qualityForSigma,
  repeatabilityStats,
} from '../src/core/uncertainty.js';

const close = (actual, expected, tolerance = 1e-2) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${expected}, got ${actual} (diff ${Math.abs(actual - expected)})`,
  );
};

describe('pointPlacementErrorImagePx', () => {
  test('a point placed at scale 1 (1 view px = 1 image px) has the raw finger error', () => {
    const p = { placementScale: 1 };
    assert.equal(pointPlacementErrorImagePx(p), PLACEMENT_ERROR_VIEW_PX);
  });

  test('placed more zoomed in (higher scale), the same finger covers fewer image pixels', () => {
    const zoomedIn = { placementScale: 6 };
    close(pointPlacementErrorImagePx(zoomedIn), PLACEMENT_ERROR_VIEW_PX / 6, 1e-9);
  });

  test('missing or invalid placementScale falls back to 1, not to 0 or a crash', () => {
    assert.equal(pointPlacementErrorImagePx({}), PLACEMENT_ERROR_VIEW_PX);
    assert.equal(pointPlacementErrorImagePx({ placementScale: 0 }), PLACEMENT_ERROR_VIEW_PX);
    assert.equal(pointPlacementErrorImagePx({ placementScale: -2 }), PLACEMENT_ERROR_VIEW_PX);
    assert.equal(pointPlacementErrorImagePx({ placementScale: NaN }), PLACEMENT_ERROR_VIEW_PX);
    assert.equal(pointPlacementErrorImagePx(null), PLACEMENT_ERROR_VIEW_PX);
  });
});

// The audit's own worked numbers: moving a ray's endpoint by exactly one
// image pixel changes the vertex angle by (180/pi)/rayLengthPx degrees.
// placementScale = PLACEMENT_ERROR_VIEW_PX makes the per-point error exactly
// 1 image pixel, isolating that relationship from the finger-error constant.
describe('angleUncertaintyDegrees — matches the audit\'s per-pixel sensitivity', () => {
  test('a 400 px ray: ~0.14 degrees', () => {
    const vertex = { x: 0, y: 0, placementScale: oneCommonPixelErrorScale() };
    const a = { x: 400, y: 0, placementScale: oneCommonPixelErrorScale() };
    const c = { x: 0, y: 400, placementScale: oneCommonPixelErrorScale() };
    close(angleUncertaintyDegrees(a, vertex, c), 0.14, 5e-3);
  });

  test('a 100 px ray: ~0.57 degrees', () => {
    const vertex = { x: 0, y: 0, placementScale: oneCommonPixelErrorScale() };
    const a = { x: 100, y: 0, placementScale: oneCommonPixelErrorScale() };
    const c = { x: 0, y: 400, placementScale: oneCommonPixelErrorScale() };
    close(angleUncertaintyDegrees(a, vertex, c), 0.57, 5e-3);
  });

  test('a 25 px ray: ~2.29 degrees', () => {
    const vertex = { x: 0, y: 0, placementScale: oneCommonPixelErrorScale() };
    const a = { x: 25, y: 0, placementScale: oneCommonPixelErrorScale() };
    const c = { x: 0, y: 400, placementScale: oneCommonPixelErrorScale() };
    close(angleUncertaintyDegrees(a, vertex, c), 2.29, 5e-3);
  });

  test('is driven by the shorter of the two rays, not the longer', () => {
    const vertex = { x: 0, y: 0, placementScale: oneCommonPixelErrorScale() };
    const a = { x: 10000, y: 0, placementScale: oneCommonPixelErrorScale() };
    const c = { x: 0, y: 25, placementScale: oneCommonPixelErrorScale() };
    close(angleUncertaintyDegrees(a, vertex, c), 2.29, 5e-3);
  });

  function oneCommonPixelErrorScale() {
    return PLACEMENT_ERROR_VIEW_PX; // errorPx = PLACEMENT_ERROR_VIEW_PX / scale = 1
  }

  test('the audit\'s realistic example: a 4032 px photo fit to screen (scale ~1/11), 800 px muslo -> ~2.4 degrees', () => {
    const scale = 1 / 11;
    const vertex = { x: 0, y: 0, placementScale: scale };
    const a = { x: 800, y: 0, placementScale: scale };
    const c = { x: 0, y: 2000, placementScale: scale };
    close(angleUncertaintyDegrees(a, vertex, c), 2.4, 0.1);
  });

  test('degenerate ray (coincident vertex and endpoint) is infinitely uncertain, not NaN or a crash', () => {
    const vertex = { x: 5, y: 5, placementScale: 1 };
    const a = { x: 5, y: 5, placementScale: 1 };
    const c = { x: 5, y: 500, placementScale: 1 };
    assert.equal(angleUncertaintyDegrees(a, vertex, c), Infinity);
  });
});

describe('distanceUncertaintyPixels', () => {
  test('two points placed at the same scale combine in quadrature', () => {
    const a = { placementScale: 1 };
    const b = { placementScale: 1 };
    close(distanceUncertaintyPixels(a, b), PLACEMENT_ERROR_VIEW_PX * Math.SQRT2, 1e-9);
  });

  test('is worse (larger) when either point was placed more zoomed out', () => {
    const zoomedIn = distanceUncertaintyPixels({ placementScale: 5 }, { placementScale: 5 });
    const zoomedOut = distanceUncertaintyPixels({ placementScale: 5 }, { placementScale: 0.5 });
    assert.ok(zoomedOut > zoomedIn);
  });
});

describe('decimalsForSigma', () => {
  test('a well-placed angle (sigma <= 0.05) gets 2 decimals', () => {
    assert.equal(decimalsForSigma(0.02), 2);
  });

  test('a merely fine angle (0.05 < sigma <= 0.5) gets 1 decimal — today\'s default', () => {
    assert.equal(decimalsForSigma(0.14), 1);
  });

  test('a coarse angle (sigma > 0.5, the audit\'s own threshold) gets integer degrees', () => {
    assert.equal(decimalsForSigma(2.29), 0);
    assert.equal(decimalsForSigma(0.51), 0);
  });

  test('an unknown sigma (NaN/Infinity) falls back to the current fixed default of 1', () => {
    assert.equal(decimalsForSigma(NaN), 1);
    assert.equal(decimalsForSigma(Infinity), 1);
  });
});

describe('qualityForSigma', () => {
  test('good below the fine threshold, with no suggested action', () => {
    const q = qualityForSigma(0.2);
    assert.equal(q.level, 'good');
    assert.equal(q.action, null);
  });

  test('ok in the middle band, with a zoom-in suggestion', () => {
    const q = qualityForSigma(1);
    assert.equal(q.level, 'ok');
    assert.ok(q.action);
  });

  test('poor above the ok threshold', () => {
    const q = qualityForSigma(5);
    assert.equal(q.level, 'poor');
  });

  test('a non-finite sigma (degenerate geometry) is poor, not a crash', () => {
    const q = qualityForSigma(Infinity);
    assert.equal(q.level, 'poor');
  });
});

describe('repeatabilityStats', () => {
  test('three identical taps have zero dispersion', () => {
    const stats = repeatabilityStats([{ x: 10, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 10 }]);
    assert.equal(stats.maxDeviationPx, 0);
    assert.equal(stats.rmsPx, 0);
  });

  test('three taps spread on a line report the mean and the right dispersion', () => {
    const stats = repeatabilityStats([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }]);
    assert.equal(stats.mean.x, 10);
    assert.equal(stats.mean.y, 0);
    assert.equal(stats.maxDeviationPx, 10);
  });

  test('fewer than two points is not a meaningful dispersion', () => {
    assert.equal(repeatabilityStats([{ x: 0, y: 0 }]), null);
    assert.equal(repeatabilityStats([]), null);
  });
});
