import { useEffect, useState } from "react";
const query = () => { try { return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
/** Live `prefers-reduced-motion: reduce`. */
export default function useReducedMotion() {
  const [reduced, setReduced] = useState(query);
  useEffect(() => {
    let mq; try { mq = window.matchMedia?.("(prefers-reduced-motion: reduce)"); } catch { return undefined; }
    if (!mq) return undefined;
    const on = () => setReduced(mq.matches); mq.addEventListener?.("change", on); return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}
export { query as prefersReducedMotion };
