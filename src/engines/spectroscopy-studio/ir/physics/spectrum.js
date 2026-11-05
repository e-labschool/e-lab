// Building an IR spectrum from a list of absorption bands (pure).
//
// Conventions (the standard way an IR spectrum is drawn):
//   * x axis: wavenumber in cm^-1 from 4000 on the LEFT to 400 on the RIGHT (decreasing to the right);
//   * y axis: transmittance in % with 100 % at the TOP (absorption bands point DOWN).
// A band is { nu, fwhm, A, eta, ... }: centre (cm^-1), full width at half maximum (cm^-1), PEAK ABSORBANCE and the Lorentzian fraction eta
// (0 = Gaussian, 1 = Lorentzian; a pseudo-Voigt mix is used for realistic shapes: gas-phase / pressure-broadened lines are mostly Lorentzian,
// liquid-phase bands and hydrogen-bonded O-H bands are closer to Gaussian). Absorbances of overlapping bands add (Beer-Lambert),
//     T(nu) = 100 * 10^(-sum_k A_k s_k(nu)),    s_k(nu) = eta L + (1 - eta) G, peak value 1.
import { gauss, lorentz } from "./absorption.js";

export const AXIS = Object.freeze({ nuLeft: 4000, nuRight: 400, tTop: 100, tBottom: 0 });
export const FINGERPRINT_BELOW = 1500;

/** Wavenumber grid from 4000 down to 400 (the order in which the axis is drawn, left to right). */
export function wavenumberGrid(step = 2) {
  const n = Math.round((AXIS.nuLeft - AXIS.nuRight) / step) + 1;
  return Float64Array.from({ length: n }, (_, i) => AXIS.nuLeft - i * step);
}
/** Position 0..1 along the axis (0 = left = 4000 cm^-1, 1 = right = 400 cm^-1). */
export const axisFraction = (nu) => (AXIS.nuLeft - nu) / (AXIS.nuLeft - AXIS.nuRight);
export const nuAtFraction = (f) => AXIS.nuLeft - f * (AXIS.nuLeft - AXIS.nuRight);
/** Transmittance 0..100 -> 0..1 down from the top (0 = 100 %, 1 = 0 %). */
export const transmittanceFraction = (t) => (AXIS.tTop - t) / (AXIS.tTop - AXIS.tBottom);

export const bandShape = (nu, b) => {
  const eta = b.eta ?? 0.5;
  return eta * lorentz(nu, b.nu, b.fwhm / 2) + (1 - eta) * gauss(nu, b.nu, b.fwhm);
};
export const absorbanceAt = (bands, nu, scale = 1) => { let a = 0; for (const b of bands) a += b.A * (b.grow ?? 1) * scale * bandShape(nu, b); return a; };
export const transmittanceAt = (bands, nu, scale = 1) => 100 * 10 ** -absorbanceAt(bands, nu, scale);

/** Arrays over `grid`: absorbance and transmittance (%). Optional per-band growth factors (0..1) animate the bands appearing (b.grow). */
export function buildSpectrum(bands, grid = wavenumberGrid(2)) {
  const A = new Float64Array(grid.length); const T = new Float64Array(grid.length);
  for (let i = 0; i < grid.length; i += 1) { A[i] = absorbanceAt(bands, grid[i]); T[i] = 100 * 10 ** -A[i]; }
  return { grid, A, T };
}

/**
 * Peak analysis of an absorbance curve: local maxima above `minA` (and above its neighbours' baseline), with the full width at half maximum
 * measured on the curve itself (what a student would estimate from the picture). Returns [{ nu, A, T, fwhm, broad }] in order of decreasing wavenumber.
 */
export function analyseSpectrum({ grid, A }, { minA = 0.08, minProminence = 0.04 } = {}) {
  const peaks = [];
  for (let i = 1; i < grid.length - 1; i += 1) {
    if (!(A[i] >= A[i - 1] && A[i] > A[i + 1]) || A[i] < minA) continue;
    // prominence against the lowest point on each side until a higher point
    let lo = i; let minL = A[i]; while (lo > 0 && A[lo - 1] <= A[i]) { lo -= 1; minL = Math.min(minL, A[lo]); }
    let hi = i; let minR = A[i]; while (hi < grid.length - 1 && A[hi + 1] <= A[i]) { hi += 1; minR = Math.min(minR, A[hi]); }
    const prom = A[i] - Math.max(minL, minR);
    if (prom < minProminence) continue;
    const half = minL > minR ? (A[i] + minL) / 2 : (A[i] + minR) / 2;
    let l = i; while (l > 0 && A[l] > half) l -= 1; let r = i; while (r < grid.length - 1 && A[r] > half) r += 1;
    const fwhm = Math.abs(grid[l] - grid[r]);
    peaks.push({ nu: grid[i], A: A[i], T: 100 * 10 ** -A[i], fwhm, prom, broad: fwhm >= 150, veryBroad: fwhm >= 400 });
  }
  return peaks;
}

/** Evenly spaced tick values for the standard axis. */
export const NU_TICKS = [4000, 3500, 3000, 2500, 2000, 1500, 1000, 500];
