# angle-lab — implementation specification

**Audience: the engineer or model implementing this.** You have not seen the conversation that
produced it; everything you need is here.

Written 2026-09-13.

---

## 0. What this is

A Progressive Web App for photographic biomechanical analysis: load a photo, place points on it,
measure angles and distances between them, calibrate to real-world units, annotate, save and export.

Primary user: a strength and conditioning coach analysing artistic-swimming athletes, calisthenics
students and personal-training clients, on an iPhone and an iPad.

**Platform decision, already made and not open for revision:** vanilla JavaScript PWA, no build
step, no framework, no dependencies. The development environment is Windows, where native iOS can
be neither compiled nor tested, and shipping code that has never been compiled is not acceptable —
so the layered architecture below exists partly to keep all the mathematics verifiable off-device.

**Deployment target: GitHub Pages from a public repository**, served from a subdirectory
(`<user>.github.io/angle-lab/`). Every path in the app must therefore be **relative** — `./src/...`,
never `/src/...` — and the service worker's scope must be the subdirectory, not the domain root.

---

## 1. Non-negotiable rules

1. **No dependencies.** Not one. If a browser API exists, use it. No npm packages, no CDN scripts,
   no build step. Source files are served as-is.
2. **The dependency rule:** `core` imports nothing. `render` imports `core`. `ui` imports `core` and
   `render`. `io` imports `core`. Never the reverse. `core` must never reference `document`,
   `window`, `navigator` or `canvas` — it is tested in Node, where none of those exist.
3. **No names, ever.** There is no field anywhere for a person's name. Subjects are identified by
   code (`ATL-07`). The athletes may be minors. Do not add a name field even if it seems convenient.
4. **No photo of a real person is ever committed to git.** Generate synthetic test images.
5. **Measurements store references, never computed values.** An angle stores three point ids. The
   number is derived on read, every time.
6. **The model lives in image coordinates only.** Zoom, pan, screen size and orientation must not be
   able to change a stored coordinate.
7. **No internal rounding.** Round only when formatting for display.
8. **Run the tests after every change.** `npm test`.

---

## 2. Current state

```
angle-lab/
  package.json              type: module, no dependencies, test script
  docs/
    implementation-spec.md  this file
  src/core/
    geometry.js             ✔ IMPLEMENTED
  test/
    geometry.test.js        ✔ 49 tests, all passing
```

Run the tests:

```bash
npm test
```

Note: `node --test test/` fails under Git Bash on Windows — the trailing slash is stripped and Node
treats `test` as a module path. The `npm test` script uses a quoted glob, which works. To run one
file: `node --test test/geometry.test.js`.

### 2.1 `core/geometry.js` — implemented API

All functions are pure and take/return plain `{x, y}` objects.

| Function | Returns |
|---|---|
| `point(x, y)` | `{x, y}` |
| `subtract(a, b)` | vector `a - b` |
| `dot(u, v)` | scalar product |
| `cross(u, v)` | z of the 3D cross product |
| `magnitude(v)` | length of a vector |
| `distance(a, b)` | euclidean distance (`Math.hypot`) |
| `midpoint(a, b)` | `{x, y}` |
| `angleAtVertex(a, b, c)` | interior angle at `b`, degrees, `[0, 180]` |
| `signedAngleAtVertex(a, b, c)` | same magnitude, signed, `(-180, 180]` |
| `lineOrientation(a, b)` | direction of `a→b` vs horizontal, `(-180, 180]` |
| `angleBetweenLines(a1, a2, b1, b2)` | undirected angle between two lines, `[0, 90]` |
| `normalizeDegrees(deg)` | wraps into `(-180, 180]` |
| `distanceToLine(p, a, b)` | perpendicular distance to the infinite line |
| `distanceToSegment(p, a, b)` | distance to the finite segment (hit-testing primitive) |

Constants: `RAD_TO_DEG`, `DEG_TO_RAD`.

**Conventions baked in — preserve them:**

- Image space: origin top-left, X right, **Y down**.
- Angles are reported as a person sees them in the photo: counter-clockwise positive, up positive.
  This is why the signed functions flip Y.
- **Degenerate input returns `NaN`, it does not throw.** A point can be dragged on top of another
  mid-gesture; throwing there would tear down the render loop. Propagate `NaN` and let the UI show
  no value.
- `angleAtVertex` uses `atan2(|cross|, dot)`, **not** `acos(dot/(|u||v|))`. The `acos` form loses
  most of its significant digits near 0° and 180°, which is exactly where a nearly-straight limb is
  measured. Do not "simplify" it back.
- Watch IEEE negative zero. `-dy` where `dy === 0` produces `-0`, and `atan2(-0, negative)` returns
  −180 instead of +180. The code writes `0 - dy`. This was a real bug caught by the tests.

---

## 3. Modules to implement

Signatures are the contract. Implement exactly these; add helpers freely but keep these stable.

### 3.1 `core/units.js`

```js
export const UNITS = { mm: 1, cm: 10, m: 1000, in: 25.4 }; // millimetres per unit
export function isValidUnit(unit)                  // → boolean
export function toMillimetres(value, unit)         // → number, NaN if unit invalid
export function fromMillimetres(mm, unit)          // → number
export function convert(value, fromUnit, toUnit)   // → number
export function formatLength(value, unit, decimals = 1)  // → '12.4 cm'
export function formatAngle(degrees, decimals = 1)       // → '127.4°', '—' if NaN
```

Tests: every pair-wise conversion round-trips; `convert(1, 'in', 'mm') === 25.4`;
`convert(100, 'cm', 'm') === 1`; invalid unit yields `NaN`; formatting rounds for display only.

### 3.2 `core/calibration.js`

Calibration is a scale factor derived from a known real length spanning a known pixel length.
Keep both numbers, never only the ratio — the reference points can be moved and the scale must be
recomputable.

```js
export function millimetresPerPixel(realLength, unit, pixelLength)
  // → mm/px; NaN if pixelLength <= 0, realLength <= 0, or unit invalid
export function pixelsToReal(pixels, mmPerPixel, targetUnit)  // → number, NaN if uncalibrated
export function realToPixels(value, unit, mmPerPixel)         // → number
export function isCalibrated(mmPerPixel)                      // → boolean, finite and > 0
```

Tests: the spec example — 100 cm over 734 px → `1000/734` mm/px; a 367 px segment then reads 50 cm;
round-trip `realToPixels(pixelsToReal(p))` returns `p`; zero and negative pixel length give `NaN`;
different units give consistent results; very large and very small scales stay accurate.

### 3.3 `core/viewport.js`

```js
export function createViewport({ scale = 1, tx = 0, ty = 0, rotation = 0 } = {})
export function imageToView(p, vp)          // → {x, y} in view space
export function viewToImage(p, vp)          // → {x, y} in image space
export function imageToViewLength(len, vp)  // → len * scale
export function viewToImageLength(len, vp)  // → len / scale
export function fitImage(imageSize, viewSize, padding = 0)   // → viewport that centres and fits
export function zoomAt(vp, viewAnchor, factor, { minScale = 0.05, maxScale = 50 } = {})
export function panBy(vp, dxView, dyView)
export function clampToBounds(vp, imageSize, viewSize)  // keeps some image on screen
```

`rotation` is in degrees and **stays 0 for the MVP**, but every function must already handle it
correctly — it exists so that adding rotation later does not require rewriting the transform.

**`zoomAt` is the critical one.** It scales around a fixed anchor given in view coordinates, so the
image point under the user's fingers does not move. The defining test:

```js
const before = viewToImage(anchor, vp);
const after  = viewToImage(anchor, zoomAt(vp, anchor, 2.5));
// before and after must be equal to within 1e-9
```

Other tests: `viewToImage(imageToView(p))` round-trips for many points, scales and translations,
including negative coordinates and non-integer scales; `fitImage` centres a wide image in a tall
viewport and a tall image in a wide one; `zoomAt` respects `minScale`/`maxScale`; `panBy` moves by
exactly the requested view distance regardless of scale; length conversions match the point
transform.

### 3.4 `core/model.js`

Plain serializable objects. Ids are strings — use `crypto.randomUUID()` where available with a
counter-based fallback, wrapped in a function inside this module so tests can be deterministic.

```js
export const SCHEMA_VERSION = 1;

export function createProject({ subjectCode = '', title = '' } = {})
export function addImage(project, { blobKey, width, height, exifOrientation, capturedAt })
export function addPoint(project, { imageId, x, y, label = '', source = 'manual', landmark = null })
export function movePoint(project, pointId, x, y)
export function removePoint(project, pointId)   // cascades — see below
export function addSegment(project, aId, bId)
export function addAngle(project, aId, vertexId, cId)
export function addDistance(project, aId, bId)
export function setCalibration(project, { imageId, aId, bId, realLength, unit })
export function clearCalibration(project)
export function addAnnotation(project, { imageId, x, y, text })
export function updateAnnotation(project, id, text)
export function removeEntity(project, id)       // dispatches by entity type
export function getPoint(project, id)
export function serialize(project)              // → JSON-safe object
export function deserialize(data)               // → project, throws on unknown schemaVersion
```

**Cascade rule, and it must be tested:** removing a point removes every segment, angle, distance and
calibration that references it. A dangling reference must never exist in a saved project. Removing a
measurement does **not** remove its points — the points are independent entities the user placed.

Every mutating function updates `project.updatedAt`.

Entity shapes:

```
AnalysisProject     id · createdAt · updatedAt · schemaVersion · subjectCode · title · notes
                    images[] · activeImageId
                    points[] · segments[] · measurements[] · annotations[] · calibration
Point               id · imageId · x · y · label · source · landmark
Segment             id · aId · bId
AngleMeasurement    id · type:'angle' · vertexId · aId · cId
DistanceMeasurement id · type:'distance' · aId · bId
Calibration         id · imageId · aId · bId · realLength · unit
TextAnnotation      id · imageId · x · y · text
ImageReference      id · blobKey · width · height · exifOrientation · capturedAt
```

`images` is an array from day one even though the MVP only ever puts one image in it: a video frame
is later just an `ImageReference` carrying `videoId` and `frameIndex`, which extends the model
instead of rewriting it. `source` and `landmark` on `Point` exist so that
automatically detected landmarks can later become ordinary points; nothing in the MVP writes
anything but `'manual'` and `null`.

### 3.5 `core/measurements.js`

```js
export function evaluateAngle(project, measurementId)
  // → { degrees, signedDegrees, vertex, a, c } | null if any point is missing
export function evaluateDistance(project, measurementId)
  // → { pixels, real, unit, a, b } ; real is NaN when uncalibrated
export function evaluateSegment(project, segmentId)
  // → { pixels, real, unit, orientation, a, b }
export function evaluateAll(project)   // → Map<id, result>
```

Nothing here caches. Tests: moving a point changes the derived value immediately; a measurement
whose point was deleted evaluates to `null` rather than throwing; distances read `NaN` for `real`
until a calibration exists, and the correct value after.

### 3.6 `core/hittest.js`

```js
export function hitTest(project, imagePoint, toleranceImage, imageId)
  // → { type: 'point'|'annotation'|'segment', id, distance } | null
```

Priority order: points first, then annotations, then segments. Among candidates of the same type,
the nearest wins. `toleranceImage` is a radius **in image units**, which the UI computes as
`viewToImageLength(TOUCH_RADIUS_CSS_PX, viewport)` — see §4.

---

## 4. UI and rendering notes that will bite you

These are the things that break this class of app. They are not optional polish.

**Touch radius.** The grab radius is defined in **view space** (22 CSS px, roughly a fingertip) and
converted to image space by dividing by `scale`. Defining it in image space makes points impossible
to hit at high zoom and makes three points overlap at low zoom.

**Overlays transform but do not scale.** A point marker is 8 CSS px at 1× and at 20×. Line widths,
marker radii, label sizes and arc radii are all constants in view space. If overlays scaled with the
image, zooming in to place a point precisely would make the marker cover the thing being measured —
destroying the only reason to zoom.

**EXIF orientation.** iPhone photos carry a rotation flag rather than rotated pixels. Decode with
`createImageBitmap(blob, { imageOrientation: 'from-image' })` and store the resulting bitmap's
`width`/`height` as the image's dimensions. If this is skipped, every point lands rotated relative to
what the user sees. Verify on a real iPhone photo taken in portrait.

**Canvas size limits.** iOS Safari caps total canvas area, and a 48 MP photo exceeds it. Keep a
downscaled bitmap (longest side around 2048 px) for interactive drawing and only touch the full
resolution image when composing the export. Points are stored in original-image coordinates either
way, so precision is unaffected. *Treat the exact cap as unverified and defensive: measure it on the
device rather than trusting a number from memory.*

**Device pixel ratio.** Size the canvas backing store to `cssSize * devicePixelRatio` and scale the
2D context, or everything looks soft on a Retina screen.

**Gestures.** Use Pointer Events, not Touch Events. Set `touch-action: none` on the canvas, and call
`preventDefault()` — otherwise Safari scrolls and page-zooms underneath the app. Implement pinch-zoom
from two simultaneous pointers rather than Safari's proprietary `gesturestart`/`gesturechange`.
Detect the Pencil with `pointerType === 'pen'`; use `getCoalescedEvents()` for smooth fast drags.

**The magnifier.** While dragging a point with a finger, the finger covers the point. Show a floating
loupe with the magnified region and a crosshair, offset from the contact position. Without it the app
is unusable by finger and only works with a Pencil. Suppress it when `pointerType === 'pen'`.

**Viewport height.** Use `100dvh`, not `100vh` — iOS Safari's toolbar makes `vh` wrong.

**Contrast over sports photos.** Draw every overlay twice: a dark halo underneath, the bright stroke
on top. This stays legible over both a dark swimsuit and bright water without per-photo colour
choices. Selected elements differ from unselected ones by an added ring and a heavier stroke, not by
colour alone.

**Angle rendering.** An angle draws an arc between the two rays at a fixed view-space radius, the
numeric value near the arc, and an emphasised vertex marker. Use `signedDegrees` to decide which of
the two possible arcs to sweep. Place the label outside the arc, offset along the angle bisector, and
keep it upright regardless of the geometry — never draw rotated text.

**Storage.** IndexedDB, native API, no wrapper. Photos as `Blob` in one store, projects as JSON in
another. `localStorage` is ~5 MB and a single iPhone photo is 3–5 MB, so it is not an option.
Autosave on a debounce, not on every pointer move.

**Export.** Compose onto an offscreen canvas at full original resolution: the image first, then the
overlay layer re-rendered with a viewport that maps image space 1:1, with overlay constants scaled up
proportionally so the export does not come out with hairline strokes. Show a warning before saving to
the photo library — the export leaves the controlled environment because iCloud syncs it.

---

## 5. Phases and acceptance criteria

Finish each phase with tests passing before starting the next.

| Phase | Deliverable | Accepted when |
|---|---|---|
| **F0** ✔ | `core/geometry.js` | 49 tests pass |
| **F1** | `core/units.js`, `core/calibration.js`, `core/viewport.js` | The `zoomAt` anchor-invariance test passes, plus round-trip tests for units and coordinates |
| **F2** | `core/model.js`, `core/measurements.js`, `core/hittest.js` | Cascade delete leaves no dangling reference; a moved point changes its angle with no explicit recompute call |
| **F3** | `index.html`, canvas, load photo from library or camera, pinch-zoom and pan | A portrait iPhone photo appears upright and correctly sized; zoom holds the anchor under the fingers |
| **F4** | Point tool: create, select, drag, delete, with magnifier | A point stays on the same anatomical feature after zooming, panning and rotating the device |
| **F5** | Segments, angles, distances in pixels, with overlay rendering | **Usable milestone.** Three points on a photo read a live angle that updates while dragging |
| **F6** | Calibrate tool and real-world distances | A known 1 m reference makes a second measurement read the correct length in cm, mm, m and in |
| **F7** | Text annotations, IndexedDB persistence, PNG export | An analysis survives a full app restart; the exported PNG matches what is on screen at full resolution |
| **F8** | `manifest.json`, service worker, offline, installable | Installs to the iPhone home screen and opens with no network |

**F5 is the recommended cut for first real use.** It answers the question that motivated the app —
what angle is this athlete's position — without persistence or export.

Out of scope for the MVP, listed so it does not creep in: video and frames, automatic person
detection, point tracking, ROM and angular velocity, multiple images per analysis in the UI (the
model supports it, the interface does not expose it), and image rotation (the transform supports it,
the MVP leaves it at 0).

---

## 6. Verification without a device

`core` is tested in Node and that covers all the mathematics. For the UI layers, test in a desktop
browser with device emulation and touch simulation, then confirm on the real iPhone before calling a
phase done. State plainly which of the two was used — a phase verified only in a desktop browser is
not verified for iOS.

Do not report a phase complete on the grounds that it compiles or that the code looks right.
