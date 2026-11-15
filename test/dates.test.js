import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { localDateISO, addDays } from '../src/core/dates.js';

describe('localDateISO', () => {
  test('uses the local calendar day, not UTC (00:30 local is still that local day)', () => {
    assert.equal(localDateISO(new Date(2026, 10, 16, 0, 30)), '2026-11-16');
  });

  test('late evening local stays on the same local day', () => {
    assert.equal(localDateISO(new Date(2026, 10, 16, 23, 59)), '2026-11-16');
  });

  test('zero-pads month and day', () => {
    assert.equal(localDateISO(new Date(2026, 0, 5, 12, 0)), '2026-01-05');
  });

  test('defaults to now', () => {
    assert.match(localDateISO(), /^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('addDays', () => {
  test('adds days across a month boundary without mutating the input', () => {
    const start = new Date(2026, 10, 16, 0, 30);
    const later = addDays(start, 30);
    assert.equal(localDateISO(later), '2026-12-16');
    assert.equal(localDateISO(start), '2026-11-16');
  });

  test('crosses a year boundary and accepts negative n', () => {
    assert.equal(localDateISO(addDays(new Date(2026, 11, 20), 15)), '2027-01-04');
    assert.equal(localDateISO(addDays(new Date(2026, 0, 3), -5)), '2025-12-29');
  });
});
