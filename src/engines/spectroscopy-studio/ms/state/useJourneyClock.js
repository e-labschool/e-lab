import { useEffect, useRef, useState } from "react";
import { createFrameClock } from "../../../../lib/frameTime.js";
import { useReducedMotion, useStudio } from "../../state/StudioContext.jsx";
import { useMs, useMsStore } from "./MsContext.jsx";

/**
 * The experiment clock of the active stage: seconds of stage time, advanced by requestAnimationFrame with a clamped frame delta (hidden tab never jumps).
 * It honours the shared Play / Pause and speed of the transport, jumps to the end state with prefers-reduced-motion, and obeys store.seek (stage change,
 * Replay, Step Forward / Step Back). `armed` is false while nothing should move yet (stage 1 before "Start sample introduction").
 * The latest value is mirrored to store.live (not reactive) so the transport can find the next beat.
 */
export function useJourneyClock({ stage, duration, armed }) {
  const store = useMsStore(); const seek = useMs((s) => s.seek);
  const paused = useStudio((s) => s.paused); const speed = useStudio((s) => s.speed); const resetToken = useStudio((s) => s.resetToken);
  const reduced = useReducedMotion();
  const [t, setT] = useState(() => (reduced && armed ? duration : 0)); const tRef = useRef(t); const durRef = useRef(duration);
  durRef.current = duration;
  const apply = (v) => { const c = Math.max(0, Math.min(durRef.current, v)); tRef.current = c; store.live.t = c; setT(c); };
  const seen = useRef({ seek: seek.token, reset: resetToken, stage });
  useEffect(() => {
    const s = seen.current;
    if (s.seek !== seek.token) { s.seek = seek.token; apply(reduced && armed ? Infinity : seek.t); }
    else if (s.reset !== resetToken) { s.reset = resetToken; apply(reduced ? Infinity : 0); }
    else if (s.stage !== stage) { apply(reduced ? Infinity : 0); }
    s.stage = stage;
  }, [seek.token, resetToken, stage]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { store.live.duration = duration; store.live.stage = stage; if (tRef.current > duration) apply(duration); }, [duration, stage]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (reduced && armed) apply(durRef.current); }, [reduced, armed]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (paused || !armed || reduced || typeof requestAnimationFrame === "undefined") return undefined;
    const clock = createFrameClock(); let raf = 0; let alive = true; let acc = 0;
    const tick = (now) => {
      if (!alive) return; const dt = clock.tick(now); acc += dt;
      if (tRef.current < durRef.current) { tRef.current = Math.min(durRef.current, tRef.current + dt * speed); store.live.t = tRef.current; if (acc > 1 / 40 || tRef.current >= durRef.current) { acc = 0; setT(tRef.current); } }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(raf); clock.dispose(); };
  }, [paused, armed, speed, reduced, store]);
  return t;
}
