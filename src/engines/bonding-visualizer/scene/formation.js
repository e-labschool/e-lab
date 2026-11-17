// Formation scene: pure geometry for the "atoms approach, valence shells overlap, electron pairs are shared, bonds appear" picture.
// ONE generic builder for every structure the Lewis engine can produce (no per-molecule tables).
//
//   plan  = planFormation(structure, { outerOnly, world })      layout, radii, which electron ends up where (does not depend on time)
//   frame = formationFrame(plan, starts, p, { time, reduced })  everything to draw at progress p in [0,1] (deterministic: a slider can scrub it)
//
// Progress story (p):  0 .. 0.42 atoms travel from where the student left them to the bonded layout; their valence shells begin to overlap
//                      0.25 .. 0.5 the overlap regions (lenses) fade in;  0.40 .. 0.70 electrons move: shared ones into the overlap, lone
//                      ones to their lobes, electrons that formal charges / the ion charge move fly across;  0.70 .. 0.90 bond lines appear;
//                      0.88 .. 1 labels (formal charges) appear.
// "Only outer shell electrons": inner shells and inner electrons are not drawn; each atom is a small labelled core (symbol and core charge =
// nucleus + inner electrons) inside its valence shell, so the overlap of valence shells and the shared electrons are all that is left.
import { getBondingElement } from "../model/elements.js";
import { elementEdge, elementStyle } from "../../shared-3d/elementStyle.js";
import { layout2D } from "../../../lib/lewis/geometry.js";
import { clamp01, dotRadius, easeInOut, electronsOfShells, lerp, polar, ringRadius, slotAngle } from "./atomGeometry.js";

/** One colour per atom (cycled) for the electrons that atom brought; a 12-colour set so even C4H10 keeps neighbours distinct. */
export const FORMATION_PALETTE = ["#f97316", "#0ea5e9", "#a855f7", "#16a34a", "#e11d48", "#ca8a04", "#14b8a6", "#6366f1", "#be185d", "#65a30d", "#0891b2", "#9333ea"];
export const EXTRA_ELECTRON = "#0f766e"; // electrons that make an ion's negative charge
export const SHARED_RING = "#d4a017"; // outline of a shared electron / capsule behind a shared pair
const KERNEL_FRACTION = 0.5;

const TWO = Math.PI * 2;
const isH = (s) => s === "H";
/** Drawing scale of loose atoms (before any bonding): the same at every step of setup so the picture does not jump when atoms are added. */
export const freeScale = (n, outerOnly) => (outerOnly ? (n <= 3 ? 1.7 : n <= 6 ? 1.35 : 1.1) : (n <= 3 ? 1.35 : n <= 6 ? 1.05 : 0.85));
const outerRho = (symbol, outerOnly) => { const e = getBondingElement(symbol); return outerOnly ? 24 + 4 * e.shells.length : ringRadius(e.shells.length); };

/** How the bonded layout is drawn: radii, positions (world units, centred), scale, electron targets. */
export function planFormation(structure, { outerOnly = true, world }) {
  const n = structure.atoms.length;
  const els = structure.atoms.map((a) => getBondingElement(a));
  const rho0 = structure.atoms.map((a) => outerRho(a, outerOnly));
  const overlap = outerOnly ? 12 : 22;
  const lay = layout2D(structure, rho0, overlap);
  const crowded = !outerOnly && lay.rho.some((r, i) => r < rho0[i] * 0.85);
  // bounding box of the unscaled layout (positions +- ring radius)
  const bb = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
  lay.pos.forEach((q, i) => { bb.x0 = Math.min(bb.x0, q.x - lay.rho[i]); bb.x1 = Math.max(bb.x1, q.x + lay.rho[i]); bb.y0 = Math.min(bb.y0, q.y - lay.rho[i]); bb.y1 = Math.max(bb.y1, q.y + lay.rho[i]); });
  const w = Math.max(60, bb.x1 - bb.x0); const h = Math.max(60, bb.y1 - bb.y0);
  const S = Math.max(0.5, Math.min(outerOnly ? 4.2 : 2.0, (0.80 * world.W) / w, (0.72 * world.H) / h));
  const cx = world.W / 2; const cy = world.H * 0.47;
  const mid = { x: (bb.x0 + bb.x1) / 2, y: (bb.y0 + bb.y1) / 2 };
  const final = lay.pos.map((q) => ({ x: cx + (q.x - mid.x) * S, y: cy + (q.y - mid.y) * S }));
  const rho = lay.rho.map((r) => r * S);
  const S0 = freeScale(n, outerOnly);
  const rhoStart = rho0.map((r) => r * S0); // radius when the atom is alone
  const dotR = dotRadius(S);
  const coreR = Math.max(9, 13 * S);

  // ---- shared pair slots on the overlap regions ----
  const pairs = [];
  structure.bonds.forEach((b, k) => {
    const [i, j, o, dat] = b;
    const dx = final[j].x - final[i].x; const dy = final[j].y - final[i].y; const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d; const uy = dy / d; const nx = -uy; const ny = ux;
    const along = (d - rho[j] + rho[i]) / 2; // middle of the lens
    const step = Math.max(10, 12 * S);
    for (let q = 0; q < o; q += 1) {
      const off = (q - (o - 1) / 2) * step;
      const dative = !!dat && q >= o - dat.n;
      pairs.push({ bond: k, q, i, j, dative, donor: dat?.donor ?? null, x: final[i].x + ux * along + nx * off, y: final[i].y + uy * along + ny * off, ux, uy, nx, ny, gap: dotR * 0.95 });
    }
  });

  // ---- which electron ends up in which slot ----
  const val = structure.atoms.map((a, i) => els[i].valence);
  const slotsOf = structure.atoms.map(() => []); // final slots owned by each atom: { x, y, role, pair? }
  pairs.forEach((pr, pi) => {
    const A = { x: pr.x - pr.ux * pr.gap, y: pr.y - pr.uy * pr.gap, role: "shared", pair: pi, side: "A" };
    const B = { x: pr.x + pr.ux * pr.gap, y: pr.y + pr.uy * pr.gap, role: "shared", pair: pi, side: "B" };
    if (pr.dative) { slotsOf[pr.donor].push(A, B); }
    else { slotsOf[pr.i].push(A); slotsOf[pr.j].push(B); }
  });
  const bondAngles = structure.atoms.map((_, i) => lay.angles[i]);
  structure.atoms.forEach((_, i) => {
    const lp = lay.lonePairAngles[i];
    lp.forEach((ang) => {
      const rr = rho[i] * 0.80; const delta = ((dotR + 1.6) / rr);
      [-1, 1].forEach((sgn) => { const q = polar(final[i].x, final[i].y, rr, ang + sgn * delta); slotsOf[i].push({ x: q.x, y: q.y, role: "lone", angle: ang }); });
    });
    if (structure.radicals?.[i]) {
      const taken = [...bondAngles[i], ...lp].map((a) => ((a % TWO) + TWO) % TWO).sort((x, y) => x - y);
      let best = { size: -1, mid: -Math.PI / 2 };
      taken.forEach((a, k) => { const nx = k === taken.length - 1 ? taken[0] + TWO : taken[k + 1]; if (nx - a > best.size) best = { size: nx - a, mid: (a + nx) / 2 }; });
      const q = polar(final[i].x, final[i].y, rho[i] * 0.8, best.mid);
      slotsOf[i].push({ x: q.x, y: q.y, role: "radical" });
    }
  });

  // ---- electron entities: every atom starts with its neutral valence electrons ----
  const electrons = []; // { id, atom, colorIdx, ringSlot:{k,slot,S}, target:{x,y,role} | null, from: atom index of the origin, kind }
  const spare = []; // electrons an atom does not keep (formal charge +) : { eIndex, atom }
  const deficit = []; // slots an atom needs beyond its own electrons: { atom, slot }
  structure.atoms.forEach((a, i) => {
    const vs = electronsOfShells(els[i].shells).filter((e) => !e.core);
    const mine = slotsOf[i];
    vs.forEach((v, k) => {
      const idx = electrons.length;
      electrons.push({ id: `a${i}e${k}`, atom: i, origin: i, ring: v, target: mine[k] ?? null, kind: mine[k] ? "own" : "spare" });
      if (!mine[k]) spare.push({ e: idx, atom: i });
    });
    for (let k = vs.length; k < mine.length; k += 1) deficit.push({ atom: i, slot: mine[k] });
  });
  // formal-charge transfers: nearest spare electron fills each deficit slot; leftovers are extra (anion) or lost (cation)
  const used = new Set();
  for (const d of deficit) {
    let best = -1; let bd = Infinity;
    spare.forEach((sp, k) => { if (used.has(k)) return; const dd = Math.hypot(final[sp.atom].x - final[d.atom].x, final[sp.atom].y - final[d.atom].y); if (dd < bd) { bd = dd; best = k; } });
    if (best >= 0) { used.add(best); const e = electrons[spare[best].e]; e.target = d.slot; e.kind = "transfer"; e.to = d.atom; }
    else {
      const k = electrons.filter((e) => e.kind === "extra" && e.atom === d.atom).length;
      electrons.push({ id: `x${d.atom}_${k}`, atom: d.atom, origin: d.atom, ring: { k: els[d.atom].shells.length, slot: (7 - k) % 8, S: 8, core: false }, target: d.slot, kind: "extra" });
    }
  }
  spare.forEach((sp, k) => { if (!used.has(k)) { const e = electrons[sp.e]; e.kind = "lost"; } });

  // ---- inner (core) electrons, full-shell mode only ----
  const core = [];
  if (!outerOnly) {
    structure.atoms.forEach((a, i) => {
      const inner = electronsOfShells(els[i].shells).filter((e) => e.core);
      inner.forEach((e, k) => core.push({ id: `a${i}c${k}`, atom: i, ring: e, k, n: inner.length }));
    });
  }
  const label = structure.atoms.map((a, i) => (structure.atoms.filter((x, q) => x === a && q < i).length));
  return { structure, n, outerOnly, crowded, S, S0, final, rho, rhoStart, coreR, dotR, pairs, electrons, core, slotsOf, lay, val, els, world, shells: els.map((e) => e.shells), label, coreCharge: val, extent: { w: w * S, h: h * S } };
}

/** Start positions for a structure atom list: keep the student's positions (canvas atoms assigned by nearest match inside each element). */
export function assignCanvasAtoms(plan, canvasAtoms) {
  const { structure, final } = plan;
  const map = new Array(structure.atoms.length).fill(-1); const usedC = new Set();
  const bySym = {};
  structure.atoms.forEach((s, i) => { (bySym[s] ??= []).push(i); });
  const cxs = canvasAtoms.reduce((s, a) => s + a.x, 0) / (canvasAtoms.length || 1); const cys = canvasAtoms.reduce((s, a) => s + a.y, 0) / (canvasAtoms.length || 1);
  for (const [sym, idxs] of Object.entries(bySym)) {
    const cand = canvasAtoms.map((a, k) => [a, k]).filter(([a]) => a.symbol === sym);
    const pairs = [];
    for (const [a, k] of cand) for (const i of idxs) pairs.push({ k, i, d: Math.hypot(a.x - final[i].x, a.y - final[i].y) });
    pairs.sort((x, y) => x.d - y.d);
    const usedI = new Set();
    for (const pr of pairs) { if (usedC.has(pr.k) || usedI.has(pr.i)) continue; usedC.add(pr.k); usedI.add(pr.i); map[pr.i] = pr.k; }
  }
  void cxs; void cys;
  return map;
}

const arcSign = (i) => (i % 2 ? -1 : 1);

/** Everything to draw at progress p. `starts[i]` = { x, y } start position of structure atom i. */
export function formationFrame(plan, starts, p, { time = 0, reduced = false } = {}) {
  const { structure, final, rho, rhoStart, S } = plan;
  const pp = clamp01(p);
  const tA = easeInOut(pp / 0.42);
  const tE = easeInOut((pp - 0.40) / 0.30);
  const tB = easeInOut((pp - 0.70) / 0.20);
  const tL = clamp01((pp - 0.88) / 0.12);
  const spin = reduced ? 0 : time;
  const Scur = lerp(plan.S0, S, tA);
  const dotR = dotRadius(Scur); const coreR = Math.max(9, 13 * Scur);

  const atoms = structure.atoms.map((sym, i) => {
    const s0 = starts[i] ?? final[i]; const f = final[i];
    const dx = f.x - s0.x; const dy = f.y - s0.y; const dist = Math.hypot(dx, dy);
    const bulge = reduced ? 0 : Math.sin(Math.PI * tA) * Math.min(60, dist * 0.12) * arcSign(i);
    const x = lerp(s0.x, f.x, tA) + (dist > 1 ? (-dy / dist) * bulge : 0);
    const y = lerp(s0.y, f.y, tA) + (dist > 1 ? (dx / dist) * bulge : 0);
    const r = lerp(rhoStart[i], rho[i], tA);
    const style = elementStyle(sym);
    return { i, symbol: sym, x, y, r, color: style.color, text: style.text, edge: elementEdge(sym), coreR, charge: plan.coreCharge[i], tint: FORMATION_PALETTE[i % FORMATION_PALETTE.length] };
  });

  // inner shells / inner electrons (full-shell mode)
  const rings = [];
  const coreDots = [];
  if (!plan.outerOnly) {
    atoms.forEach((a) => {
      const sh = plan.shells[a.i];
      if (plan.crowded) { rings.push({ atom: a.i, k: 0, x: a.x, y: a.y, r: a.r * KERNEL_FRACTION, kernel: true }); }
      else sh.slice(0, -1).forEach((_, k) => rings.push({ atom: a.i, k: k + 1, x: a.x, y: a.y, r: (ringRadius(k + 1) * a.r) / ringRadius(sh.length) }));
    });
    plan.core.forEach((c) => {
      const a = atoms[c.atom]; const sh = plan.shells[a.i];
      const ang = plan.crowded ? -Math.PI / 2 + (TWO * c.k) / c.n + spin * 0.25 : slotAngle(c.ring.k, c.ring.slot, c.ring.S, spin);
      const rr = plan.crowded ? a.r * KERNEL_FRACTION : (ringRadius(c.ring.k) * a.r) / ringRadius(sh.length);
      const q = polar(a.x, a.y, rr, ang);
      coreDots.push({ id: c.id, x: q.x, y: q.y, atom: c.atom, r: dotR * 0.78 });
    });
  }

  // valence electrons
  const colourOf = (idx) => FORMATION_PALETTE[idx % FORMATION_PALETTE.length];
  const electrons = plan.electrons.map((e) => {
    const home = atoms[e.atom]; const origin = atoms[e.origin];
    const nShell = plan.shells[e.atom].length;
    const ang = slotAngle(nShell, e.ring.slot, e.ring.S, spin);
    const ringPos = polar(origin.x, origin.y, origin.r, ang);
    let x = ringPos.x; let y = ringPos.y; let state = "free"; let opacity = 1;
    if (e.kind === "lost") {
      const away = Math.atan2(home.y - plan.world.H / 2, home.x - plan.world.W / 2);
      x = ringPos.x + Math.cos(away) * 36 * tE; y = ringPos.y + Math.sin(away) * 36 * tE; opacity = 1 - tE; state = tE >= 1 ? "lost" : "free";
    } else if (e.target) {
      const tx = e.target.x; const ty = e.target.y;
      // targets are in final-layout coordinates; atoms are already there when tE > 0 (tA = 1)
      x = lerp(ringPos.x, tx, tE); y = lerp(ringPos.y, ty, tE);
      state = tE >= 1 ? (e.target.role === "shared" ? "shared" : e.target.role === "radical" ? "radical" : "lone") : "free";
    }
    const colour = e.kind === "extra" ? EXTRA_ELECTRON : colourOf(e.origin);
    return { id: e.id, x, y, color: colour, state, kind: e.kind, atom: e.atom, opacity, shared: state === "shared", ringW: state === "shared" ? 1 : 0 };
  });

  // overlap lenses between bonded atoms (drawn only while the rings actually intersect)
  const lenses = structure.bonds.map(([i, j], k) => {
    const A = atoms[i]; const B = atoms[j];
    const d = Math.hypot(A.x - B.x, A.y - B.y);
    const overlapping = d < A.r + B.r - 1;
    return { bond: k, a: i, b: j, ax: A.x, ay: A.y, ar: A.r, bx: B.x, by: B.y, br: B.r, ca: A.tint, cb: B.tint, opacity: overlapping ? clamp01((pp - 0.22) / 0.25) : 0 };
  });

  // bond lines (order lines parallel, drawn from core to core)
  const bonds = structure.bonds.map(([i, j, o, dat], k) => {
    const A = atoms[i]; const B = atoms[j];
    const dx = B.x - A.x; const dy = B.y - A.y; const d = Math.hypot(dx, dy) || 1; const ux = dx / d; const uy = dy / d; const nx = -uy; const ny = ux;
    const step = Math.max(6, 7 * Scur);
    const lines = Array.from({ length: o }, (_, q) => {
      const off = (q - (o - 1) / 2) * step;
      const s0 = A.coreR + 2; const s1 = d - B.coreR - 2;
      const len = Math.max(0, s1 - s0) * tB;
      const mid = (s0 + s1) / 2;
      return { x1: A.x + ux * (mid - len / 2) + nx * off, y1: A.y + uy * (mid - len / 2) + ny * off, x2: A.x + ux * (mid + len / 2) + nx * off, y2: A.y + uy * (mid + len / 2) + ny * off, dative: !!dat && q >= o - dat.n };
    });
    return { bond: k, i, j, order: o, lines, opacity: tB };
  });
  const dative = tB > 0.4 ? structure.bonds.filter((b) => b[3]).map((b) => { const d = b[3].donor; const acc = d === b[0] ? b[1] : b[0]; return { from: { x: atoms[d].x, y: atoms[d].y }, to: { x: atoms[acc].x, y: atoms[acc].y }, opacity: clamp01((tB - 0.4) / 0.6) }; }) : [];

  const badges = tL > 0 ? structure.atoms.map((a, i) => ({ i, value: structure.formal[i], x: atoms[i].x + atoms[i].r * 0.72, y: atoms[i].y - atoms[i].r * 0.72, opacity: tL })).filter((b) => b.value !== 0) : [];
  const pairCapsules = plan.pairs.map((pr, k) => ({ k, x: pr.x, y: pr.y, ang: Math.atan2(pr.uy, pr.ux), w: pr.gap * 2 + dotR * 2.6, h: dotR * 2.7, opacity: clamp01((pp - 0.55) / 0.2), dative: pr.dative }));
  const top = Math.min(...atoms.map((a) => a.y - a.r)); const bottom = Math.max(...atoms.map((a) => a.y + a.r)); const left = Math.min(...atoms.map((a) => a.x - a.r)); const right = Math.max(...atoms.map((a) => a.x + a.r));
  const stage = pp <= 0 ? "setup" : pp >= 1 ? "bonded" : "forming";
  return { p: pp, stage, atoms, rings, coreDots, electrons, lenses, bonds, dative, badges, pairCapsules, dotR, S: Scur, bounds: { top, bottom, left, right }, t: { approach: tA, electrons: tE, bonds: tB, labels: tL } };
}

/** The phase caption shown while the animation runs (also a stable text for assistive technology). */
export function phaseCaption(p, structure) {
  if (p <= 0) return "Atoms are apart: each keeps all of its own electrons.";
  if (p < 0.40) return "The atoms approach. Their outer (valence) shells begin to overlap.";
  if (p < 0.70) return "Valence shells overlap. Electrons are drawn into the overlap region and shared in pairs.";
  if (p < 0.88) return "Each shared pair is one covalent bond: bonds appear between the nuclei.";
  const dat = structure.bonds.some((b) => b[3]);
  return `Bonded. Shared pairs are drawn as bond lines; the remaining electrons are lone pairs.${dat ? " The orange arrow marks a coordinate bond (both electrons from one atom)." : ""}`;
}

/** Frame for loose atoms (no structure to form): every atom with its valence ring and its own electrons only. */
export function freeFrame(canvasAtoms, { outerOnly = true, world, time = 0, reduced = false }) {
  const n = canvasAtoms.length; const S = freeScale(n, outerOnly); const spin = reduced ? 0 : time; const dotR = dotRadius(S); const coreR = Math.max(9, 13 * S);
  const atoms = []; const rings = []; const coreDots = []; const electrons = [];
  canvasAtoms.forEach((c, i) => {
    const el = getBondingElement(c.symbol); const style = elementStyle(c.symbol);
    const r = outerRho(c.symbol, outerOnly) * S;
    atoms.push({ i, id: c.id, symbol: c.symbol, x: c.x, y: c.y, r, color: style.color, text: style.text, edge: elementEdge(c.symbol), coreR, charge: el.valence, tint: FORMATION_PALETTE[c.colorIdx % FORMATION_PALETTE.length] });
    const all = electronsOfShells(el.shells);
    const nSh = el.shells.length;
    all.forEach((e, k) => {
      if (e.core) {
        if (outerOnly) return;
        const rr = (ringRadius(e.k) * r) / ringRadius(nSh);
        const q = polar(c.x, c.y, rr, slotAngle(e.k, e.slot, e.S, spin)); coreDots.push({ id: `f${i}c${k}`, x: q.x, y: q.y, atom: i, r: dotR * 0.78 });
      } else {
        const q = polar(c.x, c.y, r, slotAngle(nSh, e.slot, e.S, spin));
        electrons.push({ id: `f${i}e${k}`, x: q.x, y: q.y, color: FORMATION_PALETTE[c.colorIdx % FORMATION_PALETTE.length], state: "free", kind: "own", atom: i, opacity: 1, shared: false });
      }
    });
    if (!outerOnly) el.shells.slice(0, -1).forEach((_, k) => rings.push({ atom: i, k: k + 1, x: c.x, y: c.y, r: (ringRadius(k + 1) * r) / ringRadius(nSh) }));
  });
  return { p: 0, stage: "setup", atoms, rings, coreDots, electrons, lenses: [], bonds: [], dative: [], badges: [], pairCapsules: [], dotR, S, bounds: { top: 0, bottom: world.H, left: 0, right: world.W }, t: { approach: 0, electrons: 0, bonds: 0, labels: 0 } };
}
