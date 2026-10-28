// Metallic model: metal library facts, lattice generation and coordination (computed from coordinates).
// Pure logic. A metal is represented by its crystal structure at room temperature:
//   Li, Na, K = body-centred cubic (BCC); Ca, Al = face-centred cubic (FCC); Mg = hexagonal close-packed (HCP, ideal c/a).
// The nearest-neighbour distance is normalised to 1.
import { getBondingElement } from "./elements.js";

export const METAL_STRUCTURE = { Na: "bcc", Li: "bcc", K: "bcc", Mg: "hcp", Ca: "fcc", Al: "fcc" };
export const STRUCTURE_LABEL = { bcc: "Body-centred cubic (BCC)", fcc: "Face-centred cubic (FCC)", hcp: "Hexagonal close-packed (HCP)" };
export const EXPECTED_NEIGHBOURS = { bcc: 8, fcc: 12, hcp: 12 };
export const MAX_METAL_ATOMS = 12;

/** Edge length of the conventional cubic cell (nearest-neighbour distance = 1), or null for non-cubic structures. */
export function cubicCellEdge(structure) { return BASES[structure]?.a ?? null; }

/** Valence (delocalised) electrons per atom = outer-shell electrons from the electron-configuration engine. */
export function valenceElectrons(symbol) { return getBondingElement(symbol)?.valence ?? 0; }

const BASES = {
  bcc: { a: 2 / Math.sqrt(3), basis: [[0, 0, 0], [0.5, 0.5, 0.5]] },
  fcc: { a: Math.SQRT2, basis: [[0, 0, 0], [0.5, 0.5, 0], [0.5, 0, 0.5], [0, 0.5, 0.5]] },
};

/** Lattice sites (positions) of a block; nearest-neighbour distance = 1; centred on the origin. `cells` per axis. */
export function generateMetalLattice(structure, cells = 2) {
  const pts = [];
  if (structure === "hcp") {
    const c = Math.sqrt(8 / 3); // ideal c/a with a = 1
    const n = cells + 1;
    const layers = cells + 1;
    for (let l = 0; l < layers; l += 1) {
      const shift = l % 2 ? [0.5, Math.sqrt(3) / 6] : [0, 0];
      for (let i = 0; i < n + 1; i += 1) for (let j = 0; j < n; j += 1) {
        pts.push([i + 0.5 * j + shift[0], (Math.sqrt(3) / 2) * j + shift[1], (c / 2) * l]);
      }
    }
  } else {
    const { a, basis } = BASES[structure];
    const eps = 1e-9;
    for (let i = 0; i <= cells; i += 1) for (let j = 0; j <= cells; j += 1) for (let k = 0; k <= cells; k += 1) {
      for (const [bx, by, bz] of basis) {
        const x = i + bx; const y = j + by; const z = k + bz;
        if (x > cells + eps || y > cells + eps || z > cells + eps) continue;
        pts.push([x * a, y * a, z * a]);
      }
    }
  }
  const mean = [0, 1, 2].map((a) => pts.reduce((s, p) => s + p[a], 0) / pts.length);
  const out = pts.map((p) => ({ x: p[0] - mean[0], y: p[1] - mean[1], z: p[2] - mean[2] }));
  // growth order: x-row, then planes, then layers
  out.sort((p, q) => p.z - q.z || p.y - q.y || p.x - q.x);
  return out;
}

const TOL = 1e-6;
export function nearestNeighbourCount(sites, i) {
  const p = sites[i];
  let min = Infinity;
  sites.forEach((q, j) => { if (j !== i) min = Math.min(min, Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z)); });
  let n = 0;
  sites.forEach((q, j) => { if (j !== i && Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) < min + TOL) n += 1; });
  return { count: n, distance: min };
}

/** The site closest to the centre of the block (always an interior site) and its computed neighbour count. */
export function centralCoordination(structure, cells = 2) {
  const sites = generateMetalLattice(structure, cells);
  let best = 0; let bd = Infinity;
  sites.forEach((p, i) => { const d = Math.hypot(p.x, p.y, p.z); if (d < bd) { bd = d; best = i; } });
  return nearestNeighbourCount(sites, best);
}

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
