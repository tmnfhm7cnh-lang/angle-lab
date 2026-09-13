/**
 * Pinch-zoom and pan from Pointer Events, plus wheel-zoom for desktop
 * testing. Pointer Events (not Touch Events) so the same code path handles
 * finger, mouse and Pencil; touch-action:none + preventDefault stop Safari
 * from scrolling/zooming the page underneath the canvas.
 *
 * onZoomAt(viewAnchor, factor) and onPanBy(dxView, dyView) are the only
 * hooks — this module never touches the viewport object itself, so it stays
 * ignorant of core/render and only reports gestures upward.
 */

export function attachPointerGestures(element, { onZoomAt, onPanBy, onGestureEnd }) {
  const pointers = new Map();
  let lastPanPoint = null;
  let lastPinchDistance = null;

  function pointFromEvent(event) {
    const rect = element.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function midpoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function activePoints() {
    return Array.from(pointers.values());
  }

  function onPointerDown(event) {
    element.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, pointFromEvent(event));
    event.preventDefault();

    const pts = activePoints();
    if (pts.length === 1) {
      lastPanPoint = pts[0];
      lastPinchDistance = null;
    } else if (pts.length === 2) {
      lastPinchDistance = distance(pts[0], pts[1]);
      lastPanPoint = midpoint(pts[0], pts[1]);
    }
  }

  function onPointerMove(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, pointFromEvent(event));
    event.preventDefault();

    const pts = activePoints();
    if (pts.length === 1) {
      const current = pts[0];
      if (lastPanPoint) onPanBy(current.x - lastPanPoint.x, current.y - lastPanPoint.y);
      lastPanPoint = current;
    } else if (pts.length === 2) {
      const [a, b] = pts;
      const currentMid = midpoint(a, b);
      const currentDistance = distance(a, b);

      if (lastPanPoint) onPanBy(currentMid.x - lastPanPoint.x, currentMid.y - lastPanPoint.y);
      if (lastPinchDistance && lastPinchDistance > 0) {
        onZoomAt(currentMid, currentDistance / lastPinchDistance);
      }

      lastPanPoint = currentMid;
      lastPinchDistance = currentDistance;
    }
  }

  function endPointer(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    if (element.hasPointerCapture?.(event.pointerId)) {
      element.releasePointerCapture(event.pointerId);
    }

    const pts = activePoints();
    if (pts.length === 1) {
      lastPanPoint = pts[0];
      lastPinchDistance = null;
    } else if (pts.length === 0) {
      lastPanPoint = null;
      lastPinchDistance = null;
      onGestureEnd?.();
    }
  }

  function onWheel(event) {
    event.preventDefault();
    const anchor = pointFromEvent(event);
    // ctrlKey is how browsers report trackpad pinch as a wheel event.
    const intensity = event.ctrlKey ? 0.02 : 0.0015;
    const factor = Math.exp(-event.deltaY * intensity);
    onZoomAt(anchor, factor);
  }

  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointermove', onPointerMove);
  element.addEventListener('pointerup', endPointer);
  element.addEventListener('pointercancel', endPointer);
  element.addEventListener('wheel', onWheel, { passive: false });

  return function detach() {
    element.removeEventListener('pointerdown', onPointerDown);
    element.removeEventListener('pointermove', onPointerMove);
    element.removeEventListener('pointerup', endPointer);
    element.removeEventListener('pointercancel', endPointer);
    element.removeEventListener('wheel', onWheel);
  };
}
