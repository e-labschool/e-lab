// Geometry helpers for a resolved Lewis structure: VSEPR shape of each centre, an illustrative 3D embedding (ball-and-stick), and a
// flat "Lewis drawing" layout used by the bond-formation animation.  Pure.
// The shape classification and the lone-pair-compressed direction sets come from the VSEPR Explorer's own geometry module
// (read only): this file does not change it and is not a calculation of real molecular geometries.
import { buildSlots, molecularGeometryName, electronDomainName, axeNotation, isSupportedCombination } from "../../engines/vsepr-explorer-3d/model/geometry.js";
import { lewisElement } from "./data.js";

const DEG = Math.PI / 180;
const isH = (s) => s === "H";
const nbrs = (s, i) => s.bonds.filter((b) => b[0] === i || b[1] === i).map((b) => (b[0] === i ? b[1] : b[0]));
const orderBetween = (s, i, j) => s.bonds.find((b) => (b[0] === i && b[1] === j) || (b[0] === j && b[1] === i))?.[2] ?? 0;

/** Electron domains of atom i: { bonding (sigma neighbours), lone (lone pairs + an unpaired electron), total, name, geometry, axe, supported }. */
export function domainsOf(s, i) {
  const bonding = nbrs(s, i).length;
  const lone = s.lonePairs[i] + (s.radicals?.[i] ? 1 : 0);
  const total = bonding + lone;
  const supported = bonding >= 1 && isSupportedCombination(bonding, lone);
  return { bonding, lone, total, domainName: electronDomainName(total), geometry: supported ? molecularGeometryName(bonding, lone) : null, axe: supported ? axeNotation(bonding, lone) : null, supported };
}

/** Atoms worth describing a shape for: every atom with two or more neighbours (the centres), heavy ones first. */
export function shapeCentres(s) {
  return s.atoms.map((_, i) => i).filter((i) => nbrs(s, i).length >= 2 && !isH(s.atoms[i]));
}

/** Short text for the "shape hint": "Bent (AX₂E₂), 4 electron domains" for one centre; one line per centre for chains. */
export function shapeText(s) {
  const centres = shapeCentres(s);
  if (s.atoms.length === 2) return "Linear (two atoms always are).";
  if (!centres.length) return "";
  const lines = centres.map((i) => {
    const d = domainsOf(s, i);
    const name = d.geometry ?? "no standard shape in the VSEPR model";
    const tag = centres.length > 1 ? `${s.atoms[i]}${centres.length > 1 ? "" : ""}: ` : "";
    return `${tag}${name}${d.axe ? ` (${d.axe})` : ""}, ${d.total} electron domain${d.total === 1 ? "" : "s"}`;
  });
  return lines.join("; ");
}

// ---------------------------------------------------------------------------------------------------------------
// small vector helpers
// ---------------------------------------------------------------------------------------------------------------
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
function rotateAbout(v, axis, ang) { // Rodrigues
  const k = unit(axis); const c = Math.cos(ang); const s = Math.sin(ang);
  return add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c)));
}
/** Rotation (as a function) taking unit vector a onto unit vector b by the shortest turn. */
function alignFn(a, b) {
  const c = dot(a, b);
  if (c > 1 - 1e-9) return (v) => v;
  if (c < -1 + 1e-9) { const ax = Math.abs(a[0]) < 0.9 ? unit(cross(a, [1, 0, 0])) : unit(cross(a, [0, 1, 0])); return (v) => rotateAbout(v, ax, Math.PI); }
  const ax = unit(cross(a, b)); const ang = Math.acos(Math.max(-1, Math.min(1, c)));
  return (v) => rotateAbout(v, ax, ang);
}
const perp = (v, axis) => { const k = unit(axis); return sub(v, mul(k, dot(v, k))); };
const signedAngle = (a, b, axis) => Math.atan2(dot(cross(a, b), unit(axis)), dot(a, b));

/** Bond length in scene units from covalent radii (pm) and bond order (double and triple bonds are shorter). */
const LEN_SCALE = 0.0145; const SHORTEN = { 1: 1, 2: 0.92, 3: 0.86 };
export function bondLength3D(a, b, order = 1) { return (lewisElement(a).cov + lewisElement(b).cov) * LEN_SCALE * (SHORTEN[order] ?? 1); }

/** Directions of the sigma bonds of atom i in a local frame (bond slots only), from the VSEPR model with lone-pair compression. */
function localBondDirs(b, l) {
  const t = b + l;
  if (t <= 1) return [[0, 0, 1]];
  if (isSupportedCombination(b, l)) {
    const { dirs, roles } = buildSlots(b, l);
    return dirs.filter((_, k) => roles[k] === "bond").map(unit);
  }
  // unsupported (e.g. 7 domains): spread evenly on a circle
  return Array.from({ length: b }, (_, k) => [Math.cos((2 * Math.PI * k) / b), Math.sin((2 * Math.PI * k) / b), 0]);
}

/** Principal-axes reorientation: the widest direction becomes x, the next y, so planar molecules lie flat in the default view. */
function principalAxes(points) {
  const n = points.length;
  const c = points.reduce((a, p) => add(a, p), [0, 0, 0]).map((x) => x / n);
  const q = points.map((p) => sub(p, c));
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of q) for (let i = 0; i < 3; i += 1) for (let j = 0; j < 3; j += 1) C[i][j] += p[i] * p[j];
  // Jacobi eigen decomposition of a symmetric 3x3
  const V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 30; sweep += 1) {
    let off = 0;
    for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) {
      off += Math.abs(C[i][j]);
      if (Math.abs(C[i][j]) < 1e-12) continue;
      const th = (C[j][j] - C[i][i]) / (2 * C[i][j]);
      const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const cs = 1 / Math.sqrt(t * t + 1); const sn = t * cs;
      for (let k = 0; k < 3; k += 1) { const a = C[k][i]; const b = C[k][j]; C[k][i] = cs * a - sn * b; C[k][j] = sn * a + cs * b; }
      for (let k = 0; k < 3; k += 1) { const a = C[i][k]; const b = C[j][k]; C[i][k] = cs * a - sn * b; C[j][k] = sn * a + cs * b; }
      for (let k = 0; k < 3; k += 1) { const a = V[k][i]; const b = V[k][j]; V[k][i] = cs * a - sn * b; V[k][j] = sn * a + cs * b; }
    }
    if (off < 1e-12) break;
  }
  const vals = [C[0][0], C[1][1], C[2][2]];
  const idx = [0, 1, 2].sort((a, b) => vals[b] - vals[a]);
  const axes = idx.map((k) => [V[0][k], V[1][k], V[2][k]]);
  if (dot(cross(axes[0], axes[1]), axes[2]) < 0) axes[2] = mul(axes[2], -1);
  return { centre: c, axes };
}

/**
 * Illustrative 3D coordinates: VSEPR directions at every atom (lone pairs compress the bond angles), tree walk from the centre,
 * staggered about single bonds and flat about bonds between two trigonal-planar atoms.
 * Returns { pos:[[x,y,z]] (scene units, centred), radius }.
 */
export function embed3D(s) {
  const n = s.atoms.length;
  const root = s.centre ?? (() => {
    let best = 0; let bd = -1;
    s.atoms.forEach((a, i) => { const d = nbrs(s, i).length + (isH(a) ? -10 : 0); if (d > bd) { bd = d; best = i; } });
    return best;
  })();
  const pos = new Array(n).fill(null);
  const placed = new Set();
  const dom = s.atoms.map((_, i) => domainsOf(s, i));
  const order = (nb, u) => [...nb].sort((x, y) => (isH(s.atoms[x]) - isH(s.atoms[y])) || (orderBetween(s, u, y) - orderBetween(s, u, x)) || x - y);

  pos[root] = [0, 0, 0]; placed.add(root);
  const rootNb = order(nbrs(s, root), root);
  const rootDirs = localBondDirs(dom[root].bonding, dom[root].lone);
  const walk = (u, children, dirs) => {
    children.forEach((v, k) => {
      const d = dirs[k] ?? [0, 0, 1];
      pos[v] = add(pos[u], mul(unit(d), bondLength3D(s.atoms[u], s.atoms[v], orderBetween(s, u, v))));
      placed.add(v);
    });
    children.forEach((v, k) => {
      const dirIn = mul(unit(dirs[k] ?? [0, 0, 1]), -1); // direction from v back to u
      const rest = order(nbrs(s, v).filter((x) => x !== u), v);
      if (!rest.length) return;
      const local = localBondDirs(dom[v].bonding, dom[v].lone);
      // align the first local slot with the bond back to u
      const turn = alignFn(unit(local[0]), dirIn);
      let slots = local.map((d) => turn(d));
      // twist so the first onward neighbour is anti to a reference neighbour of u (staggered / planar)
      const refNb = order(nbrs(s, u).filter((x) => x !== v && pos[x]), u)[0];
      if (refNb !== undefined && slots.length > 1) {
        const ref = perp(sub(pos[refNb], pos[u]), dirIn);
        const first = perp(slots[1], dirIn);
        if (len(ref) > 1e-6 && len(first) > 1e-6) {
          const ang = Math.PI - signedAngle(first, ref, dirIn) - Math.PI; // rotate so first is opposite ref
          // two atoms that both carry lone pairs (O-O, N-N) twist to about 100 degrees (gauche, as in H2O2 and N2H4); everything else is anti / staggered
          const bothLone = dom[u].lone > 0 && dom[v].lone > 0 && !isH(s.atoms[u]) && !isH(s.atoms[v]);
          const turn2 = bothLone ? signedAngle(first, rotateAbout(ref, dirIn, 100 * DEG), dirIn) : signedAngle(first, mul(ref, -1), dirIn);
          void ang;
          slots = slots.map((d) => rotateAbout(d, dirIn, turn2));
        }
      }
      walk(v, rest, slots.slice(1));
    });
  };
  walk(root, rootNb, rootDirs);
  // anything unreachable (should not happen for a connected structure)
  for (let i = 0; i < n; i += 1) if (!pos[i]) pos[i] = [i * 1.5, 0, 0];
  const { centre, axes } = principalAxes(pos);
  const out = pos.map((p) => { const q = sub(p, centre); return [dot(q, axes[0]), dot(q, axes[1]), dot(q, axes[2])]; });
  const radius = Math.max(...out.map((p) => len(p)));
  return { pos: out, radius, root };
}

/** Smallest distance / (sum of display radii) over non-bonded pairs (used by tests: a sane embedding has no overlapping atoms). */
export function minNonBondedGap(s, pos, radiusOf) {
  let g = Infinity;
  for (let i = 0; i < s.atoms.length; i += 1) for (let j = i + 1; j < s.atoms.length; j += 1) {
    if (orderBetween(s, i, j)) continue;
    g = Math.min(g, len(sub(pos[i], pos[j])) - radiusOf(s.atoms[i]) - radiusOf(s.atoms[j]));
  }
  return g;
}

// ---------------------------------------------------------------------------------------------------------------
// 2D Lewis drawing layout
// ---------------------------------------------------------------------------------------------------------------
/** Even directions (screen degrees: 0 = right, 90 = down) of n neighbours of the first atom drawn. */
function rootAngles(n) {
  if (n === 1) return [0];
  if (n === 2) return [180, 0];
  if (n === 4) return [180, 0, 270, 90];
  return Array.from({ length: n }, (_, i) => 270 + (360 * i) / n);
}

/**
 * Flat drawing positions (world units) of the atoms of a structure.
 *   rho[i]   radius of the ring that must overlap its bonded neighbours' rings (the valence ring)
 *   overlap  how deep bonded rings overlap (world units)
 * Returns { pos:[{x,y}], rho:[...] (shrunk for crowded terminal atoms), angles:{ i:[radians of neighbours] }, lonePairAngles:[[rad]] }.
 */
export function layout2D(s, rho0, overlap) {
  const n = s.atoms.length;
  const root = s.centre ?? embed3D(s).root;
  const rho = rho0.slice();
  const hub = s.centre !== null && s.centre !== undefined; // one central atom: its ligands use the symmetric drawing positions
  const TWO = 2 * Math.PI;
  const norm = (x) => ((x % TWO) + TWO) % TWO;
  /** Middle of the widest gap between the given directions (all of the circle when there are none). */
  const widestGap = (taken) => {
    if (!taken.length) return 0;
    const sorted = taken.map(norm).sort((x, y) => x - y);
    let best = { size: -1, mid: 0 };
    sorted.forEach((a, k) => { const nxt = k === sorted.length - 1 ? sorted[0] + TWO : sorted[k + 1]; if (nxt - a > best.size) best = { size: nxt - a, mid: (a + nxt) / 2 }; });
    return best.mid;
  };
  const build = () => {
    const pos = new Array(n).fill(null); const back = new Array(n).fill(null);
    pos[root] = { x: 0, y: 0 };
    const place = (u, depth) => {
      const kids = nbrs(s, u).filter((v) => !pos[v]);
      if (!kids.length) return;
      const heavy = kids.filter((v) => !isH(s.atoms[v])); const hyd = kids.filter((v) => isH(s.atoms[v]));
      const ordered = [...heavy, ...hyd];
      const angle = new Map();
      const taken = back[u] === null ? [] : [back[u]];
      if (back[u] === null && hub) rootAngles(kids.length).forEach((d, k) => angle.set(ordered[k], d * DEG));
      else {
        const sgn = depth % 2 ? -1 : 1;
        if (heavy.length === 1 && back[u] !== null) angle.set(heavy[0], back[u] + sgn * (120 * DEG));
        else if (heavy.length === 2 && back[u] !== null) { angle.set(heavy[0], back[u] + 120 * DEG); angle.set(heavy[1], back[u] - 120 * DEG); }
        else if (heavy.length >= 1 && back[u] === null) angle.set(heavy[0], 0);
        for (const v of angle.keys()) taken.push(angle.get(v));
        for (const v of ordered) { if (angle.has(v)) continue; const a = widestGap(taken); angle.set(v, a); taken.push(a); }
      }
      ordered.forEach((v) => {
        const a = angle.get(v);
        const L = Math.max(10, rho[u] + rho[v] - overlap);
        pos[v] = { x: pos[u].x + L * Math.cos(a), y: pos[u].y + L * Math.sin(a) };
        back[v] = a + Math.PI;
      });
      ordered.forEach((v) => place(v, depth + 1));
    };
    place(root, 0);
    return pos;
  };
  let pos = build();
  // crowding: shrink the rings of terminal atoms until non-bonded atoms no longer overlap
  for (let it = 0; it < 6; it += 1) {
    let worst = Infinity;
    for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) {
      if (orderBetween(s, i, j)) continue;
      const d = Math.hypot(pos[i].x - pos[j].x, pos[i].y - pos[j].y);
      worst = Math.min(worst, d / (rho[i] + rho[j]));
    }
    if (worst >= 1) break;
    const k = Math.max(0.6, worst * 0.97);
    for (let i = 0; i < n; i += 1) if (nbrs(s, i).length === 1) rho[i] = Math.max(rho0[i] * 0.55, rho[i] * k);
    pos = build();
  }
  const angles = {}; const lone = [];
  for (let i = 0; i < n; i += 1) angles[i] = nbrs(s, i).map((j) => Math.atan2(pos[j].y - pos[i].y, pos[j].x - pos[i].x));
  for (let i = 0; i < n; i += 1) lone.push(lonePairDirections(s, i, angles[i]));
  return { pos, rho, angles, lonePairAngles: lone, root };
}

/** Directions (radians) of the lone pairs of atom i: each goes to the middle of the widest remaining gap between bond directions. */
export function lonePairDirections(s, i, bondAngles) {
  const lp = s.lonePairs[i];
  if (!lp) return [];
  const TWO = 2 * Math.PI;
  const norm = (a) => ((a % TWO) + TWO) % TWO;
  if (bondAngles.length === 0) return Array.from({ length: lp }, (_, q) => -Math.PI / 2 + (TWO * q) / lp);
  if (bondAngles.length === 1) {
    const back = bondAngles[0] + Math.PI;
    const spacing = lp === 1 ? 0 : lp === 2 ? 100 * DEG : 95 * DEG;
    return Array.from({ length: lp }, (_, q) => back + (q - (lp - 1) / 2) * spacing);
  }
  let placed = bondAngles.map(norm);
  const out = [];
  for (let q = 0; q < lp; q += 1) {
    const sorted = [...placed].sort((a, b) => a - b);
    let best = { size: -1, mid: 0 };
    sorted.forEach((a, k) => { const b = k === sorted.length - 1 ? sorted[0] + TWO : sorted[k + 1]; if (b - a > best.size) best = { size: b - a, mid: (a + b) / 2 }; });
    out.push(best.mid); placed = [...placed, norm(best.mid)];
  }
  return out;
}
