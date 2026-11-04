// SIMPLIFIED CONTINUOUS-WAVE (CW) RESONANCE-RESPONSE MODEL -- introductory only.
// Pure module (no React, no three). Tested by scripts/test-nmr-steps.mjs.
//
// What it is: the steady-state absorption of a weak, continuous radiofrequency field of frequency nu_rf by an ensemble of isolated spin-1/2
// nuclei in a field B0, obtained from the SAME Bloch equations as blochSim.js (rotating frame, Omega = (omega1, 0, Delta),
// Delta = omega0 - omega_rf = -2 pi (nu_rf - nu0)). Setting dM/dt = 0 gives
//     Mx = My Delta T2                                           (dispersion part)
//     Mz = M0 - My omega1 T1
//     My = M0 omega1 T2 / (1 + Delta^2 T2^2 + omega1^2 T1 T2)    (absorption part)
// i.e. a Lorentzian in the offset nu_rf - nu0 centred on the resonance. Its full width at half maximum is
//     FWHM = (1 / (pi T2)) sqrt(1 + s),     s = omega1^2 T1 T2  (saturation parameter; s << 1 for a weak field).
// The absorbed power is proportional to My, so the plotted "relative absorption" is My / My(on resonance) (peak = 1).
//
// What it is NOT: modern spectrometers do not sweep a narrow CW frequency through every resonance. They excite all resonances at once with
// one short RF pulse and record the free induction decay, then Fourier transform it (steps 4 and 5). The CW picture is used here only
// to show WHY a frequency matching dE = h nu is needed (resonance).
//
// Illustrative widths (documented in the UI): a real small-molecule 1H line is about 1 Hz wide or narrower, a part in 10^9 of nu0, which
// no slider could find. The model therefore uses an illustrative line width of CW_FWHM_HZ = 20 Hz (T2 about 16 ms) and a weak field
// (s = CW_SATURATION), and the UI says so.
import { TWO_PI } from "./blochSim.js";
import { larmorHz, larmorMHz } from "./constants.js";

export const CW_LABEL = "Simplified continuous-wave model (introductory)";
export const CW_FWHM_HZ = 20; // observed full width at half maximum (illustrative; real lines are ~1 Hz or narrower)
export const CW_SATURATION = 0.05; // s = omega1^2 T1 T2 (weak field)
export const CW_SPAN_HZ = 100; // the RF slider spans nu0 +- 100 Hz
export const CW_DEFAULT_OFFSET_HZ = 40; // where the slider starts: off resonance, so the student has to find it
export const CW_STEP_HZ = 1;

/** Bloch parameters (rad/s, s) that reproduce the stated FWHM and saturation. T1 = T2 (liquid, extreme narrowing; illustrative). */
export function cwParams({ fwhmHz = CW_FWHM_HZ, saturation = CW_SATURATION } = {}) {
  const t2 = Math.sqrt(1 + saturation) / (Math.PI * fwhmHz);
  const t1 = t2;
  const omega1 = Math.sqrt(saturation / (t1 * t2));
  return { t1, t2, omega1, fwhmHz, saturation, m0: 1 };
}
export const CW = cwParams();

/** Steady-state magnetisation (units of M0) for an RF offset nu_rf - nu0 in Hz. */
export function cwSteadyState(offsetHz, p = CW) {
  const delta = -TWO_PI * offsetHz;
  const den = 1 + delta * delta * p.t2 * p.t2 + p.omega1 * p.omega1 * p.t1 * p.t2;
  const my = (p.m0 * p.omega1 * p.t2) / den;
  return { mx: my * delta * p.t2, my, mz: p.m0 - my * p.omega1 * p.t1 };
}
const PEAK = (p) => cwSteadyState(0, p).my;

/** Relative absorption (0..1; 1 on resonance) at an RF offset in Hz. */
export function cwAbsorption(offsetHz, p = CW) {
  return cwSteadyState(offsetHz, p).my / PEAK(p);
}
/** Full width at half maximum (Hz) of the absorption line = (1 / pi T2) sqrt(1 + s). */
export function cwFwhm(p = CW) {
  return Math.sqrt(1 + p.omega1 * p.omega1 * p.t1 * p.t2) / (Math.PI * p.t2);
}
/** Sampled curve over [-span, +span] Hz: { x: offsets (Hz), y: relative absorption }. */
export function cwCurve(span = CW_SPAN_HZ, n = 401, p = CW) {
  const x = new Float64Array(n); const y = new Float64Array(n);
  for (let i = 0; i < n; i += 1) { x[i] = -span + (2 * span * i) / (n - 1); y[i] = cwAbsorption(x[i], p); }
  return { x, y };
}
/** True when the RF is within half a line width of resonance ("on resonance"). */
export const cwOnResonance = (offsetHz, p = CW) => Math.abs(offsetHz) <= cwFwhm(p) / 2;

// ---- the RF frequency slider (centred on the resonance of the current field) ----
export const rfOffsetHz = (rfMHz, b0Tesla) => Math.round((rfMHz * 1e6 - larmorHz(b0Tesla)) * 1000) / 1000;
/** Absolute RF frequency (MHz, 1 Hz resolution) for an offset from the resonance at B0. */
export const rfFromOffset = (offsetHz, b0Tesla) => Math.round(larmorHz(b0Tesla) + offsetHz) / 1e6;
export const clampOffset = (offsetHz, span = CW_SPAN_HZ) => Math.min(span, Math.max(-span, offsetHz));
/** Slider range in MHz around the resonance at B0. */
export function rfRangeMHz(b0Tesla, span = CW_SPAN_HZ) {
  return { min: rfFromOffset(-span, b0Tesla), max: rfFromOffset(span, b0Tesla), centre: larmorMHz(b0Tesla) };
}
/**
 * New RF frequency when the field changes from oldB0 to newB0: the offset from resonance is kept when it still fits on the slider, otherwise
 * the default offset is used (the slider is always centred on the resonance of the CURRENT field, so the step-2 field carries over).
 */
export function retuneRf(rfMHz, oldB0, newB0, span = CW_SPAN_HZ) {
  const off = rfOffsetHz(rfMHz, oldB0);
  const keep = Number.isFinite(off) && Math.abs(off) <= span;
  return rfFromOffset(keep ? off : CW_DEFAULT_OFFSET_HZ, newB0);
}
