// Molecular and crystal geometry data (spec A3).  Coordinates are in angstrom, built from bond lengths and angles so the
// tests can recompute every angle from the coordinates.  Pure data, no three.js.
//
// Bond lengths are standard gas-phase values (O-H 0.957, C=O 1.16, N-H 1.012, C-H 1.087, H-H 0.741, O=O 1.208, N≡N 1.098).
// Angles follow the spec: H2O ≈ 104.5°, CO2 180°, NH3 trigonal pyramidal (H-N-H ≈ 107°), CH4 tetrahedral (109.5°).
const DEG = Math.PI / 180;
const atom = (el, x, y, z) => ({ el, x, y, z });

export function bent(center, lig, len, angleDeg) {
  const h = (angleDeg / 2) * DEG;
  return {
    atoms: [atom(center, 0, 0, 0), atom(lig, len * Math.sin(h), -len * Math.cos(h), 0), atom(lig, -len * Math.sin(h), -len * Math.cos(h), 0)],
    bonds: [{ a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 }],
  };
}
export function linearTriatomic(center, lig, len, order) {
  return { atoms: [atom(center, 0, 0, 0), atom(lig, len, 0, 0), atom(lig, -len, 0, 0)], bonds: [{ a: 0, b: 1, order }, { a: 0, b: 2, order }] };
}
export function pyramid(center, lig, len, angleDeg, n = 3) {
  const cosA2 = (Math.cos(angleDeg * DEG) + 0.5) / 1.5; // for 3 ligands: cos(phi) = 1.5 cos^2(a) - 0.5
  const a = Math.acos(Math.sqrt(cosA2));
  const atoms = [atom(center, 0, 0, 0)]; const bonds = [];
  for (let k = 0; k < n; k += 1) {
    const phi = (2 * Math.PI * k) / n;
    atoms.push(atom(lig, len * Math.sin(a) * Math.cos(phi), -len * Math.cos(a), len * Math.sin(a) * Math.sin(phi)));
    bonds.push({ a: 0, b: k + 1, order: 1 });
  }
  return { atoms, bonds };
}
export function tetrahedral(center, lig, len) {
  const s = len / Math.sqrt(3);
  const pts = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
  return { atoms: [atom(center, 0, 0, 0), ...pts.map(([x, y, z]) => atom(lig, x * s, y * s, z * s))], bonds: pts.map((_, i) => ({ a: 0, b: i + 1, order: 1 })) };
}
export function diatomic(el, len, order, el2 = el) {
  return { atoms: [atom(el, -len / 2, 0, 0), atom(el2, len / 2, 0, 0)], bonds: [{ a: 0, b: 1, order }] };
}
export const single = (el) => ({ atoms: [atom(el, 0, 0, 0)], bonds: [] });

/** Angle in degrees at atom `b` between atoms `a` and `c`. */
export function angleAt(atoms, a, b, c) {
  const A = atoms[a], B = atoms[b], C = atoms[c];
  const u = [A.x - B.x, A.y - B.y, A.z - B.z], v = [C.x - B.x, C.y - B.y, C.z - B.z];
  const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  return Math.acos(Math.max(-1, Math.min(1, dot / (Math.hypot(...u) * Math.hypot(...v))))) / DEG;
}
export const distance = (atoms, a, b) => Math.hypot(atoms[a].x - atoms[b].x, atoms[a].y - atoms[b].y, atoms[a].z - atoms[b].z);

// ------------------------------------------------------------------------------------------------ crystals
// Integer-grid generators for representative lattice fragments.  `n` = cells along each axis.  Returned points are in
// units of the NEAREST-NEIGHBOUR distance d (so the renderer scales to whatever size it wants); `species` is the species
// index of the point (rock salt alternates 0/1).
export function rockSaltFragment(nx = 3, ny = 3, nz = 3) {
  const pts = [];
  for (let k = 0; k < nz; k += 1) for (let j = 0; j < ny; j += 1) for (let i = 0; i < nx; i += 1) pts.push({ x: i, y: j, z: k, species: (i + j + k) % 2 });
  return pts;
}
/** Body-centred cubic: a = 2d/√3 along the cube; points listed by cell corners then centres.  Units of nearest-neighbour distance. */
export function bccFragment(n = 2) {
  const a = 2 / Math.sqrt(3); const pts = [];
  for (let k = 0; k <= n; k += 1) for (let j = 0; j <= n; j += 1) for (let i = 0; i <= n; i += 1) pts.push({ x: i * a, y: j * a, z: k * a, species: 0 });
  for (let k = 0; k < n; k += 1) for (let j = 0; j < n; j += 1) for (let i = 0; i < n; i += 1) pts.push({ x: (i + 0.5) * a, y: (j + 0.5) * a, z: (k + 0.5) * a, species: 0 });
  return pts;
}
/** Hexagonal close packed: layers of a triangular lattice stacked ABAB.  Units of nearest-neighbour distance. */
export function hcpFragment(nx = 3, ny = 3, layers = 3) {
  const pts = []; const dz = Math.sqrt(2 / 3);
  for (let l = 0; l < layers; l += 1) {
    const sx = l % 2 ? 0.5 : 0; const sy = l % 2 ? Math.sqrt(3) / 6 : 0;
    for (let j = 0; j < ny; j += 1) for (let i = 0; i < nx; i += 1) pts.push({ x: i + (j % 2) * 0.5 + sx, y: l * dz, z: j * (Math.sqrt(3) / 2) + sy, species: 0 });
  }
  return pts;
}
