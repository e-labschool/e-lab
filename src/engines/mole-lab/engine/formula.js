// Chemical-formula parsing and typography.  Pure.
import { sup } from "./numeric.js";
import { isElement } from "./elements.js";

/** "Mg(OH)2" -> { Mg: 1, O: 2, H: 2 }.  Throws on malformed input or unknown elements (never guesses). */
export function parseFormula(formula) {
  const s = String(formula).trim();
  if (!s) throw new Error("Empty formula");
  let i = 0;
  function readNumber() {
    let j = i; while (j < s.length && s[j] >= "0" && s[j] <= "9") j += 1;
    if (j === i) return 1;
    const v = Number(s.slice(i, j)); i = j; return v;
  }
  function group(closing) {
    const counts = {};
    while (i < s.length) {
      const ch = s[i];
      if (ch === "(") {
        i += 1; const inner = group(")");
        const k = readNumber();
        for (const [e, c] of Object.entries(inner)) counts[e] = (counts[e] || 0) + c * k;
      } else if (ch === ")") {
        if (closing !== ")") throw new Error(`Unbalanced ")" in "${s}"`);
        i += 1; return counts;
      } else if (/[A-Z]/.test(ch)) {
        let sym = ch; i += 1;
        if (i < s.length && /[a-z]/.test(s[i])) { sym += s[i]; i += 1; }
        if (!isElement(sym)) throw new Error(`Unknown element "${sym}" in "${s}"`);
        counts[sym] = (counts[sym] || 0) + readNumber();
      } else throw new Error(`Unexpected "${ch}" in "${s}"`);
    }
    if (closing === ")") throw new Error(`Missing ")" in "${s}"`);
    return counts;
  }
  return group(null);
}

const SUBS = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉" };
/** "H2O" -> "H₂O". */
export const toUnicodeFormula = (f) => String(f).replace(/[0-9]/g, (d) => SUBS[d]);
/** Charge as superscript text: (+1) "⁺", (2) "²⁺", (-1) "⁻". */
export function chargeText(charge) {
  if (!charge) return "";
  const m = Math.abs(charge); return sup(`${m === 1 ? "" : m}${charge > 0 ? "+" : "-"}`);
}
/** Ion label like "Na⁺", "OH⁻", "O²⁻". */
export const ionLabel = (formula, charge) => `${toUnicodeFormula(formula)}${chargeText(charge)}`;
/** Total number of atoms in a composition map. */
export const atomTotal = (comp) => Object.values(comp).reduce((a, b) => a + b, 0);
/** Hill-ish deterministic string of a composition: "H2O" order of keys as given. */
export const compositionString = (comp) => Object.entries(comp).map(([e, c]) => `${e}${c === 1 ? "" : c}`).join("");
