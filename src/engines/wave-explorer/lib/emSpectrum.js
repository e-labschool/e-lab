// Electromagnetic-spectrum helpers for Wave Explorer (pure, tested in scripts/test-wave-explorer.mjs).
// Wavelength control: a logarithmic slider from 1 pm (gamma) to 1 km (long radio), plus a linear "visible light" zoom.
// Region boundaries are the conventional round numbers used in teaching (IB gives no sharp limits; they overlap in real life).
import { C, H, J_PER_EV, KJ_MOL_PER_EV } from "../../../lib/atomic/constants.js";

export const LOG_NM_MIN = -3; // 1e-3 nm = 1 pm
export const LOG_NM_MAX = 12; // 1e12 nm = 1 km
export const VISIBLE_NM_MIN = 400;
export const VISIBLE_NM_MAX = 700;

export const EM_REGIONS = [
  { id: "gamma", label: "Gamma rays", maxNm: 0.01 },
  { id: "xray", label: "X-rays", maxNm: 10 },
  { id: "uv", label: "Ultraviolet", maxNm: 380 },
  { id: "visible", label: "Visible", maxNm: 750 },
  { id: "ir", label: "Infrared", maxNm: 1e6 },
  { id: "microwave", label: "Microwaves", maxNm: 1e9 },
  { id: "radio", label: "Radio waves", maxNm: Infinity },
];

export function regionOf(wavelengthNm) {
  return EM_REGIONS.find((r) => wavelengthNm < r.maxNm) ?? EM_REGIONS[EM_REGIONS.length - 1];
}

/** slider position 0..1 -> wavelength (nm), log scale. */
export function sliderToWavelengthNm(p) {
  const q = Math.min(1, Math.max(0, p));
  return 10 ** (LOG_NM_MIN + q * (LOG_NM_MAX - LOG_NM_MIN));
}
export function wavelengthNmToSlider(nm) {
  return Math.min(1, Math.max(0, (Math.log10(nm) - LOG_NM_MIN) / (LOG_NM_MAX - LOG_NM_MIN)));
}

/** Readable wavelength with a sensible unit (pm, nm, um, mm, m, km). */
export function formatWavelength(nm) {
  const sig = (v) => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2));
  if (nm < 1) return `${sig(nm * 1e3)} pm`;
  if (nm < 1e3) return `${sig(nm)} nm`;
  if (nm < 1e6) return `${sig(nm / 1e3)} µm`;
  if (nm < 1e9) return `${sig(nm / 1e6)} mm`;
  if (nm < 1e12 * 0.9995) return `${sig(nm / 1e9)} m`;
  return `${sig(nm / 1e12)} km`;
}

export function frequencyHz(nm) { return C / (nm * 1e-9); }
export function wavelengthNmFromHz(f) { return (C / f) * 1e9; }
/** Photon energy in J, eV and kJ per mole of photons (E = hf = hc/lambda). */
export function photonEnergies(nm) {
  const J = (H * C) / (nm * 1e-9);
  const eV = J / J_PER_EV;
  return { J, eV, kJPerMol: eV * KJ_MOL_PER_EV };
}

/** Display scale: drawn wavelength in px (schematic, NOT proportional in the full range). */
export const PX_MIN = 50;
export const PX_MAX = 140;
export function drawnWavelengthPx(nm, mode) {
  const t = mode === "visible"
    ? (nm - VISIBLE_NM_MIN) / (VISIBLE_NM_MAX - VISIBLE_NM_MIN)
    : wavelengthNmToSlider(nm);
  return PX_MIN + Math.min(1, Math.max(0, t)) * (PX_MAX - PX_MIN);
}

/** Animation speed (cycles/s on screen): compressed so 15 decades of frequency stay watchable (0.2 - 1.2 Hz). Higher f still looks faster. */
export function visualCyclesPerSecond(nm) {
  const ratio = frequencyHz(nm) / frequencyHz(550);
  return Math.min(1.2, Math.max(0.2, 0.5 * ratio ** 0.08));
}

/** Amplitude 0..1 -> px; 0 is a genuinely flat line. */
export function amplitudeToPx(t, maxPx) { return Math.min(1, Math.max(0, t)) * maxPx; }
