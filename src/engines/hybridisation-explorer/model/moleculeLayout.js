// Turns the pure molecule DATA (moleculeData.js) into a 3D arrangement and a compiled step list. Pure (no React / three).
// Positions and orientations are COMPUTED: every atom is placed so that the two orbitals of a sigma bond face each other along
// the bond axis at the ideal distance of the overlap engine; the pi partners are then twisted parallel. The result is checked
// by running the very same overlap engine used in the Orbital Lab on the final geometry (see compileMolecule().problems).
import { createAtom } from "./workspace.js";
import { mixOrbitals } from "./hybrids.js";
import { atomOrbitalInstances, analyseBonds, distanceWindow } from "./overlap.js";
import { P_AXIS, P_LATERAL, reach as reachOf } from "./orbitals.js";
import { MOLECULE_BY_ID } from "./moleculeData.js";
import { QI, add, sub, scale, neg, len, normalize, qMul, qRotate, qFromAxisAngle, qFromUnitVectors, signedAngleAbout, rad } from "./vec.js";

export const APPROACH_GAP = 1.4; // extra separation (scene units) before a bond forms, closed during the bond step

function buildAtom(id, spec) {
  const atom = createAtom(id, spec.el, [0, 0, 0], spec.kind ?? "ground");
  if (spec.mix) {
    const r = mixOrbitals(atom.orbitals, spec.mix);
    if (!r.ok) throw new Error(`${id}: ${r.reason}`);
    atom.hybrid = { recipeId: r.recipeId, consumed: r.consumed, remaining: r.remaining, hybrids: r.hybrids, totalElectrons: r.totalElectrons };
  }
  return atom;
}
export function resolveRef(atom, ref) {
  const m = /^h(\d+)$/.exec(ref);
  if (m) { const h = atom.hybrid?.hybrids[Number(m[1])]; if (!h) throw new Error(`${atom.id} has no hybrid ${ref}`); return h.id; }
  if (!atom.orbitals.some((o) => o.id === ref)) throw new Error(`${atom.id} has no orbital ${ref}`);
  return ref;
}
const pseudoP = (n) => ({ cls: "p", n, reach: reachOf("p", n), terms: [["pz", 1]] }); // stand-in for a p orbital when only the pi window is needed
const inst = (atom, orbId) => atomOrbitalInstances(atom).find((o) => o.orbId === orbId);

/** Ideal centre distance of a bonded pair, honouring any pi bonds between the same two atoms (shorter, like a real C=C). */
export function idealBondDistance(sigmaA, sigmaB, piPairs = []) {
  const s = distanceWindow("sigma", sigmaA, sigmaB);
  if (!piPairs.length) return s.ideal;
  let lo = s.min; let hi = s.max;
  for (const [pa, pb] of piPairs) { const w = distanceWindow("pi", pa, pb); lo = Math.max(lo, w.min); hi = Math.min(hi, w.max); }
  return lo <= hi ? Math.min(hi, Math.max(lo, lo + 0.4 * (hi - lo))) : s.ideal; // near the close end of the shared window: the pi lobes need to be close to overlap
}

function placeChild(atoms, spec, bond, parentId, pRef, childId, cRef, rootDir) {
  const P = atoms[parentId]; const C = atoms[childId];
  const pOrb = resolveRef(P, pRef); const cOrb = resolveRef(C, cRef);
  const pInst = inst(P, pOrb); const cLocal = inst({ ...C, pos: [0, 0, 0], quat: QI }, cOrb);
  const f = pInst.cls === "s" ? normalize(rootDir ?? [1, 0, 0]) : pInst.axis; // direction from parent towards child (the + lobe)
  const lobe = cLocal.cls === "s" ? null : cLocal.axis;
  let quat = lobe ? qFromUnitVectors(lobe, neg(f)) : QI;
  // distance (pi partners between the same two atoms shorten it)
  const piBonds = spec.bonds.filter((b) => b.type === "pi" && ((b.a[0] === parentId && b.b[0] === childId) || (b.a[0] === childId && b.b[0] === parentId)));
  const piPairs = piBonds.map(() => [pseudoP(P.orbitals[0].n), pseudoP(C.orbitals[0].n)]);
  const d = idealBondDistance(pInst, cLocal, piPairs);
  const pos = add(P.pos, scale(f, d));
  // twist about the bond axis
  if (piBonds.length) {
    const b = piBonds[0]; const [pPi, cPi] = b.a[0] === parentId ? [b.a[1], b.b[1]] : [b.b[1], b.a[1]];
    const pAxis = qRotate(P.quat, P_AXIS[P.orbitals.find((o) => o.id === resolveRef(P, pPi)).kind]);
    const cAxis = qRotate(quat, P_AXIS[C.orbitals.find((o) => o.id === resolveRef(C, cPi)).kind]);
    quat = qMul(qFromAxisAngle(f, signedAngleAbout(cAxis, pAxis, f)), quat);
  } else if (bond.staggered && P.hybrid && C.hybrid) {
    const vP = qRotate(P.quat, P.hybrid.hybrids[1].direction); const vC = qRotate(quat, C.hybrid.hybrids[1].direction);
    quat = qMul(qFromAxisAngle(f, signedAngleAbout(vC, vP, f) + rad(60)), quat);
  }
  C.pos = pos; C.quat = quat;
}

/** Lay out the whole molecule; returns the atoms (id -> atom with pos/quat). */
export function layoutAtoms(spec) {
  const atoms = Object.fromEntries(Object.entries(spec.atoms).map(([id, a]) => [id, buildAtom(id, a)]));
  const placed = new Set([spec.root]); atoms[spec.root].pos = [0, 0, 0]; atoms[spec.root].quat = QI;
  if (spec.ring) { // regular hexagon in the xy plane: side = radius = C-C distance; hybrid h0 of every carbon points outward
    const b0 = spec.bonds[0]; const pi = (id) => inst(atoms[id], atoms[id].hybrid.hybrids[0].id);
    const dσ = idealBondDistance(pi(b0.a[0]), pi(b0.b[0]), []); const dπ = idealBondDistance(pi(b0.a[0]), pi(b0.b[0]), [[pseudoP(2), pseudoP(2)]]);
    const R = 0.5 * (dσ + dπ); // between a single and a double bond length, like benzene's intermediate C-C bonds
    spec.ring.forEach((id, i) => { const th = (Math.PI / 3) * i; atoms[id].pos = [R * Math.cos(th), R * Math.sin(th), 0]; atoms[id].quat = qFromAxisAngle([0, 0, 1], th); placed.add(id); });
  }
  const edges = spec.bonds.filter((b) => b.type === "sigma");
  for (let guard = 0; guard < 50 && placed.size < Object.keys(atoms).length; guard += 1) {
    for (const b of edges) {
      const [aId, aRef] = b.a; const [bId, bRef] = b.b;
      if (placed.has(aId) && !placed.has(bId)) { placeChild(atoms, spec, b, aId, aRef, bId, bRef, spec.rootDir); placed.add(bId); }
      else if (placed.has(bId) && !placed.has(aId)) { placeChild(atoms, spec, b, bId, bRef, aId, aRef, spec.rootDir); placed.add(aId); }
    }
  }
  if (placed.size < Object.keys(atoms).length) throw new Error(`${spec.id}: disconnected molecule`);
  return atoms;
}

const refKey = (atoms, [aid, ref]) => `${aid}|${resolveRef(atoms[aid], ref)}`;

/** Compile a molecule: geometry + detected bonds + derived step states + consistency problems (empty when everything agrees). */
export function compileMolecule(idOrSpec) {
  const spec = typeof idOrSpec === "string" ? MOLECULE_BY_ID[idOrSpec] : idOrSpec;
  const atoms = layoutAtoms(spec); const atomList = Object.values(atoms);
  const problems = [];
  // ---- detect bonds on the final geometry with the same engine as the Orbital Lab
  const delocalised = new Set(spec.ring ? spec.ring.map((id) => `${id}|2pz`) : []);
  const instances = atomList.flatMap(atomOrbitalInstances).filter((o) => !delocalised.has(o.key));
  const analysis = analyseBonds(instances);
  const detectedByKey = new Map(analysis.bonds.map((b) => [[b.a.key, b.b.key].sort().join("~"), b]));
  const bonds = spec.bonds.map((b) => {
    const ka = refKey(atoms, b.a); const kb = refKey(atoms, b.b);
    const det = detectedByKey.get([ka, kb].sort().join("~")) ?? null;
    if (!det) problems.push(`${b.id}: not detected by the overlap engine`);
    else if (det.type !== b.type) problems.push(`${b.id}: detected as ${det.type}, data says ${b.type}`);
    for (const [aid, ref] of [b.a, b.b]) { const o = inst(atoms[aid], resolveRef(atoms[aid], ref)); if (o && o.electrons !== 1) problems.push(`${b.id}: ${aid}:${ref} holds ${o.electrons} electrons (needs exactly 1)`); }
    return { ...b, aKey: ka, bKey: kb, detected: det };
  });
  const specKeys = new Set(bonds.map((b) => [b.aKey, b.bKey].sort().join("~")));
  for (const k of detectedByKey.keys()) if (!specKeys.has(k)) problems.push(`engine found an unlisted bond ${k}`);
  const nSigma = bonds.filter((b) => b.type === "sigma").length; const nPi = bonds.filter((b) => b.type === "pi").length;
  if (nSigma !== spec.expected.sigma || nPi !== spec.expected.pi) problems.push(`data gives ${nSigma}σ+${nPi}π, expected ${spec.expected.sigma}σ+${spec.expected.pi}π`);
  if (analysis.sigma !== spec.expected.sigma || analysis.pi !== spec.expected.pi) problems.push(`geometry gives ${analysis.sigma}σ+${analysis.pi}π, expected ${spec.expected.sigma}σ+${spec.expected.pi}π`);
  const bondsById = Object.fromEntries(bonds.map((b) => [b.id, b]));

  // ---- steps
  const visible = new Set(); const hybridised = new Set(); const formed = []; const anchored = new Set(); const offsets = {}; const anchorStep = {};
  const steps = spec.steps.map((st, i) => {
    (st.add ?? []).forEach((id) => visible.add(id));
    const newHyb = (st.hybridise ?? []).filter((id) => !hybridised.has(id));
    const forms = (st.form ?? []).map((id) => { if (!bondsById[id]) problems.push(`step ${i + 1}: unknown bond ${id}`); return bondsById[id]; }).filter(Boolean);
    for (const b of forms) for (const [aid] of [b.a, b.b]) if (!visible.has(aid)) problems.push(`step ${i + 1}: bond ${b.id} uses hidden atom ${aid}`);
    // approach (sigma bonds only): hubs (several bonds this step) and already anchored atoms stay put
    const sig = forms.filter((b) => b.type === "sigma"); const cnt = {};
    for (const b of sig) { cnt[b.a[0]] = (cnt[b.a[0]] ?? 0) + 1; cnt[b.b[0]] = (cnt[b.b[0]] ?? 0) + 1; }
    for (const b of sig) {
      const A = atoms[b.a[0]]; const B = atoms[b.b[0]]; const u = normalize(sub(B.pos, A.pos));
      const wA = anchored.has(A.id) || cnt[A.id] > 1 ? 0 : 1; const wB = anchored.has(B.id) || cnt[B.id] > 1 ? 0 : 1; const w = wA + wB; if (!w) continue;
      if (wA) { offsets[A.id] = scale(u, -APPROACH_GAP * (wA / w)); anchorStep[A.id] = i; }
      if (wB) { offsets[B.id] = scale(u, APPROACH_GAP * (wB / w)); anchorStep[B.id] = i; }
    }
    for (const b of forms) { anchored.add(b.a[0]); anchored.add(b.b[0]); }
    newHyb.forEach((id) => hybridised.add(id)); forms.forEach((b) => formed.push(b.id));
    const sigma = formed.filter((id) => bondsById[id].type === "sigma").length; const pi = formed.length - sigma;
    const focus = st.focus ?? [...hybridised][0] ?? [...visible][0];
    return { index: i, text: st.text, visible: [...visible], hybridised: [...hybridised], newHybridise: newHyb, formed: [...formed], newForm: forms.map((b) => b.id), emphasise: st.emphasise ?? [], ring: !!st.ring, focus, sigma, pi };
  });
  // ---- two-stage approach of pi-bonded pairs: after the sigma step the pair stays at a distance where the sigma lobes overlap but the two
  // parallel p lobes have not yet met; in the pi step the pair closes to the final (shorter) distance so the sideways overlap is revealed.
  const piStage = {};
  const bondStep = (id) => steps.findIndex((s) => s.newForm.includes(id));
  const sigmaCount = (atomId, upTo) => bonds.filter((b) => b.type === "sigma" && (b.a[0] === atomId || b.b[0] === atomId) && bondStep(b.id) <= upTo).length;
  for (const pb of bonds.filter((b) => b.type === "pi")) {
    const idA = pb.a[0]; const idB = pb.b[0]; const sg = bonds.find((b) => b.type === "sigma" && ((b.a[0] === idA && b.b[0] === idB) || (b.a[0] === idB && b.b[0] === idA)));
    if (!sg) continue;
    const stepPi = Math.min(...bonds.filter((b) => b.type === "pi" && ((b.a[0] === idA && b.b[0] === idB) || (b.a[0] === idB && b.b[0] === idA))).map((b) => bondStep(b.id)));
    if (!(bondStep(sg.id) < stepPi) || piStage[idA] || piStage[idB]) continue;
    const A = atoms[idA]; const B = atoms[idB]; const dFinal = len(sub(B.pos, A.pos)); const u = normalize(sub(B.pos, A.pos));
    const pA = { cls: "p", n: A.orbitals[0].n, reach: reachOf("p", A.orbitals[0].n) }; const touch = P_LATERAL * (pA.reach + reachOf("p", B.orbitals[0].n));
    const dStage = Math.max(dFinal + 0.2, Math.min(touch + 0.28, dFinal + 0.5)); const delta = dStage - dFinal;
    const wA = sigmaCount(idA, stepPi - 1) > 1 ? 0 : 1; const wB = sigmaCount(idB, stepPi - 1) > 1 ? 0 : 1; const w = wA + wB; if (!w) continue;
    if (wA) piStage[idA] = { step: stepPi, off: scale(u, -delta * (wA / w)) };
    if (wB) piStage[idB] = { step: stepPi, off: scale(u, delta * (wB / w)) };
  }
  const last = steps[steps.length - 1];
  if (last.sigma !== spec.expected.sigma || last.pi !== spec.expected.pi) problems.push(`last step counts ${last.sigma}σ+${last.pi}π, expected ${spec.expected.sigma}σ+${spec.expected.pi}π`);
  if (last.visible.length !== atomList.length) problems.push("not every atom is visible at the last step");
  if (last.formed.length !== bonds.length) problems.push("not every bond is formed by the last step");
  const sigmaBondAtoms = new Set(bonds.flatMap((b) => [b.a[0], b.b[0]]));
  for (const id of Object.keys(atoms)) if (!sigmaBondAtoms.has(id)) problems.push(`atom ${id} has no bond`);
  // for display: atoms not yet anchored sit at (final + offset); if an atom never approaches it simply stays at its final position
  for (const id of Object.keys(atoms)) if (!(id in anchorStep)) { anchorStep[id] = -1; offsets[id] = [0, 0, 0]; }

  const pts = atomList.map((a) => a.pos); const c = scale(pts.reduce((s, p) => add(s, p), [0, 0, 0]), 1 / pts.length);
  const radius = Math.max(1, ...pts.map((p) => len(sub(p, c)))) + 0.8;
  return { id: spec.id, spec, atoms, atomList, bonds, bondsById, analysis, steps, offsets, anchorStep, piStage, center: c, radius, problems, expected: spec.expected, delocalised: spec.ring ? { ring: spec.ring, orbital: "2pz" } : null };
}
