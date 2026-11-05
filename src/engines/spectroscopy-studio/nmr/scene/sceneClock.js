// The animation clock of the 3D proton scenes. It lives in the frame loop (no React state per frame) and obeys the transport:
// it does not advance when paused or when the user prefers reduced motion (the scenes then show a static but complete picture:
// spheres, moment arrows, precession rings and labels all stay), and it is scaled by the speed setting. Time steps are clamped, so a
// hidden tab never makes the model jump.
import { PRECESSION_REV_PER_S, SPIN_REV_PER_S } from "../physics/spinEnsemble.js";

export const makeClock = () => ({ spin: 0, prec: 0, wander: 0, stamp: -1 });

/** Advance once per frame (`elapsed` identifies the frame, so several components can call it). L = { paused, reduced, speed }. */
export function advanceClock(c, L, elapsed, delta) {
  if (c.stamp === elapsed) return c;
  c.stamp = elapsed;
  if (L.paused || L.reduced) return c;
  const dt = Math.min(delta, 0.1) * (L.speed ?? 1);
  c.spin += dt * SPIN_REV_PER_S * 2 * Math.PI;
  c.prec += dt * PRECESSION_REV_PER_S * 2 * Math.PI;
  c.wander += dt;
  return c;
}

/** Publish a few numbers as data-* attributes on the nearest .ss-three wrapper (at most every 250 ms) so that tests can see the scene is alive. */
export function publish(state, c, values) {
  const now = state.clock.elapsedTime;
  if (c.pubAt !== undefined && now - c.pubAt < 0.25) return;
  c.pubAt = now;
  const el = c.el ?? (c.el = state.gl.domElement.closest(".ss-three"));
  if (!el) return;
  for (const [k, v] of Object.entries(values)) el.setAttribute(`data-${k}`, String(v));
}
