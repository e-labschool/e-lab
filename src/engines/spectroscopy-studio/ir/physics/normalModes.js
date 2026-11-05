// Harmonic normal-mode analysis of a small molecule with a VALENCE FORCE FIELD (pure JS; no React, no three).
//
// Method (the textbook Wilson GF / Cartesian route):
//   1. internal coordinates s_c (bond stretches, angle bends, linear-molecule bends, dihedrals) are evaluated on the equilibrium geometry
//      and their Cartesian gradients B (the Wilson B matrix) are taken numerically (central differences);
//   2. the potential energy is V = 1/2 sum F_ab s_a s_b with a few force constants, so the Cartesian Hessian is H = B^T F B;
//   3. H is mass-weighted, H_mw = M^(-1/2) H M^(-1/2), the translations and rotations (Eckart conditions) are projected out and the rest is
//      diagonalised. Eigenvalues are omega^2; eigenvectors L are the normal modes. Cartesian displacements are d_i = L_i / sqrt(m_i).
// Because the modes are eigenvectors of one symmetric matrix they are orthogonal in mass-weighted coordinates by construction, and because the
// projector removes translation and rotation each mode has zero linear and zero angular momentum (centre of mass fixed, no net rotation).
// Honest limits: harmonic, a few hand-set force constants (fitted to the observed fundamentals where the molecule is small enough, see
// scripts/fit-ir-force-field.mjs); frequencies are NOT ab-initio and anharmonicity / Fermi resonance / rotation are not modelled.
import { ANGSTROM, C_LIGHT_CM, MASS_U } from "./constants.js";
import { cross3, dot, eigenSym, gramSchmidt, norm, zeros } from "./linalg.js";

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const AXIS = { x: 0, y: 1, z: 2 };

/** Value of one internal coordinate for positions P (array of [x,y,z], angstrom). Stretch: A; bend, linbend, dihedral: rad. */
export function evalCoordinate(c, P, refLen = 1) {
  const a = c.atoms;
  switch (c.type) {
    case "stretch": return len(sub(P[a[0]], P[a[1]]));
    case "bend": {
      const u = sub(P[a[0]], P[a[1]]); const v = sub(P[a[2]], P[a[1]]);
      return Math.acos(Math.max(-1, Math.min(1, dot(u, v) / (len(u) * len(v)))));
    }
    case "linbend": { // deviation of A-B-C from 180 degrees along one transverse axis: (2 u_B - u_A - u_C) / r
      const k = AXIS[c.axis]; return (2 * P[a[1]][k] - P[a[0]][k] - P[a[2]][k]) / refLen;
    }
    case "dihedral": {
      const b1 = sub(P[a[1]], P[a[0]]); const b2 = sub(P[a[2]], P[a[1]]); const b3 = sub(P[a[3]], P[a[2]]);
      const n1 = cross3(b1, b2); const n2 = cross3(b2, b3);
      const m1 = cross3(n1, [b2[0] / len(b2), b2[1] / len(b2), b2[2] / len(b2)]);
      return Math.atan2(dot(m1, n2), dot(n1, n2));
    }
    default: throw new Error(`unknown coordinate type ${c.type}`);
  }
}
const wrapPi = (x) => { let y = x; while (y > Math.PI) y -= 2 * Math.PI; while (y < -Math.PI) y += 2 * Math.PI; return y; };

/** Wilson B matrix (rows: coordinates, columns: 3N Cartesians, units per angstrom) by central differences. */
export function wilsonB(def, P = def.atoms.map((a) => a.pos)) {
  const n = P.length; const h = 1e-5;
  const refLen = (c) => (c.type === "linbend" ? 0.5 * (len(sub(P[c.atoms[0]], P[c.atoms[1]])) + len(sub(P[c.atoms[2]], P[c.atoms[1]]))) : 1);
  return def.coordinates.map((c) => {
    const row = new Float64Array(3 * n); const r = refLen(c);
    for (const i of new Set(c.atoms)) {
      for (let k = 0; k < 3; k += 1) {
        const Pp = P.map((p) => [...p]); const Pm = P.map((p) => [...p]); Pp[i][k] += h; Pm[i][k] -= h;
        let d = evalCoordinate(c, Pp, r) - evalCoordinate(c, Pm, r);
        if (c.type === "dihedral") d = wrapPi(d);
        row[3 * i + k] = d / (2 * h);
      }
    }
    return row;
  });
}

/** Force-constant matrix F (SI: stretch N/m; bend / linbend / dihedral J/rad^2) from the declared parameters (params in N/m and aJ/rad^2). */
export function forceMatrix(def, params = def.params) {
  const m = def.coordinates.length; const F = zeros(m);
  const val = (p) => { if (!(p in params)) throw new Error(`${def.id}: missing force constant "${p}"`); return params[p]; };
  def.coordinates.forEach((c, i) => { F[i][i] = c.type === "stretch" ? val(c.param) : val(c.param) * 1e-18; });
  for (const cp of def.couplings ?? []) {
    const fa = def.coordinates[cp.a].type === "stretch" ? 1 : 1e-18;
    F[cp.a][cp.b] = F[cp.b][cp.a] = val(cp.param) * fa;
  }
  return F;
}

/** Cartesian Hessian in N/m (3N x 3N) */
export function cartesianHessian(def, params = def.params) {
  const B = wilsonB(def); const F = forceMatrix(def, params); const n3 = 3 * def.atoms.length;
  // B: stretch rows are dimensionless (angstrom per angstrom); angle-like rows are rad per angstrom -> rad per metre
  const Bs = B.map((r, c) => { const k = def.coordinates[c].type === "stretch" ? 1 : 1 / ANGSTROM; return r.map((v) => v * k); });
  const FB = F.map((row) => { const out = new Float64Array(n3); for (let b = 0; b < row.length; b += 1) { const f = row[b]; if (f !== 0) for (let j = 0; j < n3; j += 1) out[j] += f * Bs[b][j]; } return out; });
  const H = zeros(n3);
  for (let a = 0; a < Bs.length; a += 1) for (let i = 0; i < n3; i += 1) { const bi = Bs[a][i]; if (bi !== 0) for (let j = 0; j < n3; j += 1) H[i][j] += bi * FB[a][j]; }
  return { H, B };
}

export const massOf = (el) => MASS_U[el];

/** Mass-weighted translation / rotation vectors of the equilibrium geometry (orthonormalised; 5 for linear molecules, 6 otherwise). */
export function eckartVectors(atoms) {
  const n = atoms.length; const m = atoms.map((a) => massOf(a.el)); const M = m.reduce((s, x) => s + x, 0);
  const com = [0, 1, 2].map((k) => atoms.reduce((s, a, i) => s + m[i] * a.pos[k], 0) / M);
  const r = atoms.map((a) => sub(a.pos, com));
  const vecs = [];
  for (let k = 0; k < 3; k += 1) vecs.push(Float64Array.from({ length: 3 * n }, (_, idx) => (idx % 3 === k ? Math.sqrt(m[Math.floor(idx / 3)]) : 0)));
  for (let k = 0; k < 3; k += 1) {
    const e = [0, 0, 0]; e[k] = 1; const v = new Float64Array(3 * n);
    for (let i = 0; i < n; i += 1) { const c = cross3(e, r[i]); for (let q = 0; q < 3; q += 1) v[3 * i + q] = Math.sqrt(m[i]) * c[q]; }
    vecs.push(v);
  }
  return gramSchmidt(vecs, 1e-7);
}

/** Remove translation and rotation components from a mass-weighted vector (in place on a copy). */
export function projectOutTR(vec, tr) { const v = Float64Array.from(vec); for (const t of tr) { const c = dot(v, t); for (let i = 0; i < v.length; i += 1) v[i] -= c * t[i]; } return v; }

/** Cartesian displacement vector (flat, 3N) from a mass-weighted vector. */
export const toCartesian = (L, masses) => Float64Array.from(L, (x, idx) => x / Math.sqrt(masses[Math.floor(idx / 3)]));
export const toMassWeighted = (d, masses) => Float64Array.from(d, (x, idx) => x * Math.sqrt(masses[Math.floor(idx / 3)]));

/**
 * Normal modes of `def`. Returns { masses, tr, modes: [...] } with modes ascending in wavenumber. Each mode:
 *   wavenumber (cm^-1, harmonic model), lambda (s^-2), L (mass-weighted, unit norm), disp [[dx,dy,dz] per atom, scaled to max |d| = 1],
 *   dispRaw (L_i/sqrt(m_i)), groupId / groupSize (degenerate sets), internal (Delta s_c for unit Q).
 */
export function computeNormalModes(def, params = def.params) {
  const n = def.atoms.length; const n3 = 3 * n;
  const masses = def.atoms.map((a) => massOf(a.el));
  const { H, B } = cartesianHessian(def, params);
  const Hmw = zeros(n3);
  for (let i = 0; i < n3; i += 1) for (let j = 0; j < n3; j += 1) Hmw[i][j] = H[i][j] / Math.sqrt(masses[Math.floor(i / 3)] * masses[Math.floor(j / 3)]) / 1.66053906660e-27;
  // symmetrise (numerical B), then project out translations and rotations: P H P
  for (let i = 0; i < n3; i += 1) for (let j = i + 1; j < n3; j += 1) { const s = 0.5 * (Hmw[i][j] + Hmw[j][i]); Hmw[i][j] = Hmw[j][i] = s; }
  const tr = eckartVectors(def.atoms);
  const P = zeros(n3); for (let i = 0; i < n3; i += 1) P[i][i] = 1;
  for (const t of tr) for (let i = 0; i < n3; i += 1) for (let j = 0; j < n3; j += 1) P[i][j] -= t[i] * t[j];
  const PH = zeros(n3); for (let i = 0; i < n3; i += 1) for (let k = 0; k < n3; k += 1) { const p = P[i][k]; if (p !== 0) for (let j = 0; j < n3; j += 1) PH[i][j] += p * Hmw[k][j]; }
  const Hp = zeros(n3); for (let i = 0; i < n3; i += 1) for (let k = 0; k < n3; k += 1) { const h = PH[i][k]; if (h !== 0) for (let j = 0; j < n3; j += 1) Hp[i][j] += h * P[k][j]; }
  const { values, vectors } = eigenSym(Hp);
  const nVib = n3 - tr.length;
  // vibrational vectors = those orthogonal to the translation / rotation space
  const vib = [];
  values.forEach((lam, k) => { const ov = tr.reduce((s, t) => s + dot(vectors[k], t) ** 2, 0); if (ov < 1e-6) vib.push({ lam, v: vectors[k] }); });
  if (vib.length !== nVib) throw new Error(`${def.id}: expected ${nVib} vibrations, found ${vib.length}`);
  const cmPerS = C_LIGHT_CM;
  let modes = vib.map(({ lam, v }) => {
    const omega = Math.sqrt(Math.max(lam, 0)); // lam in s^-2 (H in N/m divided by u, then by kg/u already applied)
    return { lambda: lam, wavenumber: omega / (2 * Math.PI * cmPerS), L: v };
  });
  modes = canonicalise(def, modes, masses);
  modes.forEach((m, idx) => {
    m.index = idx;
    m.dispRaw = toCartesian(m.L, masses);
    let mx = 0; for (let i = 0; i < n; i += 1) mx = Math.max(mx, Math.hypot(m.dispRaw[3 * i], m.dispRaw[3 * i + 1], m.dispRaw[3 * i + 2]));
    m.disp = Array.from({ length: n }, (_, i) => [m.dispRaw[3 * i] / mx, m.dispRaw[3 * i + 1] / mx, m.dispRaw[3 * i + 2] / mx]);
    m.maxRaw = mx;
    m.internal = B.map((row) => { let s = 0; for (let j = 0; j < n3; j += 1) s += row[j] * m.dispRaw[j]; return s; });
  });
  return { id: def.id, masses, tr, modes, B };
}

/** Group degenerate modes and choose a reproducible basis inside each set (so the "first" mode of a degenerate pair / triplet is the same every time). */
function canonicalise(def, modes, masses) {
  const out = []; let i = 0; let gid = 0;
  while (i < modes.length) {
    let j = i + 1;
    while (j < modes.length && Math.abs(modes[j].lambda - modes[i].lambda) <= 1e-6 * Math.max(modes[i].lambda, 1e-30)) j += 1;
    const group = modes.slice(i, j); const g = group.length;
    let basis = group.map((m) => m.L);
    if (g > 1) {
      const refs = [];
      const order = def.canonAtoms ?? def.atoms.map((_, k) => k);
      for (const a of order) for (let k = 0; k < 3; k += 1) { const r = new Float64Array(3 * def.atoms.length); r[3 * a + k] = Math.sqrt(masses[a]); refs.push(r); }
      const projected = refs.map((r) => { const p = new Float64Array(r.length); for (const m of group) { const c = dot(m.L, r); for (let q = 0; q < p.length; q += 1) p[q] += c * m.L[q]; } return p; });
      const gs = gramSchmidt(projected, 1e-6);
      if (gs.length === g) basis = gs;
    }
    const lam = group.reduce((s, m) => s + m.lambda, 0) / g; const wn = group.reduce((s, m) => s + m.wavenumber, 0) / g;
    basis.forEach((L) => out.push({ lambda: lam, wavenumber: wn, L, groupId: gid, groupSize: g }));
    gid += 1; i = j;
  }
  return out;
}

/** The distinct (non-degenerate-duplicate) mode groups: one representative per group, ascending in wavenumber. */
export function modeGroups(set) {
  const seen = new Set(); const out = [];
  for (const m of set.modes) if (!seen.has(m.groupId)) { seen.add(m.groupId); out.push({ ...m, members: set.modes.filter((x) => x.groupId === m.groupId) }); }
  return out;
}

/** Diagnostics used by the tests and shown in the docs: orthonormality, translation / rotation content, linear and angular momentum of a mode. */
export function diagnostics(set, def) {
  const { modes, tr, masses } = set; let maxOrtho = 0; let maxTR = 0; let maxP = 0; let maxL = 0;
  const com = [0, 1, 2].map((k) => def.atoms.reduce((s, a, i) => s + masses[i] * a.pos[k], 0) / masses.reduce((s, x) => s + x, 0));
  for (let a = 0; a < modes.length; a += 1) {
    for (let b = a; b < modes.length; b += 1) maxOrtho = Math.max(maxOrtho, Math.abs(dot(modes[a].L, modes[b].L) - (a === b ? 1 : 0)));
    for (const t of tr) maxTR = Math.max(maxTR, Math.abs(dot(modes[a].L, t)));
    const d = modes[a].dispRaw; const p = [0, 0, 0]; const L = [0, 0, 0];
    def.atoms.forEach((at, i) => {
      const dv = [d[3 * i], d[3 * i + 1], d[3 * i + 2]]; const r = sub(at.pos, com); const c = cross3(r, dv);
      for (let k = 0; k < 3; k += 1) { p[k] += masses[i] * dv[k]; L[k] += masses[i] * c[k]; }
    });
    maxP = Math.max(maxP, norm(p)); maxL = Math.max(maxL, norm(L));
  }
  return { maxOrtho, maxTR, maxMomentum: maxP, maxAngularMomentum: maxL };
}
