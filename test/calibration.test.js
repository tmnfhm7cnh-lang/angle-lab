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

describe('independent measurement conversion across units, two calibration setups', () => {
  // Two distinct calibrations (100px=100cm and 500px=100cm) each applied to a THIRD,
  // independent pixel measurement (300px, unrelated to either reference length), checked
  // against a value computed independently here (300 * mmPerPixel, converted by hand) rather
  // than by round-tripping pixelsToReal/realToPixels against each other.
  test('100 px = 100 cm: a 300 px measurement converts correctly to mm, cm, m, in', () => {
    const mmPerPixel = millimetresPerPixel(100, 'cm', 100); // 10 mm/px
    close(pixelsToReal(300, mmPerPixel, 'mm'), 3000, 1e-9);
    close(pixelsToReal(300, mmPerPixel, 'cm'), 300, 1e-9);
    close(pixelsToReal(300, mmPerPixel, 'm'), 3, 1e-9);
    close(pixelsToReal(300, mmPerPixel, 'in'), 3000 / 25.4, 1e-9);
  });

  test('500 px = 100 cm: a 300 px measurement converts correctly to mm, cm, m, in', () => {
    const mmPerPixel = millimetresPerPixel(100, 'cm', 500); // 2 mm/px
    close(pixelsToReal(300, mmPerPixel, 'mm'), 600, 1e-9);
    close(pixelsToReal(300, mmPerPixel, 'cm'), 60, 1e-9);
    close(pixelsToReal(300, mmPerPixel, 'm'), 0.6, 1e-9);
    close(pixelsToReal(300, mmPerPixel, 'in'), 600 / 25.4, 1e-9);
  });
});

describe('near-degenerate and very large calibration references', () => {
  test('a 2 px reference still calibrates and reports a sane, invertible scale', () => {
    const mmPerPixel = millimetresPerPixel(50, 'cm', 2);
    assert.ok(isCalibrated(mmPerPixel));
    close(mmPerPixel, 250);
    close(pixelsToReal(2, mmPerPixel, 'cm'), 50, 1e-9);
  });

  test('a 1 px reference still calibrates (the smallest non-degenerate span)', () => {
    const mmPerPixel = millimetresPerPixel(10, 'cm', 1);
    assert.ok(isCalibrated(mmPerPixel));
    close(pixelsToReal(1, mmPerPixel, 'cm'), 10, 1e-9);
  });

  test('a 10000 px reference calibrates and reports a sane, invertible scale', () => {
    const mmPerPixel = millimetresPerPixel(200, 'cm', 10000);
    assert.ok(isCalibrated(mmPerPixel));
    close(mmPerPixel, 0.2);
    close(pixelsToReal(10000, mmPerPixel, 'cm'), 200, 1e-9);
  });
});

describe('round-trip precision across the scale range', () => {
  test('pixelsToReal(realToPixels(x)) recovers x for reference spans from 2 px to 1e6 px', () => {
    for (const refPixels of [2, 100, 500, 10000, 1e6]) {
      const mmPerPixel = millimetresPerPixel(37.5, 'cm', refPixels);
      const probePixels = refPixels * 1.3;
      const real = pixelsToReal(probePixels, mmPerPixel, 'cm');
      const back = realToPixels(real, 'cm', mmPerPixel);
      close(back, probePixels, 1e-6);
    }
  });

  test('realToPixels(pixelsToReal(x)) recovers x for reference spans from 2 px to 1e6 px', () => {
    for (const refPixels of [2, 100, 500, 10000, 1e6]) {
      const mmPerPixel = millimetresPerPixel(37.5, 'cm', refPixels);
      const probeReal = 12.34;
      const pixels = realToPixels(probeReal, 'cm', mmPerPixel);
      const back = pixelsToReal(pixels, mmPerPixel, 'cm');
      close(back, probeReal, 1e-6);
    }
  });
});

describe('calibration.js is a pure function of its two live arguments', () => {
  // calibration.js keeps no state of its own (see module docstring): every call recomputes
  // the scale from whatever (realLength, unit, pixelLength) it is given. This test does not
  // exercise point-dragging or the app's model layer (out of scope here) - it only confirms
  // the pure-function contract this module promises, which is the precondition anything
  // upstream needs in order to re-derive calibration when a reference point moves.
  test('recomputing with a new pixelLength (as if a reference point moved) changes the scale accordingly', () => {
    const original = millimetresPerPixel(100, 'cm', 500);
    const afterMove = millimetresPerPixel(100, 'cm', 250);
    close(afterMove, original * 2, 1e-9);
    assert.notEqual(original, afterMove);
  });
});
