import { useState, useEffect, useRef } from "react";

/** True while the referenced element is at least partially on screen --
 * used to stop the simulation's requestAnimationFrame loop when the
 * student scrolls the simulation out of view, rather than letting it
 * keep animating in the background. Returns [ref, inView]. */
export function useInView({ threshold = 0.1 } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(true); // assume visible until observed, so the very first render still animates

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, inView];
}
