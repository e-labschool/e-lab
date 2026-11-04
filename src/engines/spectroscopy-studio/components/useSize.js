import { useEffect, useState } from "react";

/** Measure an element with a ResizeObserver: const [ref, {width, height}] = useSize(). A CALLBACK ref is used on purpose, so the element can
 * mount late (e.g. inside a portal that waits for its target) and is still observed. jsdom has no layout: it reports 0 x 0. */
export function useSize(initial = { width: 0, height: 0 }) {
  const [el, setEl] = useState(null);
  const [size, setSize] = useState(initial);
  useEffect(() => {
    if (!el) return undefined;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const w = Math.round(r.width); const h = Math.round(r.height);
      setSize((s) => (s.width === w && s.height === h ? s : { width: w, height: h }));
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [el]);
  return [setEl, size];
}
