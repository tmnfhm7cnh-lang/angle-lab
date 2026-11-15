/**
 * Undo/redo stacks of project snapshots. No DOM, no knowledge of what a
 * snapshot is: the caller pushes the state as it was JUST BEFORE a confirmed
 * change (serialize(project) in the app) and gets snapshots back to restore.
 *
 * push(snapshot)      record the state before a change; empties the redo stack.
 * undo(current)       returns the snapshot to restore (or null if none) and keeps
 *                     `current` so redo can come back to it.
 * redo(current)       the reverse.
 * discardLast()       forget the newest push — for a gesture that was cancelled
 *                     and rolled back by hand, so it leaves no undo step behind.
 * clear()             forget everything (another project, another photo).
 *
 * Snapshots are stored by reference; the caller must pass independent copies.
 */
export function createHistory({ limit = 50 } = {}) {
  let undoStack = [];
  let redoStack = [];

  return {
    push(snapshot) {
      undoStack.push(snapshot);
      if (undoStack.length > limit) undoStack.shift();
      redoStack = [];
    },
    undo(currentSnapshot) {
      if (undoStack.length === 0) return null;
      redoStack.push(currentSnapshot);
      return undoStack.pop();
    },
    redo(currentSnapshot) {
      if (redoStack.length === 0) return null;
      undoStack.push(currentSnapshot);
      return redoStack.pop();
    },
    discardLast() {
      undoStack.pop();
    },
    clear() {
      undoStack = [];
      redoStack = [];
    },
    get canUndo() {
      return undoStack.length > 0;
    },
    get canRedo() {
      return redoStack.length > 0;
    },
  };
}
