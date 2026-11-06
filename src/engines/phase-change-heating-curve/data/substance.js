// The worked example: WATER at standard atmospheric pressure (101.325 kPa).
// The simulation was already a water-specific heating curve, so that is kept;
// every transition temperature and every segment length below belongs to
// water and is never applied to another substance. (There is no substance
// selector.)
//
// SOURCES (typical textbook / data-book values; the third significant figure
// differs a little between books, e.g. cp(ice) 2.06-2.11, cp(steam) 1.99-2.03):
//  - Melting point 0 degC, boiling point 100 degC (by definition of the Celsius scale at 1 atm).
//  - Specific heat capacities, J g^-1 K^-1: ice 2.09, liquid water 4.18, steam 2.01
//    (CRC Handbook of Chemistry and Physics; NIST Chemistry WebBook; Science Notes
//    "Ice to Steam Problem" lists 2.06 / 4.19 / 2.03 -- same behaviour).
//  - Specific latent heats, J g^-1: fusion 334 (333.55), vaporisation 2257 (2256 at 100 degC).
// The displayed start/end temperatures (-20 degC, 130 degC) are a choice of window.
export const SUBSTANCE = {
  name: "Water",
  solidName: "ice",
  liquidName: "liquid water",
  gasName: "water vapour",
  tMelt: 0,
  tBoil: 100,
  tStart: -20,
  tEnd: 130,
  cSolid: 2.09,
  cLiquid: 4.18,
  cGas: 2.01,
  latentFusion: 334,
  latentVaporisation: 2257,
};

export const ABSOLUTE_ZERO_OFFSET = 273.15;
