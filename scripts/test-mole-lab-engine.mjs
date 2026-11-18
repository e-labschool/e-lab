#!/usr/bin/env node
// Pure-engine tests for the Mole Lab (no React, no three.js):  node scripts/test-mole-lab-engine.mjs
// Covers spec Part J (packet quantities, composition, mass, concentration, dilution, gas, limiting reagent, conservation)
// plus data integrity of every substance / reaction and the numeric-hygiene rules of Part A.
import assert from "node:assert/strict";
import * as E from "../src/engines/mole-lab/engine/index.js";
import { ABUNDANCE } from "../src/lib/atomic/abundance.js";
import { CODATA } from "../src/lib/atomic/constants.js";

let passed = 0; let failed = 0;
function test(name, fn) { try { fn(); console.log(`  ok   ${name}`); passed += 1; } catch (e) { console.log(`  FAIL ${name}\n       ${(e.stack || e.message).split("\n").slice(0, 5).join("\n       ")}`); failed += 1; } }
const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} !~ ${b}`);
const Q = E.toQuanta;

console.log("A1 / A5 constants and molar-mass policy");
test("Avogadro is the exact SI value and shared with src/lib/atomic", () => { assert.equal(E.AVOGADRO, 6.02214076e23); assert.equal(E.AVOGADRO, CODATA.NA); });
test("display strings: 1 mole = 6.022 × 10²³ specified entities", () => { assert.equal(E.MOLE_DEFINITION, "1 mole = 6.022 × 10²³ specified entities"); assert.equal(E.fmtSci(E.AVOGADRO), "6.022 × 10²³"); });
test("R = 8.314462618 and equals N_A k_B within rounding", () => { assert.equal(E.GAS_CONSTANT_R, 8.314462618); near(E.GAS_CONSTANT_R, E.AVOGADRO * 1.380649e-23, 1e-8); });
test("DEFAULT policy is the IB data booklet: Mg = 24.31, NaOH = 40.00, H2O = 18.02, nothing simplified", () => {
  assert.equal(E.DEFAULT_POLICY, "booklet"); assert.equal(E.molarMass("Mg"), 24.31); assert.equal(E.molarMass("NaOH"), 40); assert.equal(E.molarMass("H2O"), 18.02);
  for (const [el, m] of Object.entries({ H: 1.01, C: 12.01, N: 14.01, O: 16.0, Na: 22.99, Cl: 35.45 })) assert.equal(E.atomicMass(el), m, el);
  assert.deepEqual(E.simplifiedElements("Mg"), []);
});
test("explicit teaching policy: Mg = 24.0 (simplified, flagged), NaOH = 40.00 (kept for tests, never the default)", () => {
  assert.equal(E.molarMass("Mg", "teaching"), 24); assert.equal(E.molarMass("NaOH", "teaching"), 40);
  assert.equal(E.ELEMENTS.Mg.simplifiedTeaching, true); assert.deepEqual(E.simplifiedElements("Mg", "teaching"), ["Mg"]); assert.deepEqual(E.simplifiedElements("NaOH", "teaching"), []);
  assert.deepEqual(E.simplifiedElements("Mg", "precise"), []);
});
test("precise policy is explicit: Mg 24.305, H2O 18.015, and differs from teaching", () => { assert.equal(E.molarMass("Mg", "precise"), 24.305); assert.equal(E.molarMass("H2O", "precise"), 18.015); assert.notEqual(E.molarMass("H2O"), E.molarMass("H2O", "precise")); });
test("teaching table agrees with the shared Ar table (src/lib/atomic/abundance.js) except the declared simplification", () => {
  for (const a of Object.values(ABUNDANCE)) { const el = E.ELEMENTS[a.symbol]; if (!el) continue; if (el.simplifiedTeaching) continue; assert.equal(el.masses.teaching, a.ar, a.symbol); }
});
test("unknown policy / element throw instead of falling back silently", () => { assert.throws(() => E.atomicMass("H", "rounded")); assert.throws(() => E.atomicMass("Xx")); assert.throws(() => E.getSubstance("nope")); });
test("molar masses of common substances (teaching)", () => { near(E.molarMass("CO2"), 44.01); near(E.molarMass("NH3"), 17.04); near(E.molarMass("NaCl"), 58.44); near(E.molarMass("MgO", "teaching"), 40); near(E.molarMass("MgO"), 40.31); near(E.molarMass("Fe"), 55.85); near(E.molarMass("O2"), 32); near(E.molarMass("H2"), 2.02); });

console.log("Substance data / A3 geometry");
test("every substance formula parses and the table composition matches", () => { for (const s of E.SUBSTANCE_LIST) assert.deepEqual(s.composition, E.parseFormula(s.formula), s.id); });
test("ionic substances: ions sum to the formula and are charge neutral", () => {
  for (const s of E.SUBSTANCE_LIST.filter((x) => x.ions)) {
    const atoms = {}; let charge = 0;
    for (const i of s.ions) { charge += i.charge * i.count; for (const [el, c] of Object.entries(i.composition)) atoms[el] = (atoms[el] || 0) + c * i.count; }
    assert.equal(charge, 0, `${s.id} charge`); assert.deepEqual(atoms, s.composition, `${s.id} atoms`);
  }
});
test("H2O is bent, H-O-H ≈ 104.5° computed from coordinates; O-H 0.957 Å", () => { const g = E.getSubstance("H2O").geometry; near(E.angleAt(g.atoms, 1, 0, 2), 104.5, 1e-6); near(E.distance(g.atoms, 0, 1), 0.957, 1e-9); });
test("CO2 linear 180°, C=O double bonds", () => { const g = E.getSubstance("CO2").geometry; near(E.angleAt(g.atoms, 1, 0, 2), 180, 1e-6); assert.ok(g.bonds.every((b) => b.order === 2)); });
test("NH3 trigonal pyramidal: three equal H-N-H angles ≈107°, N above the H plane", () => {
  const g = E.getSubstance("NH3").geometry; near(E.angleAt(g.atoms, 1, 0, 2), 107, 1e-6); near(E.angleAt(g.atoms, 1, 0, 3), 107, 1e-6); near(E.angleAt(g.atoms, 2, 0, 3), 107, 1e-6);
  assert.ok(g.atoms.slice(1).every((a) => a.y < -0.2), "H atoms below N: pyramid, not planar");
});
test("CH4 tetrahedral: six H-C-H angles ≈109.47°", () => { const g = E.getSubstance("CH4").geometry; for (let i = 1; i < 5; i += 1) for (let j = i + 1; j < 5; j += 1) near(E.angleAt(g.atoms, i, 0, j), 109.4712206, 1e-4); });
test("H2, O2, N2 diatomic with bond orders 1, 2, 3", () => { assert.deepEqual(["H2", "O2", "N2"].map((id) => E.getSubstance(id).geometry.bonds[0].order), [1, 2, 3]); assert.ok(["H2", "O2", "N2"].every((id) => E.getSubstance(id).geometry.atoms.length === 2)); });
test("NaCl / NaOH / MgO are ionic lattices of the right ions; Mg, Fe, Na metallic with no molecules", () => {
  assert.deepEqual(E.getSubstance("NaCl").ions.map((i) => i.label), ["Na⁺", "Cl⁻"]); assert.deepEqual(E.getSubstance("NaOH").ions.map((i) => i.label), ["Na⁺", "OH⁻"]); assert.deepEqual(E.getSubstance("MgO").ions.map((i) => i.label), ["Mg²⁺", "O²⁻"]);
  for (const id of ["Mg", "Fe", "Na"]) { const s = E.getSubstance(id); assert.equal(s.kind, "metallic"); assert.equal(s.entity.kind, "atom"); assert.equal(s.geometry.atoms.length, 1); assert.ok(s.lattice.type); }
});
test("NaOH(aq) is hydrated ions only, never intact molecules, and not selectable in Stage 1/2", () => { const s = E.getSubstance("NaOH_aq"); assert.equal(s.kind, "aqueous-ionic"); assert.equal(s.lattice, null); assert.ok(!E.SELECTABLE_IDS.includes("NaOH_aq")); assert.deepEqual(s.ions.map((i) => i.label), ["Na⁺", "OH⁻"]); });
test("entity types follow A1: Fe atoms, H2O molecules, NaOH formula units", () => { assert.equal(E.getSubstance("Fe").entity.plural, "atoms"); assert.equal(E.getSubstance("H2O").entity.plural, "molecules"); assert.equal(E.getSubstance("NaOH").entity.plural, "formula units"); });
test("selector starts with H2O", () => { assert.equal(E.SELECTABLE_IDS[0], "H2O"); });
test("crystal fragments: rock salt alternates species; bcc nearest-neighbour distance = 1", () => {
  const rs = E.rockSaltFragment(3, 3, 3); assert.equal(rs.length, 27); for (const p of rs) for (const q of rs) if (Math.abs(p.x - q.x) + Math.abs(p.y - q.y) + Math.abs(p.z - q.z) === 1) assert.notEqual(p.species, q.species);
  const bcc = E.bccFragment(2); let min = Infinity; for (let i = 0; i < bcc.length; i += 1) for (let j = i + 1; j < bcc.length; j += 1) min = Math.min(min, Math.hypot(bcc[i].x - bcc[j].x, bcc[i].y - bcc[j].y, bcc[i].z - bcc[j].z)); near(min, 1, 1e-9);
  const hcp = E.hcpFragment(3, 3, 3); min = Infinity; for (let i = 0; i < hcp.length; i += 1) for (let j = i + 1; j < hcp.length; j += 1) min = Math.min(min, Math.hypot(hcp[i].x - hcp[j].x, hcp[i].y - hcp[j].y, hcp[i].z - hcp[j].z)); near(min, 1, 1e-9);
});

console.log("Numeric hygiene (A6)");
test("no 0.30000000000000004: quanta addition is exact and fromQuanta is clean", () => { assert.equal(E.fromQuanta(Q(0.1) + Q(0.2)), 0.3); assert.equal(E.clean(0.1 + 0.2), 0.3); assert.equal(E.fromQuanta(Q(0.7) + Q(0.1)), 0.8); });
test("clean snaps tiny residue to 0", () => { assert.equal(E.clean(1e-15), 0); assert.equal(E.clean(-3e-14), 0); assert.equal(E.clean(1.2345678901234), 1.23456789012); });
test("formatting: fmtMol / fmtFixed never produce -0 or float noise", () => { assert.equal(E.fmtMol(0.1 + 0.2), "0.30"); assert.equal(E.fmtMol(0), "0.00"); assert.equal(E.fmtMol(1 / 3), "0.333"); assert.equal(E.fmtFixed(-0.0001, 2), "0.00"); assert.equal(E.fmtMol(2.5), "2.50"); });
test("parseNumberInput: negatives, text, empty, decimals, comma, zero rules", () => {
  assert.equal(E.parseNumberInput("-3").ok, false); assert.equal(E.parseNumberInput("abc").ok, false); assert.equal(E.parseNumberInput("").ok, false); assert.equal(E.parseNumberInput("1e999").ok, false); assert.equal(E.parseNumberInput("NaN").ok, false); assert.equal(E.parseNumberInput("Infinity").ok, false);
  assert.equal(E.parseNumberInput("0").value, 0); assert.equal(E.parseNumberInput("2,5").value, 2.5); assert.equal(E.parseNumberInput(".5").value, 0.5); assert.equal(E.parseNumberInput("0", { allowZero: false }).ok, false); assert.equal(E.parseNumberInput("12 g").ok, false);
});

console.log("Part J: packet quantities");
const frac = (n) => E.decompose(Q(n));
test("0.25 mol -> one quarter packet", () => { const d = frac(0.25); assert.equal(d.fullCount, 0); assert.equal(d.partialFraction, 0.25); assert.equal(d.packetCount, 1); });
test("0.50 mol -> one half packet", () => { const d = frac(0.5); assert.equal(d.fullCount, 0); assert.equal(d.partialFraction, 0.5); assert.equal(d.packetCount, 1); });
test("0.75 mol -> one three-quarter packet", () => { const d = frac(0.75); assert.equal(d.partialFraction, 0.75); });
test("1.00 mol -> one full packet, no partial", () => { const d = frac(1); assert.equal(d.fullCount, 1); assert.equal(d.partialQ, 0); assert.equal(d.packetCount, 1); });
test("1.50 mol -> one full + one half", () => { const d = frac(1.5); assert.deepEqual([d.fullCount, d.partialFraction], [1, 0.5]); });
test("2.50 mol -> two full + one half", () => { const d = frac(2.5); assert.deepEqual([d.fullCount, d.partialFraction, d.packetCount], [2, 0.5, 3]); });
test("3.75 mol -> three full + one three-quarter", () => { const d = frac(3.75); assert.deepEqual([d.fullCount, d.partialFraction], [3, 0.75]); });
test("0 mol -> no material", () => { const d = frac(0); assert.equal(d.packetCount, 0); assert.ok(d.isZero); assert.equal(E.describeDecomposition(0), "no material"); });
test("0.333 mol -> proportional fill and the actual amount", () => { const d = frac(0.333); assert.equal(d.partialFraction, 0.333); assert.equal(E.fmtMol(E.fromQuanta(d.totalQ)), "0.333"); });
test("fill fraction depends only on amount (never > 1)", () => { assert.equal(E.fillFraction(Q(0.25)), 0.25); assert.equal(E.fillFraction(Q(7)), 1); assert.equal(E.fillFraction(-5), 0); });
test("description strings", () => { assert.equal(E.describeDecomposition(Q(2.5)), "2 full packets + 1 half-filled packet"); assert.equal(E.describeDecomposition(Q(0.25)), "1 quarter-filled packet"); });
test("grouped representation: many packets are summarised with an exact count", () => {
  const r = E.representPackets(Q(60), { maxIndividual: 6 }); assert.equal(r.individualFull, 6); assert.equal(r.groupedFull, 54); assert.ok(r.grouped); assert.equal(r.groupedMol, 54); assert.ok(r.drawn <= 8);
  const s = E.representPackets(Q(2.5)); assert.equal(s.grouped, false); assert.equal(s.individualFull, 2);
  const p = E.representPackets(Q(60.5), { maxIndividual: 6 }); assert.equal(p.individualFull + p.groupedFull, 60); assert.equal(p.partialQ, Q(0.5)); assert.equal(p.individualFull, 5);
});
test("adjustTotal: fills last packet first when increasing, empties the last first when decreasing", () => {
  let n = 1; const id = () => `n${n++}`;
  let ps = E.adjustTotal([], Q(0.5), id); assert.deepEqual(ps.map((p) => p.q), [Q(0.5)]);
  ps = E.adjustTotal(ps, Q(1.5), id); assert.deepEqual(ps.map((p) => p.q), [Q(1), Q(0.5)]);
  ps = E.adjustTotal(ps, Q(2.5), id); assert.deepEqual(ps.map((p) => p.q), [Q(1), Q(1), Q(0.5)]);
  ps = E.adjustTotal(ps, Q(1.25), id); assert.deepEqual(ps.map((p) => p.q), [Q(1), Q(0.25)]);
  ps = E.adjustTotal(ps, 0, id); assert.deepEqual(ps, []);
  assert.equal(E.adjustTotal([{ id: "a", q: 5 }], 0, id, { keepOne: true })[0].q, 0);
});

console.log("Part J: formula composition (counting view)");
const comp = (id, n) => E.composition(id, Q(n));
test("1 mol H2O -> 2 mol H + 1 mol O (3 mol atoms)", () => { const c = comp("H2O", 1); assert.deepEqual(c.atoms.map((a) => [a.element, a.mol]), [["H", 2], ["O", 1]]); assert.equal(c.totalAtomsMol, 3); });
test("0.5 mol H2O -> 1 mol H + 0.5 mol O", () => { const c = comp("H2O", 0.5); assert.deepEqual(c.atoms.map((a) => a.mol), [1, 0.5]); });
test("1.5 mol H2O -> 3 mol H + 1.5 mol O", () => { const c = comp("H2O", 1.5); assert.deepEqual(c.atoms.map((a) => a.mol), [3, 1.5]); });
test("1 mol CO2 -> 1 mol C + 2 mol O", () => { const c = comp("CO2", 1); assert.deepEqual(c.atoms.map((a) => [a.element, a.mol]), [["C", 1], ["O", 2]]); });
test("1 mol NH3 -> 1 mol N + 3 mol H", () => { const c = comp("NH3", 1); assert.deepEqual(c.atoms.map((a) => [a.element, a.mol]), [["N", 1], ["H", 3]]); });
test("every substance: atoms = subscripts x amount exactly, for awkward amounts too", () => {
  for (const s of E.SUBSTANCE_LIST) for (const n of [0.333, 0.1, 2.675, 7.001]) { const c = E.composition(s.id, Q(n)); for (const a of c.atoms) assert.equal(a.q, s.composition[a.element] * Q(n)); }
});
test("ionic: NaCl -> 1 mol Na+ and 1 mol Cl-; MgO -> Mg2+ and O2-; counting packets are ions", () => {
  const c = comp("NaCl", 1.5); assert.deepEqual(c.ions.map((i) => [i.label, i.mol]), [["Na⁺", 1.5], ["Cl⁻", 1.5]]);
  const cp = E.countingPackets("MgO", Q(2)); assert.deepEqual(cp.map((p) => [p.substanceId, p.q]), [["ion:Mg2+", Q(2)], ["ion:O2-", Q(2)]]);
  const cn = E.countingPackets("NaOH", Q(1)); assert.deepEqual(cn.map((p) => p.substanceId), ["ion:Na+", "ion:OH-"]);
});
test("A4: counting H2O gives H and O ATOMS, never H2 / O2 molecules", () => {
  const cp = E.countingPackets("H2O", Q(1)); assert.deepEqual(cp.map((p) => [p.substanceId, p.q]), [["atoms:H", Q(2)], ["atoms:O", Q(1)]]);
  for (const id of E.SELECTABLE_IDS) for (const p of E.countingPackets(id, Q(1))) assert.ok(p.substanceId.startsWith("atoms:") || p.substanceId.startsWith("ion:"), `${id} -> ${p.substanceId}`);
  assert.deepEqual(E.countingPackets("Mg", Q(1)), []);
});
test("working lines + subscript explanation", () => {
  assert.equal(E.compositionWorking("H2O", Q(0.5))[0].text, "n(H) = 2 × n(H₂O) = 2 × 0.50 mol = 1.00 mol");
  assert.match(E.subscriptExplanation("H2O"), /subscript/i); assert.match(E.subscriptExplanation("H2O"), /2 H atoms/); assert.match(E.subscriptExplanation("Mg"), /metal/);
});

console.log("Part J: mass conversion");
test("12 g Mg / 24 g mol-1 = 0.50 mol (explicit teaching policy); with the booklet Mg = 24.31 it is 0.4936 mol", () => { assert.equal(E.molesFromMass(12, E.molarMass("Mg")).n.toFixed(4), "0.4936"); const r = E.molesFromMass(12, E.molarMass("Mg", "teaching")); assert.equal(r.n, 0.5); assert.equal(r.nQ, Q(0.5)); });
test("36 g Mg -> 1.50 mol; 6 g -> 0.25; 24 g -> 1.00; 60 g -> 2.50", () => { assert.deepEqual([36, 6, 24, 60].map((m) => E.molesFromMass(m, 24).n), [1.5, 0.25, 1, 2.5]); });
test("10 g NaOH / 40 g mol-1 = 0.25 mol", () => { assert.equal(E.molesFromMass(10, E.molarMass("NaOH")).n, 0.25); });
test("m = nM round trip, no float noise", () => { assert.equal(E.massFromMoles(0.25, 24).mass, 6); assert.equal(E.massFromMoles(1.5, 24).mass, 36); assert.equal(E.massFromMoles(0.1 + 0.2, 24).mass, 7.2); });
test("validation: negative mass, zero, division by zero, non-finite", () => {
  assert.equal(E.molesFromMass(-1, 24).ok, false); assert.equal(E.molesFromMass(0, 24).n, 0); assert.equal(E.molesFromMass(5, 0).ok, false); assert.equal(E.molesFromMass(5, -1).ok, false); assert.equal(E.molesFromMass(NaN, 24).ok, false); assert.equal(E.molesFromMass(Infinity, 24).ok, false);
  assert.equal(E.molesFromMass(1e9, 24).ok, false, "beyond the supported range");
});
test("precise policy gives a different n and the UI label says which", () => { near(E.molesFromMass(12, E.molarMass("Mg", "precise")).n, 12 / 24.305, 1e-9); assert.match(E.massInfo("Mg", "teaching").note, /simplified/); assert.doesNotMatch(E.massInfo("Mg", "precise").note, /simplified/); assert.doesNotMatch(E.massInfo("Mg").note, /simplified/); });
test("entity count N = n N_A", () => { near(E.entityCount(0.5) / 3.01107038e23, 1, 1e-9); assert.equal(E.fmtSci(E.entityCount(1)), "6.022 × 10²³"); assert.equal(E.fmtSci(E.entityCount(2)), "1.204 × 10²⁴"); });

console.log("Part J: concentration + dilution");
test("10 g NaOH in 100 mL -> 2.50 mol dm-3", () => { const r = E.prepareSolution({ massG: 10, molarMassGPerMol: E.molarMass("NaOH"), finalVolumeMl: 100 }); assert.equal(r.n, 0.25); assert.equal(r.c, 2.5); });
test("20 g NaOH in 100 mL -> 5.00; 10 g in 200 mL -> 1.25", () => { assert.equal(E.prepareSolution({ massG: 20, molarMassGPerMol: 40, finalVolumeMl: 100 }).c, 5); assert.equal(E.prepareSolution({ massG: 10, molarMassGPerMol: 40, finalVolumeMl: 200 }).c, 1.25); });
test("amount stays constant when only volume changes", () => { const a = E.prepareSolution({ massG: 10, molarMassGPerMol: 40, finalVolumeMl: 100 }); const b = E.prepareSolution({ massG: 10, molarMassGPerMol: 40, finalVolumeMl: 200 }); assert.equal(a.nQ, b.nQ); });
test("concentration validation: zero / negative volume, negative amount", () => { assert.equal(E.concentration(0.25, 0).ok, false); assert.equal(E.concentration(0.25, -5).ok, false); assert.equal(E.concentration(-1, 100).ok, false); assert.equal(E.concentration(0, 100).c, 0); });
test("n = cV and V = n/c", () => { assert.equal(E.amountFromConcentration(2.5, 100).n, 0.25); assert.equal(E.volumeForConcentration(0.25, 2.5).volumeMl, 100); assert.equal(E.volumeForConcentration(0.25, 0).ok, false); });
test("ion density scale is shared and proportional to c", () => { assert.equal(E.relativeIonDensity(2.5), 0.5); assert.equal(E.relativeIonDensity(5), 1); assert.equal(E.relativeIonDensity(10), 1); assert.equal(E.relativeIonDensity(1.25), 0.25); });
test("dilution: 50 mL of 2.0 mol dm-3 diluted to 200 mL -> 0.50 mol dm-3, moles travel with the aliquot", () => {
  const stock = { nQ: Q(2.0 * 0.25), volumeMl: 250 }; assert.equal(E.solutionConc(stock), 2);
  const r = E.dilute(stock, 50, 200); assert.ok(r.ok); assert.equal(r.c2, 0.5); assert.equal(r.nAliquotMol, 0.1); assert.equal(r.dilutionFactor, 4);
  assert.equal(r.stockAfter.nQ + r.nAliquotQ, stock.nQ, "moles conserved"); assert.equal(E.solutionConc(r.stockAfter), 2, "stock keeps its concentration");
  assert.equal(r.nAliquotQ, Q(0.1), "the aliquot carries only c1 V1, not the whole stock");
});
test("dilution validation + C1V1=C2V2 solver", () => {
  const stock = { nQ: Q(0.5), volumeMl: 250 };
  assert.equal(E.dilute(stock, 0, 200).ok, false); assert.equal(E.dilute(stock, 300, 400).ok, false); assert.equal(E.dilute(stock, 50, 40).ok, false);
  assert.equal(E.c1v1c2v2({ c1: 2, v1: 50, v2: 200 }).c2, 0.5); assert.equal(E.c1v1c2v2({ c1: 2, c2: 0.5, v2: 200 }).v1, 50); assert.equal(E.c1v1c2v2({ v1: 50, c2: 0.5, v2: 200 }).c1, 2); assert.equal(E.c1v1c2v2({ c1: 2, v1: 50, c2: 0.5 }).v2, 200);
  assert.equal(E.c1v1c2v2({ c1: 2, v1: 50 }).ok, false); assert.equal(E.c1v1c2v2({ c1: 0, v1: 50, v2: 10 }).c2, 0);
});

console.log("Part J: gas volume");
test("RTP convention: 1 mol -> 24 dm3, 0.5 -> 12, 2 -> 48", () => { assert.equal(E.volumeAtRtp(1).volumeDm3, 24); assert.equal(E.volumeAtRtp(0.5).volumeDm3, 12); assert.equal(E.volumeAtRtp(2).volumeDm3, 48); assert.equal(E.volumeAtRtp(0).volumeDm3, 0); });
test("RTP validation + inverse", () => { assert.equal(E.volumeAtRtp(-1).ok, false); assert.equal(E.volumeAtRtp(1, 0).ok, false); assert.equal(E.amountAtRtp(12).n, 0.5); assert.equal(E.amountAtRtp(-1).ok, false); });
test("PV = nRT in SI units: 1 mol at 273.15 K and 100 kPa -> 22.71 dm3", () => { const r = E.volumeIdeal(1, 273.15, 100000); near(r.volumeDm3, 22.7109, 1e-3); near(r.volumeM3, 0.0227109, 1e-6); });
test("PV = nRT at 298.15 K and 101325 Pa -> 24.47 dm3 (so 24.0 is a convention, not a law)", () => { const r = E.volumeIdeal(1, 298.15, 101325); near(r.volumeDm3, 24.4655, 1e-3); assert.ok(Math.abs(r.volumeDm3 - 24.0) > 0.4); });
test("kelvin handling + rejection of 0 K / negative K / bad pressure", () => { assert.equal(E.celsiusToKelvin(25), 298.15); assert.equal(E.volumeIdeal(1, 0, 1e5).ok, false); assert.equal(E.volumeIdeal(1, -5, 1e5).ok, false); assert.equal(E.volumeIdeal(1, 300, 0).ok, false); assert.equal(E.volumeIdeal(-1, 300, 1e5).ok, false); });
test("volume proportional to n, T and inversely to P (ideal gas)", () => { const a = E.volumeIdeal(1, 300, 1e5).volumeDm3; near(E.volumeIdeal(2, 300, 1e5).volumeDm3, 2 * a, 1e-9); near(E.volumeIdeal(1, 600, 1e5).volumeDm3, 2 * a, 1e-9); near(E.volumeIdeal(1, 300, 2e5).volumeDm3, a / 2, 1e-9); });
test("n = PV/RT round trip", () => { const v = E.volumeIdeal(0.37, 310, 1.2e5); near(E.amountIdeal(1.2e5, v.volumeM3, 310).n, 0.37, 1e-9); });

console.log("Part J: reactions and limiting reagent");
test("every reaction is atom- AND charge-balanced; equations render", () => {
  for (const r of E.REACTION_LIST) { const b = E.checkBalance(r); assert.ok(b.balanced, `${r.id}: ${b.unbalanced}`); assert.ok(b.chargeBalanced); for (const k of [2, 3, 7]) assert.ok(E.checkBalance(r, k).balanced); }
  assert.equal(E.equationString(E.REACTIONS["water-synthesis"]), "2H₂(g) + O₂(g) → 2H₂O(l)");
  assert.equal(E.equationString(E.REACTIONS["ammonia-synthesis"]), "N₂(g) + 3H₂(g) → 2NH₃(g)");
  assert.equal(E.equationString(E.REACTIONS["magnesium-oxide"]), "2Mg(s) + O₂(g) → 2MgO(s)");
  assert.equal(E.equationString(E.REACTIONS["sodium-water"]), "2Na(s) + 2H₂O(l) → 2NaOH(aq) + H₂(g)");
});
test("an unbalanced reaction is detected (checker is not a rubber stamp)", () => {
  const bad = { id: "x", species: [{ id: "H2", coeff: 1, side: "reactant", state: "g" }, { id: "O2", coeff: 1, side: "reactant", state: "g" }, { id: "H2O", coeff: 1, side: "product", state: "l" }] };
  const b = E.checkBalance(bad); assert.equal(b.balanced, false); assert.deepEqual(b.unbalanced, ["O"]);
});
test("sodium + water: aqueous NaOH is ions (note), H2 is a gas, charge balanced", () => { const r = E.REACTIONS["sodium-water"]; assert.match(E.ionicNote(r), /Na⁺\(aq\) \+ OH⁻\(aq\)/); assert.equal(r.species.find((s) => s.id === "H2").state, "g"); assert.equal(r.species.find((s) => s.id === "NaOH_aq").state, "aq"); assert.ok(r.species.every((s) => s.id !== "NaOH")); });
const lim = (rid, amounts) => E.limitingReagent(rid, Object.fromEntries(Object.entries(amounts).map(([k, v]) => [k, Q(v)])));
test("2 mol H2 + 1 mol O2 -> 2 mol H2O (stoichiometric: both limiting)", () => { const r = lim("water-synthesis", { H2: 2, O2: 1 }); assert.equal(r.extent, 1); assert.equal(r.products[0].produced, 2); assert.ok(r.stoichiometric); assert.deepEqual(r.limiting.sort(), ["H2", "O2"]); assert.ok(r.perReactant.every((p) => p.remaining === 0)); });
test("4 mol H2 + 2 mol O2 -> 4 mol H2O", () => { const r = lim("water-synthesis", { H2: 4, O2: 2 }); assert.equal(r.products[0].produced, 4); });
test("3 mol H2 + 1 mol O2 -> 2 mol H2O, O2 limiting, 1 mol H2 remains", () => { const r = lim("water-synthesis", { H2: 3, O2: 1 }); assert.deepEqual(r.limiting, ["O2"]); assert.equal(r.products[0].produced, 2); const h = r.perReactant.find((p) => p.id === "H2"); assert.equal(h.consumed, 2); assert.equal(h.remaining, 1); assert.ok(h.excess); assert.equal(r.perReactant.find((p) => p.id === "O2").remaining, 0); });
test("3 mol Na + 2 mol H2O -> 2 mol NaOH and 1 mol H2, 1 mol Na remains (H2O limiting)", () => { const r = lim("sodium-water", { Na: 3, H2O: 2 }); assert.deepEqual(r.limiting, ["H2O"]); assert.equal(r.products.find((p) => p.id === "NaOH_aq").produced, 2); assert.equal(r.products.find((p) => p.id === "H2").produced, 1); assert.equal(r.perReactant.find((p) => p.id === "Na").remaining, 1); });
test("N2 + 3H2 -> 2NH3 and 2Mg + O2 -> 2MgO extent arithmetic", () => { const a = lim("ammonia-synthesis", { N2: 2, H2: 3 }); assert.equal(a.extent, 1); assert.equal(a.products[0].produced, 2); assert.equal(a.perReactant.find((p) => p.id === "N2").remaining, 1); const b = lim("magnesium-oxide", { Mg: 3, O2: 2 }); assert.equal(b.extent, 1.5); assert.equal(b.products[0].produced, 3); assert.equal(b.perReactant.find((p) => p.id === "O2").remaining, 0.5); });
test("zero reactant -> no reaction, nothing consumed, zero reactant is the limiting one", () => { const r = lim("water-synthesis", { H2: 0, O2: 1 }); assert.ok(r.noReaction); assert.equal(r.extent, 0); assert.deepEqual(r.limiting, ["H2"]); assert.ok(r.perReactant.every((p) => p.consumedQ === 0)); const z = lim("water-synthesis", { H2: 0, O2: 0 }); assert.deepEqual(z.limiting.sort(), ["H2", "O2"]); assert.match(z.reason, /absent/); });
test("equal limiting ratios report ALL tied reagents (floating decimals included)", () => { const r = lim("water-synthesis", { H2: 0.6, O2: 0.3 }); assert.ok(r.tied); assert.deepEqual(r.limiting.sort(), ["H2", "O2"]); const q = lim("water-synthesis", { H2: 0.2 + 0.4, O2: 0.1 + 0.2 }); assert.ok(q.tied); });
test("large excess and fractional amounts never leave negative leftovers", () => { const r = lim("water-synthesis", { H2: 450.5, O2: 0.0000001 }); assert.ok(r.perReactant.every((p) => p.remainingQ >= 0)); assert.deepEqual(r.limiting, ["O2"]); const t = lim("ammonia-synthesis", { N2: 1 / 3, H2: 1 }); assert.ok(t.perReactant.every((p) => p.remainingQ >= 0)); });
test("limiting reagent from masses + theoretical yield (teaching policy)", () => {
  // 6.06 g / 2.02 = 3 mol H2; 32 g / 32.00 = 1 mol O2 -> O2 limits (3/2 = 1.5 > 1), extent 1
  const r = E.limitingFromMasses("water-synthesis", { H2: 6.06, O2: 32 }); assert.equal(r.result.extent, 1); assert.deepEqual(r.result.limiting, ["O2"]);
  const y = E.theoreticalYieldMass(r.result, "H2O"); near(y.mass, 2 * 18.02, 1e-9);
  assert.equal(E.limitingFromMasses("water-synthesis", { H2: -1, O2: 3 }).ok, false); assert.equal(E.theoreticalYieldMass(r.result, "O2").ok, false);
});
test("percentage yield requires an explicit actual yield and handles zero theoretical yield", () => { assert.equal(E.percentYield(null, 36).ok, false); assert.equal(E.percentYield(18, 36).percent, 50); assert.equal(E.percentYield(10, 0).ok, false); assert.equal(E.percentYield(-1, 36).ok, false); assert.ok(E.percentYield(40, 36).warning); });
test("limitingReagent rejects invalid input", () => { assert.throws(() => E.limitingReagent("water-synthesis", { H2: -1, O2: 1 })); assert.throws(() => E.limitingReagent("water-synthesis", { H2: 1.5, O2: 1 })); assert.throws(() => E.getReaction("nope")); });

console.log("Particle mapping (B3)");
test("entity count is deterministic, monotone, 0 only when empty, < full only when not full", () => {
  for (const d of E.DETAIL_LEVELS) { let prev = -1; for (let i = 0; i <= 1000; i += 1) { const c = E.entityCountFor(i / 1000, d); assert.ok(c >= prev); prev = c; assert.equal(c, E.entityCountFor(i / 1000, d)); } assert.equal(E.entityCountFor(0, d), 0); assert.equal(E.entityCountFor(1, d), E.FULL_ENTITIES[d]); assert.ok(E.entityCountFor(0.9999, d) < E.FULL_ENTITIES[d]); assert.equal(E.entityCountFor(0.0001, d), 1); }
  assert.throws(() => E.entityCountFor(0.5, "ultra"));
});
test("fill is proportional to the fraction (0.5 mol shows about half the entities)", () => { const N = E.FULL_ENTITIES.medium; assert.equal(E.entityCountFor(0.5, "medium"), N / 2); assert.equal(E.entityCountFor(0.25, "medium"), Math.round(N / 4)); /* CHANGED (redesign): 300/450/600 groups per full packet, 450/4 is not an integer */ assert.deepEqual([300, 450, 600], [E.FULL_ENTITIES.low, E.FULL_ENTITIES.medium, E.FULL_ENTITIES.high]); });
test("same representative count for every substance at one detail level (no density information, A2)", () => { assert.equal(E.entityCountFor(0.5, "high"), E.entityCountFor(0.5, "high")); for (const id of E.SELECTABLE_IDS) assert.ok(E.particleModel(id).entities.length >= 1); });
test("particle models carry the right composition per entity", () => {
  const h2o = E.particleModel("H2O").entities[0]; assert.deepEqual(h2o.atoms.map((a) => a.el), ["O", "H", "H"]); assert.equal(h2o.bonds.length, 2);
  assert.deepEqual(E.particleModel("CO2").entities[0].atoms.map((a) => a.el).sort(), ["C", "O", "O"]); assert.deepEqual(E.particleModel("NH3").entities[0].atoms.map((a) => a.el).sort(), ["H", "H", "H", "N"]); assert.equal(E.particleModel("CH4").entities[0].atoms.length, 5);
  assert.equal(E.particleModel("Mg").mode, "metallic"); assert.equal(E.particleModel("Mg").entities[0].atoms.length, 1);
  const nacl = E.particleModel("NaCl"); assert.equal(nacl.mode, "ionic"); assert.deepEqual(nacl.entities.map((e) => e.label), ["Na⁺", "Cl⁻"]); assert.ok(nacl.entities[1].atoms[0].r > nacl.entities[0].atoms[0].r, "Cl- larger than Na+");
  const naoh = E.particleModel("NaOH"); assert.equal(naoh.entities[1].atoms.length, 2, "OH- is a two-atom group");
  for (const id of E.SELECTABLE_IDS) for (const e of E.particleModel(id).entities) { const R = Math.max(...e.atoms.map((a) => Math.hypot(a.x, a.y, a.z) + a.r)); assert.ok(R > 0.5 && R < 1.8, `${id} extent ${R}`); }
});
test("H2O geometry survives into the particle model (angle preserved by normalisation)", () => { const a = E.particleModel("H2O").entities[0].atoms; near(E.angleAt(a, 1, 0, 2), 104.5, 1e-6); });
test("ONE colour per element and the shared table is used (H white, O red, N blue, C grey)", () => { assert.equal(E.atomColour("O"), "#d93a30"); assert.equal(E.atomColour("H"), "#f2f4f8"); assert.equal(E.atomColour("Fe"), "#8d7b6e"); assert.equal(E.atomColour("Na"), "#ab5cf2"); });
test("adaptive detail: software GL / low memory step down; reduced motion caps; fps feedback lowers", () => {
  assert.equal(E.chooseDetail({ softwareGL: true }), "low"); assert.equal(E.chooseDetail({ deviceMemory: 8, cores: 8 }), "high"); assert.equal(E.chooseDetail({ deviceMemory: 4 }), "medium"); assert.equal(E.chooseDetail({ deviceMemory: 8, cores: 8, reducedMotion: true }), "medium"); assert.equal(E.chooseDetail({ deviceMemory: 8, cores: 8, measuredFps: 15 }), "low"); assert.equal(E.lowerDetail("high"), "medium"); assert.equal(E.lowerDetail("low"), "low");
});
test("captions never claim a literal 6.022e23 particles", () => { assert.match(E.particleCaption("H2O", "high"), /representative/); assert.match(E.particleCaption("H2O", "high"), /not 6\.022 × 10²³/); });

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
