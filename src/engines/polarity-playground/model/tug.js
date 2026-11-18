// Electron Tug-of-War model (pure): free-play values, real-atom pairs, the predict-then-reveal step, and smooth animation helpers.
import { PAULING, REAL_ATOMS, NAMES, tugState, FREE_RANGE, round2, elementBond } from "../../shared-3d/electronCloud/electronegativity.js";

export { REAL_ATOMS, FREE_RANGE, PAULING, NAMES };
export const realValue = (el) => PAULING[el];
export const FREE_DEFAULT = { enA: 2.2, enB: 3.2 };

/** Slider value -> a legal free-play value (clamped to the Pauling span, one decimal). */
export const clampFree = (v) => Math.round(Math.min(FREE_RANGE.max, Math.max(FREE_RANGE.min, Number(v) || FREE_RANGE.min)) * 10) / 10;

/** Result panel content for the current pair: { moreEN label, dEN text, bond type, signs }. */
export function resultOf(labelA, labelB, enA, enB) {
  const t = tugState(enA, enB);
  return {
    ...t, dENText: t.dEN.toFixed(2),
    more: t.equal ? "Neither: equal sharing" : t.winner === "A" ? labelA : labelB,
    plus: t.equal ? null : t.winner === "A" ? labelB : labelA,
    minus: t.equal ? null : t.winner === "A" ? labelA : labelB,
    bondType: t.equal ? "Non-polar covalent" : t.kind === "slightly polar" ? "Slightly polar covalent" : t.kind === "polar" ? "Polar covalent" : "Very polar covalent (strong ionic character)",
  };
}
/** Prediction step for Real Atom Mode. choice: "A" | "B" | "equal". */
export function judgePrediction(a, b, choice) {
  const bond = elementBond(a, b); const right = bond.equal ? "equal" : bond.enA > bond.enB ? "A" : "B";
  const nm = (x) => `${NAMES[x] ?? x} (${x})`;
  const why = bond.equal ? `${a} and ${b} have the same electronegativity (${bond.enA.toFixed(2)}), so the pair is shared equally.`
    : `${nm(bond.more)} has the higher electronegativity (${PAULING[bond.more].toFixed(2)} against ${PAULING[bond.less].toFixed(2)}), so it attracts the shared electrons more strongly.`;
  return { correct: choice === right, right, text: why };
}
/** Exponential approach of `cur` towards `target` (rate per second); snaps when reduced motion or already very close. */
export function approach(cur, target, dt, { rate = 3.2, reduced = false } = {}) {
  if (reduced || Math.abs(target - cur) < 5e-4) return target;
  return cur + (target - cur) * (1 - Math.exp(-rate * dt));
}
export { tugState, round2, elementBond };
