#!/usr/bin/env node
// Model tests for the Polarity Playground and the shared electron-density system:  node scripts/test-polarity-model.mjs
// Pure (no DOM, no WebGL). Covers: the electronegativity data, the redistribution model (H2 symmetric, HCl asymmetric and continuous),
// the chemistry dipole-arrow convention, 3D bond-dipole vector sums for the ten molecules, the vector-addition timeline,
// the London-dispersion fluctuation signal, the Tug-of-War and Challenge models, and "no invented dipole moments".
import assert from "node:assert/strict";
import * as EN from "../src/engines/shared-3d/electronCloud/electronegativity.js";
import * as D from "../src/engines/shared-3d/electronCloud/densityModel.js";
import { fluctuationSignal, fluctuationMean } from "../src/engines/shared-3d/electronCloud/fluctuation.js";
import { chemistryArrow } from "../src/engines/shared-3d/electronCloud/dipoleArrow.js";
import ElectronCloud from "../src/engines/shared-3d/electronCloud/ElectronCloud.js";
import ChemDipoleArrow from "../src/engines/shared-3d/electronCloud/ChemDipoleArrow.js";
import { EN as IB_EN } from "../src/lib/lewis/data.js";
import * as Mol from "../src/engines/polarity-playground/model/molecules.js";
import * as VA from "../src/engines/polarity-playground/model/vectorAddition.js";
import * as Tug from "../src/engines/polarity-playground/model/tug.js";
import * as Ch from "../src/engines/polarity-playground/model/challenge.js";
import * as BP from "../src/engines/polarity-playground/model/bondPairs.js";

let passed = 0; let failed = 0;
function test(name, fn) { try { fn(); console.log(`  ok   ${name}`); passed += 1; } catch (e) { console.log(`  FAIL ${name}\n       ${(e.stack || e.message).split("\n").slice(0, 3).join("\n       ")}`); failed += 1; } }
const len = (v) => Math.hypot(...v); const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const pair = (a, b, d = D.displayBondLength(a, b)) => ({ atoms: [{ el: a, p: [0, 0, 0] }, { el: b, p: [d, 0, 0] }], bonds: [[0, 1, 1]] });
const lensT = (a, b, opts = {}) => { const spec = D.buildRegions(pair(a, b), { progress: 1, ...opts }); return { spec, lens: D.bondingLens(spec, 0, 1) }; };

console.log("Electronegativity data and bond rules");
test("Pauling values (2 d.p.) agree with the IB table in lib/lewis/data.js after rounding to 1 d.p.", () => {
  for (const [el, v] of Object.entries(EN.PAULING)) { if (IB_EN[el] === undefined) continue; assert.ok(Math.abs(Math.round(v * 10) / 10 - IB_EN[el]) < 1e-9, `${el}: ${v} vs IB ${IB_EN[el]}`); }
});
test("bond-type thresholds are the shared ones (non-polar / slightly polar / polar / very polar)", () => {
  assert.equal(EN.bondKind(0), "non-polar"); assert.equal(EN.bondKind(0.35), "slightly polar"); assert.equal(EN.bondKind(0.96), "polar"); assert.match(EN.bondKind(2.1), /very polar/);
  assert.equal(EN.elementBond("C", "H").polar, false, "C-H is treated as non-polar (IB)"); assert.equal(EN.elementBond("H", "Cl").polar, true);
});
test("equal electronegativity: no delta charges, no polarity, shift 0", () => {
  const t = EN.tugState(2.2, 2.2); assert.equal(t.equal, true); assert.equal(t.partialCharges, false); assert.equal(t.shift, 0); assert.equal(t.winner, null);
  const b = EN.elementBond("H", "H"); assert.equal(b.equal, true); assert.equal(b.more, null);
});
test("visual polarity is monotonic in delta-EN and bounded 0..1 (a qualitative dial)", () => {
  let prev = -1; for (let d = 0; d <= 3; d += 0.05) { const v = EN.visualPolarity(d); assert.ok(v >= prev - 1e-12 && v >= 0 && v <= 1); prev = v; }
});

console.log("Electron-density model (simplified, overlapping translucent regions)");
test("H2: two identical regions, mirror-symmetric about the bond midpoint; the lens is centred at the midpoint; no polarity", () => {
  const { spec, lens } = lensT("H", "H");
  assert.equal(spec.regions.length, 2); assert.equal(spec.regions[0].conc, spec.regions[1].conc); assert.equal(spec.regions[0].R, spec.regions[1].R);
  assert.ok(Math.abs(lens.t - 0.5) < 1e-9, `lens centred (${lens.t})`); assert.ok(lens.continuous);
  for (const d of [[1, 0, 0], [0.6, 0.8, 0], [0, 0, 1]]) { const m = [-d[0], d[1], d[2]]; assert.ok(Math.abs(D.regionRadiusAt(spec.regions[0], d) - D.regionRadiusAt(spec.regions[1], m)) < 1e-12, "mirror symmetric surfaces"); }
  const c = D.densityCentroid(spec); const mid = spec.regions[1].c[0] / 2; assert.ok(Math.abs(c[0] - mid) < 0.02, `density centroid at the midpoint (${c[0]} vs ${mid})`);
});
test("H2 regions overlap (a lens exists) and are not merged: the lens is narrower than either region", () => {
  const { spec, lens } = lensT("H", "H"); assert.ok(lens.halfLen > 0.05); assert.ok(lens.halfLen * 2 < spec.regions[0].R * 2);
});
test("HCl: the shared region moves towards Cl, stays continuous, Cl region is denser and H region thinner", () => {
  const h2 = lensT("H", "H"); const hcl = lensT("H", "Cl"); const hf = lensT("H", "F");
  assert.ok(hcl.lens.t > 0.5 + 1e-3 && hcl.lens.continuous, `lens fraction ${hcl.lens.t}`); assert.ok(hf.lens.t > hcl.lens.t, "larger delta-EN, larger shift");
  assert.ok(hcl.spec.regions[1].conc > 1 && hcl.spec.regions[0].conc < 1, "Cl denser, H thinner"); assert.ok(h2.lens.t === 0.5);
});
test("HCl: redistribution is NOT a rigid shift: the H region bulges towards Cl while its far side is unchanged, and Cl is compacted", () => {
  const { spec } = lensT("H", "Cl"); const H = spec.regions[0]; const Cl = spec.regions[1];
  assert.ok(D.regionRadiusAt(H, [1, 0, 0]) > H.R * 1.2, "toward Cl: drawn out"); assert.ok(Math.abs(D.regionRadiusAt(H, [-1, 0, 0]) - H.R) < 0.02 * H.R, "far side untouched");
  assert.ok(Cl.squeeze < 1, "electronegative atom's region is more compact"); assert.deepEqual(H.c, [0, 0, 0], "no region is slid as a rigid sphere");
});
test("progress 0 gives the equal-sharing picture for any pair; progress is continuous", () => {
  const a = lensT("H", "Cl", { progress: 0 }); assert.ok(a.spec.regions.every((r) => r.pulls.length === 0 && r.conc === 1 && r.squeeze === 1), "progress 0: both regions are the plain equal-sharing spheres");
  let prev = null; for (let p = 0; p <= 1.0001; p += 0.1) { const t = lensT("H", "Cl", { progress: p }).lens.t; if (prev !== null) assert.ok(Math.abs(t - prev) < 0.06, "continuous"); prev = t; }
});
test("minDelta keeps C-H symmetric (IB convention) but still redistributes a polar bond", () => {
  const ch = D.buildRegions(pair("C", "H"), { minDelta: EN.POLAR_BOND_MIN }); assert.equal(ch.regions[0].pulls.length + ch.regions[1].pulls.length, 0);
  const oh = D.buildRegions(pair("O", "H"), { minDelta: EN.POLAR_BOND_MIN }); assert.equal(oh.regions[0].pulls.length + oh.regions[1].pulls.length, 1);
});
test("the polarisation bias moves density to the delta-minus side (against the dipole p) and never exceeds the saturation", () => {
  const spec = D.buildRegions(pair("H", "H"), { bias: { p: [1, 0, 0], strength: 1 } });
  assert.ok(spec.regions[0].offset[0] < 0, "cloud displaced against p (towards delta-minus)"); assert.ok(Math.abs(spec.regions[0].offset[0]) <= D.BIAS_SHIFT * spec.regions[0].R + 1e-12);
  const rhoMinus = D.densityAt(spec, [-1.2, 0, 0]); const rhoPlus = D.densityAt(spec, [1.2 + spec.regions[1].c[0], 0, 0]); assert.ok(rhoMinus > 0 && rhoPlus > 0);
});
test("renderer: one 642-vertex translucent mesh per atom; density attribute is deeper in the overlap; the label model note is simplified", () => {
  const c = new ElectronCloud({}); c.update(D.buildRegions(pair("H", "H"), { progress: 1 })); const s = c.summary();
  assert.equal(c.vertexCount, 642); assert.equal(s.length, 2); assert.ok(c.material.transparent && c.material.depthWrite === false);
  const dens = c.meshes[0].geometry.attributes.aDens.array; assert.ok(Math.max(...dens) > Math.min(...dens) * 1.3, "overlap vertices are denser than the rest");
  c.update(D.buildRegions(pair("H", "Cl")), "k"); c.dispose(); c.update(D.buildRegions(pair("H", "H")), "k"); assert.equal(c.summary().length, 2, "usable again after dispose with the same key (strict-mode safe)");
});

console.log("Chemistry dipole arrow: crossed tail on delta-plus, head towards delta-minus");
test("chemistryArrow starts on the delta+ position and ends on the delta- position", () => {
  const a = chemistryArrow([0, 0, 0], [2, 0, 0]); assert.deepEqual(a.tail, [0, 0, 0]); assert.deepEqual(a.head, [2, 0, 0]); assert.equal(a.crossAt, "tail"); assert.ok(a.dir[0] > 0.999);
});
test("ChemDipoleArrow: the cross bar sits at the tail (delta+), is perpendicular to the shaft and to the view direction, the head is at the delta- end", () => {
  const A = new ChemDipoleArrow({}); A.set([0, 0, 0], [2, 0, 0], 1);
  assert.ok(A.cross.position.distanceTo(A.tail) < 1e-9 && A.tail.x === 0); assert.ok(A.head.position.x > 1.5, "head near the delta- end");
  assert.ok(Math.abs(A.barDir.dot(A.dir)) < 1e-9, "bar perpendicular to shaft"); assert.ok(Math.abs(A.barDir.z) < 1e-9 || Math.abs(A.barDir.dot({ x: 0, y: 0, z: -1 })) < 1e-9, "bar perpendicular to the line of sight (z)");
});

console.log("Molecular polarity: true 3D vector sums");
const IDS = ["h2", "hcl", "co2", "h2o", "bf3", "nh3", "ch4", "ch3cl", "ccl4", "so2"];
test("the ten required molecules exist, in the required set", () => { assert.deepEqual([...Mol.MOLECULE_IDS].sort(), [...IDS].sort()); });
test("symmetric molecules cancel within tolerance; asymmetric ones do not", () => {
  for (const id of ["co2", "bf3", "ccl4"]) { const m = Mol.getMolecule(id); assert.ok(m.net.cancels, `${id} cancels`); assert.ok(m.net.magnitude < 1e-9, `${id} |net| ${m.net.magnitude}`); }
  for (const id of ["h2o", "nh3", "ch3cl", "so2", "hcl"]) { const m = Mol.getMolecule(id); assert.ok(m.net.polar && !m.net.cancels && m.net.magnitude > 0.05, `${id} polar`); }
  for (const id of ["h2", "ch4"]) { const m = Mol.getMolecule(id); assert.ok(!m.net.polar && !m.net.hasPolarBonds, `${id}: no polar bonds, no net dipole`); assert.ok(m.dipoles.every((d) => !d.polar), `${id}: no bond dipole arrows`); }
});
test("net dipole = vector sum of the bond dipoles (3D), independent of how the molecule is rotated", () => {
  for (const id of IDS) {
    const m = Mol.getMolecule(id); let s = [0, 0, 0]; for (const d of m.dipoles) s = s.map((x, k) => x + d.vector[k]); assert.ok(len(s.map((x, k) => x - m.net.vector[k])) < 1e-12);
    const a = 0.7; const R = (p) => [p[0] * Math.cos(a) - p[2] * Math.sin(a), p[1], p[0] * Math.sin(a) + p[2] * Math.cos(a)]; const rot = { ...m, atoms: m.atoms.map((at) => ({ ...at, p: R(at.p) })) };
    const net2 = Mol.netDipoleOf(Mol.bondDipolesOf(rot)); assert.ok(Math.abs(net2.magnitude - m.net.magnitude) < 1e-9, `${id} rotation invariant`);
  }
});
test("every bond dipole points from the delta+ atom to the delta- atom (the more electronegative one)", () => {
  for (const id of IDS) { const m = Mol.getMolecule(id); for (const d of m.dipoles.filter((x) => x.polar)) {
    assert.ok(EN.PAULING[m.atoms[d.minus].el] > EN.PAULING[m.atoms[d.plus].el], `${id}`); const toward = m.atoms[d.minus].p.map((x, k) => x - m.atoms[d.plus].p[k]); assert.ok(dot(toward, d.dir) > 0, "points to delta-minus"); } }
});
test("shapes and angles: CO2 180, BF3 120, CH4 109.5, H2O bent < 110, NH3 pyramidal < 110, CH3Cl net along C-Cl", () => {
  const ang = (id) => Mol.getMolecule(id).angles.map((a) => a.deg);
  assert.ok(Math.abs(ang("co2")[0] - 180) < 1e-6); assert.ok(ang("bf3").every((a) => Math.abs(a - 120) < 1e-6)); assert.ok(ang("ch4").every((a) => Math.abs(a - 109.47) < 0.1));
  assert.ok(ang("h2o")[0] > 100 && ang("h2o")[0] < 110); assert.ok(ang("nh3").every((a) => a > 100 && a < 110)); assert.ok(ang("so2")[0] > 110 && ang("so2")[0] < 125);
  const m = Mol.getMolecule("ch3cl"); const cl = m.atoms.findIndex((a) => a.el === "Cl"); const u = m.atoms[cl].p.map((x, k) => x - m.atoms[0].p[k]); const ul = len(u); assert.ok(dot(u.map((x) => x / ul), m.net.direction) > 0.999, "net along C->Cl");
});
test("a lone pair is not an atom: H2O and NH3 carry lone pairs only as shape information, no dipole is drawn for them", () => {
  assert.equal(Mol.getMolecule("h2o").lonePairs.length, 2); assert.equal(Mol.getMolecule("nh3").lonePairs.length, 1); assert.equal(Mol.getMolecule("h2o").dipoles.length, 2);
});
test("no invented quantitative dipole moments: magnitudes are relative delta-EN, and no text quotes debye values", () => {
  for (const id of IDS) { const m = Mol.getMolecule(id); for (const d of m.dipoles.filter((x) => x.polar)) assert.ok(Math.abs(d.magnitude - d.dEN) < 1e-12, "magnitude = delta-EN (qualitative)"); }
  const text = JSON.stringify(IDS.map((id) => { const m = Mol.getMolecule(id); return [m.explain, m.geometry]; })); assert.ok(!/\bdebye\b|\b\d+\.\d+\s?D\b|C·?m\b|×\s?10/i.test(text), "no quoted dipole-moment numbers");
});

console.log("Vector-addition timeline");
test("the animation reveals, adds head-to-tail, then shows the resultant: the chain end equals the vector sum; cancelling ends at the start", () => {
  for (const id of IDS) {
    const m = Mol.getMolecule(id); const f = VA.vectorFrame(m, 1, "overall"); const o = VA.originOf(m); const end = f.chainEnd.map((x, k) => x - o[k]);
    const scaled = m.net.vector.map((x) => x * VA.ARROW_SCALE); assert.ok(len(end.map((x, k) => x - scaled[k])) < 1e-9, `${id} chain end = sum`);
    if (m.net.cancels) { assert.equal(f.resultant, null); assert.ok(f.zero > 0.99, "zero marker shown"); } else if (m.net.polar) { assert.ok(f.resultant && f.resultant.opacity > 0.99); }
  }
  const m = Mol.getMolecule("h2o"); assert.equal(VA.vectorFrame(m, 0.1, "overall").stage, "reveal"); assert.equal(VA.vectorFrame(m, 0.5, "overall").stage, "add"); assert.equal(VA.vectorFrame(m, 0.95, "overall").stage, "result");
  assert.equal(VA.vectorFrame(m, 0.5, "overall").resultant, null, "no resultant before the result stage");
});
test("display modes: model shows no arrows; bond dipoles shows only bond arrows; overall animates", () => {
  const m = Mol.getMolecule("co2"); assert.ok(VA.vectorFrame(m, 1, "model").arrows.every((a) => a === null)); const b = VA.vectorFrame(m, 0, "bonds"); assert.ok(b.arrows.every((a) => a && a.opacity === 1) && b.resultant === null);
});
test("stage text for cancelling molecules says 'Net dipole moment = 0' only after the result stage", () => {
  const m = Mol.getMolecule("co2"); assert.match(VA.stageText(m, "result"), /Net dipole moment = 0/); assert.ok(!/Net dipole moment = 0/.test(VA.stageText(m, "reveal")));
});

console.log("London dispersion fluctuation signal");
test("zero-mean, bounded, flips sign repeatedly, never constant", () => {
  assert.ok(Math.abs(fluctuationMean(0, 200)) < 0.06); let flips = 0; let prev = 0; let min = 9; let max = -9;
  for (let t = 0; t < 60; t += 0.01) { const v = fluctuationSignal(t); assert.ok(Math.abs(v) <= 1); min = Math.min(min, v); max = Math.max(max, v); const s = Math.sign(v); if (prev && s !== prev) flips += 1; if (s) prev = s; }
  assert.ok(flips >= 10 && min < -0.6 && max > 0.6, `flips ${flips}, range ${min.toFixed(2)}..${max.toFixed(2)}`);
});

console.log("Tug-of-War model");
test("free play and real atoms: results, clamping, predictions", () => {
  assert.equal(Tug.clampFree(9), 4); assert.equal(Tug.clampFree(-1), 0.7); assert.equal(Tug.FREE_DEFAULT.enA, 2.2);
  const r = Tug.resultOf("A", "B", 2.2, 3.2); assert.equal(r.more, "B"); assert.equal(r.plus, "A"); assert.equal(r.minus, "B"); assert.equal(r.dENText, "1.00");
  const e = Tug.resultOf("A", "B", 2.2, 2.2); assert.equal(e.bondType, "Non-polar covalent"); assert.equal(e.plus, null);
  assert.equal(Tug.judgePrediction("H", "Cl", "B").correct, true); assert.equal(Tug.judgePrediction("H", "Cl", "A").correct, false); assert.equal(Tug.judgePrediction("Cl", "Cl", "equal").correct, true);
  assert.equal(Tug.approach(0, 1, 0.016, { reduced: true }), 1, "reduced motion snaps"); const a = Tug.approach(0, 1, 0.1); assert.ok(a > 0 && a < 1);
  for (const el of Tug.REAL_ATOMS) assert.equal(typeof Tug.realValue(el), "number");
});
test("bond pairs for Inside a Covalent Bond: H-H is non-polar with no charges; HCl polar H delta+ / Cl delta-", () => {
  const hh = BP.describePair(BP.pairById("H-H")); assert.equal(hh.equal, true); assert.equal(hh.plus, null); assert.equal(hh.minus, null);
  const hcl = BP.describePair(BP.pairById("H-Cl")); assert.equal(hcl.plus, "H"); assert.equal(hcl.minus, "Cl"); assert.ok(hcl.dEN > 0.9 && hcl.dEN < 1.0);
});

console.log("Polarity Challenge model");
test("rounds: five short questions, deterministic per seed, no timers, answers are in the options, explanations present", () => {
  for (const seed of [1, 2, 3, 7, 42, 99]) {
    const r = Ch.buildRound(seed); assert.equal(r.length, Ch.ROUND_LENGTH); assert.deepEqual(r.map((q) => q.prompt), Ch.buildRound(seed).map((q) => q.prompt));
    for (const q of r) { assert.ok(q.options.some((o) => o.id === q.right), `${q.type}: right answer offered`); assert.ok(q.explain && q.explain.length > 20); assert.ok(!("timer" in q) && !("seconds" in q)); assert.ok(q.options.length >= 2 && q.options.length <= 4); }
  }
  assert.ok(new Set([1, 2, 3, 4, 5, 6, 7, 8].flatMap((s) => Ch.buildRound(s).map((q) => q.type))).size >= 5, "several question types appear");
});
test("scoring and stars: 5/5 = 3 stars, 3/5 = 2, 1/5 = 1, 0 = 0; check() reports correct / wrong", () => {
  assert.equal(Ch.stars(5), 3); assert.equal(Ch.stars(3), 2); assert.equal(Ch.stars(1), 1); assert.equal(Ch.stars(0), 0);
  const q = Ch.buildRound(1)[0]; assert.equal(Ch.check(q, q.right).correct, true); assert.equal(Ch.check(q, "__nope__").correct, false);
});
test("arrow questions use the chemistry convention (crossed tail on the less electronegative atom)", () => {
  let n = 0; for (let s = 1; s < 60 && n < 3; s += 1) for (const q of Ch.buildRound(s)) if (q.type === "arrow") { n += 1; const b = EN.elementBond(q.visual.a, q.visual.b); const right = q.options.find((o) => o.id === q.right); const tailOnLeft = right.arrow.tail === "left"; assert.equal(tailOnLeft, b.less === q.visual.a); }
  assert.ok(n >= 1);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
