/**
 * Pinch-zoom and pan from Pointer Events, plus wheel-zoom for desktop
 * testing. Pointer Events (not Touch Events) so the same code path handles
 * finger, mouse and Pencil; touch-action:none + preventDefault stop Safari
 * from scrolling/zooming the page underneath the canvas.
 *
 * onZoomAt(viewAnchor, factor) and onPanBy(dxView, dyView) are the only
 * hooks for F3 gestures — this module never touches the viewport object
 * itself, so it stays ignorant of core/render and only reports gestures
 * upward.
 *
 * onPointClaim(viewPoint, event), onPointDragMove(viewPoint, event) and
 * onPointDragEnd(viewPoint, event) let a caller intercept a single pointer
 * (e.g. to create or drag a point) instead of it starting a pan. onPointClaim
 * fires on the first pointer of a new gesture; if it returns true, this
 * module hands that pointerId entirely to the caller until it is released —
 * no pan/zoom callback fires for it. If a second pointer arrives while one is
 * claimed, the claim is cancelled (onPointDragEnd fires) and control reverts
 * to the normal pan/pinch handling below, on the assumption that a second
 * finger means the user wants to pinch-zoom, not keep dragging a point.
 */

export function attachPointerGestures(
  element,
  { onZoomAt, onPanBy, onGestureEnd, onPointClaim, onPointDragMove, onPointDragEnd },
) {
  const pointers = new Map();
  const claimed = new Set();
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
    // Capture can throw (NotFoundError) if the pointer was already released
    // by the platform between the event firing and this call — a system
    // gesture interrupting a touch is the real-world case. Tracking must
    // continue regardless: a failed capture only means this element stops
    // receiving events if the finger leaves it, not that the gesture is void.
    try {
      element.setPointerCapture(event.pointerId);
    } catch {
      /* not fatal, see above */
    }
    const point = pointFromEvent(event);
    pointers.set(event.pointerId, point);
    event.preventDefault();

    const pts = activePoints();

    if (pts.length === 2 && claimed.size > 0) {
      // A second finger arrived while a point was claimed: hand off to
      // pinch/pan instead of continuing to drag that point.
      for (const id of claimed) onPointDragEnd?.(pointers.get(id), event);
      claimed.clear();
    }

    if (pts.length === 1 && onPointClaim && onPointClaim(point, event)) {
      claimed.add(event.pointerId);
      return;
    }

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
    const point = pointFromEvent(event);
    pointers.set(event.pointerId, point);
    event.preventDefault();

    if (claimed.has(event.pointerId)) {
      onPointDragMove?.(point, event);
      return;
    }

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
    const point = pointFromEvent(event);
    pointers.delete(event.pointerId);
    if (element.hasPointerCapture?.(event.pointerId)) {
      element.releasePointerCapture(event.pointerId);
    }

    if (claimed.has(event.pointerId)) {
      claimed.delete(event.pointerId);
      onPointDragEnd?.(point, event);
      if (activePoints().length === 0) {
        lastPanPoint = null;
        lastPinchDistance = null;
        onGestureEnd?.();
      }
      return;
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
