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
  await click(T("step-3")); await tick(120); assert.ok(/simplified continuous-wave NMR resonance response/i.test(document.body.textContent), "CW title");
  await click(T("step-2")); await tick(120);
  assert.ok(Math.abs(Number($$("input[type=range]")[0].value) - 5) < 0.51, `slider ${$$("input[type=range]")[0].value}`);
});
const SPIN_NOTE = "Proton spin is a quantum property. The rotating sphere is a simplified conceptual representation, not a proton literally rotating like a planet.";
const setRange = async (sel, v) => { const el = $(sel); assert.ok(el, `missing ${sel}`); Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, String(v)); el.dispatchEvent(new window.Event("input", { bubbles: true })); el.dispatchEvent(new window.Event("change", { bubbles: true })); await tick(80); };

console.log("Steps 1-3: proton model, field splitting, RF resonance");
await test("step 1: exact spin clarification (single nucleus and sample), arrow legend, no stick wording", async () => {
  await click(T("step-1")); await tick(150);
  assert.equal(txt(T("spin-note")), SPIN_NOTE); assert.ok(byText(".ss-legend li", /arrow: magnetic moment/i), "arrow legend"); assert.ok(byText(".ss-legend li", /sphere: a proton/i), "sphere legend");
  assert.ok(!/stick|line: orientation/i.test(document.body.textContent), "old stick legend is gone");
  await click(T("show-sample")); await until(() => Number($(T("sample-state")).getAttribute("data-progress")) > 0.97, 6000, "sample"); assert.equal(txt(T("spin-note")), SPIN_NOTE); assert.ok(/no preferred orientation/i.test(txt(T("step-panel"))));
  await click(T("show-single")); await until(() => Number($(T("sample-state")).getAttribute("data-progress")) < 0.05, 6000, "single");
});
await test("step 2: Apply B0 shows alpha / beta levels, dE = h nu0, a labelled B0 arrow and the clarification; B0 slider moves the gap and nu0", async () => {
  await click(T("step-2")); await tick(150); await setRange(T("b0-slider"), 9.4);
  assert.ok($(T("level-degenerate")), "degenerate before B0"); assert.equal(txt(T("spin-note")), SPIN_NOTE); assert.ok(!$(T("precession-note")), "no precession text before B0");
  await click(T("apply-field")); await until(() => Number($(T("levels-diagram")).getAttribute("data-p")) > 0.97, 8000, "levels split");
  assert.ok($(T("level-alpha")) && $(T("level-beta")), "alpha / beta levels"); const lv = txt(T("levels-diagram"));
  for (const t of ["α", "β", "lower energy", "higher energy", "ΔE = hν₀", "B₀ =", "Larmor frequency (ν₀)", "ν₀ = γB₀/2π"]) assert.ok(lv.includes(t), `levels diagram says ${t}`);
  assert.ok($(T("b0-arrow")), "B0 arrow element"); assert.ok(/precesses/i.test(txt(T("precession-note"))));
  assert.ok(byText(".ss-legend li", /α: moment along B₀/) && byText(".ss-legend li", /β: moment against B₀/) && byText(".ss-legend li", /precession/i), "legend labels alpha, beta and the precession ring");
  const gap0 = Number($(T("levels-diagram")).getAttribute("data-gap")); const nu0 = txt(T("nu0-eq")); assert.ok(nu0.includes("400.2 MHz"), nu0);
  await setRange(T("b0-slider"), 12); await tick(150);
  assert.ok(Number($(T("levels-diagram")).getAttribute("data-gap")) > gap0, "the gap grows with B0"); assert.ok(txt(T("nu0-eq")).includes("510.9 MHz"), txt(T("nu0-eq"))); assert.ok(txt(T("what-is-happening")).includes("510.9 MHz"));
  await setRange(T("b0-slider"), 9.4);
});
await test("step 3: ONE wave, the second waveform ('The proton's own frequency') is gone, required labels and equations are present", async () => {
  await click(T("step-3")); await tick(200);
  const body = document.body.textContent;
  assert.ok(!/own frequency/i.test(body), "second waveform label is gone"); assert.ok(!/Incoming RF wave \(frequency/.test(body));
  assert.equal($$(T("rf-wave-line")).length, 1, "exactly one wave"); assert.ok(/Incoming RF wave/.test(txt(T("rf-wave"))));
  assert.equal(txt(T("cw-label")), "Simplified continuous-wave NMR resonance response"); assert.ok(/introductory frequency-sweep model/.test(txt(T("cw-caveat"))) && /not the direct output of a modern pulsed Fourier-transform NMR experiment/.test(txt(T("cw-caveat"))));
  assert.ok(body.includes("RF frequency offset from resonance (Hz)") && body.includes("Relative excitation / absorption response"), "axis labels");
  assert.ok(txt(T("larmor-note")).includes("Larmor frequency (ν₀)")); assert.ok(txt(T("larmor-note")).includes("The Larmor frequency is the precession frequency of a proton's magnetic moment in an external magnetic field. It also corresponds to the energy difference between the two nuclear spin states."));
  const lv = txt(T("levels-diagram")); for (const t of ["α", "β", "ΔE = hν₀", "ν₀ = γB₀/2π", "Larmor frequency (ν₀)", "one nucleus (teaching model)"]) assert.ok(lv.includes(t), `levels diagram says ${t}`);
  assert.ok(/ensemble/.test(txt(T("ensemble-note"))) && /coherent transverse magnetisation/.test(txt(T("ensemble-note"))) && /FID/.test(txt(T("ensemble-note"))) && /Fourier transform/.test(txt(T("ensemble-note"))));
  assert.ok($(T("moment-arrow")) && $(T("moment-arrowhead")) && $(T("rf-b0-arrow")) && $(T("b0-arrow")), "arrow elements exist (moment with head, B0)"); assert.ok($(T("precession-cone")), "cone of precession");
  assert.equal($$("input[type=range]").length, 1, "one primary control: the RF frequency slider");
});
await test("step 3: 'Off resonance' / 'Resonance achieved' switch with the slider, with a smooth gradation in between", async () => {
  const state = () => txt(T("rf-state-text")); const region = () => $(T("rf-view")).getAttribute("data-region");
  const slider = $(T("rf-slider")); assert.equal(slider.min, "-100"); assert.equal(slider.max, "100");
  await setRange(T("rf-slider"), 40); assert.equal(state(), "Off resonance"); assert.equal(txt(T("resonance-state")), "Off resonance"); assert.equal(region(), "off");
  assert.ok(!$(T("transition-arrow")) || Number($(T("transition-arrow")).getAttribute("data-opacity")) < 0.1, "no transition arrow off resonance"); assert.ok(/hν_RF ≠ ΔE/.test(txt(T("photon-eq"))));
  const gapOff = $(T("levels-diagram")).getAttribute("data-gap");
  const seen = [];
  for (const v of [40, 25, 15, 8, 0]) { await setRange(T("rf-slider"), v); seen.push(Number($(T("levels-diagram")).getAttribute("data-response"))); }
  assert.ok(seen.every((x, i) => i === 0 || x > seen[i - 1]), `response grows smoothly towards resonance: ${seen}`);
  assert.equal(state(), "Resonance achieved"); assert.equal(txt(T("resonance-state")), "Resonance achieved"); assert.equal(region(), "on");
  assert.equal($(T("levels-diagram")).getAttribute("data-gap"), gapOff, "the levels never move with the RF");
  assert.ok($(T("transition-arrow")) && Number($(T("transition-arrow")).getAttribute("data-opacity")) > 0.99, "full transition arrow on resonance"); assert.ok(/hν_RF = ΔE/.test(txt(T("photon-eq"))));
  assert.equal($(T("cw-indicator")).getAttribute("data-x"), $(T("cw-indicator")).getAttribute("data-x0"), "indicator sits on the 0 Hz marker at resonance");
  await setRange(T("rf-slider"), 15); assert.equal(state(), "Near resonance"); const op = Number($(T("transition-arrow")).getAttribute("data-opacity")); assert.ok(op > 0.1 && op < 0.9, `partial arrow ${op}`);
  assert.notEqual($(T("cw-indicator")).getAttribute("data-x"), $(T("cw-indicator")).getAttribute("data-x0"));
  assert.ok(byText("[data-testid^=chain-]", /Matching RF energy/) && $(T("chain-match")).getAttribute("data-state") === "current" && $(T("chain-absorb")).getAttribute("data-state") === "pending");
  await setRange(T("rf-slider"), 0); assert.ok($(T("chain-absorb")).getAttribute("data-state") === "current" && $(T("chain-resonance")).getAttribute("data-state") === "done");
});
await test("step 3: the excited-state (beta) population rises during irradiation on resonance, stays bounded, and does not move off resonance", async () => {
  await setRange(T("rf-slider"), 0); const b0 = Number($(T("bar-beta")).getAttribute("data-fraction")); const d0 = Number($(T("irradiation")).getAttribute("data-d"));
  await tick(1500); const b1 = Number($(T("bar-beta")).getAttribute("data-fraction")); const d1 = Number($(T("irradiation")).getAttribute("data-d"));
  assert.ok(b1 > b0 && d1 < d0, `beta rose ${b0} -> ${b1}`); assert.ok(b1 <= Number($(T("bar-alpha")).getAttribute("data-fraction")), "beta never above alpha"); assert.ok(d1 >= 0.5 - 1e-9, "never beyond the saturation bound");
  await setRange(T("rf-slider"), 90); await tick(1200); assert.ok(Number($(T("irradiation")).getAttribute("data-d")) > 0.98, "far off resonance the populations hardly change");
  await setRange(T("rf-slider"), 0);
});
await test("reduced motion: step 3 is static but informative (arrows, labels, final population state), steps 1-2 keep their texts", async () => {
  const saved = dom.window.matchMedia; dom.window.matchMedia = (q) => ({ matches: /reduce/.test(q), addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  try {
    await mount(); await click(T("step-3")); await tick(200);
    await setRange(T("rf-slider"), 0); await tick(100); const d = Number($(T("irradiation")).getAttribute("data-d")); await tick(300);
    assert.equal(Number($(T("irradiation")).getAttribute("data-d")), d, "nothing animates"); assert.ok(d < 0.6, `shows the settled population state at once (${d})`);
    assert.ok($(T("moment-arrow")) && $(T("transition-arrow")) && /Resonance achieved/.test(txt(T("rf-state-text"))));
    const w1 = $(T("rf-wave-line")).getAttribute("points"); await tick(300); assert.equal($(T("rf-wave-line")).getAttribute("points"), w1, "the wave is still");
    await click(T("step-2")); await tick(150); assert.equal(txt(T("spin-note")), SPIN_NOTE);
  } finally { dom.window.matchMedia = saved; await mount(); }
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
await test("Mass Spectrometry and Structure Investigation are honest placeholders (IR is a live workspace, see test-ir-ui.mjs)", async () => {
  await click(T("tech-ms")); assert.ok($(T("dev-ms")) && /development/i.test(txt(T("dev-ms"))));
  await click(T("tech-ir")); assert.ok(!$(T("dev-ir")) && $(T("stage-box")));
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
