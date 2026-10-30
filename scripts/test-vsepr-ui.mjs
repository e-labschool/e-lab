#!/usr/bin/env node
// jsdom UI tests for the 3D VSEPR Explorer:  node scripts/test-vsepr-ui.mjs
// Renders the REAL VSEPRExplorer3D into jsdom (no layout, no canvas, no WebGL -> the WebGL-less fallback path) and drives it
// with DOM events. Honest limits: pointer dragging in 3D, geometry on screen, clipping and the three.js scene are covered by
// the pure model tests (test-vsepr-model.mjs) and headless Chromium (scripts/verify-vsepr-explorer.mjs); this file checks
// behaviour and state wiring: registration, tabs and their state, click-to-build, info panel, Lewis, toggles, library, challenge.
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { register } from "node:module";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/simulation/vsepr-explorer-3d", pretendToBeVisual: true });
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
const VSEPRExplorer3D = (await import("../src/engines/vsepr-explorer-3d/VSEPRExplorer3D.jsx")).default;
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
const dd = (id) => txt(`${T(id)} dd`);
const click = async (sel) => { const el = typeof sel === "string" ? $(sel) : sel; assert.ok(el, `missing ${sel}`); el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); await tick(); };
async function setSelect(sel, value) { const el = $(sel); assert.ok(el, `missing ${sel}`); const d = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value"); d.set.call(el, value); el.dispatchEvent(new window.Event("change", { bubbles: true })); await tick(); }
async function setInput(sel, value) { const el = $(sel); const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value"); d.set.call(el, value); el.dispatchEvent(new window.Event("input", { bubbles: true })); await tick(); }
async function until(fn, ms = 4000, label = "condition") { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return; await tick(25); } throw new Error(`timed out waiting for ${label}`); }
let mounted = null;
async function mount() {
  if (mounted) { mounted.root.unmount(); mounted.host.remove(); mounted = null; }
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  root.render(h(VSEPRExplorer3D, { standalone: true })); mounted = { root, host };
  await until(() => $(T("vsepr-workspace")), 5000, "workspace"); await tick(80);
}
const build = async (central, ligand, n, lp, bond = 1) => {
  await click(T("btn-reset")); await click(T(`tool-atom-${central}`)); await click(T(`tool-bond-${bond}`));
  for (let i = 0; i < n; i += 1) await click(T(`tool-atom-${ligand}`)); for (let i = 0; i < lp; i += 1) await click(T("tool-lp"));
};

console.log("Registration");
await test("registered under the SAME simulation id and label as the previous engine; resource registry entry unchanged", () => {
  assert.equal(SIMULATION_REGISTRY["vsepr-explorer-3d"].label, "VSEPR Explorer (3D)"); assert.ok(SIMULATION_COMPONENTS["vsepr-explorer-3d"]);
  assert.equal(getSimulationIdForTitle("VSEPR Explorer (3D)"), "vsepr-explorer-3d");
  const r = resourcesById["vsepr-explorer-3d"]; assert.ok(r && r.status === "live" && r.conceptIds.includes("vsepr-theory"));
});

await mount();
console.log("Layout and tabs");
await test("three tabs Build | Molecules | Challenge; Build has no molecule cards and shows the toolbox", () => {
  assert.deepEqual($$(`${T("vsepr-tabs")} [role="tab"]`).map((t) => t.querySelector(".sd-tab-main").textContent), ["1. Build", "2. Molecules", "3. Challenge"]);
  assert.equal($(T("tab-build")).getAttribute("aria-selected"), "true"); assert.equal($(T("molecule-library")), null); assert.equal($('[data-testid^="mol-"]'), null);
  assert.deepEqual($$('[data-testid^="tool-atom-"]').map((b) => b.getAttribute("data-testid").slice(10)), ["H", "C", "N", "O", "F", "Cl", "B", "Be", "S", "P", "Si", "Br", "I", "Xe"]);
  assert.ok($(T("tool-bond-1")) && $(T("tool-bond-2")) && $(T("tool-bond-3")) && $(T("tool-lp")));
  assert.match(txt(T("tool-bond-2")), /Double\s*\(1 domain\)/); assert.match(txt(T("tool-lp")), /\(1 domain\)/);
  assert.ok($(T("geometry-switch")) && $(T("mode-ed")) && $(T("mode-mg")), "ED | MG switch under the viewer");
  assert.ok($(T("webgl-fallback")), "no WebGL in jsdom -> clear fallback message instead of a blank viewer");
});
await test("first-use hint, tooltips and the empty-workspace guidance are present", () => {
  assert.match(txt(T("vsepr-hint")), /Drag atoms from the panel/); assert.ok($(T("empty-hint")));
  assert.match($(T("tool-atom-N")).getAttribute("title"), /central atom/); assert.match($(T("btn-clear")).getAttribute("title"), /undo/i);
});

console.log("Build tab");
await test("first atom becomes the central atom; surrounding atoms use the selected bond type; NH3 is recognised", async () => {
  await click(T("tool-atom-N")); assert.equal($(T("empty-hint")), null); assert.match(txt(T("vsepr-explain")), /central atom/);
  for (let i = 0; i < 3; i += 1) await click(T("tool-atom-H")); await click(T("tool-lp"));
  assert.equal(dd("row-axe"), "AX₃E"); assert.equal(dd("row-molecule"), "NH₃ (ammonia)"); assert.equal(dd("row-domains"), "4 (3 bonding + 1 lone pair)");
  assert.equal(dd("row-ed"), "Tetrahedral"); assert.equal(dd("row-mg"), "Trigonal pyramidal"); assert.match(dd("row-angle"), /≈ 107° \(approx\.\)/);
  assert.equal($(T("idealised-badge")), null); assert.match(txt(T("vsepr-explain")), /3 bonding \+ 1 lone pair = 4 domains \(AX₃E\)/);
});
await test("H2O, CH4, BF3 and SF6 by clicks; double/triple bonds are one domain each; CO2 recognised", async () => {
  await build("O", "H", 2, 2); assert.equal(dd("row-axe"), "AX₂E₂"); assert.equal(dd("row-mg"), "Bent"); assert.match(dd("row-angle"), /104\.5/);
  await build("C", "H", 4, 0); assert.equal(dd("row-axe"), "AX₄"); assert.match(dd("row-angle"), /109\.5°/);
  await build("B", "F", 3, 0); assert.equal(dd("row-mg"), "Trigonal planar"); assert.match(dd("row-angle"), /120/);
  await build("S", "F", 6, 0); assert.equal(dd("row-mg"), "Octahedral"); assert.match(dd("row-angle"), /90.*180/);
  for (const order of [2, 3]) { await build("C", "O", 2, 0, order); assert.equal(dd("row-axe"), "AX₂"); assert.match(dd("row-domains"), /^2 /); }
  await build("C", "O", 2, 0, 2); assert.match(dd("row-molecule"), /^CO₂/);
});
await test("a free build that matches no validated molecule is labelled as an idealised VSEPR model with no invented angle", async () => {
  await build("N", "H", 2, 1);
  assert.ok($(T("idealised-badge"))); assert.match(dd("row-molecule"), /Idealised VSEPR model/); assert.match(dd("row-angle"), /^< 120°/); assert.equal(dd("row-mg"), "Bent");
});
await test("clicking a bond tool while a bond is selected is wired; seventh domain is refused with a note; toolbox lone pair needs a central atom", async () => {
  await build("S", "F", 6, 0); await click(T("tool-atom-F")); assert.match(txt(T("vsepr-note")), /up to 6/);
  await click(T("btn-reset")); await click(T("tool-lp")); assert.match(txt(T("vsepr-note")), /central atom/);
});
await test("undo / redo / clear / reset", async () => {
  await build("N", "H", 3, 1); assert.equal(dd("row-axe"), "AX₃E");
  await click(T("btn-undo")); assert.equal(dd("row-axe"), "AX₃"); await click(T("btn-redo")); assert.equal(dd("row-axe"), "AX₃E");
  await click(T("btn-clear")); assert.ok($(T("empty-hint"))); assert.ok(!$(T("btn-undo")).disabled, "Clear is undoable");
  await click(T("btn-undo")); assert.equal(dd("row-axe"), "AX₃E");
  await click(T("btn-reset")); assert.ok($(T("empty-hint"))); assert.ok($(T("btn-undo")).disabled && $(T("btn-redo")).disabled);
});
await test("Electron-Domain / Molecular Geometry switch and view toggles update state without rebuilding", async () => {
  await build("N", "H", 3, 1); await click(T("mode-mg")); assert.equal($(T("mode-mg")).getAttribute("aria-checked"), "true"); assert.equal($(T("mode-ed")).getAttribute("aria-checked"), "false");
  assert.equal($(T("opt-lp")).disabled, false); assert.equal($(T("opt-domains")).disabled, true); assert.equal(dd("row-axe"), "AX₃E");
  await click(T("mode-ed")); assert.equal($(T("opt-lp")).disabled, true); assert.equal($(T("opt-domains")).disabled, false);
  assert.equal($(T("opt-repulsion")).checked, false); await click(T("opt-repulsion")); assert.equal($(T("opt-repulsion")).checked, true); assert.equal($(T("opt-angles")).checked, false); await click(T("opt-angles")); assert.equal($(T("opt-angles")).checked, true);
  await click(T("btn-reset")); assert.equal($(T("opt-repulsion")).checked, false, "Reset restores the default view options");
});
await test("Why this shape? expands; Lewis tab: accurate bond orders, terminal lone pairs, valid / exception / warning states", async () => {
  await build("N", "H", 3, 1); await click(T("why-toggle")); assert.match(txt(T("why-text")), /trigonal pyramidal/i);
  await click(T("card-tab-lewis")); assert.ok($(T("lewis-svg"))); assert.match(txt(T("lewis-panel")), /Octet complete/);
  await build("C", "O", 2, 0, 2); assert.equal($$(`${T("lewis-svg")} .vx-lewis-bond`).map((g) => g.querySelectorAll("line").length).join(), "2,2", "two double bonds drawn as two lines each");
  assert.equal($$(`${T("lewis-svg")} .vx-lewis-dots g > g`).length, 4, "two lone pairs on each oxygen");
  await build("H", "H", 2, 0); assert.ok($$(T("lewis-warning")).length >= 1, "hydrogen with two bonds warns");
  await build("N", "H", 4, 0); assert.match(txt(T("lewis-panel")), /net formal charge of \+1/);
  await build("B", "F", 3, 0); assert.equal($$(T("lewis-warning")).length, 0); assert.match(txt(T("lewis-panel")), /Exception: Incomplete octet/);
  await build("S", "F", 6, 0); assert.match(txt(T("lewis-panel")), /Exception: Expanded octet/);
  await build("C", "H", 5, 0); assert.ok($$(T("lewis-warning")).length >= 1, "carbon cannot exceed an octet"); assert.match(txt(T("lewis-panel")), /period 2/);
  await click(T("card-tab-model"));
});

console.log("Molecules tab");
await test("library grouped by electron-domain count; all 14 required molecules; each loads the validated data", async () => {
  await click(T("tab-molecules")); assert.ok($(T("molecule-library"))); assert.equal($(T("btn-undo")), null, "no builder buttons here");
  assert.deepEqual($$(".vx-lib-group").map((g) => g.getAttribute("aria-label").split(",")[0]), ["2 electron domains", "3 electron domains", "4 electron domains", "5 electron domains", "6 electron domains"]);
  const want = { becl2: ["AX₂", "Linear"], co2: ["AX₂", "Linear"], bf3: ["AX₃", "Trigonal planar"], ch4: ["AX₄", "Tetrahedral"], nh3: ["AX₃E", "Trigonal pyramidal"], h2o: ["AX₂E₂", "Bent"], so2: ["AX₂E", "Bent"], pcl5: ["AX₅", "Trigonal bipyramidal"], sf4: ["AX₄E", "Seesaw"], clf3: ["AX₃E₂", "T-shaped"], xef2: ["AX₂E₃", "Linear"], sf6: ["AX₆", "Octahedral"], brf5: ["AX₅E", "Square pyramidal"], xef4: ["AX₄E₂", "Square planar"] };
  for (const [id, [axe, mg]] of Object.entries(want)) { await click(T(`mol-${id}`)); assert.equal(dd("row-axe"), axe, id); assert.equal(dd("row-mg"), mg, id); assert.equal($(T(`mol-${id}`)).getAttribute("aria-pressed"), "true"); }
  await click(T("mol-so2")); assert.equal(dd("row-domains"), "3 (2 bonding + 1 lone pair)"); assert.equal(dd("row-ed"), "Trigonal planar");
  await click(T("mol-sf4")); assert.match(dd("row-angle"), /173.*102/); await click(T("why-toggle")); assert.match(txt(T("why-text")), /equatorial/);
});
await test("search filters by formula, name and geometry; empty result explained; Molecules keeps its own view options", async () => {
  await setInput(T("molecule-search"), "seesaw"); assert.deepEqual($$('[data-testid^="mol-"]').map((b) => b.getAttribute("data-testid")), ["mol-sf4"]);
  await setInput(T("molecule-search"), "water"); assert.deepEqual($$('[data-testid^="mol-"]').map((b) => b.getAttribute("data-testid")), ["mol-h2o"]);
  await setInput(T("molecule-search"), "zzz"); assert.ok($(T("library-empty"))); await setInput(T("molecule-search"), "");
  assert.equal($(T("opt-angles")).checked, true, "angles on by default in Molecules"); assert.equal($(T("opt-repulsion")).checked, false);
});
await test("tabs do not mix state: Build keeps its model, Molecules keeps its molecule; Open in Build copies as one undo step", async () => {
  await click(T("tab-build")); const before = dd("row-axe"); assert.equal(before, "AX₅");
  await click(T("tab-molecules")); assert.equal($(T("mol-sf4")).getAttribute("aria-pressed"), "true", "Molecules remembers its selection");
  await click(T("mol-xef4")); await click(T("tab-build")); assert.equal(dd("row-axe"), before, "Build untouched by the Molecules selection");
  await click(T("tab-molecules")); assert.equal($(T("mol-xef4")).getAttribute("aria-pressed"), "true"); await click(T("open-in-build"));
  assert.equal($(T("tab-build")).getAttribute("aria-selected"), "true"); assert.equal(dd("row-axe"), "AX₄E₂"); await click(T("btn-undo")); assert.equal(dd("row-axe"), before);
});

console.log("Challenge tab");
await test("Predict -> Build -> Observe -> Explain with constructive feedback, one molecule at a time", async () => {
  await click(T("tab-challenge")); assert.equal($(T("challenge-panel")).getAttribute("data-step"), "predict"); assert.match(txt(T("challenge-molecule")), /H₂O/);
  assert.ok($(T("ch-to-build")).disabled); assert.equal($$('[data-testid^="ans-"]').length, 6);
  await setSelect(T("ans-domains"), "3"); await setSelect(T("ans-lonePairs"), "1"); await setSelect(T("ans-ed"), "Trigonal planar"); await setSelect(T("ans-mg"), "Bent"); await setSelect(T("ans-axe"), "AX2E"); await setSelect(T("ans-angle"), "120");
  assert.ok(!$(T("ch-to-build")).disabled); await click(T("ch-to-build")); assert.equal($(T("challenge-panel")).getAttribute("data-step"), "build");
  assert.match(txt(T("build-summary")), /Nothing built yet/); await click(T("tool-atom-O")); await click(T("tool-atom-H")); await click(T("tool-atom-H")); await click(T("tool-lp")); await click(T("tool-lp"));
  assert.match(txt(T("build-summary")), /AX₂E₂/); assert.equal(dd("row-axe"), "", "no info rows in the Challenge tab before the check");
  await click(T("ch-check")); assert.equal($(T("challenge-panel")).getAttribute("data-step"), "observe");
  assert.equal(txt(T("ch-score")), "1 of 6 correct"); assert.ok($(T("res-mg")).classList.contains("is-ok")); assert.ok($(T("res-domains")).classList.contains("is-bad"));
  assert.match(txt(T("build-compare")), /matches H₂O/); assert.ok($(T("show-real")) && $(T("show-mine")));
  await click(T("ch-to-explain")); assert.match(txt(T("ch-explain")), /Electron domains:.*2 H atoms|Electron domains:.*surrounding atom/i); assert.match(txt(T("ch-explain")), /Lone pair|lone pair/);
  await click(T("ch-next")); assert.equal($(T("challenge-panel")).getAttribute("data-step"), "predict"); assert.match(txt(T("challenge-molecule")), /CH₄/);
});
await test("a fully correct prediction is confirmed; Build tab is unaffected by the Challenge build", async () => {
  for (const [k, v] of Object.entries({ domains: "4", lonePairs: "0", ed: "Tetrahedral", mg: "Tetrahedral", axe: "AX4", angle: "109.5" })) await setSelect(T(`ans-${k}`), v);
  await click(T("ch-to-build")); await click(T("ch-check")); assert.equal(txt(T("ch-score")), "6 of 6 correct"); await click(T("ch-to-explain")); assert.match(txt(T("ch-explain")), /Every answer is correct/);
  await click(T("tab-build")); assert.equal(dd("row-axe"), "AX₅", "Build model unchanged by the Challenge");
});
await test("header Reset acts on the active tab only", async () => {
  await click(T("tab-molecules")); await click(T("mol-nh3")); await click(T("reset")); assert.equal($(T("mol-ch4")).getAttribute("aria-pressed"), "true");
  await click(T("tab-build")); assert.equal(dd("row-axe"), "AX₅"); await click(T("reset")); assert.ok($(T("empty-hint")));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
