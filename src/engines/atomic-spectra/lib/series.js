// Hydrogen line SERIES (AS-06, S1.3.2): all transitions that end on the same lower level n_low. Pure.
import { hydrogenEnergyEv } from "./hydrogenEnergy.js";
import { energyEvToWavelengthNm, classifyRegion } from "./photonMath.js";
import { AVOGADRO, J_PER_EV as EV_TO_JOULES } from "../../../lib/atomic/constants.js";

export const SERIES = [
  { id: "lyman", name: "Lyman", nLow: 1 }, { id: "balmer", name: "Balmer", nLow: 2 }, { id: "paschen", name: "Paschen", nLow: 3 }, { id: "brackett", name: "Brackett", nLow: 4 },
];
/** Vacuum wavelength (nm) of the line n -> nLow (n > nLow). */
export const seriesLineNm = (nLow, n) => energyEvToWavelengthNm(hydrogenEnergyEv(n) - hydrogenEnergyEv(nLow));
/** The convergence (series-limit) wavelength n -> infinity. */
export const seriesLimitNm = (nLow) => energyEvToWavelengthNm(-hydrogenEnergyEv(nLow));
export function seriesLines(nLow, count) { return Array.from({ length: count }, (_, k) => { const n = nLow + 1 + k; const nm = seriesLineNm(nLow, n); return { n, nm, region: classifyRegion(nm) }; }); }
/** Energy to remove the electron from level nLow, in kJ per mole: the ionisation energy of the atom if nLow = 1. */
export const ionisationFromLevelKJ = (nLow) => (-hydrogenEnergyEv(nLow) * EV_TO_JOULES * AVOGADRO) / 1000;
/** Mark a student's limit wavelength: right within 1 %. */
export function checkLimit(nLow, guessNm, tol = 0.01) { const t = seriesLimitNm(nLow); const err = (guessNm - t) / t; return { ok: Math.abs(err) <= tol, err, target: t }; }
export function seriesRegion(nLow) { const a = classifyRegion(seriesLineNm(nLow, nLow + 1)); const b = classifyRegion(seriesLimitNm(nLow)); return a === b ? a : `${a} to ${b}`; }
