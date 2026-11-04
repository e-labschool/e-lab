// Frame-time helpers for animation loops.
//
// Browsers stop firing requestAnimationFrame in a hidden tab. When the tab is
// shown again the first callback sees a timestamp that is as far ahead as the
// tab was hidden, so any loop that computes dt = now - last jumps its model
// (or finishes a timeline) in one frame. Use clampFrameDelta everywhere dt is
// derived from timestamps; most engines already clamp to 0.05s inline.

export const MAX_FRAME_DT_SECONDS = 0.05;

/** dtSeconds limited to [0, max]; NaN/negative -> 0. */
export function clampFrameDelta(dtSeconds, max = MAX_FRAME_DT_SECONDS) {
  if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) return 0;
  return Math.min(dtSeconds, max);
}

/** Same, for millisecond deltas (returns ms). */
export function clampFrameDeltaMs(dtMs, maxMs = MAX_FRAME_DT_SECONDS * 1000) {
  return clampFrameDelta(dtMs / 1000, maxMs / 1000) * 1000;
}

/** Creates a frame clock: clock.tick(nowMs) -> clamped dt seconds. The first
 * tick, and the first tick after reset()/a hidden period, returns 0. */
export function createFrameClock({ max = MAX_FRAME_DT_SECONDS, doc = typeof document !== "undefined" ? document : null } = {}) {
  let last = null;
  const onVis = () => { if (doc?.hidden) last = null; };
  doc?.addEventListener?.("visibilitychange", onVis);
  return {
    tick(nowMs) {
      const dt = last == null ? 0 : clampFrameDelta((nowMs - last) / 1000, max);
      last = nowMs;
      return dt;
    },
    reset() { last = null; },
    dispose() { doc?.removeEventListener?.("visibilitychange", onVis); },
  };
}
