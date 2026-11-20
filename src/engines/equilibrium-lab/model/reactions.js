// The five reaction systems, their species (with atoms and 3D geometry for the molecular view) and every chemical parameter.
// Nothing here is experimental data invented for the simulation: each number is either taken from the cited source or is
// explicitly marked `teaching: true` (a labelled teaching value).  Sources and derivations are in docs/EQUILIBRIUM_LAB.md.
//
//   thermo     K0 (dimensionless K-standard for gases, or Kc for ab / aqueous), T0, dH (J mol^-1, constant-dH van 't Hoff)
//   kinetics   kfRef (in the reaction's own concentration units), Tk (K), Ea (J mol^-1, forward), catalystDEa (J mol^-1 lowering of BOTH Ea)
//   run        initial amounts (mol), volume (dm3), temperature, particle quantum `unit` (mol per drawn molecule), step sizes
//   playback   simulation seconds that elapse per real second at "1x" (a pure display scale; see docs)
import { R, R_L_BAR, T_STD } from "./constants.js";

const A = (el, x, y, z) => ({ el, x, y, z });

// ---- molecular geometry (angstrom, centred roughly on the centroid; bond lengths / angles are standard textbook values) ----
export const GEOMETRY = {
  A:     { atoms: [A("A", 0, 0, 0)], bonds: [], label: "A" },
  B:     { atoms: [A("B", 0, 0, 0)], bonds: [], label: "B" },
  N2:    { atoms: [A("N", -0.55, 0, 0), A("N", 0.55, 0, 0)], bonds: [[0, 1, 3]] },                         // N#N 1.10
  H2:    { atoms: [A("H", -0.37, 0, 0), A("H", 0.37, 0, 0)], bonds: [[0, 1, 1]] },                          // H-H 0.74
  I2:    { atoms: [A("I", -1.33, 0, 0), A("I", 1.33, 0, 0)], bonds: [[0, 1, 1]] },                          // I-I 2.67
  HI:    { atoms: [A("H", -1.0, 0, 0), A("I", 0.61, 0, 0)], bonds: [[0, 1, 1]] },                           // H-I 1.61
  NO2:   { atoms: [A("N", 0, 0.4, 0), A("O", -1.1, -0.07, 0), A("O", 1.1, -0.07, 0)], bonds: [[0, 1, 1.5], [0, 2, 1.5]] },   // N-O 1.20, O-N-O 134 deg (bent)
  N2O4:  { atoms: [A("N", -0.89, 0, 0), A("N", 0.89, 0, 0), A("O", -1.34, 1.1, 0), A("O", -1.34, -1.1, 0), A("O", 1.34, 1.1, 0), A("O", 1.34, -1.1, 0)],
           bonds: [[0, 1, 1], [0, 2, 1.5], [0, 3, 1.5], [1, 4, 1.5], [1, 5, 1.5]] },                          // O2N-NO2: N-N 1.78, planar
  NH3:   { atoms: [A("N", 0, 0, 0.2), A("H", 0.94, 0, -0.19), A("H", -0.47, 0.81, -0.19), A("H", -0.47, -0.81, -0.19)],
           bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1]] },                                                         // trigonal pyramidal, H-N-H 107 deg
  Fe3:   { atoms: [A("Fe", 0, 0, 0)], bonds: [], charge: "3+" },
  SCN:   { atoms: [A("S", -1.64, 0, 0), A("C", 0, 0, 0), A("N", 1.17, 0, 0)], bonds: [[0, 1, 2], [1, 2, 3]], charge: "-", shift: 0.25 },
  FeSCN: { atoms: [A("Fe", -2.0, 0.25, 0), A("N", 0, 0, 0), A("C", 1.17, 0, 0), A("S", 2.81, 0, 0)], bonds: [[0, 1, 1], [1, 2, 3], [2, 3, 2]], charge: "2+" },
};

export const ATOM_STYLE = {
  N: { color: "#3b5bdb", r: 0.62, label: "N" }, O: { color: "#e03131", r: 0.6, label: "O" }, H: { color: "#f1f3f5", r: 0.36, label: "H", dark: true },
  I: { color: "#7048e8", r: 0.95, label: "I" }, Fe: { color: "#d9480f", r: 0.9, label: "Fe" }, S: { color: "#f2c200", r: 0.78, label: "S", dark: true },
  C: { color: "#495057", r: 0.55, label: "C" }, A: { color: "#0d9488", r: 1.0, label: "A" }, B: { color: "#7c3aed", r: 1.0, label: "B" },
};

const sp = (id, formula, text, atoms, color, dash, geom, extra = {}) => ({ id, formula, text, atoms, color, dash, geom, ...extra });
// `formula` is for display (unicode sub/superscripts), `text` is a plain-ASCII form used in aria labels and tests.

export const REACTIONS = {
  ab: {
    id: "ab", short: "A ⇌ B", name: "A ⇌ B (simple reversible model)", aqueous: false, gas: true,
    equation: "A(g) ⇌ B(g)", equationText: "A(g) <=> B(g)",
    species: [sp("A", "A", "A", { X: 1 }, "#0d9488", "", "A", { role: "reactant", phase: "g" }), sp("B", "B", "B", { X: 1 }, "#7c3aed", "6 3", "B", { role: "product", phase: "g" })],
    // net stoichiometry (negative = consumed in the forward direction) and the mass-action orders of each direction
    nu: { A: -1, B: 1 }, orderF: { A: 1 }, orderR: { B: 1 },
    kcExpr: "[B] / [A]", dnGas: 0,
    thermo: { K0: null, T0: T_STD, dH: 20000, teaching: true, kind: "kc" },   // K0 comes from the adjustable kf/kr; dH = +20 kJ/mol is a labelled teaching value
    kinetics: { kfRef: 0.25, krRef: 1.0, Tk: T_STD, Ea: 40000, teaching: true, catalystDEa: 6000 },
    run: { amounts: { A: 1.0, B: 0 }, V: 1.0, T: T_STD, Tmin: 273.15, Tmax: 373.15, Tstep: 25, unit: 0.02, steps: { A: 0.2, B: 0.2 } },
    playback: 0.5, units: { c: "mol dm⁻³", k: "s⁻¹", K: "" },
    controls: { concentration: true, temperature: true, volume: true, catalyst: true },
    forwardHeat: "endo", colourNote: null,
    source: "Teaching model: k_f, k_r adjustable; ΔH = +20 kJ mol⁻¹ and E_a = 40 kJ mol⁻¹ are labelled teaching values, not measurements.",
  },
  n2o4: {
    id: "n2o4", short: "N₂O₄ ⇌ 2NO₂", name: "N₂O₄(g) ⇌ 2NO₂(g)", aqueous: false, gas: true,
    equation: "N₂O₄(g) ⇌ 2NO₂(g)", equationText: "N2O4(g) <=> 2NO2(g)",
    species: [
      sp("N2O4", "N₂O₄", "N2O4", { N: 2, O: 4 }, "#0d9488", "", "N2O4", { role: "reactant", phase: "g", note: "colourless" }),
      sp("NO2", "NO₂", "NO2", { N: 1, O: 2 }, "#8b5e34", "6 3", "NO2", { role: "product", phase: "g", note: "brown" }),
    ],
    nu: { N2O4: -1, NO2: 2 }, orderF: { N2O4: 1 }, orderR: { NO2: 2 },
    kcExpr: "[NO₂]² / [N₂O₄]", dnGas: 1,
    // dfG(N2O4 g) = 97.787, dfG(NO2 g) = 51.258 kJ/mol (NIST-JANAF, 298.15 K)  ->  dG = 4.729 kJ/mol;  dH = 2(33.095) - 9.079 = 57.111 kJ/mol
    thermo: { dG0: 2 * 51258 - 97787, T0: T_STD, dH: 2 * 33095 - 9079, kind: "kstd", teaching: false },
    kinetics: { kfRef: 0.04, Tk: T_STD, Ea: 60000, teaching: true, catalystDEa: 8000 },
    run: { amounts: { N2O4: 0.1, NO2: 0 }, V: 1.0, T: T_STD, Tmin: 273.15, Tmax: 373.15, Tstep: 25, unit: 0.005, steps: { N2O4: 0.05, NO2: 0.05 } },
    playback: 1, units: { c: "mol dm⁻³", k: "s⁻¹ (forward)", K: "mol dm⁻³" },
    controls: { concentration: true, temperature: true, volume: true, catalyst: true },
    forwardHeat: "endo", colourNote: "N₂O₄ is colourless; NO₂ is brown, so the gas darkens as it dissociates.",
    source: "K and ΔH° from NIST-JANAF formation data; rate constants and E_a are teaching values (not the measured kinetics).",
  },
  haber: {
    id: "haber", short: "N₂ + 3H₂ ⇌ 2NH₃", name: "N₂(g) + 3H₂(g) ⇌ 2NH₃(g)", aqueous: false, gas: true,
    equation: "N₂(g) + 3H₂(g) ⇌ 2NH₃(g)", equationText: "N2(g) + 3H2(g) <=> 2NH3(g)",
    species: [
      sp("N2", "N₂", "N2", { N: 2 }, "#0d9488", "", "N2", { role: "reactant", phase: "g" }),
      sp("H2", "H₂", "H2", { H: 2 }, "#db2777", "2 3", "H2", { role: "reactant", phase: "g" }),
      sp("NH3", "NH₃", "NH3", { N: 1, H: 3 }, "#7c3aed", "6 3", "NH3", { role: "product", phase: "g" }),
    ],
    nu: { N2: -1, H2: -3, NH3: 2 }, orderF: { N2: 1, H2: 3 }, orderR: { NH3: 2 },
    kcExpr: "[NH₃]² / ([N₂][H₂]³)", dnGas: -2,
    // NIST-JANAF NH3(g) at 600 K: dfG = 15.879 kJ/mol, dfH = -51.374 kJ/mol (elements N2, H2 have dfG = dfH = 0)  ->  per mol of reaction: dG = 31.758, dH = -102.748 kJ
    thermo: { dG0: 2 * 15879, T0: 600, dH: 2 * -51374, kind: "kstd", teaching: false },
    kinetics: { kfRef: 0.3, Tk: 600, Ea: 100000, teaching: true, catalystDEa: 10000 },
    run: { amounts: { N2: 0.5, H2: 1.5, NH3: 0 }, V: 1.0, T: 600, Tmin: 450, Tmax: 800, Tstep: 50, unit: 0.05, steps: { N2: 0.1, H2: 0.3, NH3: 0.2 } },
    playback: 1, units: { c: "mol dm⁻³", k: "dm⁹ mol⁻³ s⁻¹ (forward)", K: "dm⁶ mol⁻²" },
    controls: { concentration: true, temperature: true, volume: true, catalyst: true },
    forwardHeat: "exo", colourNote: "All three gases are colourless.",
    mechanismNote: "The overall equation is not a one-step collision: on an iron catalyst the mechanism has several surface steps. The rate law used here is a mass-action teaching approximation.",
    source: "K and ΔH° from NIST-JANAF NH₃(g) data at 600 K; rate law, rate constant and E_a are teaching approximations.",
  },
  hi: {
    id: "hi", short: "H₂ + I₂ ⇌ 2HI", name: "H₂(g) + I₂(g) ⇌ 2HI(g)", aqueous: false, gas: true,
    equation: "H₂(g) + I₂(g) ⇌ 2HI(g)", equationText: "H2(g) + I2(g) <=> 2HI(g)",
    species: [
      sp("H2", "H₂", "H2", { H: 2 }, "#db2777", "2 3", "H2", { role: "reactant", phase: "g" }),
      sp("I2", "I₂", "I2", { I: 2 }, "#6d28d9", "", "I2", { role: "reactant", phase: "g", note: "purple vapour" }),
      sp("HI", "HI", "HI", { H: 1, I: 1 }, "#0d9488", "6 3", "HI", { role: "product", phase: "g" }),
    ],
    nu: { H2: -1, I2: -1, HI: 2 }, orderF: { H2: 1, I2: 1 }, orderR: { HI: 2 },
    kcExpr: "[HI]² / ([H₂][I₂])", dnGas: 0,
    // Fit of ln K vs 1/T to Bodenstein (1899), 283-508 degC: K(700.15 K) = 52.1, dH = -12.17 kJ/mol (see docs/EQUILIBRIUM_LAB.md)
    thermo: { K0: 52.1, T0: 700.15, dH: -12170, kind: "kstd", teaching: false },
    kinetics: { kfRef: 4.0, Tk: 700.15, Ea: 80000, teaching: true, catalystDEa: 10000 },
    run: { amounts: { H2: 0.2, I2: 0.2, HI: 0 }, V: 1.0, T: 700.15, Tmin: 600, Tmax: 900, Tstep: 50, unit: 0.01, steps: { H2: 0.05, I2: 0.05, HI: 0.1 } },
    playback: 1, units: { c: "mol dm⁻³", k: "dm³ mol⁻¹ s⁻¹ (forward)", K: "" },
    controls: { concentration: true, temperature: true, volume: true, catalyst: true },
    forwardHeat: "exo", colourNote: "I₂ vapour is purple; H₂ and HI are colourless.",
    mechanismNote: "Treated as one bimolecular step (the classic textbook picture). Later work suggests iodine atoms are involved, so this is a teaching approximation of the mechanism, not a verified one.",
    source: "K and ΔH from Bodenstein's 1899 equilibrium measurements (fitted); rate constant and E_a are teaching values.",
  },
  fescn: {
    id: "fescn", short: "Fe³⁺ + SCN⁻ ⇌ FeSCN²⁺", name: "Fe³⁺(aq) + SCN⁻(aq) ⇌ FeSCN²⁺(aq)", aqueous: true, gas: false,
    equation: "Fe³⁺(aq) + SCN⁻(aq) ⇌ FeSCN²⁺(aq)", equationText: "Fe3+(aq) + SCN-(aq) <=> FeSCN2+(aq)",
    species: [
      sp("Fe3", "Fe³⁺", "Fe3+", { Fe: 1 }, "#ca8a04", "", "Fe3", { role: "reactant", phase: "aq", note: "pale yellow", charge: 3 }),
      sp("SCN", "SCN⁻", "SCN-", { S: 1, C: 1, N: 1 }, "#0d9488", "2 3", "SCN", { role: "reactant", phase: "aq", note: "colourless", charge: -1 }),
      sp("FeSCN", "FeSCN²⁺", "FeSCN2+", { Fe: 1, S: 1, C: 1, N: 1 }, "#dc2626", "6 3", "FeSCN", { role: "product", phase: "aq", note: "blood-red", charge: 2 }),
    ],
    nu: { Fe3: -1, SCN: -1, FeSCN: 1 }, orderF: { Fe3: 1, SCN: 1 }, orderR: { FeSCN: 1 },
    kcExpr: "[FeSCN²⁺] / ([Fe³⁺][SCN⁻])", dnGas: 0,
    // Below, Connick & Coppel, J. Am. Chem. Soc. 80, 2961 (1958): K = 146 (25 degC, I = 0.40 M), k1 = 127 dm3 mol-1 s-1 (direct path), dH = -1600 cal/mol
    thermo: { K0: 146, T0: T_STD, dH: -6694, kind: "kc", teaching: false, temperatureFixed: true },
    kinetics: { kfRef: 127, Tk: T_STD, Ea: 0, teaching: true, catalystDEa: 0 },
    run: { amounts: { Fe3: 0.01, SCN: 0.01, FeSCN: 0 }, V: 1.0, T: T_STD, unit: 0.0005, steps: { Fe3: 0.0025, SCN: 0.0025, FeSCN: 0.0025 } },
    playback: 0.25, units: { c: "mol dm⁻³", k: "dm³ mol⁻¹ s⁻¹ (forward)", K: "dm³ mol⁻¹" },
    controls: { concentration: true, temperature: false, volume: false, catalyst: false },
    forwardHeat: "exo", colourNote: "Fe³⁺ is pale yellow; FeSCN²⁺ is blood-red. The colour here is a qualitative guide only.",
    mechanismNote: "Water molecules around the ions are not drawn, and the acid-dependent reaction path reported in the literature is ignored.",
    source: "K = 146 (25 °C, ionic strength 0.40 M) and k_f = 127 dm³ mol⁻¹ s⁻¹ from Below, Connick & Coppel (1958); k_r = k_f / K. Playback is slowed 4× for viewing.",
  },
};

export const REACTION_IDS = Object.freeze(["ab", "n2o4", "haber", "hi", "fescn"]);
export const getReaction = (id) => REACTIONS[id] ?? null;

/** Gas-phase stoichiometric sum on each side (for volume reasoning). */
export function gasCoefficients(rx) {
  let left = 0; let right = 0;
  for (const s of rx.species) { const n = rx.nu[s.id]; if (n < 0) left += -n; else right += n; }
  return { left, right, dn: right - left };
}

/** Element totals of one species entry. */
export const atomsOf = (rx, id) => rx.species.find((s) => s.id === id).atoms;

export { R, R_L_BAR };
