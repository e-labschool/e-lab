import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

// FULLSCREEN, two layers, ONE hook:
//
//  1. the standards Fullscreen API (requestFullscreen / exitFullscreen) when the browser offers it for this element.
//     The browser owns Escape there; the real `fullscreenchange` event is the single source of truth.
//  2. a CSS "pseudo fullscreen" fallback for browsers that have no element Fullscreen API (iPhone Safari), when
//     `document.fullscreenEnabled` is false, or when requestFullscreen() is rejected. The target element gets
//     `data-elab-fullscreen="css"` (styled in simulation-controls.css: fixed, inset 0, above the sticky app bars),
//     the page behind it stops scrolling, and Escape exits (a single document keydown listener that exists only while
//     the fallback is active).
//
// Either way the element stays mounted (children are never remounted), so simulation state survives entering and leaving.
// While native fullscreen is active the same element also carries `data-elab-fullscreen="native"` so tests and CSS can
// treat both kinds alike.

const ATTR = "data-elab-fullscreen";
const ROOT_CLASS = "elab-css-fullscreen";

let cssTarget = null;
const subscribers = new Set();
function emit() { subscribers.forEach((fn) => fn()); }
function onKeyDown(e) {
  if (e.key === "Escape" && !e.defaultPrevented) setCssTarget(null);
}
function setCssTarget(el) {
  if (cssTarget === el) return;
  if (cssTarget) {
    cssTarget.removeAttribute(ATTR);
    document.removeEventListener("keydown", onKeyDown);
    document.documentElement.classList.remove(ROOT_CLASS);
  }
  cssTarget = el;
  if (el) {
    el.setAttribute(ATTR, "css");
    document.addEventListener("keydown", onKeyDown);
    document.documentElement.classList.add(ROOT_CLASS);
  }
  emit();
}
function subscribeCss(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

function nativeAvailable(el) {
  if (typeof document === "undefined" || !el) return false;
  return document.fullscreenEnabled !== false && typeof el.requestFullscreen === "function";
}

/** The shared Fullscreen hook for a given element ref (see the file comment).
 *  Returns { isFullscreen, isSupported, isCss, toggle, enter, exit }.
 *  `isSupported` is always true in a browser: when the Fullscreen API is missing the CSS fallback is used, so the
 *  control is never hidden. Several components may call this with the same ref; each derives its state from the same
 *  DOM event / module store, so they cannot drift apart. */
export function useFullscreen(targetRef) {
  const [isNative, setIsNative] = useState(false);
  const isCss = useSyncExternalStore(subscribeCss, () => Boolean(cssTarget) && cssTarget === targetRef.current, () => false);

  useEffect(() => {
    const mountedEl = targetRef.current; // refs are already null when this cleanup runs on unmount
    function syncState() {
      const el = targetRef.current;
      const on = Boolean(el) && document.fullscreenElement === el;
      setIsNative(on);
      if (el) { if (on) el.setAttribute(ATTR, "native"); else if (el.getAttribute(ATTR) === "native") el.removeAttribute(ATTR); }
    }
    syncState();
    document.addEventListener("fullscreenchange", syncState);
    return () => {
      document.removeEventListener("fullscreenchange", syncState);
      // The frame itself unmounting while the CSS fallback is on must not leave the page locked. Only the element's
      // removal counts: a consumer (e.g. the actions row) that merely re-mounts inside a still-attached frame must not
      // exit fullscreen, which is exactly what happens when a compact frame swaps its header for the full one.
      if (cssTarget && cssTarget === mountedEl && !mountedEl.isConnected) setCssTarget(null);
    };
  }, [targetRef]);

  const enter = useCallback(() => {
    const el = targetRef.current;
    if (!el) return;
    if (nativeAvailable(el)) {
      Promise.resolve(el.requestFullscreen()).catch(() => setCssTarget(el)); // rejected (permissions policy, iframe): fall back
    } else {
      setCssTarget(el);
    }
  }, [targetRef]);

  const exit = useCallback(() => {
    if (cssTarget && cssTarget === targetRef.current) setCssTarget(null);
    if (document.fullscreenElement && document.fullscreenElement === targetRef.current) {
      Promise.resolve(document.exitFullscreen?.()).catch(() => { /* nothing else to do */ });
    }
  }, [targetRef]);

  const isFullscreen = isNative || isCss;
  const toggle = useCallback(() => {
    if (cssTarget === targetRef.current || document.fullscreenElement === targetRef.current) exit();
    else enter();
  }, [targetRef, enter, exit]);

  return { isFullscreen, isSupported: typeof document !== "undefined", isCss, toggle, enter, exit };
}
