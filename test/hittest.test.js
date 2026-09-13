import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  createProject,
  addImage,
  addPoint,
  addAnnotation,
  addSegment,
} from '../src/core/model.js';
import { hitTest } from '../src/core/hittest.js';

function setup() {
  const project = createProject({ subjectCode: 'ATL-03' });
  const image = addImage(project, { blobKey: 'b', width: 1000, height: 1000 });
  return { project, image };
}

describe('hitTest', () => {
  test('finds a point within tolerance', () => {
    const { project, image } = setup();
    const p = addPoint(project, { imageId: image.id, x: 100, y: 100 });
    const hit = hitTest(project, { x: 104, y: 100 }, 10, image.id);
    assert.equal(hit.type, 'point');
    assert.equal(hit.id, p.id);
  });

  test('returns null when nothing is within tolerance', () => {
    const { project, image } = setup();
    addPoint(project, { imageId: image.id, x: 100, y: 100 });
    assert.equal(hitTest(project, { x: 500, y: 500 }, 10, image.id), null);
  });

  test('among several points, the nearest wins', () => {
    const { project, image } = setup();
    const near = addPoint(project, { imageId: image.id, x: 100, y: 100 });
    addPoint(project, { imageId: image.id, x: 105, y: 100 });
    const hit = hitTest(project, { x: 101, y: 100 }, 20, image.id);
    assert.equal(hit.id, near.id);
  });

  test('points take priority over annotations at the same location', () => {
    const { project, image } = setup();
    const p = addPoint(project, { imageId: image.id, x: 50, y: 50 });
    addAnnotation(project, { imageId: image.id, x: 50, y: 50, text: 'note' });
    const hit = hitTest(project, { x: 50, y: 50 }, 5, image.id);
    assert.equal(hit.type, 'point');
    assert.equal(hit.id, p.id);
  });

  test('annotations take priority over segments at the same location', () => {
    const { project, image } = setup();
    const a = addPoint(project, { imageId: image.id, x: 0, y: 50 });
    const b = addPoint(project, { imageId: image.id, x: 100, y: 50 });
    addSegment(project, a.id, b.id);
    const annotation = addAnnotation(project, { imageId: image.id, x: 50, y: 50, text: 'note' });
    const hit = hitTest(project, { x: 50, y: 50 }, 5, image.id);
    assert.equal(hit.type, 'annotation');
    assert.equal(hit.id, annotation.id);
  });

  test('finds a segment when nothing closer matches', () => {
    const { project, image } = setup();
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const b = addPoint(project, { imageId: image.id, x: 100, y: 0 });
    const segment = addSegment(project, a.id, b.id);
    const hit = hitTest(project, { x: 50, y: 2 }, 5, image.id);
    assert.equal(hit.type, 'segment');
    assert.equal(hit.id, segment.id);
  });

  test('among two segments, the nearest wins', () => {
    const { project, image } = setup();
    const a1 = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const b1 = addPoint(project, { imageId: image.id, x: 100, y: 0 });
    const near = addSegment(project, a1.id, b1.id);
    const a2 = addPoint(project, { imageId: image.id, x: 0, y: 10 });
    const b2 = addPoint(project, { imageId: image.id, x: 100, y: 10 });
    addSegment(project, a2.id, b2.id);
    const hit = hitTest(project, { x: 50, y: 1 }, 20, image.id);
    assert.equal(hit.id, near.id);
  });

  test('ignores points, annotations and segments on a different image', () => {
    const { project, image } = setup();
    const otherImage = addImage(project, { blobKey: 'b2', width: 500, height: 500 });
    addPoint(project, { imageId: otherImage.id, x: 100, y: 100 });
    addAnnotation(project, { imageId: otherImage.id, x: 100, y: 100, text: 'x' });
    const a = addPoint(project, { imageId: otherImage.id, x: 0, y: 0 });
    const b = addPoint(project, { imageId: otherImage.id, x: 200, y: 0 });
    addSegment(project, a.id, b.id);
    assert.equal(hitTest(project, { x: 100, y: 100 }, 50, image.id), null);
  });

  test('a hit exactly at tolerance distance counts', () => {
    const { project, image } = setup();
    const p = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const hit = hitTest(project, { x: 10, y: 0 }, 10, image.id);
    assert.equal(hit.id, p.id);
  });
});
