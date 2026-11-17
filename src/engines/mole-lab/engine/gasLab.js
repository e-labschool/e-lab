// STAGE 4 CHEMISTRY -- gas-lab state from the amount, the model (RTP convention or PV = nRT) and the stated conditions.
// Pure.  Every number the Gas Volume Laboratory shows comes from here (never from rendered particle counts).
//
//   "rtp"   (default) V = n x 24 dm3 mol-1.  An APPROXIMATE room-temperature-and-pressure convention (about 25 C, about 1 atm).
//   "ideal" (advanced) V = nRT / P in SI units, R = 8.314462618 J mol-1 K-1, T in kelvin.  At 298.15 K and 101.325 kPa this is 24.47 dm3 mol-1.
// Neither value is "the" molar volume: it depends on T and P, and the lab says which conditions were used.  The molar VOLUME of an
// ideal gas does not depend on the gas, but the DENSITY (M / Vm) does: equal volumes hold equal numbers of molecules, not equal masses.
import { GAS_CONSTANT_R, MOLAR_VOLUME_RTP_DM3, AVOGADRO } from "./constants.js";
import { volumeAtRtp, volumeIdeal } from "./gas.js";
import { clean, fromQuanta, QUANTA_PER_MOL } from "./numeric.js";
import { molarMass } from "./substances.js";

/** The six supported gases (molecular models and masses come from substances.js). */
export const GAS_IDS = Object.freeze(["H2", "O2", "N2", "CO2", "NH3", "CH4"]);
/** Phase-change data (1 atm): tbK = boiling (CO2: sublimation) point, dHJ = enthalpy of vaporisation (CO2: sublimation) in J mol-1.  Used ONLY to refuse conditions where the gas would condense. */
export const GAS_INFO = Object.freeze({
  H2: { tbK: 20.3, dHJ: 900, label: "boils at 20 K" },
  O2: { tbK: 90.2, dHJ: 6820, label: "boils at 90 K" },
  N2: { tbK: 77.4, dHJ: 5570, label: "boils at 77 K" },
  CO2: { tbK: 194.7, dHJ: 25200, label: "sublimes at 195 K" },
  NH3: { tbK: 239.8, dHJ: 23350, label: "boils at 240 K" },
  CH4: { tbK: 111.7, dHJ: 8190, label: "boils at 112 K" },
});
export const GAS_LIMITS = Object.freeze({ tMinK: 220, tMaxK: 500, pMinKPa: 50, pMaxKPa: 300, nMaxMol: 4 });
export const GAS_MAX_Q = GAS_LIMITS.nMaxMol * QUANTA_PER_MOL;
/** Stated conditions of the RTP convention (approximate) and the reference state used for the "how different?" comparison. */
export const RTP_CONVENTION = Object.freeze({ tK: 298.15, pPa: 101325, vmDm3: MOLAR_VOLUME_RTP_DM3, label: "RTP convention: about 25 °C and about 1 atm, Vm ≈ 24 dm³ mol⁻¹ (a rounded teaching value)" });

/** Temperature (K) below which the gas would CONDENSE at pressure P (Clausius-Clapeyron from the 1 atm boiling point).  Ideal-gas results below it are meaningless. */
export function condensationTempK(gasId, pPa) {
  const g = GAS_INFO[gasId]; if (!g) throw new Error(`Unknown gas "${gasId}"`);
  return clean(1 / (1 / g.tbK - (GAS_CONSTANT_R * Math.log(pPa / 101325)) / g.dHJ));
}
/** { valid, caution, tCondK, message } -- valid is false when the gas would liquefy / solidify; caution when it is within 15 % of that temperature (real gases deviate). */
export function idealValidity(gasId, tK, pPa) {
  const tc = condensationTempK(gasId, pPa);
  if (tK <= tc) return { valid: false, caution: false, tCondK: tc, message: `${gasId === "CO2" ? "CO₂ would form a solid" : "This gas would liquefy"} below about ${Math.round(tc)} K at ${Math.round(pPa / 1000)} kPa, so the ideal-gas equation does not apply at ${Math.round(tK)} K.` };
  if (tK < tc * 1.15) return { valid: true, caution: true, tCondK: tc, message: `Close to condensation (${Math.round(tc)} K at this pressure): a real gas deviates noticeably from PV = nRT here.` };
  return { valid: true, caution: false, tCondK: tc, message: "" };
}

/** Root-mean-square speed of the molecules, m s-1:  v = sqrt(3RT / M) with M in kg mol-1.  Lighter molecules are faster at the same T. */
export function rmsSpeed(gasId, tK, policy = "booklet") { return clean(Math.sqrt((3 * GAS_CONSTANT_R * tK) / (molarMass(gasId, policy) / 1000))); }

/**
 * @param {{ model: "rtp"|"ideal", nQ: number, gasId: string, tK?: number, pPa?: number, policy?: string }} p
 * @returns exact numbers: volumeDm3 (for the ACTIVE model), vm, conditions, comparison with the other model, density, particles per dm3.
 */
export function gasLabState({ model, nQ, gasId, tK = RTP_CONVENTION.tK, pPa = RTP_CONVENTION.pPa, policy = "booklet" }) {
  if (model !== "rtp" && model !== "ideal") throw new Error(`Unknown gas model "${model}"`);
  const n = fromQuanta(nQ); const M = molarMass(gasId, policy);
  const conv = volumeAtRtp(n);                                              // 24 dm3 per mol, whatever T and P are
  const refIdeal = volumeIdeal(n, RTP_CONVENTION.tK, RTP_CONVENTION.pPa);   // ideal gas at 298.15 K, 101.325 kPa (24.47 dm3 mol-1)
  const activeT = model === "rtp" ? RTP_CONVENTION.tK : tK; const activeP = model === "rtp" ? RTP_CONVENTION.pPa : pPa;
  const idealHere = volumeIdeal(n, activeT, activeP);
  const volumeDm3 = model === "rtp" ? conv.volumeDm3 : idealHere.volumeDm3;
  const vm = model === "rtp" ? MOLAR_VOLUME_RTP_DM3 : idealHere.molarVolumeDm3;
  const other = model === "rtp" ? refIdeal.volumeDm3 : conv.volumeDm3; // what the OTHER model says for the same amount
  return {
    model, gasId, n, nQ, molarMassGPerMol: M, massG: clean(n * M), tK: activeT, pPa: activeP, tC: clean(activeT - 273.15), pKPa: clean(activeP / 1000),
    volumeDm3, volumeM3: clean(volumeDm3 / 1000), vm, vmConvention: MOLAR_VOLUME_RTP_DM3, vmIdealRef: refIdeal.molarVolumeDm3,
    otherModelVolumeDm3: clean(other), differenceDm3: clean(volumeDm3 - other), differencePct: other > 0 ? clean(((volumeDm3 - other) / other) * 100) : 0,
    densityGPerDm3: vm > 0 ? clean(M / vm) : 0, moleculesPerDm3: vm > 0 ? AVOGADRO / vm : 0, rmsSpeed: rmsSpeed(gasId, activeT, policy),
    validity: model === "ideal" ? idealValidity(gasId, activeT, activeP) : { valid: true, caution: false, tCondK: condensationTempK(gasId, activeP), message: "" },
  };
}

/** Visual scale of the chamber (dm3 across the whole barrel): the smallest of a few round values that fits the volume, so the piston never leaves the barrel. */
export const CHAMBER_SCALES = Object.freeze([50, 100, 200, 400]);
export function chamberScale(volumeDm3) { return CHAMBER_SCALES.find((s) => volumeDm3 <= s * 0.96) ?? CHAMBER_SCALES[CHAMBER_SCALES.length - 1]; }

/** Worked lines for the calculation panel (conditions always spelled out). */
export function gasLines(s) {
  const n = s.n; const f = (x, d = 2) => (Math.abs(x) < 0.5 * 10 ** -d ? 0 : x).toFixed(d);
  if (s.model === "rtp") return [
    `V = n × Vm  (RTP convention: about 25 °C, about 1 atm)`,
    `V = ${f(n)} mol × ${f(s.vm, 0)} dm³ mol⁻¹ = ${f(s.volumeDm3, 0)} dm³`,
    `Compare: PV = nRT at 298.15 K and 101.325 kPa gives Vm = ${f(s.vmIdealRef)} dm³ mol⁻¹, so ${f(n)} mol → ${f(s.otherModelVolumeDm3)} dm³ (the 24 value is a rounded convention).`,
  ];
  return [
    `PV = nRT  →  V = nRT / P  (SI units: mol, K, Pa → m³)`,
    `V = (${f(n)} mol × ${GAS_CONSTANT_R} J mol⁻¹ K⁻¹ × ${f(s.tK, 2)} K) ÷ ${f(s.pPa, 0)} Pa = ${s.volumeM3.toPrecision(4)} m³ = ${f(s.volumeDm3, 2)} dm³`,
    `Here Vm = RT / P = ${f(s.vm, 2)} dm³ mol⁻¹ at ${f(s.tK, 2)} K and ${f(s.pKPa, 2)} kPa; the 24 dm³ mol⁻¹ convention would give ${f(s.otherModelVolumeDm3, 2)} dm³ (${s.differenceDm3 >= 0 ? "+" : ""}${f(s.differenceDm3, 2)} dm³).`,
  ];
}
