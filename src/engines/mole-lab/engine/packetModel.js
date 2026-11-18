// SHARED PACKET MODEL (pure, no three.js): how ONE standard one-mole packet is filled, for every stage.
//   amount n (mol) -> packets [1, 1, 0.5]  (full packets + one partial)  -> representative groups per packet -> instance matrices.
// Chemistry never reads anything from here; this is the one-way bridge chemistry -> picture (see particles.js).
import { decompose, fillFraction } from "./packets.js";
import { toQuanta, ONE_MOLE_Q } from "./numeric.js";
import { FULL_ENTITIES, particleModel } from "./particles.js";
import { getSubstance } from "./substances.js";

/** The ONE bag: identical for every substance and amount (never rescaled).  Units are scene units. */
export const BAG = Object.freeze({
  width: 2.5, height: 3.1, depth: 0.74, zipY: 2.52, zipGap: 0.1,
  pile: Object.freeze({ w: 2.04, d: 0.6, h: 1.85, x0: -1.02, y0: 0.16 }), // box the particles may occupy (centre limits are inset by the particle radius)
});

/** n (mol) -> { packets:[fraction...], full, partial, count }.  2.5 -> [1,1,0.5].  Pure; integer quanta underneath. */
export function packetLayout(nMol) {
  const d = decompose(toQuanta(nMol));
  const packets = d.packetsQ.map((q) => fillFraction(q));
  return { packets, full: d.fullCount, partial: d.partialFraction, count: d.packetCount, totalQ: d.totalQ };
}

/** Number of representative groups drawn for a fill fraction (prefix of the slot list, so a half packet shows the lower half). */
export function groupsFor(fraction, detail = "medium") {
  const N = FULL_ENTITIES[detail]; if (!N) throw new Error(`Unknown detail level "${detail}"`);
  if (!(fraction > 0)) return 0; if (fraction >= 1) return N;
  return Math.min(N - 1, Math.max(1, Math.round(fraction * N)));
}

// deterministic PRNG
function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function randQuat(r) { const u1 = r(), u2 = r(), u3 = r(); const a = Math.sqrt(1 - u1), b = Math.sqrt(u1); return [a * Math.sin(2 * Math.PI * u2), a * Math.cos(2 * Math.PI * u2), b * Math.sin(2 * Math.PI * u3), b * Math.cos(2 * Math.PI * u3)]; }

/** Slot grid for N particles inside BAG.pile, ordered bottom-up.  kind: "close" (hex-like, jittered) | "lattice" (cubic, ordered) | "loose" (dispersed). */
export function buildSlots(kind, N, jitterScale = 1) {
  const { w, d, h, x0, y0 } = BAG.pile; const r = rng(kind === "lattice" ? 7 : 11);
  const loose = kind === "loose" ? 1.28 : 1;
  let s = 0.3; let cols = 1, lay = 1, rows = 1; const dyk = kind === "lattice" ? 1 : 0.82;
  for (; s > 0.06; s -= 0.002) {
    cols = Math.max(1, Math.floor(w / (s * loose))); lay = Math.max(1, Math.floor(d / (s * loose))); rows = Math.floor(h / (s * dyk * loose));
    if (cols * lay * rows >= N) break;
  }
  const perRow = cols * lay; const nRows = Math.ceil(N / perRow);
  const dy = Math.min(h / nRows, s * dyk * loose * 1.18);
  const cw = w / cols, cd = d / lay; const slots = [];
  for (let i = 0; i < N; i += 1) {
    const row = Math.floor(i / perRow); const j = i % perRow; const c = j % cols; const l = Math.floor(j / cols);
    const off = kind === "lattice" ? 0 : (row % 2) * 0.5 * cw * 0.5 + (l % 2) * 0.25 * cw;
    const jit = kind === "lattice" ? 0 : (kind === "loose" ? 0.3 : 0.16 * jitterScale) * s;
    const x = x0 + cw * (c + 0.5) + off + (r() - 0.5) * 2 * jit;
    const z = -d / 2 + cd * (l + 0.5) + (r() - 0.5) * 2 * jit * 0.6;
    const y = y0 + dy * (row + 0.5) + (r() - 0.5) * 2 * jit * 0.5;
    slots.push({ x: Math.max(x0 + s * 0.4, Math.min(x0 + w - s * 0.4, x)), y, z, row, ci: c, li: l, q: kind === "lattice" ? [0, 0, 0, 1] : randQuat(r) });
  }
  if (kind !== "lattice") { // irregular heap surface: order by height plus a gentle dome and noise, so a partial fill has a natural top
    const key = (sl) => sl.y + 0.35 * s * Math.sin(sl.x * 2.7 + sl.z * 4) + 0.3 * s * Math.sin(sl.x * 6.1 - 1) - 0.12 * Math.abs(sl.x);
    const ys = slots.map((sl) => sl.y).sort((a, b) => a - b); slots.sort((a, b) => key(a) - key(b)); slots.forEach((sl, i) => { sl.row = Math.floor(i / perRow); });
    void ys;
  }
  return { slots, spacing: Math.min(cw, cd * 1.2, s * 1.05), rows: nRows, kind };
}

/** What kind of drawing a substance gets. */
export function drawKind(substanceId) {
  const s = getSubstance(substanceId);
  if (s.kind === "ionic") return "lattice"; if (s.kind === "aqueous-ionic") return "loose";
  if (s.kind === "metallic" || s.kind === "atomic-solid") return "close"; return "close";
}

function norm(atoms, bonds) {
  const ext = Math.max(1e-6, ...atoms.map((a) => Math.hypot(a.x, a.y, a.z) + a.r));
  return { atoms: atoms.map((a) => ({ ...a, x: a.x / ext, y: a.y / ext, z: a.z / ext, r: a.r / ext })), bonds };
}
/** Species templates: molecular -> [molecule]; metallic -> [atom]; ionic -> one per ion with a species pattern from the formula ratio. */
export function packetTemplates(substanceId) {
  const s = getSubstance(substanceId); const pm = particleModel(substanceId);
  const ents = pm.entities.map((e) => ({ label: e.label, charge: e.charge ?? 0, ...norm(e.atoms, e.bonds) }));
  if (pm.mode !== "ionic") return { mode: pm.mode, species: ents, pattern: [0] };
  // relative ion sizes: biggest ion fills its cell, others are smaller (this is the real size trend, not a measure of mass)
  const rel = ents.map((e) => Math.max(...e.atoms.map((a) => Math.hypot(a.x, a.y, a.z) + a.r)));
  const rmax = Math.max(...pm.entities.map((e) => Math.max(...e.atoms.map((a) => a.r))));
  const species = ents.map((e, i) => { const rr = Math.max(...pm.entities[i].atoms.map((a) => a.r)) / rmax; const f = Math.max(0.55, Math.min(1, rr * 1.15)); return { ...e, scale: f }; });
  void rel;
  const counts = s.ions.map((i) => i.count); const pattern = []; counts.forEach((c, i) => { for (let k = 0; k < c; k += 1) pattern.push(i); });
  if (counts.length === 2 && counts[0] === counts[1]) return { mode: "ionic", species, pattern: [0, 1], checker: true };
  // interleave for 2:3 -> 0,1,0,1,1
  const out = []; const left = [...counts]; let i = 0; while (left.some((x) => x > 0)) { if (left[i % left.length] > 0) { out.push(i % left.length); left[i % left.length] -= 1; } i += 1; }
  return { mode: "ionic", species, pattern: out, checker: false };
}

const sqr = (x) => x * x;
function rotate(q, v) { const [x, y, z, w] = q; const [vx, vy, vz] = v; const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx); return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)]; }
function quatFromY(dx, dy, dz) { const l = Math.hypot(dx, dy, dz) || 1; const ux = dx / l, uy = dy / l, uz = dz / l; // rotate (0,1,0) -> u
  const dot = uy; if (dot > 0.99999) return [0, 0, 0, 1]; if (dot < -0.99999) return [1, 0, 0, 0];
  const ax = uz, az = -ux; const s = Math.sqrt((1 + dot) * 2); return [ax / s, 0, az / s, s / 2]; }
function compose(out, o, p, q, s) { const [x, y, z, w] = q; const [sx, sy, sz] = s;
  const x2 = x + x, y2 = y + y, z2 = z + z, xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
  out[o] = (1 - (yy + zz)) * sx; out[o + 1] = (xy + wz) * sx; out[o + 2] = (xz - wy) * sx; out[o + 3] = 0;
  out[o + 4] = (xy - wz) * sy; out[o + 5] = (1 - (xx + zz)) * sy; out[o + 6] = (yz + wx) * sy; out[o + 7] = 0;
  out[o + 8] = (xz + wy) * sz; out[o + 9] = (yz - wx) * sz; out[o + 10] = (1 - (xx + yy)) * sz; out[o + 11] = 0;
  out[o + 12] = p[0]; out[o + 13] = p[1]; out[o + 14] = p[2]; out[o + 15] = 1; }
void sqr;

/**
 * Instance data for ONE FULL packet (the caller shows a prefix of `groups`).
 *   atoms: { [el]: { matrices: Float32Array, group: Uint16Array, count, prefix(k) } }   spheres (unit sphere scaled by the atom radius)
 *   bonds: { matrices, group, count, prefix(k) }                                        unit cylinders along y
 *   groups: N, drawn kind, species per group, spacing
 */
export function buildPacketInstances(substanceId, detail = "medium", { sizeBoost = {} } = {}) {
  const N = FULL_ENTITIES[detail]; const kind = drawKind(substanceId); const T = packetTemplates(substanceId);
  const { slots, spacing } = buildSlots(kind, N, T.mode === "metallic" ? 1.7 : 1); const R = spacing * 0.5 * (kind === "lattice" ? 0.98 : T.mode === "molecular" ? 1.48 : 1.04);
  const perEl = {}; const bondList = []; const speciesOf = new Uint8Array(N);
  const ensure = (el) => (perEl[el] ??= { list: [] });
  for (let g = 0; g < N; g += 1) {
    const sl = slots[g]; const sp = T.mode === "ionic" ? (T.checker ? (sl.ci + sl.li + sl.row) % 2 : T.pattern[g % T.pattern.length]) : 0; speciesOf[g] = sp;
    const tpl = T.species[sp]; const k = R * (tpl.scale ?? 1) * (T.mode === "ionic" ? 1 : 1);
    const wp = tpl.atoms.map((a) => { const v = rotate(sl.q, [a.x, a.y, a.z]); return { el: a.el, p: [sl.x + v[0] * k, sl.y + v[1] * k, sl.z + v[2] * k], r: a.r * k * (sizeBoost[a.el] ?? 1) }; });
    for (const a of wp) ensure(a.el).list.push({ g, p: a.p, r: a.r });
    for (const b of tpl.bonds) { const A = wp[b.a], B = wp[b.b]; const dx = B.p[0] - A.p[0], dy = B.p[1] - A.p[1], dz = B.p[2] - A.p[2]; bondList.push({ g, mid: [(A.p[0] + B.p[0]) / 2, (A.p[1] + B.p[1]) / 2, (A.p[2] + B.p[2]) / 2], len: Math.hypot(dx, dy, dz), q: quatFromY(dx, dy, dz), r: Math.min(A.r, B.r) * 0.42 }); }
  }
  const prefixer = (groupArr) => (k) => { let lo = 0, hi = groupArr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (groupArr[m] < k) lo = m + 1; else hi = m; } return lo; };
  const atoms = {};
  for (const [el, { list }] of Object.entries(perEl)) {
    const matrices = new Float32Array(list.length * 16); const group = new Uint16Array(list.length);
    list.forEach((it, i) => { compose(matrices, i * 16, it.p, [0, 0, 0, 1], [it.r, it.r, it.r]); group[i] = it.g; });
    atoms[el] = { matrices, group, count: list.length, prefix: prefixer(group) };
  }
  const bm = new Float32Array(bondList.length * 16); const bg = new Uint16Array(bondList.length);
  bondList.forEach((b, i) => { compose(bm, i * 16, b.mid, b.q, [b.r, b.len, b.r]); bg[i] = b.g; });
  return { groups: N, kind, mode: T.mode, atoms, bonds: { matrices: bm, group: bg, count: bondList.length, prefix: prefixer(bg) }, speciesOf, templates: T, spacing, radius: R, slots };
}

/** Atom tally of the first k drawn groups, per element (tests: H2O -> 2:1 ...). */
export function drawnAtomTally(inst, k = inst.groups) { const o = {}; for (const [el, a] of Object.entries(inst.atoms)) o[el] = a.prefix(k); return o; }
/** Species tally of the first k groups (ionic: ions per species). */
export function drawnSpeciesTally(inst, k = inst.groups) { const o = new Array(inst.templates.species.length).fill(0); for (let g = 0; g < k; g += 1) o[inst.speciesOf[g]] += 1; return o; }
export { ONE_MOLE_Q };

/** Bench positions for groups of packets: groups = [n1, n2, ...] packets each; returns { xs: [[x...]...], centres: [...], width }.  Identical pitch for every bag. */
export function layoutRow(groups, { pitch = BAG.width + 0.4, gap = 1.9 } = {}) {
  const widths = groups.map((n) => Math.max(0, n) * pitch - (n > 0 ? 0.4 : 0));
  const total = widths.reduce((a, b) => a + b, 0) + gap * Math.max(0, groups.filter((n) => n > 0).length - 1);
  let x = -total / 2; const xs = []; const centres = [];
  groups.forEach((n, gi) => { const row = []; for (let i = 0; i < n; i += 1) row.push(x + BAG.width / 2 + i * pitch); xs.push(row); centres.push(x + widths[gi] / 2); x += widths[gi] + (n > 0 ? gap : 0); });
  return { xs, centres, width: total };
}
