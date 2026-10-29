// Metallic model: metal library facts, lattice generation and coordination (computed from coordinates).
// Pure logic. A metal is represented by its crystal structure at room temperature:
//   Li, Na, K = body-centred cubic (BCC); Ca, Al = face-centred cubic (FCC); Mg = hexagonal close-packed (HCP, ideal c/a).
// The nearest-neighbour distance is normalised to 1.
import { getBondingElement } from "./elements.js";

export const METAL_STRUCTURE = { Na: "bcc", Li: "bcc", K: "bcc", Mg: "hcp", Ca: "fcc", Al: "fcc" };
export const STRUCTURE_LABEL = { bcc: "Body-centred cubic (BCC)", fcc: "Face-centred cubic (FCC)", hcp: "Hexagonal close-packed (HCP)" };
export const EXPECTED_NEIGHBOURS = { bcc: 8, fcc: 12, hcp: 12 };
export const MAX_METAL_ATOMS = 200;
export const ADD_STEPS = [1, 5, 20, 50];

/** Edge length of the conventional cubic cell (nearest-neighbour distance = 1), or null for non-cubic structures. */
export function cubicCellEdge(structure) { return BASES[structure]?.a ?? null; }

/** Valence (delocalised) electrons per atom = outer-shell electrons from the electron-configuration engine. */
export function valenceElectrons(symbol) { return getBondingElement(symbol)?.valence ?? 0; }

const BASES = {
  bcc: { a: 2 / Math.sqrt(3), basis: [[0, 0, 0], [0.5, 0.5, 0.5]] },
  fcc: { a: Math.SQRT2, basis: [[0, 0, 0], [0.5, 0.5, 0], [0.5, 0, 0.5], [0, 0.5, 0.5]] },
};

const TOL = 1e-6;
const DENSITY = { bcc: 2 / (2 / Math.sqrt(3)) ** 3, fcc: 4 / Math.SQRT2 ** 3, hcp: Math.SQRT2 }; // atoms per unit volume (nn = 1)

/** All lattice sites of the infinite crystal inside a cube of half-size `reach` around an atom at the origin (nn distance = 1). */
function crystalSites(structure, reach) {
  const pts = [];
  const inside = (x, y, z) => Math.abs(x) <= reach && Math.abs(y) <= reach && Math.abs(z) <= reach;
  if (structure === "hcp") {
    const c = Math.sqrt(8 / 3); // ideal c/a with a = 1
    const L = Math.ceil(reach / (c / 2)) + 1;
    const I = Math.ceil(reach / 0.5) + 2;
    for (let l = -L; l <= L; l += 1) {
      const odd = ((l % 2) + 2) % 2;
      const sx = odd ? 0.5 : 0; const sy = odd ? Math.sqrt(3) / 6 : 0;
      for (let j = -I; j <= I; j += 1) for (let i = -I - Math.ceil(j / 2); i <= I; i += 1) {
        const x = i + 0.5 * j + sx; const y = (Math.sqrt(3) / 2) * j + sy; const z = (c / 2) * l;
        if (inside(x, y, z)) pts.push({ x, y, z });
      }
    }
    return pts;
  }
  const { a, basis } = BASES[structure];
  const K = Math.ceil(reach / a) + 1;
  for (let i = -K; i <= K; i += 1) for (let j = -K; j <= K; j += 1) for (let k = -K; k <= K; k += 1) {
    for (const [bx, by, bz] of basis) {
      const x = (i + bx) * a; const y = (j + by) * a; const z = (k + bz) * a;
      if (inside(x, y, z)) pts.push({ x, y, z });
    }
  }
  return pts;
}

/**
 * The first `n` sites of the metal's real crystal lattice (nearest-neighbour distance = 1), centred on the bounding box.
 *
 * Counts that do not fill whole unit cells: the crystal is grown OUTWARD from one atom in cubic shells (sites sorted by
 * their largest coordinate |max(x,y,z)|, ties by distance), and exactly the first n sites are kept. The block is therefore
 * always a cube-shaped fragment of the true BCC/FCC/HCP lattice, the last shell is simply incomplete, and no atom is ever
 * added that the student did not place (n atoms in -> n sites out).
 */
export function latticeBlock(structure, n) {
  if (!n) return [];
  const reach = 0.5 * Math.cbrt(n / DENSITY[structure]) + 2.5;
  const pts = crystalSites(structure, reach);
  const key = (p) => Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z));
  pts.sort((p, q) => key(p) - key(q) || Math.hypot(p.x, p.y, p.z) - Math.hypot(q.x, q.y, q.z) || p.z - q.z || p.y - q.y || p.x - q.x);
  const out = pts.slice(0, n);
  const lo = [Infinity, Infinity, Infinity]; const hi = [-Infinity, -Infinity, -Infinity];
  for (const p of out) { lo[0] = Math.min(lo[0], p.x); hi[0] = Math.max(hi[0], p.x); lo[1] = Math.min(lo[1], p.y); hi[1] = Math.max(hi[1], p.y); lo[2] = Math.min(lo[2], p.z); hi[2] = Math.max(hi[2], p.z); }
  const c = lo.map((l, a) => (l + hi[a]) / 2);
  const res = out.map((p) => ({ x: p.x - c[0], y: p.y - c[1], z: p.z - c[2] }));
  // growth order for the animation: bottom layer first
  res.sort((p, q) => p.z - q.z || p.y - q.y || p.x - q.x);
  return res;
}

export function nearestNeighbourCount(sites, i) {
  const p = sites[i];
  let min = Infinity;
  sites.forEach((q, j) => { if (j !== i) min = Math.min(min, Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z)); });
  let n = 0;
  sites.forEach((q, j) => { if (j !== i && Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) < min + TOL) n += 1; });
  return { count: n, distance: min };
}

/** Largest nearest-neighbour count in a block (equals the bulk value once the block has a fully surrounded ion). */
export function maxCoordination(sites) {
  if (sites.length < 2) return 0;
  let best = 0;
  const target = 1; // nn distance of the generator
  for (let i = 0; i < sites.length; i += 1) {
    let n = 0;
    for (let j = 0; j < sites.length; j += 1) if (j !== i && Math.abs(Math.hypot(sites[i].x - sites[j].x, sites[i].y - sites[j].y, sites[i].z - sites[j].z) - target) < TOL) n += 1;
    best = Math.max(best, n);
  }
  return best;
}

/** Clamp a requested number of atoms to the capacity: { added, total, clamped }. */
export function addCount(current, requested, cap = MAX_METAL_ATOMS) {
  const added = Math.max(0, Math.min(requested, cap - current));
  return { added, total: current + added, clamped: added < requested };
}

/** Counter values for n atoms of a metal (simplified model: every outer-shell electron is delocalised). */
export function metalCounts(symbol, n) { return { atoms: n, ions: n, electrons: n * valenceElectrons(symbol) }; }

/** Analyse the metals placed: one metal type only (alloys are not modelled). */
export function analyzeMetals(symbols) {
  if (symbols.length === 0) return { status: "empty", message: "Add metal atoms (start with sodium)." };
  const types = [...new Set(symbols)];
  if (types.length > 1) return { status: "unsupported", message: "Use one metal at a time; alloys are not modelled." };
  const sym = types[0];
  const structure = METAL_STRUCTURE[sym];
  if (!structure) return { status: "unsupported", message: `${sym} is not in the metal library.` };
  const v = valenceElectrons(sym);
  if (symbols.length < 2) return { status: "few", symbol: sym, structure, valence: v, message: "Add at least two atoms to release their valence electrons." };
  return { status: "valid", symbol: sym, structure, valence: v, message: `${symbols.length} ${sym} atoms.` };
}
