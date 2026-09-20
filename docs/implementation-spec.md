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

**Coordinate relationship (image ↔ view ↔ original photo).** A point's `x, y` are always stored in
*original-image* pixel space — the same space as `image.imageSize`, which is the EXIF-corrected
full-resolution dimensions of the source photo. Two other bitmaps exist purely for drawing and never
redefine what a coordinate means: the **display bitmap** (longest side ≤ 2048 px, used for the
on-screen canvas because iOS Safari caps total canvas area) and the **device backing store**
(`cssSize × devicePixelRatio`, used only so the canvas looks sharp on Retina screens). Converting a
screen tap to a stored point goes screen → CSS/view px (via `getBoundingClientRect`) → image px (via
`viewToImage`, using only `viewport.scale/tx/ty`) — the display bitmap's resolution and the device
pixel ratio never enter that formula. Verified numerically during the 2026-09-13 audit: a point placed
while viewing a 48 MP photo through its 2048 px display bitmap landed at the mathematically exact
original-image coordinate, to at least 13 significant figures — precision does not depend on the
downscaled bitmap or on screen DPI.

**Touch radius.** The grab radius is defined in **view space** (22 CSS px, roughly a fingertip) and
converted to image space by dividing by `scale`. Defining it in image space makes points impossible
to hit at high zoom and makes three points overlap at low zoom. **Consequence, not a bug:** in SELECT
mode, starting a pan gesture within that radius of an existing point drags the point instead of
panning the view — hit-test priority (spec: points before annotations before segments) applies to the
first pointer of any gesture. If a "why did my point move" report ever comes in, this is why.

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
| **F6** | Calibrate tool and real-world distances — **full spec in §7** | A known 1 m reference makes a second measurement read the correct length in cm, mm, m and in |
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

---

## 7. Phase F6 — calibrate tool and real-world units

**Everything the mathematics needs already exists and is tested**: `core/units.js`,
`core/calibration.js`, `model.setCalibration/clearCalibration`, the cascade that drops the
calibration when one of its reference points is deleted, and `measurements.realValueFor`, which
already turns a pixel length into a real one. `canvasRenderer.drawDistances` already prints the real
length when it is finite. F6 is therefore a UI phase plus **one small, necessary core change**.

### 7.1 The core change: display unit is not the calibration unit

`realValueFor` currently returns the length in `calibration.unit` — the unit the reference was
entered in. That makes F6's acceptance criterion unreachable: a 1 m reference entered in metres can
only ever read metres, so a 12 cm forearm displays as `0.1 m`. The unit a length is *entered* in and
the unit it is *read* in are different concerns, and `pixelsToReal(pixels, mmPerPixel, targetUnit)`
was already written to take a target unit — nothing else in `calibration.js` changes.

Add to `core/model.js`:

```js
// createProject(): new field, alongside the existing ones
displayUnit: 'cm'          // one of UNITS; the unit every real length is READ in

export function setDisplayUnit(project, unit)
  // sets project.displayUnit and updatedAt; ignores the call and returns false
  // if !isValidUnit(unit); returns true otherwise
```

`deserialize` must default `displayUnit` to `'cm'` when the field is absent, and `SCHEMA_VERSION`
stays at **1**: nothing is persisted yet (that is F7), so no saved project exists that could need
migrating. Adding a defaulted field is not a breaking schema change.

Change `realValueFor` in `core/measurements.js` so the target unit is the project's display unit:

```js
const targetUnit = isValidUnit(project.displayUnit) ? project.displayUnit : calibration.unit;
return { real: pixelsToReal(pixels, mmPerPixel, targetUnit), unit: targetUnit };
```

The `unit` returned in the uncalibrated branches must follow the same rule, so a caller never sees a
unit that disagrees with the one it would get once calibrated.

**Tests (add to `test/measurements.test.js`):** calibrate 100 cm over 734 px, then a 367 px distance
reads `50 cm`, `500 mm`, `0.5 m` and `19.685 in` as `displayUnit` changes, with **no other mutation
in between** — only the display unit moves. Setting an invalid display unit leaves the previous one
in place and the reading unchanged. An uncalibrated project still reports `NaN` for `real` whatever
the display unit is.

### 7.2 Calibrate tool

A sixth tool button, `data-tool="calibrate"`, in the existing `#tool-group`. It behaves **exactly
like the Distance tool** for picking: tap two existing points, in order, and reuse the existing
`pendingPointIds` machinery — including `pendingSnapshotBeforeClaim`, so a second finger landing
mid-tap restores the pick, same as F5. Do not invent a second pending mechanism.

Two differences from Distance:

1. On the second tap the tool does not create a measurement; it opens the length panel (§7.3) and
   waits. The calibration is written **only when the panel is confirmed**.
2. `requiredPointCount('calibrate')` is 2, and `isMeasurementMode` must **not** route it into
   `finishPendingMeasurement` — give it its own branch.

If the two picked points are at the same position (zero pixel length), refuse: show the panel's
error line, keep the pick, and do not call `setCalibration`. `millimetresPerPixel` would return
`NaN` and the app would silently look calibrated while every length read `NaN`.

Setting a calibration when one already exists **replaces** it — `setCalibration` already overwrites
`project.calibration`, and a single calibration per project is the model's design.

### 7.3 The length panel

A real HTML panel, not `window.prompt()`. `prompt()` blocks the main thread, cannot carry a unit
selector, and is unreliable in an installed standalone PWA.

```html
<div id="calibration-panel" hidden>
  <label>Reference length
    <input id="calibration-length" type="number" inputmode="decimal" step="any" min="0" />
  </label>
  <select id="calibration-unit"><!-- mm cm m in, default cm --></select>
  <p id="calibration-error" hidden></p>
  <button id="calibration-confirm" type="button">Calibrate</button>
  <button id="calibration-cancel" type="button">Cancel</button>
</div>
```

- **Position it directly under `#top-bar`, anchored to the top.** When the iOS keyboard opens it
  shrinks the visual viewport from the bottom; a panel centred or bottom-anchored ends up behind the
  keyboard with no way to reach its Confirm button.
- **Focus the input synchronously inside the pointer handler** that opens the panel. iOS Safari only
  honours programmatic `focus()` inside a user-gesture handler — deferring it into
  `requestAnimationFrame` or a `setTimeout` loses the keyboard.
- Reject on confirm, with the error line and without closing: empty input, a value that is not a
  finite number, and a value `<= 0`. Accept decimals with a dot; do not try to parse comma decimals,
  the numeric keyboard produces a dot.
- Cancel, and switching tools while the panel is open, close the panel and clear `pendingPointIds`
  without writing a calibration.
- The panel must not swallow pointer events aimed at the canvas beneath it; it is an ordinary
  absolutely-positioned element, and `#canvas-area` keeps its own gesture handling.

### 7.4 Bar controls

- `<select id="display-unit">` with mm / cm / m / in, calling `setDisplayUnit` then `scheduleRender`.
  **Disabled while `project.calibration` is null** — an unusable control that changes nothing is a
  bug report waiting to happen.
- `<button id="clear-calibration-button">Clear calibration</button>`, calling `clearCalibration`.
  Disabled when there is no calibration.
- A short status readout next to the zoom readout: `1.36 mm/px` when calibrated, `uncalibrated`
  otherwise. Compute it, do not store it — the reference points can be dragged and the scale must
  follow them.

Both controls live in `#top-bar`, which is already horizontally scrollable with `flex-shrink: 0`
children (fixed 2026-09-16); adding elements to it must not break that.

### 7.5 Rendering the calibration reference

Draw the reference as its own overlay layer, **before** segments so measurements sit on top:

- The line between the two reference points, in the halo-then-stroke convention of `drawHaloLine`,
  but in a distinct colour (`#7cff6b`) and **dashed** (`setLineDash([6, 4])`) so it reads as a
  reference and not as a measurement. Reset the dash afterwards — the canvas context is shared.
- A label at its midpoint with the entered value in its entered unit, e.g. `ref 100 cm`, so the
  number that defines the scale is always visible on the photo.
- The overlay is built in `app.js` from `project.calibration` plus `getPoint`, and passed as
  `overlay.calibration = { a, b, realLength, unit }` or `null`. `renderFrame` stays a pure function
  of what it is handed.

The reference points themselves are ordinary points: they stay draggable in Select mode, and
dragging one rescales every real length on the next frame with no recompute call, because nothing is
cached. **That is a feature to verify, not a hazard.**

### 7.6 Distance label with a calibration

Change `drawDistances`: when `dist.real` is finite, print **only** the real length
(`formatLength(dist.real, dist.unit)`), not `px (real)`. On a phone-width screen the pixel count is
noise next to the number the user actually asked for. Uncalibrated behaviour is unchanged: pixels
alone. Segments keep their current label.

### 7.7 Acceptance criteria

Not "it compiles". Each of these is a check someone performs:

1. The 208 existing tests still pass, plus the new `measurements` and `model` tests of §7.1.
2. On a loaded photo: two points, Calibrate, enter `100`, unit `cm` → the dashed reference and
   `ref 100 cm` appear, the status reads a plausible mm/px, and the display-unit selector becomes
   enabled.
3. A second Distance measurement over half that pixel length reads **50 cm**, and switching the
   display unit reads **500 mm**, **0.5 m**, **19.7 in** — the same physical length, four ways.
4. Dragging one reference point in Select mode changes every real length live, while dragging.
5. Deleting a reference point clears the calibration (cascade), disables both new controls, and
   every distance falls back to pixels — with no `NaN` printed anywhere on screen.
6. In a 375×812 portrait emulation the panel is reachable with the keyboard open, and the two new
   bar controls are reachable by scrolling `#top-bar` horizontally.
7. Confirmed on the real iPhone before the phase is called done, per §6.
