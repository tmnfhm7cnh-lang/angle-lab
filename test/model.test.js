import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import {
  SCHEMA_VERSION,
  MIN_CALIBRATION_REFERENCE_PX,
  createProject,
  addImage,
  addPoint,
  movePoint,
  removePoint,
  addSegment,
  addAngle,
  addDistance,
  setCalibration,
  getCalibration,
  clearCalibration,
  addAnnotation,
  updateAnnotation,
  removeEntity,
  getPoint,
  serialize,
  deserialize,
  setSubjectCode,
  setMeasurementTag,
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

  test('defaults to empty collections and no calibrations', () => {
    const project = createProject();
    assert.deepEqual(project.images, []);
    assert.deepEqual(project.points, []);
    assert.deepEqual(project.segments, []);
    assert.deepEqual(project.measurements, []);
    assert.deepEqual(project.annotations, []);
    assert.deepEqual(project.calibrations, {});
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

  test('placementScale defaults to null and is stored when given', () => {
    const { project, image } = projectWithImage();
    const bare = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    assert.equal(bare.placementScale, null);
    const zoomed = addPoint(project, { imageId: image.id, x: 0, y: 0, placementScale: 2.5 });
    assert.equal(zoomed.placementScale, 2.5);
  });

  test('movePoint updates placementScale when given, leaves it alone otherwise', () => {
    const { project, image } = projectWithImage();
    const point = addPoint(project, { imageId: image.id, x: 0, y: 0, placementScale: 1 });
    movePoint(project, point.id, 5, 5);
    assert.equal(point.placementScale, 1);
    movePoint(project, point.id, 6, 6, 3);
    assert.equal(point.placementScale, 3);
  });

  // LOTE 2 audit: a NaN coordinate used to be accepted, and serialize()
  // silently turned it into a stored 0 on the next read (JSON.stringify(NaN)
  // is 'null', and null coerces to 0 in the arithmetic downstream) —
  // reporting a distance that never existed.
  describe('rejects non-finite coordinates', () => {
    test('addPoint returns null for NaN/Infinity x or y, and adds nothing', () => {
      const { project, image } = projectWithImage();
      assert.equal(addPoint(project, { imageId: image.id, x: NaN, y: 0 }), null);
      assert.equal(addPoint(project, { imageId: image.id, x: 0, y: Infinity }), null);
      assert.equal(project.points.length, 0);
    });

    test('movePoint returns null for NaN/Infinity and leaves the point where it was', () => {
      const { project, image } = projectWithImage();
      const point = addPoint(project, { imageId: image.id, x: 10, y: 10 });
      assert.equal(movePoint(project, point.id, NaN, 5), null);
      assert.equal(point.x, 10);
      assert.equal(point.y, 10);
    });
  });
});

describe('addSegment / addAngle / addDistance reject cross-image references', () => {
  test('addSegment returns null and adds nothing when the two points are on different images', () => {
    const { project, image } = projectWithImage();
    const image2 = addImage(project, { blobKey: 'blob-2', width: 500, height: 500 });
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const b = addPoint(project, { imageId: image2.id, x: 0, y: 0 });
    assert.equal(addSegment(project, a.id, b.id), null);
    assert.equal(project.segments.length, 0);
  });

  test('addAngle returns null when any of the three points is on a different image', () => {
    const { project, image } = projectWithImage();
    const image2 = addImage(project, { blobKey: 'blob-2', width: 500, height: 500 });
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const v = addPoint(project, { imageId: image.id, x: 1, y: 0 });
    const c = addPoint(project, { imageId: image2.id, x: 1, y: 1 });
    assert.equal(addAngle(project, a.id, v.id, c.id), null);
    assert.equal(project.measurements.length, 0);
  });

  test('addDistance returns null across images', () => {
    const { project, image } = projectWithImage();
    const image2 = addImage(project, { blobKey: 'blob-2', width: 500, height: 500 });
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const b = addPoint(project, { imageId: image2.id, x: 0, y: 0 });
    assert.equal(addDistance(project, a.id, b.id), null);
  });

  test('same-image references still work exactly as before', () => {
    const { project, image } = projectWithImage();
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const b = addPoint(project, { imageId: image.id, x: 1, y: 1 });
    assert.ok(addSegment(project, a.id, b.id));
    assert.ok(addDistance(project, a.id, b.id));
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

  test('removing a calibration reference point clears that image\'s calibration', () => {
    const { project, image } = projectWithImage();
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const b = addPoint(project, { imageId: image.id, x: 100, y: 0 });
    setCalibration(project, { imageId: image.id, aId: a.id, bId: b.id, realLength: 1, unit: 'm' });
    removePoint(project, b.id);
    assert.equal(getCalibration(project, image.id), null);
  });

  test('no dangling references survive a full cascade across every entity type at once', () => {
    const { project, image } = projectWithImage();
    // b/c are 20 px away rather than 1, so the calibration reference below
    // clears MIN_CALIBRATION_REFERENCE_PX and setCalibration actually sets
    // something for this test to cascade-delete.
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const b = addPoint(project, { imageId: image.id, x: 20, y: 0 });
    const c = addPoint(project, { imageId: image.id, x: 20, y: 20 });
    addSegment(project, a.id, b.id);
    addAngle(project, a.id, b.id, c.id);
    addDistance(project, a.id, c.id);
    assert.ok(setCalibration(project, { imageId: image.id, aId: a.id, bId: c.id, realLength: 1, unit: 'm' }));

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
    // a was one of the calibration's own reference points, so it must be
    // gone, not merely intact.
    assert.equal(getCalibration(project, image.id), null);

    const serialized = serialize(project);
    assert.equal(serialized.calibrations[image.id], undefined);
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

describe('setSubjectCode', () => {
  test('replaces subjectCode', () => {
    const { project } = projectWithImage();
    assert.equal(setSubjectCode(project, 'ATL-09'), true);
    assert.equal(project.subjectCode, 'ATL-09');
  });

  test('rejects a non-string', () => {
    const { project } = projectWithImage();
    assert.equal(setSubjectCode(project, 7), false);
    assert.equal(project.subjectCode, 'ATL-01');
  });
});

describe('setMeasurementTag', () => {
  function projectWithAngle() {
    const { project, image } = projectWithImage();
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const b = addPoint(project, { imageId: image.id, x: 3, y: 4 });
    const c = addPoint(project, { imageId: image.id, x: 3, y: 0 });
    const angle = addAngle(project, a.id, c.id, b.id);
    return { project, angle };
  }

  test('tags a measurement with a test/metric pair', () => {
    const { project, angle } = projectWithAngle();
    assert.equal(setMeasurementTag(project, angle.id, { test: 'puente', metric: 'desviacion_brazo' }), true);
    const stored = project.measurements.find((m) => m.id === angle.id);
    assert.deepEqual(stored.tag, { test: 'puente', metric: 'desviacion_brazo' });
  });

  test('null clears an existing tag', () => {
    const { project, angle } = projectWithAngle();
    setMeasurementTag(project, angle.id, { test: 'puente', metric: 'desviacion_brazo' });
    assert.equal(setMeasurementTag(project, angle.id, null), true);
    const stored = project.measurements.find((m) => m.id === angle.id);
    assert.equal('tag' in stored, false);
  });

  test('rejects an unknown measurement id', () => {
    const { project } = projectWithAngle();
    assert.equal(setMeasurementTag(project, 'not-an-id', { test: 'puente', metric: 'x' }), false);
  });

  test('rejects a malformed tag', () => {
    const { project, angle } = projectWithAngle();
    assert.equal(setMeasurementTag(project, angle.id, { test: 'puente' }), false);
    assert.equal(setMeasurementTag(project, angle.id, {}), false);
  });
});

describe('calibration', () => {
  test('setCalibration replaces any prior calibration for that image', () => {
    const { project, image } = projectWithImage();
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const b = addPoint(project, { imageId: image.id, x: 100, y: 0 });
    setCalibration(project, { imageId: image.id, aId: a.id, bId: b.id, realLength: 1, unit: 'm' });
    const c = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const d = addPoint(project, { imageId: image.id, x: 50, y: 0 });
    setCalibration(project, { imageId: image.id, aId: c.id, bId: d.id, realLength: 50, unit: 'cm' });
    assert.equal(getCalibration(project, image.id).aId, c.id);
  });

  test('clearCalibration removes just that image\'s entry', () => {
    const { project, image } = projectWithImage();
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const b = addPoint(project, { imageId: image.id, x: 100, y: 0 });
    setCalibration(project, { imageId: image.id, aId: a.id, bId: b.id, realLength: 1, unit: 'm' });
    clearCalibration(project, image.id);
    assert.equal(getCalibration(project, image.id), null);
  });

  test('a second image does not inherit the first image\'s calibration', () => {
    const { project, image } = projectWithImage();
    const image2 = addImage(project, { blobKey: 'blob-2', width: 1000, height: 1000 });
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const b = addPoint(project, { imageId: image.id, x: 100, y: 0 });
    setCalibration(project, { imageId: image.id, aId: a.id, bId: b.id, realLength: 1, unit: 'm' });
    assert.equal(getCalibration(project, image2.id), null);

    const c = addPoint(project, { imageId: image2.id, x: 0, y: 0 });
    const d = addPoint(project, { imageId: image2.id, x: 200, y: 0 });
    setCalibration(project, { imageId: image2.id, aId: c.id, bId: d.id, realLength: 2, unit: 'm' });
    assert.equal(getCalibration(project, image.id).realLength, 1);
    assert.equal(getCalibration(project, image2.id).realLength, 2);
  });

  test('rejects a non-positive or non-finite real length', () => {
    const { project, image } = projectWithImage();
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const b = addPoint(project, { imageId: image.id, x: 100, y: 0 });
    assert.equal(setCalibration(project, { imageId: image.id, aId: a.id, bId: b.id, realLength: 0, unit: 'm' }), null);
    assert.equal(setCalibration(project, { imageId: image.id, aId: a.id, bId: b.id, realLength: -3, unit: 'm' }), null);
    assert.equal(setCalibration(project, { imageId: image.id, aId: a.id, bId: b.id, realLength: NaN, unit: 'm' }), null);
    assert.equal(getCalibration(project, image.id), null);
  });

  test('rejects an invalid unit ("furlong")', () => {
    const { project, image } = projectWithImage();
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const b = addPoint(project, { imageId: image.id, x: 100, y: 0 });
    assert.equal(setCalibration(project, { imageId: image.id, aId: a.id, bId: b.id, realLength: 3, unit: 'furlong' }), null);
  });

  test('rejects two coincident reference points', () => {
    const { project, image } = projectWithImage();
    const a = addPoint(project, { imageId: image.id, x: 50, y: 50 });
    const b = addPoint(project, { imageId: image.id, x: 50, y: 50 });
    assert.equal(setCalibration(project, { imageId: image.id, aId: a.id, bId: b.id, realLength: 1, unit: 'm' }), null);
  });

  test(`rejects a reference shorter than ${MIN_CALIBRATION_REFERENCE_PX} px (a 2 px reference is unusable)`, () => {
    const { project, image } = projectWithImage();
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const b = addPoint(project, { imageId: image.id, x: 2, y: 0 });
    assert.equal(setCalibration(project, { imageId: image.id, aId: a.id, bId: b.id, realLength: 50, unit: 'cm' }), null);
  });

  test('accepts a reference right at the minimum', () => {
    const { project, image } = projectWithImage();
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const b = addPoint(project, { imageId: image.id, x: MIN_CALIBRATION_REFERENCE_PX, y: 0 });
    assert.ok(setCalibration(project, { imageId: image.id, aId: a.id, bId: b.id, realLength: 50, unit: 'cm' }));
  });

  test('rejects reference points that belong to a different image than the one declared', () => {
    const { project, image } = projectWithImage();
    const image2 = addImage(project, { blobKey: 'blob-2', width: 1000, height: 1000 });
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const b = addPoint(project, { imageId: image2.id, x: 100, y: 0 });
    assert.equal(setCalibration(project, { imageId: image.id, aId: a.id, bId: b.id, realLength: 1, unit: 'm' }), null);
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
    assert.equal(getCalibration(project, image.id), null);
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

  test('deserialize throws a clear "no migration path" error on an unknown schema version', () => {
    const { project } = projectWithImage();
    const data = serialize(project);
    data.schemaVersion = 999;
    assert.throws(() => deserialize(data), /No migration path from schema version 999 to \d+/);
  });

  test('deserialize accepts current-version data missing a field added since v1 shipped', () => {
    // displayUnit and calibrations were both added without a schema bump
    // (see model.js's MIGRATIONS comment) — this is the "defensive default"
    // path, distinct from the real migration chain above, and is the one
    // case where hand-built fixture data legitimately differs from what
    // createProject() produces today.
    const { project } = projectWithImage();
    const data = serialize(project);
    delete data.displayUnit;
    delete data.calibrations;
    const restored = deserialize(data);
    assert.equal(restored.displayUnit, 'cm');
    assert.deepEqual(restored.calibrations, {});
  });
});
