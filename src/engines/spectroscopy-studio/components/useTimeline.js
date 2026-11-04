import { useCallback, useEffect, useRef, useState } from "react";
import { createFrameClock } from "../../../lib/frameTime.js";
import { useReducedMotion, useStudio, useStudioStore } from "../state/StudioContext.jsx";

/**
 * A playback timeline in DISPLAY seconds (pedagogical time) driven by the shared Play / Pause / Step / Reset / Speed controls.
 *   duration  total display length
 *   events    display times of "significant scientific events" (Step Forward / Step Back jump between 0, the events and the end;
 *             Teacher mode pauses playback when one is reached)
 * The position is kept in the studio store (not React state), so leaving a stage and coming back resumes exactly where it was.
 * Time only advances inside requestAnimationFrame with a clamped frame delta (src/lib/frameTime.js), so a hidden tab never
 * jumps the animation. With prefers-reduced-motion, Play does not animate: it jumps to the next event.
 */
export function useTimeline({ id, duration, events = [], pauseAtEvents, initial = 0 }) {
  const store = useStudioStore();
  const playing = useStudio((s) => s.playing);
  const speed = useStudio((s) => s.speed);
  const stepRequest = useStudio((s) => s.stepRequest);
  const resetToken = useStudio((s) => s.resetToken);
  const mode = useStudio((s) => s.mode);
  const reduced = useReducedMotion();
  const [t, setT] = useState(() => Math.min(duration, store.getTime(id, initial)));
  const tRef = useRef(t);
  const evRef = useRef([]);
  evRef.current = [...new Set([0, ...events.filter((e) => e > 0 && e < duration), duration])].sort((a, b) => a - b);
  const pauseEv = pauseAtEvents ?? mode === "teacher";

  const jump = useCallback((v) => {
    const c = Math.min(duration, Math.max(0, v));
    tRef.current = c; store.setTime(id, c); setT(c);
  }, [duration, id, store]);

  const seen = useRef({ step: stepRequest.n, reset: resetToken });
  useEffect(() => {
    if (seen.current.step === stepRequest.n) return;
    seen.current.step = stepRequest.n;
    const evs = evRef.current; const cur = tRef.current; const eps = 1e-6;
    if (stepRequest.dir > 0) jump(evs.find((e) => e > cur + eps) ?? duration);
    else jump([...evs].reverse().find((e) => e < cur - eps) ?? 0);
  }, [stepRequest, duration, jump]);
  useEffect(() => {
    if (seen.current.reset === resetToken) return;
    seen.current.reset = resetToken; jump(0);
  }, [resetToken, jump]);

  useEffect(() => {
    if (!playing) return undefined;
    if (reduced) {
      const evs = evRef.current; const cur = tRef.current;
      jump(evs.find((e) => e > cur + 1e-6) ?? 0); store.setPlaying(false);
      return undefined;
    }
    if (tRef.current >= duration - 1e-9) jump(0);
    const clock = createFrameClock(); let raf = 0; let alive = true;
    const tick = (now) => {
      if (!alive) return;
      const dt = clock.tick(now) * speed;
      const prev = tRef.current; let next = prev + dt;
      if (pauseEv) {
        const hit = evRef.current.find((e) => e > prev + 1e-6 && e <= next + 1e-9);
        if (hit !== undefined) { jump(hit); store.setPlaying(false); return; }
      }
      if (next >= duration) { jump(duration); store.setPlaying(false); return; }
      jump(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(raf); clock.dispose(); };
  }, [playing, speed, reduced, duration, pauseEv, jump, store]);

  return { t, jump, playing, reduced, atEnd: t >= duration - 1e-9, events: evRef.current };
}

/** A free-running phase (display seconds) for ambient motion (field lines, precession decoration). Frozen when paused is requested,
 * with reduced motion, or while the tab is hidden. ~30 fps state updates. */
export function usePhase({ enabled = true, speedScale = 1 } = {}) {
  const speed = useStudio((s) => s.speed);
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (!enabled || reduced) return undefined;
    const clock = createFrameClock(); let raf = 0; let acc = 0; let alive = true; let p = 0;
    const tick = (now) => {
      if (!alive) return;
      const dt = clock.tick(now); acc += dt; p += dt * speed * speedScale;
      if (acc > 1 / 30) { acc = 0; setPhase(p); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(raf); clock.dispose(); };
  }, [enabled, reduced, speed, speedScale]);
  return phase;
}
