#!/usr/bin/env node
// Node tests for the layout-only helpers of the Simulation Dashboard Layout:
//   node scripts/test-dashboard-layout.mjs
// (container-size classification + the Ideal vs Real Gas "Predict" content, which must
// agree with the physics model; plus the CSS contract of the shared dashboard).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classifyDashboard, HEADER_ONE_ROW_MIN_WIDTH, WIDE_MIN_WIDTH } from "../src/components/simulation/dashboardLayout.js";
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
test("header is one row from 820 px (title | mode selector | actions); scale only grows on big boxes", () => {
  assert.equal(HEADER_ONE_ROW_MIN_WIDTH, 820);
  assert.equal(classifyDashboard(819, 696).header, "two");
  assert.equal(classifyDashboard(900, 696).header, "one"); // Learn column at 1366x768
  assert.equal(classifyDashboard(1342, 704).header, "one");
  assert.equal(classifyDashboard(900, 696).scale, 1);
  assert.equal(classifyDashboard(1342, 704).scale, 1.0);
  const big = classifyDashboard(1904, 1045);
  assert.ok(big.scale > 1 && big.scale <= 1.28, String(big.scale));
  assert.equal(big.density, "roomy");
});

console.log("== shared dashboard contract (CSS + component source) ==");
const css = readFileSync(new URL("../src/components/simulation/SimulationDashboard.css", import.meta.url), "utf8");
const jsx = readFileSync(new URL("../src/components/simulation/SimulationDashboard.jsx", import.meta.url), "utf8");
test("graph column is beside the chamber (flex row), animated, 40 % when shown; chamber takes the rest; controls 20-25 %", () => {
  assert.match(css, /\.sd-main \{[^}]*flex-direction: row/);
  assert.match(css, /\.sd-col--controls \{[^}]*flex: 0 0 clamp\(204px, 23%, 300px\)/);
  assert.match(css, /\.sd-main\[data-graph="shown"\] \.sd-col--graph \{[^}]*flex: 0 0 40%/);
  assert.match(css, /\.sd-col--graph \{[^}]*transition: flex-basis/);
  assert.match(css, /\.sd-col--chamber \{[^}]*flex: 1 1 0/);
});
test("the graph is never stacked below the chamber on wide layouts; only the stacked (narrow) layout does that", () => {
  const wideRules = css.split("\n").filter((l) => /data-layout="wide"/.test(l));
  assert.ok(wideRules.every((l) => !/sd-col--graph/.test(l)));
  assert.match(css, /\.sd-root\[data-layout="stacked"\] \.sd-main[^{]*\{[^}]*flex-direction: column/);
});
test("header exposes Show/Hide Graph, Reset and Settings; bottom has the live strip + one-line explanation", () => {
  assert.match(jsx, /Hide Graph/); assert.match(jsx, /Show Graph/); assert.match(jsx, /data-testid="graph-toggle"/);
  assert.match(jsx, /data-testid="reset"/); assert.match(jsx, /<HeaderPopover[\s\S]*?label=\{settingsLabel\}/);
  assert.match(jsx, /className="sd-bottom"/); assert.match(jsx, /export function LiveStrip/); assert.match(jsx, /export function ExplainLine/);
  assert.match(css, /\.sd-explain-text \{[^}]*white-space: nowrap/); // ONE line
});
test("slider rows: label+value on one line, min / slider / max on the next (compact, 45-65 px)", () => {
  assert.match(jsx, /className="sd-row-slider"/); assert.match(jsx, /sd-end sd-end--min/);
  assert.match(css, /max-height: calc\(64px \* var\(--sd-s\)\)/);
  assert.doesNotMatch(css, /\.sd-minmax \{/);
});
test("no window-width logic in the dashboard source", () => { assert.doesNotMatch(jsx, /innerWidth/); });

console.log("== ideal gas predict & reveal ==");
const real = (c) => ({ ...c, mode: "real" });
test("volume control: halving V doubles the ideal pressure and quotes model numbers", () => {
  const c = { ...DEFAULT_CONTROLS, control: "volume", V: 0.5 };
  const p = predictContent(c);
  const now = resolveState(c);
  const after = resolveState({ ...c, V: now.V / 2 });
  assert.match(p.question, /halved/);
  const f2 = (x) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2));
  assert.ok(p.answer.includes(f2(now.pressure)) && p.answer.includes(f2(after.pressure)), p.answer);
  assert.ok(Math.abs(after.pressure / now.pressure - 2) < 1e-9);
});
test("small V is doubled instead (stays inside the slider range)", () => {
  const p = predictContent({ ...DEFAULT_CONTROLS, control: "volume", V: 0.012 });
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
  for (const mode of ["ideal", "real"]) for (const control of ["volume", "pressure"]) for (const T of [250, 300, 700]) for (const N of [5, 50, 100]) {
    let c = { ...DEFAULT_CONTROLS, mode, T, N };
    c = applyControlChange(c, { control });
    const p = predictContent(c);
    assert.ok(p.question.length > 20 && p.answer.length > 20, `${mode} ${control} ${T} ${N}`);
    assert.ok(!/NaN|undefined|Infinity/.test(p.question + p.answer), p.question + p.answer);
  }
  assert.ok(LIMITS.V.min > 0);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
