// Shared constants for every acid-base simulation (pure data, no React).
// All values are for 298 K (25 degC), the IB data-booklet reference temperature.
// VERIFY against your copy of the IB Chemistry data booklet: see docs/sim-review/acids-fixes.md.

export const TEMPERATURE_K = 298;
export const KW = 1.0e-14; // ionic product of water at 298 K
export const PKW = 14;

// IB-convention values used by the course resources: ethanoic acid pKa 4.76 (Ka 1.74e-5), ammonia pKb 4.75 (Kb 1.78e-5).
export const PKA_ETHANOIC = 4.76;
export const PKB_AMMONIA = 4.75;
export const PKA_AMMONIUM = PKW - PKB_AMMONIA; // 9.25: pKa of NH4+, the conjugate acid of NH3

/** Indicator transition ranges used by the titration sims (IB data booklet table; phenolphthalein 8.2-10.0 to be verified). */
export const INDICATORS = {
  "methyl-orange": { id: "methyl-orange", label: "Methyl orange", short: "MO", low: 3.1, high: 4.4, acidColour: "red", baseColour: "yellow" },
  "bromothymol-blue": { id: "bromothymol-blue", label: "Bromothymol blue", short: "BTB", low: 6.0, high: 7.6, acidColour: "yellow", baseColour: "blue" },
  phenolphthalein: { id: "phenolphthalein", label: "Phenolphthalein", short: "PP", low: 8.2, high: 10.0, acidColour: "colourless", baseColour: "pink" },
};
export const INDICATOR_LIST = Object.values(INDICATORS);

/** Reagents the titration engines can use (monoprotic, strong or weak). pKa is the pKa of the weak species (conjugate acid for a base). */
export const REAGENTS = {
  HCl: { id: "HCl", label: "HCl", name: "Hydrochloric acid", kind: "acid", strong: true },
  CH3COOH: { id: "CH3COOH", label: "CH₃COOH", name: "Ethanoic acid", kind: "acid", strong: false, pKa: PKA_ETHANOIC, pKaLabel: "pKa" },
  NaOH: { id: "NaOH", label: "NaOH", name: "Sodium hydroxide", kind: "base", strong: true },
  NH3: { id: "NH3", label: "NH₃", name: "Ammonia", kind: "base", strong: false, pKb: PKB_AMMONIA, pKa: PKA_AMMONIUM, pKaLabel: "pKa(NH₄⁺)" },
};

/** Ionic product of water against temperature (degC -> Kw, mol2 dm-6). Rows at 0, 10, 20, 30, 40, 50 and 100 degC are from
 *  chemguide.co.uk (Clark), which agrees with the CRC Handbook; 25 degC uses the IB data-booklet value 1.00e-14 (CRC 1.008e-14). */
export const KW_TABLE = Object.freeze([[0, 1.14e-15], [10, 2.93e-15], [20, 6.81e-15], [25, 1.0e-14], [30, 1.47e-14], [40, 2.92e-14], [50, 5.48e-14], [100, 5.13e-13]]);
export const KW_TABLE_TEMPS = Object.freeze(KW_TABLE.map((r) => r[0]));
/** Kw at a Celsius temperature 0..100: exact at the tabulated rows, pKw linear in 1/T between them (so 75 degC gives pKw 12.74, CRC about 12.72). */
export function kwAt(tC) {
  const t = Math.max(0, Math.min(100, tC));
  const exact = KW_TABLE.find((r) => r[0] === t); if (exact) return exact[1];
  const i = KW_TABLE.findIndex((r) => r[0] > t); const [t0, k0] = KW_TABLE[i - 1]; const [t1, k1] = KW_TABLE[i];
  const inv = (x) => 1 / (x + 273.15); const f = (inv(t0) - inv(t)) / (inv(t0) - inv(t1));
  return Math.pow(10, Math.log10(k0) + f * (Math.log10(k1) - Math.log10(k0)));
}
export const pKwAt = (tC) => -Math.log10(kwAt(tC));
