// Representative electron-ionisation (EI, about 70 eV) mass spectra of five small molecules. PURE DATA + a small builder.
//
// !!! These are REPRESENTATIVE / IDEALISED spectra, NOT experimental data, and they are labelled that way on screen. !!!
// PROVENANCE. The NIST WebBook (webbook.nist.gov) could not be fetched in this build (blocked), and no numerical table could be retrieved from the web either. The
// relative intensities below are therefore ROUNDED, TYPICAL literature-style values entered from the author's knowledge of EI spectra of these molecules (the
// kind of numbers in the NIST / SDBS spectra). They are NOT copied from a file, were NOT re-checked online, and will differ from a real spectrum by a
// tolerance of about +-30 % of each value (more for weak peaks); instruments, ionising energy and pressure all change them. They are for teaching how to READ a
// spectrum (which peak is M, which is the base peak, which fragments, which isotope cluster) and not for quantitative use.
// What IS computed, not typed:
//   * isotope partners of every chlorine- or bromine-containing ion (M+2, 37Cl and 81Br versions) = the main peak x the NATURAL isotope ratio (data/isotopes.js);
//   * the 13C/2H "M+1" satellite of the molecular ion where it does not coincide with another assigned peak = M x the polynomial pattern of the formula.
//     (For chloromethane and bromomethane the M+1 satellites, about 1 %, are not drawn: one of them would overlap an assigned peak.)
// Structure of each spectrum (checked in scripts/test-ms-model.mjs): exactly one peak = 100, the molecular ion and the base peak are identified separately,
// every ion has a formula whose nominal mass equals its m/z, cations with an odd number of electrons carry the radical dot, halogen clusters are 2 u apart.
import { isotopePattern, parseFormula } from "../physics/isotopes.js";
import { ISOTOPES } from "./isotopes.js";

export const SPECTRA_NOTE = "Representative / idealised EI spectrum (typical literature-style values, rounded, about ±30 %). Not an experimental spectrum.";
export const SPECTRA_SOURCE = "Intensities: typical values entered from the author's knowledge of 70 eV EI spectra (NIST WebBook / SDBS style); the NIST pages could not be fetched in this build, so nothing was copied or re-checked. Isotope partners and M+1 satellites are computed from IUPAC abundances.";

const SUB = "₀₁₂₃₄₅₆₇₈₉"; const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const toSub = (s) => s.replace(/\d/g, (d) => SUB[d]);
const toSup = (s) => String(s).replace(/\d/g, (d) => SUP[d]);
/** Display label of an ion: "CH3Cl" + iso {Cl:35} + "+•"  ->  "CH₃³⁵Cl⁺•" */
export function ionLabel(base, { iso = null, charge = "+", c13 = false } = {}) {
  let s = toSub(base);
  if (iso) for (const [el, A] of Object.entries(iso)) s = s.replace(new RegExp(`${el}(?![a-z])`), `${toSup(A)}${el}`);
  if (c13) s = `¹³C${s.replace(/^C/, "")}`.replace(/^¹³C(?=[A-Z₀-₉])/, "¹³C");
  return `${s}${charge === "+" ? "⁺" : "⁺•"}`;
}

// ---- builders ----
const P = (mz, rel, base, comp, origin, { iso = null, charge = "+", role = "fragment", lost = null } = {}) => ({ mz, rel, label: ionLabel(base, { iso, charge }), base, comp, iso, charge, role, origin, lost, derived: null, of: null, shift: 0 });

/** The heavier halogen partner of a peak (same ion with the other isotope): intensity = rel x natural ratio. */
function partner(peak, el) {
  const [light, heavy] = ISOTOPES[el];
  const ratio = heavy.pct / light.pct;
  const iso = { ...(peak.iso ?? {}), [el]: heavy.A };
  return {
    ...peak, mz: peak.mz + (heavy.A - light.A), rel: peak.rel * ratio, iso, label: ionLabel(peak.base, { iso, charge: peak.charge }),
    role: peak.role === "M" ? "M+2" : "isotope", derived: "cluster", of: peak.mz, lost: null,
    origin: `The same ion as m/z ${peak.mz} but containing ${heavy.A}${el} instead of ${light.A}${el}. The ratio of the two peaks is the natural isotope ratio (${light.A}${el} : ${heavy.A}${el} ≈ ${(light.pct / heavy.pct).toFixed(2)} : 1), so the pair is 2 u apart.`,
  };
}
/** The 13C / 2H satellite (M+1) of a peak, from the polynomial pattern of its formula (halogens fixed at the isotope the ion contains). */
function m1(peak) {
  const comp = parseFormula(peak.comp);
  const pat = isotopePattern(comp, { mode: "natural", only: ["C", "H", "O"] });
  const main = pat.peaks[0]; const one = pat.peaks.find((q) => q.nominal === main.nominal + 1);
  return {
    ...peak, mz: peak.mz + 1, rel: peak.rel * (one.p / main.p), role: "isotope", derived: "13C", of: peak.mz, lost: null, shift: 1, label: "M+1 (¹³C)",
    origin: `Molecules that contain one ¹³C (or ²H) atom instead of ¹²C: one mass unit heavier. Its size follows from the formula (${(100 * one.p / main.p).toFixed(1)} % of the molecular ion for ${peak.base}), so it is a small peak one unit above M.`,
  };
}

const finish = (spec) => {
  const peaks = spec.peaks.slice().sort((a, b) => a.mz - b.mz);
  const top = Math.max(...peaks.map((p) => p.rel));
  const norm = peaks.map((p) => ({ ...p, rel: Math.round((p.rel / top) * 100000) / 1000 }));
  const M = norm.find((p) => p.role === "M");
  const base = norm.reduce((b, p) => (p.rel > b.rel ? p : b), norm[0]);
  return { ...spec, peaks: norm, mMz: M.mz, baseMz: base.mz, byMz: Object.fromEntries(norm.map((p) => [p.mz, p])) };
};

// ---- the five spectra ----
const METHANE_M = P(16, 100, "CH4", "CH4", "Molecular ion: CH₄ + e⁻ → CH₄⁺• + 2e⁻. Here it is also the tallest peak, which is true for methane but not a rule: the molecular ion is not always the base peak.", { charge: "+•", role: "M" });
const METHANE = finish({
  id: "methane", name: "Methane", formula: "CH₄", comp: "CH4", nominalM: 16, isotopePattern: "none", cls: "alkane",
  peaks: [
    P(12, 3, "C", "C", "Further fragmentation: CH⁺ → C⁺ + H•. Atomic carbon cation, a very small peak."),
    P(13, 8, "CH", "CH", "Further fragmentation: CH₃⁺ → CH⁺ + H₂ (loss of a hydrogen molecule from the CH₃⁺ ion)."),
    P(14, 16, "CH2", "CH2", "Loss of H₂ from the molecular ion: CH₄⁺• → CH₂⁺• + H₂ (the H₂ is neutral and is not detected).", { charge: "+•", lost: { text: "H₂", mass: 2 } }),
    P(15, 85, "CH3", "CH3", "Loss of an H atom from the molecular ion: CH₄⁺• → CH₃⁺ + H• (the H• is neutral and is not detected).", { lost: { text: "H•", mass: 1 } }),
    METHANE_M,
    m1(METHANE_M),
  ],
  significant: [14, 15],
  explain: "The molecular ion CH₄⁺• at m/z 16 is also the base peak (100 %). The peaks at 15, 14, 13 and 12 are CH₃⁺, CH₂⁺•, CH⁺ and C⁺ from loss of H atoms and H₂ molecules. The tiny peak at 17 is the M+1 satellite from ¹³C (about 1.1 %). There is no chlorine or bromine pair.",
});

const ETH_M = P(46, 22, "CH3CH2OH", "C2H6O", "Molecular ion CH₃CH₂OH⁺•. It is weak: alcohol molecular ions fragment easily, so M is present but far from the base peak.", { charge: "+•", role: "M" });
const ETHANOL = finish({
  id: "ethanol", name: "Ethanol", formula: "C₂H₆O", comp: "C2H6O", nominalM: 46, isotopePattern: "none", cls: "alcohol",
  peaks: [
    P(27, 23, "C2H3", "C2H3", "C₂H₅⁺ → C₂H₃⁺ + H₂ (loss of a hydrogen molecule from the ethyl cation).", { lost: { text: "H₂", mass: 2 } }),
    P(29, 24, "C2H5", "C2H5", "Cleavage of the C–O bond: CH₃CH₂OH⁺• → C₂H₅⁺ + •OH (the ethyl cation; CHO⁺ also contributes at m/z 29).", { lost: { text: "•OH", mass: 17 } }),
    P(31, 100, "CH2OH", "CH3O", "Base peak: cleavage of the C–C bond next to oxygen, CH₃CH₂OH⁺• → CH₂=OH⁺ + •CH₃. The oxygen's lone pair stabilises this CH₂OH⁺ ion.", { lost: { text: "•CH₃", mass: 15 } }),
    P(43, 12, "C2H3O", "C2H3O", "A small peak: [M–H]⁺ at m/z 45 can lose H₂ to give CH₃CO⁺ (C₂H₃O⁺).", { lost: { text: "H• and H₂", mass: 3 } }),
    P(45, 51, "C2H5O", "C2H5O", "Loss of an H atom from the molecular ion (M – 1): CH₃CH₂OH⁺• → C₂H₅O⁺ + H•.", { lost: { text: "H•", mass: 1 } }),
    ETH_M,
    m1(ETH_M),
  ],
  significant: [27, 29, 31, 43, 45],
  explain: "Heaviest main peak m/z 46 = M⁺• (weak, 22 %), so M = 46. The base peak is m/z 31, CH₂OH⁺ (loss of •CH₃, 15 u), which is typical of a primary alcohol. m/z 45 is M – 1 (loss of H•); 29 is C₂H₅⁺ and 27 is C₂H₃⁺. There is no 2 u pair, so no Cl or Br.",
});

const PROP_M = P(58, 62, "CH3COCH3", "C3H6O", "Molecular ion CH₃COCH₃⁺•, a medium peak: ketone molecular ions survive better than alcohol ones.", { charge: "+•", role: "M" });
const PROPANONE = finish({
  id: "propanone", name: "Propanone", formula: "C₃H₆O", comp: "C3H6O", nominalM: 58, isotopePattern: "none", cls: "ketone",
  peaks: [
    P(15, 30, "CH3", "CH3", "The other α-cleavage product: CH₃COCH₃⁺• → CH₃⁺ + •COCH₃ (the neutral acetyl radical is not detected).", { lost: { text: "•COCH₃", mass: 43 } }),
    P(43, 100, "CH3CO", "C2H3O", "Base peak: α-cleavage next to the C=O, CH₃COCH₃⁺• → CH₃C≡O⁺ + •CH₃. The acylium ion CH₃CO⁺ is very stable.", { lost: { text: "•CH₃", mass: 15 } }),
    PROP_M,
    m1(PROP_M),
  ],
  significant: [15, 43],
  explain: "M⁺• is m/z 58 (62 %). The base peak is not the molecular ion: it is m/z 43, CH₃CO⁺ (loss of •CH₃, 15 u). The other main peak, m/z 15, is CH₃⁺. A ketone with 58 = C₃H₆O fits; the base peak at 43 (not 29) argues against propanal, the isomer.",
});

const CL_M = P(50, 100, "CH3Cl", "CH3Cl", "Molecular ion CH₃³⁵Cl⁺• (the lighter-isotope version). It is also the tallest peak here.", { iso: { Cl: 35 }, charge: "+•", role: "M" });
const CL_FR = P(49, 12, "CH2Cl", "CH2Cl", "Loss of an H atom from the molecular ion: CH₃Cl⁺• → CH₂Cl⁺ + H•.", { iso: { Cl: 35 }, lost: { text: "H•", mass: 1 } });
const CL_ION = P(35, 7, "Cl", "Cl", "Cl⁺ from cleavage of the C–Cl bond with the charge staying on chlorine.", { iso: { Cl: 35 }, lost: { text: "•CH₃", mass: 15 } });
const CHLOROMETHANE = finish({
  id: "chloromethane", name: "Chloromethane", formula: "CH₃Cl", comp: "CH3Cl", nominalM: 50, isotopePattern: "cl", cls: "halogenoalkane",
  peaks: [
    P(15, 65, "CH3", "CH3", "Cleavage of the C–Cl bond with the charge on carbon: CH₃Cl⁺• → CH₃⁺ + Cl•. No chlorine in this ion, so no 2 u partner.", { lost: { text: "Cl•", mass: 35 } }),
    CL_ION, partner(CL_ION, "Cl"),
    CL_FR, partner(CL_FR, "Cl"),
    CL_M, partner(CL_M, "Cl"),
  ],
  significant: [15, 49],
  explain: "The cluster at m/z 50 and 52 in the ratio about 3 : 1 is the molecular ion with one chlorine (³⁵Cl and ³⁷Cl), so M = 50 and the compound contains one Cl. The same 3 : 1 pairs appear at 49/51 (CH₂Cl⁺) and 35/37 (Cl⁺); m/z 15 (CH₃⁺) has no partner because it has no chlorine.",
});

const BR_M = P(94, 100, "CH3Br", "CH3Br", "Molecular ion CH₃⁷⁹Br⁺•. The ⁷⁹Br and ⁸¹Br versions are almost equally tall, so M and M+2 form a 1 : 1 pair.", { iso: { Br: 79 }, charge: "+•", role: "M" });
const BR_FR = P(93, 25, "CH2Br", "CH2Br", "Loss of an H atom from the molecular ion: CH₃Br⁺• → CH₂Br⁺ + H•.", { iso: { Br: 79 }, lost: { text: "H•", mass: 1 } });
const BR_ION = P(79, 8, "Br", "Br", "Br⁺ from cleavage of the C–Br bond with the charge on bromine.", { iso: { Br: 79 }, lost: { text: "•CH₃", mass: 15 } });
const BROMOMETHANE = finish({
  id: "bromomethane", name: "Bromomethane", formula: "CH₃Br", comp: "CH3Br", nominalM: 94, isotopePattern: "br", cls: "halogenoalkane",
  peaks: [
    P(15, 78, "CH3", "CH3", "Cleavage of the C–Br bond with the charge on carbon: CH₃Br⁺• → CH₃⁺ + Br•. No bromine in this ion, so no 2 u partner.", { lost: { text: "Br•", mass: 79 } }),
    BR_ION, partner(BR_ION, "Br"),
    BR_FR, partner(BR_FR, "Br"),
    BR_M, partner(BR_M, "Br"),
  ],
  significant: [15, 93],
  explain: "The two almost equal peaks at m/z 94 and 96 (about 1 : 1, two bromine isotopes 2 u apart) are the molecular ion with one bromine, so M = 94 (⁷⁹Br). The same 1 : 1 pairs appear at 93/95 (CH₂Br⁺) and 79/81 (Br⁺); m/z 15 (CH₃⁺) is single. The base peak is the 94 member of the pair by a whisker.",
});

export const SPECTRA = { methane: METHANE, ethanol: ETHANOL, propanone: PROPANONE, chloromethane: CHLOROMETHANE, bromomethane: BROMOMETHANE };
export const SPECTRUM_IDS = ["methane", "ethanol", "propanone", "chloromethane", "bromomethane"];
export const getSpectrum = (id) => SPECTRA[id] ?? SPECTRA.methane;
