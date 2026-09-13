import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import {
  SCHEMA_VERSION,
  createProject,
  addImage,
  addPoint,
  movePoint,
  removePoint,
  addSegment,
  addAngle,
  addDistance,
  setCalibration,
  clearCalibration,
  addAnnotation,
  updateAnnotation,
  removeEntity,
  getPoint,
  serialize,
  deserialize,
} from '../src/core/model.js';

function projectWithImage() {
  const project = createProject({ subjectCode: 'ATL-01' });
  const image = addImage(project, { blobKey: 'blob-1', width: 1000, height: 1000 });
  return { project, image };
}

describe('createProject', () => {
  test('has no name field anywhere, only subjectCode', () => {
    const project = createProject({ subjectCode: 'ATL-07' });
    assert.equal(project.subjectCode, 'ATL-07');
    assert.equal('name' in project, false);
  });

  test('defaults to empty collections and null calibration', () => {
    const project = createProject();
    assert.deepEqual(project.images, []);
    assert.deepEqual(project.points, []);
    assert.deepEqual(project.segments, []);
    assert.deepEqual(project.measurements, []);
    assert.deepEqual(project.annotations, []);
    assert.equal(project.calibration, null);
    assert.equal(project.activeImageId, null);
  });

  test('stamps schemaVersion and timestamps', () => {
    const project = createProject();
    assert.equal(project.schemaVersion, SCHEMA_VERSION);
    assert.ok(project.createdAt);
    assert.ok(project.updatedAt);
    assert.ok(project.id);
  });
});

describe('addImage', () => {
  test('adds an image and sets it active if none was', () => {
    const project = createProject();
    const image = addImage(project, { blobKey: 'b', width: 100, height: 200, exifOrientation: 1 });
    assert.equal(project.images.length, 1);
    assert.equal(project.activeImageId, image.id);
    assert.equal(image.width, 100);
    assert.equal(image.height, 200);
  });

  test('does not change activeImageId on a second image', () => {
    const project = createProject();
    const first = addImage(project, { blobKey: 'a', width: 10, height: 10 });
    addImage(project, { blobKey: 'b', width: 10, height: 10 });
    assert.equal(project.activeImageId, first.id);
  });

  test('updates project.updatedAt', async () => {
    const project = createProject();
    const before = project.updatedAt;
    await delay(5); // ISO timestamps have ms resolution; force real time to pass
    addImage(project, { blobKey: 'a', width: 10, height: 10 });
    assert.notEqual(project.updatedAt, before);
  });
});

describe('addPoint / movePoint / getPoint', () => {
  test('adds a point with manual source and null landmark by default', () => {
    const { project, image } = projectWithImage();
    const point = addPoint(project, { imageId: image.id, x: 10, y: 20 });
    assert.equal(point.source, 'manual');
    assert.equal(point.landmark, null);
    assert.equal(point.label, '');
    assert.equal(getPoint(project, point.id), point);
  });

  test('movePoint updates coordinates in place', () => {
    const { project, image } = projectWithImage();
    const point = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    movePoint(project, point.id, 50, 75);
    assert.equal(point.x, 50);
    assert.equal(point.y, 75);
  });

  test('movePoint on an unknown id returns null and does nothing', () => {
    const { project } = projectWithImage();
    assert.equal(movePoint(project, 'missing', 1, 1), null);
  });

  test('getPoint returns null for an unknown id', () => {
    const { project } = projectWithImage();
    assert.equal(getPoint(project, 'missing'), null);
  });
});

describe('cascade delete — removePoint', () => {
  test('removing a point removes every segment referencing it', () => {
    const { project, image } = projectWithImage();
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const b = addPoint(project, { imageId: image.id, x: 1, y: 1 });
    const segment = addSegment(project, a.id, b.id);
    removePoint(project, a.id);
    assert.equal(project.segments.find((s) => s.id === segment.id), undefined);
  });

  test('removing a point removes every angle referencing it as a, vertex or c', () => {
    const { project, image } = projectWithImage();
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const v = addPoint(project, { imageId: image.id, x: 1, y: 0 });
    const c = addPoint(project, { imageId: image.id, x: 1, y: 1 });
    const angleA = addAngle(project, a.id, v.id, c.id);
    removePoint(project, a.id);
    assert.equal(project.measurements.find((m) => m.id === angleA.id), undefined);

    const a2 = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const angleV = addAngle(project, a2.id, v.id, c.id);
    removePoint(project, v.id);
    assert.equal(project.measurements.find((m) => m.id === angleV.id), undefined);
  });

  test('removing a point removes every distance referencing it', () => {
    const { project, image } = projectWithImage();
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const b = addPoint(project, { imageId: image.id, x: 1, y: 1 });
    const d = addDistance(project, a.id, b.id);
    removePoint(project, b.id);
    assert.equal(project.measurements.find((m) => m.id === d.id), undefined);
  });

  test('removing a calibration reference point clears the calibration', () => {
    const { project, image } = projectWithImage();
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const b = addPoint(project, { imageId: image.id, x: 100, y: 0 });
    setCalibration(project, { imageId: image.id, aId: a.id, bId: b.id, realLength: 1, unit: 'm' });
    removePoint(project, b.id);
    assert.equal(project.calibration, null);
  });

  test('no dangling references survive a full cascade across every entity type at once', () => {
    const { project, image } = projectWithImage();
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const b = addPoint(project, { imageId: image.id, x: 1, y: 0 });
    const c = addPoint(project, { imageId: image.id, x: 1, y: 1 });
    addSegment(project, a.id, b.id);
    addAngle(project, a.id, b.id, c.id);
    addDistance(project, a.id, c.id);
    setCalibration(project, { imageId: image.id, aId: a.id, bId: c.id, realLength: 1, unit: 'm' });

    removePoint(project, a.id);

    const survivingIds = new Set(project.points.map((p) => p.id));
    for (const s of project.segments) {
      assert.ok(survivingIds.has(s.aId) && survivingIds.has(s.bId));
    }
    for (const m of project.measurements) {
      if (m.type === 'angle') {
        assert.ok(survivingIds.has(m.aId) && survivingIds.has(m.vertexId) && survivingIds.has(m.cId));
      } else {
        assert.ok(survivingIds.has(m.aId) && survivingIds.has(m.bId));
      }
    }
    if (project.calibration) {
      assert.ok(survivingIds.has(project.calibration.aId) && survivingIds.has(project.calibration.bId));
    }

    const serialized = serialize(project);
    assert.equal(serialized.calibration, null);
  });

  test('removing a point that does not exist returns false and changes nothing', () => {
    const { project } = projectWithImage();
    const before = serialize(project);
    delete before.updatedAt;
    assert.equal(removePoint(project, 'missing'), false);
    const after = serialize(project);
    delete after.updatedAt;
    assert.deepEqual(after, before);
  });

  test('removing a measurement does not remove its points', () => {
    const { project, image } = projectWithImage();
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const b = addPoint(project, { imageId: image.id, x: 1, y: 1 });
    const d = addDistance(project, a.id, b.id);
    removeEntity(project, d.id);
    assert.ok(getPoint(project, a.id));
    assert.ok(getPoint(project, b.id));
  });
});

describe('addSegment / addAngle / addDistance', () => {
  test('store point ids only, no computed value', () => {
    const { project, image } = projectWithImage();
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const b = addPoint(project, { imageId: image.id, x: 3, y: 4 });
    const c = addPoint(project, { imageId: image.id, x: 3, y: 0 });
    const distanceM = addDistance(project, a.id, b.id);
    const angleM = addAngle(project, a.id, c.id, b.id);
    const segment = addSegment(project, a.id, b.id);
    for (const entity of [distanceM, angleM, segment]) {
      assert.equal('degrees' in entity, false);
      assert.equal('pixels' in entity, false);
      assert.equal('value' in entity, false);
    }
  });
});

describe('calibration', () => {
  test('setCalibration replaces any prior calibration', () => {
    const { project, image } = projectWithImage();
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const b = addPoint(project, { imageId: image.id, x: 100, y: 0 });
    setCalibration(project, { imageId: image.id, aId: a.id, bId: b.id, realLength: 1, unit: 'm' });
    const c = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const d = addPoint(project, { imageId: image.id, x: 50, y: 0 });
    setCalibration(project, { imageId: image.id, aId: c.id, bId: d.id, realLength: 50, unit: 'cm' });
    assert.equal(project.calibration.aId, c.id);
  });

  test('clearCalibration sets it to null', () => {
    const { project, image } = projectWithImage();
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const b = addPoint(project, { imageId: image.id, x: 100, y: 0 });
    setCalibration(project, { imageId: image.id, aId: a.id, bId: b.id, realLength: 1, unit: 'm' });
    clearCalibration(project);
    assert.equal(project.calibration, null);
  });
});

describe('annotations', () => {
  test('addAnnotation and updateAnnotation', () => {
    const { project, image } = projectWithImage();
    const annotation = addAnnotation(project, { imageId: image.id, x: 5, y: 5, text: 'note' });
    updateAnnotation(project, annotation.id, 'updated');
    assert.equal(annotation.text, 'updated');
  });

  test('updateAnnotation on an unknown id returns null', () => {
    const { project } = projectWithImage();
    assert.equal(updateAnnotation(project, 'missing', 'x'), null);
  });
});

describe('removeEntity dispatch', () => {
  test('removes a segment by id', () => {
    const { project, image } = projectWithImage();
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const b = addPoint(project, { imageId: image.id, x: 1, y: 1 });
    const segment = addSegment(project, a.id, b.id);
    assert.equal(removeEntity(project, segment.id), true);
    assert.equal(project.segments.length, 0);
  });

  test('removes an annotation by id', () => {
    const { project, image } = projectWithImage();
    const annotation = addAnnotation(project, { imageId: image.id, x: 0, y: 0, text: 'x' });
    assert.equal(removeEntity(project, annotation.id), true);
    assert.equal(project.annotations.length, 0);
  });

  test('removes the calibration by id', () => {
    const { project, image } = projectWithImage();
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const b = addPoint(project, { imageId: image.id, x: 100, y: 0 });
    const calibration = setCalibration(project, { imageId: image.id, aId: a.id, bId: b.id, realLength: 1, unit: 'm' });
    assert.equal(removeEntity(project, calibration.id), true);
    assert.equal(project.calibration, null);
  });

  test('removing a point through removeEntity cascades exactly like removePoint', () => {
    const { project, image } = projectWithImage();
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const b = addPoint(project, { imageId: image.id, x: 1, y: 1 });
    const segment = addSegment(project, a.id, b.id);
    assert.equal(removeEntity(project, a.id), true);
    assert.equal(project.segments.find((s) => s.id === segment.id), undefined);
  });

  test('unknown id returns false', () => {
    const { project } = projectWithImage();
    assert.equal(removeEntity(project, 'nonexistent'), false);
  });
});

describe('serialize / deserialize', () => {
  test('round-trips a full project', () => {
    const { project, image } = projectWithImage();
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const b = addPoint(project, { imageId: image.id, x: 3, y: 4 });
    addSegment(project, a.id, b.id);
    addDistance(project, a.id, b.id);

    const data = serialize(project);
    const restored = deserialize(data);
    assert.deepEqual(restored, JSON.parse(JSON.stringify(project)));
  });

  test('serialize output is plain JSON-safe data', () => {
    const { project } = projectWithImage();
    const data = serialize(project);
    assert.doesNotThrow(() => JSON.stringify(data));
  });

  test('deserialize throws on an unknown schema version', () => {
    const { project } = projectWithImage();
    const data = serialize(project);
    data.schemaVersion = 999;
    assert.throws(() => deserialize(data));
  });
});
