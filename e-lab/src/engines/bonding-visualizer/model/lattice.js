// Ionic lattice model. Coordinates are GENERATED from crystallographic bases (fractional cubic-cell
// coordinates), never typed in as picture data, and coordination numbers are COMPUTED from the generated
// coordinates (scripts/test-bonding-model.mjs checks 6:6 for rock-salt, 8:4 for fluorite, 4:8 for antifluorite).
//
// Only compounds whose real crystal structure is one of the three implemented types are enabled
// (see COMPOUND_STRUCTURES). Everything else (MgCl2 layered, Al2O3 corundum, ...) returns an explanation.
import { chargeBalance, formulaOf } from "./ionic.js";
import { getBondingElement } from "./elements.js";

const FCC = [[0, 0, 0], [0.5, 0.5, 0], [0.5, 0, 0.5], [0, 0.5, 0.5]];
const OCT = [[0.5, 0, 0], [0, 0.5, 0], [0, 0, 0.5], [0.5, 0.5, 0.5]]; // octahedral holes of the fcc array
const TET = [];
for (const x of [0.25, 0.75]) for (const y of [0.25, 0.75]) for (const z of [0.25, 0.75]) TET.push([x, y, z]);

/** Structure types: cation / anion positions in the conventional cubic cell (fractions of a). */
export const STRUCTURES = {
  rocksalt: {
    id: "rocksalt", label: "Rock-salt (NaCl type)", ratio: { cation: 1, anion: 1 },
    cationBasis: FCC, anionBasis: OCT,
    expected: { cation: 6, anion: 6 }, // validated by test from the generated coordinates
  },
  fluorite: {
    id: "fluorite", label: "Fluorite (CaF₂ type)", ratio: { cation: 1, anion: 2 },
    cationBasis: FCC, anionBasis: TET, expected: { cation: 8, anion: 4 },
  },
  antifluorite: {
    id: "antifluorite", label: "Antifluorite (Na₂O type)", ratio: { cation: 2, anion: 1 },
    cationBasis: TET, anionBasis: FCC, expected: { cation: 4, anion: 8 },
  },
};

const pairs = (cations, anions) => cations.flatMap((c) => anions.map((a) => `${c}|${a}`));
/** Compounds whose experimentally known structure is one of the implemented types. */
export const COMPOUND_STRUCTURES = {
  rocksalt: pairs(["Li", "Na", "K"], ["F", "Cl", "Br"]).concat(["Mg|O", "Mg|S", "Ca|O", "Ca|S"]),
  fluorite: ["Ca|F"],
  antifluorite: pairs(["Li", "Na", "K"], ["O", "S"]),
};

/** Structure id for a cation/anion pair, or null when no validated lattice is implemented. */
export function structureFor(cat, an) {
  for (const [id, list] of Object.entries(COMPOUND_STRUCTURES)) if (list.includes(`${cat}|${an}`)) return id;
  return null;
}

/** Lattice availability + a clear reason when unavailable. */
export function latticeSupport(cat, an) {
  const formula = formulaOf(cat, an);
  const id = structureFor(cat, an);
  if (!id) {
    return {
      supported: false, structureId: null, formula,
      reason: `Lattice view isn’t available for ${formula}: its crystal structure is not one of the validated types (rock-salt, fluorite, antifluorite).`,
    };
  }
  const bal = chargeBalance(cat, an);
  const s = STRUCTURES[id];
  if (bal.cation !== s.ratio.cation || bal.anion !== s.ratio.anion) {
    return { supported: false, structureId: null, formula, reason: `Lattice view isn’t available for ${formula}: formula and structure ratio disagree.` };
  }
  return { supported: true, structureId: id, formula, reason: null };
}

/**
 * Generate an n x n x n block of unit cells (inclusive of the closing faces) with the nearest cation-anion
 * distance normalised to 1 and the block centred on the origin.
 * Returns ions sorted in GROWTH ORDER: an x-row first, then the y-direction fills the plane, then z builds the block.
 * ion = { x,y,z, species:"cation"|"anion", ix,iy,iz (cell-fraction grid indices) }
 */
export function generateIonicBlock(structureId, cells = 2) {
  const s = STRUCTURES[structureId];
  if (!s) throw new Error(`Unknown structure ${structureId}`);
  const raw = [];
  const eps = 1e-9;
  for (let i = 0; i <= cells; i += 1) for (let j = 0; j <= cells; j += 1) for (let k = 0; k <= cells; k += 1) {
    for (const [species, basis] of [["cation", s.cationBasis], ["anion", s.anionBasis]]) {
      for (const [bx, by, bz] of basis) {
        const x = i + bx; const y = j + by; const z = k + bz;
        if (x > cells + eps || y > cells + eps || z > cells + eps) continue;
        raw.push({ x, y, z, species });
      }
    }
  }
  // nearest cation-anion distance in cell units
  const d = nearestOppositeDistance(raw);
  const c = cells / 2;
  const ions = raw.map((p) => ({
    species: p.species,
    x: (p.x - c) / d, y: (p.y - c) / d, z: (p.z - c) / d,
    ix: Math.round(p.x * 4), iy: Math.round(p.y * 4), iz: Math.round(p.z * 4),
  }));
  ions.sort((a, b) => a.iz - b.iz || a.iy - b.iy || a.ix - b.ix);
  return ions;
}

function nearestOppositeDistance(pts) {
  let best = Infinity;
  const sample = pts.slice(0, Math.min(pts.length, 60));
  for (const p of sample) for (const q of pts) {
    if (p.species === q.species) continue;
    const dd = Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
    if (dd < best) best = dd;
  }
  return best;
}

const TOL = 1e-6;
/** Number of nearest OPPOSITE-species neighbours of ion i (distance within tolerance of the minimum) and that distance. */
export function nearestOpposite(ions, i) {
  const p = ions[i];
  let min = Infinity;
  for (const q of ions) if (q.species !== p.species) min = Math.min(min, Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z));
  let n = 0;
  for (const q of ions) if (q.species !== p.species && Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) < min + TOL) n += 1;
  return { count: n, distance: min };
}
/** Same-species ions at (or closer than) the nearest opposite distance (must be 0 in a valid ionic lattice). */
export function sameSpeciesAtContact(ions, i) {
  const { distance } = nearestOpposite(ions, i);
  const p = ions[i];
  return ions.filter((q, j) => j !== i && q.species === p.species && Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) <= distance + TOL).length;
}

/** Indices of ions at least `margin` (default 1 = nearest-neighbour distance) away from every face of the block. */
export function interiorIndices(ions, margin = 1) {
  const lo = [Infinity, Infinity, Infinity]; const hi = [-Infinity, -Infinity, -Infinity];
  for (const p of ions) { [p.x, p.y, p.z].forEach((v, a) => { lo[a] = Math.min(lo[a], v); hi[a] = Math.max(hi[a], v); }); }
  const out = [];
  ions.forEach((p, i) => {
    const v = [p.x, p.y, p.z];
    if (v.every((c, a) => c - lo[a] >= margin - TOL && hi[a] - c >= margin - TOL)) out.push(i);
  });
  return out;
}

/** Coordination numbers computed from the generated coordinates (interior ions only): { cation, anion, interiorCount }. */
export function computeCoordination(structureId, cells = 2) {
  const ions = generateIonicBlock(structureId, cells);
  const interior = interiorIndices(ions);
  const per = { cation: new Set(), anion: new Set() };
  for (const i of interior) per[ions[i].species].add(nearestOpposite(ions, i).count);
  const one = (set) => (set.size === 1 ? [...set][0] : null);
  return { cation: one(per.cation), anion: one(per.anion), interiorCount: interior.length };
}

/** Composition of ONE conventional unit cell (fractional-site weights) -> ratio check. Cation:anion per cell. */
export function unitCellContents(structureId) {
  const s = STRUCTURES[structureId];
  return { cation: s.cationBasis.length, anion: s.anionBasis.length };
}

/** Relative display radii from the IB Chemistry data booklet (10^-12 m): ionic radius per element. */
export const IONIC_RADII_PM = { Li: 76, Na: 102, K: 138, Mg: 72, Ca: 100, Al: 54, N: 146, O: 140, F: 133, S: 184, Cl: 181, Br: 196 };

/** Sphere radii for the 3D view in units where the nearest cation-anion distance is 1 (scaled by 0.5 for visibility). */
export function displayRadii(cat, an) {
  const rc = IONIC_RADII_PM[cat]; const ra = IONIC_RADII_PM[an];
  const scale = 0.5;
  return { cation: (rc / (rc + ra)) * scale, anion: (ra / (rc + ra)) * scale };
}

export function ionColors(cat, an) {
  return { cation: getBondingElement(cat).color, anion: getBondingElement(an).color };
}
