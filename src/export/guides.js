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
 * Three guides today: `puente` (bridge), `espagat` (split) and `puente_pierna` (bridge with one
 * leg raised) — and only their angle photo metrics from catalogRef.js — no `cm` metric is
 * buildable yet (those are DISTANCE measurements, and F6's calibration UI doesn't exist yet:
 * without it a distance only ever comes out in pixels, never real cm — see catalogRef.js).
 * `puente`'s and `puente_pierna`'s `desviacion_brazo` (arm deviation from vertical) is a second,
 * separate gap: it needs a real-world vertical reference tapped in the photo — Daniel confirmed
 * that approach on 2026-09-26, but it needs a new measurement kind (a segment's orientation
 * against a second, reference segment) that core/model.js does not have yet; see ESTADO.md's
 * "vertical de referencia" entry. Both gaps are left out on purpose rather than guessed at — every
 * plan below is an ordinary three-point joint angle with neither gap.
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
];

export function findGuide(id) {
  return GUIDES.find((g) => g.id === id) || null;
}
