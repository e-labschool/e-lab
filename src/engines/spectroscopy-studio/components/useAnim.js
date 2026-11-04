import { useEffect, useRef, useState } from "react";
import { createFrameClock } from "../../../lib/frameTime.js";
import { useReducedMotion, useStudio, useStudioStore } from "../state/StudioContext.jsx";

// Animation hooks of the single workspace. All of them obey the same three rules:
//   * they honour Pause and the speed setting of the transport (store.paused / store.speed),
//   * with prefers-reduced-motion they do not animate: transitions jump to their target and ambient motion stays still,
//   * time only advances in requestAnimationFrame with a clamped frame delta (src/lib/frameTime.js), so a hidden tab never jumps.
// Progress values live in the store's timeRefs (not persisted) so that leaving a step and coming back keeps what was shown.

/** A free-running phase in display seconds for ambient motion (waves, precession, tumbling). ~30 state updates per second. */
export function usePhase({ scale = 1, enabled = true } = {}) {
  const speed = useStudio((s) => s.speed);
  const paused = useStudio((s) => s.paused);
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState(0);
  const pRef = useRef(0);
  useEffect(() => {
    if (!enabled || paused || reduced) return undefined;
    const clock = createFrameClock(); let raf = 0; let acc = 0; let alive = true;
    const tick = (now) => {
      if (!alive) return;
      const dt = clock.tick(now); acc += dt; pRef.current += dt * speed * scale;
      if (acc > 1 / 30) { acc = 0; setPhase(pRef.current); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(raf); clock.dispose(); };
  }, [enabled, paused, reduced, speed, scale]);
  return phase;
}

/**
 * Progress 0..1 that moves towards `target` (0 or 1) over `seconds` of display time (divided by the speed setting).
 *   id    key of the progress in the store: the same id returns the same progress after a step change
 *   from  progress to start from when nothing is stored yet (default: the target, i.e. no animation on first mount)
 * Reset (store.resetPlayback) sends the progress back to 0 and it animates towards the target again.
 */
export function useTransition({ id, target, seconds = 2.4, from }) {
  const store = useStudioStore();
  const speed = useStudio((s) => s.speed);
  const paused = useStudio((s) => s.paused);
  const resetToken = useStudio((s) => s.resetToken);
  const reduced = useReducedMotion();
  const start = (key) => (reduced ? target : store.getTime(key, from ?? target));
  const [st, setSt] = useState(() => ({ id, p: start(id) }));
  const pRef = useRef(st.p);
  if (st.id !== id) { const n = { id, p: start(id) }; pRef.current = n.p; setSt(n); }
  const seen = useRef(resetToken);
  useEffect(() => {
    if (seen.current === resetToken) return;
    seen.current = resetToken; pRef.current = reduced ? target : 0; store.setTime(id, pRef.current); setSt({ id, p: pRef.current });
  }, [resetToken]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (reduced) { pRef.current = target; store.setTime(id, target); setSt({ id, p: target }); return undefined; }
    if (paused || Math.abs(pRef.current - target) < 1e-6) return undefined;
    const clock = createFrameClock(); let raf = 0; let alive = true;
    const tick = (now) => {
      if (!alive) return;
      const dt = clock.tick(now) * speed / Math.max(0.05, seconds);
      const cur = pRef.current; const next = target > cur ? Math.min(target, cur + dt) : Math.max(target, cur - dt);
      pRef.current = next; store.setTime(id, next); setSt({ id, p: next });
      if (next !== target) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(raf); clock.dispose(); };
  }, [id, target, paused, speed, reduced, seconds, resetToken]); // eslint-disable-line react-hooks/exhaustive-deps
  return st.id === id ? st.p : pRef.current;
}

/** Smooth ease for a 0..1 progress. */
export const ease = (x) => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };
