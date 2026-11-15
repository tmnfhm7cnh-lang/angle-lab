import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createHistory } from '../src/core/history.js';

describe('createHistory', () => {
  test('starts empty', () => {
    const h = createHistory();
    assert.equal(h.canUndo, false);
    assert.equal(h.canRedo, false);
    assert.equal(h.undo({ n: 0 }), null);
    assert.equal(h.redo({ n: 0 }), null);
  });

  test('undo returns snapshots newest first', () => {
    const h = createHistory();
    h.push({ n: 1 });
    h.push({ n: 2 });
    assert.deepEqual(h.undo({ n: 3 }), { n: 2 });
    assert.deepEqual(h.undo({ n: 2 }), { n: 1 });
    assert.equal(h.undo({ n: 1 }), null);
  });

  test('redo walks back forward after undo', () => {
    const h = createHistory();
    h.push({ n: 1 });
    h.push({ n: 2 });
    h.undo({ n: 3 });
    h.undo({ n: 2 });
    assert.equal(h.canRedo, true);
    assert.deepEqual(h.redo({ n: 1 }), { n: 2 });
    assert.deepEqual(h.redo({ n: 2 }), { n: 3 });
    assert.equal(h.redo({ n: 3 }), null);
    assert.equal(h.canRedo, false);
    assert.equal(h.canUndo, true);
  });

  test('a push after an undo empties the redo stack', () => {
    const h = createHistory();
    h.push({ n: 1 });
    h.undo({ n: 2 });
    assert.equal(h.canRedo, true);
    h.push({ n: 5 });
    assert.equal(h.canRedo, false);
    assert.equal(h.redo({ n: 6 }), null);
  });

  test('the limit drops the oldest snapshot', () => {
    const h = createHistory({ limit: 3 });
    for (let n = 1; n <= 5; n += 1) h.push({ n });
    assert.deepEqual(h.undo({ n: 6 }), { n: 5 });
    assert.deepEqual(h.undo({ n: 5 }), { n: 4 });
    assert.deepEqual(h.undo({ n: 4 }), { n: 3 });
    assert.equal(h.undo({ n: 3 }), null);
  });

  test('discardLast removes the newest snapshot without touching redo', () => {
    const h = createHistory();
    h.push({ n: 1 });
    h.push({ n: 2 });
    h.discardLast();
    assert.deepEqual(h.undo({ n: 3 }), { n: 1 });
    assert.equal(h.canUndo, false);
    h.discardLast(); // nothing left: no throw
    assert.equal(h.canUndo, false);
  });

  test('clear empties both stacks', () => {
    const h = createHistory();
    h.push({ n: 1 });
    h.undo({ n: 2 });
    h.clear();
    assert.equal(h.canUndo, false);
    assert.equal(h.canRedo, false);
  });

  test('snapshots are stored by reference: the caller owns serialising them', () => {
    const h = createHistory();
    const snap = { n: 1 };
    h.push(snap);
    assert.equal(h.undo({ n: 2 }), snap);
  });
});
