// Core relationship: pH = -log10([H3O+]). We treat pH as the primary,
// continuous state (0-14) since a slider that's linear in pH is exactly a
// logarithmic slider over concentration — equal slider steps are equal
// factor-of-10 steps in [H3O+], which is the whole teaching point.
export const PH_MIN = 0;
export const PH_MAX = 14;
export const DEFAULT_PH = 3;

export function concentrationFromPH(pH) {
  return Math.pow(10, -pH);
}

export function pHFromConcentration(conc) {
  return -Math.log10(conc);
}

export function clampPH(pH) {
  return Math.min(PH_MAX, Math.max(PH_MIN, pH));
}

export function clampConcentration(conc) {
  return Math.min(1, Math.max(1e-14, conc));
}

const SUPERSCRIPT_DIGITS = { "-": "\u207B", 0: "\u2070", 1: "\u00B9", 2: "\u00B2", 3: "\u00B3", 4: "\u2074", 5: "\u2075", 6: "\u2076", 7: "\u2077", 8: "\u2078", 9: "\u2079" };

function toSuperscript(n) {
  return String(n)
    .split("")
    .map((ch) => SUPERSCRIPT_DIGITS[ch] ?? ch)
    .join("");
}

// Plain decimal string, e.g. 0.001, 0.00001, 0.00000000000001 — always the
// primary representation, per the brief, even for very small values.
export function formatDecimal(value, sigFigs = 3) {
  if (!(value > 0)) return "0";
  const exp = Math.floor(Math.log10(value));
  const decimals = Math.max(0, sigFigs - 1 - exp);
  let str = value.toFixed(Math.min(decimals, 20));
  if (str.includes(".")) str = str.replace(/0+$/, "").replace(/\.$/, "");
  return str;
}

// e.g. "1.0 \u00D7 10\u207B\u00B9\u2074" — a secondary, more precise reading.
export function formatScientific(value, sigFigs = 2) {
  if (!(value > 0)) return "0";
  const [mantissa, exp] = value.toExponential(sigFigs - 1).split("e");
  const expNum = Number(exp);
  return `${mantissa} \u00D7 10${toSuperscript(expNum)}`;
}

export function formatPH(pH) {
  return pH.toFixed(2);
}
