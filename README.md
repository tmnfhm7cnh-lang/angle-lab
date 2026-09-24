# angle-lab

Photographic biomechanical analysis: place points on a photo, measure angles and distances between
them, calibrate to real-world units, annotate and export.

Built for artistic-swimming, calisthenics and personal-training athletes. Runs as an installable PWA
on iPhone and iPad. No server, no accounts, no network — everything stays on the device.

## Status

Core usable through F5 (points, segments, angles, distances), published. F6's calibration engine
(real-world units) is implemented and tested but has no interface yet. LOTE 3 of the 2026-09-22
audit added persistence (IndexedDB, resumes the last project on reload) and PWA installability
(manifest, service worker, icon) — the two claims below are now actually true rather than
aspirational. F6's interface, export and the aesthetic pass are still open; see
`frentes/app-development/ESTADO.md` in the main system for the real up-to-date state.

## Documents

- [`docs/implementation-spec.md`](docs/implementation-spec.md) — architecture, module contracts,
  phase plan and acceptance criteria.

## Tests

```bash
npm test
```

No dependencies. Node's built-in test runner, run against `src/core/` only — that layer never
touches the DOM, which is what makes it testable outside a browser.

## Privacy

The athletes may be minors. There is no field anywhere for a person's name; subjects are identified
by code (`ATL-07`). No photograph of a real person is ever committed to this repository.
