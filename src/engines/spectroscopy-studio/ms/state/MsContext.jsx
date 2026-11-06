import { createContext, useContext, useEffect, useRef, useSyncExternalStore } from "react";
import { useSimulationSessionState } from "../../../../components/interactive-shell/simulationSession.js";
import { DEFAULTS, createMsStore, isValidPersisted, pickPersisted, sanitize } from "./msState.js";

const MsContext = createContext(null);

/** Owns the MS store for the lifetime of the simulation (switching to IR or NMR and back keeps the MS experiment), restores the persisted slice and mirrors changes back. */
export function MsProvider({ children, initial }) {
  const [persisted, setPersisted] = useSimulationSessionState("studio-ms-v1", () => pickPersisted(sanitize(initial ?? DEFAULTS)), isValidPersisted);
  const ref = useRef(null);
  if (ref.current === null) ref.current = createMsStore({ ...(initial ?? {}), ...persisted });
  const store = ref.current;
  useEffect(() => {
    let timer = null; let last = pickPersisted(store.getState());
    const flush = () => { timer = null; const next = pickPersisted(store.getState()); if (JSON.stringify(next) !== JSON.stringify(last)) { last = next; setPersisted(next); } };
    const unsub = store.subscribe(() => { if (timer == null) timer = setTimeout(flush, 250); });
    const onHide = () => { if (document.hidden) { if (timer != null) clearTimeout(timer); flush(); } };
    document.addEventListener("visibilitychange", onHide);
    return () => { unsub(); document.removeEventListener("visibilitychange", onHide); if (timer != null) { clearTimeout(timer); flush(); } };
  }, [store, setPersisted]);
  return <MsContext.Provider value={store}>{children}</MsContext.Provider>;
}
export function useMsStore() { const s = useContext(MsContext); if (!s) throw new Error("useMsStore must be used inside <MsProvider>"); return s; }
export function useMs(selector = (s) => s) {
  const store = useMsStore(); const sel = useRef(selector); sel.current = selector;
  return useSyncExternalStore(store.subscribe, () => sel.current(store.getState()), () => sel.current(store.getState()));
}
/** Several values at once: the selector may build a new object; it is only treated as changed when one of its fields changed (shallow compare). */
export function useMsShallow(selector) {
  const store = useMsStore(); const sel = useRef(selector); sel.current = selector; const last = useRef(null);
  const get = () => { const v = sel.current(store.getState()); const l = last.current; if (l && Object.keys(v).length === Object.keys(l).length && Object.keys(v).every((k) => Object.is(v[k], l[k]))) return l; last.current = v; return v; };
  return useSyncExternalStore(store.subscribe, get, get);
}
export const useMsActions = useMsStore;
