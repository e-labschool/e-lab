// Text helpers for formulas and charges (Unicode sub / superscripts). Pure.
const SUB = "₀₁₂₃₄₅₆₇₈₉";
const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
export const toSub = (n) => String(n).replace(/\d/g, (d) => SUB[Number(d)]);
export const toSup = (n) => String(n).replace(/\d/g, (d) => SUP[Number(d)]);
/** 2 -> "²⁺", -1 -> "⁻", 0 -> "". */
export const chargeSup = (q) => (!q ? "" : `${Math.abs(q) > 1 ? toSup(Math.abs(q)) : ""}${q > 0 ? "⁺" : "⁻"}`);
/** ASCII charge for ids and aria text: 2 -> "2+", -1 -> "-". */
export const chargePlain = (q) => (!q ? "" : q > 0 ? (q === 1 ? "+" : `${q}+`) : q === -1 ? "-" : `${-q}-`);
/** "SO4 2-" / "NH4+" / "CH3COOH" -> "SO₄²⁻" / "NH₄⁺" / "CH₃COOH". */
export function prettyFormula(id) {
  const m = /^(.*?)(?:\s+(\d+)([+-])|([+-]))$/.exec(id); // "SO4 2-" (number after a space) or "NH4+" / "OH-" (single charge)
  const body = m ? m[1] : id;
  let charge = "";
  if (m) { const mag = m[2] ? Number(m[2]) : 1; const sign = (m[3] ?? m[4]) === "+" ? 1 : -1; charge = chargeSup(sign * mag); }
  return body.replace(/\d+/g, (d) => toSub(d)) + charge;
}
/** Hill-style formula from a symbol list: C first, then H, then the rest alphabetically (no C: all alphabetical). */
export function hillFormula(symbols, charge = 0) {
  const counts = {};
  for (const s of symbols) counts[s] = (counts[s] ?? 0) + 1;
  const keys = Object.keys(counts);
  const order = counts.C ? ["C", ...(counts.H ? ["H"] : []), ...keys.filter((k) => k !== "C" && k !== "H").sort()] : keys.sort();
  return order.map((k) => `${k}${counts[k] > 1 ? toSub(counts[k]) : ""}`).join("") + chargeSup(charge);
}
/** Order-independent key for a composition ("C1 O2", with the charge): used to look a placed set of atoms up in the library. */
export function compositionKey(symbols, charge = 0) {
  const counts = {};
  for (const s of symbols) counts[s] = (counts[s] ?? 0) + 1;
  return `${Object.keys(counts).sort().map((k) => `${k}${counts[k]}`).join(" ")}|${charge}`;
}
/** Chemistry-textbook formula for a composition when it is not in the library: Hill order for carbon compounds, H first for acids and hydrides of O / S / halogens, else least electronegative first. */
export function conventionalFormula(symbols, charge, en) {
  const counts = {};
  for (const s of symbols) counts[s] = (counts[s] ?? 0) + 1;
  const keys = Object.keys(counts);
  const put = (k) => `${k}${counts[k] > 1 ? toSub(counts[k]) : ""}`;
  let order;
  if (counts.C) return hillFormula(symbols, charge);
  const others = keys.filter((k) => k !== "H");
  const acidLike = counts.H && (others.every((k) => ["O", "S", "F", "Cl", "Br", "I"].includes(k)) || (counts.O && others.length > 1));
  if (acidLike) order = ["H", ...others.sort((a, b) => (en[a] ?? 0) - (en[b] ?? 0)).filter((k) => k !== "O"), ...(counts.O ? ["O"] : [])];
  else order = keys.sort((a, b) => (a === "H" ? 1 : b === "H" ? -1 : (en[a] ?? 0) - (en[b] ?? 0) || a.localeCompare(b)));
  return order.map(put).join("") + chargeSup(charge);
}
