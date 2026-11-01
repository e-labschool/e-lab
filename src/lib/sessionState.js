import { useCallback, useEffect, useRef, useState } from "react";

// Small shared persistence layer for UI state that should survive a page
// reload or navigating away and back within the same browser tab (NOT a
// substitute for keeping components mounted: ordinary tab switches never
// reload the page, so live React state already survives them -- see
// docs/STATE_PERSISTENCE.md). Backed by sessionStorage, namespaced, and
// defensive: private mode / disabled storage degrade to plain useState.

const NS = "e-lab:ss:";

function store() {
  try { return typeof window !== "undefined" ? window.sessionStorage : null; } catch { return null; }
}

export function sessionKey(...parts) {
  return NS + parts.filter((p) => p !== undefined && p !== null && p !== "").join(":");
}

export function readSession(key, fallback, storage = store()) {
  if (!storage || !key) return fallback;
  try {
    const raw = storage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch { return fallback; }
}

export function writeSession(key, value, storage = store()) {
  if (!storage || !key) return false;
  try {
    if (value === undefined) storage.removeItem(key); else storage.setItem(key, JSON.stringify(value));
    return true;
  } catch { return false; }
}

export function removeSession(key, storage = store()) {
  if (!storage || !key) return;
  try { storage.removeItem(key); } catch { /* storage unavailable */ }
}

/** useState whose value is mirrored to sessionStorage under `key`
 * (build it with sessionKey("sim", lessonId, blockId, "tab")). The key may
 * change (e.g. a different lesson): the stored value for the new key is
 * loaded. `validate(value)` can reject stale/foreign stored shapes. */
export function useSessionState(key, initial, { validate } = {}) {
  const initialRef = useRef(initial);
  const read = () => {
    const stored = readSession(key, undefined);
    if (stored === undefined) return typeof initialRef.current === "function" ? initialRef.current() : initialRef.current;
    return validate && !validate(stored) ? (typeof initialRef.current === "function" ? initialRef.current() : initialRef.current) : stored;
  };
  const [state, setState] = useState(read);
  const keyRef = useRef(key);
  useEffect(() => {
    if (keyRef.current === key) return;
    keyRef.current = key;
    setState(read());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    if (keyRef.current !== key) return;
    writeSession(key, state);
  }, [key, state]);
  const reset = useCallback(() => { removeSession(key); setState(typeof initialRef.current === "function" ? initialRef.current() : initialRef.current); }, [key]);
  return [state, setState, reset];
}
