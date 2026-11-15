/**
 * The measurements of one photo as a plain table (CSV), one row per angle or distance, so it
 * opens in Numbers, Excel or Sheets. Generic on purpose: no club, no battery, no fixed list of
 * tests — what a row means is whatever the user named it.
 *
 * Columns: date, subject, photo, name, type, value, unit, uncertainty, quality, notes.
 * `unit` is 'deg' for an angle, the display unit for a calibrated distance, and 'px' for a
 * distance on a photo that has no calibration (with `notes` saying so): a length is never
 * invented from a scale that was never measured.
 *
 * Pure and DOM-free, same as core/ — testable in Node without a browser.
 */
import { evaluateAngle, evaluateDistance } from '../core/measurements.js';
import { decimalsForSigma } from '../core/uncertainty.js';

export const CSV_HEADER = 'date,subject,photo,name,type,value,unit,uncertainty,quality,notes';

// Quoting plus a formula guard: a cell that starts with = + - @ would run as a formula when the
// file is opened in a spreadsheet, and a name is free text the user typed.
function csvCell(v) {
  let s = String(v ?? '');
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/**
 * Every angle/distance measurement belonging to `imageId`, evaluated live (the same values the
 * canvas overlay shows), each with its own `name` ('' if the user never named it).
 */
export function readingsForImage(project, imageId) {
  const out = [];
  for (const measurement of project.measurements) {
    const name = measurement.label || '';
    if (measurement.type === 'angle') {
      const result = evaluateAngle(project, measurement.id);
      if (!result || result.vertex.imageId !== imageId) continue;
      out.push({ id: measurement.id, type: 'angle', name, ...result });
    } else if (measurement.type === 'distance') {
      const result = evaluateDistance(project, measurement.id);
      if (!result || result.a.imageId !== imageId) continue;
      out.push({ id: measurement.id, type: 'distance', name, ...result });
    }
  }
  return out;
}

/**
 * What one reading exports as: value and unit rounded to the number of decimals its own
 * uncertainty justifies, the uncertainty itself, the quality word, and a note when it is in
 * pixels for lack of a calibration.
 */
export function readingExport(r) {
  const isAngle = r.type === 'angle';
  const calibrated = !isAngle && Number.isFinite(r.real);
  const raw = isAngle ? r.degrees : calibrated ? r.real : r.pixels;
  const unit = isAngle ? 'deg' : calibrated ? r.unit : 'px';
  const sigma = isAngle ? r.sigmaDegrees : r.sigma;
  const decimals = decimalsForSigma(sigma);
  return {
    value: Number.isFinite(raw) ? Number(raw.toFixed(decimals)) : '',
    unit,
    uncertainty: Number.isFinite(sigma) ? sigma.toFixed(decimals > 0 ? decimals : 1) : '',
    quality: r.quality?.level || '',
    note: !isAngle && !calibrated ? 'uncalibrated' : '',
  };
}

export function buildExportRows(readings, { date = '', subjectCode = '', photoNumber = '' } = {}) {
  return readings.map((r) => {
    const e = readingExport(r);
    return [date, subjectCode, photoNumber, r.name, r.type, e.value, e.unit, e.uncertainty, e.quality, e.note]
      .map(csvCell)
      .join(',');
  });
}

export function buildExportCsv(readings, options) {
  return `${[CSV_HEADER, ...buildExportRows(readings, options)].join('\n')}\n`;
}
