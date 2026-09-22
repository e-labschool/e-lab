import { useState, useEffect } from "react";

/** Tracks prefers-reduced-motion live, matching the pattern already
 * used elsewhere in this project (ThemeContext and several existing
 * simulations). Kept local to this engine rather than importing from
 * another engine's folder, matching this project's established
 * convention of self-contained simulation engines. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handle = (e) => setReduced(e.matches);
    mq.addEventListener("change", handle);
    return () => mq.removeEventListener("change", handle);
  }, []);
  return reduced;
}
