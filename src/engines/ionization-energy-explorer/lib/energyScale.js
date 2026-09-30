// Log-aware mapping between a linear slider position (0-1000) and an
// actual supplied-energy value in kJ/mol, so one slider can span
// everything from ~100 kJ/mol (a first ionization energy) up to over a
// million kJ/mol (a deeply-buried 1s electron) while staying usable.
// Every comparison and every displayed number always uses the REAL
// kJ/mol value returned here -- the slider position itself is never
// shown to the student, only used internally to drive this mapping.
const MIN_LOG = 2; // 10^2 = 100 kJ/mol
const MAX_LOG = 6.2; // ~1,584,893 kJ/mol -- comfortably above Ca's largest IE (527,670)
export const SLIDER_MAX = 1000;
export const SCALE_MARKS = [0, 1e3, 1e4, 1e5, 1e6];

export function sliderPositionToEnergy(pos) {
  const p = Math.max(0, Math.min(SLIDER_MAX, Number(pos) || 0));
  if (p <= 0) return 0;
  const log = MIN_LOG + (p / SLIDER_MAX) * (MAX_LOG - MIN_LOG);
  return Math.round(10 ** log);
}

export function energyToSliderPosition(value) {
  const v = Number(value);
  if (!Number.isFinite(v) || v <= 0) return 0;
  const log = Math.log10(v);
  const pos = ((log - MIN_LOG) / (MAX_LOG - MIN_LOG)) * SLIDER_MAX;
  return Math.max(0, Math.min(SLIDER_MAX, Math.round(pos)));
}

/** Guards against NaN/negative/invalid input from the numeric field --
 * always returns a finite number >= 0. */
export function sanitizeEnergyInput(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}
