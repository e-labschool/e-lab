#!/usr/bin/env node
// Pure (no three.js / DOM) tests for Mole Lab scene helpers: slots, bag geometry, bench layout and grouping.
import assert from "node:assert/strict";
import { buildSlots } from "../src/engines/mole-lab/scene/slots.js";
import { BAG, bagSurfaceZ, fillLevelV } from "../src/engines/mole-lab/scene/bagSpec.js";
import { benchLayout, fitDistance, clampToBench, nearestTarget, BENCH_HALF_X } from "../src/engines/mole-lab/scene/benchLayout.js";
import { packEntries } from "../src/engines/mole-lab/ui/benchEntries.js";
import { FULL_ENTITIES } from "../src/engines/mole-lab/engine/particles.js";

let passed = 0; let failed = 0;
const test = (n, f) => { try { f(); passed += 1; console.log(`  ok   ${n}`); } catch (e) { failed += 1; console.log(`  FAIL ${n}\n       ${e.message}`); } };

test("slots: deterministic, the entity count matches the detail level, every slot sits inside the bag", () => {
  for (const mode of ["molecular", "ionic", "metallic"]) for (const d of ["low", "medium", "high"]) {
    const a = buildSlots(mode, d); const b = buildSlots(mode, d);
    assert.equal(a.slots.length, FULL_ENTITIES[d]); assert.deepEqual(a.slots, b.slots);
    for (const s of a.slots) { assert.ok(Math.abs(s.x) <= BAG.interior.x + 1e-9, "x"); assert.ok(s.y >= BAG.interior.yMin - 1e-9 && s.y <= BAG.interior.yMax + 1e-9, "y"); assert.ok(Math.abs(s.z) <= BAG.interior.z + 1e-9, "z"); }
  }
});
test("slots: unknown detail throws", () => assert.throws(() => buildSlots("molecular", "ultra")));
test("bag geometry: fixed size and a finite, bounded surface", () => {
  assert.ok(BAG.width > 0 && BAG.height > 0);
  for (const f of [0, 0.5, 1]) for (const u of [-1, 0, 1]) for (const v of [0, 0.5, 1]) { const z = bagSurfaceZ(u, v, 1, { fill: f, open: 0 }); assert.ok(Number.isFinite(z) && Math.abs(z) < BAG.depth); }
  assert.ok(fillLevelV(1) >= fillLevelV(0));
});
test("bench layout: standard bag spacing never overlaps, rows wrap, nothing at NaN", () => {
  const keys = ["a", "b", "c", "d", "e", "f", "g", "h"]; const l = benchLayout([keys], { maxPerRow: 6 });
  assert.equal(l.rows, 2); for (const k of keys) { assert.ok(Number.isFinite(l.pos[k].x) && Number.isFinite(l.pos[k].z)); }
  const same = Object.values(l.pos).filter((p) => p.z === l.pos.a.z).map((p) => p.x).sort((x, y) => x - y);
  for (let i = 1; i < same.length; i += 1) assert.ok(same[i] - same[i - 1] >= BAG.width, "bags overlap");
  assert.ok(benchLayout([]).rows === 0);
});
test("camera fit: more bags or a narrower viewport move the camera back, never below the single-bag distance", () => {
  const one = benchLayout([["a"]]).extent; const six = benchLayout([["a", "b", "c", "d", "e", "f"]]).extent;
  assert.ok(fitDistance(six, 1.6) > fitDistance(one, 1.6)); assert.ok(fitDistance(one, 0.45) > fitDistance(one, 1.6));
});
test("clampToBench keeps a drop inside the bench; nearestTarget ignores the dragged bag", () => {
  const c = clampToBench(99, -99); assert.equal(c.x, BENCH_HALF_X); assert.ok(c.z < 0);
  assert.equal(nearestTarget({ a: { x: 0, z: 0 }, b: { x: 1, z: 0 } }, 0.1, 0, "a"), "b");
  assert.equal(nearestTarget({ a: { x: 0, z: 0 } }, 5, 5, null), null);
});
test("packEntries: beyond the cap the bags are grouped but the total amount is preserved", () => {
  const packets = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, substanceId: "H2O", q: 1e9, open: false, role: "stock" }));
  const e = packEntries(packets, 6); assert.ok(Array.isArray(e));
  const flat = e.flat(); const bags = flat.filter((x) => x.type === "bag").length; const stacked = flat.filter((x) => x.type === "stack").reduce((s, x) => s + x.count, 0);
  assert.equal(bags + stacked, 10);
});
console.log(`\n${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
