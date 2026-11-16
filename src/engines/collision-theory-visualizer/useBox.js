import { useLayoutEffect, useState } from "react";
/** Measured pixel size of an element (ResizeObserver). jsdom has no layout, so fall back to a default. */
export function useBox(ref, fallback = { w: 360, h: 220 }) {
  const [box, setBox] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return undefined;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const w = Math.floor(r.width) || fallback.w; const h = Math.floor(r.height) || fallback.h;
      setBox((b) => (b.w === w && b.h === h ? b : { w, h }));
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [ref]); // eslint-disable-line react-hooks/exhaustive-deps
  return box;
}
export function useReducedMotion() {
  const get = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [reduced, setReduced] = useState(get);
  useLayoutEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const h = (e) => setReduced(e.matches);
    mq.addEventListener?.("change", h);
    return () => mq.removeEventListener?.("change", h);
  }, []);
  return reduced;
}
