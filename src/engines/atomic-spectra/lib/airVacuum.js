// Vacuum <-> standard-air wavelength (Birch & Downs 1994 update of Edlen 1966; valid about 200 nm to 2 um). Hydrogen's lines in this
// simulation are computed from energy differences, so they are VACUUM wavelengths (H-alpha 656.47 nm); spectral-lamp tables (NIST) and
// spectroscopes quote AIR wavelengths (H-alpha 656.28 nm). Both are shown so students are not confused by the 0.03 % difference.
export function airRefractiveIndex(vacuumNm) {
  const s2 = (1000 / vacuumNm) ** 2; // sigma^2 with sigma in 1/um
  return 1 + 8.34254e-5 + 2.406147e-2 / (130 - s2) + 1.5998e-4 / (38.9 - s2);
}
export const vacuumToAirNm = (vac) => (vac < 200 ? vac : vac / airRefractiveIndex(vac));
export function airToVacuumNm(air) {
  if (air < 200) return air;
  let vac = air; for (let i = 0; i < 6; i += 1) vac = air * airRefractiveIndex(vac);
  return vac;
}
