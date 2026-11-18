#!/usr/bin/env node
// NEW (redesign): packet layout + particle composition tests.   node scripts/test-mole-lab-packets.mjs
// ONE FULL PACKET = ONE MOLE, identical bag size everywhere; fractional packets are partly filled.
import assert from "node:assert/strict";
import { BAG, packetLayout, groupsFor, buildPacketInstances, drawnAtomTally, drawnSpeciesTally } from "../src/engines/mole-lab/engine/packetModel.js";
import { FULL_ENTITIES } from "../src/engines/mole-lab/engine/particles.js";

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
console.log(`\n${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
