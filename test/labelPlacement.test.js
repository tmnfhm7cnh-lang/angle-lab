import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { angleLabelPosition, OUTSIDE_BELOW_DEGREES } from '../src/core/labelPlacement.js';

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} !~ ${b}`);
const vertex = { x: 100, y: 100 };
const ray = (deg, len = 80) => ({
  x: vertex.x + len * Math.cos((deg * Math.PI) / 180),
  y: vertex.y + len * Math.sin((deg * Math.PI) / 180),
});

describe('angleLabelPosition', () => {
  test('a wide angle puts the label inside, on the bisector', () => {
    // rays at -45 and +45 degrees: a 90 degree angle opening towards +x
    const p = angleLabelPosition(vertex, ray(-45), ray(45), 90, 40);
    close(p.x, 140);
    close(p.y, 100);
  });

  test('an acute angle puts the label outside, behind the vertex', () => {
    // rays at -15 and +15 degrees: a 30 degree angle opening towards +x
    const p = angleLabelPosition(vertex, ray(-15), ray(15), 30, 40);
    close(p.x, 60);
    close(p.y, 100);
  });

  test('the switch happens at exactly the threshold: 40 degrees is still inside', () => {
    assert.equal(OUTSIDE_BELOW_DEGREES, 40);
    const inside = angleLabelPosition(vertex, ray(-20), ray(20), 40, 40);
    assert.ok(inside.x > vertex.x);
    const outside = angleLabelPosition(vertex, ray(-19.9), ray(19.9), 39.8, 40);
    assert.ok(outside.x < vertex.x);
  });

  test('the label is always `distance` away from the vertex', () => {
    for (const [a, c, deg] of [[-45, 45, 90], [-15, 15, 30], [10, 170, 160]]) {
      const p = angleLabelPosition(vertex, ray(a), ray(c), deg, 37);
      close(Math.hypot(p.x - vertex.x, p.y - vertex.y), 37);
    }
  });

  test('two rays pointing the same way (0 degrees): outside, opposite to them', () => {
    const p = angleLabelPosition(vertex, ray(0), ray(0), 0, 40);
    close(p.x, 60);
    close(p.y, 100);
  });

  test('opposite rays (180 degrees): falls back to the perpendicular, inside the threshold rule', () => {
    const p = angleLabelPosition(vertex, ray(0), ray(180), 180, 40);
    close(p.x, 100);
    close(Math.abs(p.y - 100), 40);
  });

  test('a ray of zero length does not produce NaN', () => {
    const p = angleLabelPosition(vertex, vertex, ray(30), 0, 40);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
  });
});
