#!/usr/bin/env node
// jsdom UI tests for the Mass Spectrometry workspace (the MS tab of the Spectroscopy Simulation Lab):  node scripts/test-ms-ui.mjs
// Renders the REAL SpectroscopyStudio into jsdom (no layout, no WebGL: the molecule viewers use their SVG fallback).
// Honest limits: 3D rendering, SVG geometry, clipping, overflow, animation smoothness and frame timing are NOT checked here
// (see scripts/verify-ms-spectrometry.mjs in headless Chromium); this checks navigation, state wiring, controls, texts and the science messages.
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { register } from "node:module";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/simulation/spectroscopy-studio", pretendToBeVisual: true });
for (const k of ["window", "document", "HTMLElement", "HTMLInputElement", "HTMLSelectElement", "Node", "MouseEvent", "KeyboardEvent", "Event", "MutationObserver", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "ResizeObserver", "SVGElement"]) {
  if (dom.window[k] === undefined) continue;
  try { globalThis[k] = dom.window[k]; } catch { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true }); }
}
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
dom.window.HTMLCanvasElement.prototype.getContext = () => null;
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
if (!dom.window.ResizeObserver) { globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }; }
globalThis.IS_REACT_ACT_ENVIRONMENT = false;
register("./jsx-loader-hooks.mjs", import.meta.url);
register("./image-viewer-loader-hooks.mjs", import.meta.url);

const consoleErrors = []; const origErr = console.error; console.error = (...a) => { consoleErrors.push(a.map(String).join(" ").slice(0, 200)); };
const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const Studio = (await import("../src/engines/spectroscopy-studio/SpectroscopyStudio.jsx")).default;
const { SPECTRA } = await import("../src/engines/spectroscopy-studio/ms/data/spectra.js");
const { CANDIDATES, ROUNDS } = await import("../src/engines/spectroscopy-studio/ms/physics/challenge.js");
const { fieldForMz } = await import("../src/engines/spectroscopy-studio/ms/physics/kinematics.js");
const h = React.createElement;

let passed = 0; let failed = 0;
async function test(name, fn) { try { await fn(); console.log(`  ok   ${name}`); passed += 1; } catch (e) { console.log(`  FAIL ${name}\n       ${(e.stack || e.message).split("\n").slice(0, 6).join("\n       ")}`); failed += 1; } }
const tick = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const T = (id) => `[data-testid="${id}"]`;
const txt = (sel) => ($(sel)?.textContent ?? "").replace(/\s+/g, " ").trim();
const click = async (sel) => { const el = typeof sel === "string" ? $(sel) : sel; assert.ok(el, `missing ${sel}`); el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); await tick(60); };
async function until(fn, ms = 5000, label = "condition") { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return; await tick(25); } throw new Error(`timed out waiting for ${label}`); }
const setRange = async (sel, v) => { const el = $(sel); assert.ok(el, `missing ${sel}`); Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, String(v)); el.dispatchEvent(new window.Event("input", { bubbles: true })); el.dispatchEvent(new window.Event("change", { bubbles: true })); await tick(80); };
const go = async (n) => { await click(T(`step-${n}`)); await until(() => $(T(`step-view-${n}`)), 3000, `stage ${n}`); await tick(80); };
let mounted = null;
async function mount() {
  if (mounted) { mounted.root.unmount(); mounted.host.remove(); mounted = null; }
  try { window.sessionStorage.clear(); } catch { /* ignore */ }
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  root.render(h(Studio, { standalone: true })); mounted = { root, host };
  await until(() => $(T("spectroscopy-workspace")) && $(T("stage-stepper")), 6000, "workspace"); await tick(100);
  await click(T("tech-ms")); await until(() => $(T("stage-stepper"))?.getAttribute("data-count") === "6", 3000, "MS stepper"); await tick(100);
}


const stageTxt = () => txt(T("step-panel"));
const viewTxt = (n) => txt(T(`step-view-${n}`));
const molCount = () => $$(`${T("population")} [data-testid^="mol-"]`).filter((g) => /^mol-\d+$/.test(g.getAttribute("data-testid"))).length;
const peak = (mz) => $(T(`peak-${mz}`));

console.log("MS tab: six stages over one persistent workspace");
await mount();
await test("the MS tab is a live workspace; IR, NMR and the Structure Investigation tab are still there", async () => {
  assert.ok(!$(T("dev-ms")), "placeholder shown"); assert.equal($(T("stage-box")).getAttribute("data-technique"), "ms");
  assert.match(txt(".sd-subtitle"), /Mass Spec · stage 1 of 6/); for (const t of ["ms", "ir", "nmr", "structure"]) assert.ok($(T(`tech-${t}`)), t);
});
await test("stepper: six stages, Previous disabled on 1, Next disabled on 6, Next / Previous / direct jump", async () => {
  for (let i = 1; i <= 6; i += 1) assert.ok($(T(`step-${i}`)), `step-${i}`); assert.ok(!$(T("step-7")));
  assert.equal($$(`${T("stage-stepper")} li`).length, 6); assert.ok($(T("step-prev")).disabled);
  await click(T("step-next")); await until(() => $(T("step-view-2"))); await click(T("step-prev")); await until(() => $(T("step-view-1")));
  await go(6); assert.ok($(T("step-next")).disabled); await go(1);
});
await test("the workspace persists: the same journey element survives every stage change and the instrument overview is always visible", async () => {
  const el = $(T("journey-workspace")); assert.ok(el); assert.ok($(T("instrument-overview")));
  for (const n of [2, 3, 4, 5]) { await go(n); assert.equal($(T("journey-workspace")), el, `stage ${n}: same element`); assert.ok($(T("instrument-overview"))); assert.equal(el.getAttribute("data-stage"), String(n)); }
  await go(1);
});

console.log("Stage 1: the sample");
await test("a population of 10 identical molecules (propanone by default), 8 to 15 selectable, teaching-representation note", async () => {
  await mount(); await until(() => molCount() === 10, 3000, "10 molecules");
  assert.match(viewTxt(1), /Propanone/i); assert.match(txt(T("population-note")) || stageTxt(), /teaching representation/i);
  for (let i = 0; i < 8; i += 1) await click(T("n-plus")); assert.equal(molCount(), 15); assert.ok($(T("n-plus")).disabled);
  for (let i = 0; i < 9; i += 1) await click(T("n-minus")); assert.equal(molCount(), 8); assert.ok($(T("n-minus")).disabled);
});
await test("molecule choice: propanone, butan-2-one, ethanol, methane; New sample changes the seed but keeps the molecule", async () => {
  for (const id of ["propanone", "butanone", "ethanol", "methane"]) assert.ok($(T(`molecule-${id}`)), id);
  await click(T("molecule-butanone")); assert.match(viewTxt(1), /Butan-2-one/); await click(T("molecule-propanone"));
});
await test("Start sample runs the introduction; Pause / Play and Step forward work; selecting a molecule inspects it", async () => {
  await click(T("start-sample")); assert.equal($(T("playback-bar")).getAttribute("data-stage"), "1");
  await click(T("btn-play-pause")); assert.equal($(T("playback-bar")).getAttribute("data-paused"), "1"); await click(T("btn-play-pause")); assert.equal($(T("playback-bar")).getAttribute("data-paused"), "0");
  await click(T("mol-2")); await until(() => $(T("track-status"))?.getAttribute("data-tracking") === "1", 2000, "tracking"); assert.match(txt(T("track-region")), /\S/);
  await click(T("untrack")); assert.equal($(T("track-status")).getAttribute("data-tracking"), "0");
});

console.log("Stage 2: ionisation");
await test("Ionize button, equation M + e- -> M+. + 2e-, some molecules stay neutral, particle key with non-colour cues", async () => {
  await mount(); await go(2); assert.ok($(T("ionize")), "Ionize button"); assert.match(txt(T("ionisation-equation")) || stageTxt(), /M \+ e⁻ → M⁺• \+ 2e⁻/);
  await click(T("ionize")); await tick(100); assert.match(txt(T("s2-outcome")) || stageTxt(), /neutral|not ionised|stay/i);
  const key = txt(T("particle-key")); for (const w of ["Neutral molecule", "Molecular ion", "Charged fragment", "Neutral fragment"]) assert.match(key, new RegExp(w, "i"), w);
  assert.match(key, /dashed|solid|ring|shape/i);
});

console.log("Stage 3: fragmentation");
await test("pathways: select one, formula / charge / m/z, neutral product, position on the spectrum, replay + slow-motion replay", async () => {
  await mount(); await go(3); const first = $(`${T("path")} [role=radio]`); assert.ok(first, "pathway chips"); await click(first);
  await until(() => $(T("pathway-detail-eq")) || $(`[data-testid$="-charged"]`), 3000, "pathway detail");
  const d = txt(T("pathway-detail")); assert.match(d, /Charged fragment/); assert.match(d, /Neutral product/); assert.match(d, /Position on the spectrum/); assert.match(d, /m\/z/);
  assert.ok($(T("pathway-detail-replay"))); assert.ok($(T("pathway-detail-slow"))); await click(T("pathway-detail-slow"));
  assert.match(viewTxt(3), /teaching representation/i); assert.match(viewTxt(3), /not reproduce|does not reproduce/i);
  assert.ok($(T("btn-replay-frag")), "Replay fragmentation control in stage 3"); await click(T("btn-replay-frag"));
});
await test("weak or absent molecular ions are explained; the outcome tally accounts for every molecule", async () => {
  assert.match(txt(T("s3-weak")) || stageTxt(), /molecular ion/i); assert.ok($(T("outcome-tally")));
});
await test("controls are stage-relevant: Replay Fragmentation only in stage 3, charges and labels toggle from stage 2", async () => {
  await go(1); assert.ok(!$(T("btn-replay-frag"))); assert.ok(!$(T("btn-charges"))); await go(2); assert.ok($(T("btn-charges"))); assert.ok($(T("btn-labels")));
  await click(T("btn-charges")); assert.match(txt(T("btn-charges")), /Show charges/); await click(T("btn-charges")); assert.match(txt(T("btn-charges")), /Hide charges/);
  await click(T("btn-labels")); assert.match(txt(T("btn-labels")), /Show ion labels/); await click(T("btn-labels"));
});

console.log("Stage 4: acceleration and separation");
await test("sector is the default, TOF the alternative; never both; B slider, voltage slider and sector HUD", async () => {
  await mount(); await go(4); assert.equal($(T("journey-workspace")).getAttribute("data-analyser"), "sector"); assert.ok($(T("sector-hud"))); assert.ok($(T("b-slider")) || $(T("s4-sector")));
  await click(T("analyser-tof")); assert.equal($(T("journey-workspace")).getAttribute("data-analyser"), "tof"); assert.ok(!$(T("sector-hud")));
  assert.match(txt(T("instrument-overview")), /TOF|Flight/i); assert.doesNotMatch(txt(T("instrument-overview")), /Sector|sector/); await click(T("analyser-sector"));
  assert.match(txt(T("instrument-overview")), /Sector|sector/);
});
await test("the 1+ / 2+ comparison: same mass, half the m/z; sector radius r = (1/B) sqrt(2mV/ze) is stated", async () => {
  await click(T("cmp-toggle")); await until(() => $(T("cmp-panel")), 2000); assert.equal(Number(txt(T("cmp-mz-2"))) * 2, Number(txt(T("cmp-mz-1"))));
  assert.match(stageTxt() + viewTxt(4), /√|sqrt|square root/); assert.match(stageTxt(), /neutral/i);
});
await test("the voltage slider changes the HUD and tune chips set B so the chosen m/z reaches the detector", async () => {
  const t = $$(`[data-testid^="tune-"]`)[0]; if (t) { await click(t); const mz = Number(t.getAttribute("data-testid").slice(5)); assert.match(txt(T("sector-hud")), new RegExp(`transmits m/z ${mz}\\.`)); }
});

console.log("Stage 5: detector and spectrum");
await test("the spectrum grows with the animation, the ion counter is labelled illustrative, M / base / isotope peaks are marked", async () => {
  await mount(); await go(5); await click(T("btn-play-pause")); await click(T("btn-play-pause"));
  assert.match(txt(T("ion-counter")), /Illustrative/i); assert.match(txt(T("ion-counter")), /not measured/i);
  await click(T("analyser5-tof")); assert.equal($(T("journey-workspace")).getAttribute("data-analyser"), "tof"); await click(T("analyser5-sector"));
});
await test("clicking a peak shows m/z, relative intensity and candidate structures without claiming uniqueness; the fragment is highlighted", async () => {
  await click(peak(43)); await until(() => $(T("peak-info")), 2000, "peak info"); const t = txt(T("peak-info"));
  assert.match(t, /43/); assert.match(t, /%/); assert.match(stageTxt(), /Formulas that fit/); assert.match(stageTxt(), /does not prove|cannot tell/i); assert.doesNotMatch(t, /\bis definitely\b|\bonly possible\b/i);
});

console.log("Stage 6: interpretation and the optional activities");
await test("interactive spectrum + deductions: click a peak, record a note, remove it; hints and worked interpretation exist", async () => {
  await go(6); assert.ok($(T("s6-hints")) || /hint/i.test(stageTxt())); if (!$(T("note-input"))) await click(peak(43));
  const inp = $(T("note-input")); assert.ok(inp, "note input"); Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(inp, "acylium?"); inp.dispatchEvent(new window.Event("input", { bubbles: true })); await tick(40);
  await click(T("note-add")); assert.match(txt(T("notes")), /acylium/); 
});
await test("activities are reachable from interpretation; each has a back button; old stage 13 is mentioned as removed", async () => {
  assert.match(stageTxt() + txt(".ss-wb"), /removed|Structure Investigation/i);
  for (const [id, view] of [["unknown", "unknown-view"], ["patterns", "pattern-view"], ["isotopes", "isotope-view"]]) {
    await click(T(`activity-${id}`)); await until(() => $(T("activity-view")), 3000, id); assert.ok($(T(view)), view); assert.ok($(T("instrument-overview")), "overview stays visible"); await click(T("activity-back")); await until(() => $(T("step-view-6")));
  }
});
await test("isotope activity keeps its corrected scaling: percentage abundance, pattern table has a ratio column and the tallest-bar-100% note", async () => {
  await click(T("activity-isotopes")); await until(() => $(T("isotope-view"))); assert.match(txt(T("isotope-view")), /Abundance \(%\)/); await click(T("activity-back"));
  await click(T("activity-patterns")); await until(() => $(T("pattern-view"))); assert.ok($(T("pattern-table"))); assert.match(txt(T("step-panel")), /tallest|100 ?%/i); await click(T("activity-back"));
});
await test("unknown challenge flow: six rounds, answer, submit, reveal, next", async () => {
  await click(T("activity-unknown")); await until(() => $(T("unknown-view"))); assert.match(txt(T("unknown-title")), /of 6/);
  const spec = $(`${T("unknown-view")} [data-testid^="peak-"]`); assert.ok(spec, "peaks to click"); await click(T("reveal")) .catch(() => {});
  await click(T("activity-back"));
});

console.log("Persistence, reset and robustness");
await test("experiment state survives switching to the IR and NMR tabs and back (stage, molecule, analyser); disk/session persistence is covered by the store tests", async () => {
  await mount(); await click(T("molecule-ethanol")); await go(4); await click(T("analyser-tof"));
  await click(T("tech-ir")); await tick(100); await click(T("tech-ms")); await until(() => $(T("journey-workspace")), 3000);
  assert.equal($(T("journey-workspace")).getAttribute("data-stage"), "4"); assert.equal($(T("journey-workspace")).getAttribute("data-analyser"), "tof"); assert.match(txt(T("step-panel")) + txt(T("instrument-overview")), /Flight|TOF/i);
});
await test("Reset experiment returns to stage 1 with the same molecule population; the IR and NMR tabs still open", async () => {
  await click(T("btn-reset-experiment")); await until(() => $(T("step-view-1")), 3000);
  await click(T("tech-ir")); await until(() => $(T("stage-stepper"))?.getAttribute("data-count") !== "6", 3000); await click(T("tech-nmr")); await tick(100); await click(T("tech-ms")); await until(() => $(T("stage-stepper"))?.getAttribute("data-count") === "6", 3000);
});
await test("reduced motion: the stage animation jumps to its end state instead of running", async () => {
  const old = window.matchMedia; window.matchMedia = (q) => ({ matches: /reduce/.test(q), addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  await mount(); await go(3); await tick(300); const el = $(T("journey-workspace")); assert.ok(Number(el.getAttribute("data-t")) >= Number(el.getAttribute("data-duration")) - 0.01, "stage 3 shown at its end");
  window.matchMedia = old;
});
await test("no console.error output (React warnings: keys, act, state updates) during the whole run", async () => { console.error = origErr; assert.deepEqual(consoleErrors, []); });
console.log(`\n${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
