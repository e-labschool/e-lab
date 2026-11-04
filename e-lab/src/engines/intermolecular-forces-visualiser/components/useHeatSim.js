import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SUBSTANCES, advanceEnergy, stateAtEnergy, totalEnergy } from "../model/phase.js";
import { createSystem, stepSystem } from "../model/particles.js";
import { createFrameClock } from "../../../lib/frameTime.js";

// The Heat & Phase Change clock. It lives in React (requestAnimationFrame + the shared frame-time clamp) so the energy model, the
// graph and the readouts run even where WebGL is unavailable; the cube scene only draws the systems stored in simRef.current.items.
// dir: +1 heat, -1 cool, 0 pause. While the tab is hidden rAF stops and the clock drops the first frame after, so nothing jumps.
export default function useHeatSim({ active, substanceId, compare, speed = 1, onVisualFrame }) {
  const [revision, setRevision] = useState(0);
  const simRef = useRef({ items: [], dir: 0, speed });
  const [ui, setUi] = useState(null);
  const [dir, setDirState] = useState(0);
  const build = useCallback(() => {
    const ids = compare ? [substanceId, "NaCl"] : [substanceId];
    simRef.current.items = ids.map((id) => ({ id, sub: SUBSTANCES[id], sys: createSystem(id), E: 0, st: stateAtEnergy(SUBSTANCES[id], 0) }));
    simRef.current.dir = 0; setDirState(0); setRevision((r) => r + 1);
    setUi(snapshot(simRef.current));
  }, [substanceId, compare]);
  useEffect(() => { if (active) build(); }, [active, build]);
  useEffect(() => { simRef.current.speed = speed; }, [speed]);
  const visual = useRef(onVisualFrame); visual.current = onVisualFrame;
  useEffect(() => {
    if (!active) return undefined;
    const clock = createFrameClock(); let raf = 0; let lastUi = 0;
    const loop = (now) => {
      raf = requestAnimationFrame(loop); const dt = clock.tick(now); const S = simRef.current;
      for (const it of S.items) {
        if (S.dir !== 0 && dt > 0) { it.E = advanceEnergy(it.sub, it.E, dt, S.dir, S.speed); it.st = stateAtEnergy(it.sub, it.E); }
        if (dt > 0) stepSystem(it.sys, dt * 1, it.st);
      }
      const first = S.items[0];
      if (first && ((S.dir > 0 && first.E >= totalEnergy(first.sub) - 1e-9) || (S.dir < 0 && first.E <= 1e-9)) && S.items.every((it) => (S.dir > 0 ? it.E >= totalEnergy(it.sub) - 1e-9 : it.E <= 1e-9))) { S.dir = 0; setDirState(0); }
      visual.current?.();
      if (now - lastUi > 100) { lastUi = now; setUi(snapshot(S)); }
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); clock.dispose(); };
  }, [active]);
  const setDir = useCallback((d) => { simRef.current.dir = d; setDirState(d); }, []);
  const reset = useCallback(() => { build(); }, [build]);
  return useMemo(() => ({ simRef, revision, ui, dir, setDir, reset }), [revision, ui, dir, setDir, reset]);
}
function snapshot(S) { return S.items.map((it) => ({ id: it.id, E: it.E, T: it.st.T, phase: it.st.phase, melt: it.st.melt, vap: it.st.vap, total: totalEnergy(it.sub) })); }
