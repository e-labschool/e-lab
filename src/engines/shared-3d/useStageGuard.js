import { useCallback, useEffect, useMemo, useState } from "react";
import { detectWebGL, isSoftwareGL } from "./webgl.js";

/**
 * ONE hook for every 3D stage (VSEPR, Hybridisation, Intermolecular Forces incl. the heating cube, Bonding lattice / metallic).
 *   const { webgl, lost, canvasKey, aa } = useStageGuard(containerRef);
 *   <Canvas key={canvasKey} ...>        -> remounted after the GPU context is restored
 *   {lost && <ContextLostNotice />}     -> shown while the context is lost
 * `webglcontextlost` does not bubble, so the listeners are attached in the CAPTURE phase on the stage container; calling
 * preventDefault() on the lost event is what allows the browser to restore the context later.  When it is restored the
 * canvas is remounted (fresh renderer, textures and geometries are rebuilt by React) instead of trusting stale GPU state.
 */
export function useStageGuard(containerRef) {
  const webgl = useMemo(() => detectWebGL(), []);
  const aa = useMemo(() => !isSoftwareGL(), []);
  const [lost, setLost] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);
  const onLost = useCallback((e) => { e.preventDefault?.(); setLost(true); }, []);
  const onRestored = useCallback(() => { setLost(false); setCanvasKey((k) => k + 1); }, []);
  useEffect(() => {
    const el = containerRef?.current; if (!el || !webgl) return undefined;
    el.addEventListener("webglcontextlost", onLost, true);
    el.addEventListener("webglcontextrestored", onRestored, true);
    return () => { el.removeEventListener("webglcontextlost", onLost, true); el.removeEventListener("webglcontextrestored", onRestored, true); };
  }, [containerRef, webgl, onLost, onRestored]);
  return { webgl, aa, lost, canvasKey };
}
