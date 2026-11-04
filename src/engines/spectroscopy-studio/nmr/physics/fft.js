// A small radix-2 FFT (plus a naive DFT used only to verify it). Pure, no dependencies.
// Convention: forward transform  X[m] = sum_n x[n] exp(-2 pi i m n / N); inverse divides by N.
// A signal exp(+2 pi i f t) therefore peaks at +f.

export const isPow2 = (n) => Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0;
export function nextPow2(n) { let p = 1; while (p < n) p <<= 1; return p; }

/** In-place iterative Cooley-Tukey FFT on parallel re/im arrays (length must be a power of two). */
export function fft(re, im, inverse = false) {
  const n = re.length;
  if (!isPow2(n) || im.length !== n) throw new Error("fft: length must be a power of two and re/im equal");
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang); const wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1; let ci = 0;
      for (let k = 0; k < half; k += 1) {
        const a = i + k; const b = a + half;
        const xr = re[b] * cr - im[b] * ci; const xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i += 1) { re[i] /= n; im[i] /= n; }
  return { re, im };
}

/** Direct O(N^2) discrete Fourier transform (reference implementation for tests). Returns new arrays. */
export function dft(re, im, inverse = false) {
  const n = re.length; const outR = new Float64Array(n); const outI = new Float64Array(n);
  const s = inverse ? 1 : -1;
  for (let m = 0; m < n; m += 1) {
    let sr = 0; let si = 0;
    for (let k = 0; k < n; k += 1) {
      const a = (s * 2 * Math.PI * ((m * k) % n)) / n; const c = Math.cos(a); const sn = Math.sin(a);
      sr += re[k] * c - im[k] * sn; si += re[k] * sn + im[k] * c;
    }
    outR[m] = inverse ? sr / n : sr; outI[m] = inverse ? si / n : si;
  }
  return { re: outR, im: outI };
}

/** Rotate so that zero frequency is in the middle: out[k] = in[(k + N/2) mod N]. */
export function fftShift(arr) {
  const n = arr.length; const h = n >> 1; const out = new Float64Array(n);
  for (let k = 0; k < n; k += 1) out[k] = arr[(k + h) % n];
  return out;
}

/** Frequency (Hz) of each shifted bin for N samples spaced dt seconds apart: (k - N/2) / (N dt). */
export function shiftedFrequencies(n, dt) {
  const f = new Float64Array(n);
  for (let k = 0; k < n; k += 1) f[k] = (k - n / 2) / (n * dt);
  return f;
}
