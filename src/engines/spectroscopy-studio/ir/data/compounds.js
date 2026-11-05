// REPRESENTATIVE / IDEALISED infrared spectra of simple organic compounds (stages 8 and 9). PURE DATA.
//
// These are NOT experimental spectra. Each spectrum is synthesised (physics/spectrum.js) from a short list of bands that are typical for the compound
// in the liquid film: position (cm^-1), full width at half maximum, peak absorbance, shape, assignment and the source of the position.
//   source keys  IB    IB Chemistry Data Booklet 2025, section 20 (Infrared data): the characteristic RANGE the band falls in (checked against the provided PDF)
//                TXT   typical liquid-film band positions from standard organic-spectroscopy tables (Pavia et al., Introduction to Spectroscopy;
//                      Silverstein et al., Spectrometric Identification of Organic Compounds), quoted as approximate values (about ±20 cm^-1; hydrogen
//                      bonding, concentration and physical state shift them). They were NOT individually checked against NIST spectra in this build.
// Widths and absorbances are chosen by the author so that the picture looks like a typical spectrum (O–H broad, C=O strong and sharp, C–H medium, fingerprint
// bands weaker and narrower); they are teaching values, not fitted to data. Relative absorbance: strong ~1.0-1.4, medium ~0.4-0.7, weak ~0.1-0.3.
import { SOURCE_BOOKLET, SOURCE_TEXT } from "../physics/functionalGroups.js";

export const SOURCES = { IB: SOURCE_BOOKLET, TXT: SOURCE_TEXT };
export const REPRESENTATIVE_NOTE = "Representative / idealised spectrum built from typical band positions. It is not an experimental spectrum.";

const BOOKLET_RANGE = { "oh-alc": [3200, 3600], "oh-acid": [2500, 3000], ch: [2850, 3090], cdo: [1700, 1750], co: [1050, 1410] };
const b = (nu, fwhm, A, eta, group, assign, src = ["TXT"], extra = {}) => {
  const r = group ? BOOKLET_RANGE[group] : null; const ib = r && nu >= r[0] && nu <= r[1];
  return { nu, fwhm, A, eta, group, assign, src: ib ? ["IB", ...src] : src, ...extra };
};

/**
 * expect: the diagnostic groups a student should look for. 1 = expected, 0 = should be absent, "opt" = may or may not be listed (not used for scoring).
 * (Only groups that discriminate between the compounds of this set are scored; C–H is present in all of them.)
 */
export const COMPOUNDS = {
  ethanol: {
    id: "ethanol", name: "Ethanol", condensed: "CH₃CH₂OH", cls: "alcohol",
    expect: { "oh-alc": 1, "oh-acid": 0, cdo: 0, aldch: 0, co: 1 },
    bands: [
      b(3340, 330, 0.85, 0.3, "oh-alc", "O–H stretch (hydrogen-bonded alcohol)"),
      b(2975, 36, 0.62, 0.5, "ch", "C–H stretch (CH₃, asymmetric)"), b(2930, 34, 0.5, 0.5, "ch", "C–H stretch (CH₂)"), b(2880, 30, 0.4, 0.5, "ch", "C–H stretch (symmetric)"),
      b(1455, 40, 0.28, 0.4, null, "CH₂ / CH₃ bending", ["TXT"], { fingerprint: true }), b(1380, 28, 0.25, 0.4, null, "CH₃ bend (umbrella) / O–H in-plane bend", ["TXT"], { fingerprint: true }),
      b(1087, 28, 0.45, 0.5, "co", "C–O stretch"), b(1050, 40, 0.95, 0.5, "co", "C–O stretch (primary alcohol)"), b(880, 28, 0.25, 0.5, null, "C–C stretch", ["TXT"], { fingerprint: true }),
    ],
  },
  ethanal: {
    id: "ethanal", name: "Ethanal", condensed: "CH₃CHO", cls: "aldehyde",
    expect: { "oh-alc": 0, "oh-acid": 0, cdo: 1, aldch: 1, co: 0 },
    bands: [
      b(2990, 34, 0.2, 0.5, "ch", "C–H stretch (CH₃)"), b(2920, 30, 0.24, 0.5, "ch", "C–H stretch (CH₃)"),
      b(2820, 20, 0.26, 0.5, "aldch", "aldehyde C–H stretch (one of a pair)"), b(2720, 18, 0.3, 0.5, "aldch", "aldehyde C–H stretch (second band of the pair)"),
      b(1730, 26, 1.25, 0.5, "cdo", "C=O stretch (aldehyde)"),
      b(1430, 30, 0.24, 0.4, null, "CH₃ bend", ["TXT"], { fingerprint: true }), b(1350, 25, 0.3, 0.4, null, "CH₃ / C–H bend", ["TXT"], { fingerprint: true }), b(1120, 25, 0.34, 0.5, null, "C–C stretch", ["TXT"], { fingerprint: true }),
    ],
  },
  propanone: {
    id: "propanone", name: "Propanone", condensed: "CH₃COCH₃", cls: "ketone",
    expect: { "oh-alc": 0, "oh-acid": 0, cdo: 1, aldch: 0, co: "opt" },
    bands: [
      b(3000, 30, 0.12, 0.5, "ch", "C–H stretch (CH₃)"), b(2965, 30, 0.16, 0.5, "ch", "C–H stretch (CH₃)"),
      b(1715, 28, 1.35, 0.5, "cdo", "C=O stretch (ketone)"),
      b(1430, 30, 0.45, 0.4, null, "CH₃ asymmetric bend", ["TXT"], { fingerprint: true }), b(1360, 22, 0.6, 0.4, null, "CH₃ symmetric bend", ["TXT"], { fingerprint: true }),
      b(1220, 28, 0.8, 0.5, null, "C–C(=O)–C stretch (skeletal; it lies inside the 1050–1410 C–O range but there is no C–O bond)", ["TXT"], { fingerprint: true, skeletal: true }),
      b(1090, 26, 0.12, 0.5, null, "CH₃ rock", ["TXT"], { fingerprint: true }), b(790, 22, 0.14, 0.5, null, "C–C stretch", ["TXT"], { fingerprint: true }), b(530, 30, 0.3, 0.5, null, "C–C=O bend", ["TXT"], { fingerprint: true }),
    ],
  },
  "ethanoic-acid": {
    id: "ethanoic-acid", name: "Ethanoic acid", condensed: "CH₃COOH", cls: "carboxylic acid",
    expect: { "oh-alc": 0, "oh-acid": 1, cdo: 1, aldch: 0, co: 1 },
    bands: [
      b(2950, 640, 0.75, 0.2, "oh-acid", "O–H stretch (hydrogen-bonded dimer, very broad)"), b(2990, 30, 0.14, 0.5, "ch", "C–H stretch (CH₃), on top of the O–H band"),
      b(1710, 40, 1.25, 0.5, "cdo", "C=O stretch (carboxylic acid)"),
      b(1410, 40, 0.5, 0.4, null, "O–H in-plane bend / CH₃ bend", ["TXT"], { fingerprint: true }), b(1360, 24, 0.3, 0.4, null, "CH₃ bend", ["TXT"], { fingerprint: true }),
      b(1290, 45, 0.85, 0.5, "co", "C–O stretch"), b(930, 70, 0.55, 0.3, null, "O–H out-of-plane bend (dimer, broad)", ["TXT"], { fingerprint: true }),
    ],
  },
  "ethyl-ethanoate": {
    id: "ethyl-ethanoate", name: "Ethyl ethanoate", condensed: "CH₃COOCH₂CH₃", cls: "ester",
    expect: { "oh-alc": 0, "oh-acid": 0, cdo: 1, aldch: 0, co: 1 },
    bands: [
      b(2985, 34, 0.35, 0.5, "ch", "C–H stretch (CH₃)"), b(2940, 30, 0.22, 0.5, "ch", "C–H stretch (CH₂)"), b(2905, 28, 0.1, 0.5, "ch", "C–H stretch (symmetric)"),
      b(1740, 26, 1.4, 0.5, "cdo", "C=O stretch (ester)"),
      b(1445, 26, 0.26, 0.4, null, "CH₃ / CH₂ bend", ["TXT"], { fingerprint: true }), b(1370, 20, 0.5, 0.4, null, "CH₃ symmetric bend", ["TXT"], { fingerprint: true }),
      b(1240, 36, 1.0, 0.5, "co", "C–C(=O)–O stretch (ester C–O)"), b(1050, 36, 0.75, 0.5, "co", "O–CH₂ stretch (ester C–O)"), b(850, 24, 0.12, 0.5, null, "C–C stretch", ["TXT"], { fingerprint: true }),
    ],
  },
  "propan-1-ol": {
    id: "propan-1-ol", name: "Propan-1-ol", condensed: "CH₃CH₂CH₂OH", cls: "alcohol",
    expect: { "oh-alc": 1, "oh-acid": 0, cdo: 0, aldch: 0, co: 1 },
    bands: [
      b(3330, 330, 0.85, 0.3, "oh-alc", "O–H stretch (hydrogen-bonded alcohol)"),
      b(2960, 36, 0.66, 0.5, "ch", "C–H stretch (CH₃, asymmetric)"), b(2935, 32, 0.5, 0.5, "ch", "C–H stretch (CH₂)"), b(2875, 28, 0.4, 0.5, "ch", "C–H stretch (symmetric)"),
      b(1460, 36, 0.3, 0.4, null, "CH₂ / CH₃ bending", ["TXT"], { fingerprint: true }), b(1380, 24, 0.2, 0.4, null, "CH₃ bend", ["TXT"], { fingerprint: true }),
      b(1058, 40, 0.95, 0.5, "co", "C–O stretch (primary alcohol)"), b(970, 30, 0.3, 0.5, null, "C–C stretch", ["TXT"], { fingerprint: true }),
    ],
  },
};
export const COMPOUND_IDS = Object.keys(COMPOUNDS);
export const INTERPRET_SET = ["ethanol", "ethanal", "propanone", "ethanoic-acid", "ethyl-ethanoate"];

/** All fingerprint bands lie below 1500 cm^-1 (checked by the tests). */
export const FINGERPRINT_NOTE = "Below about 1500 cm⁻¹ many bending and skeletal vibrations overlap. The pattern there is unique to each compound, so it is used to confirm an identity, but it is hard to assign band by band.";
