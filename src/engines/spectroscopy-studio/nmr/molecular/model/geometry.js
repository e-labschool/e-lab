// 3D coordinates generated from the bonded graph (no hand-typed coordinates, no external structure files).
//
// Method (a small internal-coordinate builder): atoms are placed breadth-first from a root atom using
//   * bond lengths from the IB Chemistry data booklet (section 11): C-H 108, C-C 154, C-O 143, O-H 97, C=O 122 pm
//   * ideal valence angles by local geometry: sp3 carbon 109.47 deg, trigonal-planar (C=O) carbon 120 deg,
//     hydroxyl C-O-H 108.5 deg and ester C-O-C 116 deg (conventional textbook values)
//   * staggered conformations about single bonds (first substituent anti to the reference), planar sp2 centres, and for the
//     ester the Z (s-cis) arrangement about C(=O)-O.
// The result is a sound, representative conformer for display, NOT an optimised (quantum-chemical) structure.

import { BOND_LENGTH_A } from "./molecules.js";

const TET = (109.4712206 * Math.PI) / 180;
const TRIG = (120 * Math.PI) / 180;
const HYDROXYL = (108.5 * Math.PI) / 180;
const ETHER = (116 * Math.PI) / 180;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const n = norm(a) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };

export const dist = (p, q) => norm(sub(p, q));
export function bondLength(elA, elB, order) {
  const [x, y] = [elA, elB].sort();
  return BOND_LENGTH_A[order === 2 ? `${x}=${y}` : `${x}-${y}`];
}

function hasDouble(mol, i) { return mol.bonds.some((b) => b.order === 2 && (b.a === i || b.b === i)); }
export function localGeometry(mol, i) {
  const a = mol.atoms[i];
  if (a.el === "C") return hasDouble(mol, i) ? { kind: "trigonal", angle: TRIG } : { kind: "tetrahedral", angle: TET };
  if (a.el === "O") {
    if (hasDouble(mol, i)) return { kind: "terminal", angle: TRIG };
    const hasH = a.neighbours.some((n) => mol.atoms[n].el === "H");
    return { kind: "bent", angle: hasH ? HYDROXYL : ETHER };
  }
  return { kind: "terminal", angle: TET };
}

// direction of a new bond from P: angle `theta` away from `g` (unit, towards the already placed neighbour G), torsion phi about g relative to reference direction `ref`
function childDir(g, refVec, theta, phi) {
  let e1 = sub(refVec, mul(g, dot(refVec, g)));
  if (norm(e1) < 1e-6) { const t = Math.abs(g[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]; e1 = sub(t, mul(g, dot(t, g))); }
  e1 = unit(e1);
  const e2 = cross(g, e1);
  const perp = add(mul(e1, Math.cos(phi)), mul(e2, Math.sin(phi)));
  return unit(add(mul(g, Math.cos(theta)), mul(perp, Math.sin(theta))));
}

/** Returns an array of [x, y, z] (angstrom), centred on the centroid, in atom-index order. */
export function generateCoordinates(mol) {
  const pos = new Array(mol.atoms.length).fill(null);
  const parentOf = new Array(mol.atoms.length).fill(-1);
  const root = mol.root;
  pos[root] = [0, 0, 0];
  const heavyFirst = (list) => [...list].sort((x, y) => (mol.atoms[x].isHydrogen ? 1 : 0) - (mol.atoms[y].isHydrogen ? 1 : 0) || x - y);
  const bondOrder = (i, j) => mol.bonds.find((b) => (b.a === i && b.b === j) || (b.a === j && b.b === i)).order;
  const place = (p, x, dir) => { pos[x] = add(pos[p], mul(dir, bondLength(mol.atoms[p].el, mol.atoms[x].el, bondOrder(p, x)))); parentOf[x] = p; };

  // root: the first neighbour goes along +z; the remaining ones are placed as children relative to it
  const rootNeighbours = heavyFirst(mol.atoms[root].neighbours);
  place(root, rootNeighbours[0], [0, 0, 1]);
  const queue = [];
  const placeChildren = (P, G, children, refPos, override) => {
    if (!children.length) return;
    const geo = localGeometry(mol, P);
    const g = unit(sub(pos[G], pos[P]));
    const refVec = sub(refPos, pos[G]);
    let phi0 = Math.PI; let step;
    if (geo.kind === "tetrahedral") step = (2 * Math.PI) / 3;
    else if (geo.kind === "trigonal") { step = Math.PI; phi0 = 0; }
    else step = 0;
    if (override) phi0 = (override.phi * Math.PI) / 180;
    children.forEach((c, k) => place(P, c, childDir(g, refVec, geo.angle, phi0 + step * k)));
    for (const c of children) queue.push(c);
  };
  // root's own children (everything except the first neighbour) use a virtual reference along +x
  placeChildren(root, rootNeighbours[0], rootNeighbours.slice(1), [1, 0, 0], { phi: 0 });
  queue.unshift(rootNeighbours[0]);
  const seen = new Set([root]);
  while (queue.length) {
    const P = queue.shift(); if (seen.has(P)) continue; seen.add(P);
    const G = parentOf[P];
    const children = heavyFirst(mol.atoms[P].neighbours.filter((n) => n !== G && pos[n] === null));
    if (!children.length) continue;
    // reference: another neighbour of G (prefer a heavy atom), already placed
    const refCandidates = heavyFirst(mol.atoms[G].neighbours.filter((n) => n !== P && pos[n] !== null));
    let refPos = refCandidates.length ? pos[refCandidates[0]] : add(pos[G], [1, 0, 0]);
    let override = null;
    for (const c of children) {
      const t = mol.torsionDefs[mol.atoms[c].key];
      if (t) { override = { phi: t.phi }; refPos = pos[mol.heavyIndexByKey[t.ref]]; }
    }
    placeChildren(P, G, children, refPos, override);
  }
  // centre on the centroid
  const c = pos.reduce((acc, p) => add(acc, p), [0, 0, 0]).map((v) => v / pos.length);
  return pos.map((p) => [p[0] - c[0], p[1] - c[1], p[2] - c[2]]);
}

export function angleDeg(p, centre, q) {
  const u = unit(sub(p, centre)); const v = unit(sub(q, centre));
  return (Math.acos(Math.max(-1, Math.min(1, dot(u, v)))) * 180) / Math.PI;
}

/** Bounding radius of the molecule about its centroid (for camera fitting). */
export function boundingRadius(coords) { return coords.reduce((m, p) => Math.max(m, norm(p)), 0); }

const cache = new Map();
/** Coordinates are deterministic; cache them per molecule id. */
export function coordinatesFor(mol) {
  if (!cache.has(mol.id)) cache.set(mol.id, generateCoordinates(mol));
  return cache.get(mol.id);
}
