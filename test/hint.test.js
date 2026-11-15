import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { describeHint } from '../src/core/hint.js';

describe('describeHint', () => {
  test('select and point have a fixed hint', () => {
    assert.deepEqual(describeHint('select', 0), { key: 'hintSelect', params: {}, cancellable: false });
    assert.deepEqual(describeHint('point', 0), { key: 'hintPoint', params: {}, cancellable: false });
  });

  test('angle walks end, vertex, other end', () => {
    assert.equal(describeHint('angle', 0).key, 'hintAngleFirst');
    assert.equal(describeHint('angle', 1).key, 'hintAngleVertex');
    assert.equal(describeHint('angle', 2).key, 'hintAngleLast');
  });

  test('distance and line share the two-step hints', () => {
    for (const mode of ['distance', 'line']) {
      assert.equal(describeHint(mode, 0).key, 'hintPairFirst');
      assert.equal(describeHint(mode, 1).key, 'hintPairSecond');
    }
  });

  test('calibrate asks for two ends, then for the real length', () => {
    assert.equal(describeHint('calibrate', 0).key, 'hintCalibrateFirst');
    assert.equal(describeHint('calibrate', 1).key, 'hintCalibrateSecond');
    assert.equal(describeHint('calibrate', 2).key, 'hintCalibrateLength');
  });

  test('guide and repeat keep their own texts (null here)', () => {
    assert.equal(describeHint('guide', 0), null);
    assert.equal(describeHint('repeat', 0), null);
  });

  test('a pending count past the last step clamps to the last step', () => {
    assert.equal(describeHint('angle', 9).key, 'hintAngleLast');
    assert.equal(describeHint('distance', 9).key, 'hintPairSecond');
  });

  test('only a measurement in progress can be cancelled', () => {
    assert.equal(describeHint('angle', 0).cancellable, false);
    assert.equal(describeHint('angle', 1).cancellable, true);
    assert.equal(describeHint('select', 0).cancellable, false);
    assert.equal(describeHint('calibrate', 2).cancellable, true);
  });
});
