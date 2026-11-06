// Which ions are possible at a nominal m/z, and the helper texts about them. PURE.
// CANDIDATE FORMULAS. For a molecule CcHhOo, the ion CxHyOz+ at nominal m/z is listed when x <= c, y <= h, z <= o, 12x + y + 16z = m/z, and the electron count
// is consistent (even-electron cations have odd y, radical cations even y; degrees of unsaturation >= 0). This is only a bookkeeping check on the FORMULA: it does
// not say that every listed ion forms. The simulation animates only the verified pathway, never claims the others are excluded.
import { parseFormula } from "../physics/isotopes.js";

const SUB = "₀₁₂₃₄₅₆₇₈₉";
const fmt = (x, y, z) => `${x ? `C${x > 1 ? String(x).replace(/\d/g, (d) => SUB[d]) : ""}` : ""}${y ? `H${y > 1 ? String(y).replace(/\d/g, (d) => SUB[d]) : ""}` : ""}${z ? `O${z > 1 ? String(z).replace(/\d/g, (d) => SUB[d]) : ""}` : ""}`;
export function candidateIons(comp, mz) {
  const f = parseFormula(comp); const C = f.C ?? 0; const H = f.H ?? 0; const O = f.O ?? 0; const out = [];
  for (let x = 0; x <= C; x += 1) for (let z = 0; z <= O; z += 1) {
    const y = mz - 12 * x - 16 * z; if (y < 0 || y > H || (x === 0 && z === 0)) continue;
    const radical = y % 2 === 0; const dbe = radical ? (2 * x + 2 - y) / 2 : (2 * x + 1 - y) / 2; if (dbe < 0) continue;
    out.push({ x, y, z, plain: `${x ? `C${x > 1 ? x : ""}` : ""}${y ? `H${y > 1 ? y : ""}` : ""}${z ? `O${z > 1 ? z : ""}` : ""}`, formula: fmt(x, y, z), radical, label: `${fmt(x, y, z)}${radical ? "⁺•" : "⁺"}` });
  }
  return out;
}
/** One-sentence advice for a clicked peak: what it is, without claiming uniqueness. */
export function peakStory(exp, mz) {
  const pk = exp.spec.byMz[mz]; if (!pk) return null;
  const cands = pk.derived ? [] : candidateIons(exp.spec.comp, mz);
  const named = pk.label;
  const multi = cands.length > 1;
  return { pk, cands, named, multi };
}

const AR = { H: 1.008, C: 12.011, O: 15.999 };
/** relative molecular mass from the formula, with conventional atomic weights (school values, 3 decimals) */
export const relativeMolecularMass = (comp) => { const f = parseFormula(comp); return Object.entries(f).reduce((s, [el, n]) => s + (AR[el] ?? 0) * n, 0); };
