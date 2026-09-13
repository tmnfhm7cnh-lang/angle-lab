import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  point,
  distance,
  midpoint,
  angleAtVertex,
  signedAngleAtVertex,
  lineOrientation,
  angleBetweenLines,
  normalizeDegrees,
  distanceToLine,
  distanceToSegment,
  RAD_TO_DEG,
} from '../src/core/geometry.js';

const close = (actual, expected, tolerance = 1e-9) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${expected}, got ${actual} (diff ${Math.abs(actual - expected)})`,
  );
};

describe('distance', () => {
  test('3-4-5 triangle', () => {
    close(distance(point(0, 0), point(3, 4)), 5);
  });

  test('is symmetric', () => {
    const a = point(-12.5, 7.25);
    const b = point(103.75, -44.5);
    close(distance(a, b), distance(b, a));
  });

  test('zero for coincident points', () => {
    close(distance(point(5, 5), point(5, 5)), 0);
  });

  test('negative coordinates', () => {
    close(distance(point(-3, -4), point(0, 0)), 5);
  });

  test('large coordinates do not overflow', () => {
    close(distance(point(0, 0), point(3e8, 4e8)), 5e8, 1e-3);
  });

  test('sub-pixel precision is preserved', () => {
    close(distance(point(0, 0), point(0.0001, 0)), 0.0001, 1e-15);
  });
});

describe('midpoint', () => {
  test('halfway between two points', () => {
    const m = midpoint(point(0, 0), point(10, 20));
    close(m.x, 5);
    close(m.y, 10);
  });

  test('negative coordinates', () => {
    const m = midpoint(point(-10, -10), point(10, 10));
    close(m.x, 0);
    close(m.y, 0);
  });
});

describe('angleAtVertex', () => {
  test('the case from the spec: A=(0,0) B=(1,0) C=(1,1) is 90 deg', () => {
    close(angleAtVertex(point(0, 0), point(1, 0), point(1, 1)), 90);
  });

  test('0 deg when both rays point the same way', () => {
    close(angleAtVertex(point(1, 0), point(0, 0), point(2, 0)), 0);
  });

  test('45 deg', () => {
    close(angleAtVertex(point(1, 0), point(0, 0), point(1, 1)), 45);
  });

  test('90 deg', () => {
    close(angleAtVertex(point(1, 0), point(0, 0), point(0, 1)), 90);
  });

  test('135 deg', () => {
    close(angleAtVertex(point(1, 0), point(0, 0), point(-1, 1)), 135);
  });

  test('180 deg when the rays are opposite', () => {
    close(angleAtVertex(point(-1, 0), point(0, 0), point(1, 0)), 180);
  });

  test('unsigned: swapping A and C leaves it unchanged', () => {
    const a = point(3, -7);
    const b = point(-2, 4);
    const c = point(11, 5);
    close(angleAtVertex(a, b, c), angleAtVertex(c, b, a));
  });

  test('invariant under uniform scaling', () => {
    const a = point(1, 0);
    const b = point(0, 0);
    const c = point(1, 1);
    const k = 1e6;
    close(
      angleAtVertex(a, b, c),
      angleAtVertex(point(a.x * k, a.y * k), point(b.x * k, b.y * k), point(c.x * k, c.y * k)),
    );
  });

  test('invariant under translation', () => {
    const t = 12345.678;
    close(
      angleAtVertex(point(1, 0), point(0, 0), point(1, 1)),
      angleAtVertex(point(1 + t, t), point(t, t), point(1 + t, 1 + t)),
    );
  });

  test('works entirely in negative coordinates', () => {
    close(angleAtVertex(point(-1, -2), point(-2, -2), point(-2, -1)), 90);
  });

  test('recovers a known angle built by rotation', () => {
    for (const deg of [0.5, 17, 33.3, 60, 88.8, 120, 179.5]) {
      const rad = deg / RAD_TO_DEG;
      const a = point(1, 0);
      const b = point(0, 0);
      const c = point(Math.cos(rad), Math.sin(rad));
      close(angleAtVertex(a, b, c), deg, 1e-10);
    }
  });

  test('stays accurate for very small angles, where acos would not', () => {
    const rad = 1e-7;
    const c = point(Math.cos(rad), Math.sin(rad));
    const viaAtan2 = angleAtVertex(point(1, 0), point(0, 0), c);
    close(viaAtan2, rad * RAD_TO_DEG, 1e-18);
  });

  test('stays accurate just short of 180 deg', () => {
    const rad = Math.PI - 1e-7;
    const c = point(Math.cos(rad), Math.sin(rad));
    const result = angleAtVertex(point(1, 0), point(0, 0), c);
    close(result, rad * RAD_TO_DEG, 1e-10);
  });

  test('NaN when a ray is degenerate', () => {
    assert.ok(Number.isNaN(angleAtVertex(point(0, 0), point(0, 0), point(1, 1))));
    assert.ok(Number.isNaN(angleAtVertex(point(1, 1), point(0, 0), point(0, 0))));
  });

  test('NaN when all three points coincide', () => {
    const p = point(4, -9);
    assert.ok(Number.isNaN(angleAtVertex(p, p, p)));
  });

  test('stays accurate progressively closer to 180 deg', () => {
    // Same construction as "recovers a known angle built by rotation": C is a unit vector
    // rotated by `rad`, so the ground truth is rad * RAD_TO_DEG and any divergence measures
    // atan2's own error, not the test's. Near 180 deg cos(rad) saturates towards -1 (losing
    // significant digits) while sin(rad) stays a small, well-conditioned number - exactly the
    // regime atan2(|cross|, dot) is used here to avoid. A few ULPs of a degrees-near-180 value
    // is on the order of 1e-13; 1e-9 is comfortably above that noise floor while still far
    // tighter than acos-based code (which loses ~8 significant digits at this range) could pass.
    for (const deg of [179, 179.9, 179.99, 179.999, 179.9999]) {
      const rad = deg / RAD_TO_DEG;
      const a = point(1, 0);
      const b = point(0, 0);
      const c = point(Math.cos(rad), Math.sin(rad));
      close(angleAtVertex(a, b, c), deg, 1e-9);
    }
  });

  test('remains invariant under translation to very large coordinates', () => {
    // a=(1,0) b=(0,0) c=(1,1) relative to b is the 45 deg case above. Coordinates this size
    // (1e8, 1e10) are still exactly representable integers in float64 (well under 2^53), so
    // this is expected to hold exactly, not approximately - it isolates whether subtract()
    // introduces any avoidable error at these magnitudes, independent of the true catastrophic
    // cancellation case (sub-unit differences) covered separately below.
    for (const t of [1e8, 1e10]) {
      const a = point(1 + t, t);
      const b = point(t, t);
      const c = point(1 + t, 1 + t);
      close(angleAtVertex(a, b, c), 45, 1e-9);
    }
  });

  test('a sub-ULP difference at large coordinates collapses to NaN, not a wrong angle', () => {
    // At 1e10, float64's representable resolution is about 2e-6: adding 1e-10 to 1e10 rounds
    // straight back to 1e10. So a and b, defined as distinct points 1e-10 apart, become the
    // same float64 value before geometry.js ever sees them. subtract() then yields exactly
    // (0, 0), and the existing coincident-point guard returns NaN. This is the correct,
    // documented behavior (NaN propagates rather than a silently wrong angle) - the failure
    // mode this test guards against is the guard being bypassed and a bogus finite number
    // coming out instead.
    const a = point(1e10 + 1e-10, 0);
    const b = point(1e10, 0);
    const c = point(1e10, 1);
    assert.equal(a.x - b.x, 0);
    assert.ok(Number.isNaN(angleAtVertex(a, b, c)));
  });

  test('no Infinity for large-but-finite coordinate inputs', () => {
    const a = point(1e10, 0);
    const b = point(-1e10, 0);
    const c = point(0, 1e10);
    const result = angleAtVertex(a, b, c);
    assert.ok(Number.isFinite(result), `got ${result}`);
  });
});

describe('signedAngleAtVertex', () => {
  test('positive when C is counter-clockwise from A as seen in the photo', () => {
    close(signedAngleAtVertex(point(1, 0), point(0, 0), point(1, -1)), 45);
  });

  test('negative when C is clockwise from A as seen in the photo', () => {
    close(signedAngleAtVertex(point(1, 0), point(0, 0), point(1, 1)), -45);
  });

  test('swapping A and C flips the sign only', () => {
    const a = point(3, -7);
    const b = point(-2, 4);
    const c = point(11, 5);
    close(signedAngleAtVertex(a, b, c), -signedAngleAtVertex(c, b, a));
  });

  test('opposite rays give +180, never -180', () => {
    const result = signedAngleAtVertex(point(-1, 0), point(0, 0), point(1, 0));
    close(result, 180);
    assert.ok(Object.is(Math.sign(result), 1), `got ${result}`);
  });

  test('magnitude matches the unsigned angle', () => {
    const a = point(5, 2);
    const b = point(1, 1);
    const c = point(-3, 9);
    close(Math.abs(signedAngleAtVertex(a, b, c)), angleAtVertex(a, b, c));
  });

  test('NaN when all three points coincide', () => {
    const p = point(-6, 6);
    assert.ok(Number.isNaN(signedAngleAtVertex(p, p, p)));
  });
});

describe('lineOrientation', () => {
  test('0 deg pointing right', () => {
    close(lineOrientation(point(0, 0), point(1, 0)), 0);
  });

  test('90 deg pointing up in the photo', () => {
    close(lineOrientation(point(0, 0), point(0, -1)), 90);
  });

  test('-90 deg pointing down in the photo', () => {
    close(lineOrientation(point(0, 0), point(0, 1)), -90);
  });

  test('180 deg pointing left', () => {
    close(lineOrientation(point(0, 0), point(-1, 0)), 180);
  });

  test('45 deg up-right', () => {
    close(lineOrientation(point(0, 0), point(1, -1)), 45);
  });

  test('-135 deg down-left', () => {
    close(lineOrientation(point(0, 0), point(-1, 1)), -135);
  });

  test('reversing the segment turns it by 180 deg', () => {
    const a = point(2, 3);
    const b = point(9, -4);
    close(normalizeDegrees(lineOrientation(a, b) - lineOrientation(b, a)), 180);
  });

  test('NaN for a zero-length segment', () => {
    assert.ok(Number.isNaN(lineOrientation(point(4, 4), point(4, 4))));
  });

  test('NaN for a zero-length segment at large coordinates', () => {
    assert.ok(Number.isNaN(lineOrientation(point(1e10, -1e8), point(1e10, -1e8))));
  });
});

describe('angleBetweenLines', () => {
  test('perpendicular lines are 90 deg', () => {
    close(angleBetweenLines(point(0, 0), point(1, 0), point(0, 0), point(0, 1)), 90);
  });

  test('parallel lines are 0 deg', () => {
    close(angleBetweenLines(point(0, 0), point(1, 0), point(5, 5), point(9, 5)), 0);
  });

  test('direction of each segment does not matter', () => {
    const forward = angleBetweenLines(point(0, 0), point(1, 1), point(0, 0), point(1, 0));
    const reversed = angleBetweenLines(point(1, 1), point(0, 0), point(1, 0), point(0, 0));
    close(forward, reversed);
    close(forward, 45);
  });

  test('never exceeds 90 deg', () => {
    const result = angleBetweenLines(point(0, 0), point(1, 0), point(0, 0), point(-1, 0.1));
    assert.ok(result <= 90 && result >= 0, `got ${result}`);
  });
});

describe('normalizeDegrees', () => {
  test('leaves in-range values alone', () => {
    close(normalizeDegrees(90), 90);
    close(normalizeDegrees(-90), -90);
  });

  test('wraps above 180', () => {
    close(normalizeDegrees(270), -90);
    close(normalizeDegrees(360), 0);
    close(normalizeDegrees(450), 90);
  });

  test('wraps below -180', () => {
    close(normalizeDegrees(-270), 90);
    close(normalizeDegrees(-360), 0);
  });

  test('maps both half-turns to +180', () => {
    close(normalizeDegrees(180), 180);
    close(normalizeDegrees(-180), 180);
  });
});

describe('distanceToLine', () => {
  test('perpendicular offset from a horizontal line', () => {
    close(distanceToLine(point(5, 3), point(0, 0), point(10, 0)), 3);
  });

  test('is zero on the line, including beyond the endpoints', () => {
    close(distanceToLine(point(50, 0), point(0, 0), point(10, 0)), 0);
  });

  test('NaN when the two line points coincide', () => {
    assert.ok(Number.isNaN(distanceToLine(point(1, 1), point(0, 0), point(0, 0))));
  });

  test('NaN when the two line points coincide at large coordinates', () => {
    assert.ok(Number.isNaN(distanceToLine(point(0, 0), point(1e10, 1e10), point(1e10, 1e10))));
  });

  test('stays finite and accurate at large coordinates', () => {
    close(distanceToLine(point(1e10 + 3, 1e10 + 50), point(1e10, 1e10), point(1e10 + 10, 1e10)), 50, 1e-6);
  });
});

describe('distanceToSegment', () => {
  test('perpendicular when the projection falls inside', () => {
    close(distanceToSegment(point(5, 3), point(0, 0), point(10, 0)), 3);
  });

  test('clamps to the near endpoint when the projection falls outside', () => {
    close(distanceToSegment(point(-4, 3), point(0, 0), point(10, 0)), 5);
    close(distanceToSegment(point(14, 3), point(0, 0), point(10, 0)), 5);
  });

  test('degenerate segment reduces to point distance', () => {
    close(distanceToSegment(point(3, 4), point(0, 0), point(0, 0)), 5);
  });

  test('degenerate segment at the query point itself is zero, not NaN', () => {
    close(distanceToSegment(point(1e10, 1e10), point(1e10, 1e10), point(1e10, 1e10)), 0);
  });

  test('stays finite and accurate at large coordinates', () => {
    close(
      distanceToSegment(point(1e10 + 3, 1e10 + 50), point(1e10, 1e10), point(1e10 + 10, 1e10)),
      50,
      1e-6,
    );
  });
});

describe('geometry: no silent NaN-to-zero or unintended Infinity', () => {
  test('coincident-point guards return NaN, never 0, across every function that has one', () => {
    const p = point(7, -3);
    assert.ok(Number.isNaN(angleAtVertex(p, p, point(1, 1))));
    assert.ok(Number.isNaN(signedAngleAtVertex(p, p, point(1, 1))));
    assert.ok(Number.isNaN(lineOrientation(p, p)));
    assert.ok(Number.isNaN(distanceToLine(point(0, 0), p, p)));
  });

  test('no function under test produces Infinity for coordinates up to 1e10', () => {
    const big = 1e10;
    const a = point(big, 0);
    const b = point(0, 0);
    const c = point(0, big);
    const results = [
      distance(a, b),
      angleAtVertex(a, b, c),
      signedAngleAtVertex(a, b, c),
      lineOrientation(a, b),
      distanceToLine(c, a, b),
      distanceToSegment(c, a, b),
    ];
    for (const r of results) {
      assert.ok(Number.isFinite(r), `expected a finite result, got ${r}`);
    }
  });
});
