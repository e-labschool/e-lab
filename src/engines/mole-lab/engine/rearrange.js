// STAGES 5 and 6 -- the ATOM-REARRANGEMENT PLAN behind the reaction animation.  Pure geometry and bookkeeping, no three.js.
//
// A plan describes representative molecules drawn in the reaction zone and how EVERY ATOM travels from a reactant molecule to a
// product molecule.  Atoms never appear or vanish: each track is ONE atom (an element) that starts in a reactant entity and ends in
// a product entity, so the displayed atoms are conserved by construction; `planLedger` re-counts them independently (reactant
// entities vs product entities) and the tests compare the two sides for every reaction.  Charges are tracked per atom (an ion
// is an atom or group carrying a charge) and `planLedger` checks the charge balance too.
//
// The drawn COUNTS are derived from the engine's amounts (n x P drawn molecules per mole, see drawScale) and are only a picture:
// no chemistry is ever computed from them.
import { getReaction, reactants, products } from "./reactions.js";
import { getSubstance } from "./substances.js";
import { atomRadius } from "./particles.js";
import { fromQuanta } from "./numeric.js";

export const POS_SCALE = 0.34;    // scene units per angstrom
export const RAD_K = 0.46;        // atom radius = particles.atomRadius x RAD_K
export const ZONE_BOX = Object.freeze({ x: 2.7, yMin: 0.3, yMax: 2.05, z: 0.62 }); // half-width x, y range, half-depth z (zone-local coordinates)
export const DEFAULT_PER_MOL = 3;

/** Drawn molecules per mole: at most 3, fewer when many moles are present (<= 48 molecules) or many reaction events would be drawn (<= 8). */
export function drawScale(totalMol, maxExtentMol, { perMol = DEFAULT_PER_MOL, maxMolecules = 48, maxEvents = 6 } = {}) {
  const a = perMol; const b = totalMol > 0 ? maxMolecules / Math.max(1, totalMol) : perMol; const c = maxExtentMol > 0 ? maxEvents / maxExtentMol : perMol;
  return Math.max(0.05, Math.min(a, b, c));
}
/** Number of molecules drawn for an amount of q quanta (>= 1 whenever any material is present). */
export const drawnCount = (q, P) => (q > 0 ? Math.max(1, Math.round(fromQuanta(q) * P)) : 0);

// ---------------------------------------------------------------------------------------------- small deterministic helpers
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i += 1) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function rng(seed) { let a = typeof seed === "string" ? hash(seed) : seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const halton = (i, b) => { let f = 1; let r = 0; let n = i + 1; while (n > 0) { f /= b; r += f * (n % b); n = Math.floor(n / b); } return r; };
function quatFromAxisAngle(ax, ay, az, ang) { const n = Math.hypot(ax, ay, az) || 1; const s = Math.sin(ang / 2) / n; return [ax * s, ay * s, az * s, Math.cos(ang / 2)]; }
function rotate(q, v) { const [x, y, z, w] = q; const [vx, vy, vz] = v; const tx = 2 * (y * vz - z * vy); const ty = 2 * (z * vx - x * vz); const tz = 2 * (x * vy - y * vx); return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)]; }
export const quatRandom = (r) => { const u1 = r(), u2 = r(), u3 = r(); const a = Math.sqrt(1 - u1), b = Math.sqrt(u1); return [a * Math.sin(2 * Math.PI * u2), a * Math.cos(2 * Math.PI * u2), b * Math.sin(2 * Math.PI * u3), b * Math.cos(2 * Math.PI * u3)]; };
const qz = (ang) => quatFromAxisAngle(0, 0, 1, ang);

// ---------------------------------------------------------------------------------------------- entity templates
/**
 * What ONE formula unit of a substance looks like as drawn entities.  Returns an array of "units": molecular = 1 molecule;
 * metal = 1 atom; ionic SOLID = 1 touching ion pair (no bond, drawn like a lattice cell); aqueous ionic = SEPARATE hydrated ions
 * (one entity per ion: no intact NaOH ever appears in solution).
 * unit = { label, atoms: [{ el, x, y, z, r, charge }], bonds: [{ a, b, order }], ion }
 */
export function entityTemplates(substanceId) {
  const s = getSubstance(substanceId);
  const centre = (atoms) => { const c = atoms.reduce((a, p) => [a[0] + p.x / atoms.length, a[1] + p.y / atoms.length, a[2] + p.z / atoms.length], [0, 0, 0]); return atoms.map((a) => ({ ...a, x: a.x - c[0], y: a.y - c[1], z: a.z - c[2] })); };
  const mk = (atoms, bonds = [], label = s.formulaDisplay, ion = false) => ({ label, atoms: centre(atoms.map((a) => ({ ...a, r: atomRadius(a.el, a.charge || 0) * RAD_K }))), bonds, ion });
  if (s.kind === "molecular") return [mk(s.geometry.atoms.map((a) => ({ el: a.el, x: a.x * POS_SCALE, y: a.y * POS_SCALE, z: a.z * POS_SCALE, charge: 0 })), s.geometry.bonds.map((b) => ({ ...b })))];
  if (s.kind === "metallic") return [mk([{ el: s.formula, x: 0, y: 0, z: 0, charge: 0 }], [], `${s.formula} atom`)];
  const ionUnit = (i) => {
    if (Object.values(i.composition).reduce((a, b) => a + b, 0) > 1) return mk([{ el: "O", x: 0, y: 0, z: 0, charge: i.charge }, { el: "H", x: 0.97 * POS_SCALE, y: 0, z: 0, charge: 0 }], [{ a: 0, b: 1, order: 1 }], i.label, true);
    return mk([{ el: Object.keys(i.composition)[0], x: 0, y: 0, z: 0, charge: i.charge }], [], i.label, true);
  };
  const units = s.ions.flatMap((i) => Array.from({ length: i.count }, () => ionUnit(i)));
  if (s.kind === "aqueous-ionic") return units;
  // ionic solid: one touching pair along x (Mg2+ O2-): drawn as a lattice cell, no covalent bond
  const atoms = []; let x = 0;
  for (const u of units) { const a = u.atoms[0]; atoms.push({ ...a, x: x + (atoms.length ? a.r * 0.9 : 0), y: 0, z: 0 }); x = atoms[atoms.length - 1].x + a.r * 0.9; }
  return [{ label: s.formulaDisplay, atoms: centre(atoms), bonds: [], ion: true, pair: true }];
}

// ---------------------------------------------------------------------------------------------- rest positions (zone-local)
/**
 * Where entity `idx` of `count` of one species rests inside the zone.  Gases roam the whole box, liquids and solutions sit in a low band,
 * a metal rests as a small block (floating above a liquid when the reaction has one), an ionic solid is a checkerboard patch.
 * returns { pos:[x,y,z], rotZ }
 */
export function restPosition(kind, idx, count, ctx = {}) {
  const B = ZONE_BOX; const sd = ctx.salt ?? 0;
  const h = (b, off = 0) => halton(idx + off + Math.floor(sd * 7), b);
  if (kind === "g") return { pos: [(h(2) * 2 - 1) * (B.x - 0.4), B.yMin + 0.35 + h(3) * (B.yMax - B.yMin - 0.5), (h(5) * 2 - 1) * (B.z - 0.15)], rotZ: 0 };
  if (kind === "l") return { pos: [(h(2) * 2 - 1) * (B.x - 0.4), B.yMin + 0.12 + h(3) * 0.5, (h(5) * 2 - 1) * (B.z - 0.15)], rotZ: 0 };
  if (kind === "aq") return { pos: [(h(2) * 2 - 1) * (B.x - 0.4), B.yMin + 0.15 + h(3) * 0.95, (h(5) * 2 - 1) * (B.z - 0.15)], rotZ: 0 };
  if (kind === "s-metal") { // small cubic block, floating on the liquid when there is one
    const cols = 3; const x0 = ctx.side === "right" ? 1.4 : -2.0; const y0 = ctx.floating ? 1.0 : B.yMin + 0.1;
    return { pos: [x0 + (idx % cols) * 0.36, y0 + Math.floor(idx / (cols * 2)) * 0.34, ((Math.floor(idx / cols) % 2) - 0.5) * 0.4], rotZ: 0 };
  }
  // ionic solid: pairs in a checkerboard patch on the bottom
  const cols = 4; const col = idx % cols; const row = Math.floor(idx / cols);
  return { pos: [1.0 + col * 0.62 - (row % 2) * 0.31, B.yMin + 0.1 + (row % 6) * 0.3, ((Math.floor(row / 6) % 2) - 0.5) * 0.4], rotZ: (col + row) % 2 ? Math.PI : 0 };
}
const kindOf = (s, isProductSide, hasLiquid) => (s.state === "g" ? "g" : s.state === "l" ? "l" : s.state === "aq" ? "aq" : getSubstance(s.id).kind === "metallic" ? "s-metal" : "s-ionic");

// ---------------------------------------------------------------------------------------------- the plan
/**
 * Plan the drawing of `beforeQ` (zone contents, quanta per reactant) reacting by `extentQ` (0 = nothing reacts: an idle picture).
 * @returns {{ reactionId, P, events, centres, drawn, entities, tracks, bonds, ledger }}
 *   entities: [{ key, sub, role: "consumed"|"leftover"|"product", event, unit, rest:[x,y,z], rotZ, quat, atoms:[trackIndex] }]
 *   tracks:   [{ el, r, c0, c1, ent0, ent1, p0, p1, p2, p3 }]   p0 rest of the reactant entity, p1 approach, p2 product in the event, p3 rest of the product
 *   bonds:    [{ a, b, order, set: 0|1|2 }]   set 0 = reactant bond (fades out), 1 = product bond (fades in), 2 = always (leftover)
 */
export function planReaction(reactionId, beforeQ, extentQ, { P: forceP = null, maxEvents = 6 } = {}) {
  const r = getReaction(reactionId); const rs = reactants(r); const ps = products(r);
  const totalMol = rs.reduce((a, s) => a + fromQuanta(beforeQ[s.id] ?? 0), 0);
  const maxExt = Math.min(...rs.map((s) => fromQuanta(beforeQ[s.id] ?? 0) / s.coeff));
  const P = forceP ?? drawScale(totalMol, Number.isFinite(maxExt) ? maxExt : 0);
  // displayed counts: consistent integers, atoms conserved by construction
  const d = Object.fromEntries(rs.map((s) => [s.id, drawnCount(beforeQ[s.id] ?? 0, P)]));
  let E = extentQ > 0 ? Math.max(1, Math.round(fromQuanta(extentQ) * P)) : 0;
  if (E > 0) { for (const s of rs) { if (d[s.id] < s.coeff) d[s.id] = s.coeff; E = Math.min(E, Math.floor(d[s.id] / s.coeff)); } E = Math.max(1, Math.min(E, maxEvents)); }
  const hasLiquid = r.species.some((s) => s.state === "l" || s.state === "aq");
  const entities = []; const tracks = []; const bonds = [];
  const rowsN = Math.ceil(E / 3);
  const centres = Array.from({ length: E }, (_, e) => { const row = Math.floor(e / 3); const col = e % 3; const inRow = Math.min(3, E - row * 3);
    return [(col - (inRow - 1) / 2) * 1.75, 1.28 + ((rowsN - 1) / 2 - row) * 1.0, 0.3]; });

  const makeEntity = (key, sub, role, event, unit, restSpec, tplUnit, slot, ringN, ringIdx, centre, phase) => {
    const rr = rng(key); const quat = restSpec.rotZ ? qz(restSpec.rotZ) : quatRandom(rr);
    const ent = { key, sub, role, event, unit, rest: restSpec.pos, rotZ: restSpec.rotZ, quat, label: tplUnit.label, ion: tplUnit.ion, atoms: [], atomEls: tplUnit.atoms.map((a) => a.el), charges: tplUnit.atoms.map((a) => a.charge || 0) };
    // cluster pose: molecules lie roughly in the xy-plane facing the viewer, spaced on a ring
    let cpos = null; let cq = null;
    if (centre) { const ang = (ringIdx / Math.max(1, ringN)) * Math.PI * 2 + (phase === 1 ? 0.5 : 1.2); const rad = ringN > 1 ? 0.5 : 0; cpos = [centre[0] + Math.cos(ang) * rad, centre[1] + Math.sin(ang) * rad, centre[2]]; cq = qz(rr() * Math.PI * 2); }
    ent.cluster = cpos; ent.clusterQuat = cq; ent.tpl = tplUnit;
    return ent;
  };
  const atomsAt = (ent, which) => ent.tpl.atoms.map((a) => {
    const q = which === "rest" ? ent.quat : ent.clusterQuat; const base = which === "rest" ? ent.rest : ent.cluster; const o = rotate(q, [a.x, a.y, a.z]); return [base[0] + o[0], base[1] + o[1], base[2] + o[2]];
  });

  // ---- reactants: consumed (assigned to events) then leftover
  const reactSide = []; const leftoverSide = [];
  for (const s of rs) {
    const tpl = entityTemplates(s.id); const kind = kindOf(s, false, hasLiquid); const nDraw = d[s.id];
    for (let idx = 0; idx < nDraw; idx += 1) {
      const rest = restPosition(kind, idx, nDraw, { floating: hasLiquid, side: "left", salt: hash(s.id) % 11 });
      const consumed = E > 0 && idx < s.coeff * E;
      const event = consumed ? Math.floor(idx / s.coeff) : -1;
      tpl.forEach((tu, u) => reactSide.push({ s, idx, tu, u, rest, consumed, event, key: `r:${s.id}:${idx}${tpl.length > 1 ? `:${u}` : ""}` }));
    }
  }
  // ---- cluster slots per event for reactants
  const perEvent = Array.from({ length: E }, () => ({ react: [], prod: [] }));
  for (const x of reactSide) if (x.consumed) perEvent[x.event].react.push(x);
  const prodSide = [];
  for (const s of ps) {
    const tpl = entityTemplates(s.id); const kind = kindOf(s, true, hasLiquid); const nUnits = s.coeff * E;
    for (let idx = 0; idx < nUnits; idx += 1) {
      const rest = restPosition(kind, idx, nUnits, { salt: hash(s.id) % 13 + 3, side: "right" });
      const event = Math.floor(idx / s.coeff);
      tpl.forEach((tu, u) => prodSide.push({ s, idx, tu, u, rest, event, key: `p:${s.id}:${idx}${tpl.length > 1 ? `:${u}` : ""}` }));
    }
  }
  for (const x of prodSide) perEvent[x.event].prod.push(x);

  // ---- build entities with cluster poses
  const entMap = new Map();
  for (let e = 0; e < E; e += 1) {
    perEvent[e].react.forEach((x, i, arr) => { const ent = makeEntity(x.key, x.s.id, "consumed", e, x.idx, x.rest, x.tu, i, arr.length, i, centres[e], 0); entMap.set(x.key, ent); entities.push(ent); });
    perEvent[e].prod.forEach((x, i, arr) => { const ent = makeEntity(x.key, x.s.id, "product", e, x.idx, x.rest, x.tu, i, arr.length, i, centres[e], 1); entMap.set(x.key, ent); entities.push(ent); });
  }
  for (const x of reactSide) if (!x.consumed) { const ent = makeEntity(x.key, x.s.id, "leftover", -1, x.idx, x.rest, x.tu, 0, 1, 0, null, 0); entMap.set(x.key, ent); entities.push(ent); }

  // ---- tracks
  const trackOf = new Map(); // entity key -> [track index per atom] for the SIDE it is on
  const addBonds = (ent, idxs, set) => { for (const b of ent.tpl.bonds) bonds.push({ a: idxs[b.a], b: idxs[b.b], order: b.order, set }); };
  // leftover: one track per atom, never moves
  for (const ent of entities) if (ent.role === "leftover") {
    const pos = atomsAt(ent, "rest"); const idxs = ent.tpl.atoms.map((a, i) => { tracks.push({ el: a.el, r: a.r, c0: a.charge || 0, c1: a.charge || 0, ev: -1, ent0: ent.key, ent1: ent.key, p0: pos[i], p1: pos[i], p2: pos[i], p3: pos[i] }); return tracks.length - 1; });
    ent.atoms = idxs; addBonds(ent, idxs, 2);
  }
  // events: greedy nearest matching, element by element
  for (let e = 0; e < E; e += 1) {
    const R = perEvent[e].react.map((x) => entMap.get(x.key)); const Pn = perEvent[e].prod.map((x) => entMap.get(x.key));
    const rAtoms = []; for (const ent of R) { const rest = atomsAt(ent, "rest"); const cl = atomsAt(ent, "cluster"); ent.tpl.atoms.forEach((a, i) => rAtoms.push({ ent, i, el: a.el, r: a.r, c0: a.charge || 0, p0: rest[i], p1: cl[i], used: false })); }
    const pAtoms = []; for (const ent of Pn) { const rest = atomsAt(ent, "rest"); const cl = atomsAt(ent, "cluster"); ent.tpl.atoms.forEach((a, i) => pAtoms.push({ ent, i, el: a.el, r: a.r, c1: a.charge || 0, p2: cl[i], p3: rest[i] })); }
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const trackIdxR = new Map(); const trackIdxP = new Map();
    for (const pa of pAtoms) {
      let best = null; let bd = Infinity;
      for (const ra of rAtoms) { if (ra.used || ra.el !== pa.el) continue; const dd = dist(ra.p1, pa.p2); if (dd < bd) { bd = dd; best = ra; } }
      if (!best) throw new Error(`rearrange: no ${pa.el} atom available for event ${e} of ${reactionId} (reaction not atom-balanced?)`);
      best.used = true; tracks.push({ el: pa.el, r: pa.r, c0: best.c0, c1: pa.c1, ev: e, ent0: best.ent.key, ent1: pa.ent.key, p0: best.p0, p1: best.p1, p2: pa.p2, p3: pa.p3 });
      const ti = tracks.length - 1; trackIdxR.set(`${best.ent.key}#${best.i}`, ti); trackIdxP.set(`${pa.ent.key}#${pa.i}`, ti);
    }
    if (rAtoms.some((a) => !a.used)) throw new Error(`rearrange: unused reactant atoms in event ${e} of ${reactionId}`);
    for (const ent of R) { ent.atoms = ent.tpl.atoms.map((a, i) => trackIdxR.get(`${ent.key}#${i}`)); addBonds(ent, ent.atoms, 0); }
    for (const ent of Pn) { ent.atoms = ent.tpl.atoms.map((a, i) => trackIdxP.get(`${ent.key}#${i}`)); addBonds(ent, ent.atoms, 1); }
  }
  const drawn = { reactants: d, consumed: Object.fromEntries(rs.map((s) => [s.id, s.coeff * E])), leftover: Object.fromEntries(rs.map((s) => [s.id, d[s.id] - s.coeff * E])), products: Object.fromEntries(ps.map((s) => [s.id, s.coeff * E])) };
  const plan = { reactionId, P, events: E, centres, drawn, entities: entities.map(({ tpl, ...e }) => ({ ...e, tplLabel: tpl.label })), tracks, bonds };
  plan.ledger = planLedger(plan, entities);
  return plan;
}

/** Independent recount: atoms per element and net charge, counted over REACTANT entities (before) and PRODUCT entities (after) separately. */
export function planLedger(plan, rawEntities = null) {
  const before = {}; const after = {}; let cBefore = 0; let cAfter = 0;
  const ents = rawEntities ?? plan.entities;
  for (const e of ents) {
    const els = e.tpl ? e.tpl.atoms.map((a) => a.el) : e.atomEls; const ch = e.tpl ? e.tpl.atoms.map((a) => a.charge || 0) : e.charges;
    if (e.role === "consumed") { els.forEach((el, i) => { before[el] = (before[el] || 0) + 1; cBefore += ch[i]; }); }
    else if (e.role === "product") { els.forEach((el, i) => { after[el] = (after[el] || 0) + 1; cAfter += ch[i]; }); }
  }
  const els = new Set([...Object.keys(before), ...Object.keys(after)]);
  const balanced = [...els].every((k) => (before[k] || 0) === (after[k] || 0)) && cBefore === cAfter;
  // every track moves exactly one atom of ONE element: tracks per element must equal the same totals
  const perTrack = {}; for (const t of plan.tracks) if (t.ent0 !== t.ent1) perTrack[t.el] = (perTrack[t.el] || 0) + 1;
  const trackOk = [...els].every((k) => (perTrack[k] || 0) === (before[k] || 0));
  return { before, after, chargeBefore: cBefore, chargeAfter: cAfter, balanced: balanced && trackOk };
}
