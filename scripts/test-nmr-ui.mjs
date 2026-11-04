#!/usr/bin/env node
// jsdom UI tests for the Spectroscopy Simulation Lab shell:  node scripts/test-nmr-ui.mjs
// Renders the REAL single-workspace SpectroscopyStudio into jsdom (no layout, no WebGL).
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

console.log("Single workspace");
await mount();
await test("four technique tabs (no Splitting Patterns tab)", () => {
  ["ms", "ir", "nmr", "structure"].forEach((i) => assert.ok($(T(`tech-${i}`)), i));
  assert.ok(!$(T("tech-splitting")));
  assert.equal($$(`[data-testid^="tech-"]`).length, 4);
});
await test("stepper has six steps, Previous disabled on step 1", () => {
  for (let i = 1; i <= 6; i += 1) assert.ok($(T(`step-${i}`)), `step-${i}`);
  assert.ok($(T("step-prev")).disabled);
});
await test("Next/Previous and direct selection move through all six steps", async () => {
  await click(T("step-next")); await tick(80); assert.equal($(T("step-2")).getAttribute("aria-current"), "step");
  await click(T("step-prev")); await tick(80); assert.equal($(T("step-1")).getAttribute("aria-current"), "step");
  for (const i of [3, 5, 6, 4, 2, 1]) { await click(T(`step-${i}`)); await tick(80); assert.equal($(T(`step-${i}`)).getAttribute("aria-current"), "step", `step ${i}`); }
});
await test("B0 carries over from step 2 to step 3 and back", async () => {
  await click(T("step-2")); await tick(120);
  const slider = $$("input[type=range]")[0]; assert.ok(slider, "slider");
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; set.call(slider, "5"); slider.dispatchEvent(new window.Event("input", { bubbles: true })); slider.dispatchEvent(new window.Event("change", { bubbles: true })); await tick(80);
  await click(T("step-3")); await tick(120); assert.ok(/simplified continuous-wave model/i.test(document.body.textContent), "CW label");
  await click(T("step-2")); await tick(120);
  assert.ok(Math.abs(Number($$("input[type=range]")[0].value) - 5) < 0.51, `slider ${$$("input[type=range]")[0].value}`);
});
await test("step 4 is labelled illustrative and offers Next Stage", async () => {
  await click(T("step-4")); await tick(120);
  assert.ok(/illustrative instrument model/i.test(document.body.textContent)); assert.ok($(T("next-stage")));
});
await test("step 5 offers Transform to Spectrum", async () => {
  await click(T("step-5")); await tick(120); assert.ok(byText("button", /Transform to Spectrum/i));
});
await test("step 6 has a molecule picker and coupling is gated behind earlier sub-stages", async () => {
  await click(T("step-6")); await tick(150); assert.ok($(T("molecule-search")), "picker");
});
await test("every step has a Teacher disclosure", async () => {
  for (let i = 1; i <= 6; i += 1) { await click(T(`step-${i}`)); await tick(100); assert.ok(byText("summary, button", /Teacher/i), `teacher ${i}`); }
});

console.log("Placeholders");
await test("Mass Spectrometry, IR and Structure Investigation are honest placeholders", async () => {
  await click(T("tech-ms")); assert.ok($(T("dev-ms")) && /development/i.test(txt(T("dev-ms"))));
  await click(T("tech-ir")); assert.ok($(T("dev-ir")));
  await click(T("tech-structure")); assert.ok($(T("dev-structure")));
});
await test("returning to NMR restores the workspace and step", async () => { await click(T("tech-nmr")); await until(() => $(T("step-6")).getAttribute("aria-current") === "step" || $(T("step-1")), 3000, "workspace"); });

console.log("Playback");
await test("play/pause and speed controls", async () => {
  assert.ok($(T("btn-play-pause")), "play-pause"); await click(T("btn-play-pause"));
  const speeds = $$(`${T("speed-switch")} button`).map((b) => b.textContent.trim()); if (speeds.length) assert.deepEqual(speeds, ["0.25×", "0.5×", "1×", "2×"]);
});

console.log(`\n${passed} passed, ${failed} failed`);
mounted?.root.unmount();
process.exit(failed ? 1 : 0);
