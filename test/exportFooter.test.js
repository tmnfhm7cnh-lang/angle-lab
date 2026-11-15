import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { footerLines } from '../src/core/exportFooter.js';

const base = {
  subjectCode: 'ATL-07',
  date: '2026-11-16',
  disclaimer: 'Angles projected on a single photo',
  more: (n) => `+${n} more`,
};

describe('footerLines', () => {
  test('header (subject · date), one line per measurement, and the disclaimer last', () => {
    const lines = footerLines({
      ...base,
      items: [
        { name: 'Left knee', value: '128.4°' },
        { name: 'Distance 1', value: '24.0 cm' },
      ],
    });
    assert.deepEqual(lines, [
      'ATL-07 · 2026-11-16',
      'Left knee — 128.4°',
      'Distance 1 — 24.0 cm',
      'Angles projected on a single photo',
    ]);
  });

  test('no measurements: header and disclaimer only', () => {
    assert.deepEqual(footerLines({ ...base, items: [] }), ['ATL-07 · 2026-11-16', 'Angles projected on a single photo']);
  });

  test('an empty subject code shows the date alone, never a dangling separator', () => {
    const lines = footerLines({ ...base, subjectCode: '', items: [] });
    assert.equal(lines[0], '2026-11-16');
  });

  test('more than maxItems collapses the tail into one "+n more" line', () => {
    const items = Array.from({ length: 7 }, (_, i) => ({ name: `M${i + 1}`, value: `${i}°` }));
    const lines = footerLines({ ...base, items, maxItems: 4 });
    assert.deepEqual(lines.slice(1, -1), ['M1 — 0°', 'M2 — 1°', 'M3 — 2°', '+4 more']);
  });

  test('exactly maxItems measurements are all shown', () => {
    const items = Array.from({ length: 4 }, (_, i) => ({ name: `M${i + 1}`, value: `${i}°` }));
    const lines = footerLines({ ...base, items, maxItems: 4 });
    assert.equal(lines.length, 1 + 4 + 1);
    assert.ok(!lines.some((l) => l.includes('more')));
  });
});
