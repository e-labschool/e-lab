#!/usr/bin/env node
// jsdom UI tests for the Intermolecular Forces Visualiser:  node scripts/test-imf-ui.mjs
// Renders the REAL VSEPRExplorer3D into jsdom (no layout, no canvas, no WebGL -> the WebGL-less fallback path) and drives it
// with DOM events. Honest limits: pointer dragging in 3D, geometry on screen, clipping and the three.js scene are covered by
// the pure model tests (test-vsepr-model.mjs) and headless Chromium (scripts/verify-vsepr-explorer.mjs); this file checks
// behaviour and state wiring: registration, tabs, tray, force selector, lessons, Heat & Phase Change readouts, graph, Intra/Inter popover.
// Pointer dragging, 3D pixels and layout are covered by headless Chromium (scripts/verify-intermolecular-forces.mjs).
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { register } from "node:module";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/simulation/intermolecular-forces-visualiser", pretendToBeVisual: true });
for (const k of ["window", "document", "HTMLElement", "HTMLInputElement", "HTMLSelectElement", "Node", "MouseEvent", "KeyboardEvent", "Event", "MutationObserver", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"]) {
  try { globalThis[k] = dom.window[k]; } catch { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true }); }
}
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
dom.window.HTMLCanvasElement.prototype.getContext = () => null;
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.IS_REACT_ACT_ENVIRONMENT = false;
window.addEventListener("error", (e) => console.log("WINERR", e.message, (e.error?.stack || "").split("\n").slice(0, 5).join("\n")));
register("./jsx-loader-hooks.mjs", import.meta.url);
register("./image-viewer-loader-hooks.mjs", import.meta.url);

const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const Hyb = (await import("../src/engines/intermolecular-forces-visualiser/IntermolecularForcesVisualiser.jsx")).default;
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
  await until(() => $(T("imf-workspace")), 5000, "workspace"); await tick(80);
}

console.log("Registration");
await test("registered in both registries and the resource registry", () => {
  assert.equal(SIMULATION_REGISTRY["intermolecular-forces-visualiser"].label, "Intermolecular Forces Visualiser"); assert.ok(SIMULATION_COMPONENTS["intermolecular-forces-visualiser"]);
  assert.equal(getSimulationIdForTitle("Intermolecular Forces Visualiser"), "intermolecular-forces-visualiser");
  const r = resourcesById["intermolecular-forces-visualiser"]; assert.ok(r && r.status === "live" && r.resourceType === "simulation");
});

console.log("Explore");
await mount();
await test("exactly two tabs: Explore | Learn; WebGL-less fallback shows and controls still work", () => {
  assert.ok($(T("tab-explore")) && $(T("tab-learn"))); assert.ok($(T("webgl-fallback")), "fallback"); assert.ok($(T("molecule-tray")));
});
await test("tray lists the required nonpolar and polar molecules", () => {
  const ids = (sec) => $$(`${T(sec)} [data-molecule]`).map((e) => e.dataset.molecule);
  assert.deepEqual(ids("tray-nonpolar"), ["H2", "N2", "O2", "Cl2", "CH4", "CO2", "Ar", "I2"]); assert.deepEqual(ids("tray-polar"), ["HCl", "HBr", "SO2", "H2O", "NH3", "HF"]);
  assert.equal($$(`${T("molecule-tray")} canvas`).length, 0, "icons are SVG, not live canvases");
});
await test("four force buttons; the London-dispersion note is always shown", () => {

  assert.equal($$(`${T("force-selector")} [role=radio]`).length, 4); assert.match(txt(T("ldf-note")), /all/);
});
await test("click adds molecules (max 6), Clear empties, and the narration explains an inapplicable force", async () => {
  await click(T("tray-H2")); await click(T("tray-HCl")); assert.match(txt(T("tray-panel")), /2\/6/);
  await click(T("force-hbond")); assert.match(txt(T("what-is-happening")), /hydrogen bond|H-bond|lone pair|N, O or F/i);
  await click(T("force-dip-ind")); assert.ok(txt(T("what-is-happening")).length > 20);
  for (let i = 0; i < 6; i += 1) await click(T("tray-Ar")); assert.match(txt(T("tray-panel")), /6\/6/); assert.ok($(T("notice")), "full workspace message");
  await click(T("clear-workspace")); assert.match(txt(T("tray-panel")), /0\/6/); assert.ok($(T("empty-hint")));
});
await test("Ball/Cloud and delta toggles reflect state", async () => {
  await click(`${T("view-switch")} [role=radio]:nth-child(2)`); assert.equal($(`${T("view-switch")} [role=radio]:nth-child(2)`).getAttribute("aria-checked"), "true"); assert.ok($(T("cloud-legend")));
  assert.match(txt(T("cloud-legend")), /electrostatic potential colouring/i); assert.match(txt(T("cloud-legend")), /qualitative/i);
  await click(T("delta-toggle")); assert.equal($(T("delta-toggle")).getAttribute("aria-pressed"), "true");
  await click(`${T("view-switch")} [role=radio]:nth-child(1)`);
});
await test("Intra vs Inter popover covers covalent, ionic, metallic, the Bonding Visualizer link and the four forces", async () => {
  const btn = $(`${T("intra-inter")} button`) ?? $(T("intra-inter")); await click(btn); await until(() => $(T("intra-inter-panel")), 2000, "panel");
  for (const k of ["covalent", "ionic", "metallic"]) assert.ok($(T(`ii-${k}`)), k);
  assert.match(txt(T("ii-text")), /O.?H|water/i); await click(T("ii-ionic")); assert.match(txt(T("ii-text")), /lattice/i); assert.doesNotMatch(txt(T("ii-text")), /ionic molecule/i);
  await click(T("ii-metallic")); assert.match(txt(T("ii-text")), /Cu|metal/i); assert.equal($(T("ii-link")).getAttribute("href"), "/simulation/bonding-visualizer");
  const t = txt(T("intra-inter-panel")); for (const w of [/dispersion/i, /induced/i, /dipole/i, /hydrogen/i]) assert.match(t, w);
});

console.log("Learn");
const pause = async () => { if (/Pause/.test(txt(T("btn-play")))) await click(T("btn-play")); };
await test("four lessons (data-driven step lists); Next/Previous jump at once; every step text is the lesson's own sentence; Replay restarts", async () => {
  await click(T("tab-learn")); await until(() => $(T("learn-chamber")), 2000, "learn"); assert.equal($$('[data-testid^="lesson-"]').length, 4);
  const { LESSONS } = await import("../src/engines/intermolecular-forces-visualiser/model/lessons.js");
  assert.deepEqual(LESSONS.map((l) => l.pair.join("+")), ["H2+H2", "HCl+H2", "HCl+HCl", "H2O+H2O"]);
  for (const l of LESSONS) {
    await click(T(`lesson-${l.id}`)); await pause(); await click(T("btn-replay")); await pause(); await click(T("step-0")); assert.match(txt(T("live-step")), new RegExp(`1 / ${l.steps.length}`));
    for (let i = 0; i < l.steps.length - 1; i += 1) { assert.equal(txt(T("what-is-happening")), l.steps[i].text); await click(T("btn-next")); assert.match(txt(T("live-step")), new RegExp(`${i + 2} / ${l.steps.length}`)); }
    assert.equal(txt(T("what-is-happening")), l.steps[l.steps.length - 1].text); assert.ok($(T("btn-next")).disabled);
    await click(T("btn-prev")); assert.match(txt(T("live-step")), new RegExp(`${l.steps.length - 1} / ${l.steps.length}`)); await click(T("step-0")); assert.ok($(T("btn-prev")).disabled);
  }
  assert.ok(!$(T("btn-freeze")), "Learn keeps minimal controls: Play/Pause, Previous, Next, Replay, Try in Explore");
});
await test("the Learn step survives switching to Explore and back (session state)", async () => {
  await click(T("lesson-dip-dip")); await pause(); await click(T("step-2")); assert.match(txt(T("live-step")), /3 \/ 5/);
  await click(T("tab-explore")); await click(T("tab-learn")); await pause(); assert.match(txt(T("live-step")), /3 \/ 5/); assert.equal($(T("lesson-dip-dip")).getAttribute("aria-checked"), "true");
});
await test("Try in Explore transfers molecules and force (H-bond lesson: two waters, hydrogen bonding)", async () => {
  await click(T("lesson-hbond")); await pause(); await click(T("step-3")); await click(T("btn-try-explore")); await until(() => $(T("explore-chamber")), 2000, "explore");
  assert.match(txt(T("tray-panel")), /2\/6/); assert.equal($(T("force-hbond")).getAttribute("aria-checked"), "true");
});
await test("Play / Next click -> first visible change is quick and builds no geometry", async () => {
  const G = await import("../src/engines/intermolecular-forces-visualiser/scene/cloudGeometry.js");
  await click(T("tab-learn")); await click(T("lesson-dip-ind")); await pause(); await click(T("step-0")); const built0 = G.stats.built;
  const t0 = performance.now(); $(T("btn-play")).dispatchEvent(new window.MouseEvent("click", { bubbles: true })); while (!/Pause/.test(txt(T("btn-play"))) && performance.now() - t0 < 400) await new Promise((r) => setTimeout(r, 2));
  assert.ok(performance.now() - t0 < 100, "Play label toggled quickly"); await pause();
  const t1 = performance.now(); $(T("btn-next")).dispatchEvent(new window.MouseEvent("click", { bubbles: true })); while (!/2 \/ 5/.test(txt(T("live-step"))) && performance.now() - t1 < 400) await new Promise((r) => setTimeout(r, 2));
  assert.ok(performance.now() - t1 < 100, "Next updates the step at once"); assert.equal(G.stats.built, built0, "no clouds built on the Play / Next path");
});

console.log("Heat & Phase Change");
await test("opening the heat view: six substances, CO2 note, graph toggle, Compare switch", async () => {
  await click(T("tab-explore")); await click(T("btn-heat-view")); await until(() => $(T("heat-chamber")), 2000, "heat");
  assert.deepEqual($$('[data-testid^="sub-"]').map((e) => e.dataset.testid), ["sub-H2O", "sub-NH3", "sub-HCl", "sub-CH4", "sub-I2", "sub-Ar"]);
  assert.match(txt(T("co2-note")), /sublim/i); assert.ok($(T("compare-ionic")));
});
await test("Heat raises the energy; the plateau holds the melting point; readouts and graph agree", async () => {
  await click(T("btn-heat")); await until(() => /Melting/i.test(txt(T("heat-phase"))), 15000, "melting plateau");
  assert.equal(txt(T("heat-temp")).replace(/\s/g, ""), "273K"); const fig = $(T("heating-graph")); assert.equal(fig.dataset.phase, "melting"); assert.ok(Math.abs(Number(fig.dataset.temp) - 273.15) < 0.1);
  await click(T("btn-pause")); await tick(300); const e1 = $(T("heating-graph")).dataset.energy; await tick(300); assert.equal($(T("heating-graph")).dataset.energy, e1, "Pause holds the energy");
});
await test("every molecular substance starts as a solid below its melting point; Reset returns to the start", async () => {
  const { SUBSTANCES, MOLECULAR_SUBSTANCES } = await import("../src/engines/intermolecular-forces-visualiser/model/phase.js");
  for (const id of MOLECULAR_SUBSTANCES) { await click(T(`sub-${id}`)); await click(T("btn-heat-reset")); await tick(150); assert.match(txt(T("heat-phase")), /Solid/i, id); assert.ok(parseFloat(txt(T("heat-temp"))) < SUBSTANCES[id].Tm, id); }
});
await test("Compare with Ionic Solid adds NaCl readouts and never calls NaCl a molecule", async () => {
  await click(`${T("compare-ionic")} input`).catch(() => {}); if (!$(T("heat-temp-ion"))) await click(T("compare-ionic"));
  await until(() => $(T("heat-temp-ion")), 3000, "NaCl readout"); const all = document.body.textContent; assert.doesNotMatch(all, /NaCl molecule|sodium chloride molecule/i); assert.match(all, /ionic/i);
});
await test("Back to molecules returns to the workspace", async () => { await click(T("heat-back")); await until(() => $(T("explore-chamber")), 2000, "explore"); });

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
