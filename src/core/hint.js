/**
 * Which hint the active tool should show, as a strings.js key — the single
 * place that knows what the next tap does for select/point/line/angle/
 * distance/calibrate. Returns null for 'guide' and 'repeat': those two keep
 * the texts that already exist (guide landmark names, repeat tap counter).
 *
 * `pendingCount` is how many points the in-progress measurement has so far.
 * `cancellable` is true only while one is in progress, so the UI knows when
 * to offer the cancel button.
 */

const STEPS = {
  angle: ['hintAngleFirst', 'hintAngleVertex', 'hintAngleLast'],
  distance: ['hintPairFirst', 'hintPairSecond'],
  line: ['hintPairFirst', 'hintPairSecond'],
  calibrate: ['hintCalibrateFirst', 'hintCalibrateSecond', 'hintCalibrateLength'],
};

const FIXED = { select: 'hintSelect', point: 'hintPoint' };

export function describeHint(mode, pendingCount = 0) {
  if (FIXED[mode]) return { key: FIXED[mode], params: {}, cancellable: false };
  const steps = STEPS[mode];
  if (!steps) return null;
  const index = Math.min(Math.max(pendingCount, 0), steps.length - 1);
  return { key: steps[index], params: {}, cancellable: pendingCount > 0 };
}
