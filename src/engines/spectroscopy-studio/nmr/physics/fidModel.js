// The FID / spectrum model of the lab, built from the studio's FID settings. Pure (no React): shared by the FID explorer and the
// spectrometer's processing display, so both always show the same signal.
import { CARRIER_PPM } from "../../state/studioState.js";
import { acquisitionFor, offsetHzToPpm, ppmToOffsetHz, synthesizeFid, transformFid, lorentzianFwhmHz } from "./fid.js";

export const FID_POINTS = 32768;

/** components: [{ppm, amp}] + T2* + noise -> sampled FID and its Fourier transform at the given operating frequency (MHz). */
export function buildFidModel(fidState, operatingMHz, { n = FID_POINTS, seed = 777 } = {}) {
  const acq = acquisitionFor(operatingMHz, { windowPpm: 20, n });
  const total = fidState.comps.reduce((s, c) => s + c.amp, 0) || 1;
  const t2star = fidState.t2starMs / 1000;
  const comps = fidState.comps.map((c) => ({ ppm: c.ppm, freqHz: ppmToOffsetHz(c.ppm, CARRIER_PPM, operatingMHz), amplitude: c.amp / total, t2star, phase: 0 }));
  const noise = fidState.noisePct / 100;
  const fid = synthesizeFid({ components: comps, dwell: acq.dwell, n: acq.n, noise, seed });
  const spec = transformFid(fid, { lbHz: fidState.lbHz, zeroFillTo: 2 * acq.n });
  const ppm = new Float64Array(spec.size); for (let i = 0; i < spec.size; i += 1) ppm[i] = offsetHzToPpm(spec.freq[i], CARRIER_PPM, operatingMHz);
  let max = 0; for (let i = 0; i < spec.size; i += 1) if (spec.re[i] > max) max = spec.re[i];
  return { acq, comps, fid, spec, ppm, specMax: max || 1, noise, t2star, fwhmHz: lorentzianFwhmHz(t2star) + (fidState.lbHz || 0), operatingMHz };
}

/** ppm window that shows all components with margin (or the whole 20 ppm window when zoom is off). */
export function spectrumWindow(model, zoom) {
  const lo = CARRIER_PPM - 10; const hi = CARRIER_PPM + 10;
  if (!zoom || !model.comps.length) return [lo, hi];
  const ps = model.comps.map((c) => c.ppm); const a = Math.min(...ps); const b = Math.max(...ps);
  const pad = Math.max(1.2, (b - a) * 0.2);
  return [Math.max(lo, a - pad), Math.min(hi, b + pad)];
}
