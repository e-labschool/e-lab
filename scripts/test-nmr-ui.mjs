#!/usr/bin/env node
// jsdom UI tests for the Spectroscopy Simulation Lab shell:  node scripts/test-nmr-ui.mjs
// Renders the REAL SpectroscopyStudio (with Agent B's real molecular stages) into jsdom (no layout, no WebGL).
// Honest limits: 3D scenes, SVG geometry, clipping, overflow and frame timing are NOT checked here (see
// scripts/verify-spectroscopy-studio.mjs in headless Chromium); this checks registration, navigation, state wiring and controls.
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { register } from "node:module";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/simulation/spectroscopy-studio", pretendToBeVisual: true });
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
const Studio = (await import("../src/engines/spectroscopy-studio/SpectroscopyStudio.jsx")).default;
const { SIMULATION_REGISTRY } = await import("../src/data/simulationRegistry.js");
const { SIMULATION_COMPONENTS } = await import("../src/data/simulationEngineComponents.js");
const h = React.createElement;

let passed = 0; let failed = 0;
async function test(name, fn) { try { await fn(); console.log(`  ok   ${name}`); passed += 1; } catch (e) { console.log(`  FAIL ${name}\n       ${(e.stack || e.message).split("\n").slice(0, 6).join("\n       ")}`); failed += 1; } }
const tick = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const T = (id) => `[data-testid="${id}"]`;
const txt = (sel) => ($(sel)?.textContent ?? "").replace(/\s+/g, " ").trim();
const click = async (sel) => { const el = typeof sel === "string" ? $(sel) : sel; assert.ok(el, `missing ${sel}`); el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); await tick(); };
async function until(fn, ms = 5000, label = "condition") { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return; await tick(25); } throw new Error(`timed out waiting for ${label}`); }
const byText = (sel, re) => $$(sel).find((e) => re.test(e.textContent));
let mounted = null;
async function mount() {
  if (mounted) { mounted.root.unmount(); mounted.host.remove(); mounted = null; }
  try { window.sessionStorage.clear(); } catch { /* ignore */ }
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  root.render(h(Studio, { standalone: true })); mounted = { root, host };
  await until(() => $(T("spectroscopy-workspace")) && $(T("stage-stepper")), 6000, "workspace"); await tick(100);
}

console.log("Registration");
await test("registered under spectroscopy-studio", () => { assert.equal(SIMULATION_REGISTRY["spectroscopy-studio"].label, "Spectroscopy Simulation Lab"); assert.ok(SIMULATION_COMPONENTS["spectroscopy-studio"]); });

console.log("Navigation");
await mount();
await test("five technique tabs in the required order", () => {
  const ids = ["ms", "ir", "nmr", "splitting", "structure"]; ids.forEach((i) => assert.ok($(T(`tech-${i}`)), i));
  assert.equal($$(`[data-testid^="tech-"]`).length, 5);
});
await test("stepper has five stages and starts on Principle", () => {
  assert.equal($$(`[data-testid^="stage-"]`).filter((e) => /^stage-(principle|instrument|molecular|spectrum|interpretation)$/.test(e.dataset.testid)).length, 5);
  assert.equal($(T("stage-box")).dataset.stage, "principle");
});
await test("free movement between all stages", async () => {
  for (const s of ["interpretation", "instrument", "spectrum", "molecular", "principle"]) { await click(T(`stage-${s}`)); await until(() => $(T("stage-box")).dataset.stage === s, 3000, s); }
});
await test("experiment state survives leaving and returning to a stage", async () => {
  await click(T("stage-principle")); await click(T("act-p-field")); await tick(100);
  const slider = $$("input[type=range]")[0]; assert.ok(slider, "slider");
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; set.call(slider, "5"); slider.dispatchEvent(new window.Event("input", { bubbles: true })); slider.dispatchEvent(new window.Event("change", { bubbles: true })); await tick(100);
  const before = $$("input[type=range]")[0].value;
  await click(T("stage-instrument")); await click(T("stage-molecular")); await click(T("stage-principle")); await tick(150);
  assert.equal($$("input[type=range]")[0].value, before, "B0 slider kept");
  assert.ok(Math.abs(Number(before) - 5) < 0.51, `slider ${before}`);
});
await test("stage 2 has the two activities and the six guided steps", async () => {
  await click(T("stage-instrument")); await tick(100);
  assert.ok($(T("act-i-spectrometer")) && $(T("act-i-signal")));
  assert.equal($$(`[data-testid^="step-"]`).filter((e) => /^step-\d$/.test(e.dataset.testid)).length, 6);
  assert.ok(/illustrative instrument model/i.test(document.body.textContent), "labelled illustrative");
});
await test("instrument components are keyboard-reachable buttons and select/deselect", async () => {
  const comps = $$("g[role=button]"); assert.ok(comps.length >= 6, `components ${comps.length}`);
  await click(T("list-magnet")); assert.equal($(T("list-magnet")).getAttribute("aria-pressed"), "true"); assert.ok($(T("comp-purpose")));
  await click(T("whole-instrument")); assert.ok(!$(T("comp-purpose")));
});
await test("guided step 6 states the spectrum is computed, not measured directly", async () => {
  await click(T("step-6")); await tick(100); assert.ok(/not measured directly|never measures the spectrum directly/i.test(txt(T("what-is-happening"))), txt(T("what-is-happening")));
});
await test("FID activity: transform to spectrum control exists", async () => { await click(T("act-i-signal")); await tick(100); assert.ok(byText("button", /Transform to Spectrum/i)); });

console.log("Placeholders");
await test("Mass Spectrometry and IR are honest placeholders", async () => {
  await click(T("tech-ms")); assert.ok($(T("dev-ms")) && /development/i.test(txt(T("dev-ms"))));
  await click(T("tech-ir")); assert.ok($(T("dev-ir")));
  await click(T("tech-structure")); assert.ok($(T("dev-structure")));
});
await test("returning to NMR restores the stage", async () => { await click(T("tech-nmr")); await until(() => $(T("stage-box")).dataset.stage === "instrument", 3000, "stage restored"); });
await test("Splitting Patterns tab shows B's SplittingLab (not a placeholder)", async () => { await click(T("tech-splitting")); await tick(200); assert.ok(!$(T("dev-splitting"))); assert.ok($(T("stage-box")).textContent.length > 50); await click(T("tech-nmr")); });

console.log("Modes and controls");
await test("teacher/student switch", async () => {
  const t = byText(`${T("mode-switch")} button`, /Teacher/); const s = byText(`${T("mode-switch")} button`, /Student/); assert.ok(t && s);
  await click(t); assert.ok(/Teacher/.test(txt(T("mode-status")))); await click(T("stage-principle")); await tick(100); assert.ok($(".ss-teacher"), "teacher notes visible");
  await click(s); assert.ok(/Student/.test(txt(T("mode-status"))));
});
await test("split view toggles", async () => { const b = $(T("split-toggle")); const v = b.getAttribute("aria-pressed"); await click(b); assert.notEqual($(T("split-toggle")).getAttribute("aria-pressed"), v); });
await test("playback controls: play/pause/step/reset/speed", async () => {
  ["btn-play", "btn-pause", "btn-step-back", "btn-step-forward", "btn-reset-playback"].forEach((i) => assert.ok($(T(i)), i));
  await click(T("btn-play")); assert.ok($(T("btn-pause")) && !$(T("btn-pause")).disabled); await click(T("btn-pause"));
  const speeds = $$(`${T("speed-switch")} button`).map((b) => b.textContent.trim()); assert.deepEqual(speeds, ["0.25×", "0.5×", "1×", "2×"]);
  await click(byText(`${T("speed-switch")} button`, /2×/)); assert.ok(/pedagogical/i.test(txt(T("time-note"))));
});

console.log(`\n${passed} passed, ${failed} failed`);
mounted?.root.unmount();
process.exit(failed ? 1 : 0);
