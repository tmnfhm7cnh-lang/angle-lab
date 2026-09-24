import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  createProject,
  addImage,
  addPoint,
  movePoint,
  removePoint,
  addSegment,
  addAngle,
  addDistance,
  setCalibration,
  setDisplayUnit,
} from '../src/core/model.js';
import {
  evaluateAngle,
  evaluateDistance,
  evaluateSegment,
  evaluateAll,
} from '../src/core/measurements.js';

const close = (actual, expected, tolerance = 1e-9) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${expected}, got ${actual} (diff ${Math.abs(actual - expected)})`,
  );
};

function setup() {
  const project = createProject({ subjectCode: 'ATL-02' });
  const image = addImage(project, { blobKey: 'b', width: 1000, height: 1000 });
  return { project, image };
}

describe('evaluateAngle', () => {
  test('computes degrees and signedDegrees from live point positions', () => {
    const { project, image } = setup();
    const a = addPoint(project, { imageId: image.id, x: 1, y: 0 });
    const v = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const c = addPoint(project, { imageId: image.id, x: 0, y: 1 });
    const m = addAngle(project, a.id, v.id, c.id);
    const result = evaluateAngle(project, m.id);
    close(result.degrees, 90);
  });

  test('updates immediately after moving a point, with no recompute call', () => {
    const { project, image } = setup();
    const a = addPoint(project, { imageId: image.id, x: 1, y: 0 });
    const v = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const c = addPoint(project, { imageId: image.id, x: 0, y: 1 });
    const m = addAngle(project, a.id, v.id, c.id);
    close(evaluateAngle(project, m.id).degrees, 90);
    movePoint(project, c.id, 1, 0);
    close(evaluateAngle(project, m.id).degrees, 0);
  });

  test('returns null when the vertex point was deleted', () => {
    const { project, image } = setup();
    const a = addPoint(project, { imageId: image.id, x: 1, y: 0 });
    const v = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const c = addPoint(project, { imageId: image.id, x: 0, y: 1 });
    const m = addAngle(project, a.id, v.id, c.id);
    removePoint(project, v.id);
    assert.equal(evaluateAngle(project, m.id), null);
  });

  test('returns null for an unknown measurement id', () => {
    const { project } = setup();
    assert.equal(evaluateAngle(project, 'missing'), null);
  });

  test('returns null when asked to evaluate a non-angle measurement as an angle', () => {
    const { project, image } = setup();
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const b = addPoint(project, { imageId: image.id, x: 1, y: 1 });
    const d = addDistance(project, a.id, b.id);
    assert.equal(evaluateAngle(project, d.id), null);
  });
});

describe('evaluateDistance', () => {
  test('pixels is the euclidean distance between the two points', () => {
    const { project, image } = setup();
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const b = addPoint(project, { imageId: image.id, x: 3, y: 4 });
    const m = addDistance(project, a.id, b.id);
    close(evaluateDistance(project, m.id).pixels, 5);
  });

  test('real is NaN until a calibration exists', () => {
    const { project, image } = setup();
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const b = addPoint(project, { imageId: image.id, x: 3, y: 4 });
    const m = addDistance(project, a.id, b.id);
    assert.ok(Number.isNaN(evaluateDistance(project, m.id).real));
  });

  test('real is correct once a calibration exists', () => {
    const { project, image } = setup();
    const refA = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const refB = addPoint(project, { imageId: image.id, x: 734, y: 0 });
    setCalibration(project, { imageId: image.id, aId: refA.id, bId: refB.id, realLength: 100, unit: 'cm' });

    const a = addPoint(project, { imageId: image.id, x: 0, y: 100 });
    const b = addPoint(project, { imageId: image.id, x: 367, y: 100 });
    const m = addDistance(project, a.id, b.id);
    const result = evaluateDistance(project, m.id);
    close(result.real, 50, 1e-6);
    assert.equal(result.unit, 'cm');
  });

  test('updates immediately when a point moves', () => {
    const { project, image } = setup();
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const b = addPoint(project, { imageId: image.id, x: 3, y: 4 });
    const m = addDistance(project, a.id, b.id);
    close(evaluateDistance(project, m.id).pixels, 5);
    movePoint(project, b.id, 6, 8);
    close(evaluateDistance(project, m.id).pixels, 10);
  });

  test('returns null when a point was deleted', () => {
    const { project, image } = setup();
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const b = addPoint(project, { imageId: image.id, x: 3, y: 4 });
    const m = addDistance(project, a.id, b.id);
    removePoint(project, a.id);
    assert.equal(evaluateDistance(project, m.id), null);
  });
});

describe('evaluateSegment', () => {
  test('reports pixels and orientation', () => {
    const { project, image } = setup();
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const b = addPoint(project, { imageId: image.id, x: 1, y: 0 });
    const s = addSegment(project, a.id, b.id);
    const result = evaluateSegment(project, s.id);
    close(result.pixels, 1);
    close(result.orientation, 0);
  });

  test('real distance follows calibration exactly like evaluateDistance', () => {
    const { project, image } = setup();
    const refA = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const refB = addPoint(project, { imageId: image.id, x: 734, y: 0 });
    setCalibration(project, { imageId: image.id, aId: refA.id, bId: refB.id, realLength: 100, unit: 'cm' });

    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const b = addPoint(project, { imageId: image.id, x: 367, y: 0 });
    const s = addSegment(project, a.id, b.id);
    close(evaluateSegment(project, s.id).real, 50, 1e-6);
  });

  test('returns null when a point was deleted', () => {
    const { project, image } = setup();
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const b = addPoint(project, { imageId: image.id, x: 1, y: 0 });
    const s = addSegment(project, a.id, b.id);
    removePoint(project, b.id);
    assert.equal(evaluateSegment(project, s.id), null);
  });
});

describe('evaluateAll', () => {
  test('returns a Map keyed by id covering measurements and segments', () => {
    const { project, image } = setup();
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const b = addPoint(project, { imageId: image.id, x: 1, y: 0 });
    const c = addPoint(project, { imageId: image.id, x: 1, y: 1 });
    const segment = addSegment(project, a.id, b.id);
    const angleM = addAngle(project, a.id, b.id, c.id);
    const distanceM = addDistance(project, a.id, c.id);

    const results = evaluateAll(project);
    assert.ok(results instanceof Map);
    assert.ok(results.has(segment.id));
    assert.ok(results.has(angleM.id));
    assert.ok(results.has(distanceM.id));
    close(results.get(segment.id).pixels, 1);
  });
});

// F6 §7.1: the unit a real length is READ in is the project's display unit,
// not the unit the calibration reference was ENTERED in.
describe('display unit', () => {
  // The spec example: 100 cm spanning 734 px, then a 367 px distance is half
  // of it — 50 cm — and must read as the same physical length in every unit.
  function calibratedSetup() {
    const { project, image } = setup();
    const refA = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const refB = addPoint(project, { imageId: image.id, x: 734, y: 0 });
    setCalibration(project, {
      imageId: image.id,
      aId: refA.id,
      bId: refB.id,
      realLength: 100,
      unit: 'cm',
    });
    const a = addPoint(project, { imageId: image.id, x: 0, y: 100 });
    const b = addPoint(project, { imageId: image.id, x: 367, y: 100 });
    return { project, measurement: addDistance(project, a.id, b.id) };
  }

  test('defaults to centimetres', () => {
    const { project } = setup();
    assert.equal(project.displayUnit, 'cm');
  });

  test('reads one physical length in all four units, changing nothing else', () => {
    const { project, measurement } = calibratedSetup();
    const expected = { cm: 50, mm: 500, m: 0.5, in: 50 / 2.54 };
    for (const [unit, value] of Object.entries(expected)) {
      assert.equal(setDisplayUnit(project, unit), true);
      const result = evaluateDistance(project, measurement.id);
      close(result.real, value, 1e-9);
      assert.equal(result.unit, unit);
      // The pixel length is a property of the photo, not of the unit.
      close(result.pixels, 367, 1e-9);
    }
  });

  test('an invalid unit is ignored and leaves the reading untouched', () => {
    const { project, measurement } = calibratedSetup();
    setDisplayUnit(project, 'mm');
    assert.equal(setDisplayUnit(project, 'furlong'), false);
    assert.equal(project.displayUnit, 'mm');
    close(evaluateDistance(project, measurement.id).real, 500, 1e-9);
  });

  test('a calibration entered in metres still reads centimetres', () => {
    const { project, image } = setup();
    const refA = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const refB = addPoint(project, { imageId: image.id, x: 1000, y: 0 });
    setCalibration(project, {
      imageId: image.id,
      aId: refA.id,
      bId: refB.id,
      realLength: 1,
      unit: 'm',
    });
    const a = addPoint(project, { imageId: image.id, x: 0, y: 50 });
    const b = addPoint(project, { imageId: image.id, x: 250, y: 50 });
    const m = addDistance(project, a.id, b.id);
    const result = evaluateDistance(project, m.id);
    close(result.real, 25, 1e-9);
    assert.equal(result.unit, 'cm');
  });

  test('segments follow the display unit too', () => {
    const { project, image } = setup();
    const refA = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const refB = addPoint(project, { imageId: image.id, x: 734, y: 0 });
    setCalibration(project, {
      imageId: image.id,
      aId: refA.id,
      bId: refB.id,
      realLength: 100,
      unit: 'cm',
    });
    const a = addPoint(project, { imageId: image.id, x: 0, y: 200 });
    const b = addPoint(project, { imageId: image.id, x: 367, y: 200 });
    const segment = addSegment(project, a.id, b.id);
    setDisplayUnit(project, 'mm');
    close(evaluateSegment(project, segment.id).real, 500, 1e-9);
    assert.equal(evaluateSegment(project, segment.id).unit, 'mm');
  });

  test('stays NaN without a calibration, whatever the display unit', () => {
    const { project, image } = setup();
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const b = addPoint(project, { imageId: image.id, x: 10, y: 0 });
    const m = addDistance(project, a.id, b.id);
    for (const unit of ['mm', 'cm', 'm', 'in']) {
      setDisplayUnit(project, unit);
      const result = evaluateDistance(project, m.id);
      assert.ok(Number.isNaN(result.real));
      assert.equal(result.unit, unit);
    }
  });

  test('moving a reference point rescales the reading with no recompute call', () => {
    const { project, measurement } = calibratedSetup();
    close(evaluateDistance(project, measurement.id).real, 50, 1e-9);
    // Halve the reference's pixel span: the same 100 cm now covers 367 px,
    // so the 367 px measurement reads the full 100 cm.
    const refB = project.points[1];
    movePoint(project, refB.id, 367, 0);
    close(evaluateDistance(project, measurement.id).real, 100, 1e-9);
  });

  // LOTE 2 audit: loading a second photo used to leave the calibration
  // pointing at the first photo's reference points — a distance on the new,
  // uncalibrated photo would keep reporting a "real" value anyway.
  test('a second image has no calibration of its own and reads NaN until it gets one', () => {
    const { project, measurement } = calibratedSetup();
    close(evaluateDistance(project, measurement.id).real, 50, 1e-9);

    const image2 = addImage(project, { blobKey: 'b2', width: 1000, height: 1000 });
    const a2 = addPoint(project, { imageId: image2.id, x: 0, y: 0 });
    const b2 = addPoint(project, { imageId: image2.id, x: 367, y: 0 });
    const m2 = addDistance(project, a2.id, b2.id);
    assert.ok(Number.isNaN(evaluateDistance(project, m2.id).real));

    // The first image's own measurement is unaffected by the second image
    // existing at all.
    close(evaluateDistance(project, measurement.id).real, 50, 1e-9);
  });
});

// LOTE 2 audit §2.2: sigma (uncertainty) rides along with every angle and
// length, derived from placementScale — the viewport zoom in effect when
// each point was placed (see uncertainty.js). Precise per-pixel numbers are
// covered in uncertainty.test.js; this only checks the wiring into
// evaluateAngle/evaluateDistance/evaluateSegment.
describe('uncertainty wiring', () => {
  test('evaluateAngle reports sigmaDegrees and a quality verdict', () => {
    const { project, image } = setup();
    const a = addPoint(project, { imageId: image.id, x: 400, y: 0, placementScale: 1 });
    const v = addPoint(project, { imageId: image.id, x: 0, y: 0, placementScale: 1 });
    const c = addPoint(project, { imageId: image.id, x: 0, y: 400, placementScale: 1 });
    const m = addAngle(project, a.id, v.id, c.id);
    const result = evaluateAngle(project, m.id);
    assert.ok(Number.isFinite(result.sigmaDegrees));
    assert.ok(result.sigmaDegrees > 0);
    assert.equal(typeof result.quality.level, 'string');
  });

  test('a short ray reports a worse (larger) sigma than a long one', () => {
    const { project, image } = setup();
    const v = addPoint(project, { imageId: image.id, x: 0, y: 0, placementScale: 1 });
    const far = addPoint(project, { imageId: image.id, x: 0, y: 400, placementScale: 1 });
    const short = addPoint(project, { imageId: image.id, x: 25, y: 0, placementScale: 1 });
    const long = addPoint(project, { imageId: image.id, x: 400, y: 0, placementScale: 1 });
    const shortAngle = evaluateAngle(project, addAngle(project, short.id, v.id, far.id).id);
    const longAngle = evaluateAngle(project, addAngle(project, long.id, v.id, far.id).id);
    assert.ok(shortAngle.sigmaDegrees > longAngle.sigmaDegrees);
  });

  test('evaluateDistance and evaluateSegment report sigma in pixels when uncalibrated', () => {
    const { project, image } = setup();
    const a = addPoint(project, { imageId: image.id, x: 0, y: 0, placementScale: 1 });
    const b = addPoint(project, { imageId: image.id, x: 100, y: 0, placementScale: 1 });
    const d = evaluateDistance(project, addDistance(project, a.id, b.id).id);
    const s = evaluateSegment(project, addSegment(project, a.id, b.id).id);
    assert.ok(Number.isFinite(d.sigma) && d.sigma > 0);
    assert.ok(Number.isFinite(s.sigma) && s.sigma > 0);
  });

  test('evaluateDistance reports sigma in the display unit once calibrated', () => {
    const { project, image } = setup();
    const refA = addPoint(project, { imageId: image.id, x: 0, y: 0 });
    const refB = addPoint(project, { imageId: image.id, x: 734, y: 0 });
    setCalibration(project, { imageId: image.id, aId: refA.id, bId: refB.id, realLength: 100, unit: 'cm' });
    const a = addPoint(project, { imageId: image.id, x: 0, y: 100, placementScale: 1 });
    const b = addPoint(project, { imageId: image.id, x: 367, y: 100, placementScale: 1 });
    const measurement = addDistance(project, a.id, b.id);
    const result = evaluateDistance(project, measurement.id);
    // Calibrated: 100 cm over 734 px, so 1 px ~ 0.136 cm — the pixel-space
    // sigma converts through the same scale the reading itself uses.
    assert.ok(Number.isFinite(result.sigma) && result.sigma > 0);
    assert.ok(result.sigma < 5, `expected a small cm-scale sigma, got ${result.sigma}`);
  });
});
