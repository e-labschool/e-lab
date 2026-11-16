// Neutralisation chemistry for the particle visualiser (pure). One particle pair stands for 1.0 mmol; each beaker holds
// 25.0 cm3, so the mixture is 50.0 cm3. The pH comes from the shared exact solver.
import { solveSolution } from "../../../lib/acidbase/solver.js";

export const MMOL_PER_PARTICLE = 1.0;
export const BEAKER_CM3 = 25.0;
export const MIN_PARTICLES = 1;
export const MAX_PARTICLES = 10;

export function neutralisation(nHCl, nNaOH) {
  const mmolA = nHCl * MMOL_PER_PARTICLE; const mmolB = nNaOH * MMOL_PER_PARTICLE;
  const reacted = Math.min(nHCl, nNaOH);
  const V = (2 * BEAKER_CM3) / 1000;
  const r = solveSolution({ strongAnions: mmolA / 1000 / V, strongCations: mmolB / 1000 / V }); // Cl- and Na+ are the spectators
  const limiting = nHCl === nNaOH ? "none" : nHCl < nNaOH ? "HCl" : "NaOH";
  return {
    reacted, excessH: Math.max(0, nHCl - nNaOH), excessOH: Math.max(0, nNaOH - nHCl), limiting, pH: r.pH,
    cHCl: mmolA / BEAKER_CM3, cNaOH: mmolB / BEAKER_CM3, // mol dm-3 (mmol per cm3)
    result: nHCl === nNaOH ? "neutral" : nHCl > nNaOH ? "acidic" : "basic",
  };
}
