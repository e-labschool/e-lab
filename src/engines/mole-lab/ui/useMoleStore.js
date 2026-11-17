import { useCallback, useRef, useState } from "react";
import { createInitialState, reduce } from "../engine/store.js";

/**
 * The React face of the ONE experiment store.  `dispatch` applies the pure reducer SYNCHRONOUSLY to a ref (so two rapid events
 * always see each other's result and can never both act on stale state) and then publishes the new state to React.
 * It returns the new state, so callers can read `state.last` / `state.scenes` immediately.
 */
export function useMoleStore(init = {}) {
  const ref = useRef(null);
  if (ref.current === null) ref.current = createInitialState(init);
  const [state, setState] = useState(ref.current);
  const dispatch = useCallback((action) => { const next = reduce(ref.current, action); if (next !== ref.current) { ref.current = next; setState(next); } return next; }, []);
  const getState = useCallback(() => ref.current, []);
  return { state, dispatch, getState };
}
