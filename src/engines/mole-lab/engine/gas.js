// Module 8 -- GAS CALCULATIONS.
//  default  : molar volume convention  V = n x Vm,  Vm = 24.0 dm3 mol^-1 (RTP approximation, spec D Stage 4).
//  advanced : PV = nRT in SI units (Pa, m3, mol, K), R = 8.314462618 J mol^-1 K^-1, temperature ALWAYS converted to kelvin.
// Neither is "the" molar volume: the result depends on T and P and the UI says which conditions were used.
import { GAS_CONSTANT_R, MOLAR_VOLUME_RTP_DM3, KELVIN_OFFSET } from "./constants.js";
import { clean } from "./numeric.js";

/** V (dm3) = n Vm with the RTP convention. */
export function volumeAtRtp(nMol, vm = MOLAR_VOLUME_RTP_DM3) {
  if (!Number.isFinite(nMol) || nMol < 0) return { ok: false, volumeDm3: NaN, error: "Amount cannot be negative." };
  if (!Number.isFinite(vm) || vm <= 0) return { ok: false, volumeDm3: NaN, error: "Molar volume must be greater than zero." };
  return { ok: true, volumeDm3: clean(nMol * vm), vm, error: null };
}
export function amountAtRtp(volumeDm3, vm = MOLAR_VOLUME_RTP_DM3) {
  if (!Number.isFinite(volumeDm3) || volumeDm3 < 0) return { ok: false, n: NaN, error: "Volume cannot be negative." };
  if (!Number.isFinite(vm) || vm <= 0) return { ok: false, n: NaN, error: "Molar volume must be greater than zero." };
  return { ok: true, n: clean(volumeDm3 / vm), error: null };
}
export const celsiusToKelvin = (c) => clean(c + KELVIN_OFFSET);
export const kpaToPa = (kpa) => clean(kpa * 1000);
export const m3ToDm3 = (m3) => clean(m3 * 1000);

/** Ideal gas V = nRT/P.  Inputs in SI: n mol, T kelvin (> 0), P pascal (> 0).  Returns volume in m3 and dm3. */
export function volumeIdeal(nMol, tKelvin, pPa) {
  if (!Number.isFinite(nMol) || nMol < 0) return { ok: false, error: "Amount cannot be negative." };
  if (!Number.isFinite(tKelvin) || tKelvin <= 0) return { ok: false, error: "Temperature must be above 0 K (use kelvin: T/K = θ/°C + 273.15)." };
  if (!Number.isFinite(pPa) || pPa <= 0) return { ok: false, error: "Pressure must be greater than zero." };
  const m3 = (nMol * GAS_CONSTANT_R * tKelvin) / pPa;
  return { ok: true, volumeM3: clean(m3), volumeDm3: clean(m3 * 1000), molarVolumeDm3: nMol > 0 ? clean((m3 * 1000) / nMol) : clean(((GAS_CONSTANT_R * tKelvin) / pPa) * 1000), error: null };
}
/** n = PV/RT (V in m3). */
export function amountIdeal(pPa, vM3, tKelvin) {
  if (!(pPa > 0) || !(tKelvin > 0) || !(vM3 >= 0)) return { ok: false, n: NaN, error: "Pressure and temperature must be positive and volume cannot be negative." };
  return { ok: true, n: clean((pPa * vM3) / (GAS_CONSTANT_R * tKelvin)), error: null };
}
/** Molar volume Vm = RT/P in dm3 mol^-1 at the stated conditions. */
export const molarVolumeIdeal = (tKelvin, pPa) => volumeIdeal(1, tKelvin, pPa);

/** Worked lines for the calculation panel, with the conditions spelled out. */
export function gasWorking({ mode, nMol, tKelvin, pPa, volumeDm3, vm }) {
  if (mode === "rtp") return [`V = n × Vm  (RTP convention, Vm = ${vm} dm³ mol⁻¹)`, `V = ${nMol} mol × ${vm} dm³ mol⁻¹ = ${volumeDm3} dm³`];
  return [`PV = nRT  →  V = nRT / P  (SI units)`, `V = (${nMol} mol × ${GAS_CONSTANT_R} J mol⁻¹ K⁻¹ × ${tKelvin} K) / ${pPa} Pa`, `V = ${volumeDm3} dm³  (T must be in kelvin)`];
}
