#!/usr/bin/env node
// Model + UI tests for the molecular side of the NMR simulation:  node scripts/test-nmr-molecular.mjs
// Part 1 (pure): molecule data model, generated 3D geometry, topology-derived equivalence, coupling, signal generation,
// integration, view model, linked selection, challenges. Part 2 (jsdom): the four exported components with a local `studio` prop.
import assert from "node:assert/strict";
import { MOLECULES, MOLECULE_BY_ID, ATOMIC, BOND_LENGTH_A, getMolecule, searchMolecules, moleculeFormulaCounts, totalHydrogens } from "../src/engines/spectroscopy-studio/nmr/molecular/model/molecules.js";
import { coordinatesFor, dist, angleDeg, localGeometry } from "../src/engines/spectroscopy-studio/nmr/molecular/model/geometry.js";
import { hydrogenClasses, declaredClasses, derivedNeighbourCounts, declaredNeighbourCounts, couplingJ, vicinalNeighbours } from "../src/engines/spectroscopy-studio/nmr/molecular/model/topology.js";
import * as S from "../src/engines/spectroscopy-studio/nmr/molecular/model/spectrum.js";
import * as L from "../src/engines/spectroscopy-studio/nmr/molecular/model/linking.js";
import * as C from "../src/engines/spectroscopy-studio/nmr/molecular/model/challenges.js";
import * as H from "../src/engines/spectroscopy-studio/nmr/molecular/model/shielding.js";

let passed = 0; let failed = 0;
async function test(name, fn) { try { await fn(); console.log(`  ok   ${name}`); passed += 1; } catch (e) { console.log(`  FAIL ${name}\n       ${(e.stack || e.message).split("\n").slice(0, 6).join("\n       ")}`); failed += 1; } }
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} ${a} vs ${b} (tol ${tol})`);

console.log("Library");
const EXPECTED = {
  methane: { formula: { C: 1, H: 4 }, counts: [4] },
  ethane: { formula: { C: 2, H: 6 }, counts: [6] },
  propane: { formula: { C: 3, H: 8 }, counts: [2, 6] },
  propanone: { formula: { C: 3, H: 6, O: 1 }, counts: [6] },
  ethanol: { formula: { C: 2, H: 6, O: 1 }, counts: [2, 1, 3] },
  "ethyl-ethanoate": { formula: { C: 4, H: 8, O: 2 }, counts: [2, 3, 3] },
  "propan-1-ol": { formula: { C: 3, H: 8, O: 1 }, counts: [2, 1, 2, 3] },
  "propan-2-ol": { formula: { C: 3, H: 8, O: 1 }, counts: [1, 1, 6] },
  ethanal: { formula: { C: 2, H: 4, O: 1 }, counts: [1, 3] },
};
await test("the nine required molecules are present", () => { assert.deepEqual(MOLECULES.map((m) => m.id).sort(), Object.keys(EXPECTED).sort()); });
for (const mol of MOLECULES) {
  const exp = EXPECTED[mol.id];
  await test(`${mol.id}: atom counts, valences, environments and H counts`, () => {
    assert.deepEqual(moleculeFormulaCounts(mol), exp.formula);
    for (const a of mol.atoms) {
      const bondsOf = mol.bonds.filter((b) => b.a === a.idx || b.b === a.idx);
      const valence = bondsOf.reduce((s, b) => s + b.order, 0);
      assert.equal(valence, ATOMIC[a.el].valence, `valence of ${a.key}`);
      assert.ok(!bondsOf.some((b) => b.a === b.b));
    }
    assert.deepEqual(mol.environments.map((e) => e.count), exp.counts);
    assert.equal(mol.environments.reduce((s, e) => s + e.count, 0), totalHydrogens(mol));
    const seen = new Set(); for (const e of mol.environments) for (const h of e.atoms) { assert.ok(!seen.has(h), "H in two environments"); seen.add(h); assert.ok(mol.atoms[h].isHydrogen); }
    assert.equal(seen.size, totalHydrogens(mol));
    // connected graph
    const reach = new Set([0]); const q = [0]; while (q.length) { const i = q.shift(); for (const n of mol.atoms[i].neighbours) if (!reach.has(n)) { reach.add(n); q.push(n); } }
    assert.equal(reach.size, mol.atoms.length, "connected");
  });
  await test(`${mol.id}: formula string matches atom counts`, () => {
    const f = Object.entries(moleculeFormulaCounts(mol)).sort(([a], [b]) => (a === "C" ? -1 : b === "C" ? 1 : a === "H" ? -1 : b === "H" ? 1 : a.localeCompare(b)))
      .map(([el, n]) => `${el}${n > 1 ? String(n).replace(/\d/g, (d) => "₀₁₂₃₄₅₆₇₈₉"[d]) : ""}`).join("");
    assert.equal(mol.formula, f);
  });
  await test(`${mol.id}: provenance present for every shift (representative, range, basis, note, descriptor)`, () => {
    for (const e of mol.environments) {
      assert.ok(Number.isFinite(e.delta) && e.delta >= 0 && e.delta <= 14);
      assert.ok(Array.isArray(e.range) && e.range[0] <= e.delta && e.delta <= e.range[1], `${e.id} delta inside its range`);
      assert.ok(["booklet", "reference"].includes(e.basis), "basis");
      assert.ok(typeof e.note === "string" && e.note.length > 20, "note");
      assert.ok(typeof e.descriptor === "string" && e.descriptor.length > 10, "descriptor");
      assert.equal(e.representative, true);
      if (e.basis === "booklet") assert.ok(e.bookletRow, "booklet basis needs the row name");
    }
    assert.ok(mol.teacherNote.length > 20);
    const ds = mol.environments.map((e) => e.delta); assert.deepEqual(ds, [...ds].sort((a, b) => b - a), "environments listed from high to low delta (a = leftmost)");
  });
  await test(`${mol.id}: 3D geometry (bond lengths, angles, no overlaps, correct neighbours)`, () => {
    const xyz = coordinatesFor(mol);
    assert.equal(xyz.length, mol.atoms.length);
    for (const p of xyz) for (const v of p) assert.ok(Number.isFinite(v));
    for (const b of mol.bonds) { const exp = BOND_LENGTH_A[b.key]; assert.ok(exp, `length table for ${b.key}`); near(dist(xyz[b.a], xyz[b.b]), exp, 1e-6, `bond ${b.key}`); }
    for (let i = 0; i < xyz.length; i += 1) for (let j = i + 1; j < xyz.length; j += 1) {
      const bonded = mol.atoms[i].neighbours.includes(j);
      const d = dist(xyz[i], xyz[j]);
      if (!bonded) assert.ok(d > (mol.atoms[i].isHydrogen && mol.atoms[j].isHydrogen ? 1.55 : 1.9), `${mol.atoms[i].key}...${mol.atoms[j].key} too close: ${d.toFixed(2)}`);
    }
    for (const a of mol.atoms) {
      if (a.neighbours.length < 2) continue;
      const geo = localGeometry(mol, a.idx);
      for (let i = 0; i < a.neighbours.length; i += 1) for (let j = i + 1; j < a.neighbours.length; j += 1) {
        const ang = angleDeg(xyz[a.neighbours[i]], xyz[a.idx], xyz[a.neighbours[j]]);
        if (geo.kind === "tetrahedral") near(ang, 109.47, 0.01, `${a.key} tetrahedral angle`);
        else if (geo.kind === "trigonal") near(ang, 120, 0.01, `${a.key} trigonal angle`);
        else near(ang, (geo.angle * 180) / Math.PI, 0.01, `${a.key} bent angle`);
      }
      if (geo.kind === "trigonal") { // planarity of the carbonyl carbon and its three substituents
        const [p, q, r] = a.neighbours.map((n) => xyz[n]);
        const u = [q[0] - p[0], q[1] - p[1], q[2] - p[2]]; const v = [r[0] - p[0], r[1] - p[1], r[2] - p[2]]; const w = [xyz[a.idx][0] - p[0], xyz[a.idx][1] - p[1], xyz[a.idx][2] - p[2]];
        const nrm = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        near(Math.abs(nrm[0] * w[0] + nrm[1] * w[1] + nrm[2] * w[2]) / Math.hypot(...nrm), 0, 1e-6, `${a.key} planarity`);
      }
    }
  });
  await test(`${mol.id}: topology-derived equivalence classes equal the declared environments`, () => {
    assert.deepEqual(hydrogenClasses(mol), declaredClasses(mol));
  });
  await test(`${mol.id}: declared couplings equal the H-C-C-H neighbour graph (exchangeable H excluded, equivalent H never couple)`, () => {
    assert.deepEqual(JSON.parse(JSON.stringify(derivedNeighbourCounts(mol))), JSON.parse(JSON.stringify(declaredNeighbourCounts(mol))));
    for (const e of mol.environments) if (e.exchangeable) { assert.deepEqual(derivedNeighbourCounts(mol)[e.id], {}); assert.ok(e.exchangeNote && e.exchangeNote.length > 30, "exchange note"); }
    for (const c of mol.couplings) { assert.ok(c.J > 0 && c.J < 20, "J in Hz"); assert.notEqual(c.a, c.b); assert.ok(!mol.environments.find((e) => e.id === c.a).exchangeable && !mol.environments.find((e) => e.id === c.b).exchangeable); }
    // H of the same environment never appear as each other's vicinal neighbours
    for (const e of mol.environments) for (const h of e.atoms) for (const n of vicinalNeighbours(mol, h)) assert.notEqual(mol.envOfAtom[n], e.id);
  });
}
await test("specification checks: ethanol 3:2:1, propane 6:2, propan-2-ol 6:1:1, propan-1-ol 3:2:2:1, others", () => {
  const counts = (id) => getMolecule(id).environments.map((e) => e.count).sort((a, b) => b - a);
  assert.deepEqual(counts("ethanol"), [3, 2, 1]); assert.deepEqual(counts("propane"), [6, 2]); assert.deepEqual(counts("propan-2-ol"), [6, 1, 1]); assert.deepEqual(counts("propan-1-ol"), [3, 2, 2, 1]);
  const d = (id, label) => getMolecule(id).environments.find((e) => e.label === label).delta;
  assert.equal(d("ethanol", "CH₃"), 1.2); assert.equal(d("ethanol", "CH₂"), 3.7); assert.equal(d("ethanol", "OH"), 2.6);
  assert.equal(d("ethyl-ethanoate", "CH₃CO"), 2.0); assert.equal(d("ethyl-ethanoate", "OCH₂"), 4.1); assert.equal(d("ethyl-ethanoate", "CH₃"), 1.2);
  assert.equal(d("ethanal", "CHO"), 9.8); assert.equal(d("ethanal", "CH₃"), 2.2); assert.equal(d("propanone", "CH₃"), 2.1); assert.equal(d("methane", "CH₄"), 0.2); assert.equal(d("ethane", "CH₃"), 0.9);
});
await test("search finds molecules by name, alias and formula", () => {
  assert.equal(searchMolecules("acetone")[0].id, "propanone"); assert.equal(searchMolecules("C2H6O")[0].id, "ethanol"); assert.equal(searchMolecules("isopropanol")[0].id, "propan-2-ol"); assert.equal(searchMolecules("").length, 9); assert.equal(searchMolecules("zzz").length, 0);
});

console.log("Pascal triangle and first-order multiplets");
await test("Pascal intensities for 0-5 neighbours; n + 1 lines; weights sum to 1", () => {
  const expect = [[1], [1, 1], [1, 2, 1], [1, 3, 3, 1], [1, 4, 6, 4, 1], [1, 5, 10, 10, 5, 1]];
  for (let n = 0; n <= 5; n += 1) {
    assert.deepEqual(S.pascalRow(n), expect[n]);
    const lines = S.splitOffsets(Array.from({ length: n }, () => ({ J: 7 })), n, 1);
    assert.equal(lines.length, n + 1);
    const tot = expect[n].reduce((a, b) => a + b, 0);
    lines.forEach((l, i) => near(l.rel, expect[n][i] / tot, 1e-12, `n=${n} line ${i}`));
    near(lines.reduce((s, l) => s + l.rel, 0), 1, 1e-12);
    for (let i = 1; i < lines.length; i += 1) near(lines[i].offsetHz - lines[i - 1].offsetHz, 7, 1e-9, "spacing = J");
  }
  assert.equal(S.pascalText(3), "1:3:3:1");
});
await test("multiplicity equals neighbours + 1 for every environment of every molecule (derived from topology)", () => {
  for (const mol of MOLECULES) {
    const derived = derivedNeighbourCounts(mol);
    for (const s of S.buildSignals(mol, { freqMHz: 400, coupling: true })) {
      const n = Object.values(derived[s.envId]).reduce((a, b) => a + b, 0);
      assert.equal(s.multiplicity.nNeighbours, n, `${mol.id}/${s.label}`);
      assert.equal(s.lines.length, n + 1, `${mol.id}/${s.label} line count`);
      assert.equal(s.multiplicity.name, S.MULT_NAMES[n]);
      assert.equal(s.multiplicity.nPlusOne, true);
      S.pascalRow(n).forEach((v, i) => near(s.lines[i].rel, v / (2 ** n), 1e-12));
    }
  }
});
await test("specified patterns: ethanol t/q/s, ethyl ethanoate s/q/t, propan-1-ol t, sextet, t, s; ethanal q/d; propane septet", () => {
  const name = (id, label) => S.buildSignals(getMolecule(id)).find((s) => s.label === label).multiplicity.name;
  assert.equal(name("ethanol", "CH₃"), "triplet"); assert.equal(name("ethanol", "CH₂"), "quartet"); assert.equal(name("ethanol", "OH"), "singlet");
  assert.equal(name("ethyl-ethanoate", "CH₃CO"), "singlet"); assert.equal(name("ethyl-ethanoate", "OCH₂"), "quartet"); assert.equal(name("ethyl-ethanoate", "CH₃"), "triplet");
  assert.equal(name("propan-1-ol", "CH₃"), "triplet"); assert.equal(name("propan-1-ol", "CH₂"), "sextet"); assert.equal(name("propan-1-ol", "OCH₂"), "triplet"); assert.equal(name("propan-1-ol", "OH"), "singlet");
  assert.equal(name("ethanal", "CHO"), "quartet"); assert.equal(name("ethanal", "CH₃"), "doublet"); assert.equal(name("propane", "CH₂"), "septet"); assert.equal(name("propan-2-ol", "CH"), "septet"); assert.equal(name("propan-2-ol", "CH₃"), "doublet");
  const mid = S.buildSignals(getMolecule("propan-1-ol")).find((s) => s.label === "CH₂").multiplicity;
  assert.equal(mid.apparent, true, "middle CH2 is flagged as an apparent first-order sextet (two neighbour sets)"); assert.equal(mid.equivalentNeighbours, false);
  assert.ok(getMolecule("propan-1-ol").firstOrderCaveat);
});
await test("no splitting between equivalent H, and none from/to an exchange-decoupled OH", () => {
  for (const mol of MOLECULES) {
    for (const e of mol.environments) {
      const sp = S.neighbourSpins(mol, e.id);
      assert.ok(!sp.some((s) => s.envId === e.id), "equivalent H split each other");
      if (e.exchangeable) assert.equal(sp.length, 0);
      assert.ok(!sp.some((s) => mol.environments.find((x) => x.id === s.envId).exchangeable), "split by an exchangeable H");
    }
  }
  const eth = S.buildSignals(getMolecule("ethanol")); assert.equal(eth.find((s) => s.label === "CH₂").multiplicity.nNeighbours, 3, "CH2 sees only the CH3");
  const ethane = S.buildSignals(getMolecule("ethane"))[0]; assert.equal(ethane.lines.length, 1); const meth = S.buildSignals(getMolecule("methane"))[0]; assert.equal(meth.lines.length, 1);
});
await test("without coupling every signal is a single line of the same area", () => {
  for (const mol of MOLECULES) for (const s of S.buildSignals(mol, { coupling: false })) { assert.equal(s.lines.length, 1); assert.equal(s.area, s.env.count); near(s.lines[0].ppm, s.env.delta, 1e-12); }
});

console.log("Line positions, units and integration");
for (const f of [60, 90, 300, 400, 600, 800]) {
  await test(`line separations equal J in Hz at ${f} MHz and do not depend on the shift`, () => {
    for (const mol of MOLECULES) for (const s of S.buildSignals(mol, { freqMHz: f })) {
      for (let i = 1; i < s.lines.length; i += 1) {
        const dHz = Math.abs(s.lines[i - 1].ppm - s.lines[i].ppm) * f; // ppm * MHz = Hz
        const expectJ = s.spins[0].J;
        if (s.neighbours.length <= 1) near(dHz, expectJ, 1e-7, `${mol.id}/${s.label}`);
      }
      near(s.centerHz, s.deltaPpm * f, 1e-9);
      near(S.centroidHz(s), s.centerHz, 1e-7, "centroid = centre");
      near(S.centroidHz(s) / f, s.env.delta, 1e-9, "centroid in ppm = delta");
    }
  });
}
await test("J override: the same J in Hz is a smaller ppm gap at higher frequency; the shift is unchanged", () => {
  const mol = getMolecule("ethanol");
  const at = (f, J) => S.buildSignals(mol, { freqMHz: f, jOverrideHz: J }).find((s) => s.label === "CH₃");
  const a = at(300, 7); const b = at(600, 7); const c = at(600, 14);
  near(a.lines[1].ppm - a.lines[0].ppm, 7 / 300, 1e-12); near(b.lines[1].ppm - b.lines[0].ppm, 7 / 600, 1e-12); near(c.lines[1].ppm - c.lines[0].ppm, 14 / 600, 1e-12);
  near(a.deltaPpm, b.deltaPpm, 0); near(S.centroidHz(a) / 300, S.centroidHz(b) / 600, 1e-12);
  near(S.jInPpm(7, 400), 0.0175, 1e-12);
});
await test("total multiplet area is constant as coupling toggles and while the splitting animates", () => {
  for (const mol of MOLECULES) for (const f of [60, 400]) {
    const off = S.buildSignals(mol, { freqMHz: f, coupling: false }); const on = S.buildSignals(mol, { freqMHz: f, coupling: true });
    for (let i = 0; i < on.length; i += 1) {
      near(on[i].lines.reduce((s, l) => s + l.area, 0), off[i].lines.reduce((s, l) => s + l.area, 0), 1e-12, "line areas sum");
      near(S.integrateSignal(on[i]), S.integrateSignal(off[i]), 5e-3 * on[i].count, `${mol.id}/${on[i].label} integrated area (analytic Lorentzian tails)`);
      for (const p of [0, 0.25, 0.5, 1]) { const m = S.buildSignals(mol, { freqMHz: f, progress: p })[i]; near(m.lines.reduce((s, l) => s + l.area, 0), on[i].count, 1e-12); near(S.centroidHz(m), on[i].centerHz, 1e-7); }
    }
  }
});
await test("integrals: numerically integrated areas are in exactly the ratio of the H counts", () => {
  for (const mol of MOLECULES) {
    const sig = S.buildSignals(mol, { freqMHz: 400 });
    const areas = sig.map((s) => S.integrateSignal(s));
    sig.forEach((s, i) => near(areas[i] / areas[0], s.count / sig[0].count, 2e-3 * s.count, `${mol.id} ratio`));
    // cumulative integral steps from 0 to the total, monotonic
    const hi = (sig[0].extentHz[1] + 5000); let prev = -1;
    for (let hz = hi; hz > -5000; hz -= 3.3) { const v = S.cumulativeIntegral(sig, hz); assert.ok(v >= prev - 1e-9, "monotonic"); prev = v; }
    near(S.cumulativeIntegral(sig, -1e7), sig.reduce((s, x) => s + x.count, 0), 0.01, "total integral");
    // step heights between multiplets equal the H counts (read in the flat regions between signals)
    for (let i = 0; i < sig.length - 1; i += 1) {
      const gap = (sig[i].extentHz[0] + sig[i + 1].extentHz[1]) / 2;
      near(S.cumulativeIntegral(sig, gap), sig.slice(0, i + 1).reduce((s, x) => s + x.count, 0), 0.08 * sig[i].count + 0.05, `${mol.id} step ${i}`);
    }
  }
});
await test("sampled trace has a point exactly at every line and reproduces its Lorentzian height", () => {
  const mol = getMolecule("ethanol"); const f = 400; const sig = S.buildSignals(mol, { freqMHz: f });
  const view = S.defaultView(mol);
  for (const s of sig) {
    const { ppm, y } = S.sampleSignal(s, view, f, 900);
    assert.ok(ppm.length > 100); for (let i = 1; i < ppm.length; i += 1) assert.ok(ppm[i] < ppm[i - 1], "descending ppm (left to right)");
    for (const l of s.lines) { const k = ppm.findIndex((p) => Math.abs(p - l.ppm) < 1e-9); assert.ok(k >= 0, "line sampled"); near(y[k], S.signalIntensity(s, l.hz), 1e-9); assert.ok(y[k] >= Math.max(...y) * 0.0 && y[k] > 0); }
    assert.ok(Math.max(...y) >= S.lorentzPeak(s.lines[0].area, s.widthHz) * 0.999 / 1);
  }
});

await test("splitting animation stages: area 1 at every phase, centroid fixed, integer phases equal the final multiplets", () => {
  for (const spins of [[], [{ J: 7 }], [{ J: 7 }, { J: 7 }], [{ J: 7 }, { J: 7 }, { J: 7 }], [{ J: 7 }, { J: 7 }, { J: 7 }, { J: 7 }, { J: 7 }, { J: 7 }]]) {
    for (let ph = 0; ph <= spins.length + 1e-9; ph += 0.125) {
      const st = S.splitStage(spins, ph);
      near(st.reduce((s, l) => s + l.rel, 0), 1, 1e-12, "weights"); near(st.reduce((s, l) => s + l.rel * l.offsetHz, 0), 0, 1e-9, "centroid");
      if (Math.abs(ph - Math.round(ph)) < 1e-9) {
        const merged = S.splitOffsets(spins, Math.round(ph), 1); const sum = new Map(); for (const l of st) { const k = Math.round(l.offsetHz * 1e6); sum.set(k, (sum.get(k) ?? 0) + l.rel); }
        assert.equal(sum.size, merged.length); for (const m of merged) near(sum.get(Math.round(m.offsetHz * 1e6)), m.rel, 1e-12);
      }
    }
    assert.equal(S.splittingTree(spins, spins.length).length, spins.length + 1);
  }
});

console.log("Axis and view model");
await test("axis orientation: higher delta on the LEFT, TMS (0 ppm) inside the default view", () => {
  for (const mol of MOLECULES) {
    const v = S.defaultView(mol);
    assert.ok(v.left > v.right); assert.ok(v.right <= 0 && v.left >= 0, "TMS in view");
    assert.ok(S.xOfPpm(v, 3.7, 10, 510) < S.xOfPpm(v, 1.2, 10, 510), "3.7 ppm is left of 1.2 ppm");
    assert.equal(S.xOfPpm(v, v.left, 10, 510), 10); assert.equal(S.xOfPpm(v, v.right, 10, 510), 510);
    near(S.ppmOfX(v, S.xOfPpm(v, 2.2, 10, 510), 10, 510), 2.2, 1e-12);
    for (const e of mol.environments) assert.ok(e.delta < v.left && e.delta > v.right, "all environments inside the default view");
    const sigs = S.buildSignals(mol); assert.deepEqual(sigs.map((s) => s.deltaPpm), [...sigs.map((s) => s.deltaPpm)].sort((a, b) => b - a));
  }
});
await test("zoom / pan / clamp keep left > right, the anchor fixed, and respect limits", () => {
  let v = { left: 6, right: -0.5 };
  const z = S.zoomView(v, 0.5, 3); near(z.left - z.right, 3.25, 1e-9); near((3 - z.right) / (z.left - z.right), (3 - v.right) / (v.left - v.right), 1e-9, "anchor keeps relative position");
  for (let i = 0; i < 40; i += 1) v = S.zoomView(v, 0.5, 2); assert.ok(v.left > v.right); near(v.left - v.right, S.MIN_SPAN_PPM, 1e-9);
  const out = S.zoomView({ left: 6, right: -0.5 }, 100, 3); near(out.left - out.right, S.PPM_LIMITS[1] - S.PPM_LIMITS[0], 1e-9);
  const p = S.panView({ left: 6, right: 0 }, 100); assert.equal(p.left, S.PPM_LIMITS[1]); near(p.left - p.right, 6, 1e-9);
  const t = S.niceTicks({ left: 10, right: -0.5 }, 12); assert.ok(t.ticks[0] > t.ticks[t.ticks.length - 1] && t.ticks.includes(0));
  const sig = S.buildSignals(getMolecule("ethanol"))[0]; const fv = S.viewForSignal(sig); assert.ok(fv.left > sig.extentPpm[1] && fv.right < sig.extentPpm[0]);
  assert.equal(S.fullyVisible(S.buildSignals(getMolecule("ethanol")), fv).length, 1);
  near(S.larmorMHz(9.3944), 400, 0.05);
});

console.log("Linked selection");
await test("env -> multiplet -> atoms and back, for every molecule and environment", () => {
  for (const mol of MOLECULES) {
    for (const e of mol.environments) {
      const sel = L.selectEnvironment(mol, e.id);
      assert.equal(sel.selectedEnvId, e.id); assert.equal(sel.selectedMultipletId, L.multipletIdOfEnv(e.id));
      assert.equal(L.envIdOfMultiplet(sel.selectedMultipletId), e.id);
      const back = L.selectMultiplet(mol, sel.selectedMultipletId); assert.deepEqual(back, sel);
      assert.deepEqual(L.atomsOfEnvironment(mol, e.id), e.atoms);
      // clicking ANY hydrogen of the environment selects the whole environment (all equivalent H highlight)
      for (const h of e.atoms) { assert.deepEqual(L.selectAtom(mol, h), sel); assert.deepEqual(L.highlightModel(mol, L.selectAtom(mol, h).selectedEnvId).hydrogens, e.atoms); }
      for (const c of e.heavyAtoms) assert.equal(L.selectAtom(mol, c).selectedEnvId, mol.atoms[c].hydrogens.length ? mol.envOfAtom[mol.atoms[c].hydrogens[0]] : null);
      // coupled neighbours: symmetric, never include itself or an exchangeable environment
      const coupled = L.coupledEnvironments(mol, e.id);
      assert.ok(!coupled.includes(e.id));
      for (const id of coupled) { assert.ok(L.coupledEnvironments(mol, id).includes(e.id), "coupling is symmetric"); assert.equal(mol.environments.find((x) => x.id === id).exchangeable, false); }
      assert.equal(L.highlightModel(mol, e.id, { showCoupled: true }).coupledHydrogens.length, coupled.reduce((s, id) => s + mol.environments.find((x) => x.id === id).count, 0));
      assert.deepEqual(L.toggleEnvironment(mol, e.id, e.id), L.emptySelection());
    }
    assert.deepEqual(L.selectEnvironment(mol, "zz"), L.emptySelection()); assert.deepEqual(L.selectAtom(mol, 999), L.emptySelection());
  }
  assert.deepEqual(L.reconcileSelection("ethanol", "zz", "m-c").selectedEnvId, "c");
  assert.equal(L.reconcileSelection("methane", "c", "m-c").selectedEnvId, null, "a selection from another molecule is dropped");
});

console.log("Shielding helpers");
await test("density colouring and chemical-shift relationships", () => {
  for (const mol of MOLECULES) for (const a of mol.atoms) { const sc = H.densityScore(mol, a.idx); assert.ok(sc >= 0 && sc <= 1); assert.match(H.densityColor(sc), /^#[0-9a-f]{6}$/); }
  const eth = getMolecule("ethanol");
  const hOf = (label) => eth.environments.find((e) => e.label === label).atoms[0];
  assert.ok(H.densityScore(eth, hOf("CH₃")) < H.densityScore(eth, hOf("CH₂")), "CH3 H is more shielded than CH2 H");
  const O = eth.atoms.findIndex((a) => a.el === "O"); const CH2 = eth.environments.find((e) => e.label === "CH₂").heavyAtoms[0];
  assert.ok(H.polarityIndex(eth, O) < 0, "oxygen is electron-rich"); assert.ok(H.polarityIndex(eth, CH2) > H.polarityIndex(eth, eth.environments.find((e) => e.label === "CH₃").heavyAtoms[0]), "C-O carbon is more electron-poor than the CH3 carbon");
  near(H.deltaFromFrequencies(400.0016e6, 400e6), 4, 1e-6); near(H.offsetHz(3.7, 400), 1480, 1e-9); near(H.nuFromShielding(400, 25e-6), 399.99, 1e-9);
});

console.log("Challenges");
await test("every candidate set has unique signatures (without shifts) and distinct, contained molecules", () => {
  for (const set of C.CANDIDATE_SETS) {
    assert.ok(set.length >= 4); assert.equal(new Set(set).size, set.length);
    for (const id of set) assert.ok(MOLECULE_BY_ID[id]);
    const sigs = set.map((id) => S.spectrumSignature(getMolecule(id))); assert.equal(new Set(sigs).size, set.length, `signatures ${sigs.join(" / ")}`);
  }
  const all = MOLECULES.map((m) => S.spectrumSignature(m, { withShifts: true })); assert.equal(new Set(all).size, MOLECULES.length, "library signatures with shifts are unique");
});
await test("identify questions: deterministic, target in the candidates, correct answer accepted, every wrong candidate explained", () => {
  for (let i = 0; i < 30; i += 1) {
    const q = C.identifyQuestion(i); assert.deepEqual(q, C.identifyQuestion(i)); assert.ok(q.candidates.includes(q.targetId));
    assert.equal(C.checkIdentify(q, q.targetId).correct, true);
    for (const c of q.candidates.filter((x) => x !== q.targetId)) { const r = C.checkIdentify(q, c); assert.equal(r.correct, false); assert.ok(r.discrepancies.length >= 1, `${q.targetId} vs ${c}`); assert.ok(r.explanation.length > 30); }
  }
  assert.ok(new Set(Array.from({ length: 10 }, (_, i) => C.identifyQuestion(i).targetId)).size >= 4, "targets vary");
});
await test("environment-count questions for every molecule (answer = declared environments)", () => {
  for (const mol of MOLECULES) { const q = C.envCountQuestion(mol.id); assert.equal(q.answer, mol.environments.length); assert.ok(q.options.includes(q.answer)); assert.equal(C.checkEnvCount(q, q.answer).correct, true); assert.equal(C.checkEnvCount(q, q.answer + 1).correct, false); assert.ok(C.checkEnvCount(q, 99).explanation.includes(mol.name)); }
});
await test("ratio questions accept proportional whole-number answers, reject wrong/invalid", () => {
  for (const mol of MOLECULES) {
    const q = C.ratioQuestion(mol.id); const counts = S.buildSignals(mol).map((s) => s.count);
    assert.equal(C.checkRatio(q, counts).correct, true); assert.equal(C.checkRatio(q, q.answer).correct, true); assert.equal(C.checkRatio(q, counts.map((c) => c * 2)).correct, true);
    if (counts.length > 1) assert.equal(C.checkRatio(q, [...counts].reverse().map((c, i) => (i === 0 ? c + 1 : c))).correct, false);
    assert.equal(C.checkRatio(q, counts.map(() => 0)).correct, false); assert.equal(C.checkRatio(q, counts.map(() => 1.5)).invalid, true);
  }
  assert.deepEqual(C.ratioQuestion("propane").answer, [1, 3]); assert.deepEqual(C.ratioQuestion("ethanol").answer, [2, 1, 3]);
});
await test("splitting questions for every environment: answer matches the generated multiplet and explains n + 1", () => {
  for (const item of C.ALL_ENV_SPLITTING_ITEMS()) {
    const q = C.splittingQuestion(item.moleculeId, item.envId); const mol = getMolecule(item.moleculeId); const sig = S.buildSignals(mol).find((s) => s.envId === item.envId);
    assert.equal(q.answer, sig.multiplicity.name); assert.equal(C.checkSplitting(q, q.answer).correct, true); assert.equal(C.checkSplitting(q, "decet").correct, false);
    if (sig.multiplicity.nNeighbours) assert.match(q.explanation, new RegExp(`n \\+ 1 = ${sig.multiplicity.nNeighbours + 1}`));
    if (sig.exchangeable) assert.match(q.explanation, /exchange/i);
  }
});


// ======================================================================================================================
// Part 2: jsdom UI tests (no layout, no canvas, no WebGL -> the interactive SVG fallback of the 3D viewer is exercised)
// ======================================================================================================================
import { JSDOM } from "jsdom";
import { register } from "node:module";
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
for (const k of ["window", "document", "HTMLElement", "HTMLInputElement", "HTMLSelectElement", "SVGElement", "Node", "MouseEvent", "KeyboardEvent", "PointerEvent", "Event", "MutationObserver", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"]) {
  try { globalThis[k] = dom.window[k]; } catch { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true }); }
}
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
dom.window.HTMLCanvasElement.prototype.getContext = () => null;
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.IS_REACT_ACT_ENVIRONMENT = false;
register("./jsx-loader-hooks.mjs", import.meta.url);
register("./image-viewer-loader-hooks.mjs", import.meta.url);
const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const { MolecularProcessStage, SpectrumStage, InterpretationStage, SplittingLab } = await import("../src/engines/spectroscopy-studio/nmr/molecular/index.js");
const { clearStageStore } = await import("../src/engines/spectroscopy-studio/nmr/molecular/components/useStageState.js");
const h = React.createElement;
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const $ = (sel) => document.querySelector(sel); const $$ = (sel) => [...document.querySelectorAll(sel)];
const T = (id) => `[data-testid="${id}"]`;
const txt = (sel) => ($(sel)?.textContent ?? "").replace(/\s+/g, " ").trim();
const click = async (sel) => { const el = typeof sel === "string" ? $(sel) : sel; assert.ok(el, `missing ${sel}`); el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); await tick(); };
async function setValue(sel, value) { const el = typeof sel === "string" ? $(sel) : sel; assert.ok(el, `missing ${sel}`); const proto = el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value); el.dispatchEvent(new window.Event(el.tagName === "SELECT" || el.type === "range" ? "change" : "input", { bubbles: true })); if (el.type === "range") el.dispatchEvent(new window.Event("input", { bubbles: true })); await tick(); }
async function until(fn, ms = 3000, label = "condition") { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return; await tick(25); } throw new Error(`timed out waiting for ${label}`); }

let live = null; let studioNow = null;
function Host({ Stage, init }) {
  const [moleculeId, setMoleculeId] = React.useState(init.moleculeId ?? "ethanol");
  const [selectedEnvId, setSelectedEnvId] = React.useState(init.selectedEnvId ?? null);
  const [selectedMultipletId, setSelectedMultipletId] = React.useState(null);
  const [operatingFrequencyMHz, setOperatingFrequencyMHz] = React.useState(init.f ?? 400);
  const [playing, setPlaying] = React.useState(false);
  const [stepRequest, setStep] = React.useState({ n: 0, dir: 1 });
  const [resetToken, setResetToken] = React.useState(0);
  const studio = { moleculeId, setMoleculeId, selectedEnvId, setSelectedEnvId, selectedMultipletId, setSelectedMultipletId, operatingFrequencyMHz, setOperatingFrequencyMHz, b0Tesla: operatingFrequencyMHz / 42.577478, mode: init.mode ?? "student", splitView: false, speed: 1, playing, setPlaying, stepRequest, resetToken, reducedMotion: init.reducedMotion ?? true, containerSize: init.size ?? { width: 1200, height: 700 } };
  studioNow = { ...studio, step: (dir) => setStep((s) => ({ n: s.n + 1, dir })), reset: () => { setResetToken((t) => t + 1); setSelectedEnvId(null); setSelectedMultipletId(null); } };
  return h(Stage, { studio });
}
async function mount(Stage, init = {}) {
  if (live) { live.root.unmount(); live.host.remove(); live = null; }
  clearStageStore();
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  root.render(h(Host, { Stage, init })); live = { root, host };
  await tick(120);
}

console.log("Molecular Process stage (jsdom)");
await test("renders the fallback viewer, formulas and every atom for each molecule; picker switches molecule", async () => {
  await mount(MolecularProcessStage, { moleculeId: "methane" });
  assert.ok($(T("webgl-fallback")), "SVG fallback shown without WebGL");
  for (const mol of MOLECULES) {
    await setValue(T("molecule-search"), ""); await click(T("molecule-search")); // focus opens the list
    $(T("molecule-search")).dispatchEvent(new window.FocusEvent("focus", { bubbles: false }));
    await tick(); await until(() => $(T(`molecule-option-${mol.id}`)), 2000, "option"); await click(T(`molecule-option-${mol.id}`));
    await until(() => $(T("molecular-process-stage"))?.getAttribute("data-molecule") === mol.id, 2000, "molecule switch");
    assert.equal($$("[data-atom]").length, mol.atoms.length, `${mol.id} atoms drawn`);
    assert.equal(txt(T("condensed-formula")), mol.condensed);
  }
});
await test("search finds acetone -> propanone", async () => {
  await mount(MolecularProcessStage, {});
  await click(T("molecule-search")); $(T("molecule-search")).dispatchEvent(new window.FocusEvent("focus")); await setValue(T("molecule-search"), "acetone");
  await until(() => $(T("molecule-option-propanone")), 2000); assert.equal($$('[data-testid^="molecule-option-"]').length, 1);
});
await test("click ANY hydrogen of ANY environment of EVERY molecule: all equivalent H highlight, multiplet id follows, shared state updates", async () => {
  for (const mol of MOLECULES) {
    await mount(MolecularProcessStage, { moleculeId: mol.id });
    for (const env of mol.environments) {
      for (const hIdx of env.atoms) {
        await click(`[data-atom="${hIdx}"]`);
        const lit = $$('[data-atom][data-selected="1"]').map((n) => Number(n.dataset.atom)).sort((a, b) => a - b);
        assert.deepEqual(lit, env.atoms, `${mol.id} env ${env.id} via H${hIdx}`);
        assert.equal(studioNow.selectedEnvId, env.id); assert.equal(studioNow.selectedMultipletId, `m-${env.id}`);
        assert.equal($(T("mol-stage")).getAttribute("data-highlighted"), env.atoms.join(","));
      }
    }
  }
});
await test("student mode: environments are revealed by clicking; reveal-all and hide-all work; teacher mode starts revealed", async () => {
  await mount(MolecularProcessStage, { moleculeId: "ethanol" });
  assert.equal(txt(T("identified-count")), "0 of 3 identified");
  assert.equal($$("[data-env-known]").length, 0);
  const firstH = getMolecule("ethanol").environments[0].atoms[0]; await click(`[data-atom="${firstH}"]`);
  assert.equal(txt(T("identified-count")), "1 of 3 identified");
  await click(T("reveal-all")); assert.equal(txt(T("identified-count")), "3 of 3 identified");
  await click(T("hide-all")); assert.equal(txt(T("identified-count")), "0 of 3 identified");
  await mount(MolecularProcessStage, { moleculeId: "ethanol", mode: "teacher" }); assert.equal(txt(T("identified-count")), "3 of 3 identified"); assert.ok($(T("teacher-compare")));
  await mount(MolecularProcessStage, { moleculeId: "ethanol", mode: "student" }); assert.ok(!$(T("teacher-compare")), "no teacher block in student mode");
});
await test("display toggles (bonds, labels, style), structural formula, predict number of signals with feedback and retry", async () => {
  await mount(MolecularProcessStage, { moleculeId: "propan-2-ol" });
  assert.ok($$("svg line").length > 0, "bonds drawn"); await click(T("opt-bonds")); assert.equal($(T("mol-svg")).querySelectorAll("line").length, 0, "bonds hidden"); await click(T("opt-bonds"));
  assert.ok($(T("mol-svg")).querySelectorAll("text").length > 0); await click(T("opt-labels")); assert.equal($(T("mol-svg")).querySelectorAll("text").length, 0, "labels hidden");
  await click(T("style-density")); assert.ok($(T("density-legend")) && /qualitative/i.test(txt(T("density-legend")))); assert.equal($(T("mol-stage")).getAttribute("data-style"), "density"); await click(T("style-ball"));
  await click(T("formula-structural")); assert.ok(txt(T("structural-formula")).includes("O")); 
  await click(T("predict-2")); await click(T("predict-check")); assert.equal($(T("predict-feedback")).dataset.correct, "0"); assert.match(txt(T("predict-feedback")), /3/);
  await click(T("predict-retry")); await click(T("predict-3")); await click(T("predict-check")); assert.equal($(T("predict-feedback")).dataset.correct, "1");
});
await test("shielding explorer: terms, formula, numbers at the operating frequency, comparison, caution", async () => {
  await mount(MolecularProcessStage, { moleculeId: "ethanol", mode: "teacher", f: 400 });
  await click(T("tab-shield")); assert.ok($(T("shielding-explorer")) && $(T("shield-diagram")) && $(T("shield-ruler")));
  await click(T("shield-chip-a")); const t = txt(T("shield-text"));
  assert.match(t, /3\.7/); assert.match(t, /1480 Hz/); assert.match(t, /B₀ × δ × 10⁻⁶/); assert.match(t, /Shielded/); assert.match(t, /Deshielded/); assert.match(t, /Upfield/); assert.match(t, /downfield/); assert.match(t, /not a rigid shield/i);
  assert.match(txt(T("shield-text")), /ν − ν/); await click(T("compare-c")); assert.ok($(T("shield-diagram")));
  await click(T("ruler-b")); assert.equal(studioNow.selectedEnvId, "b"); assert.match(txt(T("shield-text")), /exchangeable|variable/i);
});

console.log("Spectrum stage (jsdom)");
await test("student: empty spectrum, built environment by environment (uncoupled), then coupled, integration, assignments, axis orientation", async () => {
  await mount(SpectrumStage, { moleculeId: "ethanol" });
  assert.equal($(T("spectrum")).dataset.signals, "0"); assert.ok($(T("spectrum-empty")));
  assert.ok(Number($(T("spectrum")).dataset.viewLeft) > Number($(T("spectrum")).dataset.viewRight), "higher delta on the left"); assert.ok($(T("tms-marker")), "TMS reference labelled");
  await click(T("add-next")); assert.equal($(T("spectrum")).dataset.signals, "1");
  await click(T("add-next")); await click(T("add-next")); assert.equal($(T("spectrum")).dataset.signals, "3"); assert.ok($(T("add-next")).disabled);
  // positions: left to right a (3.7), b (2.6), c (1.2): traces exist for the three envs; labels in the data order
  const xs = ["a", "b", "c"].map((id) => Number($(T(`shift-${id}`)).querySelector("text").getAttribute("x"))); assert.ok(xs[0] < xs[1] && xs[1] < xs[2], "3.7 left of 2.6 left of 1.2");
  assert.ok(!/ · [tqs]$/.test(txt(T("label-a"))), "no multiplicity label while uncoupled");
  await click(T("coupling-on")); await until(() => /· q$/.test(txt(T("label-a"))), 3000, "coupled labels"); assert.match(txt(T("label-c")), /· t$/); assert.match(txt(T("label-b")), /· s$/);
  await click(T("opt-integration")); assert.ok($(T("integration-trace"))); assert.equal(txt(T("integral-a")), "2H"); assert.equal(txt(T("integral-b")), "1H"); assert.equal(txt(T("integral-c")), "3H");
  await click(T("opt-integration")); assert.ok(!$(T("integration-trace")));
  await click(T("opt-assignments")); assert.ok(!$(T("label-a"))); await click(T("opt-assignments")); assert.ok($(T("label-a")));
  assert.match($(T("spectrum-note")).textContent, /Predicted\/idealised spectrum — representative values; not an experimental spectrum/);
});
await test("linked selection both ways for every molecule: peak -> atoms; atom -> peak; chips; coupled neighbours; shift and integral clicks", async () => {
  for (const mol of MOLECULES) {
    await mount(SpectrumStage, { moleculeId: mol.id, mode: "teacher" });
    await click(T("coupling-on")); await tick(60);
    for (const env of mol.environments) {
      if (studioNow.selectedEnvId === env.id) await click(T(`peak-${env.id}`)); // clicking the selected signal toggles it off
      await click(T(`peak-${env.id}`));
      assert.equal(studioNow.selectedEnvId, env.id, `${mol.id} peak -> env`); assert.equal(studioNow.selectedMultipletId, `m-${env.id}`);
      assert.deepEqual($$('[data-atom][data-selected="1"]').map((n) => Number(n.dataset.atom)).sort((a, b) => a - b), env.atoms, `${mol.id} peak -> atoms`);
      assert.equal($(T("spectrum")).dataset.selectedEnv, env.id); assert.ok($(T("band-selected")));
      // and back: a different hydrogen -> its peak
      for (const other of mol.environments) { await click(`[data-atom="${other.atoms[0]}"]`); assert.equal($(T("spectrum")).dataset.selectedEnv, other.id, `${mol.id} atom -> peak`); }
    }
    // splitting click highlights the coupled neighbours in both views
    const withN = mol.environments.find((e) => S.neighbourSets(mol, e.id).length);
    if (withN) {
      await click(T("opt-splitting")); await click(T(`peak-${withN.id}`)); await click(T(`splitting-${withN.id}`));
      const nb = S.neighbourSets(mol, withN.id).map((x) => x.envId);
      for (const id of nb) assert.ok($(T(`band-coupled-${id}`)), `${mol.id} coupled band ${id}`);
      const dashed = $$("[data-atom]").filter((n) => n.querySelectorAll('circle[stroke-dasharray]').length > 0).map((n) => Number(n.dataset.atom));
      for (const id of nb) for (const a of mol.environments.find((e) => e.id === id).atoms) assert.ok(dashed.includes(a), `${mol.id} neighbour atom ${a} outlined`);
      assert.equal($(T("tab-splitting")).getAttribute("aria-pressed"), "true");
    }
    await click(T(`integral-${mol.environments[0].id}`).replace("integral", "shift")); assert.equal($(T("tab-shift")).getAttribute("aria-pressed"), "true"); assert.match(txt(T("shift-panel")), /δ ≈/); assert.match(txt(T("shift-provenance")), /Source:/);
  }
});
await test("zoom, pan and reset change the view window; molecule switch resets it; selected-multiplet zoom", async () => {
  await mount(SpectrumStage, { moleculeId: "ethanol", mode: "teacher" });
  const view = () => [Number($(T("spectrum")).dataset.viewLeft), Number($(T("spectrum")).dataset.viewRight)];
  const v0 = view(); await click(T("sp-zoom-in")); await tick(400); const v1 = view(); assert.ok(v1[0] - v1[1] < v0[0] - v0[1] - 0.5, "zoomed in"); assert.ok(v1[0] > v1[1]);
  await click(T("sp-pan-left")); await tick(400); const v2 = view(); assert.ok(v2[0] > v1[0], "panned towards higher delta"); await click(T("sp-zoom-out")); await tick(400);
  await click(T("sp-reset")); await tick(400); const v3 = view(); near(v3[0], v0[0], 1e-3); near(v3[1], v0[1], 1e-3);
  await click(T("peak-c")); await click(T("sp-fit-selected")); await tick(400); const v4 = view(); assert.ok(v4[0] - v4[1] < 0.5 && v4[0] > 1.2 && v4[1] < 1.2, "zoomed onto the CH3 triplet");
  await click(T("sp-taller")); assert.equal($(T("spectrum")).dataset.yzoom, "1.50");
  $(T("sp-readout")); await click(T("sp-fullscreen")); assert.match($(T("spectrum")).className, /present/); await click(T("sp-fullscreen")); assert.doesNotMatch($(T("spectrum")).className, /present/);
});
await test("area tab: predict the ratio with feedback; step requests walk through the events; reset clears the experiment", async () => {
  await mount(SpectrumStage, { moleculeId: "ethanol" });
  await click(T("show-all")); await click(T("tab-area")); assert.equal(txt(T("area-val-a")), "?");
  for (const [i, v] of ["1", "1", "1"].entries()) await setValue(T(`ratio-in-${i}`), v); await click(T("ratio-check")); assert.equal($(T("ratio-feedback")).dataset.correct, "0");
  for (const [i, v] of ["2", "1", "3"].entries()) await setValue(T(`ratio-in-${i}`), v); await click(T("ratio-check")); assert.equal($(T("ratio-feedback")).dataset.correct, "1"); assert.equal(txt(T("area-val-a")), "2 H");
  await click(T("clear-spectrum")); assert.equal($(T("spectrum")).dataset.signals, "0");
  studioNow.step(1); await tick(80); assert.equal($(T("spectrum")).dataset.signals, "1"); studioNow.step(1); await tick(80); studioNow.step(1); await tick(80);
  studioNow.step(1); await tick(80); assert.equal($(T("coupling-on")).getAttribute("aria-pressed"), "true"); studioNow.step(1); await tick(80); assert.ok($(T("integration-trace")));
  studioNow.step(-1); await tick(80); assert.ok(!$(T("integration-trace"))); studioNow.step(-1); await tick(80); assert.equal($(T("coupling-on")).getAttribute("aria-pressed"), "false");
  studioNow.reset(); await tick(100); assert.equal($(T("spectrum")).dataset.signals, "0", "studio reset restores the empty spectrum");
});
await test("state survives leaving and returning to the stage (module store), and a different molecule has its own progress", async () => {
  await mount(SpectrumStage, { moleculeId: "ethanol" }); await click(T("add-next")); await click(T("coupling-on"));
  live.root.unmount(); live.host.remove(); const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host); live = { root, host }; root.render(h(Host, { Stage: SpectrumStage, init: { moleculeId: "ethanol" } })); await tick(150);
  assert.equal($(T("spectrum")).dataset.signals, "1"); assert.equal($(T("coupling-on")).getAttribute("aria-pressed"), "true");
});
await test("teacher: compare two signals, notes and limitations appear; student does not get the teacher block", async () => {
  await mount(SpectrumStage, { moleculeId: "propan-1-ol", mode: "teacher" }); await click(T("peak-c")); await click(T("tab-splitting"));
  assert.ok($(T("teacher-note"))); assert.ok($(T("first-order-caveat"))); assert.match(txt(T("first-order-caveat")), /first-order approximation/i); assert.match(txt(T("pattern-name")), /sextet/);
  await click(T("cmp-a")); assert.ok($(T("band-compare")));
  await mount(SpectrumStage, { moleculeId: "propan-1-ol", mode: "student" }); await click(T("show-all")); await click(T("peak-c")); await click(T("tab-splitting")); assert.ok(!$(T("teacher-note"))); assert.ok($(T("first-order-caveat")));
});

console.log("Interpretation stage (jsdom)");
await test("challenge 3: wrong and right answers with explanations and retry, for every molecule", async () => {
  for (const mol of MOLECULES) {
    await mount(InterpretationStage, { moleculeId: mol.id });
    const n = mol.environments.length; const wrong = n === 1 ? 2 : 1 + (n % 3 === 0 ? 0 : 0) === n ? n + 1 : 1;
    await click(T(`c3-opt-${wrong === n ? n + 1 : wrong}`)); await click(T("c3-check")); assert.equal($(T("c3-feedback")).dataset.correct, "0", `${mol.id} wrong`);
    await click(T("c3-retry")); assert.ok(!$(T("c3-feedback"))); await click(T(`c3-opt-${n}`)); await click(T("c3-check")); assert.equal($(T("c3-feedback")).dataset.correct, "1"); assert.match(txt(T("c3-feedback")), new RegExp(mol.name));
  }
});
await test("challenge 4: integral readouts are in arbitrary units; ratio answers are checked (any proportional whole numbers)", async () => {
  await mount(InterpretationStage, { moleculeId: "ethanol" }); await click(T("tab-c4"));
  const unit = C.integralUnit("ethanol"); assert.equal(txt(T("integral-a")), (2 * unit).toFixed(1)); assert.equal(txt(T("integral-c")), (3 * unit).toFixed(1));
  assert.ok(!/H$/.test(txt(T("integral-a"))), "no proton counts printed");
  for (const [i, v] of ["3", "3", "3"].entries()) await setValue(T(`c4-in-${i}`), v); await click(T("c4-check")); assert.equal($(T("c4-feedback")).dataset.correct, "0");
  for (const [i, v] of ["4", "2", "6"].entries()) await setValue(T(`c4-in-${i}`), v); await click(T("c4-check")); assert.equal($(T("c4-feedback")).dataset.correct, "1");
  await click(T("c4-retry")); assert.ok(!$(T("c4-feedback")));
});
await test("challenge 5: select an environment, predict its multiplicity, feedback + zoomed multiplet; every molecule/environment", async () => {
  for (const mol of MOLECULES) {
    await mount(InterpretationStage, { moleculeId: mol.id }); await click(T("tab-c5")); assert.ok($(T("c5-prompt")));
    for (const env of mol.environments) {
      await click(T(`c5-env-${env.id}`)); const q = C.splittingQuestion(mol.id, env.id);
      await click(T("c5-opt-decet".replace("decet", q.answer === "singlet" ? "doublet" : "singlet"))); await click(T("c5-check")); assert.equal($(T("c5-feedback")).dataset.correct, "0", `${mol.id}/${env.id} wrong`);
      await click(T(`c5-opt-${q.answer}`)); await click(T("c5-check")); assert.equal($(T("c5-feedback")).dataset.correct, "1", `${mol.id}/${env.id} right`); assert.ok($(T("c5-inset")));
    }
  }
});
await test("challenge 6: identify the molecule: wrong candidate explained, right candidate accepted, retry, new unknown; teacher can reveal", async () => {
  await mount(InterpretationStage, { moleculeId: "ethanol", mode: "teacher" }); await click(T("tab-c6"));
  for (let i = 0; i < 6; i += 1) {
    const q = C.identifyQuestion(i); assert.equal($(T("challenge-6")).dataset.unknown, q.targetId);
    const wrong = q.candidates.find((c) => c !== q.targetId); await click(T(`cand-${wrong}`)); assert.match(txt(T("candidate-prediction")), /would show/); await click(T("c6-check")); assert.equal($(T("c6-feedback")).dataset.correct, "0"); assert.ok(txt(T("c6-feedback")).length > 60);
    await click(T("c6-retry")); await click(T(`cand-${q.targetId}`)); await click(T("c6-check")); assert.equal($(T("c6-feedback")).dataset.correct, "1");
    if (i < 5) await click(T("c6-next"));
  }
  await mount(InterpretationStage, { moleculeId: "ethanol", mode: "student" }); await click(T("tab-c6")); assert.ok(!$(T("challenge-6")).dataset.unknown, "answer not leaked in student mode"); assert.ok(!$(T("c6-reveal")));
});

console.log("Splitting lab (jsdom)");
await test("n + 1 demonstration: 0-3 neighbours give 1-4 lines, Pascal intensities, constant area, J in Hz vs ppm", async () => {
  await mount(SplittingLab, {});
  for (const n of [0, 1, 2, 3]) {
    await click(T(`n-${n}`)); await until(() => $(T("split-diagram")).dataset.lines === String(n + 1), 2000, `lines n=${n}`);
    assert.equal($(T("split-diagram")).dataset.area, "1.000000"); assert.equal(txt(T("st-lines")), String(n + 1)); assert.equal(txt(T("st-pattern")), ["singlet", "doublet", "triplet", "quartet"][n]); assert.equal(txt(T("st-intensities")), S.pascalText(n));
    assert.ok($(T("pascal-bars"))); assert.equal($$('[data-testid^="combo-"]').length, n === 0 ? 1 : n + 1);
  }
  await setValue(T("j-slider"), "10"); assert.equal(txt(T("st-j")), "10 Hz"); assert.equal(txt(T("st-jppm")), "0.0250 ppm");
  await setValue(T("freq-select"), "600"); await until(() => txt(T("st-jppm")) === "0.0167 ppm", 2000, "J in ppm at 600 MHz"); assert.equal(txt(T("st-j")), "10 Hz"); assert.equal(studioNow.operatingFrequencyMHz, 600);
  await click(T("coupling-off")); await until(() => $(T("split-diagram")).dataset.lines === "1", 2000, "single line when coupling off"); assert.equal($(T("split-diagram")).dataset.area, "1.000000");
  await click(T("coupling-on")); await until(() => $(T("split-diagram")).dataset.lines === "4", 2000);
  await click(T("toggle-contrast")); assert.ok($(T("contrast-diagram")));
});
await test("animation is a division: intermediate phases have area 1 and the right number of lines (non-reduced motion)", async () => {
  await mount(SplittingLab, { reducedMotion: false }); await click(T("n-3")); await click(T("coupling-off")); await until(() => $(T("split-diagram")).dataset.phase === "0.000", 4000);
  await click(T("coupling-on")); const seen = new Set();
  for (let i = 0; i < 60 && $(T("split-diagram")).dataset.phase !== "3.000"; i += 1) { const p = Number($(T("split-diagram")).dataset.phase); seen.add(Math.floor(p)); near(Number($(T("split-diagram")).dataset.area), 1, 1e-6); await tick(60); }
  assert.ok(seen.size >= 3, `animated through several phases (${[...seen].join(",")})`);
});
await test("molecule mode: predict -> check -> splitting animates, neighbours outlined; ethanol CH3/CH2, ethyl ethanoate, every environment of every molecule", async () => {
  for (const mol of MOLECULES) {
    await mount(SplittingLab, { moleculeId: mol.id }); await click(T("mode-molecule"));
    for (const env of mol.environments) {
      await click(T(`sl-env-${env.id}`)); const sig = S.buildSignals(mol).find((s) => s.envId === env.id); const q = C.splittingQuestion(mol.id, env.id);
      assert.equal($(T("split-diagram")).dataset.n, String(sig.multiplicity.nNeighbours), `${mol.id}/${env.id} n`);
      const nb = S.neighbourSets(mol, env.id); const dashed = $$("[data-atom]").filter((n) => n.querySelectorAll("circle[stroke-dasharray]").length > 0).map((n) => Number(n.dataset.atom));
      for (const s2 of nb) for (const a of mol.environments.find((e) => e.id === s2.envId).atoms) assert.ok(dashed.includes(a), `${mol.id}/${env.id}: neighbour atom ${a} outlined`);
      await click(T(`pred-${q.answer === "singlet" ? "doublet" : "singlet"}`)); await click(T("pred-check")); assert.equal($(T("pred-feedback")).dataset.correct, "0");
      await until(() => $(T("split-diagram")).dataset.lines === String(sig.multiplicity.nLines), 3000, `${mol.id}/${env.id} lines`); assert.equal($(T("split-diagram")).dataset.area, "1.000000");
      await click(T("pred-retry"));
    }
  }
  await mount(SplittingLab, { moleculeId: "ethanol", mode: "teacher" }); await click(T("mode-molecule")); await click(T("sl-env-b")); assert.match(txt(T("sl-explain")), /exchange/i);
  assert.ok($(T("teacher-limits"))); await click(T("sl-env-c")); studioNow.step(1); await tick(80); studioNow.step(1); await until(() => $(T("split-diagram")).dataset.lines === "3", 2000, "teacher steps to a triplet");
  await mount(SplittingLab, { moleculeId: "ethanol", mode: "student" }); assert.ok(!$(T("teacher-limits")), "advanced notes are teacher-only");
});
await test("studio step requests divide one neighbour at a time; reset restores the singlet", async () => {
  await mount(SplittingLab, { moleculeId: "ethanol" }); await click(T("n-3")); await click(T("coupling-off")); await until(() => $(T("split-diagram")).dataset.lines === "1");
  studioNow.step(1); await until(() => $(T("split-diagram")).dataset.lines === "2"); studioNow.step(1); await until(() => $(T("split-diagram")).dataset.lines === "3"); studioNow.step(-1); await until(() => $(T("split-diagram")).dataset.lines === "2");
  studioNow.reset(); await tick(100); await until(() => $(T("split-diagram")).dataset.lines === "3" || $(T("split-diagram")).dataset.lines === "1");
});
await test("layout is driven by containerSize (narrow container stacks; no window-width assumptions)", async () => {
  await mount(SpectrumStage, { moleculeId: "ethanol", size: { width: 500, height: 800 } }); assert.ok(!$(T("spectrum-stage")).className.includes("nm-wide"));
  await mount(SpectrumStage, { moleculeId: "ethanol", size: { width: 1500, height: 800 } }); assert.ok($(T("spectrum-stage")).className.includes("nm-xwide"));
});
await test("every button has an accessible name; interactive SVG parts are keyboard reachable", async () => {
  for (const [Stage, init] of [[MolecularProcessStage, { moleculeId: "ethanol" }], [SpectrumStage, { moleculeId: "ethanol", mode: "teacher" }], [InterpretationStage, { moleculeId: "ethanol" }], [SplittingLab, { moleculeId: "ethanol" }]]) {
    await mount(Stage, init);
    for (const b of $$("button")) assert.ok((b.getAttribute("aria-label") || b.textContent).trim().length > 0, `unnamed button ${b.outerHTML.slice(0, 80)}`);
    for (const a of $$("[data-atom]")) { assert.equal(a.getAttribute("tabindex"), "0"); assert.ok(a.getAttribute("aria-label")); }
  }
});
if (live) { live.root.unmount(); live.host.remove(); }

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
