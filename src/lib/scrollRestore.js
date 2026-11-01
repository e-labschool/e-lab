import { useEffect, useRef } from "react";
import { readSession, writeSession } from "./sessionState.js";

// Scroll position persistence for reload / back-forward. Live tab switches
// need none of this (the page is never reloaded and the DOM is untouched);
// this exists for the cases where the page really is rebuilt.

/** Throttled writer: remembers scroll position of `target` (window or an
 * element) under `key` in sessionStorage. Returns a flush function. */
export function trackScroll(target, key, getPos) {
  let timer = null;
  let armed = false; // nothing is written until a real scroll happened, so a pending restore is never clobbered with 0
  const read = getPos || (() => (target === window ? window.scrollY : target.scrollTop));
  const flush = () => { clearTimeout(timer); timer = null; if (!armed) return; writeSession(key, { y: Math.round(read()), t: Date.now() }); };
  const onScroll = () => { armed = true; if (!timer) timer = setTimeout(flush, 150); };
  const el = target === window ? window : target;
  el.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("pagehide", flush);
  return () => { el.removeEventListener("scroll", onScroll); window.removeEventListener("pagehide", flush); flush(); };
}

/** Navigation kind of the current document load ("reload", "back_forward", "navigate"). */
export function documentNavigationType() {
  try { return performance.getEntriesByType("navigation")[0]?.type || "navigate"; } catch { return "navigate"; }
}

/** Scrolls `el` (window or element) to y as soon as the content is tall
 * enough to reach it (late-loading lessons/images), polling for up to
 * `timeoutMs`; gives up silently. Aborts if the user scrolls first. */
export function restoreWhenTall(el, y, timeoutMs = 4000) {
  const isWin = el === window;
  const max = () => (isWin ? document.documentElement.scrollHeight - window.innerHeight : el.scrollHeight - el.clientHeight);
  const cur = () => (isWin ? window.scrollY : el.scrollTop);
  let lastSet = cur();
  const set = (v) => { lastSet = v; if (isWin) window.scrollTo({ top: v, behavior: "auto" }); else el.scrollTop = v; };
  const started = Date.now();
  let cancelled = false;
  const tick = () => {
    if (cancelled) return;
    if (Math.abs(cur() - lastSet) > 40) { cancelled = true; return; } // user scrolled meanwhile
    if (max() >= y - 1) { set(y); return; }
    if (Date.now() - started > timeoutMs) { set(Math.max(0, max())); return; }
    set(Math.max(0, max()));
    setTimeout(tick, 100);
  };
  tick();
  return () => { cancelled = true; };
}

/** Restores saved scroll once `ready` is true (content laid out). Only acts for
 * the first ready render of this key, and only when `allow` is true. */
export function useScrollRestoration({ key, ready, target = null, allow = true, once = false }) {
  const doneKey = useRef(null);
  useEffect(() => {
    if (!ready || doneKey.current === key) return undefined;
    const first = doneKey.current === null;
    doneKey.current = key;
    if (once && !first) return undefined;
    const el = target?.current ?? target ?? window;
    const saved = allow ? readSession(key, null) : null;
    if (saved && typeof saved.y === "number") {
      restoreWhenTall(el, saved.y);
    }
    return undefined;
  }, [key, ready, target, allow, once]);
  useEffect(() => {
    if (!ready) return undefined;
    const el = target?.current ?? target ?? window;
    return trackScroll(el, key);
  }, [key, ready, target]);
}
