/**
 * LOTE 3 §6: turns this image's tagged angle/distance measurements into CSV
 * rows matching dryland-test-logger's mediciones-2026-27.csv schema exactly
 * (fecha,atleta,categoria,prueba,metrica,valor,unidad,intentos,instrumento,
 * evaluador,observaciones), so they can land in the real system by the same
 * route that CSV already does — shared out of the browser, saved into the
 * OneDrive-synced folder by hand. Nothing here writes to that file directly:
 * a static site on GitHub Pages has no access to it, and no attempt is made
 * to pretend otherwise.
 *
 * Pure and DOM-free, same as core/ — testable in Node without a browser.
 */
import { evaluateAngle, evaluateDistance } from '../core/measurements.js';
import { decimalsForSigma } from '../core/uncertainty.js';
import { findMetric } from './catalogRef.js';

export const CSV_HEADER = 'fecha,atleta,categoria,prueba,metrica,valor,unidad,intentos,instrumento,evaluador,observaciones';

// Same escaping rule as dryland-test-logger/app.js's csvCell (formula-guard
// plus quoting) — duplicated rather than imported: the two apps' bundles
// are otherwise fully independent, and this is nine lines.
function csvCell(v) {
  let s = String(v ?? '');
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/**
 * Every angle/distance measurement belonging to `imageId`, evaluated live
 * (same values the canvas overlay shows) and carrying its own `tag` — the
 * {test, metric} pair set via setMeasurementTag, or null if never tagged.
 */
export function readingsForImage(project, imageId) {
  const out = [];
  for (const measurement of project.measurements) {
    if (measurement.type === 'angle') {
      const result = evaluateAngle(project, measurement.id);
      if (!result || result.vertex.imageId !== imageId) continue;
      out.push({ id: measurement.id, type: 'angle', tag: measurement.tag || null, ...result });
    } else if (measurement.type === 'distance') {
      const result = evaluateDistance(project, measurement.id);
      if (!result || result.a.imageId !== imageId) continue;
      out.push({ id: measurement.id, type: 'distance', tag: measurement.tag || null, ...result });
    }
  }
  return out;
}

/**
 * Rows for the tagged readings only — an untagged one is skipped rather
 * than exported with a blank prueba/metrica, which would look like real
 * data once pasted into the actual CSV. A distance with no calibration for
 * its image exports in pixels with unit 'px' and a note saying so, rather
 * than fabricating a calibrated cm value that was never measured.
 */
export function buildExportRows(readings, { date, subjectCode, category = '', evaluator = 'DJ' } = {}) {
  const rows = [];
  for (const r of readings) {
    if (!r.tag) continue;
    const catalogEntry = findMetric(r.tag.test, r.tag.metric);
    if (!catalogEntry) continue; // a tag pointing at an entry catalogRef.js no longer has

    const isAngle = r.type === 'angle';
    const calibrated = !isAngle && Number.isFinite(r.real);
    const value = isAngle ? r.degrees : calibrated ? r.real : r.pixels;
    const unit = isAngle ? catalogEntry.unit : calibrated ? catalogEntry.unit : 'px';
    const sigma = isAngle ? r.sigmaDegrees : r.sigma;
    const decimals = decimalsForSigma(sigma);

    const notes = [];
    if (!isAngle && !calibrated) notes.push(`sin calibrar: valor en pixeles, no ${catalogEntry.unit}`);
    if (Number.isFinite(sigma)) {
      const sigmaUnit = isAngle ? '°' : unit === 'px' ? 'px' : unit;
      notes.push(`σ≈${sigma.toFixed(decimals > 0 ? decimals : 1)}${sigmaUnit}`);
    }

    rows.push(
      [
        date,
        subjectCode,
        category,
        catalogEntry.test,
        catalogEntry.metric,
        Number.isFinite(value) ? Number(value.toFixed(decimals)) : '',
        unit,
        1,
        '',
        evaluator,
        notes.join(' · '),
      ]
        .map(csvCell)
        .join(',')
    );
  }
  return rows;
}

export function buildExportCsv(readings, options) {
  const rows = buildExportRows(readings, options);
  return `${[CSV_HEADER, ...rows].join('\n')}\n`;
}
