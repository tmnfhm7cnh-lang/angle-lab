import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { scaleChipState, projectChipInfo, describeReadout } from '../src/core/statusDisplay.js';

describe('scaleChipState', () => {
  test('calibrated: shows the scale', () => {
    assert.deepEqual(scaleChipState({ calibrated: true, mmPerPixel: 0.42, hasDistance: false }), {
      kind: 'calibrated',
      mmPerPixel: 0.42,
    });
  });

  test('not calibrated but a distance is on the photo: warns', () => {
    assert.deepEqual(scaleChipState({ calibrated: false, mmPerPixel: NaN, hasDistance: true }), { kind: 'uncalibrated' });
  });

  test('not calibrated and no distance: hidden (nothing needs a scale)', () => {
    assert.deepEqual(scaleChipState({ calibrated: false, mmPerPixel: NaN, hasDistance: false }), { kind: 'hidden' });
  });

  test('calibrated wins over having distances', () => {
    assert.equal(scaleChipState({ calibrated: true, mmPerPixel: 1, hasDistance: true }).kind, 'calibrated');
  });
});

describe('projectChipInfo', () => {
  test('subject code and the active photo position', () => {
    const project = { subjectCode: 'ATL-07', images: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], activeImageId: 'b' };
    assert.deepEqual(projectChipInfo(project), { subjectCode: 'ATL-07', photoNumber: 2, photoCount: 3 });
  });

  test('no photos: position 0 of 0', () => {
    assert.deepEqual(projectChipInfo({ subjectCode: '', images: [], activeImageId: null }), {
      subjectCode: '',
      photoNumber: 0,
      photoCount: 0,
    });
  });

  test('an active id that is not in the list gives position 0', () => {
    assert.equal(projectChipInfo({ subjectCode: '', images: [{ id: 'a' }], activeImageId: 'zzz' }).photoNumber, 0);
  });

  test('missing subject code becomes an empty string', () => {
    assert.equal(projectChipInfo({ images: [], activeImageId: null }).subjectCode, '');
  });
});

describe('describeReadout', () => {
  test('null for nothing selected', () => {
    assert.equal(describeReadout(null), null);
    assert.equal(describeReadout(undefined), null);
  });

  test('angle: value, sigma line and quality', () => {
    const r = describeReadout({ type: 'angle', degrees: 128.43, sigmaDegrees: 0.4, quality: { level: 'good' } });
    assert.deepEqual(r, {
      labelKey: 'wordAngle',
      value: '128.4°',
      sigmaText: '±0.4°',
      qualityKey: 'qualityGood',
      level: 'good',
    });
  });

  test('angle with a coarse sigma drops decimals on both value and sigma', () => {
    const r = describeReadout({ type: 'angle', degrees: 128.43, sigmaDegrees: 2.7, quality: { level: 'poor' } });
    assert.equal(r.value, '128°');
    assert.equal(r.sigmaText, '±3°');
    assert.equal(r.qualityKey, 'qualityPoor');
  });

  test('calibrated distance reads in real units', () => {
    const r = describeReadout({
      type: 'distance',
      pixels: 100,
      real: 42.1,
      unit: 'cm',
      sigma: 0.2,
      quality: { level: 'ok' },
    });
    assert.deepEqual(r, {
      labelKey: 'wordDistance',
      value: '42.1 cm',
      sigmaText: '±0.2 cm',
      qualityKey: 'qualityOk',
      level: 'ok',
    });
  });

  test('uncalibrated distance falls back to pixels', () => {
    const r = describeReadout({ type: 'distance', pixels: 100.04, real: NaN, unit: 'cm', sigma: 1.4, quality: { level: 'ok' } });
    assert.equal(r.value, '100.0 px');
    assert.equal(r.sigmaText, '±1 px');
  });

  test('a non-finite sigma leaves the sigma text empty', () => {
    const r = describeReadout({ type: 'angle', degrees: 90, sigmaDegrees: NaN, quality: { level: 'poor' } });
    assert.equal(r.sigmaText, '');
  });
});
