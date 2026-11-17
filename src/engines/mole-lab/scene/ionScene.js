// What the microscopic viewer DRAWS for one pane (pure, unit-tested).  The drawing is a pure function of the pane's
// concentration through concLab.js (N = c N_A V_window): the viewer never feeds anything back into the chemistry.
import { viewerPoints, drawnPairs } from "../engine/concLab.js";

export const LATTICE_N = 3; // a 3 x 3 x 3 fragment of the solid (27 ions)

/** Species of ion i (even = cation, odd = anion). */
export const speciesOf = (i) => (i % 2 === 0 ? "cation" : "anion");

/**
 * @param pane { c, state: "empty"|"solid"|"dissolving"|"solution", solidFraction }
 * @returns { ions: [{ x, y, z, species, hydrated }], lattice: [{ x, y, z, species }], pairs }  coordinates in the cube [-1, 1]^3
 */
export function ionScene(pane) {
  const empty = { ions: [], lattice: [], pairs: 0 };
  if (!pane || pane.c == null || pane.state === "empty") return empty;
  const frac = Math.min(1, Math.max(0, pane.solidFraction ?? 0));
  const total = drawnPairs(pane.c);
  const dissolvedPairs = pane.state === "dissolving" ? Math.round(total * (1 - frac)) : total;
  const pts = viewerPoints(dissolvedPairs * 2);
  const ions = pts.map((p, i) => ({ x: p[0], y: p[1], z: p[2], species: speciesOf(i), hydrated: true }));
  const lattice = [];
  if (pane.state === "dissolving" && frac > 0) {
    const n = LATTICE_N; const step = 0.2; const keep = Math.max(1, Math.ceil(n * n * n * frac));
    const all = [];
    for (let k = 0; k < n; k += 1) for (let j = 0; j < n; j += 1) for (let i = 0; i < n; i += 1) all.push({ x: (i - (n - 1) / 2) * step, y: -0.78 + k * step, z: (j - (n - 1) / 2) * step, species: (i + j + k) % 2 === 0 ? "cation" : "anion", order: k * 100 + j * 10 + i });
    all.sort((a, b) => a.order - b.order); // the top layers dissolve first
    lattice.push(...all.slice(0, keep).map(({ order, ...r }) => r));
  }
  return { ions, lattice, pairs: dissolvedPairs };
}
