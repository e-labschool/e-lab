// Free induction decay synthesis and its Fourier transform. Pure module.
//
// Model: after a pulse, the detected (quadrature) signal in the frame rotating at the carrier is a sum of damped complex
// oscillations, one per resonance:
//     z(t) = sum_k A_k exp(-t / T2*_k) exp( i (2 pi f_k t + phi_k) )  +  noise
// f_k is the offset of resonance k from the carrier (Hz); its spectral line is Lorentzian with FWHM = 1 / (pi T2*).
// The Fourier transform of the sampled z(t) is the spectrum: it only redistributes information already in the signal.
import { fft, shiftedFrequencies, nextPow2 } from "./fft.js";

/** Small seeded PRNG (mulberry32): deterministic noise so that a redraw gives the same FID. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Standard normal sample (Box-Muller) from a uniform generator. */
export function gaussian(rng) {
  let u = 0; while (u === 0) u = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

/** FWHM (Hz) of the Lorentzian line of a decay with time constant T2* (s). */
export const lorentzianFwhmHz = (t2star) => 1 / (Math.PI * t2star);

/**
 * Synthesize the sampled FID.
 * components: [{ freqHz, amplitude, t2star, phase? }]; dwell: seconds between samples; n: number of points;
 * noise: standard deviation of the Gaussian noise added to each of the real and imaginary channels (same units as amplitude).
 */
export function synthesizeFid({ components, dwell, n, noise = 0, seed = 12345 }) {
  const re = new Float64Array(n); const im = new Float64Array(n);
  for (const c of components) {
    const w = 2 * Math.PI * c.freqHz; const ph = c.phase ?? 0; const a = c.amplitude;
    for (let i = 0; i < n; i += 1) {
      const t = i * dwell; const env = a * Math.exp(-t / c.t2star);
      re[i] += env * Math.cos(w * t + ph); im[i] += env * Math.sin(w * t + ph);
    }
  }
  if (noise > 0) {
    const rng = mulberry32(seed);
    for (let i = 0; i < n; i += 1) { re[i] += noise * gaussian(rng); im[i] += noise * gaussian(rng); }
  }
  return { re, im, dwell, n };
}

/** Noise-free analytic real channel at time t (for smooth drawing of the true signal). */
export function analyticFidReal(components, t) {
  let s = 0;
  for (const c of components) s += c.amplitude * Math.exp(-t / c.t2star) * Math.cos(2 * Math.PI * c.freqHz * t + (c.phase ?? 0));
  return s;
}

/** Exponential apodisation (line broadening lb Hz): multiply by exp(-pi lb t). Returns a new FID. */
export function apodise(fid, lbHz) {
  if (!(lbHz > 0)) return { ...fid, re: Float64Array.from(fid.re), im: Float64Array.from(fid.im) };
  const re = new Float64Array(fid.n); const im = new Float64Array(fid.n);
  for (let i = 0; i < fid.n; i += 1) { const w = Math.exp(-Math.PI * lbHz * i * fid.dwell); re[i] = fid.re[i] * w; im[i] = fid.im[i] * w; }
  return { ...fid, re, im };
}

/**
 * Fourier transform of a FID to a spectrum. The first point is halved (standard FT-NMR practice: it removes the baseline offset
 * of a truncated one-sided transform). Zero-filling to `zeroFillTo` points (power of two) interpolates the spectrum.
 * Returns frequency axis (Hz, ascending, zero at the carrier) and the real (absorption, for zero phase), imaginary and magnitude parts.
 */
export function transformFid(fid, { lbHz = 0, zeroFillTo } = {}) {
  const a = apodise(fid, lbHz);
  const size = Math.max(nextPow2(fid.n), zeroFillTo ?? 0);
  const re = new Float64Array(size); const im = new Float64Array(size);
  re.set(a.re); im.set(a.im);
  re[0] *= 0.5; im[0] *= 0.5;
  fft(re, im, false);
  // x dwell turns the discrete sum into the integral approximation of the continuous transform (units: amplitude x seconds),
  // so a Lorentzian line of amplitude A has height A T2* and area A / 2 (Hz), independent of the sampling.
  const shifted = (arr) => { const out = new Float64Array(size); for (let k = 0; k < size; k += 1) out[k] = arr[(k + (size >> 1)) % size] * fid.dwell; return out; };
  const R = shifted(re); const I = shifted(im);
  const mag = new Float64Array(size); for (let k = 0; k < size; k += 1) mag[k] = Math.hypot(R[k], I[k]);
  return { freq: shiftedFrequencies(size, fid.dwell), re: R, im: I, mag, size, dwell: fid.dwell };
}

/** Frequency resolution (Hz per bin) of a transform. */
export const binWidthHz = (spec) => 1 / (spec.size * spec.dwell);

/** Index of the maximum of `arr` in [lo, hi]. */
export function argMax(arr, lo = 0, hi = arr.length - 1) { let best = lo; for (let i = lo; i <= hi; i += 1) if (arr[i] > arr[best]) best = i; return best; }

/** Interpolated peak position (Hz) around the maximum bin (parabolic). */
export function peakFrequency(spec, lo, hi, arr = spec.re) {
  const k = argMax(arr, lo, hi);
  if (k <= 0 || k >= arr.length - 1) return spec.freq[k];
  const a = arr[k - 1]; const b = arr[k]; const c = arr[k + 1];
  const d = a - 2 * b + c;
  const off = d === 0 ? 0 : (0.5 * (a - c)) / d;
  return spec.freq[k] + off * (spec.freq[k + 1] - spec.freq[k]);
}

/** Full width at half maximum (Hz) of the peak at bin k of `arr` (linear interpolation of the half-height crossings). */
export function fwhmHz(spec, k, arr = spec.re) {
  const half = arr[k] / 2; let l = k; let r = k;
  while (l > 0 && arr[l] > half) l -= 1;
  while (r < arr.length - 1 && arr[r] > half) r += 1;
  const fl = spec.freq[l] + ((half - arr[l]) / (arr[l + 1] - arr[l])) * (spec.freq[l + 1] - spec.freq[l]);
  const fr = spec.freq[r - 1] + ((half - arr[r - 1]) / (arr[r] - arr[r - 1])) * (spec.freq[r] - spec.freq[r - 1]);
  return fr - fl;
}

/** Sum of `arr` over [loHz, hiHz] times the bin width = integral in Hz. */
export function integrateHz(spec, loHz, hiHz, arr = spec.re) {
  let s = 0; const bw = binWidthHz(spec);
  for (let i = 0; i < spec.freq.length; i += 1) if (spec.freq[i] >= loHz && spec.freq[i] <= hiHz) s += arr[i];
  return s * bw;
}

/** ppm <-> Hz at an operating frequency (MHz); the carrier sits at `carrierPpm`. Higher frequency = higher ppm. */
export const ppmToOffsetHz = (ppm, carrierPpm, operatingMHz) => (ppm - carrierPpm) * operatingMHz;
export const offsetHzToPpm = (hz, carrierPpm, operatingMHz) => carrierPpm + hz / operatingMHz;

/** The acquisition used by the explorer: dwell/points chosen for a 20 ppm window at 400-600 MHz. */
export function acquisitionFor(operatingMHz, { windowPpm = 20, n = 32768 } = {}) {
  const sw = windowPpm * operatingMHz; // Hz
  return { sw, dwell: 1 / sw, n, aq: n / sw };
}
