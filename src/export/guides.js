/**
 * The real measurement guides — which named landmarks to tap, in order, and which angle or
 * distance each one feeds once they are all placed. Content Daniel confirmed, not invented here;
 * see ESTADO.md for what is still open.
 *
 * Body-generic on purpose, since 2026-09-27: a plan names a `key` ('flexion_rodilla') and a
 * `label` ('Knee flexion'), never a battery's test/metric pair — Daniel wants `angle-lab` sellable
 * on its own, not wired to AQUAMAD's private vocabulary. `puente` (bridge) and `espagat` (split)
 * are themselves gymnastics/dance terms, not swim-specific, so nothing here needed renaming; what
 * used to couple this file to AQUAMAD was only the `tag`, now gone. See
 * src/export/batteryTags.js for how (and whether) a `key` becomes an exported tag — that mapping,
 * not this file, is the only AQUAMAD-specific part of the whole guide feature.
 *
 * Seven guides today: `puente` (bridge), `espagat` (split), `puente_pierna` (bridge with one
 * leg raised), `aguante_v` (V-sit hold), `pierna_90` (leg raised backward to 90°),
 * `elevaciones_colgada` (hanging leg raises) and `flexion` (push-ups) — the last is the first
 * DISTANCE plan among these guides, not another ANGLE: `flexion`'s only photo metric
 * (`profundidad`, chest-to-floor depth) is `cm`, and F6's calibration UI still doesn't exist for
 * any image today, so this guide's distance always comes out in pixels with csvExport.js's
 * existing "sin calibrar" note, never a fabricated cm value — Daniel confirmed on 2026-09-28 he
 * wants it built anyway, so it starts giving real cm the moment F6 ships rather than waiting on
 * it. Every other guide below only builds angle metrics from catalogRef.js.
 * `puente`'s and `puente_pierna`'s `desviacion_brazo` (arm deviation from vertical) is a
 * different, still-open gap: it needs a real-world vertical reference tapped in the photo — Daniel
 * confirmed that approach on 2026-09-26, but it needs a new measurement kind (a segment's
 * orientation against a second, reference segment) that core/model.js does not have yet; see
 * ESTADO.md's "vertical de referencia" entry. That one is left out on purpose rather than guessed
 * at — every angle plan below is an ordinary three-point joint angle with neither this gap nor a
 * missing measurement kind.
 *
 * `flexion_codo` and `flexion_rodilla` (elbow/knee flexion) use the standard goniometry
 * definition — the angle at the joint between the bone above it and the bone below it — not a
 * choice specific to any battery. Same for `espagat`'s `flexion_rodilla`: the biblioteca's own
 * convention for split photos (`puntos-referencia-angulos-split-puente-pino.md`) already lists it
 * as the one optional angle "si se sospecha que compensa doblando la rodilla" — vertex knee, rays
 * to hip and ankle — and it is the only photo metric catalogRef.js registers for `espagat`
 * (pubis-to-floor and over-split are tape/cm, not photo/angle). `puente` and `espagat` are both
 * photographed from the side (`who`: "Foto lateral" / the split's own camera convention in the
 * same biblioteca doc — "de lado para split, puente y pino"), so one shoulder/elbow/wrist and one
 * hip/knee/ankle is what either photo actually shows — never both legs or both arms at once.
 *
 * `puente_pierna`'s own criterion says it plainly: "Mismo protocolo de foto que el puente: mismo
 * punto, misma altura de cámara" — the standing leg's knee flexion is the same construction as
 * `puente`'s, on the leg still on the ground. catalogRef.js registers no `flexion_codo` for
 * `puente_pierna` at all (unlike `puente`), so the elbow is not re-measured here — only the
 * standing leg's hip/knee/ankle.
 *
 * `aguante_v`'s `angulo_v` is not in the biblioteca's split/puente/pino doc (that doc only covers
 * those three positions), but its own description in metricas-continuas-bateria-seco.md #16 —
 * "Ángulo de la V en el mantenimiento (se abre con la fatiga)" — is the same trunk-to-leg hip
 * angle that doc already defines for `puente` and pino: vertex hip, one ray to the shoulder (trunk
 * direction), the other to the limit of the leg. The battery's own criterion has the legs "totalmente
 * estirados" (fully straight), so the leg ray goes to the ankle — same choice puntos-referencia
 * makes for pino when the leg is straight, not the knee fallback it lists for when the ankle isn't
 * visible. Nothing new invented: same construction, new body position.
 *
 * `pierna_90`'s `angulo_caida_atras` — another position outside the biblioteca doc — is the same
 * trunk-to-leg hip angle again, this time for the backward direction only (catalogRef.js has no
 * metric for the front/side directions: those are the compañera's stopwatch, not a photo).
 * bateria-test-seco-federacion-madrid.md's own text names the exact compensation this photo is
 * for: "Al pasar atrás, ligero movimiento del tronco hacia delante para conservar la altura" — the
 * trunk tilts forward to fake the height, so the number that catches it has to be measured from
 * the trunk, not from a fixed floor/vertical reference. Same shoulder-hip-ankle construction as
 * `aguante_v`, same reasoning: nothing here says the working leg is bent, so the ray goes to the
 * ankle, not the knee.
 *
 * `elevaciones_colgada`'s `angulo_maximo` is the one of the angle guides with the least guessing:
 * the battery's own criterion names the angle's two sides explicitly — "12 elevaciones por encima
 * de 90° respecto al tronco" — and bateria-test-seco-federacion-madrid.md's fuller version confirms
 * straight legs ("piernas juntas, apretadas, pies en punta") through the whole hold, including the
 * 5" "carpa" (pike) top position this photo is taken at. Same shoulder-hip-ankle construction, same
 * vertex, for the same reason as `aguante_v` and `pierna_90` — trunk and legs are exactly what a
 * hanging pike hold is judged on.
 *
 * `flexion`'s `profundidad` (chest-to-floor depth) needs only two landmarks, not three — a
 * DISTANCE plan, `a`/`b` instead of `a`/`vertex`/`c` (core/guides.js's `applyGuide` already
 * branches on `plan.kind` for this). The battery's own criterion is what the two landmarks are:
 * "profundidad pecho-suelo" at the bottom of the rep, so `chest` and `floor`, photographed at the
 * lowest point of the repetition — no goniometry convention needed, the metric name already says
 * where the two points go.
 */
export const GUIDES = [
  {
    id: 'puente',
    label: 'Bridge (puente)',
    landmarks: [
      { id: 'shoulder', label: 'Shoulder' },
      { id: 'elbow', label: 'Elbow' },
      { id: 'wrist', label: 'Wrist' },
      { id: 'hip', label: 'Hip' },
      { id: 'knee', label: 'Knee' },
      { id: 'ankle', label: 'Ankle' },
    ],
    plans: [
      { kind: 'angle', a: 'shoulder', vertex: 'elbow', c: 'wrist', key: 'flexion_codo', label: 'Elbow flexion' },
      { kind: 'angle', a: 'hip', vertex: 'knee', c: 'ankle', key: 'flexion_rodilla', label: 'Knee flexion' },
    ],
  },
  {
    id: 'espagat',
    label: 'Splits (espagat)',
    landmarks: [
      { id: 'hip', label: 'Hip' },
      { id: 'knee', label: 'Knee' },
      { id: 'ankle', label: 'Ankle' },
    ],
    plans: [
      { kind: 'angle', a: 'hip', vertex: 'knee', c: 'ankle', key: 'flexion_rodilla', label: 'Knee flexion' },
    ],
  },
  {
    id: 'puente_pierna',
    label: 'Bridge + raised leg (puente_pierna)',
    landmarks: [
      { id: 'hip', label: 'Hip' },
      { id: 'knee', label: 'Knee' },
      { id: 'ankle', label: 'Ankle' },
    ],
    plans: [
      { kind: 'angle', a: 'hip', vertex: 'knee', c: 'ankle', key: 'flexion_rodilla', label: 'Knee flexion' },
    ],
  },
  {
    id: 'aguante_v',
    label: 'V-hold (aguante_v)',
    landmarks: [
      { id: 'shoulder', label: 'Shoulder' },
      { id: 'hip', label: 'Hip' },
      { id: 'ankle', label: 'Ankle' },
    ],
    plans: [
      { kind: 'angle', a: 'shoulder', vertex: 'hip', c: 'ankle', key: 'angulo_v', label: 'V angle' },
    ],
  },
  {
    id: 'pierna_90',
    label: 'Leg at 90° (pierna_90)',
    landmarks: [
      { id: 'shoulder', label: 'Shoulder' },
      { id: 'hip', label: 'Hip' },
      { id: 'ankle', label: 'Ankle' },
    ],
    plans: [
      { kind: 'angle', a: 'shoulder', vertex: 'hip', c: 'ankle', key: 'angulo_caida_atras', label: 'Real backward angle' },
    ],
  },
  {
    id: 'elevaciones_colgada',
    label: 'Hanging leg raises (elevaciones_colgada)',
    landmarks: [
      { id: 'shoulder', label: 'Shoulder' },
      { id: 'hip', label: 'Hip' },
      { id: 'ankle', label: 'Ankle' },
    ],
    plans: [
      { kind: 'angle', a: 'shoulder', vertex: 'hip', c: 'ankle', key: 'angulo_maximo', label: 'Maximum angle' },
    ],
  },
  {
    id: 'flexion',
    label: 'Push-up (flexion)',
    landmarks: [
      { id: 'chest', label: 'Chest' },
      { id: 'floor', label: 'Floor' },
    ],
    plans: [
      { kind: 'distance', a: 'chest', b: 'floor', key: 'profundidad', label: 'Chest-to-floor depth' },
    ],
  },
];

export function findGuide(id) {
  return GUIDES.find((g) => g.id === id) || null;
}
