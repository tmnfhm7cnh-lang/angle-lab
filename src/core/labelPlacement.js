/**
 * Where the value label of an angle goes (view space, no DOM).
 *
 * The label sits on the bisector of the two rays, `distance` from the vertex. In a narrow angle
 * the two rays are so close there that a label on the bisector covers both of them, so below
 * OUTSIDE_BELOW_DEGREES it moves to the other side of the vertex (the inverted bisector), where
 * there is nothing to cover.
 */
import { subtract, magnitude } from './geometry.js';

export const OUTSIDE_BELOW_DEGREES = 40;

function unit(v) {
  const m = magnitude(v);
  return m === 0 ? { x: 0, y: 0 } : { x: v.x / m, y: v.y / m };
}

export function angleLabelPosition(vertex, a, c, degrees, distance) {
  const uA = unit(subtract(a, vertex));
  const uC = unit(subtract(c, vertex));
  let bisector = { x: uA.x + uC.x, y: uA.y + uC.y };
  let size = magnitude(bisector);
  if (size < 1e-9) {
    // Opposite rays (or no usable ray): any perpendicular is as good as another.
    bisector = uA.x === 0 && uA.y === 0 ? { x: 0, y: -1 } : { x: -uA.y, y: uA.x };
    size = magnitude(bisector) || 1;
  }
  const sign = Number.isFinite(degrees) && degrees < OUTSIDE_BELOW_DEGREES ? -1 : 1;
  return {
    x: vertex.x + (sign * bisector.x * distance) / size,
    y: vertex.y + (sign * bisector.y * distance) / size,
  };
}
