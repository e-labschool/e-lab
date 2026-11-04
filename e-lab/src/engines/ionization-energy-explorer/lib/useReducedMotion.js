import { useState, useEffect } from "react";

/** Tracks prefers-reduced-motion live -- same pattern used by every other
 * engine in this project (build-an-atom, wave-explorer,
 * mixture-separation-explorer), kept local to this engine per the
 * project's self-contained-engine convention rather than importing from
 * another engine's folder. */
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
