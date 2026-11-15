import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  createProject,
  addImage,
  addPoint,
  addAngle,
  addDistance,
  setCalibration,
  setMeasurementLabel,
} from '../src/core/model.js';
import { readingsForImage, readingExport, buildExportRows, buildExportCsv, CSV_HEADER } from '../src/export/csvExport.js';

function projectWithAngleAndDistance() {
  const project = createProject({ subjectCode: 'ATL-07' });
  const image = addImage(project, { width: 1000, height: 1000 });
  // A right angle: 90.0 degrees exactly, long rays for a tight sigma.
  const vertex = addPoint(project, { imageId: image.id, x: 0, y: 0, placementScale: 1 });
  const a = addPoint(project, { imageId: image.id, x: 400, y: 0, placementScale: 1 });
  const c = addPoint(project, { imageId: image.id, x: 0, y: 400, placementScale: 1 });
  const angle = addAngle(project, a.id, vertex.id, c.id);
  const dA = addPoint(project, { imageId: image.id, x: 100, y: 100, placementScale: 1 });
  const dB = addPoint(project, { imageId: image.id, x: 100, y: 200, placementScale: 1 });
  const distance = addDistance(project, dA.id, dB.id);
  return { project, image, angle, distance, dA, dB };
}

describe('readingsForImage', () => {
  test('returns only measurements belonging to that image, each carrying its name', () => {
    const { project, image, angle, distance } = projectWithAngleAndDistance();
    const otherImage = addImage(project, { width: 500, height: 500 });
    const p1 = addPoint(project, { imageId: otherImage.id, x: 0, y: 0 });
    const p2 = addPoint(project, { imageId: otherImage.id, x: 10, y: 0 });
    const p3 = addPoint(project, { imageId: otherImage.id, x: 0, y: 10 });
    addAngle(project, p1.id, p2.id, p3.id);

    setMeasurementLabel(project, angle.id, 'left knee');

    const readings = readingsForImage(project, image.id);
    assert.equal(readings.length, 2);
    const byId = Object.fromEntries(readings.map((r) => [r.id, r]));
    assert.equal(byId[angle.id].type, 'angle');
    assert.equal(byId[angle.id].name, 'left knee');
    assert.equal(byId[distance.id].type, 'distance');
    assert.equal(byId[distance.id].name, '');
  });

  test('a measurement whose point was deleted is left out', () => {
    const { project, image } = projectWithAngleAndDistance();
    project.points = project.points.slice(0, 3); // the distance lost both points
    assert.equal(readingsForImage(project, image.id).length, 1);
  });
});

describe('readingExport', () => {
  test('an angle exports in degrees, with the sigma and quality it shows on screen', () => {
    const { project, image, angle } = projectWithAngleAndDistance();
    const r = readingsForImage(project, image.id).find((x) => x.id === angle.id);
    const e = readingExport(r);
    assert.equal(e.unit, 'deg');
    assert.equal(e.value, 90);
    assert.match(e.uncertainty, /^\d+(\.\d+)?$/);
    assert.ok(['good', 'ok', 'poor'].includes(e.quality));
    assert.equal(e.note, '');
  });

  test('a distance with no calibration exports in pixels and says so, never an invented length', () => {
    const { project, image, distance } = projectWithAngleAndDistance();
    const r = readingsForImage(project, image.id).find((x) => x.id === distance.id);
    const e = readingExport(r);
    assert.equal(e.unit, 'px');
    assert.equal(e.value, 100);
    assert.equal(e.note, 'uncalibrated');
  });

  test('a calibrated distance exports in the display unit', () => {
    const { project, image, distance, dA, dB } = projectWithAngleAndDistance();
    setCalibration(project, { imageId: image.id, aId: dA.id, bId: dB.id, realLength: 20, unit: 'cm' });
    const r = readingsForImage(project, image.id).find((x) => x.id === distance.id);
    const e = readingExport(r);
    assert.equal(e.unit, 'cm');
    assert.equal(e.value, 20);
    assert.equal(e.note, '');
  });
});

describe('buildExportRows / buildExportCsv', () => {
  const opts = { date: '2026-11-16', subjectCode: 'ATL-07', photoNumber: 2 };

  test('the header is the generic table, with no club or battery columns', () => {
    assert.equal(CSV_HEADER, 'date,subject,photo,name,type,value,unit,uncertainty,quality,notes');
  });

  test('one row per measurement, named or not, in header order', () => {
    const { project, image, angle } = projectWithAngleAndDistance();
    setMeasurementLabel(project, angle.id, 'left knee');
    const rows = buildExportRows(readingsForImage(project, image.id), opts);
    assert.equal(rows.length, 2);
    const cells = rows.map((row) => row.split(','));
    const angleRow = cells.find((c) => c[4] === 'angle');
    assert.deepEqual(angleRow.slice(0, 7), ['2026-11-16', 'ATL-07', '2', 'left knee', 'angle', '90', 'deg']);
    const distanceRow = cells.find((c) => c[4] === 'distance');
    assert.equal(distanceRow[3], '');
    assert.equal(distanceRow[6], 'px');
    assert.equal(distanceRow[9], 'uncalibrated');
  });

  test('a name with a comma or a quote is quoted; a formula-looking one is neutralised', () => {
    const { project, image, angle, distance } = projectWithAngleAndDistance();
    setMeasurementLabel(project, angle.id, 'knee, left "good"');
    setMeasurementLabel(project, distance.id, '=SUM(A1)');
    const csv = buildExportCsv(readingsForImage(project, image.id), opts);
    assert.ok(csv.includes('"knee, left ""good"""'));
    assert.ok(csv.includes("'=SUM(A1)"));
  });

  test('buildExportCsv is the header plus the rows, ending in a newline', () => {
    const { project, image } = projectWithAngleAndDistance();
    const csv = buildExportCsv(readingsForImage(project, image.id), opts);
    const lines = csv.split('\n');
    assert.equal(lines[0], CSV_HEADER);
    assert.equal(lines.length, 4); // header, two rows, trailing empty after the final newline
    assert.equal(lines[3], '');
  });

  test('no measurements: just the header', () => {
    assert.equal(buildExportCsv([], opts), `${CSV_HEADER}\n`);
  });
});
