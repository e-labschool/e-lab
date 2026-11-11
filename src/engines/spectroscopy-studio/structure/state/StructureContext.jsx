import { createContext, useContext, useEffect, useRef, useSyncExternalStore } from "react";
import { useSimulationSessionState } from "../../../../components/interactive-shell/simulationSession.js";
import { SESSION_KEY, createStructureStore, isValidPersisted, pickPersisted, sanitize } from "./structureState.js";

const Ctx = createContext(null);

/** Owns the store for the lifetime of the simulation (switching to another tab and back keeps the investigation) and mirrors the persisted slice (debounced). */
export function StructureProvider({ children, initial }) {
  const [persisted, setPersisted] = useSimulationSessionState(SESSION_KEY, () => pickPersisted(sanitize(initial ?? {})), isValidPersisted);
  const ref = useRef(null);
  if (ref.current === null) ref.current = createStructureStore({ ...(initial ?? {}), ...persisted });
  const store = ref.current;
  useEffect(() => {
    let timer = null; let last = pickPersisted(store.getState());
    const flush = () => { timer = null; const next = pickPersisted(store.getState()); if (JSON.stringify(next) !== JSON.stringify(last)) { last = next; setPersisted(next); } };
    const unsub = store.subscribe(() => { if (timer == null) timer = setTimeout(flush, 250); });
    const onHide = () => { if (document.hidden) { if (timer != null) clearTimeout(timer); flush(); } };
    document.addEventListener("visibilitychange", onHide);
    return () => { unsub(); document.removeEventListener("visibilitychange", onHide); if (timer != null) { clearTimeout(timer); flush(); } };
  }, [store, setPersisted]);
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
export function useStructureStore() { const s = useContext(Ctx); if (!s) throw new Error("useStructureStore must be used inside <StructureProvider>"); return s; }
export function useStructure(selector = (s) => s) {
  const store = useStructureStore(); const sel = useRef(selector); sel.current = selector;
  return useSyncExternalStore(store.subscribe, () => sel.current(store.getState()), () => sel.current(store.getState()));
}
export const useStructureActions = useStructureStore;
