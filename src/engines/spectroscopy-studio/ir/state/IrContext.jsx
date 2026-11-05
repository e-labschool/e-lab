import { createContext, useContext, useEffect, useRef, useSyncExternalStore } from "react";
import { useSimulationSessionState } from "../../../../components/interactive-shell/simulationSession.js";
import { getModeCatalog } from "../physics/modeCatalog.js";
import { DEFAULTS, createIrStore, isValidPersisted, pickPersisted, sanitize } from "./irState.js";

const IrContext = createContext(null);
export const modesOf = (mol) => getModeCatalog(mol).modes.map((m) => m.id);

/** Owns the IR store for the lifetime of the simulation (so switching to NMR and back keeps the IR experiment), restores the persisted slice and mirrors changes back. */
export function IrProvider({ children, initial }) {
  const [persisted, setPersisted] = useSimulationSessionState("studio-ir-v1", () => pickPersisted(sanitize(initial ?? DEFAULTS, modesOf)), isValidPersisted);
  const ref = useRef(null);
  if (ref.current === null) ref.current = createIrStore({ ...(initial ?? {}), ...persisted }, modesOf);
  const store = ref.current;
  useEffect(() => {
    let timer = null; let last = pickPersisted(store.getState());
    const flush = () => { timer = null; const next = pickPersisted(store.getState()); if (JSON.stringify(next) !== JSON.stringify(last)) { last = next; setPersisted(next); } };
    const unsub = store.subscribe(() => { if (timer == null) timer = setTimeout(flush, 250); });
    const onHide = () => { if (document.hidden) { if (timer != null) clearTimeout(timer); flush(); } };
    document.addEventListener("visibilitychange", onHide);
    return () => { unsub(); document.removeEventListener("visibilitychange", onHide); if (timer != null) { clearTimeout(timer); flush(); } };
  }, [store, setPersisted]);
  return <IrContext.Provider value={store}>{children}</IrContext.Provider>;
}
export function useIrStore() { const s = useContext(IrContext); if (!s) throw new Error("useIrStore must be used inside <IrProvider>"); return s; }
export function useIr(selector = (s) => s) {
  const store = useIrStore(); const sel = useRef(selector); sel.current = selector;
  return useSyncExternalStore(store.subscribe, () => sel.current(store.getState()), () => sel.current(store.getState()));
}
export const useIrActions = useIrStore;
