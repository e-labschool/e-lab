// Shared geometry and orientation helpers of the proton model (three.js, no React).
//
// The proton is drawn as a small sphere whose pole axis is the magnetic-moment direction. The surface carries a rotation cue (a deeper-blue
// equator band, a light cap at the pole the arrow leaves from, and an amber meridian stripe plus a faint opposite one): when the sphere turns
// about its axis the stripes travel round it, so the motion is readable even on a small sphere.
// IMPORTANT (stated in the UI): this is a conceptual aid. Proton spin is a quantum property, not a ball rotating like a planet.
import * as THREE from "three";

const Z = new THREE.Vector3(0, 0, 1);
const Y = new THREE.Vector3(0, 1, 0);
export const PROTON_COLORS = { body: "#a9d8ff", band: "#2a62d9", cap: "#f4fbff", stripe: "#fbbf24", stripe2: "#e9f2ff" };

/** Unit sphere, pole along +Z, with vertex colours for the rotation cue. */
export function makeProtonGeometry(wSeg = 28, hSeg = 18) {
  const g = new THREE.SphereGeometry(1, wSeg, hSeg).rotateX(Math.PI / 2); // poles Y -> Z
  const pos = g.attributes.position; const col = new Float32Array(pos.count * 3);
  const body = new THREE.Color(PROTON_COLORS.body); const band = new THREE.Color(PROTON_COLORS.band); const cap = new THREE.Color(PROTON_COLORS.cap);
  const s1 = new THREE.Color(PROTON_COLORS.stripe); const s2 = new THREE.Color(PROTON_COLORS.stripe2); const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i); const y = pos.getY(i); const z = pos.getZ(i);
    const lat = Math.asin(Math.max(-1, Math.min(1, z))); const lon = Math.atan2(y, x);
    c.copy(body);
    if (Math.abs(lat) < 0.2) c.copy(band);
    if (lat > 1.12) c.copy(cap);
    const dl = Math.abs(Math.atan2(Math.sin(lon), Math.cos(lon)));
    if (dl < 0.3 && Math.abs(lat) >= 0.2) c.copy(s1);
    else if (Math.abs(dl - Math.PI) < 0.22 && Math.abs(lat) >= 0.2) c.copy(s2);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

/** Arrow parts along +Z: shaft from z = 0 to `shaftLen`, cone head of length `headLen` after it. Unit radius scale is applied by the caller. */
export function makeShaftGeometry(radius, length) {
  return new THREE.CylinderGeometry(radius, radius, length, 8).rotateX(Math.PI / 2).translate(0, 0, length / 2);
}
export function makeHeadGeometry(radius, length) {
  return new THREE.ConeGeometry(radius, length, 14).rotateX(Math.PI / 2).translate(0, 0, length / 2);
}

const qa = new THREE.Quaternion(); const qb = new THREE.Quaternion(); const qc = new THREE.Quaternion();
/**
 * Orientation that maps +Z onto the unit vector d and then (optionally) turns the body by `roll` about its own axis:
 * q = Rz(phi) * Ry(theta) * Rz(roll). Built from the spherical angles of d, so it is continuous while d moves round a cone (no roll flips).
 */
export function orient(out, d, roll = 0) {
  const theta = Math.acos(Math.max(-1, Math.min(1, d[2]))); const phi = Math.atan2(d[1], d[0]);
  qa.setFromAxisAngle(Z, phi); qb.setFromAxisAngle(Y, theta);
  out.copy(qa).multiply(qb);
  if (roll) { qc.setFromAxisAngle(Z, roll); out.multiply(qc); }
  return out;
}
