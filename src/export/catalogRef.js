/**
 * LOTE 3 §6: which dryland-test-logger catalogue entries a photo analysis in
 * angle-lab can plausibly fill — the `atHome` metrics of type `deg` or `cm`,
 * read straight from frentes/app-development/dryland-test-logger/catalog.js
 * on 2026-09-25. Excluded on purpose:
 * - squat_jump's altura_mejor_salto/reps_sobre_20cm (tag: 'myjumplab' —
 *   that data comes from MyJumpLab's video analysis, not a static photo).
 * - squat_jump's fallos_tecnicos (type 'count', a rep count from video, not
 *   a geometric measurement angle-lab has any way to produce).
 *
 * THIS IS A DUPLICATED SNAPSHOT, not a live import — catalog.js is the only
 * source of truth for the real battery, and it can change without this file
 * changing with it. LOTE 5 §1 plans to replace both catalog.js's hardcoding
 * and this duplication with one shared, importable battery document; until
 * then, if a test/metric name is renamed or removed in catalog.js, cross-
 * check it here too, or the CSV this exports will carry a stale label or an
 * id the real catalogue no longer recognises.
 *
 * `unit` is always the catalogue's own unit string ('grados' or 'cm') so a
 * CSV row can copy it verbatim — never a guess.
 */
export const PHOTO_METRICS = [
  { test: 'espagat', testLabel: 'Splits (espagat)', metric: 'flexion_rodilla', metricLabel: 'Knee flexion (flexion_rodilla)', unit: 'grados' },
  { test: 'puente', testLabel: 'Bridge (puente)', metric: 'desviacion_brazo', metricLabel: 'Arm deviation (desviacion_brazo)', unit: 'grados' },
  { test: 'puente', testLabel: 'Bridge (puente)', metric: 'flexion_codo', metricLabel: 'Elbow flexion (flexion_codo)', unit: 'grados' },
  { test: 'puente', testLabel: 'Bridge (puente)', metric: 'flexion_rodilla', metricLabel: 'Knee flexion (flexion_rodilla)', unit: 'grados' },
  { test: 'puente_pierna', testLabel: 'Bridge + raised leg (puente_pierna)', metric: 'altura_pie_der', metricLabel: 'Right foot height (altura_pie_der)', unit: 'cm' },
  { test: 'puente_pierna', testLabel: 'Bridge + raised leg (puente_pierna)', metric: 'altura_pie_izq', metricLabel: 'Left foot height (altura_pie_izq)', unit: 'cm' },
  { test: 'puente_pierna', testLabel: 'Bridge + raised leg (puente_pierna)', metric: 'desviacion_brazo', metricLabel: 'Arm deviation (desviacion_brazo)', unit: 'grados' },
  { test: 'puente_pierna', testLabel: 'Bridge + raised leg (puente_pierna)', metric: 'flexion_rodilla', metricLabel: 'Knee flexion (flexion_rodilla)', unit: 'grados' },
  { test: 'aguante_v', testLabel: 'V-hold (aguante_v)', metric: 'angulo_v', metricLabel: 'V angle (angulo_v)', unit: 'grados' },
  { test: 'pierna_90', testLabel: 'Leg at 90° (pierna_90)', metric: 'angulo_caida_atras', metricLabel: 'Real backward angle (angulo_caida_atras)', unit: 'grados' },
  { test: 'elevaciones_colgada', testLabel: 'Hanging leg raises (elevaciones_colgada)', metric: 'angulo_maximo', metricLabel: 'Maximum angle (angulo_maximo)', unit: 'grados' },
  { test: 'flexion', testLabel: 'Push-ups (flexion)', metric: 'profundidad', metricLabel: 'Chest-to-floor depth (profundidad)', unit: 'cm' },
];

// grados metrics come from an ANGLE measurement (no calibration needed); cm
// metrics come from a DISTANCE measurement (needs this image's calibration,
// see calibration.js — F6 has no UI yet, so today these will only ever be
// reachable in pixels, not real cm).
export function kindForUnit(unit) {
  return unit === 'grados' ? 'angle' : 'distance';
}

export function metricsForKind(kind) {
  return PHOTO_METRICS.filter((m) => kindForUnit(m.unit) === kind);
}

export function testLabelsForKind(kind) {
  const seen = new Map();
  for (const m of metricsForKind(kind)) {
    if (!seen.has(m.test)) seen.set(m.test, m.testLabel);
  }
  return Array.from(seen, ([test, testLabel]) => ({ test, testLabel }));
}

export function findMetric(test, metric) {
  return PHOTO_METRICS.find((m) => m.test === test && m.metric === metric) || null;
}
