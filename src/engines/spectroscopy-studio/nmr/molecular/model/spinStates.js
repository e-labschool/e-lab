// Neighbouring-spin-state counting: WHY a signal splits. PURE (no React). Tested by scripts/test-nmr-steps.mjs.
//
// A neighbouring 1H nucleus is in the alpha or the beta state (about half each: the population difference is ~3e-5). Each neighbour
// therefore adds or subtracts J/2 to the frequency of the observed nucleus, so every combination of neighbour states gives one line
// position, and the intensity of that line is the NUMBER of combinations that give it (all combinations are equally likely).
// This module really enumerates the 2^n combinations; it does not copy Pascal's triangle.
//
// Sign convention (arbitrary, stated in the UI): a neighbour in alpha shifts the line by +J/2, one in beta by -J/2. Which side of
// the multiplet is which depends on the sign of J; the spacing J and the statistical weights do not.

/** All 2^n combinations: [{ states: [+1 (alpha) | -1 (beta)], offsetHz }]. n is limited to 10 (1024 combinations). */
export function enumerateSpinStates(spins) {
  const n = spins.length;
  if (n > 10) throw new Error("enumerateSpinStates: at most 10 neighbouring spins");
  const out = [];
  for (let mask = 0; mask < 2 ** n; mask += 1) {
    const states = []; let off = 0;
    for (let i = 0; i < n; i += 1) { const s = mask & (1 << i) ? -1 : 1; states.push(s); off += (s * spins[i].J) / 2; }
    out.push({ states, offsetHz: off });
  }
  return out;
}

/**
 * Combinations grouped by line position (highest frequency first):
 *   [{ offsetHz, count (number of combinations), weight (= count / 2^n, the relative area), nAlpha (when all J are equal), examples: [states...] }]
 */
export function groupSpinStates(spins) {
  const all = enumerateSpinStates(spins);
  const groups = new Map();
  for (const c of all) {
    const key = Math.round(c.offsetHz * 1e6);
    const g = groups.get(key) ?? { offsetHz: c.offsetHz, count: 0, combos: [] };
    g.count += 1; g.combos.push(c.states); groups.set(key, g);
  }
  const total = all.length;
  const sameJ = spins.every((s) => Math.abs(s.J - spins[0].J) < 1e-9);
  return [...groups.values()].sort((a, b) => b.offsetHz - a.offsetHz).map((g) => ({
    offsetHz: g.offsetHz, count: g.count, weight: g.count / total, combos: g.combos,
    nAlpha: sameJ ? g.combos[0].filter((s) => s > 0).length : null,
  }));
}

/** Intensities (counts) from left to right, e.g. [1, 3, 3, 1] for three equivalent neighbours. */
export const spinStateCounts = (spins) => groupSpinStates(spins).map((g) => g.count);

/** n equivalent neighbours with the same J (convenience for the n = 1, 2, 3 demonstration). */
export const equivalentNeighbours = (n, J = 7) => Array.from({ length: n }, () => ({ J }));

/** A short combination label such as "↑↓↑" (alpha = up, beta = down; for display only). */
export const comboLabel = (states) => states.map((s) => (s > 0 ? "↑" : "↓")).join("");
export const comboAria = (states) => states.map((s) => (s > 0 ? "alpha" : "beta")).join(", ");
