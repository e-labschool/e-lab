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
