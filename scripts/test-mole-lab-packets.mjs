#!/usr/bin/env node
// NEW (redesign): packet layout + particle composition tests.   node scripts/test-mole-lab-packets.mjs
// ONE FULL PACKET = ONE MOLE, identical bag size everywhere; fractional packets are partly filled.
import assert from "node:assert/strict";
import { BAG, packetLayout, groupsFor, buildPacketInstances, drawnAtomTally, drawnSpeciesTally } from "../src/engines/mole-lab/engine/packetModel.js";
import { FULL_ENTITIES } from "../src/engines/mole-lab/engine/particles.js";

import { getSubstance, SELECTABLE_IDS } from "../src/engines/mole-lab/engine/substances.js";
import { GAS_IDS } from "../src/engines/mole-lab/engine/gasLab.js";
import { packetTemplates as templatesOf } from "../src/engines/mole-lab/engine/packetModel.js";
let passed = 0, failed = 0;
const test = (n, f) => { try { f(); passed += 1; console.log(`  ok   ${n}`); } catch (e) { failed += 1; console.log(`  FAIL ${n}\n       ${e.message}`); } };
const L = (n) => packetLayout(n).packets;
const sum = (a) => a.reduce((x, y) => x + y, 0);

test("packetLayout: n mol -> full packets + one fractional packet", () => {
  assert.deepEqual(L(1), [1]);
  assert.deepEqual(L(0.5), [0.5]);
  assert.deepEqual(L(2.5), [1, 1, 0.5]);
  assert.deepEqual(L(3), [1, 1, 1]);
  assert.deepEqual(L(1.5), [1, 0.5]);
  for (const n of [0.25, 0.5, 1, 1.5, 2, 2.5, 3]) assert.ok(Math.abs(sum(L(n)) - n) < 1e-9, `sum ${n}`);
});
test("one bag size for every packet (frozen shared dimensions)", () => {
  assert.ok(Object.isFrozen(BAG)); assert.ok(BAG.width > 0 && BAG.height > BAG.width * 0.5 && BAG.depth > 0);
});
test("full packet particle counts are 300 / 450 / 600 by detail", () => {
  assert.deepEqual(FULL_ENTITIES, { low: 300, medium: 450, high: 600 });
  for (const d of ["low", "medium", "high"]) assert.equal(buildPacketInstances("Mg", d).groups, FULL_ENTITIES[d]);
});
test("partial packet shows a proportional prefix of the groups (bottom-filled)", () => {
  for (const d of ["low", "medium", "high"]) {
    const N = FULL_ENTITIES[d];
    assert.equal(groupsFor(1, d), N); assert.equal(groupsFor(0.5, d), Math.round(N / 2));
    assert.ok(groupsFor(0.25, d) < groupsFor(0.5, d));
  }
});
const MOL = { H2: { H: 2 }, O2: { O: 2 }, H2O: { H: 2, O: 1 }, CO2: { C: 1, O: 2 }, NH3: { N: 1, H: 3 }, CH4: { C: 1, H: 4 } };
for (const [id, comp] of Object.entries(MOL)) {
  test(`molecular composition of ${id} is exact for every drawn molecule`, () => {
    const inst = buildPacketInstances(id, "low"); const k = inst.groups;
    const t = drawnAtomTally(inst, k);
    for (const [el, c] of Object.entries(comp)) assert.equal(t[el], c * k, `${id} ${el}`);
    assert.deepEqual(Object.keys(t).sort(), Object.keys(comp).sort());
    const half = drawnAtomTally(inst, Math.floor(k / 2));
    for (const [el, c] of Object.entries(comp)) assert.equal(half[el], c * Math.floor(k / 2));
  });
}
test("ionic NaCl / NaOH use a 1:1 lattice of ions (not molecules)", () => {
  for (const id of ["NaCl", "NaOH"]) {
    const inst = buildPacketInstances(id, "low");
    assert.equal(inst.kind, "lattice"); assert.equal(inst.mode, "ionic");
    const s = drawnSpeciesTally(inst); assert.equal(s.length, 2);
    assert.ok(Math.abs(s[0] - s[1]) <= 1, `${id} ${s}`);
  }
});
test("metals draw single atoms, one per group", () => {
  const inst = buildPacketInstances("Mg", "low"); assert.deepEqual(drawnAtomTally(inst), { Mg: FULL_ENTITIES.low });
});

// NEW (redesign): every drawn entity (molecule / atom / ion) must match its formula and charge.
const ALL = [...new Set([...SELECTABLE_IDS, ...GAS_IDS, "NaOH_aq", "Ca", "Al", "Cu", "Zn", "Ag", "C", "S", "CaO", "Fe2O3", "Al2O3"])];
const tally = (atoms) => { const o = {}; for (const a of atoms) o[a.el] = (o[a.el] ?? 0) + 1; return o; };
for (const id of ALL) {
  test(`${id}: drawn atoms/ions match the formula and charge balance`, () => {
    const sub = getSubstance(id); const T = templatesOf(id);
    if (T.mode === "ionic") {
      const counts = sub.ions.map((i) => i.count); const tot = {}; let charge = 0;
      T.species.forEach((sp, i) => { for (const [el, n] of Object.entries(tally(sp.atoms))) tot[el] = (tot[el] ?? 0) + n * counts[i]; charge += sp.charge * counts[i]; });
      assert.deepEqual(tot, sub.composition, `${id} composition`); assert.equal(charge, 0, `${id} net charge`);
    } else assert.deepEqual(tally(T.species[0].atoms), sub.composition, `${id} entity composition`);
  });
}
test("OH- is an oxygen sphere with ONE bonded hydrogen (not a lone red sphere); Na+ and Cl- are single separate atoms", () => {
  const T = templatesOf("NaOH"); const oh = T.species.find((x) => x.label.startsWith("OH")); const na = T.species.find((x) => x.label.startsWith("Na"));
  assert.deepEqual(tally(oh.atoms), { O: 1, H: 1 }); assert.equal(oh.bonds.length, 1); assert.equal(oh.charge, -1);
  assert.deepEqual(tally(na.atoms), { Na: 1 }); assert.equal(na.bonds.length, 0); assert.equal(na.charge, 1);
  const cl = templatesOf("NaCl").species.find((x) => x.label.startsWith("Cl")); assert.deepEqual(tally(cl.atoms), { Cl: 1 }); assert.equal(cl.charge, -1);
  const aq = templatesOf("NaOH_aq"); assert.ok(aq.species.some((x) => x.label.startsWith("OH") && x.atoms.length === 2));
});
test("the Stage 3 ion cloud is built from these templates (no hand-placed ion atoms)", async () => {
  const fs = await import("node:fs"); const src = fs.readFileSync(new URL("../src/engines/mole-lab/scene/Fx.jsx", import.meta.url), "utf8");
  assert.match(src, /packetTemplates\(soluteId\)/); assert.doesNotMatch(src, /anion === "OH"/);
});
console.log(`\n${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
