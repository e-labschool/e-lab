// The data behind the FTIR illustration (stage 5): one real interferogram and its real FFT. ILLUSTRATIVE: a smooth broadband source and a sample with the
// representative bands of propanone above 1000 cm^-1; not a measurement and not the response of a real instrument (no detector response, noise,
// phase correction or many-scan averaging). The numbers of points and the path range are real for a 4 cm^-1-resolution mid-IR instrument.
import { COMPOUNDS } from "../data/compounds.js";
import { FTIR, apodise, interferogramFromSpectrum, sourceSpectrum, transform } from "./interferometer.js";
import { transmittanceAt, wavenumberGrid } from "./spectrum.js";

let cache = null;
export function ftirDemo() {
  if (cache) return cache;
  const bands = COMPOUNDS.propanone.bands.filter((b) => b.nu > 1000);
  const T = (v) => (v > 400 && v < 4000 ? transmittanceAt(bands, v) / 100 : 1);
  const igBg = apodise(interferogramFromSpectrum((v) => sourceSpectrum(v)));
  const igSample = apodise(interferogramFromSpectrum((v) => sourceSpectrum(v) * T(v)));
  const bg = transform(igBg); const sb = transform(igSample); const dnu = bg.nu[1] - bg.nu[0];
  const grid = wavenumberGrid(2);
  const at = (arr, v) => { const f = v / dnu; const j = Math.min(arr.length - 2, Math.max(0, Math.floor(f))); const t = f - j; return arr[j] * (1 - t) + arr[j + 1] * t; };
  const Tout = Float64Array.from(grid, (v) => Math.max(0.5, Math.min(100, (100 * at(sb.S, v)) / at(bg.S, v))));
  const sMax = Math.max(...bg.S);
  const igMax = Math.max(...igSample.y.map(Math.abs));
  cache = { bands, igSample, igBg, bg, sb, grid, Tout, at, dnu, sMax, igMax, resolution: FTIR.resolution, points: igSample.N, halfPathCm: igSample.L };
  return cache;
}
