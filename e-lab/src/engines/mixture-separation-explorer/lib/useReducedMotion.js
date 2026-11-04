import { useState, useEffect } from "react";

/** Tracks the user's prefers-reduced-motion setting live (not just at
 * mount), matching the pattern already used elsewhere in this project
 * (ThemeContext, several existing simulations' CSS). */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    function handle(e) {
      setReduced(e.matches);
    }
    mq.addEventListener("change", handle);
    return () => mq.removeEventListener("change", handle);
  }, []);

  return reduced;
}
