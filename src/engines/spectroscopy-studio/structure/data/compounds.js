// The eight UNKNOWN compounds of the Structure Investigation tab. ONE record per compound = ONE molecular identity.
//
// A record is built from a single molecular graph (data/structures.js) and the three spectra:
//   * formula, molar mass, degree of unsaturation, number of ¹H environments, integration, n+1 multiplicity and the characteristic IR groups are DERIVED
//     from the graph (model/graph.js); the spectra data below only add what a graph cannot say: shifts, MS intensities and IR band shapes;
//   * MS peaks (m/z, relative abundance, ion formula and charge, origin): ethanol, propanone and butanone are TAKEN from the MS workspace
//     (ms/data/spectra.js) so both tabs show the same spectrum; the other five are entered here in the same format;
//   * IR bands: ethanol, ethanoic acid, propanone, ethyl ethanoate and propan-1-ol are TAKEN from the IR workspace (ir/data/compounds.js); propan-2-ol,
//     propanal and butanone are entered here with the same band format;
//   * ¹H shifts: ethanol, propan-2-ol, propan-1-ol, propanone and ethyl ethanoate use the values of the NMR workspace's molecule model (equal, checked by
//     scripts/test-structure-model.mjs); ethanoic acid, propanal and butanone are typical literature-style values.
//
// !!! EVERY spectrum here is SIMULATED / REPRESENTATIVE, NOT measured. !!!
// PROVENANCE. No table could be downloaded in this build. All numbers are rounded, typical literature-style values entered from the author's knowledge
// of EI mass spectra, liquid-film IR spectra and CDCl3 ¹H NMR spectra of these common compounds (NIST WebBook / SDBS / Gottlieb et al. 1997 style). They
// were NOT copied from a file and NOT re-checked online; real values vary (MS intensities by about ±30 % of each peak, IR positions by about ±20 cm⁻¹,
// O–H and COOH shifts with concentration and solvent). Flagged as least certain in docs/STRUCTURE_INVESTIGATION.md.
import { SPECTRA, SPECTRA_NOTE } from "../../ms/data/spectra.js";
import { COMPOUNDS as IR_COMPOUNDS } from "../../ir/data/compounds.js";
import { isotopePattern, parseFormula } from "../../ms/physics/isotopes.js";
import { STRUCTURES } from "./structures.js";
import { DEFAULT_J, environmentsOf, toSub } from "../model/graph.js";

export const SIMULATED_NOTE = "Simulated / representative spectra built from typical literature-style values. They are not measured data.";
export const NMR_FREQ_MHZ = 300;
export const NMR_SOLVENT = "CDCl₃";

// ------------------------------------------------------------------ MS
const ionLabel = (base, charge) => `${toSub(base)}${charge === "+" ? "⁺" : "⁺•"}`;
const pk = (mz, rel, comp, base, charge, origin, role = "fragment") => ({ mz, rel, comp, charge, role, origin, label: ionLabel(base, charge) });
const m1Of = (M) => {
  const pat = isotopePattern(parseFormula(M.comp), { mode: "natural", only: ["C", "H", "O"] });
  const p0 = pat.peaks[0]; const p1 = pat.peaks.find((q) => q.nominal === p0.nominal + 1);
  const rel = M.rel * (p1.p / p0.p);
  return { mz: M.mz + 1, rel: Math.round(rel * 100) / 100, comp: M.comp, charge: M.charge, role: "isotope", label: "M+1 (¹³C)", origin: `Molecules that contain one ¹³C (or ²H) atom: one mass unit heavier than the molecular ion, about ${(100 * p1.p / p0.p).toFixed(1)} % of it for ${M.comp}.` };
};
const finishMs = (id, peaks) => {
  const M = peaks.find((p) => p.role === "M");
  const all = [...peaks];
  if (!all.some((p) => p.role === "isotope")) { const s = m1Of(M); if (s.rel >= 0.3) all.push(s); }
  all.sort((a, b) => a.mz - b.mz);
  const base = all.reduce((b, p) => (p.rel > b.rel ? p : b), all[0]);
  return { peaks: all, mMz: M.mz, baseMz: base.mz, byMz: Object.fromEntries(all.map((p) => [p.mz, p])) };
};
const fromSpectrum = (id) => {
  const s = SPECTRA[id];
  return finishMs(id, s.peaks.map((p) => ({ mz: p.mz, rel: p.rel, comp: p.comp, charge: p.charge, role: p.role === "M" ? "M" : p.role === "isotope" ? "isotope" : "fragment", label: p.label, origin: p.origin })));
};

const MS_NEW = {
  "propan-2-ol": [
    pk(27, 14, "C2H3", "C2H3", "+", "C₂H₅⁺ → C₂H₃⁺ + H₂ (loss of a hydrogen molecule from the ethyl cation)."),
    pk(29, 10, "C2H5", "C2H5", "+", "C₂H₅⁺ (an ethyl cation); CHO⁺ also contributes at m/z 29."),
    pk(43, 16, "C3H7", "C3H7", "+", "Cleavage of the C–O bond: M⁺• → C₃H₇⁺ + •OH (loss of 17 u), the propyl (isopropyl) cation."),
    pk(45, 100, "C2H5O", "CH3CH=OH", "+", "Base peak: the C–C bond next to the carbon bearing oxygen breaks and •CH₃ (15 u) is lost, leaving CH₃CH=OH⁺, stabilised by the lone pair on oxygen."),
    pk(59, 13, "C3H7O", "C3H7O", "+", "M – 1: loss of an H atom from the molecular ion."),
    pk(60, 3, "C3H8O", "C3H8O", "+•", "Molecular ion. It is very weak: the molecular ions of secondary alcohols fragment easily.", "M"),
  ],
  "propan-1-ol": [
    pk(27, 25, "C2H3", "C2H3", "+", "C₂H₅⁺ → C₂H₃⁺ + H₂."),
    pk(29, 45, "C2H5", "C2H5", "+", "C₂H₅⁺ (an ethyl cation); CHO⁺ also contributes at m/z 29."),
    pk(31, 100, "CH3O", "CH2OH", "+", "Base peak: cleavage of the C–C bond next to the carbon bearing oxygen, CH₃CH₂CH₂OH⁺• → CH₂=OH⁺ + •C₂H₅ (loss of 29 u). Typical of a primary alcohol."),
    pk(42, 20, "C3H6", "C3H6", "+•", "Loss of a water molecule from the molecular ion (M – 18): C₃H₆⁺•."),
    pk(59, 20, "C3H7O", "C3H7O", "+", "M – 1: loss of an H atom from the molecular ion."),
    pk(60, 8, "C3H8O", "C3H8O", "+•", "Molecular ion. It is weak: alcohol molecular ions fragment easily.", "M"),
  ],
  "ethanoic-acid": [
    pk(15, 15, "CH3", "CH3", "+", "CH₃⁺ from cleavage next to the C=O group."),
    pk(42, 8, "C2H2O", "C2H2O", "+•", "Loss of H₂O from the molecular ion (M – 18): C₂H₂O⁺• (ketene ion)."),
    pk(43, 100, "C2H3O", "CH3CO", "+", "Base peak: loss of •OH (17 u) from the molecular ion leaves the acylium ion CH₃C≡O⁺, which is very stable."),
    pk(45, 90, "CHO2", "COOH", "+", "Loss of •CH₃ (15 u): the carboxyl ion COOH⁺ (O=C=OH⁺)."),
    pk(60, 75, "C2H4O2", "CH3COOH", "+•", "Molecular ion. It is clearly visible for a carboxylic acid.", "M"),
  ],
  propanal: [
    pk(27, 40, "C2H3", "C2H3", "+", "C₂H₅⁺ → C₂H₃⁺ + H₂."),
    pk(29, 100, "C2H5", "C2H5", "+", "Base peak: cleavage next to the C=O that loses •CHO (29 u) leaves C₂H₅⁺; CHO⁺ (from loss of •C₂H₅) also appears at m/z 29, so this peak is shared."),
    pk(57, 50, "C3H5O", "CH3CH2CO", "+", "M – 1: loss of the aldehyde H atom leaves the acylium ion CH₃CH₂C≡O⁺."),
    pk(58, 65, "C3H6O", "CH3CH2CHO", "+•", "Molecular ion, a strong peak for an aldehyde.", "M"),
  ],
  "ethyl-ethanoate": [
    pk(27, 12, "C2H3", "C2H3", "+", "C₂H₅⁺ → C₂H₃⁺ + H₂."),
    pk(29, 22, "C2H5", "C2H5", "+", "The ethyl cation C₂H₅⁺, from the ethyl group (m/z 29)."),
    pk(43, 100, "C2H3O", "CH3CO", "+", "Base peak: cleavage of the C–O bond next to the C=O loses •OC₂H₅ (45 u) and leaves the acylium ion CH₃C≡O⁺."),
    pk(45, 17, "C2H5O", "C2H5O", "+", "The ethoxy cation C₂H₅O⁺ (charge on the other side of the same C–O cleavage; loss of CH₃CO•, 43 u)."),
    pk(61, 14, "C2H5O2", "CH3C(OH)2", "+", "A rearrangement ion: hydrogen transfer from the ethyl group, then loss of C₂H₃• (27 u), gives protonated ethanoic acid, CH₃C(OH)₂⁺."),
    pk(70, 9, "C4H6O", "C4H6O", "+•", "Loss of H₂O from the molecular ion (M – 18): C₄H₆O⁺•."),
    pk(73, 7, "C3H5O2", "C3H5O2", "+", "Loss of •CH₃ (15 u) from the molecular ion (M – 15); a small peak."),
    pk(88, 15, "C4H8O2", "CH3COOC2H5", "+•", "Molecular ion. It is weak: esters fragment easily.", "M"),
  ],
};
const MS_FROM = { ethanol: fromSpectrum("ethanol"), propanone: fromSpectrum("propanone"), butanone: fromSpectrum("butanone") };
const msOf = (id) => MS_FROM[id] ?? finishMs(id, MS_NEW[id]);

// ------------------------------------------------------------------ IR
const band = (nu, fwhm, A, eta, group, assign, extra = {}) => ({ nu, fwhm, A, eta, group, assign, ...extra });
const IR_NEW = {
  "propan-2-ol": [
    band(3340, 330, 0.85, 0.3, "oh-alc", "O–H stretch (hydrogen-bonded alcohol)"),
    band(2970, 36, 0.7, 0.5, "ch", "C–H stretch (CH₃, asymmetric)"), band(2930, 30, 0.3, 0.5, "ch", "C–H stretch (CH)"), band(2880, 28, 0.32, 0.5, "ch", "C–H stretch (symmetric)"),
    band(1465, 36, 0.3, 0.4, null, "CH₃ bending", { fingerprint: true }), band(1382, 22, 0.35, 0.4, null, "CH₃ bend (one of the pair for a C(CH₃)₂ unit)", { fingerprint: true }), band(1368, 20, 0.3, 0.4, null, "CH₃ bend (second of the pair)", { fingerprint: true }),
    band(1160, 28, 0.5, 0.5, "co", "C–C–O stretch", { fingerprint: true }), band(1130, 30, 0.95, 0.5, "co", "C–O stretch (secondary alcohol)", { fingerprint: true }),
    band(950, 26, 0.3, 0.5, null, "C–C stretch", { fingerprint: true }), band(817, 24, 0.18, 0.5, null, "C–C stretch", { fingerprint: true }),
  ],
  propanal: [
    band(2985, 34, 0.35, 0.5, "ch", "C–H stretch (CH₃)"), band(2945, 30, 0.3, 0.5, "ch", "C–H stretch (CH₂)"), band(2885, 28, 0.2, 0.5, "ch", "C–H stretch (symmetric)"),
    band(2820, 20, 0.26, 0.5, "aldch", "aldehyde C–H stretch (one of a pair)"), band(2720, 18, 0.3, 0.5, "aldch", "aldehyde C–H stretch (second band of the pair)"),
    band(1730, 26, 1.3, 0.5, "cdo", "C=O stretch (aldehyde)"),
    band(1460, 30, 0.28, 0.4, null, "CH₂ / CH₃ bending", { fingerprint: true }), band(1385, 24, 0.22, 0.4, null, "CH₃ bend", { fingerprint: true }), band(1110, 26, 0.22, 0.5, null, "C–C stretch", { fingerprint: true }), band(810, 24, 0.14, 0.5, null, "C–C stretch", { fingerprint: true }),
  ],
  butanone: [
    band(2985, 34, 0.4, 0.5, "ch", "C–H stretch (CH₃)"), band(2945, 30, 0.28, 0.5, "ch", "C–H stretch (CH₂)"), band(2885, 28, 0.15, 0.5, "ch", "C–H stretch (symmetric)"),
    band(1717, 26, 1.3, 0.5, "cdo", "C=O stretch (ketone)"),
    band(1460, 32, 0.35, 0.4, null, "CH₃ / CH₂ bending", { fingerprint: true }), band(1420, 28, 0.3, 0.4, null, "CH₂ next to C=O, bending", { fingerprint: true }), band(1360, 22, 0.55, 0.4, null, "CH₃ symmetric bend", { fingerprint: true }),
    band(1170, 30, 0.55, 0.5, null, "C–C(=O)–C stretch (skeletal; no C–O bond)", { fingerprint: true, skeletal: true }), band(1090, 26, 0.15, 0.5, null, "C–C stretch", { fingerprint: true }), band(790, 24, 0.15, 0.5, null, "C–C stretch", { fingerprint: true }),
  ],
};
const IR_FROM = { ethanol: "ethanol", propanone: "propanone", "ethanoic-acid": "ethanoic-acid", "ethyl-ethanoate": "ethyl-ethanoate", "propan-1-ol": "propan-1-ol" };
const irOf = (id) => (IR_FROM[id] ? IR_COMPOUNDS[IR_FROM[id]].bands.map((b) => ({ nu: b.nu, fwhm: b.fwhm, A: b.A, eta: b.eta, group: b.group, assign: b.assign, fingerprint: Boolean(b.fingerprint), skeletal: Boolean(b.skeletal) })) : IR_NEW[id]);

// ------------------------------------------------------------------ NMR (shift per environment; everything else is derived from the graph)
// atoms: ids of the heavy atoms (in data/structures.js) whose hydrogens form the signal. Only ONE atom per equivalent set has to be named.
const NMR = {
  ethanol: { signals: [
    { id: "s1", atoms: ["c"], shift: 2.6, label: "O–H", assign: "the hydroxyl hydrogen (O–H)", lw: 12, note: "Exchangeable: its shift moves with concentration, solvent and temperature, and the signal is broad. 2.6 ppm is a representative placeholder." },
    { id: "s2", atoms: ["b"], shift: 3.7, label: "CH₂", assign: "the CH₂ bonded to oxygen (deshielded by O)" },
    { id: "s3", atoms: ["a"], shift: 1.2, label: "CH₃", assign: "the CH₃ next to the CH₂" },
  ] },
  propanone: { signals: [{ id: "s1", atoms: ["a"], shift: 2.1, label: "CH₃", assign: "two equivalent CH₃ groups, each next to the C=O carbon (no H on the neighbouring atom)" }] },
  "ethanoic-acid": { signals: [
    { id: "s1", atoms: ["d"], shift: 11.4, label: "COOH", assign: "the carboxylic acid hydrogen (O–H), strongly deshielded", lw: 30, note: "Exchangeable and hydrogen-bonded: very far downfield (typically 10–13 ppm), broad, and concentration dependent." },
    { id: "s2", atoms: ["a"], shift: 2.1, label: "CH₃", assign: "the CH₃ next to the C=O carbon (no H on the neighbouring atom)" },
  ] },
  "propan-2-ol": { J: 6, signals: [
    { id: "s1", atoms: ["d"], shift: 2.6, label: "O–H", assign: "the hydroxyl hydrogen (O–H)", lw: 12, note: "Exchangeable: shift and width vary with concentration and solvent; 2.6 ppm is a representative placeholder." },
    { id: "s2", atoms: ["b"], shift: 4.0, label: "CH", assign: "the CH bonded to oxygen, with six neighbouring H" },
    { id: "s3", atoms: ["a", "c"], shift: 1.2, label: "CH₃", assign: "two equivalent CH₃ groups, each next to the CH" },
  ] },
  propanal: { signals: [
    { id: "s1", atoms: ["c"], shift: 9.8, label: "CHO", assign: "the aldehyde hydrogen on the C=O carbon (very strongly deshielded)" },
    { id: "s2", atoms: ["b"], shift: 2.46, label: "CH₂", assign: "the CH₂ next to the C=O carbon" },
    { id: "s3", atoms: ["a"], shift: 1.12, label: "CH₃", assign: "the CH₃ next to the CH₂" },
  ] },
  butanone: { signals: [
    { id: "s1", atoms: ["c"], shift: 2.46, label: "CH₂", assign: "the CH₂ next to the C=O carbon" },
    { id: "s2", atoms: ["a"], shift: 2.14, label: "CH₃CO", assign: "the CH₃ on the C=O carbon (no H on the neighbouring atom)" },
    { id: "s3", atoms: ["d"], shift: 1.06, label: "CH₃", assign: "the CH₃ next to the CH₂" },
  ] },
  "propan-1-ol": { signals: [
    { id: "s1", atoms: ["c"], shift: 3.6, label: "OCH₂", assign: "the CH₂ bonded to oxygen" },
    { id: "s2", atoms: ["d"], shift: 1.7, label: "O–H", assign: "the hydroxyl hydrogen (O–H)", lw: 12, note: "Exchangeable: the shift depends on concentration and solvent. Here it falls under the CH₂ multiplet, which is common in real spectra; the combined integral of the overlapping signals is 3 H." },
    { id: "s3", atoms: ["b"], shift: 1.6, label: "CH₂", assign: "the middle CH₂ (neighbours: CH₃ and OCH₂)" },
    { id: "s4", atoms: ["a"], shift: 0.9, label: "CH₃", assign: "the terminal CH₃ next to the CH₂" },
  ] },
  "ethyl-ethanoate": { signals: [
    { id: "s1", atoms: ["e"], shift: 4.1, label: "OCH₂", assign: "the CH₂ bonded to the ester oxygen (strongly deshielded)" },
    { id: "s2", atoms: ["a"], shift: 2.0, label: "CH₃CO", assign: "the CH₃ on the C=O carbon (no H on the neighbouring atom)" },
    { id: "s3", atoms: ["f"], shift: 1.2, label: "CH₃", assign: "the CH₃ of the ethyl group, next to the OCH₂" },
  ] },
};

// ------------------------------------------------------------------ the record
const SPEC = [
  { id: "ethanol", level: "foundation", choices: ["ethanol", "methoxymethane", "ethanal", "ethanoic-acid"] },
  { id: "propanone", level: "foundation", choices: ["propanone", "propanal", "prop-2-en-1-ol", "propan-2-ol"] },
  { id: "ethanoic-acid", level: "foundation", choices: ["ethanoic-acid", "methyl-methanoate", "ethanol", "ethanal"] },
  { id: "propan-2-ol", level: "intermediate", choices: ["propan-2-ol", "propan-1-ol", "methoxyethane", "ethanoic-acid"] },
  { id: "propanal", level: "intermediate", choices: ["propanal", "propanone", "prop-2-en-1-ol", "methyloxirane"] },
  { id: "butanone", level: "intermediate", choices: ["butanone", "butanal", "2-methylpropanal", "but-3-en-2-ol"] },
  { id: "propan-1-ol", level: "advanced", choices: ["propan-1-ol", "propan-2-ol", "methoxyethane", "ethanoic-acid"] },
  { id: "ethyl-ethanoate", level: "advanced", choices: ["ethyl-ethanoate", "methyl-propanoate", "propyl-methanoate", "butanoic-acid"] },
];

const PROV_MS = { ethanol: "taken from the MS workspace (ms/data/spectra.js)", propanone: "taken from the MS workspace (ms/data/spectra.js)", butanone: "taken from the MS workspace (ms/data/spectra.js)" };
const PROV_IR = { ethanol: "taken from the IR workspace (ir/data/compounds.js)", "ethanoic-acid": "taken from the IR workspace", propanone: "taken from the IR workspace", "ethyl-ethanoate": "taken from the IR workspace", "propan-1-ol": "taken from the IR workspace" };
const PROV_NMR_MODULE = ["ethanol", "propan-2-ol", "propan-1-ol", "propanone", "ethyl-ethanoate"];

function buildCompound(spec) {
  const st = STRUCTURES[spec.id]; const g = st.graph;
  const envs = environmentsOf(g);
  const cfg = NMR[spec.id]; const Jall = cfg.J ?? DEFAULT_J;
  const sigs = cfg.signals.map((s) => {
    const env = envs.find((e) => e.atoms.includes(g.idx.get(s.atoms[0])));
    return { ...s, env };
  });
  const sigOfCls = new Map(sigs.map((s) => [s.env.cls, s.id]));
  const signals = sigs.map((s) => {
    const e = s.env;
    const couplings = e.neighbours.map((nb) => ({ with: sigOfCls.get(nb.cls), nH: nb.nH, J: nb.J === DEFAULT_J ? Jall : nb.J }));
    return {
      id: s.id, label: s.label, assign: s.assign, shift: s.shift, n: e.n, integration: e.n, exchangeable: e.exchangeable, linewidthHz: s.lw ?? 1.2,
      multiplicity: e.mult.shortName ?? e.mult.name, apparent: e.mult.name !== (e.mult.shortName ?? e.mult.name), multAbbr: e.mult.abbr, nNeighbours: e.mult.total, nPlusOne: e.mult.nPlusOne, couplings, atoms: s.atoms, note: s.note ?? null,
    };
  }).sort((a, b) => b.shift - a.shift);
  const ms = msOf(spec.id);
  const bands = irOf(spec.id);
  return {
    id: spec.id, name: st.name, aliases: st.aliases, condensed: st.condensed, level: spec.level, choices: spec.choices,
    formula: st.formula, formulaPretty: st.formulaPretty, molarMass: Math.round(st.molarMass * 100) / 100, nominal: st.nominal, dou: st.dou,
    skeleton: { atoms: g.atoms.map((a) => ({ id: a.id, el: a.el, x: a.x, y: a.y })), bonds: g.bonds.map((b) => ({ a: b.a, b: b.b, order: b.order })) },
    ms: { ...ms, note: SPECTRA_NOTE },
    ir: { bands, groups: [...new Set(bands.map((b) => b.group).filter(Boolean))] },
    nmr: { freqMHz: NMR_FREQ_MHZ, solvent: NMR_SOLVENT, J: Jall, signals },
    provenance: {
      ms: PROV_MS[spec.id] ?? "entered in this tab in the same format (typical literature-style values, rounded)",
      ir: PROV_IR[spec.id] ?? "entered in this tab in the format of the IR workspace (typical band positions, widths and heights chosen by the author)",
      nmr: PROV_NMR_MODULE.includes(spec.id) ? "shifts equal to the NMR workspace's molecule model; splitting and integration derived from the structure" : "typical literature-style shifts; splitting and integration derived from the structure",
    },
  };
}

export const COMPOUNDS = Object.fromEntries(SPEC.map((s) => [s.id, buildCompound(s)]));
export const COMPOUND_IDS = SPEC.map((s) => s.id);
export const getCompound = (id) => COMPOUNDS[id] ?? null;
