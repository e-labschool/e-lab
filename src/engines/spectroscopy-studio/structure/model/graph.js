// Molecular-graph analysis for the Structure Investigation tab. PURE (no React).
//
// Every structure is a small hydrogen-suppressed graph (heavy atoms C and O with 2D coordinates for the skeletal drawing, and bonds with orders).
// Everything chemical that the tab states about a structure is DERIVED from that graph, so a data entry can never disagree with the drawing:
//   * implicit hydrogens (from valence), molecular formula (Hill order), nominal and average molar mass, degree of unsaturation;
//   * topological equivalence classes of the heavy atoms (Morgan-style refinement) -> the distinct ¹H environments;
//   * the first-order splitting each environment should show (n+1 rule; neighbours = H on adjacent carbons in a DIFFERENT class;
//     exchangeable O–H protons neither split nor are split);
//   * the characteristic IR groups that are present;
//   * a typical chemical-shift RANGE for every environment, from simple substituent rules (booklet-style ranges, see shiftRangeOf).
// The derivation is deliberately simple (first order, topological symmetry only, no stereochemistry): it is valid for the small acyclic CHO
// molecules of this tab. Diastereotopic protons of rings and C=C are NOT resolved (the structures that have them are used only as distractors).

export const ELEMENTS = Object.freeze({
  C: { valence: 4, nominal: 12, avg: 12.011 },
  H: { valence: 1, nominal: 1, avg: 1.008 },
  O: { valence: 2, nominal: 16, avg: 15.999 },
});
const SUB = "₀₁₂₃₄₅₆₇₈₉";
export const toSub = (s) => String(s).replace(/\d/g, (d) => SUB[d]);

export const DEFAULT_J = 7.0; // Hz, freely rotating alkyl H–C–C–H (typical 6–8 Hz)
export const ALDEHYDE_J = 1.5; // Hz, H–C(=O)–C–H (small, about 1–3 Hz)

/** Formula object -> Hill string without subscripts ("C2H6O"). */
export function hillFormula(counts) {
  const parts = [];
  for (const el of ["C", "H"]) if (counts[el]) parts.push(el + (counts[el] > 1 ? counts[el] : ""));
  for (const el of Object.keys(counts).filter((e) => e !== "C" && e !== "H").sort()) if (counts[el]) parts.push(el + (counts[el] > 1 ? counts[el] : ""));
  return parts.join("");
}

/** def: { atoms: [{id, el, x, y}], bonds: [[idA, idB, order]] } -> analysed graph. Throws on a valence error. */
export function analyse(def) {
  const idx = new Map(def.atoms.map((a, i) => [a.id, i]));
  if (idx.size !== def.atoms.length) throw new Error("duplicate atom id");
  const n = def.atoms.length;
  const bonds = def.bonds.map(([a, b, order]) => {
    if (!idx.has(a) || !idx.has(b)) throw new Error(`unknown atom in bond ${a}-${b}`);
    return { a: idx.get(a), b: idx.get(b), order };
  });
  const adj = Array.from({ length: n }, () => []);
  const used = new Array(n).fill(0);
  for (const b of bonds) { adj[b.a].push({ j: b.b, order: b.order }); adj[b.b].push({ j: b.a, order: b.order }); used[b.a] += b.order; used[b.b] += b.order; }
  const atoms = def.atoms.map((a, i) => {
    const h = ELEMENTS[a.el].valence - used[i];
    if (h < 0) throw new Error(`valence exceeded on ${a.id}`);
    return { ...a, i, h, nb: adj[i] };
  });
  const counts = {};
  for (const a of atoms) { counts[a.el] = (counts[a.el] ?? 0) + 1; counts.H = (counts.H ?? 0) + a.h; }
  const nominal = Object.entries(counts).reduce((s, [el, k]) => s + k * ELEMENTS[el].nominal, 0);
  const molarMass = Object.entries(counts).reduce((s, [el, k]) => s + k * ELEMENTS[el].avg, 0);
  const C = counts.C ?? 0; const H = counts.H ?? 0;
  const dou = (2 * C + 2 - H) / 2;
  const g = { atoms, bonds, idx, counts, formula: hillFormula(counts), nominal, molarMass, dou };
  g.classOf = classes(g);
  return g;
}

const bondOrderBetween = (g, i, j) => g.atoms[i].nb.find((x) => x.j === j)?.order ?? 0;
/** carbonyl carbon: C with a double bond to O */
export const isCarbonylC = (g, i) => g.atoms[i].el === "C" && g.atoms[i].nb.some((x) => x.order === 2 && g.atoms[x.j].el === "O");
/** hydroxyl O (bears H) */
const isHydroxylO = (g, i) => g.atoms[i].el === "O" && g.atoms[i].h > 0;

/** Morgan-style equivalence classes of the heavy atoms: class id per atom (atoms with the same id are topologically equivalent). */
function classes(g) {
  let label = g.atoms.map((a) => `${a.el}|${a.h}|${a.nb.length}|${a.nb.map((x) => x.order).sort().join("")}`);
  const compress = (labs) => { const m = new Map(); return labs.map((l) => { if (!m.has(l)) m.set(l, m.size); return m.get(l); }); };
  let ids = compress(label); let count = new Set(ids).size;
  for (let it = 0; it < g.atoms.length + 2; it += 1) {
    label = g.atoms.map((a, i) => `${ids[i]}[${a.nb.map((x) => `${x.order}:${ids[x.j]}`).sort().join(",")}]`);
    const next = compress(label); const c = new Set(next).size;
    ids = next;
    if (c === count) break;
    count = c;
  }
  return ids;
}

// ---------------------------------------------------------------- IR groups present
/** IR groups of the characteristic-range table (ids of ir/physics/functionalGroups.js) that the structure contains. */
export function irGroupsOf(g) {
  const out = new Set();
  for (const a of g.atoms) {
    if (a.el === "C" && a.h > 0 && a.nb.every((x) => x.order === 1)) out.add("ch");
    if (a.el === "O" && a.h > 0) {
      const c = a.nb.find((x) => g.atoms[x.j].el === "C")?.j;
      out.add(c !== undefined && isCarbonylC(g, c) ? "oh-acid" : "oh-alc");
    }
    if (isCarbonylC(g, a.i)) {
      out.add("cdo");
      if (a.h > 0 && !a.nb.some((x) => x.order === 1 && g.atoms[x.j].el === "O")) out.add("aldch");
    }
  }
  for (const b of g.bonds) {
    const ea = g.atoms[b.a].el; const eb = g.atoms[b.b].el;
    if (b.order === 1 && ((ea === "C" && eb === "O") || (ea === "O" && eb === "C"))) out.add("co");
    if (b.order === 2 && ea === "C" && eb === "C") out.add("cdc");
  }
  return out;
}

// ---------------------------------------------------------------- 1H environments
/**
 * Typical chemical-shift range (ppm) of the hydrogens on heavy atom i, from the substituents (IB data-booklet style ranges, widened to cover the usual spread).
 * Returns { lo, hi, kind }. Rules (first match wins):
 *   O–H of a carboxylic acid 10–13 · other O–H 1–6 (variable)
 *   C(=O)–H with no single-bonded O: aldehyde 9.4–10.0 · C(=O)(–O)–H formate 7.8–8.4
 *   sp² C–H of C=C 4.5–6.5
 *   sp³ C–H with an O substituent: ester O 3.6–4.3 · alcohol/ether O 3.2–4.2
 *   sp³ C–H next to C=O 2.0–2.7 · allylic 1.6–2.4
 *   alkyl: CH₃ 0.8–1.4 · CH₂ 1.2–1.9 · CH 1.3–2.2
 */
export function shiftRangeOf(g, i) {
  const a = g.atoms[i];
  if (a.el === "O") {
    const c = a.nb.find((x) => g.atoms[x.j].el === "C")?.j;
    return c !== undefined && isCarbonylC(g, c) ? { lo: 10, hi: 13, kind: "acid O–H" } : { lo: 1, hi: 6, kind: "O–H" };
  }
  if (isCarbonylC(g, i)) {
    return a.nb.some((x) => x.order === 1 && g.atoms[x.j].el === "O") ? { lo: 7.8, hi: 8.4, kind: "formate H" } : { lo: 9.4, hi: 10.0, kind: "aldehyde H" };
  }
  if (a.nb.some((x) => x.order === 2)) return { lo: 4.5, hi: 6.5, kind: "vinylic H" };
  const oN = a.nb.find((x) => g.atoms[x.j].el === "O");
  if (oN) {
    const ester = g.atoms[oN.j].nb.some((y) => y.j !== i && isCarbonylC(g, y.j));
    return ester ? { lo: 3.6, hi: 4.3, kind: "ester O–C–H" } : { lo: 3.2, hi: 4.2, kind: "O–C–H" };
  }
  if (a.nb.some((x) => isCarbonylC(g, x.j))) return { lo: 2.0, hi: 2.7, kind: "C(=O)–C–H" };
  if (a.nb.some((x) => g.atoms[x.j].nb.some((y) => y.order === 2 && g.atoms[y.j].el === "C"))) return { lo: 1.6, hi: 2.4, kind: "allylic" };
  return a.h === 3 ? { lo: 0.8, hi: 1.4, kind: "CH₃" } : a.h === 2 ? { lo: 1.2, hi: 1.9, kind: "CH₂" } : { lo: 1.3, hi: 2.2, kind: "CH" };
}

const MULT = ["singlet", "doublet", "triplet", "quartet", "quintet", "sextet", "septet", "octet", "nonet"];
const MULT_ABBR = ["s", "d", "t", "q", "quint", "sext", "sept", "oct", "non"];
const PLURAL = (name) => `${name}s`;
export const multName = (nH) => MULT[nH] ?? "multiplet";
export const multAbbr = (nH) => MULT_ABBR[nH] ?? "m";

/** Name a multiplet from its neighbour sets [{nH, J}] (all-equal J: n+1 rule; otherwise "quartet of doublets" with the largest J first). */
export function describeMultiplicity(sets) {
  const total = sets.reduce((s, x) => s + x.nH, 0);
  if (total === 0) return { name: "singlet", abbr: "s", total, lines: 1, nPlusOne: true, equalJ: true };
  const J0 = sets[0].J;
  if (sets.every((s) => Math.abs(s.J - J0) < 1e-9)) {
    const name = MULT[total] ?? "multiplet"; const lines = total + 1;
    return { name: sets.length > 1 ? `${name} (apparent)` : name, shortName: name, abbr: MULT_ABBR[total] ?? "m", total, lines, nPlusOne: true, equalJ: true };
  }
  const ord = [...sets].sort((p, q) => q.J - p.J || q.nH - p.nH);
  const parts = ord.map((s) => MULT[s.nH] ?? "multiplet");
  const name = parts.length === 2 ? `${parts[0]} of ${PLURAL(parts[1])}` : `${parts.join(" of ")}`;
  const lines = ord.reduce((p, s) => p * (s.nH + 1), 1);
  return { name, shortName: name, abbr: ord.map((s) => MULT_ABBR[s.nH] ?? "m").join(""), total, lines, nPlusOne: false, equalJ: false };
}

/**
 * The distinct ¹H environments of the structure.
 * { cls, atoms: [heavy indices], hPer, n (hydrogens), exchangeable, el, neighbours: [{cls, count, nH, J}], mult, shift: {lo, hi, kind} }
 */
export function environmentsOf(g) {
  const byCls = new Map();
  for (const a of g.atoms) if (a.h > 0) {
    const c = g.classOf[a.i];
    if (!byCls.has(c)) byCls.set(c, []);
    byCls.get(c).push(a.i);
  }
  const envs = [];
  for (const [cls, list] of byCls) {
    const i0 = list[0]; const a0 = g.atoms[i0];
    const exchangeable = a0.el === "O";
    const nbCls = new Map();
    if (!exchangeable) {
      for (const x of a0.nb) {
        const b = g.atoms[x.j];
        if (b.el !== "C" || b.h === 0 || g.classOf[x.j] === cls) continue;
        const k = g.classOf[x.j];
        const J = isCarbonylC(g, x.j) || isCarbonylC(g, i0) ? ALDEHYDE_J : DEFAULT_J;
        const cur = nbCls.get(k) ?? { cls: k, count: 0, hPer: b.h, J };
        cur.count += 1; nbCls.set(k, cur);
      }
    }
    const neighbours = [...nbCls.values()].map((s) => ({ cls: s.cls, count: s.count, nH: s.count * s.hPer, J: s.J }));
    envs.push({
      cls, atoms: list, hPer: a0.h, n: list.length * a0.h, exchangeable, el: a0.el, neighbours,
      mult: exchangeable ? { name: "singlet", shortName: "singlet", abbr: "s", total: 0, lines: 1, nPlusOne: true, equalJ: true, broad: true } : describeMultiplicity(neighbours),
      shift: shiftRangeOf(g, i0),
    });
  }
  return envs;
}

/** Formula string with subscripts: "C2H6O" -> "C₂H₆O". */
export const prettyFormula = (f) => toSub(f);

/** Sum of H over the environments (must equal the formula's H). */
export const totalH = (envs) => envs.reduce((s, e) => s + e.n, 0);
export { bondOrderBetween, isHydroxylO };
