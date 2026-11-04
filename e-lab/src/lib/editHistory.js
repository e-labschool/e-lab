// Tiny snapshot undo/redo stack for the Rich Text editor. The editor mutates
// its DOM directly (Range-based formatting), which breaks the browser's native
// undo stack, so ALL history (typing, paste, formatting) is kept here instead.
// A snapshot is { html, sel: {start,end} | null }.
export function createHistory(initial, limit = 100) {
  let stack = [initial];
  let index = 0;
  return {
    current: () => stack[index],
    /** Records a new state. Identical-html snapshots only update the stored selection. */
    record(snap) {
      if (stack[index].html === snap.html) {
        stack[index] = { ...stack[index], sel: snap.sel };
        return false;
      }
      stack = stack.slice(0, index + 1);
      stack.push(snap);
      if (stack.length > limit) stack.shift();
      index = stack.length - 1;
      return true;
    },
    canUndo: () => index > 0,
    canRedo: () => index < stack.length - 1,
    undo() { if (index > 0) index -= 1; return stack[index]; },
    redo() { if (index < stack.length - 1) index += 1; return stack[index]; },
    size: () => stack.length,
  };
}
