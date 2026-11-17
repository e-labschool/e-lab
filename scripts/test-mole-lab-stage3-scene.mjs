#!/usr/bin/env node
// Pure (no three.js / DOM) tests for the Stage 3 scene helpers: glassware geometry, bench layout, microscopic ion scene.
import assert from "node:assert/strict";
import { makeVessel, flaskScale } from "../src/engines/mole-lab/scene/glassware.js";
import { labLayout, BALANCE_W } from "../src/engines/mole-lab/scene/labLayout.js";
import { ionScene } from "../src/engines/mole-lab/scene/ionScene.js";
import { viewerPoints, drawnPairs, formulaUnitsInWindow, MAX_DRAWN_PAIRS } from "../src/engines/mole-lab/engine/concLab.js";

let passed = 0; let failed = 0;
const test = (n, f) => { try { f(); passed += 1; console.log(`  ok   ${n}`); } catch (e) { failed += 1; console.log(`  FAIL ${n}\n       ${e.message}`); } };

console.log("Glassware");
test("the volumetric flask's calibration mark is exactly the nominal volume, for every standard size", () => {
  for (const ml of [25, 50, 100, 200, 250, 500]) { const v = makeVessel("flask", ml); assert.ok(Math.abs(v.volumeAt(v.markY) - ml) / ml < 0.005, `${ml} mL mark`); assert.ok(Math.abs(v.heightAt(ml) - v.markY) < 0.01); }
});
test("volume and height are monotonic inverses and never exceed the glass", () => {
  for (const [k, cap] of [["beaker", 250], ["cylinder", 100], ["flask", 100]]) { const v = makeVessel(k, cap); let prev = -1; for (let ml = 0; ml <= cap; ml += cap / 20) { const h = v.heightAt(ml); assert.ok(h >= prev); assert.ok(h <= v.height + 1e-9); prev = h; } }
});
test("flask scale is clamped so tiny and huge flasks stay drawable", () => { assert.equal(flaskScale(1), 0.7); assert.equal(flaskScale(1e6), 1.45); assert.equal(flaskScale(100), 1); });
test("unknown vessel kinds are rejected", () => assert.throws(() => makeVessel("retort")));

console.log("Bench layout");
test("every layout places every object inside its own extent, at wide and narrow aspect", () => {
  for (const kind of ["single", "dilution", "compare"]) for (const aspect of [1.8, 1.0, 0.5]) {
    const l = labLayout({ kind, aspect }); for (const [k, p] of Object.entries(l.pos)) { assert.ok(p.x >= l.extent.minX - 1 && p.x <= l.extent.maxX + 1, `${kind} ${aspect} ${k} x`); assert.ok(Number.isFinite(p.z)); }
  }
});
test("narrow screens use two rows; wide screens one", () => { assert.equal(labLayout({ kind: "single", aspect: 1.8 }).rows, 1); assert.equal(labLayout({ kind: "single", aspect: 0.5 }).rows, 2); });
test("objects do not overlap on the bench (centres further apart than the balance half-width where one is a balance)", () => {
  for (const kind of ["single", "compare"]) { const l = labLayout({ kind, aspect: 1.8 }); const e = Object.entries(l.pos).filter(([k]) => k !== "tap"); for (let i = 0; i < e.length; i += 1) for (let j = i + 1; j < e.length; j += 1) { const [a, pa] = e[i]; const [b, pb] = e[j]; const d = Math.hypot(pa.x - pb.x, pa.z - pb.z); const need = a.startsWith("balance") || b.startsWith("balance") ? BALANCE_W / 2 : 0.9; assert.ok(d >= need, `${kind} ${a}/${b} ${d.toFixed(2)}`); } }
});

console.log("Microscopic ion scene");
test("ion count is proportional to concentration (same window): 1.25 : 2.5 : 5 = 1 : 2 : 4", () => {
  const n = (c) => ionScene({ c, state: "solution", solidFraction: 0 }).ions.length; assert.equal(n(2.5), 2 * n(1.25)); assert.equal(n(5), 2 * n(2.5));
});
test("a denser solution only ADDS ions (prefix-stable), so two panes are truly comparable", () => {
  const a = viewerPoints(12); const b = viewerPoints(48); assert.deepEqual(b.slice(0, 12), a);
});
test("all ions are hydrated and balanced in charge; no neutral formula-unit 'molecules'", () => {
  const s = ionScene({ c: 5, state: "solution", solidFraction: 0 }); assert.ok(s.ions.every((i) => i.hydrated)); assert.equal(s.ions.filter((i) => i.species === "cation").length, s.ions.filter((i) => i.species === "anion").length);
});
test("ions stay inside the window and the drawn count is capped", () => {
  const s = ionScene({ c: 10, state: "solution", solidFraction: 0 }); for (const i of s.ions) for (const v of [i.x, i.y, i.z]) assert.ok(Math.abs(v) <= 1); assert.ok(drawnPairs(1000) <= MAX_DRAWN_PAIRS);
});
test("empty, undefined and null panes draw nothing", () => { for (const p of [null, undefined, { c: null, state: "empty" }, { c: 2, state: "empty" }]) assert.equal(ionScene(p).ions.length, 0); });
test("the fixed-window formula-unit count follows c (c x 4.8177 per 2 nm cube)", () => { assert.ok(Math.abs(formulaUnitsInWindow(2.5) - 12.04) < 0.05); });

console.log(`\n${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
