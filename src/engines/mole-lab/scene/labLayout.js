// Stage 3 bench layout (pure, unit-tested): where each piece of apparatus stands for every experiment and viewport shape.
// Rule: liquids always pour LEFT to RIGHT (packet -> cylinder -> beaker -> flask), so a pouring vessel moves to the right.
// Glassware keeps its real relative size; only the volumetric flask changes size with its volume (flaskScale in glassware.js).
import { makeVessel, flaskScale } from "./glassware.js";

const GAP = 0.8;
export const BALANCE_W = 3.6;
const halfWidth = (id, flaskMl) => (id.startsWith("balance") ? BALANCE_W / 2 : id === "cylinder" ? 0.5 : id === "beaker" ? 0.9 : id === "stock" ? 0.55 + 0.4 * flaskScale(250) : id.startsWith("flask") ? 0.72 * flaskScale(flaskMl[id.slice(5) || "A"] ?? 100) + 0.08 : id === "tap" ? 0.3 : 0.5);
const heightOf = (id, flaskMl) => (id.startsWith("balance") ? 2.4 : id === "cylinder" ? 2.6 : id === "beaker" ? 2.0 : id === "stock" ? makeVessel("flask", 250).height : id.startsWith("flask") ? makeVessel("flask", flaskMl[id.slice(5) || "A"] ?? 100).height : 3.4);

function rowXs(ids, flaskMl) {
  const hw = ids.map((i) => halfWidth(i, flaskMl)); let x = 0; const xs = [];
  hw.forEach((w, k) => { x += k === 0 ? w : hw[k - 1] + w + GAP; xs.push(x); });
  const total = x + hw[hw.length - 1]; return xs.map((v) => v - total / 2 + 0); // centred on 0 (left edge at -total/2 is the first item's left edge)
}

/**
 * @param kind "single" | "dilution" | "compare"
 * @param aspect viewport width / height; below `tall` the layout uses two rows (back row = glassware, front row = balances)
 * @param flaskMl { A, B } calibrated volumes
 * @returns { pos: { id: {x, z} }, extent: {minX, maxX, minZ, maxZ}, height, rows, order }
 */
export function labLayout({ kind, aspect = 1.8, flaskMl = { A: 100, B: 100 }, tall = 1.25 } = {}) {
  const twoRows = aspect < tall;
  const ids = kind === "single" ? ["balanceA", "cylinder", "beaker", "flaskA"] : kind === "dilution" ? ["stock", "cylinder", "flaskA"] : ["balanceA", "flaskA", "balanceB", "flaskB"];
  const pos = {};
  if (!twoRows) {
    const xs = rowXs(ids, flaskMl); ids.forEach((id, i) => { pos[id] = { x: xs[i], z: 0 }; });
  } else if (kind === "compare") {
    const back = ["flaskA", "flaskB"]; const front = ["balanceA", "balanceB"]; const xs = rowXs(front, flaskMl);
    front.forEach((id, i) => { pos[id] = { x: xs[i], z: 1.7 }; }); back.forEach((id, i) => { pos[id] = { x: xs[i], z: -1.5 }; });
  } else {
    const front = ids.filter((i) => i.startsWith("balance")); const back = ids.filter((i) => !i.startsWith("balance"));
    const xb = rowXs(back, flaskMl); back.forEach((id, i) => { pos[id] = { x: xb[i], z: -1.6 }; });
    if (front.length) { const lx = Math.min(...Object.values(pos).map((p) => p.x)); front.forEach((id) => { pos[id] = { x: lx + BALANCE_W / 2 - 0.4, z: 1.9 }; }); }
  }
  pos.tap = { x: (pos.cylinder?.x ?? pos.beaker?.x ?? 0) + 0.15, z: (pos.cylinder?.z ?? 0) - 1.2 };
  let minX = Infinity; let maxX = -Infinity; let minZ = Infinity; let maxZ = -Infinity; let height = 0;
  for (const id of ids) { const p = pos[id]; const w = halfWidth(id, flaskMl); minX = Math.min(minX, p.x - w); maxX = Math.max(maxX, p.x + w); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z + (id.startsWith("balance") ? 1.9 : 0.7)); height = Math.max(height, heightOf(id, flaskMl)); }
  // headroom for a vessel lifted over the next one to pour
  const pourHeadroom = kind === "compare" ? 0.4 : 1.6;
  return { pos, ids, extent: { minX, maxX, minZ, maxZ }, height: height + pourHeadroom, rows: twoRows ? 2 : 1 };
}
