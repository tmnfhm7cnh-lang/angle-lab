/**
 * The measurement guides: for each position, which named landmarks to tap in order and which
 * angle each plan builds once they are all placed. Four of them, the positions most often worth
 * measuring: handstand, bridge, front split and side split.
 *
 * This file is data only, with no visible text. Every name and every paragraph goes through
 * src/i18n/strings.js by key:
 *   guide.<id>            title of the guide
 *   guide.<id>.camera     how to take the photo
 *   guide.<id>.read       how to read the angles it gives
 *   guide.<id>.extra      an optional extra angle (guides that have one)
 *   landmark.<id>         name of a landmark
 *   landmark.<id>.where   where exactly it is on the body
 *   measure.<key>         name given to the measurement a plan builds
 * Landmark ids are shared between guides ('shoulder', 'hip', 'ankle', ...), so their texts are
 * written once.
 *
 * Conventions (biblioteca/entrenamiento-general/puntos-referencia-angulos-split-puente-pino.md):
 * standard 2D goniometry on a photo. The bony landmarks are the same for every position, the
 * three points of an angle must be on the same side of the body, and the camera must be
 * perpendicular to the plane of the movement — otherwise the angle that comes out is a projected
 * one, smaller than the real one. The 180° that the texts mention is a coaching reference (a
 * straight line, an extended hip), not a clinical range.
 *
 * `split_side` is the straddle split, photographed from the front. That one extends the same
 * convention to the other plane (the legs open sideways, so the camera goes in front); the
 * vertex is the point where the legs meet, which is not one of the bony landmarks of the table
 * above.
 */
export const GUIDES = [
  {
    id: 'handstand',
    landmarks: [{ id: 'wrist' }, { id: 'shoulder' }, { id: 'hip' }, { id: 'ankle' }],
    plans: [
      { kind: 'angle', a: 'hip', vertex: 'shoulder', c: 'wrist', key: 'shoulder' },
      { kind: 'angle', a: 'shoulder', vertex: 'hip', c: 'ankle', key: 'hip' },
    ],
  },
  {
    id: 'bridge',
    landmarks: [{ id: 'wrist' }, { id: 'shoulder' }, { id: 'hip' }, { id: 'knee' }],
    plans: [
      { kind: 'angle', a: 'hip', vertex: 'shoulder', c: 'wrist', key: 'shoulder' },
      { kind: 'angle', a: 'shoulder', vertex: 'hip', c: 'knee', key: 'hip' },
    ],
  },
  {
    id: 'split_front',
    landmarks: [{ id: 'shoulder' }, { id: 'hip' }, { id: 'ankle_front' }, { id: 'ankle_back' }],
    plans: [
      { kind: 'angle', a: 'ankle_front', vertex: 'hip', c: 'ankle_back', key: 'split_total' },
      { kind: 'angle', a: 'shoulder', vertex: 'hip', c: 'ankle_back', key: 'back_hip' },
    ],
  },
  {
    id: 'split_side',
    landmarks: [{ id: 'ankle_one' }, { id: 'crotch' }, { id: 'ankle_other' }],
    plans: [{ kind: 'angle', a: 'ankle_one', vertex: 'crotch', c: 'ankle_other', key: 'split_total' }],
  },
];

// Guides that have an optional extra angle described in their `.extra` text.
export const GUIDES_WITH_EXTRA = ['handstand', 'bridge', 'split_front'];
