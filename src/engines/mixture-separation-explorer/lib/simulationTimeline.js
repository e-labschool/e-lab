// The shared progress-driven state machine every method-specific
// simulation is built on. A single `progress` value (0 to 1) advances
// via requestAnimationFrame; every visual element is a PURE function of
// that value (see mapRange below), so pause/replay/reset can never
// leave an inconsistent partial state -- there is nothing to "undo",
// only a value to move.
import { useState, useRef, useCallback, useEffect } from "react";

/** Maps the shared timeline `progress` into a clamped 0-1 sub-progress
 * for one apparatus element's own [start, end] window. Windows are
 * allowed to overlap (e.g. "pouring" and "filtering" both partly active
 * at once) -- each element only ever reads its own window, never a
 * single global "phase" enum, which is what makes overlapping stages
 * possible without conflicting state. Verified: clamps to 0 before its
 * window, 1 after, and interpolates linearly within it. */
export function mapRange(progress, start, end) {
  if (end <= start) return progress >= end ? 1 : 0;
  return Math.max(0, Math.min(1, (progress - start) / (end - start)));
}

/**
 * useSimulationTimeline({ durationMs, reducedMotion, active })
 *
 * Returns { progress, status, play, pause, replay, reset }.
 *
 * - status: "idle" | "playing" | "paused" | "complete"
 * - play(): resumes from the current progress (or from 0 if idle/complete)
 * - pause(): freezes progress exactly where it is
 * - replay(): resets progress to 0 and immediately plays
 * - reset(): resets progress to 0 and returns to "idle" (does NOT auto-play)
 * - `active`: when false (e.g. off-screen, or the component using this
 *   has been superseded by a different mixture/method selection), the
 *   animation loop is torn down entirely -- no background RAF churn.
 * - `reducedMotion`: when true, play()/replay() jump straight to the
 *   final settled state (progress=1) instead of animating continuously.
 */
export function useSimulationTimeline({ durationMs, reducedMotion = false, active = true } = {}) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("idle");
  const rafRef = useRef(null);
  const lastTimeRef = useRef(null);

  const stopLoop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastTimeRef.current = null;
  }, []);

  const runLoop = useCallback(() => {
    function tick(now) {
      lastTimeRef.current ??= now;
      const dt = now - lastTimeRef.current;
      lastTimeRef.current = now;
      setProgress((prev) => {
        const next = Math.min(1, prev + dt / durationMs);
        if (next >= 1) {
          setStatus("complete");
          stopLoop();
          return 1;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [durationMs, stopLoop]);

  const play = useCallback(() => {
    if (reducedMotion) {
      setProgress(1);
      setStatus("complete");
      return;
    }
    if (status === "complete") setProgress(0);
    setStatus("playing");
    stopLoop();
    runLoop();
  }, [reducedMotion, runLoop, stopLoop, status]);

  const pause = useCallback(() => {
    stopLoop();
    setStatus((prev) => (prev === "playing" ? "paused" : prev));
  }, [stopLoop]);

  const replay = useCallback(() => {
    stopLoop();
    setProgress(0);
    if (reducedMotion) {
      setProgress(1);
      setStatus("complete");
      return;
    }
    setStatus("playing");
    runLoop();
  }, [reducedMotion, runLoop, stopLoop]);

  const reset = useCallback(() => {
    stopLoop();
    setProgress(0);
    setStatus("idle");
  }, [stopLoop]);

  // Tearing down the loop when this timeline becomes inactive (off
  // screen, or superseded by a different mixture/method) is what
  // prevents a permanent background render loop from accumulating.
  useEffect(() => {
    if (!active) stopLoop();
    return stopLoop;
  }, [active, stopLoop]);

  return { progress, status, play, pause, replay, reset };
}
