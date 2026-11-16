// Student-facing explanations for the titration pair (pure text; every number comes from the model).
import { formatPH } from "../../../lib/acidbase/format.js";

export function explainPair(t) {
  const eq = formatPH(t.eq.pH);
  if (!t.buffer && (t.kind === "WA-SB" || t.kind === "SA-WB")) {
    const weakAcidTitrant = t.kind === "WA-SB";
    return { title: `Strong ${weakAcidTitrant ? "base" : "acid"} titrated with a weak ${weakAcidTitrant ? "acid" : "base"}: no buffer region before equivalence`, text: `The flask starts with a strong ${weakAcidTitrant ? "base" : "acid"} and the weak titrant is used up as it enters, so nothing in the flask can resist change until equivalence. The equivalence pH is ${eq} (${t.eq.pH > 7 ? "above" : "below"} 7) because the salt left is a weak ${weakAcidTitrant ? "base" : "acid"}. The jump is only ${t.steep.jump.toFixed(1)} units within \u00B11% of Veq.` };
  }
  switch (t.kind) {
    case "SA-SB":
      return { title: "Strong acid + strong base: no buffer region", text: `Nothing in the flask can replace the H⁺ or OH⁻ that is used up, so the pH creeps up slowly and then jumps by about ${t.steep.jump.toFixed(1)} units within ±1% of the equivalence volume. The salt does not hydrolyse, so the equivalence pH is exactly ${eq} (neutral) at 298 K.` };
    case "WA-SB":
      return { title: "Weak acid + strong base: buffer region, equivalence pH above 7", text: `OH⁻ turns HA into A⁻, so the flask holds both. Between 1:10 and 10:1 (9% to 91% of Veq) it is a buffer: pH = pKa ± 1. At half-equivalence [HA] = [A⁻], so pH = pKa = ${t.buffer.pKa.toFixed(2)}. At equivalence only A⁻ remains, a weak base, so the pH is ${eq} (above 7).` };
    case "SA-WB":
    case "WB-SA":
      return { title: "Weak base + strong acid: buffer region, equivalence pH below 7", text: `H⁺ turns B into BH⁺, so the flask holds both. Between 1:10 and 10:1 (9% to 91% of Veq) it is a buffer: pH = pKa(NH₄⁺) ± 1 = ${(t.buffer.pKa - 1).toFixed(2)} to ${(t.buffer.pKa + 1).toFixed(2)}. At half-equivalence pH = pKa = ${t.buffer.pKa.toFixed(2)} (pOH = pKb = 4.75). At equivalence only NH₄⁺ remains, a weak acid, so the pH is ${eq} (below 7).` };
    case "WA-WB":
      return { title: "Weak acid + weak base: no sharp equivalence", text: `Either side of equivalence the flask is a buffer (A⁻/HA before, BH⁺/B after), so the pH changes gradually: only ${t.steep.jump.toFixed(1)} units within ±1% of Veq (about 7 for strong + strong). No indicator changes colour sharply; use a pH meter. The equivalence pH (${eq}) depends on pKa and pKb of the pair, so it is close to 7 here by coincidence.` };
    default:
      return { title: "", text: "" };
  }
}

/** Extra note when the weak reagent is the titrant (no buffer before equivalence). */
export function titrantNote(t) {
  if (t.kind === "WA-WB" || t.kind === "SA-SB" || t.buffer) return null;
  return `The ${t.burette.strong ? "" : "weak "}${t.burette.label} is in the burette, so the flask has no weak partner before equivalence: no buffer region there. After equivalence the excess weak titrant and its salt form a buffer, so the curve flattens again.`;
}

export function compareExplanations(set) {
  const by = Object.fromEntries(set.map((s) => [s.id, s.titration]));
  const ss = by["SA-SB"] ?? by["SB-SA"]; const ws = by["WA-SB"] ?? by["WB-SA"]; const ww = by["WA-WB"] ?? by["WB-WA"];
  const out = [
    { id: "ss", title: "Why strong + strong has no buffer region", text: `A buffer needs a weak acid AND its conjugate base in the same solution. In a strong acid–strong base titration the ions present (H⁺ or OH⁻, plus spectator ions) cannot absorb added acid or base, so the pH starts at ${formatPH(ss.initial.pH)}, changes slowly, then jumps by ${ss.steep.jump.toFixed(1)} units within ±1% of Veq. Equivalence pH ${formatPH(ss.eq.pH)}.` },
    { id: "ws", title: "Weak + strong: buffer region, equivalence pH " + (ws.eq.pH > 7 ? "above" : "below") + " 7", text: `Starts at pH ${formatPH(ws.initial.pH)} (a weak ${ws.flaskIsAcid ? "acid" : "base"} is only partly ionised). Buffer region: pH = pKa ± 1, i.e. [salt]/[weak] between 1:10 and 10:1, from 9% to 91% of Veq. Equivalence pH ${formatPH(ws.eq.pH)} because the salt left is a weak ${ws.flaskIsAcid ? "base" : "acid"}. The jump is smaller (${ws.steep.jump.toFixed(1)} units) so the indicator must be chosen carefully.` },
  ];
  if (ww) out.push({ id: "ww", title: "Why weak + weak has no sharp equivalence", text: `Both before and after equivalence the mixture is a buffer, so the pH changes by only ${ww.steep.jump.toFixed(1)} units within ±1% of Veq. There is no steep part for an indicator to sit on.` });
  return out;
}
