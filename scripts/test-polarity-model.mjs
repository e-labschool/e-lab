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
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; const sub = (a, b) => a.map((x, k) => x - b[k]); const unit = (v) => v.map((x) => x / len(v));
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
const MORE = ["hf", "hbr", "ch2cl2", "chcl3", "pcl3", "becl2", "sf6", "xef4", "o3", "cis-dce", "trans-dce"]; const ALLIDS = [...IDS, ...MORE];
test("the ten required molecules are the core set, the original ten come first, and the extras are grouped as 'more'", () => {
  assert.deepEqual(Mol.MOLECULE_IDS.slice(0, 10), IDS); assert.deepEqual([...Mol.MOLECULE_IDS].sort(), [...ALLIDS].sort());
  for (const id of IDS) assert.equal(Mol.getMolecule(id).group, "core"); for (const id of MORE) assert.equal(Mol.getMolecule(id).group, "more");
  assert.equal(Mol.getMolecule("xef4").level, "HL / A level");
});
test("symmetric molecules cancel within tolerance; asymmetric ones do not", () => {
  for (const id of ["co2", "bf3", "ccl4"]) { const m = Mol.getMolecule(id); assert.ok(m.net.cancels, `${id} cancels`); assert.ok(m.net.magnitude < 1e-9, `${id} |net| ${m.net.magnitude}`); }
  for (const id of ["h2o", "nh3", "ch3cl", "so2", "hcl"]) { const m = Mol.getMolecule(id); assert.ok(m.net.polar && !m.net.cancels && m.net.magnitude > 0.05, `${id} polar`); }
  for (const id of ["h2", "ch4"]) { const m = Mol.getMolecule(id); assert.ok(!m.net.polar && !m.net.hasPolarBonds, `${id}: no polar bonds, no net dipole`); assert.ok(m.dipoles.every((d) => !d.polar), `${id}: no bond dipole arrows`); }
});
test("net dipole = vector sum of the bond dipoles (3D), independent of how the molecule is rotated", () => {
  for (const id of ALLIDS) {
    const m = Mol.getMolecule(id); let s = [0, 0, 0]; for (const d of m.dipoles) s = s.map((x, k) => x + d.vector[k]); assert.ok(len(s.map((x, k) => x - m.net.vector[k])) < 1e-12);
    const a = 0.7; const R = (p) => [p[0] * Math.cos(a) - p[2] * Math.sin(a), p[1], p[0] * Math.sin(a) + p[2] * Math.cos(a)]; const rot = { ...m, atoms: m.atoms.map((at) => ({ ...at, p: R(at.p) })) };
    const net2 = Mol.netDipoleOf(Mol.bondDipolesOf(rot)); assert.ok(Math.abs(net2.magnitude - m.net.magnitude) < 1e-9, `${id} rotation invariant`);
  }
});
test("every bond dipole points from the delta+ atom to the delta- atom (the more electronegative one)", () => {
  for (const id of ALLIDS) { const m = Mol.getMolecule(id); for (const d of m.dipoles.filter((x) => x.polar && !x.qualitativeOnly)) {
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
  for (const id of ALLIDS) { const m = Mol.getMolecule(id); for (const d of m.dipoles.filter((x) => x.polar && !x.qualitativeOnly)) assert.ok(Math.abs(d.magnitude - d.dEN) < 1e-12, "magnitude = delta-EN (qualitative)"); }
  const text = JSON.stringify(ALLIDS.map((id) => { const m = Mol.getMolecule(id); return [m.explain, m.geometry]; })); assert.ok(!/\bdebye\b|\b\d+\.\d+\s?D\b|C·?m\b|×\s?10/i.test(text), "no quoted dipole-moment numbers");
});

console.log("Extra molecules (IGCSE / A level / IB HL): geometry, cancellation, direction");
test("extras: cancelling ones (BeCl2, SF6, XeF4, trans-dichloroethene) have net zero from the 3D sum; the polar ones do not", () => {
  for (const id of ["becl2", "sf6", "xef4", "trans-dce"]) { const m = Mol.getMolecule(id); assert.ok(m.net.cancels && m.net.magnitude < 1e-9, `${id} cancels`); }
  for (const id of ["hf", "hbr", "ch2cl2", "chcl3", "pcl3", "cis-dce", "o3"]) { const m = Mol.getMolecule(id); assert.ok(m.net.polar && m.net.magnitude > 0.05, `${id} polar`); }
});
test("extras: geometry comes from VSEPR (BeCl2 180, SF6 90/180, XeF4 square planar, PCl3 pyramidal, O3 about 119.5 bent, DCE 120 planar)", () => {
  const ang = (id) => Mol.getMolecule(id).angles.map((a) => a.deg); const near = (a, b, t = 0.6) => Math.abs(a - b) < t;
  assert.ok(near(ang("becl2")[0], 180)); assert.ok(ang("sf6").every((a) => near(a, 90) || near(a, 180)) && ang("sf6").length === 15);
  const xe = Mol.getMolecule("xef4"); assert.equal(xe.geometry, "Square planar");
  const planar = (m) => { const q = m.atoms.map((a) => a.p); const n = q.slice(1).reduce((best, p1, i) => best ?? (i > 0 && len(cross(q[1].map((x, k) => x - q[0][k]), p1.map((x, k) => x - q[0][k]))) > 1e-6 ? cross(q[1].map((x, k) => x - q[0][k]), p1.map((x, k) => x - q[0][k])) : null), null); return q.every((p) => Math.abs(dot(p.map((x, k) => x - q[0][k]), n)) < 1e-6 * len(n) + 1e-6); };
  assert.ok(planar(xe), "XeF4 planar"); assert.ok(ang("pcl3").every((a) => a > 99 && a < 101.5)); assert.ok(ang("o3")[0] > 115 && ang("o3")[0] < 125);
  for (const id of ["cis-dce", "trans-dce"]) assert.ok(planar(Mol.getMolecule(id)), `${id} planar`);
  const d = Mol.getMolecule("cis-dce"); const cs = d.atoms.map((a, i) => (a.el === "C" ? i : -1)).filter((i) => i >= 0); const cc = d.bonds.find((b) => b[0] === cs[0] && b[1] === cs[1]); assert.equal(cc[2], 2, "C=C is a double bond");
});
test("extras: cis and trans share the same bonds and dipole sizes; only the geometry (the sum) differs", () => {
  const c = Mol.getMolecule("cis-dce"); const t = Mol.getMolecule("trans-dce"); const polarOf = (m) => m.dipoles.filter((d) => d.polar).map((d) => d.magnitude.toFixed(6)).sort().join();
  assert.equal(polarOf(c), polarOf(t)); assert.ok(c.net.polar && !t.net.polar);
});
test("extras: net dipole direction points to the Cl / F side (towards the delta- atoms' side) for CH2Cl2, CHCl3, PCl3, HF", () => {
  for (const id of ["ch2cl2", "chcl3", "pcl3"]) { const m = Mol.getMolecule(id); const cls = m.atoms.filter((a) => a.el === "Cl"); const mean = cls.reduce((s, a) => s.map((x, k) => x + a.p[k] / cls.length), [0, 0, 0]); const centre = m.atoms[0].p; assert.ok(dot(unit(mean.map((x, k) => x - centre[k])), m.net.direction) > 0.9, `${id}: net points towards the Cl atoms`); }
  const hf = Mol.getMolecule("hf"); assert.ok(hf.net.direction[0] > 0.999 && hf.atoms[1].el === "F", "HF: dipole towards F");
  assert.ok(Mol.getMolecule("hf").net.magnitude > Mol.getMolecule("hcl").net.magnitude && Mol.getMolecule("hcl").net.magnitude > Mol.getMolecule("hbr").net.magnitude, "HF > HCl > HBr (relative delta-EN)");
});
test("ozone is an explicit qualitative special case: no electronegativity dipoles (all O-O), arrows flagged qualitative, net not zero", () => {
  const m = Mol.getMolecule("o3"); assert.ok(m.dipoles.every((d) => d.qualitativeOnly && d.dEN === 0)); assert.ok(/qualitative/.test(m.dipoles[0].kind)); assert.ok(/NO electronegativity-based bond dipoles/.test(m.explain));
});
test("net-zero molecules report zero=true even without polar bonds (H2, CH4), so the UI can state it", () => { for (const id of ["h2", "ch4", "co2"]) assert.ok(Mol.getMolecule(id).net.zero, id); for (const id of ["h2o", "hcl"]) assert.ok(!Mol.getMolecule(id).net.zero, id); });

console.log("Vector-addition timeline");
test("the animation reveals, adds head-to-tail, then shows the resultant: the chain end equals the vector sum; cancelling ends at the start", () => {
  for (const id of IDS) {
    const m = Mol.getMolecule(id); const f = VA.vectorFrame(m, 1, "overall"); const o = VA.originOf(m); const end = f.chainEnd.map((x, k) => x - o[k]);
    const scaled = m.net.vector.map((x) => x * VA.arrowScale(m)); assert.ok(len(end.map((x, k) => x - scaled[k])) < 1e-9, `${id} chain end = sum`);
    if (m.net.cancels) { assert.equal(f.resultant, null); assert.ok(f.zero > 0.99, "zero marker shown"); } else if (m.net.polar) { assert.ok(f.resultant && f.resultant.opacity > 0.99); }
  }
  const m = Mol.getMolecule("h2o"); for (const [u, st] of [[0.05, "geometry"], [0.2, "reveal"], [0.45, "add"], [0.7, "complete"], [0.8, "result"], [0.95, "classify"]]) assert.equal(VA.vectorFrame(m, u, "overall").stage, st, `u=${u}`);
  assert.equal(VA.vectorFrame(m, 0.5, "overall").resultant, null, "no resultant before the result stage");
});
test("drawn arrows ARE the 3D bond vectors: along each bond in the molecule, parallel copies in the vector-sum picture, the resultant is their sum (H2O, NH3, SO2, CH3Cl, CHCl3, PCl3, HF, HBr, cis-DCE and the cancelling ones)", () => {
  const dirOf = (a) => { const d = sub(a.to, a.from); return d.map((x) => x / len(d)); };
  for (const id of ["h2o", "nh3", "so2", "ch3cl", "chcl3", "pcl3", "hf", "hbr", "cis-dce", "co2", "bf3", "ccl4", "sf6", "becl2", "trans-dce"]) {
    const m = Mol.getMolecule(id); const f = VA.vectorFrame(m, 1, "overall"); const f0 = VA.vectorFrame(m, 1, "bonds"); const o = VA.originOf(m); const sc = VA.arrowScale(m); let sum = [0, 0, 0]; let n = 0;
    m.dipoles.forEach((d, k) => {
      if (!d.polar) return; n += 1; const bondDir = unit(sub(m.atoms[d.minus].p, m.atoms[d.plus].p));
      for (const a of [f.rest[k], f0.arrows[k], f.arrows[k]]) { assert.ok(a, `${id} arrow ${k}`); assert.ok(len(sub(dirOf(a), bondDir)) < 1e-9, `${id}: arrow ${k} is parallel to its bond (no mirroring or rotation)`); }
      const r = f.rest[k]; assert.ok(len(sub(r.from, m.atoms[d.plus].p)) < len(sub(r.from, m.atoms[d.minus].p)), `${id}: tail on the delta+ side`); assert.ok(len(sub(r.to, m.atoms[d.minus].p)) < len(sub(r.to, m.atoms[d.plus].p)), `${id}: head on the delta- side`);
      const along = dot(sub(r.from, m.atoms[d.plus].p), bondDir); const off = len(sub(sub(r.from, m.atoms[d.plus].p), bondDir.map((x) => x * along))); assert.ok(off < 1e-9, `${id}: the arrow lies ON the bond axis`);
      sum = sum.map((x, q) => x + (f.arrows[k].to[q] - f.arrows[k].from[q]));
    });
    if (n) { const z = f.arrows.find(Boolean); void z; assert.ok(len(sub(sum, m.net.vector.map((x) => x * sc))) < 1e-9, `${id}: copies add up to the net vector`); }
    if (m.net.polar) {
      assert.ok(f.resultant && len(sub(f.resultant.to, o).map((x, q) => x - m.net.vector[q] * sc)) < 1e-9 && len(sub(f.resultant.from, o)) < 1e-9, `${id}: diagram resultant = the sum from the common origin`);
      const mr = f.molResultant; assert.ok(mr, `${id}: resultant drawn in the molecule`); assert.ok(len(sub(dirOf(mr), m.net.direction)) < 1e-9, `${id}: points along the net dipole`); assert.ok(len(sub(mr.from, VA.chargeCentre(m))) < 1e-9, `${id}: starts at the centre of positive charge`);
    } else assert.ok(f.resultant === null && f.molResultant === null && f.zero > 0.99, `${id}: sum is zero, no resultant`);
  }
  // water: the two arrowheads meet at the oxygen, at the real bond angle (about 52 degrees from the vertical); the sum is the diagonal of a parallelogram from a common origin
  const w = Mol.getMolecule("h2o"); const fw = VA.vectorFrame(w, 1, "overall"); const O = w.atoms.find((a) => a.el === "O").p;
  for (const a of fw.rest) { assert.ok(len(sub(a.to, O)) < 0.66 + 1e-9, "head touches the oxygen"); const d = dirOf(a); assert.ok(Math.abs(Math.atan2(Math.abs(d[0]), d[1]) * 180 / Math.PI - 52.25) < 0.1, "52.25 degrees from the vertical"); }
  assert.ok(Math.sign(dirOf(fw.rest[0])[0]) !== Math.sign(dirOf(fw.rest[1])[0]), "the two arrows lean opposite ways, towards each other's heads at O");
  const o2 = VA.originOf(w); assert.ok(fw.arrows.every((a) => len(sub(a.from, o2).map((x, q) => (q === 2 ? 0 : x))) < 1e-9), "both bond vectors start at the same origin"); assert.equal(VA.diagramKind(w), "para"); assert.ok(fw.para && fw.para.length === 2, "dashed parallelogram edges");
  const mrw = VA.moleculeResultant(w); const hs = w.atoms.filter((a) => a.el === "H"); const mid = hs[0].p.map((x, q) => (x + hs[1].p[q]) / 2); assert.ok(len(sub(mrw.from, mid)) < 1e-9, "H2O: net arrow starts at the midpoint of the two H atoms"); assert.ok(dirOf(mrw)[1] > 0.999, "and points up towards O");
});
test("display modes: model shows no arrows; bond dipoles shows only bond arrows; overall animates", () => {
  const m = Mol.getMolecule("co2"); assert.ok(VA.vectorFrame(m, 1, "model").arrows.every((a) => a === null)); const b = VA.vectorFrame(m, 0, "bonds"); assert.ok(b.arrows.every((a) => a && a.opacity === 1) && b.resultant === null);
});
test("stage text for cancelling molecules says 'Net dipole moment, μ = 0' only at step 6 (classification)", () => {
  const m = Mol.getMolecule("co2"); assert.match(VA.stageText(m, "classify"), /Net dipole moment, μ = 0/); for (const st of ["geometry", "reveal", "add", "complete", "result"]) assert.ok(!/Net dipole moment/.test(VA.stageText(m, st)), `${st}: the classification waits for step 6`);
  assert.match(VA.stageText(m, "result"), /cancel/); assert.match(VA.stageText(Mol.getMolecule("h2o"), "result"), /resultant/);
});

console.log("Audit of every molecule in the selector (geometry, bond dipoles, 3D sum, direction, display rules)");
const MEAN = (ps) => ps.reduce((a, p) => a.map((x, k) => x + p[k] / ps.length), [0, 0, 0]);
const rotate = (v, ax, an) => { const k = unit(ax); const c = Math.cos(an); const sn = Math.sin(an); const kv = cross(k, v); const kd = dot(k, v); return v.map((x, i) => x * c + kv[i] * sn + k[i] * kd * (1 - c)); };
// expected: polar? / where the net dipole must point (from the delta+ side to the named atoms) / the measured-ish angle(s) the model must show / the dipole count drawn
const EXPECT = {
  h2: { polar: false, geometry: "Linear (diatomic)", drawn: 0 }, hcl: { polar: true, to: "Cl", from: "H" }, hf: { polar: true, to: "F", from: "H" }, hbr: { polar: true, to: "Br", from: "H" },
  co2: { polar: false, geometry: "Linear", angles: [180], drawn: 2 }, becl2: { polar: false, geometry: "Linear", angles: [180], drawn: 2 },
  h2o: { polar: true, to: "O", geometry: "Bent", angles: [104.5] }, nh3: { polar: true, to: "N", geometry: "Trigonal pyramidal", angles: [107] }, so2: { polar: true, to: "O", geometry: "Bent", angles: [119.3] },
  bf3: { polar: false, geometry: "Trigonal planar", angles: [120], drawn: 3 }, ch4: { polar: false, geometry: "Tetrahedral", angles: [109.47], drawn: 4 }, ccl4: { polar: false, geometry: "Tetrahedral", angles: [109.47], drawn: 4 },
  ch3cl: { polar: true, to: "Cl", from: "C" }, ch2cl2: { polar: true, to: "Cl", from: "C" }, chcl3: { polar: true, to: "Cl", from: "C" }, pcl3: { polar: true, to: "Cl", geometry: "Trigonal pyramidal", angles: [100.3] },
  sf6: { polar: false, geometry: "Octahedral", angles: [90, 180], drawn: 6 }, xef4: { polar: false, geometry: "Square planar", angles: [90, 180], drawn: 4 },
  o3: { polar: true, geometry: "Bent", angles: [116.8], special: "end-O" }, "cis-dce": { polar: true, to: "Cl" }, "trans-dce": { polar: false },
};
test("the audit table covers every molecule in the code (no molecule is left unchecked)", () => { assert.deepEqual(Object.keys(EXPECT).sort(), [...Mol.MOLECULE_IDS].sort()); assert.equal(Mol.MOLECULE_IDS.length, 21); });
test("every molecule: classification, geometry name, bond angles (measured values where the shape alone does not fix them) and number of drawn bond dipoles", () => {
  for (const [id, e] of Object.entries(EXPECT)) {
    const m = Mol.getMolecule(id); assert.equal(m.net.polar, e.polar, `${id} polar`); assert.equal(m.net.zero, !e.polar, `${id} zero`); assert.equal(m.net.cancels, !e.polar && m.dipoles.some((d) => d.polar), `${id} cancels flag`);
    if (e.geometry) assert.equal(m.geometry, e.geometry, `${id} geometry`);
    if (e.angles) { const got = [...new Set(m.angles.map((a) => Math.round(a.deg * 10) / 10))]; for (const a of got) assert.ok(e.angles.some((x) => Math.abs(x - a) < 0.1), `${id}: angle ${a} expected one of ${e.angles}`); assert.ok(e.angles.every((x) => got.some((a) => Math.abs(x - a) < 0.1)), `${id}: all of ${e.angles} present (${got})`); }
    if (e.drawn !== undefined) assert.equal(m.dipoles.filter((d) => VA.isActive(m, d)).length, e.drawn, `${id} drawn bond dipoles (CH4: four faint, near-zero C-H dipoles)`);
  }
  // the same VSEPR shape does not mean the same angle: H2O 104.5, NH3 107, PCl3 100.3 / SO2 119.3, O3 116.8 / the three pyramids and the three bent molecules differ
  const a1 = (id) => Mol.getMolecule(id).angles[0].deg; assert.ok(new Set([a1("nh3"), a1("pcl3")].map((x) => x.toFixed(1))).size === 2 && new Set([a1("h2o"), a1("so2"), a1("o3")].map((x) => x.toFixed(1))).size === 3);
});
test("every molecule: each bond dipole points from the delta+ atom to the delta- (more electronegative) atom along the bond; partial-charge signs match; no label on equal-EN atoms", () => {
  for (const id of ALLIDS) {
    const m = Mol.getMolecule(id);
    for (const d of m.dipoles.filter((x) => x.polar)) {
      assert.ok(len(sub(d.dir, unit(sub(m.atoms[d.minus].p, m.atoms[d.plus].p)))) < 1e-9, `${id}: direction = bond direction`);
      if (!d.qualitativeOnly) assert.ok(EN.PAULING[m.atoms[d.minus].el] > EN.PAULING[m.atoms[d.plus].el], `${id}: delta- is the more electronegative atom`);
    }
    m.atoms.forEach((a, i) => { if (m.signs[i] > 0) assert.ok(m.dipoles.some((d) => d.polar && d.plus === i), `${id}: ${a.el}${i} delta+ is the tail of a polar bond`); if (m.signs[i] < 0) assert.ok(m.dipoles.some((d) => d.polar && d.minus === i), `${id}: ${a.el}${i} delta- is the head of a polar bond`); });
  }
  const sg = (id) => { const m = Mol.getMolecule(id); return m.atoms.map((a, i) => `${a.el}${m.signs[i] > 0 ? "+" : m.signs[i] < 0 ? "-" : "0"}`).join(" "); };
  assert.equal(sg("h2"), "H0 H0"); assert.equal(sg("hcl"), "H+ Cl-"); assert.equal(sg("h2o"), "O- H+ H+"); assert.equal(sg("nh3"), "N- H+ H+ H+"); assert.equal(sg("co2"), "C+ O- O-"); assert.equal(sg("ch4"), "C0 H0 H0 H0 H0");
  assert.equal(sg("so2"), "S+ O- O-"); assert.equal(sg("o3"), "O+ O- O-", "ozone: central O delta+, end O delta- (formal-charge picture, flagged qualitative)");
});
test("every molecule: the 3D vector sum equals the sum of the bond vectors; zero within tolerance for the symmetric ones; unchanged by an arbitrary rotation of the molecule", () => {
  for (const id of ALLIDS) {
    const m = Mol.getMolecule(id); let v = [0, 0, 0]; for (const d of m.dipoles) v = v.map((x, k) => x + d.vector[k]); assert.ok(len(sub(v, m.net.vector)) < 1e-12, `${id} sum`);
    if (!EXPECT[id].polar) assert.ok(m.net.magnitude < Mol.CANCEL_TOL, `${id} cancels within tolerance`); else assert.ok(m.net.magnitude > 0.2, `${id} clearly non-zero`);
    for (const [ax, an] of [[[1, 2, 3], 0.9], [[-2, 1, 0.5], 2.4], [[0, 0, 1], Math.PI]]) {
      const r = { ...m, atoms: m.atoms.map((a) => ({ ...a, p: rotate(a.p, ax, an) })) }; const rd = Mol.bondDipolesOf(r); const rn = Mol.netDipoleOf(rd);
      assert.equal(rn.polar, m.net.polar, `${id} rotated: same verdict`); assert.ok(Math.abs(rn.magnitude - m.net.magnitude) < 1e-9, `${id} rotated: same magnitude`); assert.ok(len(sub(rn.vector, rotate(m.net.vector, ax, an))) < 1e-9, `${id} rotated: the vector rotates with the molecule (no mirroring, no reversal)`);
    }
  }
});
test("every polar molecule: the net dipole points towards the expected atoms (HCl/HF/HBr halogen, H2O O, NH3 N, CH3Cl Cl, SO2 along the bisector to the O side, O3 end atoms)", () => {
  for (const [id, e] of Object.entries(EXPECT)) {
    if (!e.polar) continue; const m = Mol.getMolecule(id); const P = (el, not) => m.atoms.filter((a, i) => (el ? a.el === el : true) && (not === undefined || i !== not));
    let from; let to;
    if (id === "o3") { from = m.atoms[0].p; to = MEAN(m.atoms.slice(1).map((a) => a.p)); }
    else if (id === "cis-dce") { from = MEAN(P("C").map((a) => a.p)); to = MEAN(P("Cl").map((a) => a.p)); }
    else if (e.from) { from = MEAN(P(e.from).map((a) => a.p)); to = MEAN(P(e.to).map((a) => a.p)); }
    else if (["h2o"].includes(id)) { from = MEAN(P("H").map((a) => a.p)); to = P("O")[0].p; }
    else if (id === "nh3") { from = MEAN(P("H").map((a) => a.p)); to = P("N")[0].p; }
    else { from = m.atoms[0].p; to = MEAN(m.atoms.slice(1).map((a) => a.p)); } // SO2, PCl3: central atom to the mean of the ligands
    assert.ok(dot(unit(sub(to, from)), m.net.direction) > 0.999, `${id}: net dipole towards ${e.to ?? "the end atoms"}`);
  }
  const so2 = Mol.getMolecule("so2"); const b = unit(sub(so2.atoms[1].p, so2.atoms[0].p).map((x, k) => x + sub(so2.atoms[2].p, so2.atoms[0].p)[k])); assert.ok(dot(b, so2.net.direction) > 0.999, "SO2: along the angle bisector, towards the O side");
  for (const id of ["hcl", "hf", "hbr"]) { const m = Mol.getMolecule(id); const hal = m.atoms.findIndex((a) => a.el !== "H"); assert.ok(m.net.direction[0] * Math.sign(m.atoms[hal].p[0] - m.atoms[1 - hal].p[0]) > 0.999, `${id}: towards the halogen`); }
});
test("every molecule: a zero sum draws NO pink arrow in any frame, a non-zero sum draws it only from the result step on; the bond arrows are yellow-convention vectors in all of them", () => {
  for (const id of ALLIDS) {
    const m = Mol.getMolecule(id);
    for (let u = 0; u <= 1.0001; u += 0.05) { const f = VA.vectorFrame(m, Math.min(1, u), "overall"); if (m.net.zero) assert.ok(f.resultant === null && f.molResultant === null, `${id} u=${u.toFixed(2)}: no pink arrow`); else if (u < VA.PHASES.result[0] - 1e-9) assert.ok(f.resultant === null && f.molResultant === null, `${id} u=${u.toFixed(2)}: no resultant yet`); }
    for (const mode of ["model", "bonds"]) { const f = VA.vectorFrame(m, 1, mode); assert.ok(f.resultant === null && f.molResultant === null, `${id} ${mode}: no resultant`); }
    const f1 = VA.vectorFrame(m, 1, "overall"); assert.equal(!!f1.resultant, m.net.polar); assert.equal(!!f1.molResultant, m.net.polar); assert.equal(f1.zero > 0.99, m.net.zero);
  }
});
test("six-step order: 1 geometry (no arrows), 2 bond arrows appear on the bonds, 3 copies move to the construction, 4 parallelogram / sequential sum completes, 5 resultant or cancellation, 6 classification", () => {
  assert.deepEqual(VA.STAGES, ["geometry", "reveal", "add", "complete", "result", "classify"]); let prev = -1; for (let u = 0; u <= 1; u += 0.01) { const i = VA.STAGES.indexOf(VA.stageAt(u)); assert.ok(i >= prev, "never goes back"); prev = i; } assert.equal(VA.stageAt(1), "classify");
  for (const id of ALLIDS) {
    const m = Mol.getMolecule(id); const drawn = (f) => f.arrows.filter(Boolean).length; const restN = (f) => f.rest.filter((r) => r && r.opacity > 0.01).length; const hasBonds = m.dipoles.some((d) => VA.isActive(m, d));
    const f0 = VA.vectorFrame(m, 0.05, "overall"); assert.equal(drawn(f0), 0, `${id} step 1: nothing yet`); assert.equal(restN(f0), 0); assert.ok(f0.resultant === null && f0.para === null);
    const f2 = VA.vectorFrame(m, 0.28, "overall"); assert.equal(drawn(f2), 0, `${id} step 2: arrows only on the bonds, copies not yet moving`); if (hasBonds) assert.ok(restN(f2) > 0, `${id} step 2: the bond arrows are shown`);
    const f3 = VA.vectorFrame(m, 0.45, "overall"); if (hasBonds) { assert.ok(drawn(f3) > 0, `${id} step 3: copies are moving`); assert.ok(restN(f3) > 0, `${id}: the originals stay on the bonds`); assert.ok(f3.resultant === null && f3.para === null, `${id} step 3: construction not yet complete`); }
    const f4 = VA.vectorFrame(m, 0.74, "overall"); assert.equal(drawn(f4), VA.chainArrows(m, "below").arrows.filter(Boolean).length, `${id} step 4: every copy is in place`); assert.ok(f4.resultant === null, `${id} step 4: no resultant yet`); if (VA.diagramKind(m) === "para") assert.equal(f4.para.length, 2, `${id}: dashed parallelogram sides`);
    const f5 = VA.vectorFrame(m, 0.89, "overall"); assert.equal(!!f5.resultant, m.net.polar, `${id} step 5: resultant exactly when the sum is non-zero`);
    const f6 = VA.vectorFrame(m, 0.95, "overall"); assert.equal(f6.stage, "classify");
  }
  // the copies are placed without changing length or direction: two non-collinear dipoles share ONE origin (parallelogram), three or more are laid tip to tail
  const kinds = Object.fromEntries(ALLIDS.map((id) => [id, VA.diagramKind(Mol.getMolecule(id))])); for (const id of ["h2o", "so2", "o3", "ch2cl2", "cis-dce"]) assert.equal(kinds[id], "para", id); for (const id of ["nh3", "bf3", "ccl4", "sf6", "xef4", "chcl3", "pcl3"]) assert.equal(kinds[id], "chain", id);
  for (const id of ALLIDS) { const m = Mol.getMolecule(id); const f = VA.vectorFrame(m, 1, "overall"); f.arrows.forEach((a, k) => { if (!a) return; const r = f.rest[k]; const va = sub(a.to, a.from); const vr = sub(r.to, r.from); assert.ok(Math.abs(len(va) - len(vr)) < 1e-9 && len(sub(unit(va), unit(vr))) < 1e-9, `${id} arrow ${k}: the copy keeps its length and direction`); }); }
});
test("copies and bond arrows can be matched: colour-matched d1, d2 ... tags for every molecule with two or more drawn dipoles, on the same side as their own copy", () => {
  for (const id of ALLIDS) {
    const m = Mol.getMolecule(id); const n = m.dipoles.filter((d) => VA.isActive(m, d)).length; const plan = VA.labelPlan(m, "below");
    if (n < 2) { assert.equal(plan.length, 0, `${id}: nothing to match`); continue; }
    assert.equal(plan.length, n, `${id}: one tag per drawn arrow`); assert.equal(new Set(plan.map((t) => t.color)).size, n, `${id}: distinct tag colours`); assert.deepEqual(plan.map((t) => t.n), plan.map((_, i) => i + 1));
    assert.ok(plan.every((t) => !["#f5a300", "#d6247a", "#2563eb", "#e11d48"].includes(t.color) && [...t.restOffset, ...t.copyOffset].every(Number.isFinite)), `${id}: tag colours never reuse yellow, pink, delta+ blue or delta- red`);
  }
  const w = Mol.getMolecule("h2o"); const pl = VA.labelPlan(w, "below"); const ch = VA.chainArrows(w, "below"); const mid = (k) => ch.drawn[k].from.map((x, q) => (x + ch.drawn[k].to[q]) / 2);
  pl.forEach((t, i) => { const o = pl[1 - i]; assert.ok(dot(t.copyOffset, sub(mid(t.k), mid(o.k))) > 0, "the d-tag of a copy sits on the outer side, away from the other copy"); });
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
