// Covalent scene: pure geometry for the shared-pair (Lewis) picture.
// Final layout is a LEWIS representation: it shows which atoms share pairs and where the lone pairs are. The
// directions used (horizontal pair, cross, even ring) are drawing conventions, not molecular shapes.
import { getBondingElement, CORE_ELECTRON_COLOR } from "../model/elements.js";
import { electronsAround, sharedPairsOn } from "../model/covalent.js";
import { clamp01, dotRadius, easeInOut, electronsOfShells, lerp, polar, ringRadius, slotAngle } from "./atomGeometry.js";
import { electronColor } from "./ionicScene.js";

const DEG = Math.PI / 180;
const LENS_W = 20; // width of the overlap region between two valence rings (world units, unscaled)

/** Drawing-convention directions (degrees, screen coords: 0 = right, 90 = down) of the partners around the first atom. */
const LIGAND_ANGLES = {
  H2O: [180, 0],
  NH3: [180, 0, 90],
  CH4: [180, 0, 270, 90],
  BeCl2: [180, 0],
};

export function ligandAngles(m) {
  if (m.central === null) return null;
  const n = m.atoms.length - 1;
  if (LIGAND_ANGLES[m.id]) return LIGAND_ANGLES[m.id];
  return Array.from({ length: n }, (_, i) => 270 + (360 * i) / n);
}

const outerRing = (symbol) => ringRadius(getBondingElement(symbol).shells.length);

/**
 * Final geometry of a molecule in unscaled units around (0,0):
 * { pos[], rho[] (valence-ring radius), L, bonds:[{i,j,angle,order,mid}], lonePairAngles[i][] (radians) }.
 */
export function layoutMolecule(m) {
  const R = m.atoms.map(outerRing);
  const rho = [...R];
  let L = 0;
  const pos = m.atoms.map(() => ({ x: 0, y: 0 }));
  const bonds = [];
  if (m.central === null) {
    L = R[0] + R[1] - LENS_W;
    pos[0] = { x: -L / 2, y: 0 }; pos[1] = { x: L / 2, y: 0 };
    bonds.push({ i: 0, j: 1, angle: 0, order: m.bonds[0][2] });
    rho[0] = R[0]; rho[1] = R[1];
  } else {
    const angles = ligandAngles(m).map((d) => d * DEG);
    const n = angles.length;
    const minGap = Math.min(...angles.map((a, i) => Math.min(...angles.filter((_, k) => k !== i).map((b) => {
      const d = Math.abs(a - b) % (2 * Math.PI);
      return Math.min(d, 2 * Math.PI - d);
    })), Math.PI));
    const rl = R[1];
    const rc = R[0];
    let rhoL = rl;
    for (let it = 0; it < 12; it += 1) {
      L = rc + rhoL - LENS_W;
      if (n >= 3) rhoL = Math.min(rl, 0.97 * L * Math.sin(minGap / 2));
    }
    L = rc + rhoL - LENS_W;
    for (let i = 1; i < m.atoms.length; i += 1) {
      rho[i] = rhoL;
      pos[i] = { x: L * Math.cos(angles[i - 1]), y: L * Math.sin(angles[i - 1]) };
      bonds.push({ i: 0, j: i, angle: angles[i - 1], order: m.bonds[i - 1][2] });
    }
  }
  // lone-pair directions per atom
  const lonePairAngles = m.atoms.map((_, i) => {
    const lp = m.lonePairs[i];
    if (!lp) return [];
    const dirs = bonds.filter((b) => b.i === i || b.j === i).map((b) => (b.i === i ? b.angle : b.angle + Math.PI));
    if (dirs.length <= 1) {
      const back = (dirs[0] ?? 0) + Math.PI;
      const spacing = lp === 1 ? 0 : lp === 2 ? 100 * DEG : 95 * DEG;
      return Array.from({ length: lp }, (_, q) => back + (q - (lp - 1) / 2) * spacing);
    }
    // several bond directions: place each lone pair in the middle of the largest remaining gap
    let placed = [...dirs.map((d) => ((d % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI))];
    const out = [];
    for (let q = 0; q < lp; q += 1) {
      const sorted = [...placed].sort((a, b) => a - b);
      let best = { size: -1, mid: 0 };
      sorted.forEach((a, k) => {
        const b = k === sorted.length - 1 ? sorted[0] + 2 * Math.PI : sorted[k + 1];
        if (b - a > best.size) best = { size: b - a, mid: (a + b) / 2 };
      });
      out.push(best.mid); placed = [...placed, ((best.mid % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)];
    }
    return out;
  });
  // centre the diatomic/cluster on the origin (already so); shared-pair positions
  const pairs = [];
  for (const b of bonds) {
    const a0 = pos[b.i]; const a1 = pos[b.j];
    const ang = Math.atan2(a1.y - a0.y, a1.x - a0.x);
    // lens spans [dist - rho_j, rho_i] along the axis from atom i
    const dist = Math.hypot(a1.x - a0.x, a1.y - a0.y);
    const mid = (dist - rho[b.j] + rho[b.i]) / 2;
    const cx = a0.x + Math.cos(ang) * mid; const cy = a0.y + Math.sin(ang) * mid;
    const nx = -Math.sin(ang); const ny = Math.cos(ang);
    const step = 11; // unscaled; multiplied by the drawing scale when positions are placed
    for (let q = 0; q < b.order; q += 1) {
      const off = (q - (b.order - 1) / 2) * step;
      pairs.push({ bond: b, ang, x: cx + nx * off, y: cy + ny * off });
    }
  }
  return { pos, rho, R, L, bonds, lonePairAngles, pairs };
}

/** Which canvas atom plays which molecule atom: nearest-first matching inside each element. Returns canvasAtomIndex per molecule index. */
export function assignAtoms(m, atoms, finalPos) {
  const used = new Set();
  const out = new Array(m.atoms.length).fill(-1);
  const bySym = {};
  m.atoms.forEach((s, i) => { (bySym[s] ??= []).push(i); });
  for (const [sym, idxs] of Object.entries(bySym)) {
    const cand = atoms.map((a, k) => [a, k]).filter(([a]) => a.symbol === sym);
    const cx = atoms.reduce((s, a) => s + a.x, 0) / atoms.length; const cy = atoms.reduce((s, a) => s + a.y, 0) / atoms.length;
    const pairs = [];
    for (const [a, k] of cand) for (const i of idxs) pairs.push({ k, i, d: Math.hypot(a.x - cx - finalPos[i].x, a.y - cy - finalPos[i].y) });
    pairs.sort((x, y) => x.d - y.d);
    const usedI = new Set();
    for (const pr of pairs) { if (used.has(pr.k) || usedI.has(pr.i)) continue; used.add(pr.k); usedI.add(pr.i); out[pr.i] = pr.k; }
  }
  return out;
}

/** Drawing scale: small molecules are drawn larger; scaled down only when the molecule or canvas needs it. */
export function covalentSize(world, molecule = null) {
  const base = Math.min(1.5, Math.max(0.6, world.W / 700));
  if (!molecule) return base;
  const lay = layoutMolecule(molecule);
  const ext = Math.max(...lay.pos.map((q, i) => Math.hypot(q.x, q.y) + lay.rho[i]));
  const fit = Math.min((0.6 * world.H) / (2 * ext), (0.7 * world.W) / (2 * ext));
  return Math.max(0.6, Math.min(2.3, fit, Math.max(base, world.W / 450)));
}

/** Are all atoms in one cluster of near-touching neighbours (so "Form Bond" may be enabled)? */
export function atomsAreClose(atoms, S) {
  if (atoms.length < 2) return false;
  const seen = new Set([0]);
  const stack = [0];
  while (stack.length) {
    const i = stack.pop();
    atoms.forEach((b, j) => {
      if (seen.has(j)) return;
      const a = atoms[i];
      const lim = (outerRing(a.symbol) + outerRing(b.symbol) + 36) * S;
      if (Math.hypot(a.x - b.x, a.y - b.y) <= lim) { seen.add(j); stack.push(j); }
    });
  }
  return seen.size === atoms.length;
}

/** Positions for "Bring together": the molecule layout slightly looser than final, around the current centroid. */
export function gatherTargets(m, atoms, world) {
  const lay = layoutMolecule(m);
  const S = covalentSize(world, m);
  const cx = Math.min(world.W - 160 * S, Math.max(160 * S, atoms.reduce((s, a) => s + a.x, 0) / atoms.length));
  const cy = Math.min(world.H - 140 * S, Math.max(140 * S, atoms.reduce((s, a) => s + a.y, 0) / atoms.length));
  const map = assignAtoms(m, atoms, lay.pos.map((p) => ({ x: p.x * 1.35 * S, y: p.y * 1.35 * S })));
  return atoms.map((a, k) => {
    const i = map.indexOf(k);
    return { id: a.id, x: cx + lay.pos[i].x * 1.35 * S, y: cy + lay.pos[i].y * 1.35 * S };
  });
}

/**
 * atoms: [{id, symbol, x, y, colorIdx}], molecule: validated molecule or null.
 * stage: "setup" | "bonding" | "bonded";  p = progress of the bonding stage.
 */
export function covalentScene({ atoms, molecule, stage, p = 0, time = 0, world, offset = { x: 0, y: 0 } }) {
  const S = covalentSize(world, molecule);
  const prog = stage === "setup" ? 0 : stage === "bonded" ? 1 : p;
  const started = stage !== "setup" && !!molecule;
  const lay = started ? layoutMolecule(molecule) : null;

  const base = atoms.map((a) => {
    const el = getBondingElement(a.symbol);
    return { id: a.id, symbol: a.symbol, color: el.color, shells: el.shells, colorIdx: a.colorIdx, x: a.x, y: a.y, scale: S, electrons: [], rings: [], role: -1 };
  });

  let finalCentres = null;
  let origin = null;
  let map = null;
  if (started) {
    const cx0 = atoms.reduce((s, a) => s + a.x, 0) / atoms.length;
    const cy0 = atoms.reduce((s, a) => s + a.y, 0) / atoms.length;
    const ext = Math.max(...lay.pos.map((q, i) => Math.hypot(q.x, q.y) + lay.rho[i])) * S;
    const cx = Math.min(world.W - ext, Math.max(ext, cx0));
    const cy = Math.min(world.H - ext - 30, Math.max(ext, cy0));
    origin = { x: cx, y: cy };
    finalCentres = lay.pos.map((q) => ({ x: cx + q.x * S, y: cy + q.y * S }));
    map = assignAtoms(molecule, atoms, lay.pos.map((q) => ({ x: q.x * S, y: q.y * S })));
    map.forEach((k, i) => { base[k].role = i; });
  }

  const move = easeInOut(prog / 0.55);
  const elec = easeInOut((prog - 0.3) / 0.55);
  for (const d of base) {
    if (started && d.role >= 0) {
      const f = finalCentres[d.role];
      d.x = lerp(d.x, f.x, move); d.y = lerp(d.y, f.y, move);
      const sc = (lay.rho[d.role] / lay.R[d.role]);
      d.scale = lerp(S, S * sc, move);
    }
    d.x += offset.x; d.y += offset.y;
  }

  // electrons
  const shared = started ? lay.pairs : [];
  for (const d of base) {
    const colour = electronColor(d.colorIdx);
    const evs = electronsOfShells(d.shells);
    let vi = 0;
    for (const e of evs) {
      const ang = slotAngle(e.k, e.slot, e.S, time);
      const here = polar(d.x, d.y, ringRadius(e.k) * d.scale, ang);
      let x = here.x; let y = here.y; let state = e.core ? "core" : "free";
      if (started && !e.core && d.role >= 0) {
        const role = d.role;
        const nShared = sharedPairsOn(molecule, role);
        const idx = vi; vi += 1;
        let target = null;
        if (idx < nShared) {
          // this electron belongs to shared pair #idx of this atom
          const mine = shared.filter((sp) => sp.bond.i === role || sp.bond.j === role);
          const sp = mine[idx];
          const iAmFirst = sp.bond.i === role;
          const nudge = (dotRadius(S) + 0.9) * (iAmFirst ? -1 : 1); // each atom's electron sits a little toward its own nucleus
          target = { x: origin.x + sp.x * S + Math.cos(sp.ang) * nudge, y: origin.y + sp.y * S + Math.sin(sp.ang) * nudge };
          state = "shared";
        } else {
          const k = idx - nShared; // lone-pair electron index
          const pairNo = Math.floor(k / 2); const which = k % 2;
          const lAng = lay.lonePairAngles[role][pairNo];
          const rr = lay.rho[role] * S;
          const delta = ((dotRadius(S) + 1.2) / rr) * (which ? 1 : -1);
          const o = polar(0, 0, rr, lAng + delta);
          target = { x: finalCentres[role].x + o.x, y: finalCentres[role].y + o.y };
          state = "lone";
        }
        const tx = target.x + offset.x; const ty = target.y + offset.y;
        x = lerp(here.x, tx, elec); y = lerp(here.y, ty, elec);
        if (elec < 1) state = "free";
      }
      d.electrons.push({ id: `${d.id}:${e.k}:${e.i}`, x, y, color: e.core ? CORE_ELECTRON_COLOR : colour, core: e.core, state });
    }
    d.rings = d.shells.map((_, i) => ({ k: i + 1, r: ringRadius(i + 1) * d.scale, opacity: 1 }));
    d.outerR = ringRadius(d.shells.length) * d.scale;
  }

  // overlap regions (clip lens) and labels
  const lenses = [];
  if (started) {
    for (const b of lay.bonds) {
      const A = base[map[b.i]]; const B = base[map[b.j]];
      lenses.push({ a: A.id, b: B.id, ax: A.x, ay: A.y, ar: A.outerR, bx: B.x, by: B.y, br: B.outerR, ca: electronColor(A.colorIdx), cb: electronColor(B.colorIdx), opacity: clamp01((prog - 0.25) / 0.45) });
    }
  }
  const info = started && prog >= 0.99 ? {
    central: molecule.central,
    perAtom: molecule.atoms.map((s, i) => ({ symbol: s, electrons: electronsAround(molecule, i) })),
  } : null;
  const centroid = base.length ? { x: base.reduce((s, a) => s + a.x, 0) / base.length, y: base.reduce((s, a) => s + a.y, 0) / base.length } : { x: 0, y: 0 };
  const top = base.length ? Math.min(...base.map((a) => a.y - a.outerR)) : 0;
  const bottom = base.length ? Math.max(...base.map((a) => a.y + a.outerR)) : 0;
  return { atoms: base, lenses, S, started, prog, info, centroid, top, bottom, labelOpacity: clamp01((prog - 0.85) / 0.15) };
}
