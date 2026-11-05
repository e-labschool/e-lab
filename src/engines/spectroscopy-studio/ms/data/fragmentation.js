// Methane fragmentation pathways (stage 4) and the ionisation step (stage 3). PURE DATA.
//
// ILLUSTRATIVE. Each pathway is one step that really occurs in the EI spectrum of methane (CH4+• -> CH3+ + H•, CH4+• -> CH2+• + H2, then further loss of H2 or H from
// the smaller ions). The relative abundance shown with a pathway is the intensity of the resulting peak in the representative spectrum (data/spectra.js): it is an
// INDICATION that the pathways do NOT occur equally often, not a branching ratio. A peak is also fed by several routes (m/z 14 can also come from CH3+ losing H),
// so "peak size" is not "probability of this single step".
import { SPECTRA } from "./spectra.js";

const rel = (mz) => SPECTRA.methane.byMz[mz].rel;
export const IONISATION = Object.freeze({
  equation: "CH₄ + e⁻ → CH₄⁺• + 2e⁻",
  electronEnergyEv: 70, // the conventional EI electron energy
  ionisationEnergyEv: 12.61, // first ionisation energy of CH4, NIST WebBook (Chemistry WebBook, methane, gas-phase ion energetics); typical value, not re-checked online
  note: "The fast electron does not attach to the molecule: it knocks one electron out. Two electrons leave (the ejected one and the incoming, slowed one). There is no proton attachment in electron ionisation.",
});

/** charged: continues to the analyser; neutral: not accelerated, not deflected, not detected (pumped away). kind: radical cation | cation | radical | molecule */
export const PATHWAYS = [
  { id: "ch3", from: { label: "CH₄⁺•", mz: 16, kind: "radical cation" }, eq: "CH₄⁺• → CH₃⁺ + H•", mzOut: 15, rel: rel(15),
    products: [{ label: "CH₃⁺", charged: true, mz: 15, kind: "cation (even-electron)" }, { label: "H•", charged: false, mz: null, kind: "hydrogen atom (radical)" }],
    text: "A C–H bond breaks. The charge stays on the carbon fragment; the hydrogen atom leaves as a neutral radical." },
  { id: "ch2", from: { label: "CH₄⁺•", mz: 16, kind: "radical cation" }, eq: "CH₄⁺• → CH₂⁺• + H₂", mzOut: 14, rel: rel(14),
    products: [{ label: "CH₂⁺•", charged: true, mz: 14, kind: "radical cation" }, { label: "H₂", charged: false, mz: null, kind: "hydrogen molecule" }],
    text: "Two hydrogens leave together as a neutral H₂ molecule. The charged fragment keeps the unpaired electron." },
  { id: "ch", from: { label: "CH₃⁺", mz: 15, kind: "cation" }, eq: "CH₃⁺ → CH⁺ + H₂", mzOut: 13, rel: rel(13), secondary: true,
    products: [{ label: "CH⁺", charged: true, mz: 13, kind: "cation (even-electron)" }, { label: "H₂", charged: false, mz: null, kind: "hydrogen molecule" }],
    text: "A second step: the CH₃⁺ ion formed above can lose H₂ in turn." },
  { id: "c", from: { label: "CH⁺", mz: 13, kind: "cation" }, eq: "CH⁺ → C⁺ + H•", mzOut: 12, rel: rel(12), secondary: true,
    products: [{ label: "C⁺", charged: true, mz: 12, kind: "atomic cation" }, { label: "H•", charged: false, mz: null, kind: "hydrogen atom (radical)" }],
    text: "A third step: the last hydrogen leaves. This path is a small peak." },
];
export const PATHWAY_BY_ID = Object.fromEntries(PATHWAYS.map((p) => [p.id, p]));
export const FRAGMENTATION_STATEMENT = "Fragmentation patterns provide information about molecular structure.";
export const NOT_EQUAL_NOTE = "The pathways are not equally likely: the m/z 15 peak is about 85 % of the base peak, m/z 12 only about 3 %.";
