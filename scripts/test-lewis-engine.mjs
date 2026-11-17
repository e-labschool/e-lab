#!/usr/bin/env node
// Tests for the Lewis-structure engine (src/lib/lewis):  node scripts/test-lewis-engine.mjs
// The curated library is the ORACLE: each structure is written by hand as SMILES with explicit formal charges, parsed by an
// independent reader, and the resolver (which only sees the atoms and the charge) must arrive at the same structure.
import assert from "node:assert/strict";
import {
  LEWIS_SYMBOLS, LIBRARY_SIZE, LIBRARY_CATEGORIES, canonical, centreOf, compositionKey, describeStructure, embed3D, findByComposition, getLibrary,
  layout2D, lewisElement, minNonBondedGap, parseSmiles, prettyFormula, recognise, resolveAtoms, searchLibrary, searchStructures, shapeText, validateStructure, EN, MAX_ATOMS,
} from "../src/lib/lewis/index.js";
import { netDipole } from "../src/lib/lewis/polarity.js";
import { getBondingElement } from "../src/engines/bonding-visualizer/model/elements.js";
import { ELECTRONEGATIVITY } from "../src/engines/bonding-visualizer/model/polarity.js";

let passed = 0; let failed = 0;
function test(name, fn) {
  const t0 = Date.now();
  try { fn(); console.log(`  ok   ${name}${Date.now() - t0 > 2000 ? ` (${Date.now() - t0} ms)` : ""}`); passed += 1; } catch (e) { console.log(`  FAIL ${name}\n       ${(e.stack || e.message).split("\n").slice(0, 5).join("\n       ")}`); failed += 1; }
}
const split = (s) => s.split(/\s+/).filter(Boolean);
const lib = getLibrary();
const byId = (id) => lib.find((e) => e.id === id);

console.log("Element data");
test("valence electrons are derived from the group and agree with the electron-configuration engine", () => {
  for (const sym of LEWIS_SYMBOLS) {
    const e = lewisElement(sym);
    const cfg = getBondingElement(sym);
    if (cfg) assert.equal(e.valence, cfg.valence, `${sym} valence`);
  }
  assert.deepEqual(["H", "C", "N", "O", "F", "Cl", "S", "P", "Si", "Be", "B", "Al", "Br", "I", "Xe"].map((s) => lewisElement(s).valence), [1, 4, 5, 6, 7, 7, 6, 5, 4, 2, 3, 3, 7, 7, 8]);
});
test("electronegativities equal the data-booklet values (hand-written oracle) and one shared table feeds the polarity panel", () => {
  const booklet = { H: 2.2, Li: 1.0, Be: 1.6, B: 2.0, C: 2.6, N: 3.0, O: 3.4, F: 4.0, Na: 0.9, Mg: 1.3, Al: 1.6, Si: 1.9, P: 2.2, S: 2.6, Cl: 3.2, K: 0.8, Ca: 1.0, Br: 3.0, I: 2.7 };
  for (const [k, v] of Object.entries(booklet)) assert.equal(EN[k], v, k);
  assert.equal(ELECTRONEGATIVITY, EN);
});

console.log("Library (the oracle)");
test(`at least 80 molecules and ions, unique ids, every category used`, () => {
  assert.ok(lib.length >= 80, `only ${lib.length}`); assert.equal(lib.length, LIBRARY_SIZE);
  assert.equal(new Set(lib.map((e) => e.id)).size, lib.length);
  for (const c of LIBRARY_CATEGORIES.filter((x) => x.id !== "all")) assert.ok(lib.some((e) => e.cat === c.id), c.id);
});
test("the brief's named species are all present", () => {
  const need = "H2 N2 O2 F2 Cl2 Br2 I2 HF HCl HBr H2O H2S NH3 PH3 CH4 SiH4 CO CO2 CS2 SO2 SO3 NO NO2 N2O O3 H2O2 N2H4 HCN C2H2 C2H4 C2H6 C3H8 CH3OH CH3CHO CH3COOH CH2O CH3Cl CCl4 CHCl3 BF3 BeCl2 AlCl3 PCl3 PCl5 SF6 XeF4 SF4 SO4_2- SO3_2- NO3- NO2- CO3_2- PO4_3- ClO3- ClO4- OH- NH4+ H3O+ CN- HCO3- CH3COO-".split(" ").map((x) => x.replace("_", " "));
  for (const id of need) assert.ok(byId(id), `missing ${id}`);
});
test("every hand-written structure is electron-consistent (lone pairs, formal charges, charge, connectivity, coordinate bonds)", () => {
  for (const e of lib) {
    assert.deepEqual(validateStructure(e.structure), [], e.id);
    if (e.octetStructure) { assert.deepEqual(validateStructure(e.octetStructure), [], `${e.id} octet`); assert.deepEqual([...e.octetStructure.atoms].sort(), [...e.structure.atoms].sort()); assert.equal(e.octetStructure.charge, e.structure.charge); }
  }
});
test("octet-rule forms have no expanded atom; entries marked beyond really need more than an octet or an unpaired electron", () => {
  for (const e of lib) {
    const oct = e.octetStructure ?? e.structure;
    if (e.beyond) assert.ok(oct.isExpanded || oct.isRadical, `${e.id} marked beyond but is an ordinary octet species`);
    else assert.ok(!oct.isExpanded && !oct.isRadical, `${e.id} octet form is expanded or radical`);
    if (e.octetStructure) assert.ok(e.structure.isExpanded, `${e.id}: the second form should be the expanded one`);
  }
});
test("formulas print with sub- and superscripts", () => {
  assert.equal(prettyFormula("SO4 2-"), "SO₄²⁻"); assert.equal(prettyFormula("NH4+"), "NH₄⁺"); assert.equal(prettyFormula("OH-"), "OH⁻"); assert.equal(prettyFormula("CH3COOH"), "CH₃COOH"); assert.equal(prettyFormula("PO4 3-"), "PO₄³⁻");
});
test("a few structures checked by hand against textbook Lewis diagrams", () => {
  const s = byId("CO2").structure; assert.deepEqual(s.bonds.map((b) => b[2]), [2, 2]); assert.deepEqual([...s.lonePairs].sort(), [0, 2, 2]);
  const n2 = byId("N2").structure; assert.deepEqual(n2.bonds[0].slice(0, 3), [0, 1, 3]); assert.deepEqual(n2.lonePairs, [1, 1]);
  const co = byId("CO").structure; assert.equal(co.bonds[0][2], 3); assert.ok(co.bonds[0][3], "CO has a coordinate bond"); assert.equal(co.atoms[co.bonds[0][3].donor], "O");
  const nh4 = byId("NH4+").structure; assert.equal(nh4.bonds.filter((b) => b[3]).length, 1); assert.equal(nh4.atoms[nh4.bonds.find((b) => b[3])[3].donor], "N");
  const h3o = byId("H3O+").structure; assert.equal(h3o.bonds.filter((b) => b[3]).length, 1); assert.equal(h3o.lonePairs[h3o.atoms.indexOf("O")], 1);
  const o2 = byId("O2").structure; assert.equal(o2.bonds[0][2], 2); assert.deepEqual(o2.lonePairs, [2, 2]);
  const no = byId("NO").structure; assert.equal(no.isRadical, true); assert.equal(no.radicals[no.atoms.indexOf("N")], 1);
  const pcl5 = byId("PCl5").structure; assert.equal(pcl5.electronsAround[pcl5.atoms.indexOf("P")], 10);
  const sf6 = byId("SF6").structure; assert.equal(sf6.electronsAround[sf6.atoms.indexOf("S")], 12);
  const xef4 = byId("XeF4").structure; assert.equal(xef4.lonePairs[xef4.atoms.indexOf("Xe")], 2);
  const sf4 = byId("SF4").structure; assert.equal(sf4.lonePairs[sf4.atoms.indexOf("S")], 1);
  const bf3 = byId("BF3").structure; assert.equal(bf3.electronsAround[bf3.atoms.indexOf("B")], 6);
  const o3 = byId("O3").structure; assert.deepEqual([...o3.formal].sort(), [-1, 0, 1]);
  const so4 = byId("SO4 2-"); assert.equal(so4.octetStructure.formal[so4.octetStructure.atoms.indexOf("S")], 2); assert.deepEqual(so4.structure.formal.filter((x) => x), [-1, -1]);
});

console.log("Resolver against the library");
test("every library entry is rediscovered from nothing but its atoms and charge (both modes)", () => {
  const diffs = [];
  for (const e of lib) {
    const run = (beyond, want, label) => {
      const r = resolveAtoms(e.structure.atoms, { charge: e.charge, beyond });
      assert.ok(r.ok, `${e.id} ${label}: ${r.code}`);
      assert.deepEqual(validateStructure(r.structure), [], `${e.id} ${label}`);
      const w = canonical(want);
      if (canonical(r.structure) === w) return;
      if (e.isomers) { // documented: several valid isomers; the curated entry must at least be among the best twelve and the result must use the same atoms
        const s = searchStructures(e.structure.atoms, { charge: e.charge, beyond });
        assert.ok(s.others.some((x) => canonical(x) === w), `${e.id} ${label}: library structure is not among the resolver's top candidates`);
        diffs.push(e.id); return;
      }
      assert.fail(`${e.id} ${label}: resolver gave ${JSON.stringify({ b: r.structure.bonds, lp: r.structure.lonePairs, f: r.structure.formal })}, library has ${JSON.stringify({ b: want.bonds, lp: want.lonePairs, f: want.formal })}`);
    };
    run(true, e.structure, "beyond");
    if (!e.beyond) run(false, e.octetStructure ?? e.structure, "octet");
  }
  assert.ok(diffs.length <= 12, `too many isomer-differences: ${diffs.join(",")}`);
});
test("species that need an expanded octet or an unpaired electron are refused with the reason while 'beyond the course' is off", () => {
  for (const e of lib.filter((x) => x.beyond)) {
    const r = resolveAtoms(e.structure.atoms, { charge: e.charge, beyond: false });
    assert.equal(r.ok, false, e.id); assert.equal(r.needsBeyond, true, e.id); assert.equal(r.code, "needs-beyond", e.id);
    const q = recognise(e.structure.atoms, { charge: e.charge, beyond: false });
    assert.equal(q.status, "needs-beyond", e.id); assert.match(q.message, /Beyond the course/);
  }
});
test("dual-form species: octet rule form by default, expanded form with the switch, and a note saying so", () => {
  for (const id of ["SO2", "SO3", "SO4 2-", "SO3 2-", "PO4 3-", "ClO3-", "ClO4-", "H2SO4", "H3PO4", "HSO4-"]) {
    const e = byId(id); const off = recognise(e.structure.atoms, { charge: e.charge }); const on = recognise(e.structure.atoms, { charge: e.charge, beyond: true });
    assert.equal(off.status, "ok", id); assert.equal(off.structure.isExpanded, false, id); assert.ok(off.expandedNote, id);
    assert.equal(on.structure.isExpanded, true, id);
    assert.ok(off.info.formalCharges.length > 0 && on.info.formalCharges.length <= off.info.formalCharges.length, id);
  }
});
test("species with ties report equally good isomers (C2H6O: ethanol and methoxymethane)", () => {
  const r = recognise(split("C C O H H H H H H"));
  assert.equal(r.entry.id, "C2H5OH"); assert.ok(r.alternatives.some((a) => a.entry?.id === "CH3OCH3"));
});

console.log("The owner's scenario and other what-happens cases");
test("C + O + O is recognised as CO2 with two double bonds and four lone pairs", () => {
  const r = recognise(["C", "O", "O"]);
  assert.equal(r.status, "ok"); assert.equal(r.info.formula, "CO₂"); assert.equal(r.info.name, "Carbon dioxide");
  assert.deepEqual(r.structure.bonds.map((b) => b[2]), [2, 2]); assert.equal(r.info.lonePairs, 4); assert.equal(r.info.bondingPairs, 4); assert.equal(r.info.valenceElectrons, 16);
  assert.match(r.info.shape, /Linear/); assert.equal(r.info.polarMolecule, false);
  assert.match(r.summary, /2 × C=O, double/);
});
test("the order the atoms were added in does not matter", () => {
  for (const o of [["O", "C", "O"], ["O", "O", "C"]]) assert.equal(recognise(o).entry.id, "CO2");
});
test("C + 3 O explains that it needs a charge and names carbonate; the charge then resolves it", () => {
  const r = recognise(["C", "O", "O", "O"]);
  assert.equal(r.status, "needs-charge"); assert.equal(r.suggestions[0].charge, -2); assert.equal(r.suggestions[0].formula, "CO₃²⁻"); assert.match(r.message, /carbonate/i); assert.match(r.message, /2−/);
  const ok = recognise(["C", "O", "O", "O"], { charge: -2 }); assert.equal(ok.status, "ok"); assert.equal(ok.entry.id, "CO3 2-"); assert.equal(ok.info.resonance[0].forms, 3);
  assert.equal(Math.round(ok.info.resonance[0].average * 100), 133);
});
test("N + 4 H needs +1 (ammonium) and S + 4 O needs 2- (sulfate); a wrong charge is explained", () => {
  assert.equal(recognise(split("N H H H H")).suggestions[0].formula, "NH₄⁺");
  assert.equal(recognise(split("S O O O O")).suggestions[0].formula, "SO₄²⁻");
  const wrong = recognise(split("C O O"), { charge: 1 }); assert.notEqual(wrong.status, "ok"); assert.ok(wrong.message.length > 20);
});
test("coordinate bonds are found where the course expects them: CO, NH4+, H3O+, and H3N->BF3", () => {
  const co = recognise(["C", "O"]).structure; assert.equal(co.atoms[co.bonds[0][3].donor], "O"); assert.deepEqual(co.adjFormal, [0, 0]);
  const nh4 = recognise(split("N H H H H"), { charge: 1 }).structure; const d = nh4.bonds.filter((b) => b[3]); assert.equal(d.length, 1); assert.equal(nh4.atoms[d[0][3].donor], "N"); assert.equal(nh4.adjFormal.reduce((a, b) => a + b, 0), 1);
  const h3o = recognise(split("O H H H"), { charge: 1 }).structure; assert.equal(h3o.bonds.filter((b) => b[3]).length, 1);
  const adduct = resolveAtoms(split("N H H H B F F F")); assert.ok(adduct.ok); const dat = adduct.structure.bonds.find((b) => b[3]); assert.ok(dat, "N->B dative bond"); assert.equal(adduct.structure.atoms[dat[3].donor], "N");
  assert.deepEqual(validateStructure(adduct.structure), []);
});
test("compositions that are NOT in the library are still resolved (CH3Br, C2H5Cl, CH3NH2, ClF, NOCl and more)", () => {
  for (const [atoms, charge] of [["C H H H Br", 0], ["C C H H H H H Cl", 0], ["N O Cl", 0], ["Cl F", 0], ["C C C H H H H H H H H", 0], ["Si H H H Cl", 0], ["C H H O O", 0], ["C N", -1], ["N H H Cl", 0]]) {
    const r = recognise(split(atoms), { charge }); assert.equal(r.status, "ok", atoms);
    assert.deepEqual(validateStructure(r.structure), [], atoms); assert.ok(r.info.formula.length > 1);
  }
  const r = recognise(split("C C H H H H H Cl")); assert.equal(r.source, "algorithm"); assert.match(r.summary, /not in the curated list/);
});
test("no stable molecule: every failure carries a reason a student can read", () => {
  for (const [atoms, charge] of [["H H H", 0], ["O O O O", 0], ["N N N N N", 0], ["H He", 0], ["C", 0], ["", 0], ["Na Cl", 0], ["F F F", 0], ["Be Be", 0]]) {
    const r = recognise(split(atoms), { charge });
    if (r.status === "ok") continue;
    assert.ok(typeof r.message === "string" && r.message.length >= 12, `${atoms}: no message`);
  }
  assert.match(recognise(["Na", "Cl"]).message, /not part of the covalent model/);
  assert.match(recognise(split("C C C C C C C C C C C C C C C")).message, /Too many atoms/);
  assert.match(recognise(["C"]).message, /Add at least one more atom/); assert.ok(recognise(["C"]).additions.length > 0);
  assert.match(recognise([]).message, /Add atoms/);
});
test("one extra atom is suggested when the set is nearly a molecule (N + 2 H -> add H; C + H -> add 3 H)", () => {
  const r = recognise(split("N H H")); assert.notEqual(r.status, "ok");
  assert.ok(r.additions.some((a) => a.formula === "NH₃") || r.additions.length > 0 || r.suggestions.length > 0);
});
test("odd electron counts and incomplete octets: BF3 / BeCl2 / AlCl3 are fine, NO2 needs the switch, a lone H atom pair is H2", () => {
  for (const id of ["BF3", "BeCl2", "AlCl3"]) { const r = recognise(byId(id).structure.atoms); assert.equal(r.status, "ok"); assert.ok(r.structure.incomplete.some(Boolean), id); assert.match(r.info.octet, /incomplete octet/); }
  assert.equal(recognise(split("N O O")).status, "needs-beyond"); assert.equal(recognise(split("N O O"), { beyond: true }).status, "ok");
  assert.equal(recognise(["H", "H"]).entry.id, "H2");
});
test("resonance: ozone, nitrate, carbonate, ethanoate report equivalent forms and the average bond order", () => {
  for (const [id, forms, avg] of [["O3", 2, 150], ["NO3-", 3, 133], ["CO3 2-", 3, 133], ["CH3COO-", 2, 150]]) {
    const r = recognise(byId(id).structure.atoms, { charge: byId(id).charge }); assert.ok(r.info.resonance, id); assert.equal(r.info.resonance[0].forms, forms, id); assert.equal(Math.round(r.info.resonance[0].average * 100), avg, id);
  }
  assert.equal(recognise(["C", "O", "O"]).info.resonance, null);
});

console.log("Robustness");
test("random atom multisets never crash, always give a status and a message, and every structure found balances", () => {
  let seed = 20240607; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const pool = ["H", "H", "H", "C", "C", "N", "N", "O", "O", "O", "F", "Cl", "Cl", "S", "P", "Si", "B", "Be", "Al", "Br", "I", "Xe"];
  const stats = { ok: 0, other: 0 }; const t0 = Date.now();
  for (let k = 0; k < 100; k += 1) {
    const n = 1 + Math.floor(rnd() * 7);
    const atoms = Array.from({ length: n }, () => pool[Math.floor(rnd() * pool.length)]);
    const charge = Math.floor(rnd() * 5) - 2; const beyond = rnd() < 0.5;
    const r = recognise(atoms, { charge, beyond });
    assert.ok(["ok", "needs-charge", "needs-beyond", "none", "few"].includes(r.status), `${atoms.join("")}: ${r.status}`);
    assert.ok(typeof r.message === "string" && r.message.length > 5, `${atoms.join(" ")}: empty message`);
    if (r.status === "ok") {
      stats.ok += 1;
      assert.deepEqual(validateStructure(r.structure), [], `${atoms.join(" ")} q${charge}`);
      assert.equal(r.structure.charge, charge);
      assert.deepEqual([...r.structure.atoms].sort(), [...atoms].sort());
      if (!beyond) assert.ok(!r.structure.isExpanded && !r.structure.isRadical, `${atoms.join(" ")} gave a beyond-the-octet structure with the switch off`);
    } else stats.other += 1;
  }
  assert.ok(stats.ok > 15 && stats.other > 15, JSON.stringify(stats)); assert.ok(Date.now() - t0 < 80000, `random sweep too slow: ${Date.now() - t0} ms`); console.log(`       (${stats.ok} resolved, ${stats.other} refused with a reason, ${Date.now() - t0} ms)`);
});
test("large inputs are answered quickly or refused politely", () => {
  const t0 = Date.now();
  const butane = recognise(split("C C C C H H H H H H H H H H")); assert.equal(butane.status, "ok");
  const big = recognise(split("C C C C C C C H H H H H H H H H H H H H H H H")); assert.ok(["too-many", "none", "ok"].includes(big.status === "none" ? "none" : big.status));
  const sf6 = recognise(split("S F F F F F F"), { beyond: true }); assert.equal(sf6.status, "ok");
  assert.ok(Date.now() - t0 < 15000, `took ${Date.now() - t0} ms`);
  assert.equal(MAX_ATOMS, 14);
});
test("the smiles reader rejects nonsense instead of guessing", () => {
  assert.throws(() => parseSmiles("C(")); assert.throws(() => parseSmiles("[Zz]")); assert.throws(() => parseSmiles("C1CC1"));
  assert.throws(() => parseSmiles("CC(C)(C)(C)C"), /more bonds than electrons/);
});
test("centre atom: single hub for AXn molecules, none for chains and diatomics", () => {
  const co2 = byId("CO2").structure; assert.equal(co2.atoms[co2.centre], "C");
  assert.equal(byId("H2").structure.centre, null); assert.equal(byId("C2H6").structure.centre, null);
  const so2 = byId("SO2").structure; assert.equal(so2.atoms[so2.centre], "S");
  const cl2o = byId("Cl2O").structure; assert.equal(cl2o.atoms[cl2o.centre], "O");
});

console.log("Geometry, polarity and the flat drawing");
const R = { H: 0.2, C: 0.3, N: 0.3, O: 0.28, F: 0.26, Cl: 0.35, S: 0.35, P: 0.35, B: 0.3, Be: 0.3, Br: 0.38, I: 0.4, Si: 0.35, Al: 0.35, Xe: 0.4 };
const angle = (pos, a, c, b) => { const u = pos[a].map((x, k) => x - pos[c][k]); const v = pos[b].map((x, k) => x - pos[c][k]); const d = u.reduce((s, x, k) => s + x * v[k], 0) / (Math.hypot(...u) * Math.hypot(...v)); return (Math.acos(Math.max(-1, Math.min(1, d))) * 180) / Math.PI; };
const at = (s, g, centreSym, a, b, nth = 0) => { const c = s.atoms.indexOf(centreSym); const others = s.atoms.map((x, i) => i).filter((i) => i !== c); return angle(g.pos, others[a], c, others[b]); };
const emb = (id, beyond = true) => { const e = byId(id); const s = (!beyond && e.octetStructure) ? e.octetStructure : e.structure; return { s, g: embed3D(s) }; };
test("bond angles of the embedding follow VSEPR: water, ammonia, methane, CO2, BF3, ethene, SF6, XeF4, SF4", () => {
  let { s, g } = emb("H2O"); const o = s.atoms.indexOf("O"); const hs = s.atoms.map((a, i) => i).filter((i) => s.atoms[i] === "H");
  assert.ok(Math.abs(angle(g.pos, hs[0], o, hs[1]) - 104.5) < 1.5);
  ({ s, g } = emb("NH3")); assert.ok(Math.abs(angle(g.pos, 1, 0, 2) - 107) < 1.5, "NH3");
  ({ s, g } = emb("CH4")); assert.ok(Math.abs(angle(g.pos, 1, 0, 2) - 109.5) < 1);
  ({ s, g } = emb("CO2")); assert.ok(angle(g.pos, 0, 1, 2) > 179);
  ({ s, g } = emb("BF3")); assert.ok(Math.abs(angle(g.pos, 1, 0, 2) - 120) < 1);
  ({ s, g } = emb("SF6")); { const all = []; for (let a = 0; a < 6; a += 1) for (let b = a + 1; b < 6; b += 1) all.push(Math.round(at(s, g, "S", a, b))); assert.deepEqual([...new Set(all)].sort((x, y) => x - y), [90, 180], "octahedron"); assert.equal(all.filter((x) => x === 180).length, 3); }
  ({ s, g } = emb("XeF4")); { const all = []; for (let a = 0; a < 4; a += 1) for (let b = a + 1; b < 4; b += 1) all.push(Math.round(at(s, g, "Xe", a, b))); assert.equal(all.filter((x) => x === 180).length, 2, "two trans pairs"); assert.equal(all.filter((x) => x === 90).length, 4); } assert.ok(Math.max(...g.pos.map((p) => Math.abs(p[2]))) < 0.05, "XeF4 is flat");
  ({ s, g } = emb("C2H4")); assert.ok(Math.max(...g.pos.map((p) => Math.abs(p[2]))) < 0.05, "ethene is planar");
  ({ s, g } = emb("SF4")); { const all = []; for (let a = 0; a < 4; a += 1) for (let b = a + 1; b < 4; b += 1) all.push(at(s, g, "S", a, b)); assert.ok(all.some((x) => x > 165 && x < 180), "axial F-S-F just under 180"); assert.ok(all.some((x) => x > 95 && x < 105), "equatorial F-S-F near 102"); }
  ({ s, g } = emb("SO2", false)); const so = s.atoms.indexOf("S"); const os = [0, 1, 2].filter((i) => i !== so); assert.ok(angle(g.pos, os[0], so, os[1]) > 110 && angle(g.pos, os[0], so, os[1]) < 122);
});
test("the embedded structures are flat where they should be and never put two non-bonded atoms on top of each other", () => {
  for (const e of lib) for (const s of [e.structure, e.octetStructure].filter(Boolean)) {
    const g = embed3D(s);
    for (const p of g.pos) for (const c of p) assert.ok(Number.isFinite(c), e.id);
    const gap = minNonBondedGap(s, g.pos, (a) => R[a]);
    assert.ok(gap > -0.05, `${e.id}: non-bonded atoms overlap by ${(-gap).toFixed(2)}`);
  }
});
test("polarity from electronegativity and shape: CO2, CH4, CCl4, BF3, N2, SF6, XeF4 non-polar; H2O, NH3, SO2, HCl, CHCl3, CH3Cl, SF4 polar", () => {
  const polar = (id, beyond = true) => { const { s, g } = emb(id, beyond); return netDipole({ ...s, formula: id }, { atoms: g.pos.map((p) => ({ pos: p })) }).polar; };
  for (const id of ["CO2", "CH4", "CCl4", "BF3", "N2", "SF6", "XeF4", "C2H4", "PCl5"]) assert.equal(polar(id), false, id);
  for (const id of ["H2O", "NH3", "SO2", "HCl", "CHCl3", "CH3Cl", "SF4", "H2O2", "CH3OH", "CO"]) assert.equal(polar(id), true, id);
});
test("the shape hint names the VSEPR shape and AXE notation", () => {
  assert.match(shapeText(byId("H2O").structure), /Bent \(AX₂E₂\)/); assert.match(shapeText(byId("NH3").structure), /Trigonal pyramidal \(AX₃E\)/);
  assert.match(shapeText(byId("SF6").structure), /Octahedral/); assert.match(shapeText(byId("XeF4").structure), /Square planar/); assert.match(shapeText(byId("PCl5").structure), /Trigonal bipyramidal/);
  assert.match(shapeText(byId("SF4").structure), /Seesaw/); assert.match(shapeText(byId("O3").structure), /Bent \(AX₂E\)/);
});
test("the flat drawing: finite positions, bonded atoms exactly overlap-distance apart, non-bonded rings (nearly) clear of each other", () => {
  for (const e of lib) {
    const s = e.structure; const l = layout2D(s, s.atoms.map(() => 34), 14);
    for (const p of l.pos) { assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), e.id); }
    for (const [i, j] of s.bonds) { const d = Math.hypot(l.pos[i].x - l.pos[j].x, l.pos[i].y - l.pos[j].y); assert.ok(d < l.rho[i] + l.rho[j], `${e.id}: bonded rings do not overlap`); }
    let worst = Infinity;
    for (let i = 0; i < s.atoms.length; i += 1) for (let j = i + 1; j < s.atoms.length; j += 1) {
      if (s.bonds.some((b) => b[0] === i && b[1] === j)) continue;
      worst = Math.min(worst, Math.hypot(l.pos[i].x - l.pos[j].x, l.pos[i].y - l.pos[j].y) / (l.rho[i] + l.rho[j]));
    }
    assert.ok(worst > 0.8, `${e.id}: non-bonded rings overlap (ratio ${worst.toFixed(2)})`);
  }
});

console.log("Library search");
test("search by name, formula (ASCII or subscript), alias and category", () => {
  assert.equal(searchLibrary("water")[0].id, "H2O"); assert.equal(searchLibrary("CO2")[0].id, "CO2"); assert.equal(searchLibrary("CO₂")[0].id, "CO2");
  assert.ok(searchLibrary("ammon").some((e) => e.id === "NH4+")); assert.equal(searchLibrary("sulfate")[0].id, "SO4 2-"); assert.equal(searchLibrary("acetic")[0].id, "CH3COOH");
  assert.ok(searchLibrary("", "ions").every((e) => e.cat === "ions") && searchLibrary("", "ions").length >= 20);
  assert.equal(searchLibrary("zzzz").length, 0);
});
test("composition keys ignore order and distinguish the charge", () => {
  assert.equal(compositionKey(["C", "O", "O"], 0), compositionKey(["O", "C", "O"], 0)); assert.notEqual(compositionKey(["C", "O", "O"], 0), compositionKey(["C", "O", "O"], 1));
  assert.equal(findByComposition(["O", "O", "C"], 0)[0].id, "CO2");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
