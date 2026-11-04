// Qualitative intermolecular-force models (pure functions, no React / three). Everything here is a TEACHING MODEL built from
// classical electrostatics on the model data in ./molecules.js. It is NOT a quantum-chemical calculation, and the "strength"
// numbers are relative, unitless indicators, not interaction energies of real substances.
//
//   induced dipole      p = alpha' * E       (E = field of the neighbours' partial charges / instantaneous dipole at the molecule)
//   cloud shift         the electron cloud moves AGAINST the field (electrons are negative): near side electron-rich when the
//                       field comes from a delta-plus source; reversing the source reverses the shift
//   London dispersion   instantaneous dipole in A -> field -> induced dipole in B; the induced energy -1/2 alpha |E|^2 is always
//                       attractive, and adjacent charges are opposite (proved by the algebra, tested in test-imf-model.mjs)
//   dipole-dipole       point-charge Coulomb sum over the model partial charges (orientation + distance dependent)
//   hydrogen bond       X-H...A with X, A in {N, O, F}: H...A distance window, X-H...A angle >= ~150 deg, acceptor lone-pair alignment
import { ELEM, MOLECULES, atomWorld } from "./molecules.js";
import { add, angleDeg, dist, dot, len, norm, qFromTo, qRot, scale, smoothstep, sub } from "./vec.js";

export const FORCES = ["ldf", "dip-ind", "dip-dip", "hbond"];
export const FORCE_LABEL = { ldf: "London dispersion", "dip-ind": "Dipole–induced dipole", "dip-dip": "Dipole–dipole", hbond: "Hydrogen bonding" };
export const FORCE_SHORT = { ldf: "London", "dip-ind": "Dipole–induced", "dip-dip": "Dipole–dipole", hbond: "H-bonding" };
export const EV_PER_E2_PER_A = 14.3996; // e^2 / A in eV
export const FIELD_SOFT = 0.45; // A, softening length of the field of a point charge

/** First ionisation energy (eV, NIST) used only in the London (Slater-Kirkwood-type) estimate of RELATIVE dispersion strength. */
export const IONISATION_EV = { H2: 15.43, N2: 15.58, O2: 12.07, Cl2: 11.48, CH4: 12.61, CO2: 13.78, Ar: 15.76, I2: 9.31, Ne: 21.56, F2: 15.7, HCl: 12.75, HBr: 11.67, SO2: 12.35, H2O: 12.62, NH3: 10.07, HF: 16.04 };

export const worldAtoms = (mol, pose) => mol.atoms.map((_, i) => atomWorld(mol, pose, i));

// ---- electric field ----------------------------------------------------------------------------------------------------
/** Field (e/A^2) of the partial charges of one posed molecule at a point. */
export function fieldOfMolecule(mol, pose, point) {
  let e = [0, 0, 0];
  for (let i = 0; i < mol.atoms.length; i += 1) {
    const q = mol.atoms[i].q; if (q === 0) continue;
    const r = sub(point, atomWorld(mol, pose, i)); const d2 = dot(r, r) + FIELD_SOFT * FIELD_SOFT; const k = q / (d2 * Math.sqrt(d2));
    e = add(e, scale(r, k));
  }
  return e;
}
/** Field of a point dipole p (e*A) located at `at`, evaluated at `point` (softened). */
export function fieldOfPointDipole(p, at, point) {
  const r = sub(point, at); const d2 = dot(r, r) + FIELD_SOFT * FIELD_SOFT; const d = Math.sqrt(d2); const rh = scale(r, 1 / d);
  return scale(sub(scale(rh, 3 * dot(p, rh)), p), 1 / (d2 * d));
}
/** Induced dipole (e*A) of a molecule in a field E: p = alpha' E. */
/** Molecular axis (unit vector, molecule frame) of a linear nonpolar molecule, else null. */
const linearAxis = (mol) => { if (mol._axis !== undefined) return mol._axis; const a = mol.atoms; mol._axis = a.length >= 2 && (mol.kind === "diatomic" || mol.id === "CO2") && !mol.polar ? norm(sub(a[a.length - 1].p, a[0].p)) : null; return mol._axis; };
const ANISO_F = 0.09; // polarizability anisotropy of a linear molecule: alpha_par = alpha (1 + 2f), alpha_perp = alpha (1 - f); f = 0.09 ~ alpha_par/alpha_perp = 1.3 (H2: 1.29)
/** Effective polarizability (A^3) of `mol` along the world direction `dir`: anisotropic for linear molecules, so the response depends on orientation. */
export function alphaAlong(mol, quat, dir) { const ax = quat ? linearAxis(mol) : null; if (!ax) return mol.alpha; const c = dot(qRot(quat, ax), norm(dir)); return mol.alpha * (1 - ANISO_F + 3 * ANISO_F * c * c); }
/** Induced dipole p = alpha . E (A^3 * e/A^2 = e*A); with `quat` the molecule's polarizability tensor is axially symmetric about its bond axis. */
export function inducedDipole(mol, field, quat) {
  const ax = quat ? linearAxis(mol) : null; if (!ax) return scale(field, mol.alpha);
  const w = qRot(quat, ax); const par = dot(field, w); return add(scale(field, mol.alpha * (1 - ANISO_F)), scale(w, mol.alpha * 3 * ANISO_F * par));
}

// ---- London dispersion ---------------------------------------------------------------------------------------------------
/** London estimate of the dispersion energy (eV, negative = attraction): U = -3/2 * IA*IB/(IA+IB) * alphaA * alphaB / r^6. Uses ionisation energy AND polarizability, not size alone. */
export function londonEnergyEv(a, b, r) {
  const Ia = IONISATION_EV[a.id] ?? 13; const Ib = IONISATION_EV[b.id] ?? 13;
  return (-1.5 * ((Ia * Ib) / (Ia + Ib)) * a.alpha * b.alpha) / r ** 6;
}
/**
 * Instantaneous (fluctuation) dipole of a nonpolar molecule that has a nonpolar neighbour. It is CORRELATED with the neighbour, not a
 * spinning vector: the electron-rich end is the one facing away from the neighbour (delta+ end faces it) along the A->B axis, so the
 * field it makes at B induces the opposite facing end on B. The only time dependence is a bounded breathing of the amplitude
 * (never a direction sweep), so the cloud can neither spin nor change which end is which.
 */
export const fluctuationAmplitude = (t) => 0.9 + 0.1 * Math.sin(1.7 * t);
/** 1 at contact, smoothly 0 when the molecules are far apart: the correlation (and so the visible fluctuation) needs a close neighbour. */
export const fluctuationGate = (r, radiusA, radiusB) => { const s = radiusA + radiusB; return 1 - smoothstep(1.15 * s, 2.0 * s, r); };
export const P_MIN_VISIBLE = 0.0008; // e*A: below this net dipole nothing is labelled or connected (the display is the symmetric average)
export const P_FLUCT = 0.07; // e*A: visual amplitude of the instantaneous dipole of the reference molecule (H2)

/** Sign (+1 delta-plus, -1 delta-minus) of the end of a dipole p that faces the direction `toward`. 0 when perpendicular. */
export function nearSideSign(p, toward) { const c = dot(norm(p), norm(toward)); return Math.abs(c) < 1e-6 ? 0 : c > 0 ? 1 : -1; }

// ---- dipole-dipole -----------------------------------------------------------------------------------------------------
/** Electrostatic interaction energy (eV) of the model partial charges of two posed molecules. Negative = attraction. */
export function coulombEv(ma, pa, mb, pb) {
  let u = 0;
  for (let i = 0; i < ma.atoms.length; i += 1) { const qa = ma.atoms[i].q; if (qa === 0) continue; const ra = atomWorld(ma, pa, i);
    for (let j = 0; j < mb.atoms.length; j += 1) { const qb = mb.atoms[j].q; if (qb === 0) continue; u += (qa * qb) / Math.sqrt(dist(ra, atomWorld(mb, pb, j)) ** 2 + 0.09); } }
  return u * EV_PER_E2_PER_A;
}
const U0_DD = 0.03; // eV scale of the (signed) dipole-dipole indicator
/** signed 0..1 indicator: +1 strongly attractive, -1 strongly repulsive (relative, unitless). */
export const dipoleDipoleIndicator = (uEv) => Math.tanh(-uEv / U0_DD);

// ---- hydrogen bonding ----------------------------------------------------------------------------------------------------
export const HB = { dMin: 1.3, dFullLo: 1.6, dFullHi: 2.1, dMax: 2.6, angFull: 150, angMin: 115, lpFull: 35, lpMax: 75, threshold: 0.05 };
export function hbDistanceFactor(d) { return d < HB.dFullLo ? smoothstep(HB.dMin, HB.dFullLo, d) : d <= HB.dFullHi ? 1 : 1 - smoothstep(HB.dFullHi, HB.dMax, d); }
export const hbAngleFactor = (ang) => smoothstep(HB.angMin, HB.angFull, ang);
export const hbLonePairFactor = (ang) => 1 - smoothstep(HB.lpFull, HB.lpMax, ang);
/** All donor -> acceptor candidates between two posed molecules (both directions). Each has a continuous strength 0..1. */
export function hydrogenBonds(ma, pa, mb, pb) {
  const out = [];
  const scan = (dm, dp, am, ap, donorIsA) => {
    for (const { d, h } of dm.donors) {
      const D = atomWorld(dm, dp, d); const H = atomWorld(dm, dp, h);
      for (const acc of am.acceptors) {
        const A = atomWorld(am, ap, acc.atom); const dHA = dist(H, A);
        const ang = angleDeg(sub(D, H), sub(A, H));
        const toH = sub(H, A); let lpAng = 180;
        for (const lp of acc.lps) lpAng = Math.min(lpAng, angleDeg(qRot(ap.quat, lp), toH));
        const strength = hbDistanceFactor(dHA) * hbAngleFactor(ang) * hbLonePairFactor(lpAng);
        out.push({ donorIsA, donorAtom: d, hAtom: h, acceptorAtom: acc.atom, dHA, angle: ang, lpAngle: lpAng, strength, H, A, D });
      }
    }
  };
  scan(ma, pa, mb, pb, true); scan(mb, pb, ma, pa, false);
  return out;
}

// ---- pair applicability and teaching text ----------------------------------------------------------------------------------
const NO_DIPOLE_REASON = {
  H2: "its two identical atoms share the electrons equally", N2: "its two identical atoms share the electrons equally", O2: "its two identical atoms share the electrons equally",
  Cl2: "its two identical atoms share the electrons equally", I2: "its two identical atoms share the electrons equally", F2: "its two identical atoms share the electrons equally",
  CH4: "C–H bonds are essentially non-polar and the tetrahedral shape is symmetric", CO2: "its C=O bonds are polar, but they point in opposite directions and cancel (linear)",
  Ar: "it is a single atom", Ne: "it is a single atom",
};
const sym = (m) => m.label;
export function noDipoleReason(mol) { return NO_DIPOLE_REASON[mol.id] ?? "its bond dipoles cancel"; }
export function hbondRole(mol) {
  const donor = mol.donors.length > 0; const acceptor = mol.acceptors.length > 0;
  if (donor && acceptor) return "donor+acceptor";
  if (donor) return "donor"; if (acceptor) return "acceptor"; return "none";
}
function noHbondReason(mol) {
  if (mol.id === "HCl" || mol.id === "HBr") return `${sym(mol)}: its hydrogen is bonded to ${mol.atoms[1].el === "Cl" ? "Cl" : "Br"}, not N, O or F, so it is not a hydrogen-bond donor (its dipole–dipole forces are shown instead)`;
  if (mol.id === "SO2") return "SO₂ has no hydrogen atoms bonded to N, O or F (it cannot donate) and is not treated as an acceptor in this model";
  if (mol.atoms.some((a) => a.el === "H")) return `${sym(mol)}: hydrogen is not bonded to N, O or F`;
  return `${sym(mol)} has no hydrogen atom bonded to N, O or F`;
}
/** { applicable, text } for the chosen force and a pair of molecules (mol objects). */
export function pairApplicability(force, a, b) {
  const both = `${sym(a)} and ${sym(b)}`;
  if (force === "ldf") return { applicable: true, text: `London dispersion acts between ALL atoms and molecules, polar or not. It is the only attraction between ${both} that does not need a permanent dipole.` };
  if (force === "dip-ind") {
    if (!a.polar && !b.polar) return { applicable: false, text: `${both}: neither has a permanent dipole (${sym(a)}: ${noDipoleReason(a)}), so there is no dipole–induced dipole force. Try a polar molecule such as HCl with Ar. London dispersion still acts.` };
    const p = a.polar ? a : b; const n = a.polar ? b : a;
    return { applicable: true, text: p.polar && n.polar ? `Both molecules are polar: each one's field also polarises the other (induced dipoles), in addition to the dipole–dipole attraction.` : `${sym(p)} has a permanent dipole. Its electric field shifts the electrons of ${sym(n)}, giving a temporary induced dipole that is attracted to ${sym(p)}.` };
  }
  if (force === "dip-dip") {
    if (!a.polar || !b.polar) { const np = !a.polar ? a : b; return { applicable: false, text: `Dipole–dipole forces need TWO permanent dipoles. ${sym(np)} has none: ${noDipoleReason(np)}. London dispersion still acts${np.id === "CO2" ? "; CO₂ is not polar overall" : ""}.` }; }
    return { applicable: true, text: `Both molecules have permanent dipoles. Unlike partial charges facing each other attract; like charges facing each other repel, so orientation and distance both matter.` };
  }
  // hbond
  const ab = a.donors.length > 0 && b.acceptors.length > 0; const ba = b.donors.length > 0 && a.acceptors.length > 0;
  if (ab || ba) return { applicable: true, text: `A hydrogen bond forms when an H bonded to N, O or F lines up (X–H···A about 180°) with a lone pair on the N, O or F of a neighbouring molecule. It is a strong, directional dipole–dipole interaction, separate from the covalent bond.` };
  const reasons = [];
  if (a.donors.length === 0 && b.donors.length === 0) reasons.push(noHbondReason(a)); else if (a.donors.length === 0 && b.acceptors.length === 0) reasons.push(noHbondReason(a)); else reasons.push(a.donors.length > 0 ? `${sym(b)} has no N, O or F lone pair to accept it` : noHbondReason(a));
  if (b.donors.length === 0 && !reasons[0].includes(sym(b))) reasons.push(noHbondReason(b));
  return { applicable: false, text: `No hydrogen bond between ${both}: ${reasons.slice(0, 2).join("; ")}. Other forces still act.` };
}

// ---- the whole-scene model -----------------------------------------------------------------------------------------------------
const U0_IND = 2.4e-4; // e^2/A scale of the induced-dipole attraction indicator
const U0_LDF = 0.012; // eV scale of the London indicator
const P0_SAT = 0.03; // e*A: saturation of the visual cloud shift
/** Greedy nearest-neighbour pairing; source = lower index. Returns [[i, j], ...] */
export function pairUp(entries, maxDist = 16) {
  const cand = [];
  for (let i = 0; i < entries.length; i += 1) for (let j = i + 1; j < entries.length; j += 1) cand.push([i, j, dist(entries[i].pose.pos, entries[j].pose.pos)]);
  cand.sort((x, y) => x[2] - y[2]);
  const used = new Set(); const out = [];
  for (const [i, j, d] of cand) { if (d > maxDist || used.has(i) || used.has(j)) continue; used.add(i); used.add(j); out.push([i, j]); }
  return out;
}
export function overlapOf(ma, pa, mb, pb) {
  let worst = 0;
  for (let i = 0; i < ma.atoms.length; i += 1) for (let j = 0; j < mb.atoms.length; j += 1) {
    const lim = (ELEM[ma.atoms[i].el].vdw + ELEM[mb.atoms[j].el].vdw) * 0.72; const d = dist(atomWorld(ma, pa, i), atomWorld(mb, pb, j));
    worst = Math.max(worst, smoothstep(lim, lim * 0.7, d));
  }
  return worst;
}

/**
 * entries: [{ uid, mol, pose }]. ctx: { force, t (s), fluct: { gain 0..1, fixedDir|null }, exaggeration }.
 * Returns { mols: [{ p (induced+instantaneous dipole, e*A), induced, instant, fieldE, shift (A, cloud displacement), polarity }], pairs: [...], hbonds: [...] }.
 */
export function computeInteractions(entries, ctx = {}) {
  const { force = "ldf", t = 0, fluct = { gain: 1, fixedDir: null }, exaggeration = 1 } = ctx;
  const n = entries.length;
  const out = { mols: entries.map(() => ({ instant: [0, 0, 0], induced: [0, 0, 0], p: [0, 0, 0], field: [0, 0, 0], shift: [0, 0, 0], source: false })), pairs: [], hbonds: [], matched: [] };
  if (n === 0) return out;
  // 1) instantaneous dipoles: in each matched pair the lower index is the fluctuating source (London dispersion emphasised or always on
  //    at a lower gain so clouds of nonpolar molecules visibly "breathe" in Explore)
  const matched = pairUp(entries); out.matched = matched;
  const sources = [];
  for (const [i, j] of matched) {
    const A = entries[i]; const B = entries[j];
    const axis = sub(B.pose.pos, A.pose.pos); if (len(axis) < 1e-6) continue;
    if (A.mol.polar || B.mol.polar) continue; // a permanent dipole dominates: polar molecules are never "sources"; they just polarise the neighbour
    const dir = fluct.fixedDir ? norm(fluct.fixedDir) : norm(axis);
    const gate = fluctuationGate(len(axis), A.mol.radius, B.mol.radius);
    const amp = (fluct.fixedDir ? 1 : fluctuationAmplitude(t)) * gate * fluct.gain * P_FLUCT * Math.sqrt(A.mol.alpha / 0.787);
    const p = scale(dir, amp); out.mols[i].instant = p; out.mols[i].source = true; sources.push({ idx: i, p, at: A.pose.pos });
  }
  // 2) fields at every molecule from the permanent charges of the others and the instantaneous dipoles
  for (let j = 0; j < n; j += 1) {
    let e = [0, 0, 0];
    for (let i = 0; i < n; i += 1) if (i !== j) e = add(e, fieldOfMolecule(entries[i].mol, entries[i].pose, entries[j].pose.pos));
    for (const s of sources) if (s.idx !== j) e = add(e, fieldOfPointDipole(s.p, s.at, entries[j].pose.pos));
    out.mols[j].field = e; out.mols[j].induced = inducedDipole(entries[j].mol, e, entries[j].pose.quat);
    out.mols[j].p = add(out.mols[j].induced, out.mols[j].instant);
    // cloud shift is against the dipole direction, saturating (a visual choice, labelled qualitative in the UI)
    const pm = len(out.mols[j].p);
    const smax = 0.3 * entries[j].mol.radius; const sh = pm > 1e-9 ? smax * Math.tanh(Math.sqrt(pm / P0_SAT)) * exaggeration : 0;
    out.mols[j].shift = pm > 1e-9 ? scale(norm(out.mols[j].p), -sh) : [0, 0, 0];
  }
  // 3) pair indicators
  for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) {
    const A = entries[i]; const B = entries[j]; const r = dist(A.pose.pos, B.pose.pos);
    const app = pairApplicability(force, A.mol, B.mol);
    const hb = hydrogenBonds(A.mol, A.pose, B.mol, B.pose).map((h) => ({ ...h, i, j }));
    const hbStrength = hb.reduce((m, h) => Math.max(m, h.strength), 0);
    let kind = "none"; let strength = 0; let sign = 0; let energyEv = 0;
    const ov = overlapOf(A.mol, A.pose, B.mol, B.pose);
    if (force === "ldf") { const axisAB = sub(B.pose.pos, A.pose.pos); energyEv = londonEnergyEv({ id: A.mol.id, alpha: alphaAlong(A.mol, A.pose.quat, axisAB) }, { id: B.mol.id, alpha: alphaAlong(B.mol, B.pose.quat, axisAB) }, Math.max(r, 2.2)); strength = (1 - Math.exp(-Math.abs(energyEv) / U0_LDF)) * (A.mol.polar || B.mol.polar ? 1 : fluctuationGate(r, A.mol.radius, B.mol.radius)); sign = 1; kind = "attract"; }
    else if (force === "dip-ind" && app.applicable) {
      const ea = fieldOfMolecule(A.mol, A.pose, B.pose.pos); const eb = fieldOfMolecule(B.mol, B.pose, A.pose.pos);
      const u = -0.5 * B.mol.alpha * dot(ea, ea) - 0.5 * A.mol.alpha * dot(eb, eb); energyEv = u * EV_PER_E2_PER_A; strength = 1 - Math.exp(-Math.abs(u) / U0_IND); sign = 1; kind = "attract";
    } else if (force === "dip-dip" && app.applicable) {
      energyEv = coulombEv(A.mol, A.pose, B.mol, B.pose); const s = dipoleDipoleIndicator(energyEv); sign = s >= 0 ? 1 : -1; strength = Math.abs(s); kind = sign > 0 ? "attract" : "repel";
    } else if (force === "hbond" && app.applicable) { strength = hbStrength; sign = hbStrength > HB.threshold ? 1 : 0; kind = sign ? "hbond" : "none"; }
    out.pairs.push({ i, j, r, applicable: app.applicable, text: app.text, kind, strength: Math.min(1, strength), sign, energyEv, overlap: ov, hbStrength, hbonds: hb.filter((h) => h.strength > HB.threshold), matched: matched.some(([a, b]) => a === i && b === j) });
    for (const h of hb) out.hbonds.push(h);
  }
  return out;
}

// ---- charge sites and the dotted indicator lines (shared by Explore, Learn and the tests) --------------------------------------------------
/** Charge sites of a molecule (world positions, sign +1 = delta+ / -1 = delta-): every charged ATOM of a polar molecule (multi-site, not one lumped
 *  pair), the two ends of the induced / instantaneous dipole of a nonpolar one -- nothing at all while that dipole is below P_MIN_VISIBLE
 *  (the symmetric time-averaged cloud has no poles). `st` = the molecule's entry of computeInteractions(). */
export function chargeSites(mol, pose, st) {
  const out = [];
  if (mol.polar) { mol.atoms.forEach((a, k) => { if (Math.abs(a.q) > 0.02) out.push({ p: atomWorld(mol, pose, k), sign: a.q > 0 ? 1 : -1 }); }); return out; }
  const pl = len(st.p); if (pl < P_MIN_VISIBLE) return out;
  const u = norm(st.p); const c = add(pose.pos, st.shift); const R = mol.radius * 0.55; // p points to the delta+ end
  out.push({ p: add(c, scale(u, R)), sign: 1 }); out.push({ p: add(c, scale(u, -R)), sign: -1 });
  return out;
}
/** One dotted indicator per interacting pair: attraction joins the nearest OPPOSITE pair of charge sites, repulsion the nearest LIKE pair, so
 *  delta+ ... delta+ (or delta- ... delta-) is never drawn as an attraction. Hydrogen bonds join the donor H to the acceptor atom. */
export function interactionLines(entries, inter, force) {
  const out = [];
  for (const pr of inter.pairs) {
    const A = entries[pr.i]; const B = entries[pr.j];
    if (force === "hbond") { for (const h of pr.hbonds) out.push({ i: pr.i, j: pr.j, kind: "hbond", a: h.H, b: h.A, signA: 1, signB: -1, strength: h.strength, hbond: h }); continue; }
    if ((pr.kind !== "attract" && pr.kind !== "repel") || pr.strength < 0.04) continue;
    const sa = chargeSites(A.mol, A.pose, inter.mols[pr.i]); const sb = chargeSites(B.mol, B.pose, inter.mols[pr.j]); let best = null;
    for (const x of sa) for (const y of sb) { const same = x.sign === y.sign; if ((pr.kind === "attract") === same) continue; const dd = dist(x.p, y.p); if (!best || dd < best.d) best = { d: dd, a: x.p, b: y.p, signA: x.sign, signB: y.sign }; }
    if (best && best.d > 0.6) out.push({ i: pr.i, j: pr.j, kind: pr.kind, a: best.a, b: best.b, signA: best.signA, signB: best.signB, strength: pr.strength, d: best.d });
  }
  return out;
}

// ---- helper: pose that gives a good hydrogen bond (used by the Learn lesson, Try-in-Explore and the tests) ------------------------
/** Pose of an acceptor molecule so that donor hydrogen `hAtom` of the donor pose lies on its lone pair `lpIndex` at distance dHA with X-H...A = 180 deg. */
export function acceptorPoseForHBond(donorMol, donorPose, donorAtom, hAtom, acceptorMol, lpIndex = 0, dHA = 1.95, twist = 0) {
  const D = atomWorld(donorMol, donorPose, donorAtom); const H = atomWorld(donorMol, donorPose, hAtom); const u = norm(sub(H, D));
  const acc = acceptorMol.acceptors[0]; const lp = acc.lps[lpIndex]; // local lone-pair direction of the acceptor atom
  const q0 = qFromTo(lp, scale(u, -1)); // lone pair points from A back to H
  // optional twist about the H...A axis
  const half = twist / 2; const s = Math.sin(half); const qt = [u[0] * s, u[1] * s, u[2] * s, Math.cos(half)];
  const q = qMulSafe(qt, q0);
  const A = add(H, scale(u, dHA)); const aLocal = acceptorMol.atoms[acc.atom].p;
  return { pos: sub(A, qRot(q, aLocal)), quat: q };
}
function qMulSafe(a, b) { return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]]; }
export { MOLECULES };
