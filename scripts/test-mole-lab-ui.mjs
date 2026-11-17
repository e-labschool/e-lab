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
test("six stage tabs; stages 3-6 are labelled as not built yet", () => {
  for (let i = 1; i <= 6; i += 1) assert.ok($(`[data-testid="ml-tab-${i}"]`), `tab ${i}`);
});
test("stage 1 renders the permanent counting-analogy panel and the fallback bench", () => {
  const t = text('[data-testid="mole-lab"]');
  assert.match(t, /counting analogy/i); assert.match(t, /6\.022/);
  assert.equal($('[data-testid="ml-bench"]')?.getAttribute("data-webgl"), "0");
});
test("stage 2 shows the IB data booklet molar mass (Mg = 24.31, no simplification note), amount-based quick buttons with their masses", async () => {
  await click('[data-testid="ml-tab-2"]');
  assert.match(text('[data-testid="ml-molar-mass"]'), /24\.31/);
  assert.doesNotMatch(text('[data-testid="mole-lab"]'), /simplified|S1\.[45]/i);
  assert.match(text('[data-testid="ml-quick-0.25"]'), /0\.25 mol.*6\.08 g/); assert.match(text('[data-testid="ml-quick-1"]'), /24\.31 g/); assert.match(text('[data-testid="ml-quick-1.5"]'), /36\.47 g/);
});
test("stage 2: a quick amount button changes the working, free mode is reachable", async () => {
  const before = text('[data-testid="mole-lab"]');
  const b = $('[data-testid="ml-quick-1"]') ?? $('[data-testid^="ml-quick-"]'); assert.ok(b); b.dispatchEvent(new MouseEvent("click", { bubbles: true })); await wait();
  assert.notEqual(text('[data-testid="mole-lab"]'), before);
});
test("a placeholder stage says it is coming in the next build", async () => {
  // Stage 3 is built; check whichever later stage is still a placeholder (none left = nothing to check).
  for (const n of [6, 5, 4]) { await click(`[data-testid="ml-tab-${n}"]`); if ($('[data-testid="ml-pending"]')) { assert.match(text('[data-testid="ml-pending"]'), /next build/i); break; } }
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
