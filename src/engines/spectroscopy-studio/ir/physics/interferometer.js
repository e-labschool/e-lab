// Michelson interferometer / FTIR signal model (pure; illustrative).
//
// For a source with spectrum S(v) (v = wavenumber, cm^-1) the detector in a Michelson interferometer measures, as a function of the optical path
// difference (retardation) x between the two arms:        I(x) = (1/2) integral S(v) [1 + cos(2 pi v x)] dv
// The constant part is removed (the "interferogram" is the AC part). The retardation x = 2 (moving-mirror displacement). The spectrum is recovered
// with a Fourier transform:   S(v) ~ FFT of I(x)  -- the instrument does NOT scan one frequency at a time; every wavenumber is in the signal at once.
// Here the interferogram is sampled symmetrically about x = 0 (a "double-sided" interferogram) so the transform is real.
import { fft, nextPow2 } from "../../nmr/physics/fft.js";

export const FTIR = Object.freeze({ nuMax: 4000, resolution: 4 }); // cm^-1: the highest wavenumber kept (Nyquist) and the nominal resolution

/** Sampling set-up: N points, spacing dx (cm) of the retardation so that the Nyquist wavenumber is nuMax; total path 1/resolution. */
export function sampling({ nuMax = FTIR.nuMax, resolution = FTIR.resolution, zeroFill = 1 } = {}) {
  const dx = 1 / (2 * nuMax); const nPts = nextPow2(Math.round(1 / (resolution * dx))) * zeroFill; // double-sided: x from -L to +L is 2L
  const L = (nPts / 2) * dx; // half path (cm): the full retardation range is [-L, +L)
  return { dx, N: nPts, L, dnu: 1 / (nPts * dx), nuMax };
}

/** Interferogram of a set of monochromatic lines [{nu, I}] sampled at x_n = (n - N/2) dx, n = 0 .. N-1. */
export function interferogramFromLines(lines, opts = {}) {
  const s = sampling(opts); const x = new Float64Array(s.N); const y = new Float64Array(s.N);
  for (let n = 0; n < s.N; n += 1) { x[n] = (n - s.N / 2) * s.dx; let v = 0; for (const l of lines) v += l.I * Math.cos(2 * Math.PI * l.nu * x[n]); y[n] = v; }
  return { x, y, ...s };
}

/** Interferogram of a continuous spectrum given on the FFT grid (spec[j] at wavenumber j * dnu, j = 0 .. N/2): the (inverse) cosine transform. */
export function interferogramFromSpectrum(spec, opts = {}) {
  const s = sampling(opts); const re = new Float64Array(s.N); const im = new Float64Array(s.N);
  for (let j = 1; j < s.N / 2; j += 1) { const v = 0.5 * spec(j * s.dnu); re[j] = v; re[s.N - j] = v; } // AC part only: re[0] = 0; cos amplitude = spec
  fft(re, im, true); // real, symmetric spectrum -> real, symmetric interferogram with the zero-retardation burst at n = 0
  const x = new Float64Array(s.N); const y = new Float64Array(s.N);
  for (let n = 0; n < s.N; n += 1) { const k = (n + s.N / 2) % s.N; x[n] = (n - s.N / 2) * s.dx; y[n] = re[k] * s.N; }
  return { x, y, ...s };
}

/** Hann-type apodisation (reduces the ringing from truncating the interferogram) */
export const apodise = (ig) => ({ ...ig, y: Float64Array.from(ig.y, (v, n) => v * 0.5 * (1 + Math.cos((Math.PI * (n - ig.N / 2)) / (ig.N / 2)))) });

/** Fourier transform of an interferogram: returns { nu: Float64Array, S: Float64Array } for 0 .. nuMax (magnitude of the real transform, positive part). */
export function transform(ig, { zeroFillFactor = 1 } = {}) {
  const N = ig.N * zeroFillFactor; const re = new Float64Array(N); const im = new Float64Array(N);
  for (let n = 0; n < ig.N; n += 1) re[(n - ig.N / 2 + N) % N] = ig.y[n]; // put x = 0 at index 0 (circular shift) so the transform is real
  fft(re, im, false);
  const half = N / 2; const dnu = 1 / (N * ig.dx);
  const nu = new Float64Array(half + 1); const S = new Float64Array(half + 1);
  for (let j = 0; j <= half; j += 1) { nu[j] = j * dnu; S[j] = re[j] / (ig.N / 2); }
  return { nu, S };
}

/** Positions of the maxima above `minRel` of the maximum (parabolic interpolation). */
export function findLines({ nu, S }, minRel = 0.2, minNu = 20) {
  const mx = Math.max(...S); const out = [];
  for (let j = 1; j < S.length - 1; j += 1) {
    if (nu[j] < minNu || !(S[j] > S[j - 1] && S[j] >= S[j + 1]) || S[j] < minRel * mx) continue;
    const a = S[j - 1]; const b = S[j]; const c = S[j + 1]; const d = a - 2 * b + c; const off = d === 0 ? 0 : (0.5 * (a - c)) / d;
    out.push({ nu: nu[j] + off * (nu[1] - nu[0]), S: b });
  }
  return out;
}

/** A smooth broadband source (a hot-ceramic-like hump, arbitrary units) used by the illustration. */
export const sourceSpectrum = (v) => (v < 0 ? 0 : 0.35 + 0.65 * Math.exp(-(((v - 2300) / 1600) ** 2)));
