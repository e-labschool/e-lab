// Orbital-overlap logic: oriented orbital instances, pairwise sigma / pi classification and bond detection.
// Pure (no React / three). It is QUALITATIVE geometry, not an overlap integral: it checks
//   (1) compatible orbital types, (2) alignment of the lobe axes with the internuclear axis (sigma) or parallel,
//   perpendicular-to-the-axis p orbitals (pi), (3) the internuclear distance against a window derived from the lobe sizes,
//   (4) phase (facing lobes must carry the same phase colour), and (5) occupancy (one unpaired electron in each orbital).
// A close pair of atoms is never labelled as bonded unless every condition passes.
import { P_AXIS, P_LATERAL, reach as reachOf } from "./orbitals.js";
import { RECIPES } from "./hybrids.js";
import { qRotate, sub, dot, len, scale, add, angleDeg, normalize, clamp } from "./vec.js";

export const TOL = { sigmaDeg: 20, piParallelDeg: 15, piPerpDeg: 15 };
const COS_SIGMA = Math.cos((TOL.sigmaDeg * Math.PI) / 180);
const COS_PAR = Math.cos((TOL.piParallelDeg * Math.PI) / 180);
const SIN_PERP = Math.sin((TOL.piPerpDeg * Math.PI) / 180);

export const REASON_TEXT = {
  "same-atom": "orbitals of the same atom do not bond to each other",
  incompatible: "these orbital types do not overlap to form a bond in this model",
  occupancy: "a covalent bond needs one unpaired electron in each orbital (this one is full or empty)",
  "too-far": "too far apart for the orbitals to overlap",
  "too-close": "too close: the orbitals overlap too much (nuclei would repel)",
  misaligned: "not aligned: sigma overlap is end-on along the internuclear axis",
  "pi-misaligned": "pi overlap needs parallel p orbitals perpendicular to the bond axis",
  phase: "out of phase: the facing lobes have opposite phase (antibonding), so no bond",
  "small-lobe": "the small lobe of the hybrid faces the other atom; the large lobe must point along the bond",
  blocked: "another atom lies between them, so they cannot overlap directly",
};

/** Oriented orbital instances of one atom in world coordinates. atom = {id, pos, quat, orbitals:[{id,n,kind,type,electrons}], hybrid} */
export function atomOrbitalInstances(atom) {
  const out = [];
  const consumed = atom.hybrid ? atom.hybrid.consumed : [];
  for (const o of atom.orbitals) {
    if (consumed.includes(o.id)) continue;
    out.push({
      key: `${atom.id}|${o.id}`, atomId: atom.id, orbId: o.id, cls: o.type, n: o.n, kind: o.kind, latex: o.latex, plain: o.plain, electrons: o.electrons,
      pos: atom.pos, axis: o.type === "p" ? qRotate(atom.quat, P_AXIS[o.kind]) : null, reach: reachOf(o.type, o.n),
    });
  }
  if (atom.hybrid) {
    const sOrb = atom.orbitals.find((o) => o.id === atom.hybrid.consumed[0]);
    const recipe = RECIPES[atom.hybrid.recipeId];
    for (const h of atom.hybrid.hybrids) {
      out.push({
        key: `${atom.id}|${h.id}`, atomId: atom.id, orbId: h.id, cls: "hybrid", n: sOrb.n, kind: "hybrid", latex: recipe.latex, plain: recipe.id, electrons: h.electrons,
        pos: atom.pos, axis: qRotate(atom.quat, h.direction), reach: reachOf("hybrid", sOrb.n), hybridIndex: h.index, recipeId: recipe.id,
      });
    }
  }
  return out;
}

export function distanceWindow(type, a, b) {
  if (type === "sigma") { const s = a.reach + b.reach; return { min: 0.35 * s, ideal: 0.6 * s, max: 0.95 * s }; }
  const r = P_LATERAL * (a.reach + b.reach); // sum of the lateral half-widths of two parallel p lobes: they touch at d = r
  return { min: 0.5 * r, ideal: 0.85 * r, max: 1.1 * r };
}

// allowed sigma pairs (class names sorted alphabetically before joining)
const SIGMA_OK = new Set(["s-s", "p-s", "hybrid-s", "hybrid-hybrid", "p-p", "hybrid-p"]);
const pairKey = (a, b) => [a.cls, b.cls].sort().join("-");
export const sigmaCompatible = (a, b) => SIGMA_OK.has(pairKey(a, b));
export const bondName = (o) => o.latex;

/**
 * Classify one pair of orbitals on DIFFERENT atoms.
 * returns { status: "sigma" | "pi" | "none", reason, d, window, score, label, ... }
 */
export function evaluatePair(a, b) {
  const none = (reason, extra = {}) => ({ status: "none", reason, ...extra });
  if (a.atomId === b.atomId) return none("same-atom");
  if (a.cls === "d" || b.cls === "d") return none("incompatible");
  const dv = sub(b.pos, a.pos); const L = len(dv); if (L < 1e-6) return none("too-close", { d: L });
  const u = scale(dv, 1 / L);
  // ---- choose sigma vs pi from the geometry of two p orbitals; everything else can only be sigma
  let type = "sigma";
  if (a.cls === "p" && b.cls === "p") {
    const alongA = Math.abs(dot(a.axis, u)); const alongB = Math.abs(dot(b.axis, u));
    if (alongA >= COS_SIGMA && alongB >= COS_SIGMA) type = "sigma";
    else if (alongA <= SIN_PERP && alongB <= SIN_PERP && Math.abs(dot(a.axis, b.axis)) >= COS_PAR) type = "pi";
    else return none("pi-misaligned", { d: L });
  } else if (!SIGMA_OK.has(pairKey(a, b))) return none("incompatible", { d: L });
  if (a.electrons !== 1 || b.electrons !== 1) return none("occupancy", { d: L });
  const win = distanceWindow(type, a, b);
  const base = { type, d: L, window: win, u };
  if (type === "sigma") {
    // facing lobe of each orbital and its phase sign
    let angA = 0; let angB = 0; let sa = 1; let sb = 1;
    if (a.axis) { const c = dot(a.axis, u); angA = angleDeg(a.axis, c >= 0 ? u : scale(u, -1)); sa = c >= 0 ? 1 : -1; }
    if (b.axis) { const c = dot(b.axis, scale(u, -1)); angB = angleDeg(b.axis, c >= 0 ? scale(u, -1) : u); sb = c >= 0 ? 1 : -1; }
    if (a.cls === "hybrid" && sa < 0) return none("small-lobe", { ...base });
    if (b.cls === "hybrid" && sb < 0) return none("small-lobe", { ...base });
    if (Math.max(angA, angB) > TOL.sigmaDeg) return none("misaligned", { ...base, angA, angB });
    if (sa !== sb) return none("phase", { ...base });
    if (L > win.max) return none("too-far", { ...base });
    if (L < win.min) return none("too-close", { ...base });
    const aq = 1 - (0.5 * Math.max(angA, angB)) / TOL.sigmaDeg;
    const dq = 1 - clamp(Math.abs(L - win.ideal) / (0.5 * (win.max - win.min)), 0, 1) * 0.6;
    const label = `\\sigma (${bondName(a)}–${bondName(b)})`;
    return { status: "sigma", reason: "ok", ...base, score: aq * dq, label, plain: `sigma ${a.plain}-${b.plain}`, center: add(a.pos, scale(u, L * (a.reach / (a.reach + b.reach)))), angA, angB };
  }
  // ---- pi: parallel p orbitals side by side
  const par = dot(a.axis, b.axis);
  if (par < 0) return none("phase", { ...base });
  if (L > win.max) return none("too-far", { ...base });
  if (L < win.min) return none("too-close", { ...base });
  const angP = angleDeg(a.axis, b.axis); const tilt = Math.max(Math.asin(clamp(Math.abs(dot(a.axis, u)), 0, 1)), Math.asin(clamp(Math.abs(dot(b.axis, u)), 0, 1))) * 180 / Math.PI;
  const aq = 1 - (0.5 * Math.max(angP, tilt)) / TOL.piParallelDeg;
  const dq = 1 - clamp(Math.abs(L - win.ideal) / (0.5 * (win.max - win.min)), 0, 1) * 0.6;
  const side = normalize(add(a.axis, b.axis));
  return { status: "pi", reason: "ok", ...base, score: aq * dq, label: `\\pi (${bondName(a)}–${bondName(b)})`, plain: `pi ${a.plain}-${b.plain}`, center: add(a.pos, scale(u, L / 2)), side };
}

/**
 * Detect all bonds among oriented orbital instances (greedy: best score first, an orbital bonds once).
 * returns { bonds, sigma, pi, near } where `near` is the most informative failed pair (for a hint), or null.
 */
export function analyseBonds(instances) {
  const cands = []; let near = null;
  const nuclei = []; for (const o of instances) if (!nuclei.some((n) => n.atomId === o.atomId)) nuclei.push({ atomId: o.atomId, pos: o.pos });
  // a third nucleus close to the line between two orbitals blocks their direct overlap
  const blocked = (a, b) => {
    const ab = sub(b.pos, a.pos); const L2 = dot(ab, ab);
    for (const n of nuclei) {
      if (n.atomId === a.atomId || n.atomId === b.atomId) continue;
      const t = dot(sub(n.pos, a.pos), ab) / L2; if (t <= 0.08 || t >= 0.92) continue;
      if (len(sub(n.pos, add(a.pos, scale(ab, t)))) < 0.55) return true;
    }
    return false;
  };
  for (let i = 0; i < instances.length; i += 1) {
    const a = instances[i];
    for (let j = i + 1; j < instances.length; j += 1) {
      const b = instances[j]; if (a.atomId === b.atomId) continue;
      const L = len(sub(b.pos, a.pos)); const lim = 1.35 * (a.reach + b.reach); if (L > lim) continue;
      let r = evaluatePair(a, b);
      if (r.status !== "none" && blocked(a, b)) r = { status: "none", reason: "blocked", d: L };
      if (r.status !== "none") cands.push({ a, b, r });
      else if (a.electrons === 1 && b.electrons === 1 && r.reason !== "incompatible" && r.reason !== "same-atom") {
        if (!near || L < near.d) near = { a, b, d: L, reason: r.reason };
      }
    }
  }
  cands.sort((x, y) => y.r.score - x.r.score);
  const used = new Set(); const bonds = [];
  for (const c of cands) {
    if (used.has(c.a.key) || used.has(c.b.key)) continue;
    used.add(c.a.key); used.add(c.b.key);
    bonds.push({ id: `${c.r.status}:${c.a.key}~${c.b.key}`, type: c.r.status, a: c.a, b: c.b, ...c.r });
  }
  bonds.sort((x, y) => (x.type === y.type ? (x.id < y.id ? -1 : 1) : x.type === "sigma" ? -1 : 1));
  const sigma = bonds.filter((b) => b.type === "sigma").length; const pi = bonds.length - sigma;
  // a "near" hint is only useful if the pair did not end up bonded another way
  if (near && (used.has(near.a.key) || used.has(near.b.key))) near = null;
  return { bonds, sigma, pi, near };
}

const SUP = { 1: "\u00b9", 2: "\u00b2", 3: "\u00b3", 4: "\u2074", 5: "\u2075", 6: "\u2076" };
/** LaTeX-ish bond label -> plain text with Unicode (orbital names stay "2pz" so the prose renderer can subscript them). */
export const labelText = (latex) => String(latex).replace(/\\sigma/g, "\u03c3").replace(/\\pi/g, "\u03c0").replace(/\^\{(\d)\}/g, (_, d) => SUP[d] ?? d).replace(/_\{([^}]+)\}/g, "$1");
export const bondSummary = (sigma, pi) => [sigma ? `${sigma} σ` : null, pi ? `${pi} π` : null].filter(Boolean).join(" + ") || "no bonds";
