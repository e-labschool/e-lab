// Characteristic IR absorption ranges (stage 7) and the extra groups used when interpreting spectra (stages 8 and 9). PURE DATA.
//
// The seven SPEC rows are exactly the table of the specification (docs/IR_SPEC.md, stage 7). They are representative ranges: exact positions depend
// on the molecular structure and environment (hydrogen bonding, conjugation, ring strain, physical state, ...). The IB Chemistry Data Booklet
// (2025, section 20 "Infrared data") gives close but not identical ranges (e.g. C=O 1700-1750, O-H of acids 2500-3000, C-H 2850-3090): where the two
// differ, the specification table is what the stage 7 table shows, and the booklet values are kept in `booklet` for the docs and the tests.
export const SOURCE_SPEC = "Specification table (docs/IR_SPEC.md, stage 7)";
export const SOURCE_BOOKLET = "IB Chemistry Data Booklet 2025, section 20 (Infrared data)";
export const SOURCE_TEXT = "Standard organic-spectroscopy tables (e.g. Pavia, Lampman, Kriz & Vyvyan, Introduction to Spectroscopy; Silverstein et al.), typical values";

/**
 * id, label, range [lo, hi], width class ("broad" etc.), the representative band(s) drawn on the functional-group map (centre, FWHM, peak absorbance,
 * eta), the demonstration molecule and the atoms (selected by SMARTS-like pattern, see ir/data/organics.js) that vibrate.
 */
export const SPEC_GROUPS = [
  { id: "oh-alc", label: "O–H (alcohol)", short: "O–H alcohol", range: [3200, 3600], note: "broad", demo: "ethanol", bonds: ["O-H"], color: "#38bdf8",
    bands: [{ nu: 3350, fwhm: 330, A: 0.85, eta: 0.3 }], shape: "Strong, broad and rounded: hydrogen bonding between molecules gives a spread of O–H bond strengths.", booklet: [3200, 3600], vib: "O–H stretch" },
  { id: "oh-acid", label: "O–H (carboxylic acid)", short: "O–H acid", range: [2500, 3300], note: "very broad", demo: "ethanoic-acid", bonds: ["O-H"], color: "#f472b6",
    bands: [{ nu: 2900, fwhm: 700, A: 0.75, eta: 0.2 }], shape: "Very broad, covering a huge range and often overlapping the C–H region: strong hydrogen bonding in the acid dimers.", booklet: [2500, 3000], vib: "O–H stretch (hydrogen-bonded)" },
  { id: "nh", label: "N–H", short: "N–H", range: [3300, 3500], note: "medium", demo: "methylamine", bonds: ["N-H"], color: "#a78bfa",
    bands: [{ nu: 3430, fwhm: 22, A: 0.28, eta: 0.6 }, { nu: 3350, fwhm: 22, A: 0.28, eta: 0.6 }], shape: "Medium and sharper than O–H. A primary amine (–NH₂) gives two bands: the N–H bonds stretch in phase and out of phase.", booklet: [3300, 3500], vib: "N–H stretch" },
  { id: "ch", label: "C–H (sp³)", short: "C–H sp³", range: [2850, 3000], note: "medium to strong", demo: "ethanol", bonds: ["C-H"], color: "#fbbf24",
    bands: [{ nu: 2965, fwhm: 38, A: 0.6, eta: 0.5 }, { nu: 2875, fwhm: 30, A: 0.4, eta: 0.5 }], shape: "A group of sharp bands just below 3000 cm⁻¹ for the C–H bonds of alkyl groups.", booklet: [2850, 3090], vib: "C–H stretch" },
  { id: "cn", label: "C≡N", short: "C≡N", range: [2210, 2260], note: "medium, sharp", demo: "ethanenitrile", bonds: ["C#N"], color: "#fb923c",
    bands: [{ nu: 2250, fwhm: 14, A: 0.5, eta: 0.6 }], shape: "A sharp, medium band in a region that is otherwise almost empty: easy to spot.", booklet: null, bookletNote: "The booklet row for 2100–2260 cm⁻¹ is C≡C (alkynes); nitriles are not listed", vib: "C≡N stretch" },
  { id: "cdo", label: "C=O", short: "C=O", range: [1650, 1750], note: "strong, sharp", demo: "propanone", bonds: ["C=O"], color: "#fca5a5",
    bands: [{ nu: 1715, fwhm: 26, A: 1.25, eta: 0.5 }], shape: "Very strong and sharp: the C=O bond is highly polar, so its stretch changes the dipole a lot.", booklet: [1700, 1750], vib: "C=O stretch" },
  { id: "cdc", label: "C=C", short: "C=C", range: [1620, 1680], note: "medium to weak", demo: "ethene", bonds: ["C=C"], color: "#86efac",
    bands: [{ nu: 1650, fwhm: 26, A: 0.32, eta: 0.5 }], shape: "Weaker than C=O (the C=C bond is non-polar or only slightly polar) and sometimes missing in symmetrical alkenes.", booklet: [1620, 1680], vib: "C=C stretch" },
];
export const GROUP_BY_ID = Object.fromEntries(SPEC_GROUPS.map((g) => [g.id, g]));

/** Extra groups for the interpretation stages (not part of the stage 7 table). */
export const EXTRA_GROUPS = [
  { id: "co", label: "C–O", short: "C–O", range: [1050, 1410], note: "strong", source: SOURCE_BOOKLET, vib: "C–O stretch", bonds: ["C-O"], color: "#c4b5fd", inFingerprint: true },
  { id: "aldch", label: "Aldehyde C–H", short: "Aldehyde C–H", range: [2700, 2850], note: "weak, one or two bands", source: SOURCE_TEXT, vib: "aldehyde C–H stretch", bonds: ["C-H(CHO)"], color: "#5eead4" },
];
export const INTERPRET_GROUPS = [...SPEC_GROUPS, ...EXTRA_GROUPS];
export const INTERPRET_BY_ID = Object.fromEntries(INTERPRET_GROUPS.map((g) => [g.id, g]));

export const groupsAt = (nu, list = INTERPRET_GROUPS) => list.filter((g) => nu >= g.range[0] && nu <= g.range[1]);
export const inRange = (nu, g) => nu >= g.range[0] && nu <= g.range[1];
