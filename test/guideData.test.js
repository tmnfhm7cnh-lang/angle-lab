import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { GUIDES, GUIDES_WITH_EXTRA } from '../src/export/guides.js';
import { hasOwnKey } from '../src/i18n/strings.js';

describe('the four measurement guides', () => {
  test('are handstand, bridge, front split and side split', () => {
    assert.deepEqual(GUIDES.map((g) => g.id), ['handstand', 'bridge', 'split_front', 'split_side']);
  });

  test('every plan only uses landmarks of its own guide, and every landmark is used', () => {
    for (const guide of GUIDES) {
      const ids = guide.landmarks.map((l) => l.id);
      assert.equal(new Set(ids).size, ids.length, `${guide.id} repeats a landmark`);
      const used = new Set();
      for (const plan of guide.plans) {
        const roles = plan.kind === 'angle' ? [plan.a, plan.vertex, plan.c] : [plan.a, plan.b];
        for (const role of roles) {
          assert.ok(ids.includes(role), `${guide.id}: plan ${plan.key} uses unknown landmark ${role}`);
          used.add(role);
        }
      }
      for (const id of ids) assert.ok(used.has(id), `${guide.id}: landmark ${id} feeds no plan`);
    }
  });

  test('each plan builds a plain three-point angle (no new measurement kind)', () => {
    for (const guide of GUIDES) {
      for (const plan of guide.plans) assert.equal(plan.kind, 'angle');
    }
  });

  test('every text they need exists in English and in Spanish', () => {
    for (const lang of ['en', 'es']) {
      const need = [];
      for (const guide of GUIDES) {
        need.push(`guide.${guide.id}`, `guide.${guide.id}.camera`, `guide.${guide.id}.read`);
        if (GUIDES_WITH_EXTRA.includes(guide.id)) need.push(`guide.${guide.id}.extra`);
        for (const landmark of guide.landmarks) need.push(`landmark.${landmark.id}`, `landmark.${landmark.id}.where`);
        for (const plan of guide.plans) need.push(`measure.${plan.key}`);
      }
      for (const key of need) assert.ok(hasOwnKey(lang, key), `${lang} is missing "${key}"`);
    }
  });

  test('no guide data carries visible text of its own, and none names a club or battery', () => {
    const json = JSON.stringify(GUIDES);
    assert.ok(!/label/i.test(json));
    assert.ok(!/aquamad|seco|bater/i.test(json));
  });
});
