export const KW = 1e-14; // at 25 °C
export const INITIAL_H = 1e-7;
export const DROP_FACTOR = 5; // each drop multiplies [H+] by this
export const MAX_H = 1;

export function nextHConcentration(currentH) {
  return Math.min(MAX_H, currentH * DROP_FACTOR);
}

export function ohFromH(h) {
  return KW / h;
}

export function pHFromH(h) {
  return -Math.log10(h);
}

export function classify(pH) {
  if (Math.abs(pH - 7) < 0.05) return "Neutral";
  return pH < 7 ? "Acidic" : "Basic";
}

// Logarithmic bar-height mapping across the full realistic range
// (1e-14 to 1 mol dm⁻³) — this is what makes both bars exactly equal at
// pure water (both sit at the 1e-7 midpoint) and keeps the visual
// readable across many orders of magnitude, without ever needing to
// draw an axis or a graph.
export function barFraction(conc) {
  const frac = (Math.log10(conc) + 14) / 14;
  return Math.min(1, Math.max(0, frac));
}

// Smooth log-space interpolation between two concentrations — used
// while a bar is animating, so the transition itself also reads
// logarithmically rather than jumping linearly through the exponent.
export function lerpConcentration(fromConc, toConc, t) {
  const fromLog = Math.log10(fromConc);
  const toLog = Math.log10(toConc);
  return Math.pow(10, fromLog + (toLog - fromLog) * t);
}
