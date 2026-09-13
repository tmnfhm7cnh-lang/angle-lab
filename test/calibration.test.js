import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  millimetresPerPixel,
  pixelsToReal,
  realToPixels,
  isCalibrated,
} from '../src/core/calibration.js';

const close = (actual, expected, tolerance = 1e-9) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${expected}, got ${actual} (diff ${Math.abs(actual - expected)})`,
  );
};

describe('millimetresPerPixel', () => {
  test('the spec example: 100 cm over 734 px', () => {
    close(millimetresPerPixel(100, 'cm', 734), 1000 / 734);
  });

  test('NaN for zero or negative pixel length', () => {
    assert.ok(Number.isNaN(millimetresPerPixel(100, 'cm', 0)));
    assert.ok(Number.isNaN(millimetresPerPixel(100, 'cm', -10)));
  });

  test('NaN for zero or negative real length', () => {
    assert.ok(Number.isNaN(millimetresPerPixel(0, 'cm', 734)));
    assert.ok(Number.isNaN(millimetresPerPixel(-5, 'cm', 734)));
  });

  test('NaN for an invalid unit', () => {
    assert.ok(Number.isNaN(millimetresPerPixel(100, 'ft', 734)));
  });
});

describe('pixelsToReal', () => {
  test('the spec example: a 367 px segment reads 50 cm under the 100cm/734px scale', () => {
    const mmPerPixel = millimetresPerPixel(100, 'cm', 734);
    close(pixelsToReal(367, mmPerPixel, 'cm'), 50, 1e-6);
  });

  test('NaN when uncalibrated', () => {
    assert.ok(Number.isNaN(pixelsToReal(100, NaN, 'cm')));
    assert.ok(Number.isNaN(pixelsToReal(100, 0, 'cm')));
    assert.ok(Number.isNaN(pixelsToReal(100, -1, 'cm')));
  });

  test('gives consistent results across units', () => {
    const mmPerPixel = millimetresPerPixel(1, 'm', 500);
    const cm = pixelsToReal(250, mmPerPixel, 'cm');
    const mm = pixelsToReal(250, mmPerPixel, 'mm');
    const inch = pixelsToReal(250, mmPerPixel, 'in');
    close(mm, cm * 10, 1e-9);
    close(inch, mm / 25.4, 1e-9);
  });
});

describe('realToPixels', () => {
  test('round-trips with pixelsToReal', () => {
    const mmPerPixel = millimetresPerPixel(100, 'cm', 734);
    const pixels = 367;
    const real = pixelsToReal(pixels, mmPerPixel, 'cm');
    close(realToPixels(real, 'cm', mmPerPixel), pixels, 1e-6);
  });

  test('NaN when uncalibrated', () => {
    assert.ok(Number.isNaN(realToPixels(50, 'cm', NaN)));
  });
});

describe('isCalibrated', () => {
  test('true for a finite positive scale', () => {
    assert.equal(isCalibrated(1.5), true);
  });

  test('false for NaN, zero, negative or infinite', () => {
    assert.equal(isCalibrated(NaN), false);
    assert.equal(isCalibrated(0), false);
    assert.equal(isCalibrated(-1), false);
    assert.equal(isCalibrated(Infinity), false);
  });
});

describe('accuracy at extreme scales', () => {
  test('very large real length over a small pixel span', () => {
    const mmPerPixel = millimetresPerPixel(1000, 'm', 2);
    close(pixelsToReal(2, mmPerPixel, 'm'), 1000, 1e-6);
  });

  test('very small real length over a large pixel span', () => {
    const mmPerPixel = millimetresPerPixel(0.5, 'mm', 100000);
    close(pixelsToReal(100000, mmPerPixel, 'mm'), 0.5, 1e-9);
  });
});
