// Isotope data used by the Mass Spectrometry workspace. PURE DATA.
//
// SOURCES (values entered from the published tables; the NIST web pages could not be fetched in this build, so they were NOT re-checked online):
//   isotopic masses     Wang, Huang, Kondev, Audi, Naimi, Chin. Phys. C 45, 030003 (2021), the AME2020 atomic mass evaluation, as tabulated in the NIST
//                       "Atomic Weights and Isotopic Compositions" database (physics.nist.gov/PhysRefData/Compositions). Unit: u.
//   natural abundances  IUPAC Commission on Isotopic Abundances and Atomic Weights (Meija et al., Pure Appl. Chem. 88, 293-306 (2016)) / the same NIST table.
//                       Values are mole fractions of the representative terrestrial composition (percent); real samples vary slightly.
// The first group (H, C, Cl, Br) is what the lessons use; O, N, F, S, I are only needed to check the formulas of the spectra and of the unknown-compound choices.
// TEACHING MODEL: chlorine is taken as 75 : 25 (35Cl : 37Cl) and bromine as 1 : 1 (79Br : 81Br) wherever the lesson says "teaching". The natural values are
// 75.76 : 24.24 (Cl) and 50.69 : 49.31 (Br). The toggle in stages 10 and 11 shows both.
export const ISOTOPES = Object.freeze({
  H: [{ A: 1, mass: 1.00782503223, pct: 99.9885 }, { A: 2, mass: 2.01410177812, pct: 0.0115 }],
  C: [{ A: 12, mass: 12.0, pct: 98.93 }, { A: 13, mass: 13.00335483507, pct: 1.07 }],
  Cl: [{ A: 35, mass: 34.968852682, pct: 75.76 }, { A: 37, mass: 36.965902602, pct: 24.24 }],
  Br: [{ A: 79, mass: 78.9183376, pct: 50.69 }, { A: 81, mass: 80.9162897, pct: 49.31 }],
  O: [{ A: 16, mass: 15.99491461957, pct: 99.757 }, { A: 17, mass: 16.9991317565, pct: 0.038 }, { A: 18, mass: 17.99915961286, pct: 0.205 }],
  N: [{ A: 14, mass: 14.0030740048, pct: 99.636 }, { A: 15, mass: 15.0001088982, pct: 0.364 }],
  F: [{ A: 19, mass: 18.99840316273, pct: 100 }],
  I: [{ A: 127, mass: 126.904472, pct: 100 }],
  S: [{ A: 32, mass: 31.9720711744, pct: 94.99 }, { A: 33, mass: 32.9714589098, pct: 0.75 }, { A: 34, mass: 33.967867004, pct: 4.25 }, { A: 36, mass: 35.96708071, pct: 0.01 }],
});
export const ELEMENT_Z = Object.freeze({ H: 1, C: 6, N: 7, O: 8, F: 9, S: 16, Cl: 17, Br: 35, I: 53 });
export const ELEMENT_NAME = Object.freeze({ H: "hydrogen", C: "carbon", N: "nitrogen", O: "oxygen", F: "fluorine", I: "iodine", S: "sulfur", Cl: "chlorine", Br: "bromine" });
export const TEACHING_ABUNDANCE = Object.freeze({
  Cl: [{ A: 35, mass: 34.968852682, pct: 75 }, { A: 37, mass: 36.965902602, pct: 25 }],
  Br: [{ A: 79, mass: 78.9183376, pct: 50 }, { A: 81, mass: 80.9162897, pct: 50 }],
});
export const ISOTOPE_SOURCE = "Isotopic masses: AME2020 (Wang et al., Chin. Phys. C 45, 030003, 2021) as tabulated by NIST. Abundances: IUPAC (Meija et al., Pure Appl. Chem. 88, 293, 2016) / NIST. Entered from the tables; not re-checked online in this build.";
export const TEACHING_NOTE = "Teaching model: chlorine 75 : 25 (³⁵Cl : ³⁷Cl) and bromine about 1 : 1 (⁷⁹Br : ⁸¹Br). Natural values: Cl 75.76 : 24.24, Br 50.69 : 49.31.";
export const TERMS_NOTE = "Mass number (protons + neutrons, a whole number) is not the isotopic mass (the mass of one isotope in u, not a whole number), not the relative atomic mass Aᵣ (the abundance-weighted mean over the isotopes) and not m/z (an ion's mass in u divided by its charge number).";
