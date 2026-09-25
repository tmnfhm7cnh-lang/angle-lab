import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  createProject,
  addImage,
  addPoint,
  addAngle,
  addDistance,
  setCalibration,
  setMeasurementTag,
} from '../src/core/model.js';
import { readingsForImage, buildExportRows, buildExportCsv, CSV_HEADER } from '../src/export/csvExport.js';

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
  return { project, image, angle, distance };
}

describe('readingsForImage', () => {
  test('returns only measurements belonging to that image, each carrying its tag', () => {
    const { project, image, angle, distance } = projectWithAngleAndDistance();
    const otherImage = addImage(project, { width: 500, height: 500 });
    const p1 = addPoint(project, { imageId: otherImage.id, x: 0, y: 0 });
    const p2 = addPoint(project, { imageId: otherImage.id, x: 10, y: 0 });
    const p3 = addPoint(project, { imageId: otherImage.id, x: 0, y: 10 });
    addAngle(project, p1.id, p2.id, p3.id);

    setMeasurementTag(project, angle.id, { test: 'puente', metric: 'desviacion_brazo' });

    const readings = readingsForImage(project, image.id);
    assert.equal(readings.length, 2);
    const angleReading = readings.find((r) => r.id === angle.id);
    const distReading = readings.find((r) => r.id === distance.id);
    assert.deepEqual(angleReading.tag, { test: 'puente', metric: 'desviacion_brazo' });
    assert.equal(distReading.tag, null);
  });
});

describe('buildExportRows', () => {
  test('skips untagged readings entirely', () => {
    const { project, image } = projectWithAngleAndDistance();
    const rows = buildExportRows(readingsForImage(project, image.id), { date: '2026-09-25', subjectCode: 'ATL-07' });
    assert.equal(rows.length, 0);
  });

  test('exports a tagged angle in degrees, no calibration needed', () => {
    const { project, image, angle } = projectWithAngleAndDistance();
    setMeasurementTag(project, angle.id, { test: 'puente', metric: 'desviacion_brazo' });
    const rows = buildExportRows(readingsForImage(project, image.id), {
      date: '2026-09-25',
      subjectCode: 'ATL-07',
      category: 'infantil',
    });
    assert.equal(rows.length, 1);
    const cells = rows[0].split(',');
    assert.deepEqual(cells.slice(0, 7), ['2026-09-25', 'ATL-07', 'infantil', 'puente', 'desviacion_brazo', '90', 'grados']);
  });

  test('an uncalibrated distance exports in pixels, never a fabricated cm value', () => {
    const { project, image, distance } = projectWithAngleAndDistance();
    setMeasurementTag(project, distance.id, { test: 'puente_pierna', metric: 'altura_pie_der' });
    const rows = buildExportRows(readingsForImage(project, image.id), { date: '2026-09-25', subjectCode: 'ATL-07' });
    assert.equal(rows.length, 1);
    const cells = rows[0].split(',');
    assert.equal(cells[4], 'altura_pie_der');
    assert.equal(cells[6], 'px'); // unit column — not 'cm', because nothing calibrated this image
    assert.ok(rows[0].includes('sin calibrar'));
  });

  test('a calibrated distance exports in the catalogue unit (cm)', () => {
    const { project, image, distance } = projectWithAngleAndDistance();
    const refA = addPoint(project, { imageId: image.id, x: 0, y: 0, placementScale: 1 });
    const refB = addPoint(project, { imageId: image.id, x: 100, y: 0, placementScale: 1 });
    setCalibration(project, { imageId: image.id, aId: refA.id, bId: refB.id, realLength: 10, unit: 'cm' });
    setMeasurementTag(project, distance.id, { test: 'puente_pierna', metric: 'altura_pie_der' });
    const rows = buildExportRows(readingsForImage(project, image.id), { date: '2026-09-25', subjectCode: 'ATL-07' });
    const cells = rows[0].split(',');
    assert.equal(cells[6], 'cm');
    assert.ok(!rows[0].includes('sin calibrar'));
  });

  test('a tag pointing at an entry catalogRef.js does not recognise is skipped, not exported blank', () => {
    const { project, image, angle } = projectWithAngleAndDistance();
    setMeasurementTag(project, angle.id, { test: 'no-existe', metric: 'tampoco' });
    const rows = buildExportRows(readingsForImage(project, image.id), { date: '2026-09-25', subjectCode: 'ATL-07' });
    assert.equal(rows.length, 0);
  });

  test('an angle sigma note reads in degrees, never mixed with the catalogue unit', () => {
    const { project, image, angle } = projectWithAngleAndDistance();
    setMeasurementTag(project, angle.id, { test: 'puente', metric: 'desviacion_brazo' });
    const rows = buildExportRows(readingsForImage(project, image.id), { date: '2026-09-25', subjectCode: 'ATL-07' });
    assert.match(rows[0], /σ≈[\d.]+°(?!\/)/);
    assert.ok(!rows[0].includes('°/grados'));
  });

  test('defaults evaluator to DJ, matching dryland-test-loggers own default', () => {
    const { project, image, angle } = projectWithAngleAndDistance();
    setMeasurementTag(project, angle.id, { test: 'puente', metric: 'desviacion_brazo' });
    const rows = buildExportRows(readingsForImage(project, image.id), { date: '2026-09-25', subjectCode: 'ATL-07' });
    assert.equal(rows[0].split(',')[9], 'DJ');
  });
});

describe('buildExportCsv', () => {
  test('always includes the exact header row, even with zero tagged readings', () => {
    const { project, image } = projectWithAngleAndDistance();
    const csv = buildExportCsv(readingsForImage(project, image.id), { date: '2026-09-25', subjectCode: 'ATL-07' });
    assert.equal(csv.split('\n')[0], CSV_HEADER);
  });

  test('matches the real mediciones-2026-27.csv column order', () => {
    assert.equal(CSV_HEADER, 'fecha,atleta,categoria,prueba,metrica,valor,unidad,intentos,instrumento,evaluador,observaciones');
  });
});
