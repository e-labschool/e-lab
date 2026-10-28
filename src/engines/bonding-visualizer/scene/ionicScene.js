// Ionic scene: pure function that turns (system, stage, progress, time) into drawable geometry.
// Phases of the ionisation animation (progress p of the "ionizing" stage):
//   0.00-0.28  atoms glide into the cluster, outer shells a small gap apart
//   0.28-0.88  electron(s) travel from the metal's outer shell to the non-metal's outer shell (colour kept)
//   0.88-1.00  the metal's emptied shell fades away and the charges appear
// Attraction is a SEPARATE second stage (progress q of the "attracting" stage): ions slide from the
// slightly-separated positions to contact.
import { getBondingElement, CORE_ELECTRON_COLOR, ELECTRON_PALETTE, chargeText } from "../model/elements.js";
import { ELECTRON_R, NUCLEUS_R, arrangementText, clamp01, easeInOut, electronsOfShells, lerp, polar, ringRadius, slotAngle, slotCount, slotIndexFor } from "./atomGeometry.js";

export const GAP = 24;
export const TOUCH = 2;
export const GATHER_END = 0.28;
export const TRANSFER_END = 0.88;
const TRANSFER_SPAN = 0.4;

/** Relative positions of the cluster (centre at 0,0). mode "sep": neutral radii + GAP; "touch": ion radii + TOUCH. */
export function clusterLayout(system, mode) {
  const rad = (id) => { const ion = system.byId[id]; return ringRadius(mode === "sep" ? ion.neutralShells.length : ion.ionShells.length); };
  const gap = mode === "sep" ? GAP : TOUCH;
  const out = {};
  const arr = system.arrangement;
  if (arr.kind === "row") {
    const xs = [0];
    for (let i = 1; i < arr.order.length; i += 1) xs.push(xs[i - 1] + rad(arr.order[i - 1]) + rad(arr.order[i]) + gap);
    const mid = xs[xs.length - 1] / 2;
    arr.order.forEach((id, i) => { out[id] = { x: xs[i] - mid, y: 0 }; });
  } else {
    out[arr.centre] = { x: 0, y: 0 };
    arr.ring.forEach((id, i) => {
      const D = rad(arr.centre) + rad(id) + gap;
      const ang = -Math.PI / 2 + (2 * Math.PI * i) / arr.ring.length;
      out[id] = { x: D * Math.cos(ang), y: D * Math.sin(ang) };
    });
  }
  return out;
}

/** Half extents of the cluster (for clamping inside the world). */
export function clusterExtent(system) {
  const rel = clusterLayout(system, "sep");
  let w = 0; let h = 0;
  for (const [id, p] of Object.entries(rel)) {
    const r = ringRadius(system.byId[id].neutralShells.length) + 26;
    w = Math.max(w, Math.abs(p.x) + r); h = Math.max(h, Math.abs(p.y) + r);
  }
  return { w, h };
}

/** Size factor so the whole cluster fits in the world (1 = full size). */
export function fitScale(system, world) {
  const e = clusterExtent(system);
  return Math.min(baseScale(world), (0.94 * world.W) / (2 * e.w), (0.94 * world.H) / (2 * e.h));
}

/** Drawing scale of atoms for a given canvas (bigger canvases draw bigger atoms). */
export function baseScale(world) { return Math.min(1.3, Math.max(0.55, world.W / 960)); }

/** Picks the electron colour for an atom (by order on the canvas). */
export const electronColor = (colorIdx) => ELECTRON_PALETTE[colorIdx % ELECTRON_PALETTE.length];

/**
 * atoms: [{id, symbol, x, y, colorIdx}] (canvas state), stage: "setup"|"ionizing"|"ionized"|"attracting"|"attracted".
 * Returns { atoms:[drawable], links, ionP, attrP, scale, centre }.
 */
export function ionicScene({ atoms, system, stage, p = 0, time = 0, world, offset = { x: 0, y: 0 } }) {
  const ionP = stage === "setup" ? 0 : stage === "ionizing" ? p : 1;
  const attrP = stage === "attracting" ? p : stage === "attracted" ? 1 : 0;
  const started = stage !== "setup";
  const S = system ? fitScale(system, world) : baseScale(world);

  // ---- positions
  const pos = {};
  if (!started || !system) {
    for (const a of atoms) pos[a.id] = { x: a.x, y: a.y };
  } else {
    const sep = clusterLayout(system, "sep");
    const touch = clusterLayout(system, "touch");
    const cx0 = atoms.reduce((s, a) => s + a.x, 0) / atoms.length;
    const cy0 = atoms.reduce((s, a) => s + a.y, 0) / atoms.length;
    const e = clusterExtent(system);
    const cx = Math.min(world.W - e.w * S, Math.max(e.w * S, cx0));
    const cy = Math.min(world.H - e.h * S, Math.max(e.h * S, cy0));
    const g = easeInOut(ionP / GATHER_END);
    const q = attrP * attrP * (1.6 - 0.6 * attrP); // accelerates: attraction grows as ions approach
    for (const a of atoms) {
      const target = { x: cx + lerp(sep[a.id].x, touch[a.id].x, q) * S, y: cy + lerp(sep[a.id].y, touch[a.id].y, q) * S };
      pos[a.id] = ionP >= GATHER_END ? target : { x: lerp(a.x, target.x, g), y: lerp(a.y, target.y, g) };
    }
  }
  for (const id of Object.keys(pos)) { pos[id] = { x: pos[id].x + offset.x, y: pos[id].y + offset.y }; }

  // ---- electrons
  const drawables = atoms.map((a) => {
    const el = getBondingElement(a.symbol);
    return { id: a.id, symbol: a.symbol, x: pos[a.id].x, y: pos[a.id].y, color: el.color, shells: el.shells, electrons: [], rings: [], label: "", charge: 0, chargeOpacity: 0, outerR: 0, colorIdx: a.colorIdx };
  });
  const byId = Object.fromEntries(drawables.map((d) => [d.id, d]));

  // transfers assigned to specific electrons
  const outgoing = {}; const incoming = {};
  const plan = [];
  if (system && started) {
    system.transfers.forEach((t, j) => {
      const fromIon = system.byId[t.from]; const toIon = system.byId[t.to];
      const donorOuter = fromIon.neutralShells.length;
      const fromIndex = (outgoing[t.from] = (outgoing[t.from] ?? 0) + 1) - 1; // 0,1,2...
      const toIndex = (incoming[t.to] = (incoming[t.to] ?? 0) + 1) - 1;
      const acceptorOuterK = toIon.neutralShells.length;
      const S8 = slotCount(acceptorOuterK, toIon.neutralShells[acceptorOuterK - 1], true);
      const startAt = GATHER_END + (TRANSFER_END - GATHER_END - TRANSFER_SPAN) * (system.transfers.length > 1 ? j / (system.transfers.length - 1) : 0);
      plan.push({ ...t, j, donorOuter, fromIndex, toIndex, acceptorOuterK, slotTo: slotIndexFor(toIon.neutralShells[acceptorOuterK - 1] + toIndex, S8), S8, startAt });
    });
  }
  const moving = {};
  for (const t of plan) moving[`${t.from}:${t.donorOuter}:${t.fromIndex}`] = t;

  const counts = {}; // atom id -> shell index -> electrons currently owned
  for (const d of drawables) counts[d.id] = d.shells.map(() => 0);

  for (const d of drawables) {
    const colour = electronColor(d.colorIdx);
    for (const e of electronsOfShells(d.shells)) {
      const key = `${d.id}:${e.k}:${e.i}`;
      const t = moving[key];
      const ownAng = slotAngle(e.k, e.slot, e.S, time);
      const own = polar(d.x, d.y, ringRadius(e.k) * S, ownAng);
      let ownerId = d.id; let ownerK = e.k; let px = own.x; let py = own.y; let done = false;
      if (t) {
        const u = clamp01((ionP - t.startAt) / TRANSFER_SPAN);
        const acc = byId[t.to];
        const dest = polar(acc.x, acc.y, ringRadius(t.acceptorOuterK) * S, slotAngle(t.acceptorOuterK, t.slotTo, t.S8, time));
        const f = easeInOut(u);
        const dx = dest.x - own.x; const dy = dest.y - own.y; const len = Math.hypot(dx, dy) || 1;
        const arc = Math.sin(Math.PI * f) * Math.min(26, len * 0.18);
        px = lerp(own.x, dest.x, f) + (-dy / len) * arc;
        py = lerp(own.y, dest.y, f) + (dx / len) * arc;
        if (u >= 0.5) { ownerId = t.to; ownerK = t.acceptorOuterK; }
        done = u >= 1;
      }
      counts[ownerId][ownerK - 1] += 1;
      d.electrons.push({ id: key, x: px, y: py, color: e.core ? CORE_ELECTRON_COLOR : colour, core: e.core, home: d.id, arrived: done });
    }
  }

  // ---- rings, labels, charges
  const fade = clamp01((ionP - TRANSFER_END) / (1 - TRANSFER_END));
  for (const d of drawables) {
    const ion = system?.byId[d.id];
    const n = d.shells.length;
    const donor = ion && ion.charge > 0;
    d.rings = d.shells.map((_, i) => ({ k: i + 1, r: ringRadius(i + 1) * S, opacity: donor && i + 1 === n ? 1 - fade : 1 }));
    d.label = arrangementText(counts[d.id]);
    d.charge = started && ion ? ion.charge : 0;
    d.chargeOpacity = started && ion ? fade : 0;
    d.chargeText = ion ? chargeText(d.symbol, ion.charge) : d.symbol;
    d.currentOuterR = ringRadius(Math.max(1, counts[d.id].reduce((last, c, i) => (c > 0 ? i + 1 : last), 1))) * S;
    d.outerR = ringRadius(n) * S;
    d.scale = S;
  }

  // ---- links between neighbours during the attraction stage
  const links = [];
  if (system && attrP > 0) {
    const pairs = system.arrangement.kind === "row"
      ? system.arrangement.order.slice(1).map((id, i) => [system.arrangement.order[i], id])
      : system.arrangement.ring.map((id) => [system.arrangement.centre, id]);
    for (const [a, b] of pairs) links.push({ a, b, opacity: Math.min(1, attrP * 4) * (1 - 0.0) });
  }
  return { atoms: drawables, links, ionP, attrP, scale: S, started };
}

export { NUCLEUS_R, ELECTRON_R };
