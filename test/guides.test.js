import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { nextLandmark, isGuideComplete, applyGuide } from '../src/core/guides.js';
import { createProject, addImage, addPoint, getPoint } from '../src/core/model.js';
import { evaluateAngle } from '../src/core/measurements.js';

// A synthetic three-landmark guide for testing the engine itself — not a real body part, so a
// wrong angle here can never be mistaken for wrong biomechanics content (see src/export/guides.js
// for the real ones).
const TEST_GUIDE = {
  id: 'test-guide',
  label: 'Test guide',
  landmarks: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
  ],
  plans: [{ kind: 'angle', a: 'a', vertex: 'b', c: 'c', tag: { test: 'x', metric: 'y' } }],
};

function projectWithImage() {
  const project = createProject();
  const image = addImage(project, { blobKey: 'b', width: 100, height: 100 });
  return { project, image };
}

describe('nextLandmark / isGuideComplete', () => {
  test('walks landmarks in order as placedIds grows', () => {
    assert.equal(nextLandmark(TEST_GUIDE, []).id, 'a');
    assert.equal(nextLandmark(TEST_GUIDE, ['a']).id, 'b');
    assert.equal(nextLandmark(TEST_GUIDE, ['a', 'b']).id, 'c');
    assert.equal(nextLandmark(TEST_GUIDE, ['a', 'b', 'c']), null);
  });

  test('isGuideComplete only once every landmark is placed', () => {
    assert.equal(isGuideComplete(TEST_GUIDE, ['a', 'b']), false);
    assert.equal(isGuideComplete(TEST_GUIDE, ['a', 'b', 'c']), true);
  });

  test('a null guide is never complete and has no next landmark', () => {
    assert.equal(nextLandmark(null, []), null);
    assert.equal(isGuideComplete(null, []), false);
  });
});

describe('applyGuide', () => {
  test('builds and tags the angle once all three landmarks have a point', () => {
    const { project, image } = projectWithImage();
    const pA = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const pB = addPoint(project, { imageId: image.id, x: 0, y: 10 });
    const pC = addPoint(project, { imageId: image.id, x: 10, y: 10 });
    const { created, skipped } = applyGuide(project, TEST_GUIDE, { a: pA.id, b: pB.id, c: pC.id });
    assert.equal(created.length, 1);
    assert.equal(skipped.length, 0);
    assert.equal(created[0].type, 'angle');
    assert.deepEqual(created[0].tag, { test: 'x', metric: 'y' });
    // 90 degrees: a below b, c to the right of b.
    assert.equal(Math.round(evaluateAngle(project, created[0].id).degrees), 90);
  });

  test('a plan whose landmark was never placed is skipped, not thrown', () => {
    const { project, image } = projectWithImage();
    const pA = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const pB = addPoint(project, { imageId: image.id, x: 0, y: 10 });
    const { created, skipped } = applyGuide(project, TEST_GUIDE, { a: pA.id, b: pB.id });
    assert.equal(created.length, 0);
    assert.equal(skipped.length, 1);
    assert.equal(skipped[0], TEST_GUIDE.plans[0]);
  });

  test('points from two different images are skipped, not measured across photos', () => {
    const project = createProject();
    const img1 = addImage(project, { blobKey: '1', width: 10, height: 10 });
    const img2 = addImage(project, { blobKey: '2', width: 10, height: 10 });
    const pA = addPoint(project, { imageId: img1.id, x: 0, y: 0 });
    const pB = addPoint(project, { imageId: img1.id, x: 0, y: 10 });
    const pC = addPoint(project, { imageId: img2.id, x: 10, y: 10 });
    const { created, skipped } = applyGuide(project, TEST_GUIDE, { a: pA.id, b: pB.id, c: pC.id });
    assert.equal(created.length, 0);
    assert.equal(skipped.length, 1);
  });

  test('the created measurement is an ordinary project entity, owned by the normal cascade', () => {
    const { project, image } = projectWithImage();
    const pA = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const pB = addPoint(project, { imageId: image.id, x: 0, y: 10 });
    const pC = addPoint(project, { imageId: image.id, x: 10, y: 10 });
    const { created } = applyGuide(project, TEST_GUIDE, { a: pA.id, b: pB.id, c: pC.id });
    assert.equal(project.measurements.some((m) => m.id === created[0].id), true);
    assert.equal(getPoint(project, pB.id).id, pB.id); // landmark points are plain points
  });
});
