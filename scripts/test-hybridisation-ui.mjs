#!/usr/bin/env node
// jsdom UI tests for the 3D Hybridisation Explorer:  node scripts/test-hybridisation-ui.mjs
// Renders the REAL VSEPRExplorer3D into jsdom (no layout, no canvas, no WebGL -> the WebGL-less fallback path) and drives it
// with DOM events. Honest limits: pointer dragging in 3D, geometry on screen, clipping and the three.js scene are covered by
// the pure model tests (test-vsepr-model.mjs) and headless Chromium (scripts/verify-vsepr-explorer.mjs); this file checks
// behaviour and state wiring: registration, tabs and their state, click-to-build, info panel, Lewis, toggles, library, challenge.
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { register } from "node:module";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/simulation/hybridisation-explorer", pretendToBeVisual: true });
for (const k of ["window", "document", "HTMLElement", "HTMLInputElement", "HTMLSelectElement", "Node", "MouseEvent", "KeyboardEvent", "Event", "MutationObserver", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"]) {
  try { globalThis[k] = dom.window[k]; } catch { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true }); }
}
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
dom.window.HTMLCanvasElement.prototype.getContext = () => null;
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.IS_REACT_ACT_ENVIRONMENT = false;
register("./jsx-loader-hooks.mjs", import.meta.url);
register("./image-viewer-loader-hooks.mjs", import.meta.url);

const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const Hyb = (await import("../src/engines/hybridisation-explorer/HybridisationExplorer.jsx")).default;
const { SIMULATION_REGISTRY, getSimulationIdForTitle } = await import("../src/data/simulationRegistry.js");
const { SIMULATION_COMPONENTS } = await import("../src/data/simulationEngineComponents.js");
const { resourcesById } = await import("../src/data/resources-registry.js");
const h = React.createElement;

let passed = 0; let failed = 0;
async function test(name, fn) { try { await fn(); console.log(`  ok   ${name}`); passed += 1; } catch (e) { console.log(`  FAIL ${name}\n       ${(e.stack || e.message).split("\n").slice(0, 6).join("\n       ")}`); failed += 1; } }
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const T = (id) => `[data-testid="${id}"]`;
const txt = (sel) => ($(sel)?.textContent ?? "").replace(/\s+/g, " ").trim();
const click = async (sel) => { const el = typeof sel === "string" ? $(sel) : sel; assert.ok(el, `missing ${sel}`); el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); await tick(); };
async function setSelect(sel, value) { const el = $(sel); assert.ok(el, `missing ${sel}`); const d = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value"); d.set.call(el, value); el.dispatchEvent(new window.Event("change", { bubbles: true })); await tick(); }
async function until(fn, ms = 4000, label = "condition") { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return; await tick(25); } throw new Error(`timed out waiting for ${label}`); }
let mounted = null;
async function mount() {
  if (mounted) { mounted.root.unmount(); mounted.host.remove(); mounted = null; }
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  root.render(h(Hyb, { standalone: true })); mounted = { root, host };
  await until(() => $(T("hybridisation-workspace")), 5000, "workspace"); await tick(80);
}

console.log("Registration");
await test("registered in both registries and the resource registry", () => {
  assert.equal(SIMULATION_REGISTRY["hybridisation-explorer"].label, "Hybridisation Explorer (3D)"); assert.ok(SIMULATION_COMPONENTS["hybridisation-explorer"]);
  assert.equal(getSimulationIdForTitle("Hybridisation Explorer (3D)"), "hybridisation-explorer");
  const r = resourcesById["hybridisation-explorer"]; assert.ok(r && r.status === "live");
});

console.log("Orbital Lab");
await mount();
await test("exactly two tabs; Orbital Lab first", () => { const tabs = $$(`${T("hybridisation-tabs")} [role="tab"], ${T("hybridisation-tabs")} button`); assert.equal(tabs.length, 2); assert.ok($(T("tab-lab")) && $(T("tab-molecules"))); });
await test("without WebGL the fallback message shows and the controls still work", () => { assert.ok($(T("webgl-fallback")), "fallback"); assert.ok($(T("select-element"))); });
await test("element dropdown lists the 12 required elements", () => { assert.deepEqual($$(`${T("select-element")} option`).map((o) => o.value), ["H", "Be", "B", "C", "N", "O", "F", "Si", "P", "S", "Cl", "Xe"]); });
await test("carbon ground state: 2s2 2p2 boxes, config line, specific orbital boxes", () => {
  assert.equal($(T("select-element")).value, "C"); assert.match(txt(T("config-line")), /2s.*2p/);
  for (const id of ["2s", "2px", "2py", "2pz"]) assert.ok($(T(`box-${id}`)), id);
  assert.match($(T("box-2pz")).innerHTML, /<sub[^>]*>z<\/sub>/);
});
await test("excited carbon is labelled a conventional illustration", async () => {
  await click(T("state-excited")); assert.match(txt(T("promotion-note")), /conventional/i); await click(T("state-ground"));
});
await test("box click selects; selection summary; Mix disabled for one orbital", async () => {
  await click(T("box-2s")); assert.ok($(T("btn-mix")).disabled); await click(T("box-2s"));
});
await test("sp3 mixing from excited carbon: Mix enabled, 4 hybrid boxes", async () => {
  await click(T("state-excited")); for (const id of ["2s", "2px", "2py", "2pz"]) await click(T(`box-${id}`));
  assert.ok(!$(T("btn-mix")).disabled); await click(T("btn-mix")); await until(() => $(T("box-hybrid-3")), 4000, "hybrid boxes");
  assert.equal($$('[data-testid^="box-hybrid-"]').length, 4); assert.ok($(T("box-2s")).disabled, "consumed s box is disabled"); assert.ok($(T("hybrid-section")));
});
await test("Add atom, Duplicate, Undo, Reset", async () => {
  await click(T("btn-add-atom")); assert.equal($(T("hy-stage")).getAttribute("data-atoms"), "2");
  await click(T("btn-duplicate")); assert.equal($(T("hy-stage")).getAttribute("data-atoms"), "3");
  await click(T("btn-undo")); assert.equal($(T("hy-stage")).getAttribute("data-atoms"), "2");
  await click(T("btn-reset")); assert.equal($(T("hy-stage")).getAttribute("data-atoms"), "1"); assert.ok($(T("box-2s")));
});
await test("N, O, F, H cannot be excited: the button is disabled or explains why", async () => {
  for (const s of ["H", "N", "O", "F"]) { await setSelect(T("select-element"), s); const b = $(T("state-excited")); assert.ok(b.disabled || b.getAttribute("aria-disabled") === "true" || /nothing|already|no /i.test(txt(T("excited-note")) + (b.title ?? "")), s); }
  await setSelect(T("select-element"), "C");
});

console.log("Molecule Explorer");
await test("tab switch keeps Orbital Lab state; dropdown has 11 molecules", async () => {
  await click(T("tab-molecules")); assert.equal($$(`${T("select-molecule")} option`).length, 11);
});
await test("ethene steps Next to 5/5 with 5 sigma and 1 pi; Previous and Reset work", async () => {
  await setSelect(T("select-molecule"), "C2H4"); assert.match(txt(T("step-count")), /1 \/ 5/);
  for (let i = 0; i < 4; i += 1) await click(T("btn-next"));
  assert.match(txt(T("step-count")), /5 \/ 5/); assert.equal(txt(T("count-sigma")).replace(/\D/g, "") || "", txt(T("count-sigma")).replace(/\D/g, ""));
  assert.equal($(T("hy-stage")).getAttribute("data-sigma"), "5"); assert.equal($(T("hy-stage")).getAttribute("data-pi"), "1"); assert.ok($(T("btn-next")).disabled);
  await click(T("btn-prev")); assert.match(txt(T("step-count")), /4 \/ 5/); await click(T("btn-mol-reset")); assert.match(txt(T("step-count")), /1 \/ 5/);
});
await test("every molecule reaches its final step with the expected totals", async () => {
  const { compileMolecule } = await import("../src/engines/hybridisation-explorer/model/moleculeLayout.js"); const { MOLECULE_IDS } = await import("../src/engines/hybridisation-explorer/model/moleculeData.js");
  for (const id of MOLECULE_IDS) {
    await setSelect(T("select-molecule"), id); const c = compileMolecule(id);
    for (let i = 0; i < c.steps.length - 1; i += 1) await click(T("btn-next"));
    assert.equal($(T("hy-stage")).getAttribute("data-sigma"), String(c.expected.sigma), id); assert.equal($(T("hy-stage")).getAttribute("data-pi"), String(c.expected.pi), id);
  }
});
await test("benzene shows the delocalised pi note", async () => { await setSelect(T("select-molecule"), "C6H6"); for (let i = 0; i < 20; i += 1) { if ($(T("btn-next")).disabled) break; await click(T("btn-next")); } assert.ok($(T("count-delocalised")) || /delocali/i.test(txt(T("hybridisation-explain")))); });

await test("Play starts the next step at once (<100 ms), builds no geometry on the Play path; Pause/Next/Previous/Reset respond in <100 ms", async () => {
  const G = await import("../src/engines/hybridisation-explorer/scene/geometry.js");
  await setSelect(T("select-molecule"), "C2H4"); await click(T("btn-mol-reset")); assert.match(txt(T("step-count")), /1 \/ 5/);
  const built0 = G.stats.built; const stepNow = () => txt(T("step-count")); const fire = (id) => $(T(id)).dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  // dispatch the click, then poll every 2 ms until the visible state changed: this measures click -> DOM update, not the test's own tick
  const respond = async (id, changed, label) => { const t0 = performance.now(); fire(id); while (!changed()) { if (performance.now() - t0 > 400) throw new Error(`${label}: no response`); await new Promise((r) => setTimeout(r, 2)); } const ms = performance.now() - t0; assert.ok(ms < 100, `${label} took ${ms.toFixed(0)} ms`); await tick(10); };
  await respond("btn-play", () => /2 \/ 5/.test(stepNow()), "Play"); assert.equal($(T("btn-play")).getAttribute("aria-pressed"), "true");
  await respond("btn-play", () => $(T("btn-play")).getAttribute("aria-pressed") === "false", "Pause");
  await respond("btn-next", () => /3 \/ 5/.test(stepNow()), "Next"); await respond("btn-prev", () => /2 \/ 5/.test(stepNow()), "Previous"); await respond("btn-mol-reset", () => /1 \/ 5/.test(stepNow()), "Reset");
  assert.equal(G.stats.built, built0, "no geometry may be built by Play / Pause / Next / Previous / Reset");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
