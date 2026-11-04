#!/usr/bin/env node
// Pure-model tests for the Intermolecular Forces Visualiser:  node scripts/test-imf-model.mjs
// Covers (no DOM, no three, no WebGL): molecule data (geometry, charges, dipoles, polarizability, donors/acceptors), the qualitative IMF
// models (induced dipole direction, London correlated sign, dipole-dipole indicator, hydrogen-bond detection and strength), pair
// applicability messages, the heat / phase-change energy model, the particle system (rigid bodies, bonds intact in every phase),
// the Learn lessons, and the cached electron-cloud geometry (nothing is built while a lesson plays).
import assert from "node:assert/strict";
import { MOLECULES as M, TRAY_NONPOLAR, TRAY_POLAR, bondAngleDeg, bondLength, totalCharge, DEBYE_IN_E_ANGSTROM } from "../src/engines/intermolecular-forces-visualiser/model/molecules.js";
import * as I from "../src/engines/intermolecular-forces-visualiser/model/imf.js";
import { QID, qFromAxisAngle, qMul, qFromTo, norm, sub, dot, len, add, scale, angleDeg } from "../src/engines/intermolecular-forces-visualiser/model/vec.js";
import { SUBSTANCES as S, MOLECULAR_SUBSTANCES, curveSegments, stateAtEnergy, advanceEnergy, totalEnergy, curvePoints, energyRate, startTemperature } from "../src/engines/intermolecular-forces-visualiser/model/phase.js";
import { createSystem, stepSystem, bondLengths, metrics, assignIceProtons, poseOf, N_PARTICLES } from "../src/engines/intermolecular-forces-visualiser/model/particles.js";
import { LESSONS, lessonFrame, lessonDuration } from "../src/engines/intermolecular-forces-visualiser/model/lessons.js";
import { getCloud, stats as cloudStats, applyShift, applyEspColors, hasCloud } from "../src/engines/intermolecular-forces-visualiser/scene/cloudGeometry.js";

let passed = 0; let failed = 0;
function test(name, fn) { try { fn(); console.log(`  ok   ${name}`); passed += 1; } catch (e) { console.log(`  FAIL ${name}\n       ${(e.stack || e.message).split("\n").slice(0, 5).join("\n       ")}`); failed += 1; } }
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} expected ${b} +-${tol}, got ${a}`);
const P = (pos, quat = QID) => ({ pos, quat });
const E = (mol, pose) => ({ mol, pose });
const RZ180 = qFromAxisAngle([0, 0, 1], Math.PI);

console.log("Molecule data");
test("tray lists match the spec (8 nonpolar, 6 polar) and every id exists", () => {
  assert.deepEqual(TRAY_NONPOLAR, ["H2", "N2", "O2", "Cl2", "CH4", "CO2", "Ar", "I2"]); assert.deepEqual(TRAY_POLAR, ["HCl", "HBr", "SO2", "H2O", "NH3", "HF"]);
  for (const id of [...TRAY_NONPOLAR, ...TRAY_POLAR, "Ne", "F2"]) assert.ok(M[id], id);
});
test("atom counts", () => { const want = { H2: 2, N2: 2, O2: 2, Cl2: 2, CH4: 5, CO2: 3, Ar: 1, I2: 2, HCl: 2, HBr: 2, SO2: 3, H2O: 3, NH3: 4, HF: 2, Ne: 1, F2: 2 }; for (const [k, n] of Object.entries(want)) assert.equal(M[k].atoms.length, n, k); });
test("bond lengths match experimental values", () => {
  const want = [["H2", 0, 1, 0.741], ["N2", 0, 1, 1.098], ["O2", 0, 1, 1.208], ["Cl2", 0, 1, 1.988], ["I2", 0, 1, 2.666], ["HCl", 0, 1, 1.275], ["HBr", 0, 1, 1.414], ["HF", 0, 1, 0.917], ["H2O", 0, 1, 0.9572], ["H2O", 0, 2, 0.9572], ["NH3", 0, 1, 1.012], ["CH4", 0, 2, 1.087], ["CO2", 0, 1, 1.16], ["SO2", 0, 1, 1.431]];
  for (const [id, a, b, d] of want) near(bondLength(M[id], a, b), d, 1e-3, `${id} ${a}-${b}`);
});
test("bond angles: H2O 104.5, NH3 106.7 (~107), SO2 119.5, CO2 180, CH4 109.47", () => {
  near(bondAngleDeg(M.H2O, 1, 0, 2), 104.52, 0.05); near(bondAngleDeg(M.NH3, 1, 0, 2), 106.7, 0.05); near(bondAngleDeg(M.SO2, 1, 0, 2), 119.5, 0.05); near(bondAngleDeg(M.CO2, 1, 0, 2), 180, 1e-6);
  for (let i = 1; i <= 4; i += 1) for (let j = i + 1; j <= 4; j += 1) near(bondAngleDeg(M.CH4, i, 0, j), 109.47, 0.05);
  near(bondAngleDeg(M.NH3, 1, 0, 3), 106.7, 0.05);
});
test("total charge is zero for every molecule", () => { for (const m of Object.values(M)) near(totalCharge(m), 0, 1e-9, m.id); });
test("molecules are centred on their centre of mass", () => {
  for (const m of Object.values(M)) { let c = [0, 0, 0]; let tot = 0; for (const a of m.atoms) { const w = { H: 1.008, C: 12.011, N: 14.007, O: 15.999, F: 18.998, S: 32.06, Cl: 35.45, Br: 79.904, I: 126.904, Ar: 39.948, Ne: 20.18 }[a.el]; c = add(c, scale(a.p, w)); tot += w; } assert.ok(len(scale(c, 1 / tot)) < 1e-9, m.id); }
});
test("dipole is exactly zero for H2, N2, O2, Cl2, I2, F2, Ar, Ne, CH4 and CO2 (symmetry)", () => { for (const id of ["H2", "N2", "O2", "Cl2", "I2", "F2", "Ar", "Ne", "CH4", "CO2"]) { assert.ok(len(M[id].dipole) < 1e-9, `${id} ${len(M[id].dipole)}`); assert.equal(M[id].polar, false); } });
test("CO2 has polar bonds (non-zero partial charges) but no net dipole", () => { assert.ok(M.CO2.atoms[0].q > 0.5 && M.CO2.atoms[1].q < -0.2); assert.ok(len(M.CO2.dipole) < 1e-9); });
test("polar molecules reproduce the experimental dipole moment (+-1 %)", () => { for (const [id, mu] of [["HCl", 1.09], ["HBr", 0.82], ["HF", 1.826], ["H2O", 1.855], ["NH3", 1.47], ["SO2", 1.63]]) { near(M[id].mu, mu, mu * 0.01, id); assert.ok(M[id].polar); } });
test("partial-charge signs: H is delta-plus in HCl/HBr/HF/H2O/NH3; the heavy atom is delta-minus; S is delta-plus in SO2", () => {
  for (const id of ["HCl", "HBr", "HF"]) { const m = M[id]; assert.ok(m.atoms[0].q > 0 && m.atoms[1].q < 0, id); }
  assert.ok(M.H2O.atoms[0].q < 0 && M.H2O.atoms[1].q > 0 && M.H2O.atoms[2].q > 0); assert.ok(M.NH3.atoms[0].q < 0 && M.NH3.atoms.slice(1).every((a) => a.q > 0));
  assert.ok(M.SO2.atoms[0].q > 0 && M.SO2.atoms[1].q < 0);
});
test("dipole vector points from the negative towards the positive end (physics convention) -- correct direction per molecule", () => {
  for (const id of ["HCl", "HBr", "HF"]) { const m = M[id]; assert.ok(dot(m.dipole, sub(m.atoms[0].p, m.atoms[1].p)) > 0, `${id}: towards H`); }
  const w = M.H2O; assert.ok(dot(w.dipole, sub(w.atoms[1].p, w.atoms[0].p)) > 0); assert.ok(angleDeg(w.dipole, add(sub(w.atoms[1].p, w.atoms[0].p), sub(w.atoms[2].p, w.atoms[0].p))) < 1e-6, "H2O dipole along the H-O-H bisector");
  const n = M.NH3; const hc = scale(add(add(n.atoms[1].p, n.atoms[2].p), n.atoms[3].p), 1 / 3); assert.ok(angleDeg(n.dipole, sub(hc, n.atoms[0].p)) < 1e-6, "NH3 dipole along the C3 axis towards the H atoms");
  const s = M.SO2; const mid = scale(add(s.atoms[1].p, s.atoms[2].p), 0.5); assert.ok(angleDeg(s.dipole, sub(s.atoms[0].p, mid)) < 1e-6, "SO2 dipole from the O atoms towards S");
});
test("polarizability values: literature ordering Ne < Ar, F2 < Cl2 < I2, H2 < N2", () => { assert.ok(M.Ne.alpha < M.Ar.alpha); assert.ok(M.F2.alpha < M.Cl2.alpha && M.Cl2.alpha < M.I2.alpha); assert.ok(M.H2.alpha < M.N2.alpha); for (const m of Object.values(M)) assert.ok(m.alpha > 0, m.id); });
test("hydrogen-bond donors/acceptors: only H on N/O/F donates; only H2O, NH3, HF accept", () => {
  assert.equal(M.H2O.donors.length, 2); assert.equal(M.NH3.donors.length, 3); assert.equal(M.HF.donors.length, 1);
  for (const id of ["HCl", "HBr", "CH4", "H2", "SO2", "CO2"]) assert.equal(M[id].donors.length, 0, id);
  assert.deepEqual(Object.values(M).filter((m) => m.acceptors.length).map((m) => m.id).sort(), ["H2O", "HF", "NH3"]);
  assert.equal(M.H2O.acceptors[0].lps.length, 2); assert.equal(M.NH3.acceptors[0].lps.length, 1); assert.equal(M.HF.acceptors[0].lps.length, 3);
});
test("lone-pair directions are unit vectors pointing away from the bonded atoms", () => {
  for (const id of ["H2O", "NH3", "HF"]) { const m = M[id]; const a = m.acceptors[0]; const nb = m.bonds.map((b) => (b[0] === a.atom ? b[1] : b[1] === a.atom ? b[0] : -1)).filter((x) => x >= 0); for (const lp of a.lps) { near(len(lp), 1, 1e-9); for (const j of nb) assert.ok(dot(lp, norm(sub(m.atoms[j].p, m.atoms[a.atom].p))) < 0.1, `${id} lp towards a bond`); } }
});

console.log("Induced dipoles (dipole-induced dipole)");
const hclAt = (q) => E(M.HCl, P([0, 0, 0], q));
test("delta-plus end of HCl facing Ar: induced dipole points away from HCl, near side delta-minus, cloud shifts TOWARD HCl", () => {
  // HCl local: H at -x, so the H end faces an acceptor at -x
  const r = I.computeInteractions([hclAt(QID), E(M.Ar, P([-4, 0, 0]))], { force: "dip-ind" });
  const p = r.mols[1].induced; assert.ok(p[0] < 0, "p points away from HCl (-x)"); assert.equal(I.nearSideSign(p, [1, 0, 0]), -1, "near side (towards HCl) is delta-minus");
  assert.ok(r.mols[1].shift[0] > 0, "electron cloud shifts toward the delta-plus H");
});
test("reversing HCl reverses the induced dipole and the near-side sign", () => {
  const a = I.computeInteractions([hclAt(QID), E(M.Ar, P([-4, 0, 0]))], { force: "dip-ind" }); const b = I.computeInteractions([hclAt(RZ180), E(M.Ar, P([-4, 0, 0]))], { force: "dip-ind" });
  assert.ok(a.mols[1].induced[0] * b.mols[1].induced[0] < 0, "opposite sign"); assert.equal(I.nearSideSign(b.mols[1].induced, [1, 0, 0]), 1, "Cl end facing: near side delta-plus");
  assert.ok(a.mols[1].shift[0] * b.mols[1].shift[0] < 0);
});
test("same for H2 as the polarised particle", () => {
  const a = I.computeInteractions([hclAt(QID), E(M.H2, P([-4.2, 0, 0]))], { force: "dip-ind" }); assert.equal(I.nearSideSign(a.mols[1].induced, [1, 0, 0]), -1);
  const b = I.computeInteractions([hclAt(RZ180), E(M.H2, P([-4.2, 0, 0]))], { force: "dip-ind" }); assert.equal(I.nearSideSign(b.mols[1].induced, [1, 0, 0]), 1);
});
test("induced dipole is always along the local field and vanishes when the source is far away (not permanent)", () => {
  const near1 = I.computeInteractions([hclAt(QID), E(M.Ar, P([-4, 0, 0]))], { force: "dip-ind" }); const far = I.computeInteractions([hclAt(QID), E(M.Ar, P([-40, 0, 0]))], { force: "dip-ind" });
  assert.ok(len(far.mols[1].induced) < len(near1.mols[1].induced) / 50); assert.ok(angleDeg(near1.mols[1].induced, near1.mols[1].field) < 1e-9);
});
test("induced dipole decreases monotonically with distance", () => { let last = Infinity; for (let d = 3; d <= 9; d += 0.5) { const m = len(I.computeInteractions([hclAt(QID), E(M.Ar, P([-d, 0, 0]))], { force: "dip-ind" }).mols[1].induced); assert.ok(m < last); last = m; } });
test("larger polarizability gives a larger induced dipole in the same field (Ne < Ar, F2 < Cl2 < I2)", () => {
  const ind = (id) => len(I.computeInteractions([hclAt(QID), E(M[id], P([-4, 0, 0]))], { force: "dip-ind" }).mols[1].induced);
  assert.ok(ind("Ne") < ind("Ar")); assert.ok(ind("F2") < ind("Cl2") && ind("Cl2") < ind("I2"));
});
test("cloud shift scales with polarizability (visual)", () => { const sh = (id) => len(I.computeInteractions([hclAt(QID), E(M[id], P([-4.5, 0, 0]))], { force: "dip-ind" }).mols[1].shift); assert.ok(sh("Ne") < sh("Ar")); });
test("exaggeration scales the cloud shift", () => { const a = I.computeInteractions([hclAt(QID), E(M.Ar, P([-4, 0, 0]))], { force: "dip-ind", exaggeration: 1 }); const b = I.computeInteractions([hclAt(QID), E(M.Ar, P([-4, 0, 0]))], { force: "dip-ind", exaggeration: 2 }); near(len(b.mols[1].shift) / len(a.mols[1].shift), 2, 1e-9); });

console.log("London dispersion (correlated instantaneous / induced dipoles)");
test("for any direction of A's instantaneous dipole the induced dipole in B makes the adjacent charges opposite", () => {
  for (let k = 0; k < 400; k += 1) {
    const t = k * 0.173; const axis = [1, 0, 0]; const dir = I.fluctuationDirection(t, axis, k * 0.31); if (Math.abs(dir[0]) < 0.15) continue;
    const pA = scale(dir, 0.04); const eB = I.fieldOfPointDipole(pA, [0, 0, 0], [4, 0, 0]); const pB = I.inducedDipole(M.H2, eB);
    assert.equal(I.nearSideSign(pA, [1, 0, 0]), -I.nearSideSign(pB, [-1, 0, 0]), `t=${t}`);
  }
});
test("axial case: A's delta-plus end towards B -> B's near end delta-minus; and the reverse", () => {
  const eB = I.fieldOfPointDipole([0.04, 0, 0], [0, 0, 0], [4, 0, 0]); const pB = I.inducedDipole(M.H2, eB); assert.ok(pB[0] > 0); assert.equal(I.nearSideSign([0.04, 0, 0], [1, 0, 0]), 1); assert.equal(I.nearSideSign(pB, [-1, 0, 0]), -1);
  const eB2 = I.fieldOfPointDipole([-0.04, 0, 0], [0, 0, 0], [4, 0, 0]); const pB2 = I.inducedDipole(M.H2, eB2); assert.ok(pB2[0] < 0);
});
test("side-by-side case: induced dipole is antiparallel (adjacent charges opposite) and the induced energy -1/2 alpha E^2 is attractive", () => {
  const pA = [0, 0.04, 0]; const eB = I.fieldOfPointDipole(pA, [0, 0, 0], [4, 0, 0]); const pB = I.inducedDipole(M.H2, eB); assert.ok(pB[1] < 0, "antiparallel");
  assert.ok(-0.5 * M.H2.alpha * dot(eB, eB) < 0);
});
test("computeInteractions: the lower-index molecule of a nonpolar pair fluctuates, the other is induced with correlated sign", () => {
  const r = I.computeInteractions([E(M.H2, P([-2, 0, 0])), E(M.H2, P([2, 0, 0]))], { force: "ldf", t: 1.3, fluct: { gain: 1, fixedDir: [1, 0, 0] } });
  assert.ok(r.mols[0].source && !r.mols[1].source); assert.ok(r.mols[0].instant[0] > 0 && r.mols[1].induced[0] > 0);
  assert.equal(I.nearSideSign(r.mols[0].instant, [1, 0, 0]), -I.nearSideSign(r.mols[1].induced, [-1, 0, 0]));
});
test("freezing the fluctuation (same t) gives an identical state; different t differs", () => {
  const e = [E(M.H2, P([-2, 0, 0])), E(M.H2, P([2, 0, 0]))]; const a = I.computeInteractions(e, { force: "ldf", t: 2 }); const b = I.computeInteractions(e, { force: "ldf", t: 2 }); const c = I.computeInteractions(e, { force: "ldf", t: 2.7 });
  assert.deepEqual(a.mols[0].instant, b.mols[0].instant); assert.notDeepEqual(a.mols[0].instant, c.mols[0].instant);
});
test("London strength rises with polarizability: Ne-Ne < Ar-Ar, F2 < Cl2 < I2 at equal separation (ionisation energy included, not size alone)", () => {
  const u = (id, r) => -I.londonEnergyEv(M[id], M[id], r);
  assert.ok(u("Ne", 4.6) < u("Ar", 4.6)); assert.ok(u("F2", 4.6) < u("Cl2", 4.6) && u("Cl2", 4.6) < u("I2", 4.6)); assert.ok(u("Ar", 3.76) > 0.009 && u("Ar", 3.76) < 0.015, "Ar2 well depth ~ 12 meV"); assert.ok(u("Ar", 4) > u("Ar", 5));
});
test("pair strength indicator is always attractive and increases as the molecules approach", () => {
  let last = -1; for (let d = 8; d >= 3; d -= 0.5) { const p = I.computeInteractions([E(M.Ar, P([0, 0, 0])), E(M.Ar, P([d, 0, 0]))], { force: "ldf" }).pairs[0]; assert.equal(p.kind, "attract"); assert.ok(p.strength > last); last = p.strength; }
});

console.log("Dipole-dipole");
const headToTail = I.computeInteractions([E(M.HCl, P([0, 0, 0])), E(M.HCl, P([4.18, 0, 0]))], { force: "dip-dip" }).pairs[0];
test("head-to-tail HCl (delta+ H facing delta- Cl) is favourable", () => { assert.equal(headToTail.kind, "attract"); assert.ok(headToTail.energyEv < 0 && headToTail.strength > 0.3); });
test("like ends facing (Cl...Cl, and H...H) is unfavourable", () => {
  const clcl = I.computeInteractions([E(M.HCl, P([0, 0, 0])), E(M.HCl, P([4.4, 0, 0], RZ180))], { force: "dip-dip" }).pairs[0]; assert.equal(clcl.kind, "repel"); assert.ok(clcl.energyEv > 0);
  const hh = I.computeInteractions([E(M.HCl, P([0, 0, 0], RZ180)), E(M.HCl, P([4.0, 0, 0]))], { force: "dip-dip" }).pairs[0]; assert.equal(hh.kind, "repel");
});
test("antiparallel side-by-side is favourable, parallel side-by-side unfavourable", () => {
  const anti = I.computeInteractions([E(M.HCl, P([0, 0, 0])), E(M.HCl, P([0, 3.8, 0], RZ180))], { force: "dip-dip" }).pairs[0]; const par = I.computeInteractions([E(M.HCl, P([0, 0, 0])), E(M.HCl, P([0, 3.8, 0]))], { force: "dip-dip" }).pairs[0];
  assert.equal(anti.kind, "attract"); assert.equal(par.kind, "repel");
});
test("attraction depends on distance (decays) and on rotation (flips sign during a full turn)", () => {
  let last = Infinity; for (let d = 4; d <= 10; d += 1) { const p = I.computeInteractions([E(M.HCl, P([0, 0, 0])), E(M.HCl, P([d, 0, 0]))], { force: "dip-dip" }).pairs[0]; assert.ok(Math.abs(p.energyEv) < last); last = Math.abs(p.energyEv); }
  const signs = new Set(); for (let a = 0; a < 360; a += 20) signs.add(I.computeInteractions([E(M.HCl, P([0, 0, 0])), E(M.HCl, P([4.2, 0, 0], qFromAxisAngle([0, 0, 1], (a * Math.PI) / 180)))], { force: "dip-dip" }).pairs[0].kind); assert.ok(signs.has("attract") && signs.has("repel"));
});
test("HBr and SO2 pairs give an indicator; Ar+Ar and CO2+CO2 report that dipole-dipole is not applicable", () => {
  assert.equal(I.computeInteractions([E(M.HBr, P([0, 0, 0])), E(M.HBr, P([4.4, 0, 0]))], { force: "dip-dip" }).pairs[0].applicable, true);
  assert.equal(I.computeInteractions([E(M.SO2, P([0, 0, 0])), E(M.SO2, P([0, 4.4, 0], RZ180))], { force: "dip-dip" }).pairs[0].applicable, true);
  for (const id of ["Ar", "CO2", "CH4", "H2"]) { const p = I.computeInteractions([E(M[id], P([0, 0, 0])), E(M[id], P([5, 0, 0]))], { force: "dip-dip" }).pairs[0]; assert.equal(p.applicable, false, id); assert.equal(p.kind, "none"); assert.match(p.text, /permanent dipole|TWO permanent|none/i); }
  assert.match(I.pairApplicability("dip-dip", M.CO2, M.CO2).text, /cancel/);
});

console.log("Hydrogen bonding");
const OH = norm(sub(M.H2O.atoms[1].p, M.H2O.atoms[0].p)); const donorPose = P([0, 0, 0], qFromTo(OH, [1, 0, 0]));
const dimer = (d, twist = 0) => ({ D: donorPose, A: I.acceptorPoseForHBond(M.H2O, donorPose, 0, 1, M.H2O, 0, d, twist) });
const best = (ma, pa, mb, pb) => Math.max(0, ...I.hydrogenBonds(ma, pa, mb, pb).map((h) => h.strength));
test("good water dimer (O-H...O 180 deg, H...O 1.95 A, H on a lone pair) is detected with full strength", () => {
  const { D, A } = dimer(1.95); const hb = I.hydrogenBonds(M.H2O, D, M.H2O, A).sort((a, b) => b.strength - a.strength)[0];
  near(hb.angle, 180, 0.01); near(hb.dHA, 1.95, 1e-6); assert.ok(hb.lpAngle < 1, "H on the lone-pair axis"); near(hb.strength, 1, 1e-9);
  const r = I.computeInteractions([E(M.H2O, D), E(M.H2O, A)], { force: "hbond" }).pairs[0]; assert.equal(r.kind, "hbond"); assert.equal(r.hbonds.length, 1); near(len(sub(r.hbonds[0].H, r.hbonds[0].A)), 1.95, 1e-6);
});
test("the hydrogen bond is between the donor H and the OTHER molecule's O -- never the covalent O-H of the same molecule", () => {
  const { D, A } = dimer(1.95); const hbs = I.hydrogenBonds(M.H2O, D, M.H2O, A); assert.ok(hbs.length >= 2); assert.ok(hbs.every((h) => h.dHA > 1.4), "H...A is an intermolecular distance, never the 0.96 A covalent O-H");
  const strong = hbs.filter((h) => h.strength > 0.5); assert.equal(strong.length, 1); assert.ok(strong[0].donorIsA); assert.ok(Math.abs(strong[0].dHA - 1.95) < 1e-6);
});
test("false for a wrong donor angle (X-H...A bent to 110 deg), for a large distance, and when the H misses the lone pair", () => {
  const { D, A } = dimer(1.95); const bent = { pos: A.pos, quat: A.quat }; // rotate the DONOR about its O so the O-H points ~70 deg away from the acceptor
  const D2 = P([0, 0, 0], qMul(qFromAxisAngle([0, 0, 1], (70 * Math.PI) / 180), donorPose.quat)); assert.ok(best(M.H2O, D2, M.H2O, bent) < 0.05, "bent");
  assert.ok(best(M.H2O, D, M.H2O, dimer(3.4).A) < 0.01, "too far"); assert.ok(best(M.H2O, D, M.H2O, dimer(1.0).A) < 0.05, "overlap / too close");
  assert.ok(best(M.H2O, D, M.H2O, P(A.pos, qMul(qFromAxisAngle([0, 1, 0], Math.PI), A.quat))) < 0.05, "lone pair turned away");
});
test("HCl, HBr, CH4, H2, SO2 and CO2 are not hydrogen-bond donors; Ar, CH4, HCl, SO2 and CO2 are not acceptors", () => {
  for (const id of ["HCl", "HBr", "CH4", "H2", "SO2", "CO2"]) assert.equal(I.hydrogenBonds(M[id], P([0, 0, 0]), M.H2O, P([2.2, 0, 0])).filter((h) => h.donorIsA).length, 0, id);
  for (const id of ["Ar", "CH4", "HCl", "SO2", "CO2", "N2"]) assert.equal(I.hydrogenBonds(M.H2O, donorPose, M[id], P([2.9, 0, 0])).filter((h) => h.donorIsA).length, 0, id);
  const hclHcl = I.computeInteractions([E(M.HCl, P([0, 0, 0])), E(M.HCl, P([3.0, 0, 0]))], { force: "hbond" }).pairs[0]; assert.equal(hclHcl.applicable, false); assert.match(hclHcl.text, /not N, O or F/); assert.equal(hclHcl.kind, "none");
});
test("HF + HF and NH3 + NH3 and H2O + NH3 can hydrogen-bond when aligned", () => {
  const hfD = P([0, 0, 0], qFromTo(norm(sub(M.HF.atoms[0].p, M.HF.atoms[1].p)), [1, 0, 0])); const hfA = I.acceptorPoseForHBond(M.HF, hfD, 1, 0, M.HF, 0, 1.75); assert.ok(best(M.HF, hfD, M.HF, hfA) > 0.9);
  const nD = P([0, 0, 0], qFromTo(norm(sub(M.NH3.atoms[1].p, M.NH3.atoms[0].p)), [1, 0, 0])); const nA = I.acceptorPoseForHBond(M.NH3, nD, 0, 1, M.NH3, 0, 2.0); assert.ok(best(M.NH3, nD, M.NH3, nA) > 0.9);
  const wnA = I.acceptorPoseForHBond(M.H2O, donorPose, 0, 1, M.NH3, 0, 1.95); assert.ok(best(M.H2O, donorPose, M.NH3, wnA) > 0.9);
});
test("strength is monotone: non-increasing for H...A beyond 2.1 A, and non-increasing as the X-H...A angle drops below 150 deg", () => {
  let last = 2; for (let d = 2.1; d <= 3.0; d += 0.05) { const s = best(M.H2O, donorPose, M.H2O, dimer(d).A); assert.ok(s <= last + 1e-12); last = s; } assert.ok(last < 0.01);
  last = 2; for (let a = 0; a <= 70; a += 5) { const D2 = P([0, 0, 0], qMul(qFromAxisAngle([0, 0, 1], (a * Math.PI) / 180), donorPose.quat)); const s = best(M.H2O, D2, M.H2O, dimer(1.95).A); assert.ok(s <= last + 1e-12, `angle ${a}`); last = s; }
});
test("strength drops smoothly (continuous, no step) when the acceptor lone pair is rotated away", () => {
  const A = dimer(1.95).A; let prev = 1; let maxJump = 0; for (let a = 0; a <= 100; a += 2) { const q = qMul(qFromAxisAngle([0, 1, 0], (a * Math.PI) / 180), A.quat); const s = best(M.H2O, donorPose, M.H2O, P(A.pos, q)); maxJump = Math.max(maxJump, Math.abs(s - prev)); prev = s; } assert.ok(maxJump < 0.2, `jump ${maxJump}`);
});
test("pair applicability messages explain unsupported combinations", () => {
  assert.equal(I.pairApplicability("dip-ind", M.H2, M.N2).applicable, false); assert.match(I.pairApplicability("dip-ind", M.H2, M.N2).text, /HCl/);
  assert.equal(I.pairApplicability("dip-ind", M.HCl, M.Ar).applicable, true); assert.equal(I.pairApplicability("hbond", M.H2O, M.H2O).applicable, true); assert.equal(I.pairApplicability("hbond", M.H2O, M.NH3).applicable, true);
  assert.equal(I.pairApplicability("hbond", M.CH4, M.CH4).applicable, false); assert.equal(I.pairApplicability("hbond", M.SO2, M.SO2).applicable, false);
  assert.equal(I.pairApplicability("hbond", M.H2O, M.Ar).applicable, false); assert.match(I.pairApplicability("ldf", M.HCl, M.HCl).text, /ALL/);
  for (const f of I.FORCES) for (const a of ["Ar", "HCl", "H2O"]) for (const b of ["H2", "NH3", "CO2"]) assert.ok(I.pairApplicability(f, M[a], M[b]).text.length > 20);
});

console.log("Heat & Phase Change energy model");
for (const id of [...MOLECULAR_SUBSTANCES, "NaCl"]) {
  test(`${id}: temperature rises monotonically with energy, plateaus exactly at Tm and Tb, phases in order`, () => {
    const s = S[id]; const tot = totalEnergy(s); let last = -1; let lastT = -Infinity; const order = []; const seenMelt = []; const seenBoil = [];
    for (let k = 0; k <= 4000; k += 1) { const st = stateAtEnergy(s, (k / 4000) * tot); assert.ok(st.T >= lastT - 1e-9, "T monotone"); lastT = st.T; if (order[order.length - 1] !== st.phase) order.push(st.phase); if (st.phase === "melting") seenMelt.push(st.T); if (st.phase === "boiling") seenBoil.push(st.T); last = st.E; }
    assert.deepEqual(order, ["solid", "melting", "liquid", "boiling", "gas"]); assert.ok(seenMelt.length > 10 && seenMelt.every((t) => t === s.Tm)); assert.ok(seenBoil.length > 10 && seenBoil.every((t) => t === s.Tb)); assert.ok(last > 0);
    const segs = curveSegments(s); near(segs[1].E1 - segs[1].E0, s.dHfus, 1e-9); near(segs[3].E1 - segs[3].E0, s.dHvap, 1e-9); assert.equal(stateAtEnergy(s, 0).T, startTemperature(s)); assert.ok(startTemperature(s) < s.Tm); near(stateAtEnergy(s, tot).T, 1.12 * s.Tb, 0.06);
    assert.ok(stateAtEnergy(s, (segs[0].E1 + segs[1].E1) / 2).melt > 0.4 && stateAtEnergy(s, (segs[0].E1 + segs[1].E1) / 2).melt < 0.6);
    assert.equal(stateAtEnergy(s, segs[0].E1 - 1e-6).phase, "solid"); assert.equal(stateAtEnergy(s, segs[2].E1 + 1e-6).phase, "boiling"); assert.equal(stateAtEnergy(s, segs[4].E1).phase, "gas");
  });
}
test("documented melting / boiling points (1 atm) and CO2 is not offered", () => {
  const want = { H2O: [273.15, 373.15], NH3: [195.4, 239.8], HCl: [158.9, 188.1], CH4: [90.7, 111.7], I2: [386.9, 457.6], Ar: [83.8, 87.3], NaCl: [1074, 1686] }; for (const [k, [a, b]] of Object.entries(want)) { assert.equal(S[k].Tm, a, k); assert.equal(S[k].Tb, b, k); }
  assert.ok(!S.CO2 && !MOLECULAR_SUBSTANCES.includes("CO2"));
});
test("cooling retraces the same state map and reaches the start; energy added is distinct from temperature (latent heat takes energy at constant T)", () => {
  const s = S.H2O; let e = totalEnergy(s); for (let k = 0; k < 4000 && e > 0; k += 1) e = advanceEnergy(s, e, 1 / 60, -1, 1); assert.equal(e, 0); assert.equal(stateAtEnergy(s, e).phase, "solid");
  const segs = curveSegments(s); assert.ok(segs[3].E1 - segs[3].E0 > 4 * (segs[2].E1 - segs[2].E0), "water boiling needs far more energy than heating the liquid 100 K"); assert.ok(segs[3].E1 - segs[3].E0 > 6 * (segs[1].E1 - segs[1].E0));
});
test("advanceEnergy never skips a stage and energyRate is positive", () => { const s = S.Ar; let e = 0; const phases = []; for (let k = 0; k < 4000; k += 1) { e = advanceEnergy(s, e, 1 / 20, 1, 4); const p = stateAtEnergy(s, e).phase; if (phases[phases.length - 1] !== p) phases.push(p); } assert.deepEqual(phases, ["solid", "melting", "liquid", "boiling", "gas"]); assert.ok(energyRate(s, 0) > 0); assert.equal(curvePoints(s).length, 6); });

console.log("Particle system (rigid bodies)");
test("30-50 particles per substance; NaCl uses the Bonding Visualizer's rock-salt lattice (24 Na+, 24 Cl-, 6:6 coordination)", () => {
  for (const id of [...MOLECULAR_SUBSTANCES, "NaCl"]) { const sys = createSystem(id); assert.ok(sys.n >= 30 && sys.n <= 50 && sys.n === N_PARTICLES, id); }
  const ion = createSystem("NaCl"); let plus = 0; let minus = 0; for (const c of ion.charge) { if (c > 0) plus += 1; else minus += 1; } assert.equal(plus, 24); assert.equal(minus, 24);
  let inner = 0; for (let i = 0; i < ion.n; i += 1) { let nn = 0; for (let j = 0; j < ion.n; j += 1) if (i !== j && ion.charge[i] !== ion.charge[j] && Math.hypot(...[0, 1, 2].map((k) => ion.pos[3 * i + k] - ion.pos[3 * j + k])) < ion.nn * 1.01) nn += 1; if (nn === 6) inner += 1; } assert.ok(inner >= 4, `interior ions have 6 opposite neighbours (${inner})`);
});
test("every solid starts below its melting point as an ordered arrangement; water follows the ice rules", () => {
  const w = createSystem("H2O"); const ice = assignIceProtons(w.homePos, w.nn, 7); assert.ok(ice.solved); let nHB = 0;
  for (let i = 0; i < w.n; i += 1) for (let j = i + 1; j < w.n; j += 1) nHB += I.hydrogenBonds(M.H2O, poseOf(w, i), M.H2O, poseOf(w, j)).filter((h) => h.strength > 0.4).length;
  assert.ok(nHB >= 0.8 * w.n, `ice has a hydrogen-bond network (${nHB} bonds for ${w.n} molecules)`);
  const m = metrics(w); near(m.homeRms, 0, 1e-9); assert.ok(startTemperature(S.H2O) < S.H2O.Tm);
});
for (const id of MOLECULAR_SUBSTANCES) {
  test(`${id}: covalent bond lengths are identical in solid, liquid and gas (and while heating back down)`, () => {
    const s = S[id]; const sys = createSystem(id); const ref = bondLengths(sys); let e = 0; const seen = new Set(); const dir = [1, -1];
    for (const d of dir) for (let k = 0; k < 20 * 60 * 2.2 && (d > 0 ? e < totalEnergy(s) : e > 0); k += 1) { e = advanceEnergy(s, e, 1 / 60, d, 3); const st = stateAtEnergy(s, e); stepSystem(sys, 1 / 60, st); if (k % 40 === 0) { seen.add(st.phase); const bl = bondLengths(sys); for (let q = 0; q < bl.length; q += 1) assert.ok(Math.abs(bl[q] - ref[q]) < 1e-9, `${id} ${st.phase} bond ${q}`); } }
    for (const ph of ["solid", "melting", "liquid", "boiling", "gas"]) assert.ok(seen.has(ph), `${id} reached ${ph}`);
  });
}
test("particles never jump: per-step displacement stays below a small bound in every phase (no teleporting)", () => {
  const id = "H2O"; const s = S[id]; const sys = createSystem(id); let e = 0; let maxStep = 0; let prev = Float64Array.from(sys.pos);
  for (let k = 0; k < 70 * 60; k += 1) { e = advanceEnergy(s, e, 1 / 60, 1, 2); stepSystem(sys, 1 / 60, stateAtEnergy(s, e)); for (let i = 0; i < sys.n; i += 1) maxStep = Math.max(maxStep, Math.hypot(sys.pos[3 * i] - prev[3 * i], sys.pos[3 * i + 1] - prev[3 * i + 1], sys.pos[3 * i + 2] - prev[3 * i + 2])); prev = Float64Array.from(sys.pos); }
  assert.ok(maxStep < 0.65 * sys.nn, `max per-frame displacement ${maxStep.toFixed(2)} A`);
});
test("dynamics follow the energy state: vibration grows with T (solid), order is lost on melting, separation grows on boiling, cohesion persists in the liquid", () => {
  const id = "Ar"; const s = S[id]; const segs = curveSegments(s); const at = (E, secs = 6) => { const sys = createSystem(id); let e = 0; const target = E; for (let k = 0; k < 120 * 60 && e < target; k += 1) { e = advanceEnergy(s, e, 1 / 60, 1, 4); stepSystem(sys, 1 / 60, stateAtEnergy(s, e)); } for (let k = 0; k < secs * 60; k += 1) stepSystem(sys, 1 / 60, stateAtEnergy(s, target)); return { sys, m: metrics(sys), st: stateAtEnergy(s, target) }; };
  const cold = at(segs[0].E1 * 0.2); const hot = at(segs[0].E1 * 0.98); const liq = at((segs[2].E0 + segs[2].E1) / 2); const gas = at(segs[4].E1 * 0.97, 8);
  assert.ok(cold.m.homeRms < hot.m.homeRms, "vibration amplitude grows with temperature"); assert.ok(hot.m.homeRms < 0.35, "solid stays near its lattice sites"); assert.ok(liq.m.homeRms > 0.6, "liquid has lost the lattice order");
  assert.ok(liq.m.meanNN < 1.25 && liq.m.cohesion === 1, "liquid particles remain close together with intermolecular cohesion on"); assert.ok(gas.m.meanNN > 1.5 * liq.m.meanNN, `gas particles are far apart (${gas.m.meanNN.toFixed(2)} vs ${liq.m.meanNN.toFixed(2)})`); assert.equal(gas.m.cohesion, 0);
  assert.ok(gas.m.meanSpeed > 2 * hot.m.meanSpeed, "gas moves much faster than the vibrating solid"); assert.ok(liq.m.span < 4 && gas.m.span > liq.m.span * 1.5, "liquid pools at the bottom, gas fills the cube");
});
test("NaCl: the ordered ionic lattice melts to mobile ions that still attract (cohesion on, ions stay together), and the vapour is ion pairs", () => {
  const s = S.NaCl; const segs = curveSegments(s); const sys = createSystem("NaCl"); let e = 0; const stats = {};
  for (let k = 0; k < 140 * 60 && e < totalEnergy(s); k += 1) { e = advanceEnergy(s, e, 1 / 60, 1, 4); const st = stateAtEnergy(s, e); stepSystem(sys, 1 / 60, st); if (st.phase === "solid" && !stats.solid && st.frac > 0.9) stats.solid = metrics(sys); if (st.phase === "liquid" && st.frac > 0.5 && !stats.liq) stats.liq = metrics(sys); }
  assert.ok(stats.solid.homeRms < 0.3 && stats.liq.homeRms > 0.6 && stats.liq.cohesion === 1 && stats.liq.meanNN < 1.4, JSON.stringify(stats));
  const end = metrics(sys); assert.equal(end.cohesion, 0); let paired = 0; for (let i = 0; i < sys.n; i += 1) { const j = sys.partner[i]; const d = Math.hypot(...[0, 1, 2].map((k) => sys.pos[3 * i + k] - sys.pos[3 * j + k])); if (d < 1.5 * sys.nn) paired += 1; } assert.ok(paired >= 40, `ion pairs in the vapour (${paired}/48)`);
  assert.equal(S.NaCl.kind, "ionic"); assert.equal(S.NaCl.mol, null); assert.ok(segs[1].E1 > segs[1].E0);
});

console.log("Learn lessons");
test("four lessons with the required molecules, each a short list of one-sentence steps", () => {
  assert.deepEqual(LESSONS.map((l) => [l.id, ...l.pair]), [["ldf", "H2", "H2"], ["dip-ind", "HCl", "Ar"], ["dip-dip", "HCl", "HCl"], ["hbond", "H2O", "H2O"]]);
  for (const l of LESSONS) { assert.ok(l.steps.length >= 4 && l.steps.length <= 5, l.id); for (const st of l.steps) { assert.ok(st.text.length < 230 && st.text.length > 30); assert.ok((st.text.match(/[.!?](\s|$)/g) ?? []).length <= 1, `one sentence: ${st.text}`); assert.ok(st.dur > 2 && st.dur < 8); } assert.equal(l.force, l.id); }
});
test("lesson step end-poses show the intended physics (computed from the same models as Explore)", () => {
  const at = (l, k, extra = {}) => I.computeInteractions(l.pair.map((id, i) => E(M[id], l.steps[k].poses[i])), { force: l.force, ...extra });
  const [ldf, di, dd, hb] = LESSONS;
  const r = at(ldf, 2, { fluct: { gain: 1, fixedDir: [1, 0, 0] } }); assert.ok(r.mols[0].instant[0] > 0 && r.mols[1].induced[0] > 0); assert.equal(I.nearSideSign(r.mols[0].instant, [1, 0, 0]), -I.nearSideSign(r.mols[1].induced, [-1, 0, 0]));
  assert.equal(I.nearSideSign(at(di, 2).mols[1].induced, norm(sub(di.steps[2].poses[0].pos, di.steps[2].poses[1].pos))), -1, "step 3: near side delta-minus"); assert.equal(I.nearSideSign(at(di, 3).mols[1].induced, norm(sub(di.steps[3].poses[0].pos, di.steps[3].poses[1].pos))), 1, "step 4: reversed, near side delta-plus");
  assert.equal(at(dd, 1).pairs[0].kind, "repel"); assert.equal(at(dd, 2).pairs[0].kind, "attract"); assert.ok(at(dd, 2).pairs[0].strength > 0.4);
  assert.ok(at(hb, 1).pairs[0].hbStrength < 0.1, "misaligned: no H-bond"); assert.ok(at(hb, 2).pairs[0].hbStrength > 0.95, "aligned: H-bond"); assert.ok(at(hb, 0).pairs[0].hbStrength < 0.01);
});
test("lessonFrame is continuous (no jumps), reaches every step in order and the final poses at the end", () => {
  for (const l of LESSONS) { let prev = lessonFrame(l, 0); let lastStep = 0; let maxJump = 0; const total = lessonDuration(l); for (let t = 0.02; t <= total; t += 0.02) { const f = lessonFrame(l, t); assert.ok(f.step >= lastStep && f.step - lastStep <= 1); lastStep = f.step; for (let i = 0; i < 2; i += 1) maxJump = Math.max(maxJump, Math.hypot(...[0, 1, 2].map((k) => f.poses[i].pos[k] - prev.poses[i].pos[k]))); prev = f; } assert.equal(lastStep, l.steps.length - 1); assert.ok(maxJump < 0.35, `${l.id} jump ${maxJump}`); const end = lessonFrame(l, total + 5); assert.ok(end.done); for (let i = 0; i < 2; i += 1) assert.ok(len(sub(end.poses[i].pos, l.steps[l.steps.length - 1].poses[i].pos)) < 1e-6); }
});

console.log("Electron-cloud geometry and Play latency");
test("a cloud is built once per molecule and cached; each is a closed indexed mesh following the molecular shape", () => {
  const a = getCloud("H2O"); const n1 = cloudStats.built; const b = getCloud("H2O"); assert.equal(a, b); assert.equal(cloudStats.built, n1, "second request is served from the cache");
  assert.equal(a.count, 2562); assert.equal(a.index.length, 5120 * 3);
  const ext = (c, k) => { let lo = 1e9; let hi = -1e9; for (let i = 0; i < c.count; i += 1) { lo = Math.min(lo, c.positions[3 * i + k]); hi = Math.max(hi, c.positions[3 * i + k]); } return hi - lo; };
  const co2 = getCloud("CO2"); assert.ok(ext(co2, 0) > 1.2 * ext(co2, 1), "CO2 cloud is elongated along the molecular axis"); const ar = getCloud("Ar"); near(ext(ar, 0), ext(ar, 1), 0.05); near(ext(ar, 0), 2 * 1.88, 0.05, "Ar cloud ~ vdW sphere");
  const h2o = getCloud("H2O"); assert.ok(ext(h2o, 2) < ext(h2o, 0), "bent water cloud is flat in the molecular plane's normal direction"); assert.notEqual(getCloud("CH4").rMax, getCloud("HCl").rMax);
});
test("polar molecules have asymmetric electrostatic potential; nonpolar (H2, Ar, CH4) have none; CO2 has polar ends", () => {
  const spread = (id) => { const c = getCloud(id); let lo = 1e9; let hi = -1e9; for (let i = 0; i < c.count; i += 1) { lo = Math.min(lo, c.esp[i]); hi = Math.max(hi, c.esp[i]); } return [lo, hi]; };
  for (const id of ["H2", "Ar", "CH4", "I2"]) { const [lo, hi] = spread(id); assert.ok(Math.abs(lo) < 1e-9 && Math.abs(hi) < 1e-9, id); }
  for (const id of ["HCl", "H2O", "NH3", "HF", "SO2", "HBr", "CO2"]) { const [lo, hi] = spread(id); assert.ok(lo < -0.02 && hi > 0.02, id); }
  const c = getCloud("HCl"); let sumNearH = 0; let nH = 0; let sumNearCl = 0; let nCl = 0; for (let i = 0; i < c.count; i += 1) { if (c.dirs[3 * i] < -0.8) { sumNearH += c.esp[i]; nH += 1; } if (c.dirs[3 * i] > 0.8) { sumNearCl += c.esp[i]; nCl += 1; } } assert.ok(sumNearH / nH > 0 && sumNearCl / nCl < 0, "HCl: delta+ potential on the H side, delta- on the Cl side");
});
test("applyShift moves the cached vertices (no rebuild): the side towards the shift bulges, the far side recedes; zero shift reproduces the base mesh", () => {
  const c = getCloud("Ar"); const built = cloudStats.built; const out = new Float32Array(c.positions.length); applyShift(c, [0.4, 0, 0], out); assert.equal(cloudStats.built, built);
  let maxX = -1e9; let minX = 1e9; for (let i = 0; i < c.count; i += 1) { maxX = Math.max(maxX, out[3 * i]); minX = Math.min(minX, out[3 * i]); } assert.ok(maxX > 1.88 + 0.4, "leading side bulges beyond the shift"); assert.ok(minX > -1.88 + 0.2, "trailing side recedes"); applyShift(c, [0, 0, 0], out); assert.deepEqual(Array.from(out.slice(0, 30)), Array.from(c.positions.slice(0, 30)));
});
test("ESP colours: induced dipole p colours the p-end blue and the opposite end red on a nonpolar cloud", () => {
  const c = getCloud("Ar"); const col = new Float32Array(c.count * 3); applyEspColors(c, [0.03, 0, 0], col); let iPlus = 0; let iMinus = 0; for (let i = 0; i < c.count; i += 1) { if (c.dirs[3 * i] > c.dirs[3 * iPlus]) iPlus = i; if (c.dirs[3 * i] < c.dirs[3 * iMinus]) iMinus = i; }
  assert.ok(col[3 * iPlus + 2] > col[3 * iPlus], "+ end is blue"); assert.ok(col[3 * iMinus] > col[3 * iMinus + 2], "- end is red");
});
test("Play latency path builds no geometry: after warm-up the whole lesson loop (frames + interaction model + deformation) builds zero clouds", () => {
  for (const id of ["H2", "HCl", "Ar", "H2O"]) getCloud(id); const built = cloudStats.built; const tmp = new Float32Array(2562 * 3); const col = new Float32Array(2562 * 3); const t0 = process.hrtime.bigint(); let frames = 0;
  for (const l of LESSONS) for (let t = 0; t < lessonDuration(l); t += 1 / 30) { const f = lessonFrame(l, t); const r = I.computeInteractions(l.pair.map((id, i) => E(M[id], f.poses[i])), { force: l.force, t, fluct: { gain: f.fx.gain, fixedDir: f.fx.fixedDir } }); for (let i = 0; i < 2; i += 1) { applyShift(getCloud(l.pair[i]), r.mols[i].shift, tmp); applyEspColors(getCloud(l.pair[i]), r.mols[i].p, col); } frames += 1; }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / frames; assert.equal(cloudStats.built, built, "no cloud was built during playback"); assert.ok(ms < 8, `per-frame CPU cost ${ms.toFixed(2)} ms`); for (const id of ["H2", "HCl", "Ar", "H2O"]) assert.ok(hasCloud(id));
});
void DEBYE_IN_E_ANGSTROM; void TRAY_POLAR;
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
