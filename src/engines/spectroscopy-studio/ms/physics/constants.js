// Constants and unit helpers of the Mass Spectrometry workspace. PURE (no React, no three). SI units internally; the UI converts for display.
//
//   e   elementary charge             1.602 176 634e-19 C       exact (2019 SI definition)
//   u   unified atomic mass unit      1.660 539 068 92e-27 kg   CODATA 2022 (the dalton)
//   me  electron mass                 9.109 383 7139e-31 kg     CODATA 2022
// m/z is a pure number: the ion's mass in u divided by its charge number z. It is NOT a mass and NOT a charge (the unit "Th" is discouraged).
export const E_CHARGE = 1.602176634e-19;
export const U_KG = 1.66053906892e-27;
export const M_ELECTRON_KG = 9.1093837139e-31;
export const M_ELECTRON_U = M_ELECTRON_KG / U_KG; // 5.485 799e-4 u

export const mzToMassKg = (mz, z = 1) => mz * z * U_KG; // ion mass in kg from m/z and z
export const massKgToMz = (kg, z = 1) => kg / U_KG / z;

/** Display helpers (kept here so every stage prints numbers the same way). */
export const fmtSci = (x, d = 2) => {
  if (!Number.isFinite(x)) return "–";
  if (x === 0) return "0";
  const e = Math.floor(Math.log10(Math.abs(x))); const m = x / 10 ** e;
  const sup = String(e).replace("-", "⁻").replace(/\d/g, (c) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[c]);
  return `${m.toFixed(d)}×10${sup}`;
};
export const fmtEv = (joule) => `${(joule / E_CHARGE).toLocaleString("en-US", { maximumFractionDigits: 0 })} eV`;
export const fmtKms = (v) => `${(v / 1000).toLocaleString("en-US", { maximumFractionDigits: v < 1e5 ? 1 : 0 })} km/s`;
export const fmtUs = (t) => `${(t * 1e6).toFixed(2)} µs`;
export const fmtMm = (m) => `${(m * 1000).toFixed(1)} mm`;
export const fmtCm = (m) => `${(m * 100).toFixed(1)} cm`;
export const fmtT = (b) => `${b.toFixed(3)} T`;
