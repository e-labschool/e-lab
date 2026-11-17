// Deterministic particle SLOT layout for the standard packet.  Pure (no three.js): positions are plain arrays so the tests can
// check them.  Slot i is ALWAYS at the same place for the same (mode, detail): showing more material only reveals more slots
// from the bottom up, so the particle population never shuffles or flickers (spec B3: no randomly changing counts).
import { BAG } from "./bagSpec.js";
import { FULL_ENTITIES } from "../engine/particles.js";

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const MODE_SEED = { molecular: 11, ionic: 23, metallic: 37 };
const MODE_JITTER = { molecular: 0.2, ionic: 0, metallic: 0.04 };

/**
 * @returns {{ N:number, slots: {x:number,y:number,z:number,i:number,j:number,k:number,row:number,qx:number,qy:number,qz:number,qw:number}[], radius:number, rows:number, cols:number }}
 *   `radius` = radius of the sphere that encloses one representative entity (scene units).
 */
export function buildSlots(mode, detail) {
  const N = FULL_ENTITIES[detail]; if (!N) throw new Error(`Unknown detail level "${detail}"`);
  const I = BAG.interior; const W = I.x * 2; const H = I.yMax - I.yMin; const D = I.z * 2;
  const s0 = Math.cbrt((W * H * D) / N);
  const cols = Math.max(3, Math.floor(W / (s0 * 1.04))); const layersZ = 2;
  const rows = Math.ceil(N / (cols * layersZ));
  const dx = W / cols; const dy = H / rows;
  const r = rng(MODE_SEED[mode] ?? 1); const jit = MODE_JITTER[mode] ?? 0.2;
  const all = [];
  for (let row = 0; row < rows; row += 1) {
    const rowSlots = [];
    for (let k = 0; k < layersZ; k += 1) for (let i = 0; i < cols; i += 1) {
      const stagger = mode === "ionic" ? 0 : ((row + k) % 2 ? 0.22 : -0.22) * dx;
      const x = -I.x + dx * (i + 0.5) + stagger + (r() - 0.5) * jit * dx;
      const y = I.yMin + dy * (row + 0.5) + (r() - 0.5) * jit * dy;
      const z = (k === 0 ? -1 : 1) * I.z * 0.55 + (r() - 0.5) * jit * I.z * 0.5;
      // random orientation (unit quaternion), deterministic
      const u1 = r(), u2 = r(), u3 = r(); const a = Math.sqrt(1 - u1), b = Math.sqrt(u1);
      rowSlots.push({ x: Math.max(-I.x, Math.min(I.x, x)), y, z, i, j: row, k, row, qx: a * Math.sin(2 * Math.PI * u2), qy: a * Math.cos(2 * Math.PI * u2), qz: b * Math.sin(2 * Math.PI * u3), qw: b * Math.cos(2 * Math.PI * u3) });
    }
    // organic partial rows: shuffle the order in which slots of ONE row appear (the same shuffle every time)
    for (let q = rowSlots.length - 1; q > 0; q -= 1) { const j = Math.floor(r() * (q + 1)); [rowSlots[q], rowSlots[j]] = [rowSlots[j], rowSlots[q]]; }
    all.push(...rowSlots);
  }
  const slots = all.slice(0, N).map((p, i) => ({ ...p, i: p.i, index: i }));
  const radius = Math.min(dx, dy * 1.05, D * 0.55) * (mode === "metallic" ? 0.62 : mode === "ionic" ? 0.6 : 0.6);
  return { N, slots, radius, rows, cols, dx, dy };
}
