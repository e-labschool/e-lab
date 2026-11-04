// Photon energy/wavelength/frequency conversions -- E = hf = hc/lambda,
// f = c/lambda -- used consistently by both the hydrogen model and any
// display of curated real spectral wavelengths.
import { SPEED_OF_LIGHT, PLANCK_CONSTANT_J, EV_TO_JOULES } from "./scientificConstants.js";

export function evToJoules(ev) {
  return ev * EV_TO_JOULES;
}
export function joulesToEv(j) {
  return j / EV_TO_JOULES;
}

/** Photon energy (eV) -> wavelength (nm). */
export function energyEvToWavelengthNm(energyEv) {
  if (!(energyEv > 0)) return null;
  const energyJ = evToJoules(energyEv);
  const wavelengthM = (PLANCK_CONSTANT_J * SPEED_OF_LIGHT) / energyJ;
  return wavelengthM * 1e9;
}

/** wavelength (nm) -> photon energy (eV) -- the inverse. */
export function wavelengthNmToEnergyEv(wavelengthNm) {
  if (!(wavelengthNm > 0)) return null;
  const wavelengthM = wavelengthNm / 1e9;
  const energyJ = (PLANCK_CONSTANT_J * SPEED_OF_LIGHT) / wavelengthM;
  return joulesToEv(energyJ);
}

export function wavelengthNmToFrequencyHz(wavelengthNm) {
  if (!(wavelengthNm > 0)) return null;
  return SPEED_OF_LIGHT / (wavelengthNm / 1e9);
}

/** "visible" | "ultraviolet" | "infrared" -- classification only, never
 * used to assign a fake visible colour to UV/IR. */
export function classifyRegion(wavelengthNm) {
  if (wavelengthNm < 380) return "ultraviolet";
  if (wavelengthNm > 750) return "infrared";
  return "visible";
}
