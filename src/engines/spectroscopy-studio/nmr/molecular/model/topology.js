// Graph-topology analysis of a molecule: symmetry (equivalence) classes of the hydrogens and the H–C–C–H coupling neighbours.
// Used (a) by the tests, which assert that these DERIVED results equal the DECLARED environments/couplings in molecules.js, and
// (b) by the UI to explain WHY hydrogens are equivalent. Pure; no React.
//
// Equivalence here = graph symmetry (Morgan-style colour refinement, which is complete for the acyclic molecules in the library).
// It ignores stereochemistry (diastereotopic H are not distinguished: none occur in the library) and assumes fast rotation about
// single bonds, which is what makes the three H of a CH3 equivalent.

/** Colour refinement. Initial colour = element; refine by the sorted multiset of (bond order, neighbour colour) until stable. */
export function refineColours(mol) {
  let colours = mol.atoms.map((a) => a.el);
  let nClasses = new Set(colours).size;
  const orderOf = (i, j) => mol.bonds.find((b) => (b.a === i && b.b === j) || (b.a === j && b.b === i)).order;
  for (let iter = 0; iter < 50; iter += 1) {
    const sigs = mol.atoms.map((a, i) => `${colours[i]}|${a.neighbours.map((n) => `${orderOf(i, n)}${colours[n]}`).sort().join(",")}`);
    const map = new Map(); const next = sigs.map((s) => { if (!map.has(s)) map.set(s, `c${map.size}`); return map.get(s); });
    const n = new Set(next).size;
    colours = next;
    if (n === nClasses) break;
    nClasses = n;
  }
  return colours;
}

/** Partition of the hydrogens into equivalence classes: array of sorted atom-index arrays, ordered by first member. */
export function hydrogenClasses(mol) {
  const colours = refineColours(mol);
  const groups = new Map();
  for (const a of mol.atoms) if (a.isHydrogen) { if (!groups.has(colours[a.idx])) groups.set(colours[a.idx], []); groups.get(colours[a.idx]).push(a.idx); }
  return [...groups.values()].map((g) => g.sort((x, y) => x - y)).sort((x, y) => x[0] - y[0]);
}

/** Declared environments as the same kind of partition (for comparison). */
export function declaredClasses(mol) {
  return mol.environments.map((e) => [...e.atoms].sort((x, y) => x - y)).sort((x, y) => x[0] - y[0]);
}

const isExchangeableAtom = (mol, h) => Boolean(mol.environments.find((e) => e.atoms.includes(h))?.exchangeable);

/**
 * Hydrogens three bonds away (H–X–Y–H') of hydrogen h. X, Y are heavy atoms. Hydrogens in the same environment are excluded
 * (equivalent nuclei do not split each other) and so are exchangeable (O–H) hydrogens on either side (exchange-decoupled).
 */
export function vicinalNeighbours(mol, h) {
  const X = mol.atoms[h].parent;
  const out = [];
  for (const Y of mol.atoms[X].neighbours) {
    if (mol.atoms[Y].isHydrogen) continue;
    for (const h2 of mol.atoms[Y].hydrogens) {
      if (mol.envOfAtom[h2] === mol.envOfAtom[h]) continue;
      if (isExchangeableAtom(mol, h) || isExchangeableAtom(mol, h2)) continue;
      out.push(h2);
    }
  }
  return out;
}

/** For each environment: { [neighbourEnvId]: number of equivalent neighbouring H (must be identical for every H of the environment) }. */
export function derivedNeighbourCounts(mol) {
  const res = {};
  for (const e of mol.environments) {
    let ref = null;
    for (const h of e.atoms) {
      const counts = {};
      for (const h2 of vicinalNeighbours(mol, h)) { const id = mol.envOfAtom[h2]; counts[id] = (counts[id] ?? 0) + 1; }
      const key = JSON.stringify(Object.entries(counts).sort());
      if (ref === null) ref = { key, counts };
      else if (ref.key !== key) throw new Error(`${mol.id}: hydrogens of environment ${e.id} see different neighbours`);
    }
    res[e.id] = ref ? ref.counts : {};
  }
  return res;
}

/** Declared couplings expanded to the same shape: { envId: { neighbourEnvId: count } } with J lookup. */
export function declaredNeighbourCounts(mol) {
  const res = Object.fromEntries(mol.environments.map((e) => [e.id, {}]));
  const envById = Object.fromEntries(mol.environments.map((e) => [e.id, e]));
  for (const c of mol.couplings) {
    res[c.a][c.b] = envById[c.b].count;
    res[c.b][c.a] = envById[c.a].count;
  }
  return res;
}

export const couplingJ = (mol, envA, envB) => mol.couplings.find((c) => (c.a === envA && c.b === envB) || (c.a === envB && c.b === envA))?.J ?? null;

/** Plain-language reason why the hydrogens of an environment are equivalent (shown in the UI). */
export function equivalenceReason(mol, envId) {
  const e = mol.environments.find((x) => x.id === envId);
  if (!e) return "";
  if (e.count === 1) return e.exchangeable ? "A single exchangeable hydrogen: it has no equivalent partners." : "A single hydrogen: no other H has the same surroundings.";
  const nHeavy = e.heavyAtoms.length;
  if (nHeavy === 1) {
    return `The ${e.count} H are all bonded to the same carbon atom and are exchanged by rapid rotation, so each has exactly the same bonding surroundings.`;
  }
  return `The ${e.count} H sit on ${nHeavy} carbon atoms that are swapped by the molecule's symmetry, and the H on each carbon are exchanged by rotation, so all ${e.count} have identical surroundings.`;
}
