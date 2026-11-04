// Tiny module-level store for the per-molecule working state of the molecular stages (which environments the student has
// identified, whether coupling is switched on, challenge progress ...). WHY: the shared `studio` props only carry the selection
// and the instrument settings, but the spec asks that switching stages/tabs never silently resets the experiment. The stages
// unmount when you leave them, so their local state would be lost; this store keeps it for the page session.
// It is reset by `resetToken` (the studio's Reset): an entry written under an older token is ignored.
import { useCallback, useRef, useSyncExternalStore } from "react";

const store = new Map();
const listeners = new Set();
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const notify = () => listeners.forEach((fn) => fn());

export function clearStageStore() { store.clear(); notify(); }
export function peekStageState(key, token = 0) { const e = store.get(key); return e && e.token === token ? e.value : undefined; }

/** useStageState("spectrum:ethanol:coupled", false, resetToken) -> [value, setValue]  (setValue accepts a value or an updater) */
export default function useStageState(key, initial, resetToken = 0) {
  const entryRef = useRef(null);
  const getSnapshot = () => {
    const e = store.get(key);
    return e && e.token === resetToken ? e : null;
  };
  const entry = useSyncExternalStore(subscribe, getSnapshot, () => null);
  entryRef.current = entry;
  const value = entry ? entry.value : typeof initial === "function" ? initial() : initial;
  const valueRef = useRef(value); valueRef.current = value;
  const set = useCallback((next) => {
    const cur = valueRef.current;
    const v = typeof next === "function" ? next(cur) : next;
    store.set(key, { value: v, token: resetToken });
    notify();
  }, [key, resetToken]);
  return [value, set];
}
