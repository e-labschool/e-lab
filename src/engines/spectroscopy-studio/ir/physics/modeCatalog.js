// The vibrational modes the explorer offers for each molecule: computed normal modes + literature wavenumbers + IR activity (pure, cached).
//
//   * HCl, N2, H2O, CO2, CH4: every vibrational group of the harmonic model is listed (3N-6 / 3N-5 modes grouped by degeneracy). The k-th group
//     (ascending) is matched to the k-th literature fundamental; the tests check that the matched displacement pattern really is the
//     symmetric / asymmetric stretch or bend it is called.
//   * Ethanol: only REPRESENTATIVE modes are offered ("simplified normal-mode representation"): the model has 21 vibrations, strongly mixed,
//     so the modes of the simplified force field that are dominated by one group motion are picked by their potential-energy character.
// Shown wavenumbers are the literature values (gas phase, representative); the harmonic-model value is kept as `modelWn`.
import { computeNormalModes, forceMatrix, modeGroups } from "./normalModes.js";
import { ALL_DEFS, GAS_NOTE } from "./molecules.js";
import { dipoleDerivative, isIRActive } from "./dipole.js";
import { norm } from "./linalg.js";

const SRC_ETHANOL = "Representative group frequencies of ethanol vapour / dilute solution (Shimanouchi-type tables, textbook group frequencies; approximate, about ±30 cm⁻¹; free O–H, not hydrogen-bonded)";

const REASON = {
  hcl: { stretch: "The H–Cl bond is polar, and its length changes, so the dipole moment oscillates." },
  n2: { stretch: "N₂ is a homonuclear diatomic: it has no dipole moment at any bond length, so the dipole cannot change." },
  h2o: {
    bend: "The H–O–H angle changes, so the dipole (along the axis through O) oscillates.",
    sym: "Both O–H bonds change together; the dipole along the symmetry axis oscillates.",
    asym: "One O–H bond lengthens while the other shortens; the dipole oscillates across the molecule.",
  },
  co2: {
    sym: "Both C=O bonds lengthen and shorten together. The two bond dipoles change equally and in opposite directions, so the net dipole stays zero.",
    asym: "One C=O bond lengthens while the other shortens, so the bond dipoles no longer cancel: the dipole oscillates along the molecule.",
    bend: "The molecule bends, so the two bond dipoles no longer point in opposite directions: a dipole appears perpendicular to the axis.",
  },
  ch4: {
    sym: "All four C–H bonds stretch together; the bond dipoles change equally and cancel by symmetry, so the net dipole stays zero.",
    ebend: "This bend deforms the tetrahedron but keeps the dipole at zero by symmetry (the bond-dipole changes cancel).",
    t2stretch: "The C–H bonds stretch unequally, so the bond dipoles no longer cancel: the dipole oscillates.",
    t2bend: "The H–C–H angles change unequally, so the bond dipoles no longer cancel: the dipole oscillates.",
  },
  ethanol: {},
};
const GENERIC_ACTIVE = "The dipole moment changes during this vibration, so it can interact with the oscillating electric field of the infrared radiation.";
const GENERIC_INACTIVE = "The dipole moment does not change during this vibration, so it cannot absorb infrared radiation.";

function shares(def, set, params) {
  const F = forceMatrix(def, params);
  return set.modes.map((m) => {
    const g = {}; def.coordinates.forEach((c, k) => { g[c.param] = (g[c.param] ?? 0) + F[k][k] * (c.type === "stretch" ? m.internal[k] * 1e-10 : m.internal[k]) ** 2; });
    const t = Object.values(g).reduce((a, b) => a + b, 0); for (const k of Object.keys(g)) g[k] /= t; return g;
  });
}

function entry(def, set, m, ref, extra = {}) {
  const members = set.modes.filter((x) => x.groupId === m.groupId);
  // activity of the set: the first (canonical) member is shown; the total |dmu/dQ|^2 over the set gives the band intensity
  const dmuVec = dipoleDerivative(def.atoms, m.dispRaw); const dmu = norm(dmuVec);
  const total = members.reduce((s, x) => s + norm(dipoleDerivative(def.atoms, x.dispRaw)) ** 2, 0);
  const active = isIRActive(dmuVec);
  return {
    id: ref.id, label: ref.label, sym: ref.sym, kind: ref.kind, wn: ref.wn, source: ref.source, note: ref.note ?? null, gas: GAS_NOTE,
    index: m.index, groupId: m.groupId, degeneracy: members.length, modelWn: m.wavenumber, disp: m.disp, dispRaw: m.dispRaw, L: m.L, members,
    dmu, dmuVec, intensityRaw: total, active, simplified: Boolean(extra.simplified), ...extra,
  };
}

const cache = new Map();
/** { def, set, modes } for a molecule id */
export function getModeCatalog(id) {
  if (cache.has(id)) return cache.get(id);
  const def = ALL_DEFS[id]; if (!def) throw new Error(`unknown IR molecule ${id}`);
  const set = computeNormalModes(def);
  let modes;
  if (id === "ethanol") modes = ethanolModes(def, set);
  else {
    const groups = modeGroups(set);
    if (groups.length !== def.ref.length) throw new Error(`${id}: ${groups.length} mode groups but ${def.ref.length} literature fundamentals`);
    modes = groups.map((g, i) => entry(def, set, g, def.ref[i]));
  }
  const maxI = Math.max(...modes.filter((m) => m.active).map((m) => m.intensityRaw), 1e-30);
  for (const m of modes) {
    m.relIntensity = m.active ? m.intensityRaw / maxI : 0;
    m.reason = (REASON[id]?.[m.id]) ?? (m.active ? GENERIC_ACTIVE : GENERIC_INACTIVE);
    m.rule = m.active ? `dμ/dQ = ${m.dmu.toFixed(3)} e/√u ≠ 0 → IR active` : `dμ/dQ = ${m.dmu < 5e-7 ? "0" : m.dmu.toExponential(1)} → IR inactive`;
  }
  const out = { def, set, modes, id };
  cache.set(id, out); return out;
}

function ethanolModes(def, set) {
  const sh = shares(def, set, def.params);
  const best = (key, lo, hi, skip = []) => { let b = -1; set.modes.forEach((m, i) => { if (skip.includes(i) || m.wavenumber < lo || m.wavenumber > hi) return; if (b < 0 || (sh[i][key] ?? 0) > (sh[b][key] ?? 0)) b = i; }); return b; };
  const oh = best("rOH", 3000, 5000);
  const chm = set.modes.map((m, i) => ({ m, i })).filter(({ m, i }) => m.wavenumber > 2700 && m.wavenumber < 3200 && (sh[i].rCHm ?? 0) > 0.9);
  const chAsym = chm.reduce((a, b) => (b.m.wavenumber > a.m.wavenumber ? b : a)).i; // CH3 asymmetric (highest of the pure CH3 stretches)
  const chSym = chm.reduce((a, b) => (b.m.wavenumber < a.m.wavenumber ? b : a)).i; // CH3 symmetric (lowest)
  const co = best("rCO", 950, 1200); const cc = best("rCC", 780, 960); const hch = best("aHCH", 1300, 1700); const cco = best("aCCO", 300, 600);
  const R = (id, label, sym, kind, wn, i) => ({ id, label, sym, kind, wn, source: SRC_ETHANOL, i });
  const picks = [
    R("oh", "O–H stretch", "localised", "stretch", 3660, oh),
    R("ch3-asym", "C–H stretch (CH₃, asymmetric)", "localised", "asym", 2985, chAsym),
    R("ch3-sym", "C–H stretch (CH₃, symmetric)", "localised", "sym", 2880, chSym),
    R("hch", "CH₂ / CH₃ bend (scissoring)", "localised", "bend", 1455, hch),
    R("co", "C–O stretch", "localised", "stretch", 1060, co),
    R("cc", "C–C stretch", "localised", "stretch", 890, cc),
    R("cco", "C–C–O bend", "localised", "bend", 420, cco),
  ];
  return picks.map(({ i, ...ref }) => entry(def, set, { ...set.modes[i], groupId: set.modes[i].groupId }, ref, { simplified: true, ethanolShare: sh[i] }));
}

/** Convenience: the catalog entry by molecule and mode id. */
export const getMode = (molId, modeId) => getModeCatalog(molId).modes.find((m) => m.id === modeId) ?? getModeCatalog(molId).modes[0];
export const EXPLORER_MOLECULES = ["h2o", "co2", "hcl", "ch4", "ethanol"];
export const MOLECULE_INFO = {
  hcl: { name: "Hydrogen chloride", formula: "HCl", short: "HCl" }, h2o: { name: "Water", formula: "H₂O", short: "H₂O" }, co2: { name: "Carbon dioxide", formula: "CO₂", short: "CO₂" },
  ch4: { name: "Methane", formula: "CH₄", short: "CH₄" }, ethanol: { name: "Ethanol", formula: "C₂H₅OH", short: "Ethanol" }, n2: { name: "Nitrogen", formula: "N₂", short: "N₂" },
};
