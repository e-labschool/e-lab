// One molecule as ONE grouped three.js object: every atom sphere and every bond cylinder is a child of the same THREE.Group, positioned
// ONCE from the molecule's local geometry (mol.atoms[i].p). Moving / rotating the molecule only ever changes the group's transform, so atoms
// and bonds cannot detach. Pure three (no React, no WebGL needed) so the node tests can build the real object and inspect it.
import * as THREE from "three";
import { ELEM } from "../model/molecules.js";
import { add, cross, len, norm, scale, sub } from "../model/vec.js";
import { placeCylinder } from "./sceneAssets.js";

export const BALL_SCALE = { ball: 1, cloud: 0.62 };
export const BOND_RADIUS = { 1: 0.1, 2: 0.066, 3: 0.052 };
export const BOND_OFFSET = 0.19; // sideways offset of the parallel sticks of a double / triple bond (A)
export const BOND_COLOR = "#cfd6e6";

export function makeMoleculeGeometry() { return { sphere: new THREE.SphereGeometry(1, 28, 20), cyl: new THREE.CylinderGeometry(1, 1, 1, 14, 1, false) }; }

/** Sticks of one bond: [{a, b, r}] with a, b the two atom centres shifted sideways (multiple bonds) -- the axial coordinates are exactly the atoms'. */
export function bondSticks(mol, bond) {
  const [ia, ib, order] = bond; const pa = mol.atoms[ia].p; const pb = mol.atoms[ib].p; const u = norm(sub(pb, pa));
  const ref = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
  const perp = norm(cross(u, ref)); // sticks of a multiple bond lie side by side in the default view plane
  const offs = order === 3 ? [-1, 0, 1] : order === 2 ? [-0.5, 0.5] : [0];
  return offs.map((o) => ({ a: add(pa, scale(perp, o * BOND_OFFSET)), b: add(pb, scale(perp, o * BOND_OFFSET)), r: BOND_RADIUS[order] ?? BOND_RADIUS[1], bond: [ia, ib] }));
}

/**
 * Build the molecule object. `geo` from makeMoleculeGeometry(); `atomMats` {element -> material}; `bondMat` one material.
 * Returns { group, atoms: [Mesh], bonds: [Mesh], setStyle(amount 0..1 cloud) }.
 */
export function buildMoleculeObject(mol, geo, atomMats, bondMat) {
  const group = new THREE.Group(); group.name = `molecule-${mol.id ?? mol.label}`; const atoms = []; const bonds = [];
  mol.atoms.forEach((a, i) => {
    const m = new THREE.Mesh(geo.sphere, atomMats[a.el]); m.name = `atom-${i}-${a.el}`; m.userData = { kind: "atom", index: i, el: a.el };
    m.position.set(a.p[0], a.p[1], a.p[2]); m.scale.setScalar(ELEM[a.el].ball); m.renderOrder = 1; group.add(m); atoms.push(m);
  });
  mol.bonds.forEach((bd) => {
    for (const s of bondSticks(mol, bd)) {
      const m = new THREE.Mesh(geo.cyl, bondMat); m.name = `bond-${bd[0]}-${bd[1]}`; m.userData = { kind: "bond", atoms: [bd[0], bd[1]], order: bd[2], baseR: s.r, a: s.a, b: s.b };
      placeCylinder(m, s.a, s.b, s.r); m.renderOrder = 1; group.add(m); bonds.push(m);
    }
  });
  // cloud amount 0 (ball model) .. 1 (electron cloud): atoms shrink so the translucent surface does not hide them; sticks get thinner. Positions never change.
  const setStyle = (amount) => {
    const f = BALL_SCALE.ball + (BALL_SCALE.cloud - BALL_SCALE.ball) * amount;
    atoms.forEach((m, i) => m.scale.setScalar(ELEM[mol.atoms[i].el].ball * f));
    bonds.forEach((m) => { const { a, b, baseR } = m.userData; placeCylinder(m, a, b, baseR * (1 - 0.35 * amount)); });
  };
  return { group, atoms, bonds, setStyle };
}

/** World-space picture of the object (after group.updateMatrixWorld): atom centres and the two end points of every stick. */
export function worldGeometry(obj) {
  obj.group.updateMatrixWorld(true);
  const atoms = obj.atoms.map((m) => new THREE.Vector3().setFromMatrixPosition(m.matrixWorld));
  const bonds = obj.bonds.map((m) => ({ atoms: m.userData.atoms, order: m.userData.order, a: new THREE.Vector3(0, -0.5, 0).applyMatrix4(m.matrixWorld), b: new THREE.Vector3(0, 0.5, 0).applyMatrix4(m.matrixWorld) }));
  return { atoms, bonds };
}
export { len };
