// Notation helpers shared by all atomic-structure simulations. IB convention: charges are written 2+ / 2-
// (number first, sign after) in text; the proper minus sign U+2212 is used for display.
const SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻", "−": "⁻" };
export const toSuperscript = (value) => String(value).split("").map((c) => SUP[c] ?? c).join("");

/** Charge as the IB writes it: 0 -> "0", +1 -> "+", 2 -> "2+", -1 -> "−", -3 -> "3−" (with `explicit1` -> "1+"/"1−"). */
export function formatCharge(charge, { explicit1 = false, ascii = false } = {}) {
  if (!Number.isFinite(charge) || charge === 0) return "0";
  const mag = Math.abs(charge);
  const sign = charge > 0 ? "+" : ascii ? "-" : "−";
  return mag === 1 && !explicit1 ? sign : `${mag}${sign}`;
}

/** "Fe²⁺", "O²⁻", "Na⁺", "Ne" using superscript characters. */
export function speciesLabel(symbol, charge) {
  return charge === 0 ? symbol : `${symbol}${toSuperscript(formatCharge(charge))}`;
}
