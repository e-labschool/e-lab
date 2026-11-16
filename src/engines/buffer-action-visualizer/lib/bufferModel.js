// Buffer chemistry (pure). Both beakers are solved with the shared exact charge-balance solver, so the pH is right before,
// during and after one buffer component runs out (no Henderson-Hasselbalch outside its range, no "pH 14" at zero excess).
import { solveSolution } from "../../../lib/acidbase/solver.js";
import { PKA_ETHANOIC, PKA_AMMONIUM } from "../../../lib/acidbase/constants.js";

export const START_VOLUME_CM3 = 25;
export const START_MMOL = 2.5; // each of acid form and base form: 0.100 mol dm-3 x 25.0 cm3
export const MAX_ADDITIONS = 20;
// Additions come from 1.00 mol dm-3 HCl or NaOH, so the drop volume in cm3 equals the mmol added (and the dilution is modelled).
export const ADDITIONS = { small: { id: "small", label: "Small", mmol: 0.2, cm3: 0.2, seekers: 1 }, medium: { id: "medium", label: "Medium", mmol: 1.0, cm3: 1.0, seekers: 2 } };

export const SYSTEMS = {
  acid: { id: "acid", name: "Acid buffer", pair: "CH₃COOH / CH₃COO⁻", pKa: PKA_ETHANOIC, kind: "acid", acidLabel: "CH₃COOH", baseLabel: "CH₃COO⁻", acidShort: "HA", baseShort: "A⁻", spectatorLabel: "Na⁺", spectatorShort: "Na⁺",
    unbuffered: "dilute HCl, pH 4.76", ratioText: "[A⁻]/[HA]" },
  basic: { id: "basic", name: "Basic buffer", pair: "NH₃ / NH₄⁺", pKa: PKA_AMMONIUM, kind: "base", acidLabel: "NH₄⁺", baseLabel: "NH₃", acidShort: "NH₄⁺", baseShort: "NH₃", spectatorLabel: "Cl⁻", spectatorShort: "Cl⁻",
    unbuffered: "dilute NaOH, pH 9.25", ratioText: "[NH₃]/[NH₄⁺]" },
};

/** pH and composition of the buffer beaker after h mmol H+ and oh mmol OH- (net of any reaction) in V cm3. */
export function bufferState(sys, h, oh) {
  const V = (START_VOLUME_CM3 + (h + oh)) / 1000; // dm3: 1.00 mol dm-3 additions, 1 mmol = 1 cm3
  const weakTotal = (2 * START_MMOL) / 1000 / V;
  const sol = sys.kind === "acid"
    ? { weakAcids: [{ c: weakTotal, pKa: sys.pKa }], strongCations: (START_MMOL + oh) / 1000 / V, strongAnions: h / 1000 / V }
    : { weakBases: [{ c: weakTotal, pKa: sys.pKa }], strongAnions: (START_MMOL + h) / 1000 / V, strongCations: oh / 1000 / V };
  const r = solveSolution(sol);
  const sp = r.species[0];
  const baseFrac = sys.kind === "acid" ? sp.ionised : 1 - sp.protonated; // A- or NH3
  const ratio = baseFrac / (1 - baseFrac); // [base form]/[acid form]
  return { pH: r.pH, H: r.H, OH: r.OH, baseFraction: baseFrac, acidFraction: 1 - baseFrac, ratio, inRange: ratio >= 0.1 - 1e-9 && ratio <= 10 + 1e-9, nBase: baseFrac * 2 * START_MMOL, nAcid: (1 - baseFrac) * 2 * START_MMOL, totalCm3: V * 1000 };
}

/** The unbuffered beaker: a dilute solution of the same strong reagent at the buffer's starting pH. */
export function unbufferedState(sys, h, oh) {
  const V = (START_VOLUME_CM3 + (h + oh)) / 1000;
  const c0 = sys.kind === "acid" ? Math.pow(10, -sys.pKa) : Math.pow(10, -(14 - sys.pKa)); // mol dm-3 of HCl (acid system) or NaOH
  const n0 = (c0 * START_VOLUME_CM3) / 1000; // mol
  const nAn = (sys.kind === "acid" ? n0 : 0) + h / 1000; const nCat = (sys.kind === "acid" ? 0 : n0) + oh / 1000;
  const r = solveSolution({ strongAnions: nAn / V, strongCations: nCat / V });
  return { pH: r.pH, H: r.H, OH: r.OH, totalCm3: V * 1000, netMmol: h - oh };
}

/** Representative particle sample (one dot = 1.0 mmol of buffer; free ions in units of one addition step). */
export function targetCounts(sys, h, oh, dots = 10) {
  const b = bufferState(sys, h, oh);
  const base = Math.round(dots * b.baseFraction); const acid = dots - base;
  const excess = h - oh - (0); // never positive/negative beyond buffer: free ions appear only when the pH is beyond the buffer
  const free = { H: b.pH < sys.pKa - 2 ? Math.min(6, Math.max(1, Math.round((b.H * b.totalCm3) / 0.2))) : 0, OH: b.pH > sys.pKa + 2 ? Math.min(6, Math.max(1, Math.round((b.OH * b.totalCm3) / 0.2))) : 0 };
  return { acid, base, free, excess };
}
