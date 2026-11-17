// Bench layout and camera framing: pure functions (unit-tested), no three.js.
// Packets keep their standard size; more packets just take more bench and the camera moves back (never scales a bag).
import { BAG } from "./bagSpec.js";

export const SPACING_X = 2.15;
export const ROW_GAP_Z = 2.6;
export const BENCH_HALF_X = 9.2;
export const BENCH_HALF_Z = 4.6;

/**
 * @param rows  array of rows, each an array of item keys (bags or grouped stacks), front row LAST.
 * @param maxPerRow  wrap rows longer than this
 * @returns { pos: {[key]: {x,z}}, extent: {minX,maxX,minZ,maxZ}, rows: number }
 */
export function benchLayout(rows, { maxPerRow = 6, baseZ = 0 } = {}) {
  const wrapped = [];
  for (const r of rows) { if (!r.length) continue; for (let i = 0; i < r.length; i += maxPerRow) wrapped.push(r.slice(i, i + maxPerRow)); }
  const pos = {}; const n = wrapped.length;
  let minX = Infinity, maxX = -Infinity;
  wrapped.forEach((row, ri) => {
    const z = baseZ + (ri - (n - 1)) * ROW_GAP_Z; // the last row is at baseZ, earlier rows sit behind it
    row.forEach((k, i) => { const x = (i - (row.length - 1) / 2) * SPACING_X; pos[k] = { x, z }; minX = Math.min(minX, x - BAG.width / 2); maxX = Math.max(maxX, x + BAG.width / 2); });
  });
  if (!isFinite(minX)) { minX = -BAG.width / 2; maxX = BAG.width / 2; }
  const zs = Object.values(pos).map((p) => p.z); const minZ = zs.length ? Math.min(...zs) : 0; const maxZ = zs.length ? Math.max(...zs) : 0;
  return { pos, extent: { minX, maxX, minZ, maxZ }, rows: n };
}

/** Camera distance that frames `extent` for a viewport aspect ratio and vertical fov (degrees). */
export function fitDistance(extent, aspect, fovDeg = 32, { height = BAG.height, margin = 1.08 } = {}) {
  const halfW = ((extent.maxX - extent.minX) / 2) * margin + 0.35;
  const t = Math.tan((fovDeg * Math.PI) / 360);
  const dW = halfW / (t * Math.max(0.3, aspect));
  const halfH = (height / 2 + 0.45) * margin;
  const dH = halfH / t;
  return Math.max(dW, dH) + Math.max(0, extent.maxZ) + (extent.minZ < 0 ? -extent.minZ * 0.35 : 0);
}

/** Ground point nearest to (x, z), clamped inside the bench (a drag outside the experiment area can never lose a packet). */
export const clampToBench = (x, z) => ({ x: Math.min(BENCH_HALF_X, Math.max(-BENCH_HALF_X, x)), z: Math.min(BENCH_HALF_Z, Math.max(-BENCH_HALF_Z, z)) });
export const insideBench = (x, z) => Math.abs(x) <= BENCH_HALF_X && Math.abs(z) <= BENCH_HALF_Z;
/** Nearest key (other than `exceptKey`) whose centre is within `radius` of the ground point. */
export function nearestTarget(pos, x, z, exceptKey, radius = 1.25) {
  let best = null; let bd = radius;
  for (const [k, p] of Object.entries(pos)) { if (k === exceptKey) continue; const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = k; } }
  return best;
}
