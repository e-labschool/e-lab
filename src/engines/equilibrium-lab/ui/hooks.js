import { useEffect, useReducer, useRef } from "react";
import { createInitialState, reduce } from "../model/store.js";
export { useElementSize, useIsDark, layoutClass } from "../../mole-lab/ui/hooks.js";

/** The one store: useReducer over the pure reducer, plus a ref that always holds the latest state (for canvases and test hooks). */
export function useEquilibriumStore(initialMode) {
  const [state, dispatch] = useReducer(reduce, initialMode, (m) => createInitialState({ mode: m }));
  const ref = useRef(state); ref.current = state;
  return [state, dispatch, ref];
}

/** Real-time loop: while `running`, dispatch run/tick with the frame time (capped).  `globalThis.__EQ_DT_MAX` lets tests step a fixed clock. */
export function useSimLoop(running, dispatch) {
  useEffect(() => {
    if (!running) return undefined;
    let raf = 0; let last = null; let cancelled = false;
    const frame = (now) => {
      if (cancelled) return;
      if (last != null) { const cap = globalThis.__EQ_DT_MAX ?? 0.1; dispatch({ type: "run/tick", dt: Math.min((now - last) / 1000, cap) }); }
      last = now; raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, [running, dispatch]);
}

/** Test / verification hooks (no effect on normal use): window.__EQ.getState(), .dispatch(action). */
export function useTestHooks(ref, dispatch) {
  useEffect(() => {
    const hook = { getState: () => ref.current, dispatch };
    globalThis.__EQ = hook;
    return () => { if (globalThis.__EQ === hook) delete globalThis.__EQ; };
  }, [ref, dispatch]);
}
