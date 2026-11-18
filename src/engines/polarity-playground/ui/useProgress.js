import { useCallback, useEffect, useRef, useState } from "react";
import { createFrameClock } from "../../../lib/frameTime.js";
import { maxDt } from "../scene/Stage.jsx";

/** A 0..1 animation progress driven by requestAnimationFrame. dt is capped by the shared test hook (globalThis.__PP_DT_MAX), reduced motion jumps to the end,
 *  and globalThis.__PP_SET_PROGRESS(v) lets a verification script pose the animation exactly (software GL is too slow to wait for it). */
export default function useProgress({ duration = 3, reduced = false, auto = true, resetKey = "" }) {
  const [p, setP] = useState(reduced || !auto ? (reduced ? 1 : 0) : 0);
  const [playing, setPlaying] = useState(auto && !reduced);
  const ref = useRef(p); ref.current = p;
  useEffect(() => { if (reduced) { setP(1); setPlaying(false); } else if (auto) { setP(0); setPlaying(true); } else { setP(0); setPlaying(false); } }, [resetKey, reduced, auto]);
  useEffect(() => {
    if (!playing) return undefined;
    const clock = createFrameClock({ max: 1 }); let raf = 0;
    const tick = (now) => { raf = requestAnimationFrame(tick); const dt = Math.min(clock.tick(now), maxDt()); if (dt <= 0) return; const next = Math.min(1, ref.current + dt / duration); setP(next); if (next >= 1) setPlaying(false); };
    raf = requestAnimationFrame(tick); return () => { cancelAnimationFrame(raf); clock.dispose(); };
  }, [playing, duration]);
  useEffect(() => { globalThis.__PP_SET_PROGRESS = (v) => { setPlaying(false); setP(Math.max(0, Math.min(1, v))); }; return () => { globalThis.__PP_SET_PROGRESS = undefined; }; }, []);
  const play = useCallback(() => { setP(0); setPlaying(!reduced); if (reduced) setP(1); }, [reduced]);
  const reset = useCallback(() => { setPlaying(false); setP(0); }, []);
  return { p, playing, play, reset, set: setP };
}
