// Atom pairs offered by "Inside a Covalent Bond" (pure).
import { elementBond, PAULING } from "../../shared-3d/electronCloud/electronegativity.js";
export const BOND_PAIRS = [
  { id: "H-H", a: "H", b: "H", label: "H₂" }, { id: "Cl-Cl", a: "Cl", b: "Cl", label: "Cl₂" }, { id: "H-Cl", a: "H", b: "Cl", label: "HCl" },
  { id: "H-F", a: "H", b: "F", label: "HF" }, { id: "H-Br", a: "H", b: "Br", label: "HBr" }, { id: "O-H", a: "H", b: "O", label: "O–H (in H₂O)" },
  { id: "N-H", a: "H", b: "N", label: "N–H (in NH₃)" }, { id: "C-O", a: "C", b: "O", label: "C–O" }, { id: "C-H", a: "C", b: "H", label: "C–H (in CH₄)" },
];
export const pairById = (id) => BOND_PAIRS.find((p) => p.id === id) ?? BOND_PAIRS[2];
/** Everything the three views show for a pair. */
export function describePair(p) {
  const b = elementBond(p.a, p.b);
  return { ...b, enA: PAULING[p.a], enB: PAULING[p.b], plus: b.equal ? null : b.less, minus: b.equal ? null : b.more,
    summary: b.equal ? "Symmetric electron distribution (non-polar bond)" : "Asymmetric electron distribution (polar bond)" };
}
