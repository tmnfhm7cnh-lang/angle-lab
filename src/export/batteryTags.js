/**
 * The only AQUAMAD-specific part of the whole measurement-guide feature: which of a guide's
 * generic angle keys (src/export/guides.js) maps to which test/metric of AQUAMAD's own battery
 * (dryland-test-logger's battery-aquamad.js), so a capture still auto-tags into
 * mediciones-2026-27.csv the way it does today.
 *
 * Deliberately separate from guides.js — added 2026-09-27 at Daniel's request: `angle-lab` should
 * be sellable as its own product, not an AQUAMAD-only tool, and a guide that hard-coded this
 * mapping into itself would have to be rebuilt for every other battery, or for no battery at all.
 * A build with a different battery swaps this file (or resolveTag's caller in src/ui/app.js) for
 * its own mapping; a build with none just never calls resolveAquamadTag, and guide-built
 * measurements come out untagged — same as a freeform angle drawn without a guide.
 */
const AQUAMAD_GUIDE_TAGS = {
  puente: {
    flexion_codo: { test: 'puente', metric: 'flexion_codo' },
    flexion_rodilla: { test: 'puente', metric: 'flexion_rodilla' },
  },
  espagat: {
    flexion_rodilla: { test: 'espagat', metric: 'flexion_rodilla' },
  },
  puente_pierna: {
    flexion_rodilla: { test: 'puente_pierna', metric: 'flexion_rodilla' },
  },
  aguante_v: {
    angulo_v: { test: 'aguante_v', metric: 'angulo_v' },
  },
  pierna_90: {
    angulo_caida_atras: { test: 'pierna_90', metric: 'angulo_caida_atras' },
  },
  elevaciones_colgada: {
    angulo_maximo: { test: 'elevaciones_colgada', metric: 'angulo_maximo' },
  },
};

export function resolveAquamadTag(guideId, planKey) {
  return AQUAMAD_GUIDE_TAGS[guideId]?.[planKey] ?? null;
}
