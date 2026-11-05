// The vibration clock of the molecule scenes. It lives in the frame loop (no React state per frame), obeys the transport (Pause, speed, reduced motion) and clamps
// the frame step so a hidden tab never makes the model jump.
//
// DISPLAY FREQUENCY. Real molecular vibrations are ~10^13-10^14 Hz, far too fast to see. The animation is slowed by a single fixed factor for every mode,
// so the RELATIVE frequencies are true: a mode at 3657 cm-1 oscillates 3657/1595 = 2.3x faster than one at 1595 cm-1.
export const DISPLAY_HZ_PER_WAVENUMBER = 1 / 3000; // display cycles per second per cm^-1  (3000 cm^-1 -> 1 Hz)
export const SLOWDOWN_NOTE = "slowed down by a factor of about 10¹⁴, the same for every mode, so frequencies keep their true ratios";
export const displayHz = (wn) => wn * DISPLAY_HZ_PER_WAVENUMBER;

export const makeVibClock = () => ({ t: 0, stamp: -1, pubAt: undefined });
export function advanceVibClock(c, L, elapsed, delta) {
  if (c.stamp === elapsed) return c; c.stamp = elapsed;
  if (L.paused || L.reduced) return c;
  c.t += Math.min(delta, 0.1) * (L.speed ?? 1); return c;
}
/** Phase factor -1..1 of the oscillation; the still pose (paused is fine, reduced motion) shows the extreme excursion so the pattern stays readable. */
export const poseFactor = (c, hz, reduced) => (reduced ? 0.8 : Math.sin(2 * Math.PI * hz * c.t));
export function publish(state, c, values) {
  const now = state.clock.elapsedTime; if (c.pubAt !== undefined && now - c.pubAt < 0.25) return; c.pubAt = now;
  const el = c.el ?? (c.el = state.gl.domElement.closest(".ss-three")); if (!el) return;
  for (const [k, v] of Object.entries(values)) el.setAttribute(`data-${k}`, String(v));
}
