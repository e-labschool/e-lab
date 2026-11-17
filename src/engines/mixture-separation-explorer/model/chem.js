// Substance data and thermodynamic helpers for the Mixture Separation Lab. Pure JS (no React / DOM), unit-tested in
// scripts/test-mixture-separation.mjs.
//
// DATA PROVENANCE (honest): boiling / melting points, densities, molar masses and the NaCl / ethanol constants are
// standard textbook values (to the precision shown). Solubility curves, the ethanol-water vapour-liquid table and the dye Rf
// values are APPROXIMATE teaching values:
//   * NaCl and CuSO4 solubility tables are rounded textbook figures (g of anhydrous salt per 100 g water). The model ignores
//     the water of crystallisation of CuSO4.5H2O in its mass balance.
//   * The ethanol-water table is the classic 1 atm vapour-liquid data (azeotrope 95.6 % w/w, 78.2 degC), recalled from standard
//     references and NOT re-fetched; it is used for its SHAPE (it is unit-tested for the azeotrope, monotonic T(x), y>x below it).
//   * Dye Rf values are MODEL values chosen to be typical and well separated; real Rf depends on paper, solvent and dye.
//   * "Crude oil" is a teaching model: three representative hydrocarbons (hexane, decane, hexadecane) plus a non-volatile
//     residue. Real crude oil has hundreds of components and fractions are boiling RANGES.

export const R_GAS = 8.314;
export const KB_WATER = 0.512; // K kg mol-1 (ebullioscopic constant of water)

/** Linear interpolation in a sorted [[x, y], ...] table (clamped at both ends). */
export function interp(table, x) {
  if (x <= table[0][0]) return table[0][1];
  const last = table[table.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < table.length; i++) {
    if (x <= table[i][0]) {
      const [x0, y0] = table[i - 1]; const [x1, y1] = table[i];
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return last[1];
}

// kind: solid | liquid. form of a substance inside a sample is separate (solid | liquid | dissolved).
export const SUBSTANCES = {
  sand: { name: "Sand", formula: "SiO₂", kind: "solid", colour: "#d8b574", grainMm: 0.3, density: 2.65, magnetic: false, cp: 0.8, mp: 1710, note: "Insoluble in water; coarse grains" },
  salt: {
    name: "Salt (sodium chloride)", formula: "NaCl", kind: "solid", colour: "#f2f4f7", grainMm: 0.3, density: 2.16, magnetic: false, cp: 0.85, mp: 801, ions: 2, molarMass: 58.44,
    solubility: [[0, 35.7], [20, 35.9], [40, 36.4], [60, 37.1], [80, 38.0], [100, 39.2]],
  },
  copperSulfate: {
    name: "Copper(II) sulfate", formula: "CuSO₄", kind: "solid", colour: "#2f7fd6", grainMm: 0.5, density: 2.28, magnetic: false, cp: 0.9, mp: 560, ions: 2, molarMass: 159.6,
    solubility: [[0, 14.3], [20, 20.7], [40, 28.5], [60, 40.0], [80, 55.0], [100, 75.4]],
  },
  iron: { name: "Iron filings", formula: "Fe", kind: "solid", colour: "#5d6068", grainMm: 0.15, density: 7.87, magnetic: true, cp: 0.45, mp: 1538, molarMass: 55.85 },
  sulfur: { name: "Sulfur powder", formula: "S", kind: "solid", colour: "#f1d93a", grainMm: 0.1, density: 2.07, magnetic: false, cp: 0.71, mp: 115, molarMass: 32.06 },
  iodine: { name: "Iodine", formula: "I₂", kind: "solid", colour: "#3b2352", grainMm: 0.4, density: 4.93, magnetic: false, cp: 0.54, mp: 114, sublimes: true, molarMass: 253.8 },
  ironSulfide: { name: "Iron(II) sulfide", formula: "FeS", kind: "solid", colour: "#2b2b2f", grainMm: 0.2, density: 4.84, magnetic: false, cp: 0.6, mp: 1194, molarMass: 87.9 },
  water: { name: "Water", formula: "H₂O", kind: "liquid", colour: "#6cb4ef", density: 0.998, bp: 100, cp: 4.18, dHvap: 40650, molarMass: 18.015, polar: true },
  ethanol: { name: "Ethanol", formula: "C₂H₅OH", kind: "liquid", colour: "#b9d9c9", density: 0.789, bp: 78.4, cp: 2.44, dHvap: 38600, molarMass: 46.07, polar: true, flammable: true },
  oil: { name: "Cooking oil", formula: "triglycerides", kind: "liquid", colour: "#e6b422", density: 0.92, bp: 300, cp: 2.0, dHvap: 60000, molarMass: 880, polar: false, nonvolatile: true },
  hexane: { name: "Hexane-range fraction", formula: "C₆H₁₄", kind: "liquid", colour: "#f1e6a6", density: 0.655, bp: 68.7, cp: 2.26, dHvap: 28850, molarMass: 86.18, polar: false, flammable: true },
  decane: { name: "Decane-range fraction", formula: "C₁₀H₂₂", kind: "liquid", colour: "#e5c46b", density: 0.73, bp: 174.1, cp: 2.2, dHvap: 38750, molarMass: 142.3, polar: false, flammable: true },
  hexadecane: { name: "Hexadecane-range fraction", formula: "C₁₆H₃₄", kind: "liquid", colour: "#c28a3a", density: 0.773, bp: 286.9, cp: 2.2, dHvap: 50500, molarMass: 226.4, polar: false },
  bitumen: { name: "Bitumen-like residue", formula: "C₃₀+", kind: "liquid", colour: "#2a2420", density: 1.0, bp: 500, cp: 1.9, dHvap: 80000, molarMass: 450, polar: false, nonvolatile: true },
  // Chromatography: Rf values are MODEL values per solvent. soluble: false means the dye does not dissolve in that solvent, so it stays on the baseline.
  dyeYellow: { name: "Yellow dye", formula: "dye", kind: "solid", colour: "#f4c20d", cp: 1, molarMass: 500, rf: { water: 0.78, ethanol: 0.36 }, dye: true },
  dyeRed: { name: "Red dye", formula: "dye", kind: "solid", colour: "#d9322e", cp: 1, molarMass: 500, rf: { water: 0.54, ethanol: 0.22 }, dye: true },
  dyeBlue: { name: "Blue dye", formula: "dye", kind: "solid", colour: "#2457c9", cp: 1, molarMass: 500, rf: { water: 0.31, ethanol: 0.1 }, dye: true },
  pigOrange: { name: "Orange marker pigment", formula: "pigment", kind: "solid", colour: "#f08a1c", cp: 1, molarMass: 500, rf: { water: 0, ethanol: 0.66 }, dye: true, insolubleIn: ["water"] },
  pigViolet: { name: "Violet marker pigment", formula: "pigment", kind: "solid", colour: "#7a3fb0", cp: 1, molarMass: 500, rf: { water: 0, ethanol: 0.38 }, dye: true, insolubleIn: ["water"] },
};

export const subName = (id) => SUBSTANCES[id]?.name ?? id;
export const isVolatileLiquid = (id) => SUBSTANCES[id]?.kind === "liquid" && !SUBSTANCES[id]?.nonvolatile;

/** Solubility (g per 100 g water) of a substance at temperature T (degC); 0 if it has no solubility table. */
export function solubilityAt(id, T) {
  const t = SUBSTANCES[id]?.solubility;
  return t ? interp(t, T) : 0;
}

/** Mass (g) of water needed to hold `solute` g in a solution that is saturated at T. */
export const waterForSaturation = (id, soluteG, T) => (soluteG * 100) / solubilityAt(id, T);

/** Crystals (g) that must come out of `waterG` of water holding `soluteG` of `id` at temperature T. */
export function crystalsAt(id, soluteG, waterG, T) {
  const cap = (solubilityAt(id, T) * Math.max(0, waterG)) / 100;
  return Math.max(0, soluteG - cap);
}

// ---------------------------------------------------------------------------------------- vapour-liquid equilibrium
// Ethanol-water at 1 atm: [x ethanol (mole fraction in liquid), T (degC), y ethanol (mole fraction in vapour)].
export const ETOH_WATER_VLE = [
  [0, 100.0, 0], [0.019, 95.5, 0.170], [0.0721, 89.0, 0.3891], [0.0966, 86.7, 0.4375], [0.1238, 85.3, 0.4704],
  [0.1661, 84.1, 0.5089], [0.2337, 82.7, 0.5445], [0.2608, 82.3, 0.558], [0.3273, 81.5, 0.5826], [0.3965, 80.7, 0.6122],
  [0.5079, 79.8, 0.6564], [0.5198, 79.7, 0.6599], [0.5732, 79.3, 0.6841], [0.6763, 78.74, 0.7385], [0.7472, 78.41, 0.7815],
  [0.8943, 78.15, 0.8943], [0.95, 78.2, 0.942], [1, 78.37, 1],
];
export const AZEOTROPE = { x: 0.8943, T: 78.15, wtFraction: 0.956 };

const etohT = ETOH_WATER_VLE.map((r) => [r[0], r[1]]);
const etohY = ETOH_WATER_VLE.map((r) => [r[0], r[2]]);

const MM = (id) => SUBSTANCES[id].molarMass;
const TROUTON = 10.58; // ln(P/P0) = 10.58 (1 - Tb/T) for an ideal component obeying Trouton's rule (T in kelvin)

/** The vapour-liquid system for a list of volatile liquid ids. */
export function systemFor(ids) {
  if (ids.length <= 1) return "pure";
  if (ids.length === 2 && ids.includes("water") && ids.includes("ethanol")) return "ethanol-water";
  return "ideal";
}

function idealBubbleT(ids, x) {
  // solve sum x_i exp(10.58 (1 - Tb_i/T)) = 1 for T (kelvin) by bisection
  const f = (T) => ids.reduce((s, id, i) => s + x[i] * Math.exp(TROUTON * (1 - (SUBSTANCES[id].bp + 273.15) / T)), 0) - 1;
  let lo = Math.min(...ids.map((id) => SUBSTANCES[id].bp)) + 273.15 - 30; let hi = Math.max(...ids.map((id) => SUBSTANCES[id].bp)) + 273.15 + 30;
  for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2; if (f(mid) > 0) hi = mid; else lo = mid; }
  return (lo + hi) / 2 - 273.15;
}

/**
 * Equilibrium of a boiling liquid of mole fractions x (aligned with `ids`): { T: boiling temperature degC, y: vapour mole fractions }.
 * Ethanol-water uses the tabulated data (azeotrope included); every other mixture is treated as ideal with Trouton vapour pressures.
 */
export function equilibrium(ids, x) {
  const sum = x.reduce((s, v) => s + v, 0) || 1;
  const xn = x.map((v) => Math.max(0, v) / sum);
  if (ids.length === 1) return { T: SUBSTANCES[ids[0]].bp, y: [1] };
  const sys = systemFor(ids);
  if (sys === "ethanol-water") {
    const ie = ids.indexOf("ethanol"); const xe = xn[ie];
    const ye = interp(etohY, xe); const y = [0, 0]; y[ie] = ye; y[1 - ie] = 1 - ye;
    return { T: interp(etohT, xe), y };
  }
  const T = idealBubbleT(ids, xn);
  const p = ids.map((id, i) => xn[i] * Math.exp(TROUTON * (1 - (SUBSTANCES[id].bp + 273.15) / (T + 273.15))));
  const ps = p.reduce((s, v) => s + v, 0);
  return { T, y: p.map((v) => v / ps) };
}

/**
 * A fractionating column of `plates` theoretical plates run at total reflux. Stage 1 is the pot (liquid x). The vapour from stage k
 * condenses onto stage k+1, so x_{k+1} = y_k. Returns the vapour leaving the top (the distillate composition), the temperature seen
 * by a thermometer in the still head (the boiling temperature of the top stage) and the temperature of every stage (the gradient).
 * `plates` may be fractional (interpolated). One plate = simple distillation.
 */
export function column(ids, x, plates = 1) {
  const sum = x.reduce((s, v) => s + v, 0) || 1;
  let xs = x.map((v) => Math.max(0, v) / sum);
  const stages = [];
  const nFull = Math.max(1, Math.floor(plates));
  const frac = Math.max(1, plates) - nFull;
  let prev = null;
  for (let k = 0; k < nFull + (frac > 1e-9 ? 1 : 0); k++) {
    const eq = equilibrium(ids, xs);
    stages.push({ T: eq.T, x: xs, y: eq.y });
    prev = eq;
    xs = eq.y;
  }
  // fractional plate: blend the last two stages
  let top = stages[stages.length - 1];
  if (frac > 1e-9 && stages.length >= 2) {
    const a = stages[stages.length - 2]; const b = stages[stages.length - 1];
    top = { T: a.T + (b.T - a.T) * frac, x: a.x.map((v, i) => v + (b.x[i] - v) * frac), y: a.y.map((v, i) => v + (b.y[i] - v) * frac) };
  }
  void prev;
  return { y: top.y, T: top.T, stageT: stages.map((s) => s.T), stages };
}

/** Elevation of the boiling point by dissolved ionic solutes: dT = i Kb m (m in mol per kg water). */
export function boilingElevation(solutes, waterG) {
  if (waterG <= 1e-9) return 0;
  let dT = 0;
  for (const s of solutes) { const sub = SUBSTANCES[s.sub]; if (!sub?.ions) continue; dT += sub.ions * KB_WATER * (s.g / sub.molarMass) / (waterG / 1000); }
  return dT;
}

/** Mass fraction of ethanol for a given mole fraction (ethanol-water). */
export const wtFractionEthanol = (xe) => (xe * MM("ethanol")) / (xe * MM("ethanol") + (1 - xe) * MM("water"));
export const moleFractionEthanol = (w) => (w / MM("ethanol")) / (w / MM("ethanol") + (1 - w) / MM("water"));

/** Mass in g -> volume in mL, for liquids (uses density). */
export const gToMl = (id, g) => g / (SUBSTANCES[id]?.density || 1);
