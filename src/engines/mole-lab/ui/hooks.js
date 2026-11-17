import { useEffect, useRef, useState } from "react";

/** Live "is the app in dark mode" (the app toggles a `dark` class on <html>). */
export function useIsDark() {
  const read = () => typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const [dark, setDark] = useState(read);
  useEffect(() => {
    if (typeof MutationObserver === "undefined") return undefined;
    const mo = new MutationObserver(() => setDark(read()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

/** Measures an element with ResizeObserver: { width, height }. */
export function useElementSize(ref) {
  const [size, setSize] = useState({ width: 1000, height: 640 });
  useEffect(() => {
    const el = ref.current; if (!el) return undefined;
    const measure = () => { const r = el.getBoundingClientRect(); setSize((s) => (Math.abs(s.width - r.width) < 1 && Math.abs(s.height - r.height) < 1 ? s : { width: r.width, height: r.height })); };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null; ro?.observe(el);
    return () => ro?.disconnect();
  }, [ref]);
  return size;
}

/** Latest-value ref: lets rAF / pointer callbacks read current props without re-subscribing. */
export function useLatest(value) { const r = useRef(value); r.current = value; return r; }

/** Layout class from the SHELL's own measured box (not the window): "wide" >= 980, "medium" >= 640, else "narrow". */
export function layoutClass(width) { return width >= 980 ? "wide" : width >= 640 ? "medium" : "narrow"; }
