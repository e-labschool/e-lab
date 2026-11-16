// Bond polarity and molecular polarity at the level the IB DP course uses (S2.2): electronegativity values from the IB data
// booklet (Pauling scale, 1 decimal place), delta-EN of each bond, bond type, and whether the bond dipoles cancel for the
// molecule's shape.  Pure logic.
//   * a bond is "non-polar" when delta-EN is 0 (identical atoms, or equal values), "slightly polar" up to 0.4 (C-H, S-H: the IB
//     usually treats these as non-polar, but the small dipoles still count for the molecule's net dipole), "polar" above that,
//     and "mostly ionic" above 1.8 because the ionic / covalent boundary is a continuum, not a switch.
//   * a molecule is polar when the vector sum of its bond dipoles (direction x delta-EN, from delta+ to delta-) is not zero;
//     lone pairs are not added separately: their effect is already contained in the molecular SHAPE the atoms take.
// Ions have no molecular dipole in this model (the whole ion carries a charge).
export const ELECTRONEGATIVITY = Object.freeze({ H: 2.2, Li: 1.0, Be: 1.6, B: 2.0, C: 2.6, N: 3.0, O: 3.4, F: 4.0, Na: 0.9, Mg: 1.3, Al: 1.6, Si: 1.9, P: 2.2, S: 2.6, Cl: 3.2, Br: 3.0, K: 0.8, Ca: 1.0 });
export const NONPOLAR_MAX = 0.05;
export const SLIGHT_MAX = 0.4;
export const IONIC_MIN = 1.8;
export const round1 = (x) => Math.round(x * 10) / 10;

export function bondPolarity(a, b) {
  const ea = ELECTRONEGATIVITY[a]; const eb = ELECTRONEGATIVITY[b];
  if (ea === undefined || eb === undefined) return null;
  const d = round1(Math.abs(ea - eb));
  const kind = d < NONPOLAR_MAX ? "non-polar" : d <= SLIGHT_MAX ? "slightly polar" : d > IONIC_MIN ? "mostly ionic" : "polar";
  const negative = ea === eb ? null : ea > eb ? a : b; const positive = ea === eb ? null : ea > eb ? b : a;
  return { delta: d, kind, negative, positive };
}

/** Per-bond table for a molecule from model/covalent.js: [{ i, j, a, b, delta, kind, negative, positive }]. */
export function bondTable(m) { return m.bonds.map(([i, j]) => ({ i, j, a: m.atoms[i], b: m.atoms[j], ...bondPolarity(m.atoms[i], m.atoms[j]) })); }

/**
 * Net dipole of a molecule given its drawn structure { atoms:[{pos}], bonds:[{i,j}] }.
 * Returns { vector:[x,y,z], magnitude, polar }; polar when the magnitude exceeds 5 % of the largest bond dipole (cancelling dipoles).
 */
export function netDipole(m, st) {
  if (m.charge) return { vector: [0, 0, 0], magnitude: 0, polar: false, ion: true };
  const v = [0, 0, 0]; let maxD = 0;
  for (const b of bondTable(m)) {
    if (!b.negative || b.kind === "non-polar") continue;
    const from = st.atoms[b.positive === m.atoms[b.i] ? b.i : b.j].pos; const to = st.atoms[b.negative === m.atoms[b.i] ? b.i : b.j].pos;
    const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]]; const l = Math.hypot(...d) || 1;
    for (let k = 0; k < 3; k += 1) v[k] += (d[k] / l) * b.delta; maxD = Math.max(maxD, b.delta);
  }
  const magnitude = Math.hypot(...v);
  return { vector: v, magnitude, polar: maxD > 0 && magnitude > 0.05 * maxD };
}

/** A short, exam-style statement about the molecule's polarity. */
export function polarityStatement(m, st) {
  const table = bondTable(m); const polarBonds = table.filter((b) => b.kind !== "non-polar");
  if (m.charge) return `${m.formula} is an ion: its polarity is described by its overall charge, not a molecular dipole.`;
  if (!polarBonds.length) return "The bonds are non-polar (ΔEN = 0), so the molecule is non-polar.";
  const net = netDipole(m, st);
  const names = [...new Set(polarBonds.map((b) => `${b.a}–${b.b}`))].join(", ");
  const slight = polarBonds.every((b) => b.kind === "slightly polar");
  return net.polar ? `${slight ? "Slightly polar" : "Polar"} bonds (${names}) whose dipoles do not cancel because of the shape: the molecule is ${slight ? "slightly polar (ΔEN ≤ 0.4, often treated as non-polar at this level)" : "polar"}.`
    : `${slight ? "Slightly polar" : "Polar"} bonds (${names}), but the bond dipoles cancel because of the symmetrical shape: the molecule is non-polar.`;
}

/** Partial-charge sign of each atom from its bonds: sum of +delta (towards it) / -delta (away).  sign -1 = delta-, +1 = delta+, 0 = none. */
export function atomPartials(m) {
  const s = m.atoms.map(() => 0);
  for (const b of bondTable(m)) {
    if (!b.negative || b.kind === "non-polar") continue;
    const ni = b.negative === m.atoms[b.i] ? b.i : b.j; const pi = ni === b.i ? b.j : b.i;
    s[ni] -= b.delta; s[pi] += b.delta;
  }
  return s.map((v) => ({ sign: Math.abs(v) < 0.15 ? 0 : v > 0 ? 1 : -1, value: v }));
}
