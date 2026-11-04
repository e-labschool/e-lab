import { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useSimulationSessionState } from "../../../components/interactive-shell/simulationSession.js";
import { DEFAULTS, createStudioStore, isValidPersisted, pickPersisted, sanitize } from "./studioState.js";

const StudioContext = createContext(null);

/** Owns the store for the lifetime of the simulation, restores the persisted slice and mirrors changes back (debounced). */
export function StudioProvider({ children, initial }) {
  const [persisted, setPersisted] = useSimulationSessionState("studio-v2", () => pickPersisted(sanitize(initial ?? DEFAULTS)), isValidPersisted);
  const storeRef = useRef(null);
  if (storeRef.current === null) storeRef.current = createStudioStore({ ...(initial ?? {}), ...persisted });
  const store = storeRef.current;
  useEffect(() => {
    let timer = null; let last = pickPersisted(store.getState());
    const flush = () => { timer = null; const next = pickPersisted(store.getState()); if (JSON.stringify(next) !== JSON.stringify(last)) { last = next; setPersisted(next); } };
    const unsub = store.subscribe(() => { if (timer == null) timer = setTimeout(flush, 250); });
    const onHide = () => { if (document.hidden) { if (timer != null) clearTimeout(timer); flush(); } };
    document.addEventListener("visibilitychange", onHide);
    return () => { unsub(); document.removeEventListener("visibilitychange", onHide); if (timer != null) { clearTimeout(timer); flush(); } };
  }, [store, setPersisted]);
  return <StudioContext.Provider value={store}>{children}</StudioContext.Provider>;
}

export function useStudioStore() {
  const s = useContext(StudioContext);
  if (!s) throw new Error("useStudioStore must be used inside <StudioProvider>");
  return s;
}

/** Subscribe to a slice: useStudio((s) => s.rf). The selector must return a stable reference for unchanged data (slices are replaced immutably). */
export function useStudio(selector = (s) => s) {
  const store = useStudioStore();
  const sel = useRef(selector); sel.current = selector;
  return useSyncExternalStore(store.subscribe, () => sel.current(store.getState()), () => sel.current(store.getState()));
}

/** Stable object of actions (the store itself). */
export function useStudioActions() { return useStudioStore(); }

/** Reduced-motion preference (live). */
export function useReducedMotion() {
  const get = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false);
  return useSyncExternalStore(
    (cb) => { const mq = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null; mq?.addEventListener?.("change", cb); return () => mq?.removeEventListener?.("change", cb); },
    get, () => false,
  );
}

export const useStudioDefaults = () => useMemo(() => DEFAULTS, []);
