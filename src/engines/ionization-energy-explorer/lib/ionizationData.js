// Successive ionization energy dataset for the Ionization Energy Explorer.
//
// Values are in kJ/mol and are standard reference values consistent with
// NIST/CODATA-derived atomic spectra data, as commonly tabulated in
// chemistry reference works (e.g. the CRC Handbook of Chemistry and
// Physics / NIST Atomic Spectra Database). Every element's FULL set of
// successive ionization energies is included (Li = 3 values ... Ca = 20
// values) -- none are truncated, matching the requirement that the data
// table and graph always show the complete dataset.
//
// SOURCE UPDATE (2026-11-16): the first six values of Z = 3-20 and all of H and He were re-checked against the Wikipedia data page
// "Ionization energies of the elements (data page)" (CRC Handbook 84th ed. / NIST Atomic Spectra Database values, kJ/mol; retrieved
// 2026-11-16). Values that differed by more than 1.5 kJ/mol were replaced (see docs/sim-review/atomic-fixes.md for the list). IE7 and
// above were re-checked on 2026-11-17 against the same page (all Z = 3-20, every value): everything agrees within 0.3 % after correcting P IE13 (59260 -> 59024) and Ca IE7 (12320 -> 12270).
//
// `neutralElectronConfiguration` is included for reference/display only;
// the simulation itself derives configuration at every step from the
// live electron count via lib/electronConfigurations.js (the single
// source of truth), never from this string.
export const IONIZATION_DATA = [
  { atomicNumber: 1, symbol: "H", name: "Hydrogen", neutralElectronConfiguration: "1s¹",
    successiveIonizationEnergies: [1312] },
  { atomicNumber: 2, symbol: "He", name: "Helium", neutralElectronConfiguration: "1s²",
    successiveIonizationEnergies: [2372, 5250] },
  { atomicNumber: 3, symbol: "Li", name: "Lithium", neutralElectronConfiguration: "1s² 2s¹",
    successiveIonizationEnergies: [520, 7298, 11815] },
  { atomicNumber: 4, symbol: "Be", name: "Beryllium", neutralElectronConfiguration: "1s² 2s²",
    successiveIonizationEnergies: [899, 1757, 14849, 21007] },
  { atomicNumber: 5, symbol: "B", name: "Boron", neutralElectronConfiguration: "1s² 2s² 2p¹",
    successiveIonizationEnergies: [801, 2427, 3660, 25026, 32827] },
  { atomicNumber: 6, symbol: "C", name: "Carbon", neutralElectronConfiguration: "1s² 2s² 2p²",
    successiveIonizationEnergies: [1086, 2353, 4621, 6222, 37831, 47277] },
  { atomicNumber: 7, symbol: "N", name: "Nitrogen", neutralElectronConfiguration: "1s² 2s² 2p³",
    successiveIonizationEnergies: [1402, 2856, 4578, 7475, 9445, 53267, 64360] },
  { atomicNumber: 8, symbol: "O", name: "Oxygen", neutralElectronConfiguration: "1s² 2s² 2p⁴",
    successiveIonizationEnergies: [1314, 3388, 5300, 7469, 10990, 13327, 71330, 84078] },
  { atomicNumber: 9, symbol: "F", name: "Fluorine", neutralElectronConfiguration: "1s² 2s² 2p⁵",
    successiveIonizationEnergies: [1681, 3374, 6050, 8408, 11023, 15164, 17868, 92038, 106434] },
  { atomicNumber: 10, symbol: "Ne", name: "Neon", neutralElectronConfiguration: "1s² 2s² 2p⁶",
    successiveIonizationEnergies: [2081, 3952, 6122, 9371, 12177, 15238, 19999, 23069, 115380, 131432] },
  { atomicNumber: 11, symbol: "Na", name: "Sodium", neutralElectronConfiguration: "1s² 2s² 2p⁶ 3s¹",
    successiveIonizationEnergies: [496, 4562, 6910, 9543, 13354, 16613, 20117, 25496, 28932, 141362, 159079] },
  { atomicNumber: 12, symbol: "Mg", name: "Magnesium", neutralElectronConfiguration: "1s² 2s² 2p⁶ 3s²",
    successiveIonizationEnergies: [738, 1451, 7733, 10542, 13630, 18020, 21704, 25656, 31643, 35462, 169988, 189368] },
  { atomicNumber: 13, symbol: "Al", name: "Aluminium", neutralElectronConfiguration: "1s² 2s² 2p⁶ 3s² 3p¹",
    successiveIonizationEnergies: [577, 1817, 2745, 11577, 14842, 18379, 23326, 27465, 31853, 38473, 42646, 201266, 222314] },
  { atomicNumber: 14, symbol: "Si", name: "Silicon", neutralElectronConfiguration: "1s² 2s² 2p⁶ 3s² 3p²",
    successiveIonizationEnergies: [786, 1577, 3232, 4356, 16091, 19805, 23780, 29287, 33878, 38726, 45962, 50511, 235196, 257923] },
  { atomicNumber: 15, symbol: "P", name: "Phosphorus", neutralElectronConfiguration: "1s² 2s² 2p⁶ 3s² 3p³",
    successiveIonizationEnergies: [1012, 1907, 2914, 4964, 6274, 21268, 25431, 29872, 35906, 40972, 46226, 54129, 59024, 271504, 296195] },
  { atomicNumber: 16, symbol: "S", name: "Sulfur", neutralElectronConfiguration: "1s² 2s² 2p⁶ 3s² 3p⁴",
    successiveIonizationEnergies: [1000, 2251, 3357, 4556, 7004, 8496, 27107, 31719, 36638, 43177, 48710, 54460, 62930, 68227, 311050, 337137] },
  { atomicNumber: 17, symbol: "Cl", name: "Chlorine", neutralElectronConfiguration: "1s² 2s² 2p⁶ 3s² 3p⁵",
    successiveIonizationEnergies: [1251, 2298, 3822, 5159, 6542, 9362, 11018, 33604, 38600, 43961, 51068, 57119, 63363, 72341, 78095, 352990, 380759] },
  { atomicNumber: 18, symbol: "Ar", name: "Argon", neutralElectronConfiguration: "1s² 2s² 2p⁶ 3s² 3p⁶",
    successiveIonizationEnergies: [1521, 2666, 3931, 5771, 7238, 8781, 11995, 13842, 40760, 46187, 52002, 59653, 66199, 72918, 82472, 88576, 397594, 427066] },
  { atomicNumber: 19, symbol: "K", name: "Potassium", neutralElectronConfiguration: "1s² 2s² 2p⁶ 3s² 3p⁶ 4s¹",
    successiveIonizationEnergies: [419, 3052, 4420, 5877, 7975, 9590, 11343, 14944, 16964, 48577, 54490, 60730, 68887, 75993, 83071, 93400, 99900, 444869, 476069] },
  { atomicNumber: 20, symbol: "Ca", name: "Calcium", neutralElectronConfiguration: "1s² 2s² 2p⁶ 3s² 3p⁶ 4s²",
    successiveIonizationEnergies: [590, 1145, 4912, 6491, 8153, 10496, 12270, 14207, 18192, 20385, 57110, 63410, 70110, 78890, 86310, 94000, 104900, 111710, 494900, 527670] },
];

const byZ = new Map(IONIZATION_DATA.map((e) => [e.atomicNumber, e]));

export function ionizationElementByAtomicNumber(z) {
  return byZ.get(z) ?? null;
}

export function ionizationEnergyForStep(atomicNumber, step /* 1-based */) {
  const el = byZ.get(atomicNumber);
  if (!el) return null;
  return el.successiveIonizationEnergies[step - 1] ?? null;
}

// First ionisation energy for H-Kr (kJ/mol) for the S1.3.8 trend view. Same source and date as above (the data page's first column).
export const FIRST_IE_H_TO_KR = [
  1312.0, 2372.3, 520.2, 899.5, 800.6, 1086.5, 1402.3, 1313.9, 1681.0, 2080.7,
  495.8, 737.7, 577.5, 786.5, 1011.8, 999.6, 1251.2, 1520.6, 418.8, 589.8,
  633.1, 658.8, 650.9, 652.9, 717.3, 762.5, 760.4, 737.1, 745.5, 906.4,
  578.8, 762, 947.0, 941.0, 1139.9, 1350.8,
];
const SYMBOLS = ["H","He","Li","Be","B","C","N","O","F","Ne","Na","Mg","Al","Si","P","S","Cl","Ar","K","Ca","Sc","Ti","V","Cr","Mn","Fe","Co","Ni","Cu","Zn","Ga","Ge","As","Se","Br","Kr"];
export const FIRST_IE_TREND = FIRST_IE_H_TO_KR.map((ie, i) => ({ z: i + 1, symbol: SYMBOLS[i], ie }));
