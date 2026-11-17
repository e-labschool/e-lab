// Tiny SMILES reader used as the INDEPENDENT oracle for the curated library: every library structure is written by hand as a
// SMILES string (bonds -, =, #; branches; [bracket atoms] with explicit charge and H count; organic-subset atoms get implicit H).
// The reader then COMPUTES lone pairs from the electron count of each written atom (valence - formal charge - bonds), so the
// library does not depend on the resolver's own search, and the two can be compared.  Pure.
import { lewisElement } from "./data.js";
import { finalizeStructure } from "./resolve.js";

/** Standard SMILES default valences for unbracketed atoms (implicit H fill to the lowest listed valence >= bond sum). */
const DEFAULT_VALENCE = { B: [3], C: [4], N: [3, 5], O: [2], P: [3, 5], S: [2, 4, 6], F: [1], Cl: [1], Br: [1], I: [1] };

export function parseSmiles(smiles) {
  const atoms = []; // { sym, formal, bracket, hCount }
  const bonds = []; // [i, j, order]
  const stack = []; let prev = -1; let order = 1; let i = 0;
  const addAtom = (a) => { atoms.push(a); const k = atoms.length - 1; if (prev >= 0) bonds.push([prev, k, order]); prev = k; order = 1; return k; };
  while (i < smiles.length) {
    const c = smiles[i];
    if (c === "(") { stack.push(prev); i += 1; continue; }
    if (c === ")") { if (!stack.length) throw new Error(`unmatched ) in ${smiles}`); prev = stack.pop(); i += 1; continue; }
    if (c === "-") { order = 1; i += 1; continue; }
    if (c === "=") { order = 2; i += 1; continue; }
    if (c === "#") { order = 3; i += 1; continue; }
    if (c === "[") {
      const end = smiles.indexOf("]", i);
      if (end < 0) throw new Error(`unclosed [ in ${smiles}`);
      const body = smiles.slice(i + 1, end);
      const m = /^([A-Z][a-z]?)(?:H(\d*))?(\+\d*|\++|-\d*|-+)?$/.exec(body);
      if (!m) throw new Error(`cannot read [${body}] in ${smiles}`);
      let formal = 0;
      if (m[3]) { const t = m[3]; const sign = t[0] === "+" ? 1 : -1; const digits = t.slice(1); formal = sign * (/^\d+$/.test(digits) ? Number(digits) : 1 + digits.length); }
      const hCount = m[2] === undefined ? 0 : m[2] === "" ? 1 : Number(m[2]);
      addAtom({ sym: m[1], formal, bracket: true, hCount });
      i = end + 1; continue;
    }
    const two = smiles.slice(i, i + 2);
    if (two === "Cl" || two === "Br") { addAtom({ sym: two, formal: 0, bracket: false, hCount: 0 }); i += 2; continue; }
    if (/[BCNOPSFI]/.test(c)) { addAtom({ sym: c, formal: 0, bracket: false, hCount: 0 }); i += 1; continue; }
    if (/\d/.test(c)) throw new Error("ring closures are not used in the library");
    throw new Error(`unexpected ${c} in ${smiles}`);
  }
  if (stack.length) throw new Error(`unclosed ( in ${smiles}`);
  // hydrogens: explicit counts in brackets, implicit for unbracketed organic-subset atoms
  const heavyCount = atoms.length;
  for (let k = 0; k < heavyCount; k += 1) {
    const a = atoms[k];
    const sum = bonds.reduce((n, b) => n + (b[0] === k || b[1] === k ? b[2] : 0), 0);
    let h = a.hCount;
    if (!a.bracket) {
      const vals = DEFAULT_VALENCE[a.sym] ?? [];
      const v = vals.find((x) => x >= sum);
      h = v === undefined ? 0 : v - sum;
    }
    for (let t = 0; t < h; t += 1) { atoms.push({ sym: "H", formal: 0, bracket: true, hCount: 0 }); bonds.push([k, atoms.length - 1, 1]); }
  }
  const n = atoms.length;
  const lonePairs = []; const radicals = [];
  for (let k = 0; k < n; k += 1) {
    const el = lewisElement(atoms[k].sym);
    if (!el) throw new Error(`unknown element ${atoms[k].sym}`);
    const b = bonds.reduce((s, x) => s + (x[0] === k || x[1] === k ? x[2] : 0), 0);
    const nb = el.valence - atoms[k].formal - b;
    if (nb < 0) throw new Error(`${atoms[k].sym}#${k} in ${smiles} has more bonds than electrons`);
    radicals.push(nb % 2); lonePairs.push((nb - (nb % 2)) / 2);
  }
  const s = {
    atoms: atoms.map((a) => a.sym), bonds: bonds.map(([i2, j, o]) => [Math.min(i2, j), Math.max(i2, j), o]).sort((a, b) => a[0] - b[0] || a[1] - b[1]),
    lonePairs, radicals, formal: atoms.map((a) => a.formal), charge: atoms.reduce((x, a) => x + a.formal, 0),
  };
  return finalizeStructure(s);
}
