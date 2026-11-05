// Stage 13: three kinds of evidence for one compound, and the narrowing of a candidate list. PURE.
// MS evidence comes from data/spectra.js; IR bands from the IR workspace's data module (ir/data/compounds.js, used read-only); NMR environments from the NMR
// workspace's molecular model (nmr/molecular/model, read-only). Chloromethane is in neither the IR nor the NMR module, so its two entries here are small,
// labelled TEXTBOOK values (not from those modules).
// Each candidate of a pool carries a DESCRIPTOR of what each technique would show. The filters are deliberately simple:
//   MS   keeps candidates with the same molecular-ion mass AND the same halogen isotope pattern (none / Cl / Br);
//   IR   keeps candidates that show all the diagnostic bands observed (absence of a band is not proof, so extra bands in a candidate are allowed);
//   NMR  keeps candidates with the same hydrogen environments and integration ratio (number of signals and relative areas).
// The descriptors of the DISTRACTORS are typical textbook features, not spectra; they exist to show how evidence combines.
import { SPECTRA } from "./spectra.js";
import { COMPOUNDS as IR_COMPOUNDS } from "../../ir/data/compounds.js";
import { MOLECULE_BY_ID } from "../../nmr/molecular/model/molecules.js";
import { buildSignals } from "../../nmr/molecular/model/spectrum.js";

export const EXAMPLES = ["ethanol", "propanone", "chloromethane"];
export const TECHNIQUE_ROWS = [
  { id: "ms", name: "Mass spectrometry", gives: "m/z values, ion abundances, isotopic composition, molecular and fragment ions", cannot: "does not show how the atoms are connected by itself" },
  { id: "ir", name: "IR spectroscopy", gives: "bond vibrations and functional-group evidence", cannot: "says little about the carbon skeleton or the molecular mass" },
  { id: "nmr", name: "¹H NMR spectroscopy", gives: "hydrogen environments, relative numbers of hydrogens and neighbouring-hydrogen patterns", cannot: "no direct information on atoms without hydrogen (O, Cl, a C=O carbon) or the molecular mass" },
];
export const NO_SINGLE_TECHNIQUE = "No single technique is universally sufficient for complete molecular structure determination: they answer different questions, and the answers must agree.";

const D = (id, name, formula, M, halogen, ir, nmr) => ({ id, name, formula, M, halogen, ir, nmr });
// ir: diagnostic bands (tags: oh-alc, oh-acid, cdo, co, aldch, cx = C–Cl/C–Br, cf = C–F, cdc, sh); nmr: relative H counts per environment, largest first
export const POOLS = {
  ethanol: [
    D("ethanol", "Ethanol", "C₂H₆O", 46, "none", ["oh-alc", "co"], [3, 2, 1]),
    D("methoxymethane", "Methoxymethane", "C₂H₆O", 46, "none", ["co"], [6]),
    D("methanoic-acid", "Methanoic acid", "CH₂O₂", 46, "none", ["oh-acid", "cdo", "co"], [1, 1]),
    D("propan-1-ol", "Propan-1-ol", "C₃H₈O", 60, "none", ["oh-alc", "co"], [3, 2, 2, 1]),
    D("ethanethiol", "Ethanethiol", "C₂H₆S", 62, "none", ["sh"], [3, 2, 1]),
    D("ethanal", "Ethanal", "C₂H₄O", 44, "none", ["cdo", "aldch"], [3, 1]),
  ],
  propanone: [
    D("propanone", "Propanone", "C₃H₆O", 58, "none", ["cdo"], [6]),
    D("propanal", "Propanal", "C₃H₆O", 58, "none", ["cdo", "aldch"], [3, 2, 1]),
    D("prop-2-en-1-ol", "Prop-2-en-1-ol", "C₃H₆O", 58, "none", ["oh-alc", "co", "cdc"], [2, 2, 1, 1]),
    D("butane", "Butane", "C₄H₁₀", 58, "none", [], [6, 4]),
    D("methoxymethane", "Methoxymethane", "C₂H₆O", 46, "none", ["co"], [6]),
    D("methyl-ethanoate", "Methyl ethanoate", "C₃H₆O₂", 74, "none", ["cdo", "co"], [3, 3]),
  ],
  chloromethane: [
    D("chloromethane", "Chloromethane", "CH₃Cl", 50, "cl", ["cx"], [3]),
    D("bromomethane", "Bromomethane", "CH₃Br", 94, "br", ["cx"], [3]),
    D("fluoromethane", "Fluoromethane", "CH₃F", 34, "none", ["cf"], [3]),
    D("methanol", "Methanol", "CH₄O", 32, "none", ["oh-alc", "co"], [3, 1]),
    D("chloroethane", "Chloroethane", "C₂H₅Cl", 64, "cl", ["cx"], [3, 2]),
    D("dichloromethane", "Dichloromethane", "CH₂Cl₂", 84, "cl", ["cx"], [2]),
  ],
};
export const TECHNIQUES_ORDER = ["ms", "ir", "nmr"];

const sameRatio = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
export function matches(tech, truth, cand) {
  if (tech === "ms") return cand.M === truth.M && cand.halogen === truth.halogen;
  if (tech === "ir") return truth.ir.every((t) => cand.ir.includes(t));
  return sameRatio(truth.nmr, cand.nmr);
}
/** candidates still consistent after the given set of revealed techniques */
export function remaining(example, revealed) {
  const pool = POOLS[example]; const truth = pool.find((c) => c.id === example);
  return pool.filter((c) => revealed.every((t) => matches(t, truth, c)));
}

const IR_LABEL = { "oh-alc": "O–H (alcohol)", cdo: "C=O", co: "C–O", ch: "C–H" };
function irEvidence(example) {
  if (IR_COMPOUNDS[example]) {
    const c = IR_COMPOUNDS[example];
    const best = new Map();
    for (const b of c.bands) if (b.group && (!best.has(b.group) || b.A > best.get(b.group).A)) best.set(b.group, b);
    const bands = [...best.values()].sort((x, y) => y.nu - x.nu).map((b) => ({ nu: Math.round(b.nu), assign: b.assign, group: b.group }));
    return { bands, source: "IR workspace data (representative / idealised bands, stage 8)", also: c.id === "propanone" ? "No O–H band near 3300 cm⁻¹: not an alcohol. A strong C=O band: a carbonyl compound." : "A broad O–H band near 3300 cm⁻¹ and a strong C–O band: an alcohol (or similar)." };
  }
  return { bands: [{ nu: 2966, assign: "C–H stretch (CH₃)", group: "ch" }, { nu: 732, assign: "C–Cl stretch (fingerprint region)", group: "cx" }], source: "Textbook gas-phase values for CH₃Cl (about 2966 and 732 cm⁻¹); not in the IR workspace data", also: "No O–H, no C=O: the C–Cl band is in the fingerprint region and is not easy to assign on its own." };
}
function nmrEvidence(example) {
  const mol = MOLECULE_BY_ID[example];
  if (mol) {
    const sig = buildSignals(mol, { coupling: true });
    return { envs: sig.map((s) => ({ label: s.label, delta: s.deltaPpm, count: s.count, mult: s.multiplicity.name })), source: "NMR workspace molecular model (representative shifts)" };
  }
  return { envs: [{ label: "CH₃", delta: 3.05, count: 3, mult: "singlet" }], source: "Textbook value for CH₃Cl in CDCl₃ (about 3.05 ppm); not in the NMR workspace data" };
}
function msEvidence(example) {
  const s = SPECTRA[example]; const base = s.byMz[s.baseMz]; const M = s.byMz[s.mMz];
  const frags = s.significant.filter((m) => m !== s.baseMz).slice(0, 3).map((m) => s.byMz[m]);
  const iso = s.isotopePattern === "cl" ? "M and M+2 about 3 : 1: one chlorine" : s.isotopePattern === "br" ? "M and M+2 about 1 : 1: one bromine" : "no 2 u pair: no chlorine or bromine";
  return { M, base, frags, iso, spectrumId: example, source: "Representative EI spectrum (stage 9 data)" };
}
export const evidenceFor = (example) => ({ ms: msEvidence(example), ir: irEvidence(example), nmr: nmrEvidence(example) });
export const truthOf = (example) => POOLS[example].find((c) => c.id === example);
export const IR_TAG_LABEL = { ...IR_LABEL, "oh-acid": "O–H (acid)", aldch: "aldehyde C–H", cx: "C–Cl / C–Br", cf: "C–F", cdc: "C=C", sh: "S–H" };
