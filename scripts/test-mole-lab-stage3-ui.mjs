#!/usr/bin/env node
// jsdom UI tests for Mole Lab Stage 3 (Concentration Laboratory):  node scripts/test-mole-lab-stage3-ui.mjs
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
const setInput = async (sel, v) => { const el = $(sel); assert.ok(el, sel); const set = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set; set.call(el, v); el.dispatchEvent(new dom.window.Event("input", { bubbles: true })); el.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true })); el.dispatchEvent(new dom.window.Event("blur", { bubbles: true })); await wait(); };
const answer = async () => { const b = $('[data-testid="ml-predict-choice"][data-correct="1"]'); if (b && !b.disabled) { b.dispatchEvent(new MouseEvent("click", { bubbles: true })); await wait(60); } };
const st = () => document.querySelector('[data-testid="mole-lab"]').__moleLab.getState();
const total = (s) => { const sc = s.scenes[3]; let t = sc.packets.reduce((a, p) => a + p.q, 0); for (const v of sc.vessels) for (const q of Object.values(v.contents)) t += q; return t; };

test("Stage 3 tab opens the Concentration Laboratory (not a placeholder) with the 2D fallback bench in jsdom", async () => {
  await click('[data-testid="ml-tab-3"]'); await wait(120);
  assert.ok($('[data-testid="ml-controls-3"]')); assert.equal($('[data-testid="ml-pending"]'), null); assert.ok($('[data-testid="ml-fallback"]'), "fallback bench when WebGL is missing");
  assert.match(text('[data-testid="ml-controls-3"]'), /Experiment 1/);
});
test("virtual-lab safety note and the exothermic note are visible", () => { assert.match(text('[data-testid="ml3-safety"]'), /corrosive/i); assert.match(text('[data-testid="ml3-thermal"]'), /exothermic/i); });
test("guided mode: the prediction gates the calculation; answering reveals it", async () => {
  assert.ok($('[data-testid="ml-calc-locked"]') || /prediction/i.test(text('[data-testid="ml-calc"]')));
  const right = $('[data-testid="ml-predict-choice"][data-correct="1"]'); assert.ok(right, "choices"); right.dispatchEvent(new MouseEvent("click", { bubbles: true })); await wait(80);
  assert.equal($('[data-testid="ml-calc-locked"]'), null);
});
test("quick prepare gives 2.50 mol dm-3 and conserves moles", async () => {
  const before = total(st()); await click('[data-testid="ml3-prepare-A"]'); await wait(60);
  assert.equal(st().scenes[3].data.stations.A.atMark, true); assert.equal(total(st()), before); assert.match(text('[data-testid^="ml3-pane-c-"]'), /2\.50/);
});
test("typed invalid masses show an error and change nothing", async () => {
  await click('[data-testid="ml3-restart"]'); await wait(60); const before = JSON.stringify(st().scenes[3]);
  for (const v of ["-4", "abc", "0", ""]) { await setInput('[data-testid="ml3-mass-A"] input, input[data-testid="ml3-mass-A"]', v); assert.equal(JSON.stringify(st().scenes[3]), before, `mass ${v}`); }
});
test("a valid typed mass updates the packet to a half-filled 20.0 g", async () => { await setInput('[data-testid="ml3-mass-A"] input, input[data-testid="ml3-mass-A"]', "20"); assert.equal(st().scenes[3].packets[0].q, 5e8); });
test("the step-by-step buttons dissolve, transfer and fill, and a past-the-mark top-up is refused with a visible message", async () => {
  await click('[data-testid="ml3-restart"]'); await setInput('input[data-testid="ml3-water-input"]', "60"); await click('[data-testid="ml3-measure"]'); await click('[data-testid="ml3-pour-water"]');
  await click('[data-testid="ml-open-btn"]'); await click('[data-testid="ml-pour-btn"]'); await wait(80); await click('[data-testid="ml3-stir"]'); await click('[data-testid="ml3-transfer"]'); await wait(60);
  await setInput('input[data-testid="ml3-top-input"]', "900"); await click('[data-testid="ml3-top-up"]'); assert.match(text('[data-testid="ml3-top-error"]'), /mark|volume|capacity|more/i);
  await click('[data-testid="ml3-fill-mark"]'); await wait(60); assert.equal(st().scenes[3].data.stations.A.atMark, true); assert.deepEqual(JSON.parse(JSON.stringify(document.querySelector('[data-testid="mole-lab"]').__moleLab.getState().last.ok)), true);
});
test("experiments 2 to 5 each render controls and a microscopic view with panes", async () => {
  for (const n of [2, 3, 4, 5]) { await click(`[data-testid="ml3-exp-${n}"]`); await wait(80); assert.equal(st().scenes[3].data.exp, n); assert.ok($('[data-testid="ml3-scope"]'), `scope ${n}`); assert.ok(document.querySelectorAll('[data-testid^="ml3-pane-"]').length >= 1, `panes ${n}`); }
});
test("Experiment 5 shows both concentrations; the viewer states one common scale", async () => {
  await click('[data-testid="ml3-exp-5"]'); await wait(80); await answer(); const t = text('[data-testid="ml3-scope"]'); assert.match(t, /2\.50/); assert.match(t, /5\.00/); assert.match(text('[data-testid="ml3-scale"]'), /same scale/i);
});
test("Experiment 4 dilution: take, pour, fill gives 0.500 and keeps conservation", async () => {
  await click('[data-testid="ml3-exp-4"]'); await wait(60); await answer(); const before = total(st()); await click('[data-testid="ml3-take"]'); await click('[data-testid="ml3-transfer-aliquot"]'); await click('[data-testid="ml3-fill-mark"]'); await wait(60);
  assert.equal(total(st()), before); assert.match(text('[data-testid="ml-working"]') + text('[data-testid="ml3-scope"]'), /0\.500|0\.5/);
});
test("free mode exposes the solute selector (NaOH and NaCl only) and unlocks every step", async () => {
  await click('[data-testid="ml-mode-free"]'); await wait(80); const sel = $('[data-testid="ml3-solute"]'); assert.ok(sel, "solute selector in free mode");
  assert.deepEqual([...sel.querySelectorAll("option")].map((o) => o.value).sort(), ["NaCl", "NaOH"]); assert.equal($('[data-testid="ml-calc-locked"]'), null);
});
test("no global CSS leakage: stage 3 styles are scoped under .ml-root", () => {
  const css = fs.readFileSync(new URL("../src/engines/mole-lab/ui/stage3/Stage3.css", import.meta.url), "utf8");
  for (const rule of css.split("}").map((r) => r.trim()).filter((r) => r && !r.startsWith("/*") && !r.startsWith("@media"))) assert.match(rule.replace(/^\/\*.*?\*\/\s*/s, ""), /^\.ml-root/, rule.slice(0, 60));
});

for (const t of pending) { try { await t.fn(); console.log(`  ok   ${t.name}`); passed += 1; } catch (e) { console.log(`  FAIL ${t.name}\n       ${(e.stack || e.message).split("\n").slice(0, 5).join("\n       ")}`); failed += 1; } }
console.log(`\n${passed} passed, ${failed} failed`); root.unmount(); process.exit(failed ? 1 : 0);
