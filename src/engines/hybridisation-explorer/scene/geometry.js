// three.js side of the procedural orbitals: BufferGeometry built from a signed field, cached and SHARED by every orbital that has
// the same shape + palette (e.g. all hydrogen 1s orbitals use one geometry). disposeAll() frees the GPU buffers on unmount.
import * as THREE from "three";
import { GRID_HIGH, GRID_LOW, signedField, termsKey, fillPositions } from "./orbitalField.js";

const cache = new Map();
export const gridOf = (low) => (low ? GRID_LOW : GRID_HIGH);

function smoothSeam(g, normals) { // vertices of the first and last longitude coincide: average their normals
  const { rows, cols } = g;
  for (let i = 0; i < rows; i += 1) {
    const a = (i * cols) * 3; const b = (i * cols + cols - 1) * 3;
    for (let k = 0; k < 3; k += 1) { const m = (normals[a + k] + normals[b + k]) / 2; normals[a + k] = m; normals[b + k] = m; }
  }
}
export function applyColors(grid, field, pos, neg, colorAttr) {
  const c = colorAttr.array;
  for (let v = 0; v < grid.V; v += 1) { const col = field[v] >= 0 ? pos : neg; c[v * 3] = col.r; c[v * 3 + 1] = col.g; c[v * 3 + 2] = col.b; }
  colorAttr.needsUpdate = true;
}
function build(grid, field, pos, neg) {
  const geo = new THREE.BufferGeometry();
  const p = new Float32Array(grid.V * 3); fillPositions(grid, field, p);
  geo.setAttribute("position", new THREE.BufferAttribute(p, 3));
  const col = new THREE.BufferAttribute(new Float32Array(grid.V * 3), 3); applyColors(grid, field, pos, neg, col); geo.setAttribute("color", col);
  geo.setIndex(new THREE.BufferAttribute(grid.index, 1));
  geo.computeVertexNormals(); smoothSeam(grid, geo.attributes.normal.array);
  geo.computeBoundingSphere();
  return geo;
}
/** Shared geometry for terms [[kind, c]...] scaled to reach R, coloured by the palette name+colors. */
export function getOrbitalGeometry(terms, R, paletteName, pal, low = false) {
  const grid = gridOf(low);
  const key = `${low ? "L" : "H"}|${R.toFixed(3)}|${termsKey(terms)}|${paletteName}|${pal.pos.getHexString()}${pal.neg.getHexString()}`;
  let g = cache.get(key); if (g) return g;
  g = build(grid, signedField(terms, R, grid), pal.pos, pal.neg); g.userData.shared = true; cache.set(key, g); return g;
}
/** A private geometry that a morph animation rewrites every frame. */
export function createMorphGeometry(grid) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(grid.V * 3), 3));
  geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(grid.V * 3), 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(grid.V * 3), 3));
  geo.setIndex(new THREE.BufferAttribute(grid.index, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);
  return geo;
}
export function updateMorphNormals(geo, grid) { geo.computeVertexNormals(); smoothSeam(grid, geo.attributes.normal.array); geo.attributes.normal.needsUpdate = true; }
export function disposeAll() { for (const g of cache.values()) g.dispose(); cache.clear(); }
export const cacheSize = () => cache.size;
