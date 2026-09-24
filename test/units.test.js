import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  UNITS,
  isValidUnit,
  toMillimetres,
  fromMillimetres,
  convert,
  formatLength,
  formatAngle,
} from '../src/core/units.js';

const close = (actual, expected, tolerance = 1e-9) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${expected}, got ${actual} (diff ${Math.abs(actual - expected)})`,
  );
};

describe('isValidUnit', () => {
  test('accepts every known unit', () => {
    for (const unit of Object.keys(UNITS)) {
      assert.equal(isValidUnit(unit), true);
    }
  });

  test('rejects unknown units', () => {
    assert.equal(isValidUnit('ft'), false);
    assert.equal(isValidUnit(''), false);
    assert.equal(isValidUnit(undefined), false);
  });
});

describe('toMillimetres / fromMillimetres', () => {
  test('round-trip for every unit', () => {
    for (const unit of Object.keys(UNITS)) {
      close(fromMillimetres(toMillimetres(12.5, unit), unit), 12.5);
    }
  });

  test('NaN for an invalid unit', () => {
    assert.ok(Number.isNaN(toMillimetres(10, 'ft')));
    assert.ok(Number.isNaN(fromMillimetres(10, 'ft')));
  });

  test('1 cm is 10 mm, 1 m is 1000 mm, 1 in is 25.4 mm', () => {
    close(toMillimetres(1, 'cm'), 10);
    close(toMillimetres(1, 'm'), 1000);
    close(toMillimetres(1, 'in'), 25.4);
  });
});

describe('convert', () => {
  test('the spec example: 1 in to mm is 25.4', () => {
    close(convert(1, 'in', 'mm'), 25.4);
  });

  test('the spec example: 100 cm to m is 1', () => {
    close(convert(100, 'cm', 'm'), 1);
  });

  test('every pair-wise conversion round-trips', () => {
    const units = Object.keys(UNITS);
    for (const from of units) {
      for (const to of units) {
        close(convert(convert(10, from, to), to, from), 10, 1e-9);
      }
    }
  });

  test('same-unit conversion is the identity', () => {
    for (const unit of Object.keys(UNITS)) {
      close(convert(42, unit, unit), 42);
    }
  });

  test('NaN if either unit is invalid', () => {
    assert.ok(Number.isNaN(convert(1, 'ft', 'mm')));
    assert.ok(Number.isNaN(convert(1, 'mm', 'ft')));
  });
});

describe('formatLength', () => {
  test('rounds only for display', () => {
    assert.equal(formatLength(12.449, 'cm'), '12.4 cm');
    assert.equal(formatLength(12.45, 'cm', 0), '12 cm');
  });

  test('respects the decimals argument', () => {
    assert.equal(formatLength(1.23456, 'm', 3), '1.235 m');
  });

  // LOTE 2 audit: formatLength(NaN) used to print the literal string
  // "NaN cm" on screen — a degenerate measurement dressed up as a number.
  test('NaN renders as an em dash, not "NaN cm"', () => {
    assert.equal(formatLength(NaN, 'cm'), '—');
  });

  // LOTE 2 audit: formatAngle(Infinity) used to print "Infinity°"; the same
  // bug exists in formatLength for a distance between two coincident
  // calibration points (division by a zero pixel span).
  test('Infinity renders as an em dash, not "Infinity cm"', () => {
    assert.equal(formatLength(Infinity, 'cm'), '—');
    assert.equal(formatLength(-Infinity, 'cm'), '—');
  });
});

describe('formatAngle', () => {
  test('formats with the degree sign', () => {
    assert.equal(formatAngle(127.449), '127.4°');
  });

  test('NaN renders as an em dash', () => {
    assert.equal(formatAngle(NaN), '—');
  });

  // LOTE 2 audit: formatAngle only guarded against NaN, not Infinity — a
  // zero-length ray (angleAtVertex's own NaN guard aside, other paths can
  // still divide down to +-Infinity) used to print the literal "Infinity°".
  test('Infinity renders as an em dash, not "Infinity°"', () => {
    assert.equal(formatAngle(Infinity), '—');
    assert.equal(formatAngle(-Infinity), '—');
  });
});
