// Maxwell-Boltzmann distribution of translational kinetic energy for a 3-D gas, in kJ mol^-1.
//   f(E) = 2/sqrt(pi) * E^(1/2) * (kT)^(-3/2) * exp(-E/kT)      with kT = R T  (kJ mol^-1)
// f is a probability DENSITY (per kJ mol^-1); the area under it is exactly 1 for any T.
// Fractions come from the EXACT integral (regularised upper incomplete gamma function Q(3/2, Ea/kT)),
// never from a truncated numerical sum, so the fraction >= Ea is right at every temperature.
import { niceStep } from "./rateMetrics.js";
export const R_KJ = 0.008314462618; // kJ mol^-1 K^-1

export const kT = (T) => R_KJ * T;

export function mbDensity(E, T) {
  if (!(E > 0)) return 0;
  const k = kT(T);
  return (2 / Math.sqrt(Math.PI)) * Math.sqrt(E) / (k * Math.sqrt(k)) * Math.exp(-E / k);
}

// ln Gamma (Lanczos, g = 7)
const LG = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
export function lnGamma(z) {
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  z -= 1;
  let s = LG[0];
  const t = z + 7.5;
  for (let i = 1; i < 9; i++) s += LG[i] / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(s);
}

/** Regularised upper incomplete gamma Q(a, x) = Gamma(a, x) / Gamma(a). Series for x < a+1, continued fraction otherwise. */
export function gammaQ(a, x) {
  if (x <= 0) return 1;
  const gln = lnGamma(a);
  if (x < a + 1) {
    let ap = a; let sum = 1 / a; let del = sum;
    for (let n = 0; n < 1000; n++) { ap += 1; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-16) break; }
    return Math.max(0, 1 - sum * Math.exp(-x + a * Math.log(x) - gln));
  }
  const FP = 1e-300;
  let b = x + 1 - a; let c = 1 / FP; let d = 1 / b; let h = d;
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < FP) d = FP;
    c = b + an / c; if (Math.abs(c) < FP) c = FP;
    d = 1 / d;
    const del = d * c; h *= del;
    if (Math.abs(del - 1) < 1e-16) break;
  }
  return Math.exp(-x + a * Math.log(x) - gln) * h;
}

/** Exact fraction of molecules with kinetic energy >= Ea (kJ/mol) at temperature T (K). */
export function fractionAbove(Ea, T) { return gammaQ(1.5, Ea / kT(T)); }
/** Exact fraction with kinetic energy < Ea. (1 - fractionAbove loses nothing at these magnitudes.) */
export function fractionBelow(Ea, T) { return 1 - fractionAbove(Ea, T); }

export const peakEnergy = (T) => kT(T) / 2;
export const meanEnergy = (T) => 1.5 * kT(T);
export const peakDensity = (T) => mbDensity(peakEnergy(T), T);
/** Arrhenius factor exp(-Ea/RT): fraction of collisions whose energy along the line of centres is >= Ea. */
export const arrheniusFactor = (Ea, T) => Math.exp(-Ea / kT(T));

/** Composite Simpson rule (n even). */
export function simpson(f, a, b, n = 2000) {
  if (n % 2) n += 1;
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
  return (s * h) / 3;
}

/**
 * Independent numerical check (used by the tests): integrate over u = sqrt(E), which removes the sqrt singularity,
 * out to where the tail is below 1e-30 of the area. Returns the fraction of the area with E >= Ea.
 */
export function numericFractionAbove(Ea, T, n = 20000) {
  const k = kT(T);
  const uMax = Math.sqrt(Math.max(Ea, 0) + 90 * k);
  const g = (u) => mbDensity(u * u, T) * 2 * u;
  const uEa = Math.sqrt(Math.max(Ea, 0));
  return simpson(g, uEa, uMax, n);
}
export function numericArea(T, n = 20000) { return numericFractionAbove(0, T, n); }

/** Kinetic energy (kJ/mol) of one molecule: three Gaussian velocity components -> exactly the 3-D MB energy distribution. */
export function sampleEnergy(T, rng) {
  const k = kT(T);
  const a = rng.gauss(); const b = rng.gauss(); const c = rng.gauss();
  return 0.5 * k * (a * a + b * b + c * c);
}

/** Sample points of the density for plotting: arrays of E and f. */
export function densityCurve(T, xMax, n = 240) {
  const E = new Float64Array(n + 1); const f = new Float64Array(n + 1);
  for (let i = 0; i <= n; i++) { E[i] = (xMax * i) / n; f[i] = mbDensity(E[i], T); }
  return { E, f };
}

/** Readable percentage: never rounds a small non-zero fraction to "0%". */
export function formatFraction(fr) {
  if (!(fr > 0)) return "0 %";
  const p = fr * 100;
  if (p >= 10) return `${p.toFixed(0)} %`;
  if (p >= 1) return `${p.toFixed(1)} %`;
  if (p >= 0.01) return `${p.toFixed(2)} %`;
  const exp = Math.floor(Math.log10(p));
  const man = p / 10 ** exp;
  return `${man.toFixed(1)}×10${toSup(exp)} %`;
}
function toSup(n) {
  const m = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "-": "⁻" };
  return String(n).split("").map((ch) => m[ch] ?? ch).join("");
}

// ---------------------------------------------------------------------------------------------------------------------
// Axis for the energy graph. The curve itself is never rescaled or reshaped: only the axis limits adapt.
//   x: up to about 6.5 kT (where the tail has fallen to about 1 % of the peak) rounded UP to a round number, so the peak and
//      the long right-hand tail are both visible at every temperature, yet the curve still visibly moves, flattens and
//      widens when T changes (the limit moves in coarse round steps, not continuously).
//   y: about 12 % above the tallest curve shown (this one, and a pinned one if there is one), rounded up.
//   Ea beyond the x range: `needsFull` is true and `full` (a larger x range reaching Ea) is offered as a separate option.
export const TAIL_KT = 6.5;
/** Plot limits for kinetic-energy curves at T (and, optionally, a pinned curve at pinnedT), with the thresholds eaList (kJ/mol). */
export function mbAxis(T, { pinnedT = null, eaList = [], full = false } = {}) {
  const Ts = pinnedT ? [T, pinnedT] : [T];
  const base = niceStep(TAIL_KT * kT(Math.max(...Ts)));
  const eaMax = Math.max(0, ...eaList);
  const needsFull = eaMax > base * 0.97;
  const xMax = full && needsFull ? niceStep(Math.max(base, eaMax * 1.15)) : base;
  const yPeak = Math.max(...Ts.map((t) => peakDensity(t)));
  const yMax = niceStep(yPeak * 1.12);
  return { xMax, yMax, needsFull, baseXMax: base, full: !!(full && needsFull) };
}
