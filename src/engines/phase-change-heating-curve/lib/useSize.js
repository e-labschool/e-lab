import { useEffect, useState } from "react";

/** Container-driven layout: measures an element with a ResizeObserver.
 * const [ref, { width, height }] = useSize(). A callback ref is used so the element
 * is observed even if it mounts late. jsdom has no layout and reports 0 x 0. */
export function useSize() {
  const [el, setEl] = useState(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!el) return undefined;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const w = Math.round(r.width);
      const h = Math.round(r.height);
      setSize((s) => (s.width === w && s.height === h ? s : { width: w, height: h }));
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [el]);
  return [setEl, size];
}
