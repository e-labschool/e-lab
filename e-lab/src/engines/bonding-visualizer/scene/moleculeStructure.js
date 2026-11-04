// Final sphere-and-bond structure of each supported molecule (pure data, no rendering).
// This is the end picture of "Form Bond", NOT a geometry lesson: it uses one fixed, scientifically correct arrangement per
// molecule for display and carries no angle values, geometry names or polarity. Lone pairs are not drawn here (the Lewis
// counts are shown by the live strip); bond order is drawn as 1, 2 or 3 parallel bonds.
import { getBondingElement } from "../model/elements.js";

/** Covalent radii (pm) used only to give bonds a believable relative length. */
const COVALENT_PM = { H: 31, Be: 96, B: 84, C: 76, N: 71, O: 66, F: 57, P: 107, S: 105, Cl: 102 };
/** Display radius of each element's sphere (world units); spheres never touch in a correct structure. */
const DISPLAY_R = { H: 0.32, Be: 0.5, B: 0.47, C: 0.47, N: 0.45, O: 0.43, F: 0.41, P: 0.57, S: 0.57, Cl: 0.55 };
/** Sphere colours for the structure view (the element colours, with F made distinct from S). */
const STRUCT_COLOR = { F: "#9bd96b" };
const LEN_SCALE = 0.0145; // pm -> world units
const ORDER_SHORTEN = { 1: 1, 2: 0.92, 3: 0.86 };

export const displayRadius = (symbol) => DISPLAY_R[symbol] ?? 0.4;
export function bondLength(a, b, order = 1) { return ((COVALENT_PM[a] ?? 90) + (COVALENT_PM[b] ?? 90)) * LEN_SCALE * (ORDER_SHORTEN[order] ?? 1); }

const norm = (v) => { const l = Math.hypot(...v); return v.map((c) => c / l); };
const DEG = Math.PI / 180;

/** Unit directions of the ligands around the central atom for each molecule (fixed display arrangement). */
function directions(id, n) {
  switch (id) {
    case "H2O": { const a = (104.5 / 2) * DEG; return [[Math.sin(a), -Math.cos(a), 0], [-Math.sin(a), -Math.cos(a), 0]]; }
    case "NH3": { const t = 68.2 * DEG; return [0, 1, 2].map((q) => [Math.sin(t) * Math.cos((2 * Math.PI * q) / 3), Math.cos(t), Math.sin(t) * Math.sin((2 * Math.PI * q) / 3)]); }
    case "CH4": return [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(norm);
    case "BF3": return [0, 1, 2].map((q) => [Math.cos((2 * Math.PI * q) / 3), 0, Math.sin((2 * Math.PI * q) / 3)]);
    case "BeCl2": return [[1, 0, 0], [-1, 0, 0]];
    case "PCl5": return [[0, 1, 0], [0, -1, 0], ...[0, 1, 2].map((q) => [Math.cos((2 * Math.PI * q) / 3), 0, Math.sin((2 * Math.PI * q) / 3)])];
    case "SF6": return [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    default: return Array.from({ length: n }, (_, i) => [Math.cos((2 * Math.PI * i) / n), 0, Math.sin((2 * Math.PI * i) / n)]);
  }
}

/**
 * Final structure of molecule `m` (from model/covalent.js):
 * { atoms:[{index,symbol,pos:[x,y,z],radius,color}], bonds:[{i,j,order}], radius (bounding radius), centre }.
 * Atom i of the result is atom i of the molecule table; the structure is centred on the middle of its bounding box.
 */
export function moleculeStructure(m) {
  const raw = [];
  if (m.central === null) {
    const d = bondLength(m.atoms[0], m.atoms[1], m.bonds[0][2]);
    raw.push([-d / 2, 0, 0], [d / 2, 0, 0]);
  } else {
    raw.push([0, 0, 0]);
    const dirs = directions(m.id, m.atoms.length - 1);
    for (let i = 1; i < m.atoms.length; i += 1) {
      const order = m.bonds.find((b) => b[0] === 0 && b[1] === i)?.[2] ?? 1;
      const d = bondLength(m.atoms[0], m.atoms[i], order);
      raw.push(dirs[i - 1].map((c) => c * d));
    }
  }
  const lo = [0, 1, 2].map((a) => Math.min(...raw.map((p) => p[a])));
  const hi = [0, 1, 2].map((a) => Math.max(...raw.map((p) => p[a])));
  const c = lo.map((l, a) => (l + hi[a]) / 2);
  const atoms = raw.map((p, i) => {
    const el = getBondingElement(m.atoms[i]);
    return { index: i, symbol: m.atoms[i], pos: p.map((v, a) => v - c[a]), radius: displayRadius(m.atoms[i]), color: STRUCT_COLOR[m.atoms[i]] ?? el.color };
  });
  const bonds = m.bonds.map(([i, j, order]) => ({ i, j, order }));
  const radius = Math.max(...atoms.map((a) => Math.hypot(...a.pos) + a.radius));
  return { atoms, bonds, radius, centre: c };
}

/** Smallest centre distance minus the two display radii over all atom pairs (> 0 means no spheres overlap). */
export function minGap(structure) {
  let g = Infinity;
  const a = structure.atoms;
  for (let i = 0; i < a.length; i += 1) for (let j = i + 1; j < a.length; j += 1) {
    g = Math.min(g, Math.hypot(a[i].pos[0] - a[j].pos[0], a[i].pos[1] - a[j].pos[1], a[i].pos[2] - a[j].pos[2]) - a[i].radius - a[j].radius);
  }
  return g;
}

/** Offsets (unit vectors scaled later) of the parallel cylinders of a bond of the given order, perpendicular to dir. */
export function bondOffsets(dir, order) {
  if (order <= 1) return [[0, 0, 0]];
  const ref = Math.abs(dir[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0]; // offset sideways as seen from the default view
  let p1 = [dir[1] * ref[2] - dir[2] * ref[1], dir[2] * ref[0] - dir[0] * ref[2], dir[0] * ref[1] - dir[1] * ref[0]];
  p1 = norm(p1);
  if (order === 2) return [p1.map((c) => c * 1), p1.map((c) => -c)];
  return [-1, 0, 1].map((q) => p1.map((c) => c * q)); // three in a row across the bond, all visible from the default view
}
