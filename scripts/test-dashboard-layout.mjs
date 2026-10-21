#!/usr/bin/env node
// Node tests for the layout-only helpers added with the Simulation Dashboard Layout:
//   node scripts/test-dashboard-layout.mjs
// (container-size classification + the Ideal Gas "Predict & Reveal" content, which must
// agree with the unchanged physics model).
import assert from "node:assert/strict";
import { classifyDashboard, WIDE_MIN_WIDTH } from "../src/components/simulation/dashboardLayout.js";
import { predictContent } from "../src/engines/ideal-gas-simulation/predict.js";
import { DEFAULT_CONTROLS, LIMITS, applyControlChange, resolveState } from "../src/engines/ideal-gas-simulation/model.js";

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}

console.log("== dashboard layout classification ==");
test("stacks only below the wide threshold and never uses window size", () => {
  assert.equal(classifyDashboard(WIDE_MIN_WIDTH - 1, 900).layout, "stacked");
  assert.equal(classifyDashboard(WIDE_MIN_WIDTH, 700).layout, "wide");
  assert.equal(classifyDashboard(900, 696).layout, "wide"); // Learn column at 1366x768
});
test("header is one row only on wide boxes; scale only grows on big boxes", () => {
  assert.equal(classifyDashboard(900, 696).header, "two");
  assert.equal(classifyDashboard(1342, 704).header, "two");
  assert.equal(classifyDashboard(1904, 1045).header, "one");
  assert.equal(classifyDashboard(900, 696).scale, 1);
  assert.equal(classifyDashboard(1342, 704).scale, 1.0);
  const big = classifyDashboard(1904, 1045);
  assert.ok(big.scale > 1 && big.scale <= 1.28, String(big.scale));
  assert.equal(big.density, "roomy");
});

console.log("== ideal gas predict & reveal ==");
const real = (c) => ({ ...c, mode: "real" });
test("volume control: halving V doubles the ideal pressure and quotes model numbers", () => {
  const c = { ...DEFAULT_CONTROLS };
  const p = predictContent(c);
  const now = resolveState(c);
  const after = resolveState({ ...c, V: now.V / 2 });
  assert.match(p.question, /halved/);
  assert.ok(p.answer.includes(now.pressure.toFixed(2)) && p.answer.includes(after.pressure.toFixed(2)), p.answer);
  assert.ok(Math.abs(after.pressure / now.pressure - 2) < 1e-9);
});
test("small V is doubled instead (stays inside the slider range)", () => {
  const p = predictContent({ ...DEFAULT_CONTROLS, V: 7 });
  assert.match(p.question, /doubled/);
  assert.match(p.answer, /halves/);
});
test("pressure control: quotes the solved volume; real gas never claims exact doubling", () => {
  const c = applyControlChange({ ...DEFAULT_CONTROLS }, { control: "pressure" });
  const p = predictContent(c);
  assert.match(p.question, /target pressure is doubled/);
  const pr = predictContent(real(c));
  assert.ok(/ideal gas would change by exactly/.test(pr.answer), pr.answer);
});
test("every control combination yields a non-empty question and answer without NaN", () => {
  for (const mode of ["ideal", "real"]) for (const control of ["volume", "pressure"]) for (const T of [100, 300, 800]) for (const N of [5, 50, 100]) {
    let c = { ...DEFAULT_CONTROLS, mode, T, N };
    c = applyControlChange(c, { control });
    const p = predictContent(c);
    assert.ok(p.question.length > 20 && p.answer.length > 20);
    assert.ok(!/NaN|undefined|Infinity/.test(p.question + p.answer), p.question + p.answer);
  }
  assert.ok(LIMITS.V.min > 0);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
