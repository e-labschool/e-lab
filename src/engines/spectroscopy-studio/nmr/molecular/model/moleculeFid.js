// The free induction decay of a molecule (or of a stated default) at the current operating frequency, and its REAL Fourier transform.
// PURE (no React). Reuses the validated physics: buildSignals() for the lines (first-order splitting, Pascal intensities, line widths),
// synthesizeFid() for the decay and transformFid() (radix-2 FFT) for the spectrum. Tested by scripts/test-nmr-steps.mjs.
//
//   one damped complex exponential per LINE of every multiplet:  A_k exp(-t / T2*_k) exp(i 2 pi f_k t),
//   f_k = (delta_k - carrier) x nu0 (Hz from the carrier, delta_k the line position in ppm), T2*_k = 1 / (pi FWHM_k),
//   A_k proportional to the line's area (its share of the H count), so the integrals of the transformed lines keep the H ratio.
import { acquisitionFor, offsetHzToPpm, synthesizeFid, transformFid } from "../../physics/fid.js";
import { buildSignals } from "./spectrum.js";
import { getMolecule, MOLECULE_BY_ID } from "./molecules.js";

export const CARRIER_PPM = 5; // centre of the 20 ppm acquisition window
export const FID_POINTS = 32768;
export const WINDOW_PPM = 20;

/** Shown when no molecule has been chosen: three singlets with areas 3 : 2 : 1 (an example, not a real compound). */
export const DEFAULT_FID_SIGNALS = Object.freeze([
  { id: "x1", label: "example 1", ppm: 1.2, area: 3, widthHz: 1.5 },
  { id: "x2", label: "example 2", ppm: 3.6, area: 2, widthHz: 1.5 },
  { id: "x3", label: "example 3", ppm: 5.3, area: 1, widthHz: 1.5 },
]);

/** Lines of the molecule (or default) as FID components at the operating frequency (MHz). */
export function fidComponents(moleculeId, opMHz, { carrierPpm = CARRIER_PPM } = {}) {
  const mol = moleculeId && MOLECULE_BY_ID[moleculeId] ? getMolecule(moleculeId) : null;
  const lines = [];
  if (mol) {
    for (const s of buildSignals(mol, { freqMHz: opMHz, coupling: true })) {
      for (const l of s.lines) lines.push({ envId: s.envId, label: s.label, ppm: l.ppm, hz: l.hz, area: l.area, widthHz: s.widthHz });
    }
  } else {
    for (const s of DEFAULT_FID_SIGNALS) lines.push({ envId: s.id, label: s.label, ppm: s.ppm, hz: s.ppm * opMHz, area: s.area, widthHz: s.widthHz });
  }
  const total = lines.reduce((a, l) => a + l.area, 0) || 1;
  const comps = lines.map((l) => ({
    envId: l.envId, label: l.label, ppm: l.ppm, freqHz: l.hz - carrierPpm * opMHz, amplitude: l.area / total, t2star: 1 / (Math.PI * l.widthHz), widthHz: l.widthHz, phase: 0,
  }));
  return { mol, comps };
}

/** Sampled FID + FFT + the ppm axis. { acq, comps, fid, spec, ppm, specMax, window: [lowPpm, highPpm], isDefault, label } */
export function buildMoleculeFid(moleculeId, opMHz, { n = FID_POINTS, carrierPpm = CARRIER_PPM } = {}) {
  const { mol, comps } = fidComponents(moleculeId, opMHz, { carrierPpm });
  const acq = acquisitionFor(opMHz, { windowPpm: WINDOW_PPM, n });
  const fid = synthesizeFid({ components: comps, dwell: acq.dwell, n: acq.n, noise: 0 });
  const spec = transformFid(fid, { zeroFillTo: 2 * acq.n });
  const ppm = new Float64Array(spec.size);
  for (let i = 0; i < spec.size; i += 1) ppm[i] = offsetHzToPpm(spec.freq[i], carrierPpm, opMHz);
  let specMax = 0; for (let i = 0; i < spec.size; i += 1) if (spec.re[i] > specMax) specMax = spec.re[i];
  const ppms = comps.map((c) => c.ppm);
  const lo = Math.min(...ppms); const hi = Math.max(...ppms);
  const pad = Math.max(0.6, (hi - lo) * 0.18);
  const window = [Math.max(carrierPpm - WINDOW_PPM / 2, lo - pad), Math.min(carrierPpm + WINDOW_PPM / 2, hi + pad)];
  const t2max = Math.max(...comps.map((c) => c.t2star));
  const fidWindowS = Math.min(acq.aq, Math.max(0.4, 5 * t2max));
  return {
    acq, comps, fid, spec, ppm, specMax: specMax || 1, window, fidWindowS, opMHz, carrierPpm,
    isDefault: !mol, moleculeId: mol?.id ?? null, label: mol ? mol.name : "Example signal (no molecule chosen)",
  };
}

// Small cache: the same FID is used by steps 4 and 5 and rebuilt whenever the user comes back.
const cache = new Map();
export function getMoleculeFid(moleculeId, opMHz) {
  const key = `${moleculeId ?? "default"}|${opMHz.toFixed(3)}`;
  let v = cache.get(key);
  if (!v) { v = buildMoleculeFid(moleculeId, opMHz); cache.set(key, v); if (cache.size > 10) cache.delete(cache.keys().next().value); }
  return v;
}
