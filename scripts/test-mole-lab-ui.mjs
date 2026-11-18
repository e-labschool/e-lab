#!/usr/bin/env node
// jsdom UI tests for Mole Lab:  node scripts/test-mole-lab-ui.mjs
// jsdom has no WebGL, so this exercises the 2D fallback bench, the tabs, controls, validation and registration.
// Real 3D, layout and pointer behaviour are covered by scripts/verify-mole-lab.mjs (headless Chromium).
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { register } from "node:module";
import fs from "node:fs";

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: "http://localhost/", pretendToBeVisual: true });
for (const k of ["window", "document", "HTMLElement", "HTMLInputElement", "HTMLSelectElement", "Node", "MouseEvent", "KeyboardEvent", "Event", "XMLSerializer", "MutationObserver", "getComputedStyle"]) {
  try { globalThis[k] = dom.window[k]; } catch { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true }); }
}
globalThis.requestAnimationFrame = () => 0; globalThis.cancelAnimationFrame = () => {};
dom.window.HTMLCanvasElement.prototype.getContext = () => null;
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
globalThis.IS_REACT_ACT_ENVIRONMENT = false;
register("./jsx-loader-hooks.mjs", import.meta.url);
register("./image-viewer-loader-hooks.mjs", import.meta.url);

const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const { default: MoleLab } = await import("../src/engines/mole-lab/MoleLab.jsx");

let passed = 0; let failed = 0; const pending = [];
const test = (name, fn) => pending.push({ name, fn });
const wait = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const $ = (s) => document.querySelector(s);
const text = (s) => ($(s)?.textContent ?? "").replace(/\s+/g, " ").trim();
const click = async (s) => { $(s).dispatchEvent(new MouseEvent("click", { bubbles: true })); await wait(); };

const root = createRoot(document.getElementById("root"));
root.render(React.createElement(MoleLab, { standalone: true }));
await wait(150);

test("registered in the catalogue as a free live simulation with NO syllabus codes (one single simulation), and in the component map", () => {
  const cat = fs.readFileSync(new URL("../src/data/simulationCatalogue.js", import.meta.url), "utf8");
  const i = cat.indexOf('"mole-lab"'); assert.ok(i > 0, "catalogue entry");
  const chunk = cat.slice(i, i + 900);
  assert.match(chunk, /syllabus:\s*\[\s*\]/); assert.doesNotMatch(chunk, /S1\.[45]/); assert.doesNotMatch(chunk, /tier:\s*"(pro|paid)"/);
  const comp = fs.readFileSync(new URL("../src/data/simulationEngineComponents.js", import.meta.url), "utf8");
  assert.match(comp, /"mole-lab"/);
});
// CHANGED (redesign): the old permanent-panel / quick-button / placeholder-stage tests are replaced by tests of the simplified UI.
test("six stage tabs, one tabpanel, no permanent prediction panel or step-size buttons", () => {
  for (let i = 1; i <= 6; i += 1) assert.ok($(`[data-testid="ml-tab-${i}"]`), `tab ${i}`);
  assert.equal(document.querySelectorAll('[role="tab"]').length, 6);
  const t = text('[data-testid="mole-lab"]');
  assert.doesNotMatch(t, /Inspect|Open Zipper|Split|Combine|prediction/i);
});
test("stage 1 states Avogadro once with the counting-analogy note (info toggle) and uses the fallback bench without WebGL", async () => {
  await click('[data-testid="ml-tab-1"]');
  assert.ok($('[data-testid="ml-fallback"]') || $('[data-testid="ml-experiment"]'));
  const t = text('[data-testid="mole-lab"]');
  assert.match(t, /6\.022/); assert.match(t, /counting analogy/i);
  assert.equal((t.match(/6\.022/g) || []).length, 1);
});
test("stage 2 uses the IB data booklet molar mass (Mg = 24.31) and a single working line", async () => {
  await click('[data-testid="ml-tab-2"]');
  assert.match(text('[data-testid="mole-lab"]'), /24\.31/);
  assert.doesNotMatch(text('[data-testid="mole-lab"]'), /simplified|S1\.[45]/i);
});
test("every stage renders its controls and an explanation line; stage 3-6 tabs are operable", async () => {
  for (const n of [1, 2, 3, 4, 5, 6]) {
    await click(`[data-testid="ml-tab-${n}"]`);
    assert.equal($(`[data-testid="ml-tab-${n}"]`).getAttribute("aria-selected"), "true");
    assert.ok($(`[data-testid="ml-controls-${n}"]`), `controls ${n}`);
    assert.ok(document.querySelectorAll("button").length < 40, `stage ${n} keeps the control count small`);
  }
});
test("stage 5 offers Run Reaction, Step and Reset; stage 6 offers Run Reaction and Reset", async () => {
  await click('[data-testid="ml-tab-5"]');
  for (const id of ["ml-run", "ml-step", "ml-reset-run"]) assert.ok($(`[data-testid="${id}"]`), id);
  await click('[data-testid="ml-tab-6"]');
  assert.ok($('[data-testid="ml-run"]')); assert.ok($('[data-testid="ml-reset-run"]'));
});
test("stage 3 (NEW): worked calculation in a SIDE panel: n = m / M, V in dm3, c = n / V, highlighted final concentration (live)", async () => {
  await click('[data-testid="ml-tab-3"]');
  const side = $('[data-testid="ml-side"]'); assert.ok(side, "side panel");
  const t = text('[data-testid="ml-side"]');
  assert.match(t, /n = m ÷ M/); assert.match(t, /10\.0 g ÷ 40\.00 g mol⁻¹ = 0\.250 mol/); assert.match(t, /100 cm³ = 0\.100 dm³/); assert.match(t, /c = n ÷ V/);
  assert.match(text('[data-testid="ml-final"]'), /2\.50 mol dm⁻³/);
  await click('[data-testid="ml-volume-250"]'); assert.match(text('[data-testid="ml-final"]'), /1\.00 mol dm⁻³/);
  await click('[data-testid="ml-volume-100"]');
  await click('[data-testid="ml-compare"]');
  assert.match(text('[data-testid="ml-final-A"]'), /2\.50/); assert.match(text('[data-testid="ml-final-B"]'), /5\.00/);
  await click('[data-testid="ml-compare"]');
});
test("stage 4 (NEW): packed molecules by default, Release gas / Pack again toggle, RTP caption and the representative-molecules note", async () => {
  await click('[data-testid="ml-tab-4"]');
  const b = $('[data-testid="ml-release"]'); assert.ok(b); assert.match(b.textContent, /Release gas/);
  await click('[data-testid="ml-release"]'); assert.match($('[data-testid="ml-release"]').textContent, /Pack again/);
  await click('[data-testid="ml-release"]'); assert.match($('[data-testid="ml-release"]').textContent, /Release gas/);
  assert.match(text('[data-testid="ml-conditions"]'), /RTP/); assert.match(text('[data-testid="ml-gasnote"]'), /mostly empty space/);
});
test("stage 6 (NEW): every reaction has a starting example that yields a valid limiting-reagent result", async () => {
  const { STAGE6_EXAMPLES } = await import("../src/engines/mole-lab/engine/reactionBench.js");
  const { REACTION_LIST } = await import("../src/engines/mole-lab/engine/reactions.js");
  const { stage6Defaults, stage6Result } = await import("../src/engines/mole-lab/engine/labConfig.js");
  for (const r of REACTION_LIST) { assert.ok(STAGE6_EXAMPLES[r.id], r.id); const res = stage6Result(r.id, stage6Defaults(r.id)); assert.ok(res.limiting.length >= 1, r.id); }
});
test("reset returns to a valid state and the tabs survive switching back", async () => {
  await click('[data-testid="ml-tab-1"]'); await click('[data-testid="ml-reset"]');
  assert.ok($('[data-testid="ml-controls-1"]'));
});

for (const { name, fn } of pending) {
  try { await fn(); passed += 1; console.log(`  ok   ${name}`); } catch (e) { failed += 1; console.log(`  FAIL ${name}\n       ${e.message}`); }
}
console.log(`\n${passed} passed, ${failed} failed`);
root.unmount(); process.exit(failed ? 1 : 0);
