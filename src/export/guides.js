/**
 * The real measurement guides — which named landmarks to tap, in order, and which angle or
 * distance each one feeds once they are all placed. Content Daniel confirmed, not invented here;
 * see ESTADO.md for what is still open.
 *
 * Only one guide today: `puente` (bridge), and only two of its three photo metrics from
 * catalogRef.js. `desviacion_brazo` (arm deviation from vertical) needs a real-world vertical
 * reference tapped in the photo — Daniel confirmed that approach on 2026-09-26, but it needs a
 * new measurement kind (a segment's orientation against a second, reference segment) that
 * core/model.js does not have yet; see ESTADO.md's "vertical de referencia" entry. Left out on
 * purpose rather than guessed at — the two included here (elbow and knee flexion) are ordinary
 * three-point joint angles with no such gap.
 *
 * `flexion_codo` (elbow flexion) and `flexion_rodilla` (knee flexion) use the standard goniometry
 * definition — the angle at the joint between the bone above it and the bone below it — not a
 * choice specific to this battery. `puente`'s own criterion (battery-aquamad.js: "Brazos
 * perpendiculares al suelo y codos estirados... piernas juntas y rodillas estiradas") is a single
 * side of the body, photographed from the side ("Foto lateral" — puente's own `who` field), so
 * one shoulder/elbow/wrist and one hip/knee/ankle is what the photo actually shows.
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
      { kind: 'angle', a: 'shoulder', vertex: 'elbow', c: 'wrist', tag: { test: 'puente', metric: 'flexion_codo' } },
      { kind: 'angle', a: 'hip', vertex: 'knee', c: 'ankle', tag: { test: 'puente', metric: 'flexion_rodilla' } },
    ],
  },
];

export function findGuide(id) {
  return GUIDES.find((g) => g.id === id) || null;
}
