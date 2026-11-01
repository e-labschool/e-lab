// three.js side of the procedural orbitals: BufferGeometry built from a signed field, CACHED and SHARED by every orbital that has the
// same shape + palette (all hydrogen 1s orbitals use one geometry). Geometries are built ahead of time by warmGeometries() (idle-time
// slices, called when a tab / molecule is selected), so starting an animation never builds geometry; getOrbitalGeometry() is only a
// synchronous fallback. The Mix animation owns a few preallocated morph geometries that are rewritten in place (never re-created per
// frame). disposeAll() frees every GPU buffer on unmount.
import * as THREE from "three";
import { GRID, signedField, termsKey, fillPositions } from "./orbitalField.js";

const cache = new Map();
const morphPool = [];
export const stats = { built: 0, buildMs: 0, morphCreated: 0 };

function smoothSeam(g, normals) { // vertices of the first and last longitude coincide: average their normals
  const { rows, cols } = g;
  for (let i = 0; i < rows; i += 1) {
    const a = (i * cols) * 3; const b = (i * cols + cols - 1) * 3;
    for (let k = 0; k < 3; k += 1) { const m = (normals[a + k] + normals[b + k]) / 2; normals[a + k] = m; normals[b + k] = m; }
  }
}
/** Per-vertex colour by wavefunction phase: field >= 0 -> pos shade, field < 0 -> neg shade. */
export function applyColors(grid, field, pos, neg, colorAttr) {
  const c = colorAttr.array;
  for (let v = 0; v < grid.V; v += 1) { const col = field[v] >= 0 ? pos : neg; c[v * 3] = col.r; c[v * 3 + 1] = col.g; c[v * 3 + 2] = col.b; }
  colorAttr.needsUpdate = true;
}
function build(grid, field, pos, neg, taper) {
  const geo = new THREE.BufferGeometry();
  const p = new Float32Array(grid.V * 3); fillPositions(grid, field, p, taper);
  geo.setAttribute("position", new THREE.BufferAttribute(p, 3));
  const col = new THREE.BufferAttribute(new Float32Array(grid.V * 3), 3); applyColors(grid, field, pos, neg, col); geo.setAttribute("color", col);
  geo.setIndex(new THREE.BufferAttribute(grid.index, 1));
  geo.computeVertexNormals(); smoothSeam(grid, geo.attributes.normal.array);
  geo.computeBoundingSphere();
  return geo;
}
export const geometryKey = (terms, R, K, paletteName, pal, axis, width = 1) => `${R.toFixed(3)}|${K.toFixed(2)}|${termsKey(terms)}|${paletteName}|${pal.pos.getHexString()}${pal.neg.getHexString()}|${axis ? axis.map((v) => v.toFixed(3)).join(",") : ""}|${width}`;
export const hasGeometry = (terms, R, K, paletteName, pal, axis, width) => cache.has(geometryKey(terms, R, K, paletteName, pal, axis, width));

/** Shared geometry for terms [[kind, c]...] scaled to reach R with exponent K, coloured by the palette (pos / neg phase shade). */
export function getOrbitalGeometry(terms, R, K, paletteName, pal, axis = null, width = 1) {
  const key = geometryKey(terms, R, K, paletteName, pal, axis, width);
  let g = cache.get(key); if (g) return g;
  const t0 = performance.now();
  g = build(GRID, signedField(terms, R, K), pal.pos, pal.neg, axis ? { axis, strength: 1, R, width } : null); g.userData.shared = true; cache.set(key, g);
  stats.built += 1; stats.buildMs += performance.now() - t0; return g;
}

/** Build the geometries of `specs` (each {terms, R, K, palette}) in small idle-time slices; resolves when all are cached. */
export function warmGeometries(specs, paletteOf, { sliceMs = 6 } = {}) {
  const todo = []; const seen = new Set();
  for (const s of specs) {
    const pal = paletteOf(s.palette); const key = geometryKey(s.terms, s.R, s.K, s.palette, pal, s.axis, s.width);
    if (!cache.has(key) && !seen.has(key)) { seen.add(key); todo.push([s, pal]); }
  }
  return new Promise((resolve) => {
    if (!todo.length) { resolve(0); return; }
    const total = todo.length; let cancelled = false;
    const idle = typeof requestIdleCallback === "function" ? (fn) => requestIdleCallback(fn, { timeout: 120 }) : (fn) => setTimeout(() => fn({ timeRemaining: () => sliceMs }), 0);
    const run = (deadline) => {
      if (cancelled) { resolve(total - todo.length); return; }
      const t0 = performance.now();
      while (todo.length && (performance.now() - t0 < sliceMs || (deadline?.timeRemaining?.() ?? 0) > 2)) { const [s, pal] = todo.shift(); getOrbitalGeometry(s.terms, s.R, s.K, s.palette, pal, s.axis, s.width); if (performance.now() - t0 > 12) break; }
      if (todo.length) idle(run); else resolve(total);
    };
    idle(run);
    warmGeometries.cancel = () => { cancelled = true; };
  });
}

/** Preallocated geometry that the morph rewrites every frame (acquired from a small pool, returned when the morph ends). */
export function acquireMorphGeometry() {
  const reuse = morphPool.pop(); if (reuse) return reuse;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(GRID.V * 3), 3));
  geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(GRID.V * 3), 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(GRID.V * 3), 3));
  geo.setIndex(new THREE.BufferAttribute(GRID.index, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);
  stats.morphCreated += 1; return geo;
}
export function releaseMorphGeometry(geo) { if (morphPool.length < 8) morphPool.push(geo); else geo.dispose(); }
export function updateMorphNormals(geo) { geo.computeVertexNormals(); smoothSeam(GRID, geo.attributes.normal.array); geo.attributes.normal.needsUpdate = true; }
export function disposeAll() {
  warmGeometries.cancel?.();
  for (const g of cache.values()) g.dispose(); cache.clear();
  for (const g of morphPool) g.dispose(); morphPool.length = 0;
}
export const cacheSize = () => cache.size;

// ---- lifetime: both tabs share this cache; it is freed shortly after the LAST viewer unmounts (a tab switch re-mounts a viewer at once) ----
let users = 0; let disposeTimer = 0;
export function retainGeometry() { users += 1; if (disposeTimer) { clearTimeout(disposeTimer); disposeTimer = 0; } }
export function releaseGeometry(delayMs = 1500) {
  users = Math.max(0, users - 1);
  if (users === 0 && !disposeTimer) disposeTimer = setTimeout(() => { disposeTimer = 0; if (users === 0) disposeAll(); }, delayMs);
}
