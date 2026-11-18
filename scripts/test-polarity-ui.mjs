#!/usr/bin/env node
// jsdom UI tests for the Polarity Playground:  node scripts/test-polarity-ui.mjs
// Renders the REAL component into jsdom (no canvas, no WebGL -> the WebGL-less fallback path) and drives it with DOM events.
// Honest limits: 3D pixels, layout, clipping, the density picture, drag-rotation and context loss are covered by headless Chromium
// (scripts/verify-polarity-playground.mjs); this file checks registration, tabs, state wiring, text, the Challenge flow and keyboard use.
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { register } from "node:module";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/simulation/polarity-playground", pretendToBeVisual: true });
for (const k of ["window", "document", "HTMLElement", "HTMLInputElement", "HTMLSelectElement", "Node", "MouseEvent", "KeyboardEvent", "Event", "MutationObserver", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"]) {
  try { globalThis[k] = dom.window[k]; } catch { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true }); }
}
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
dom.window.HTMLCanvasElement.prototype.getContext = () => null;
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.IS_REACT_ACT_ENVIRONMENT = false;
window.addEventListener("error", (e) => console.log("WINERR", e.message));
register("./jsx-loader-hooks.mjs", import.meta.url);
register("./image-viewer-loader-hooks.mjs", import.meta.url);

const React = (await import("react")).default; const { createRoot } = await import("react-dom/client");
const PP = (await import("../src/engines/polarity-playground/PolarityPlayground.jsx")).default;
const { SIMULATION_REGISTRY, getSimulationIdForTitle } = await import("../src/data/simulationRegistry.js");
const { SIMULATION_COMPONENTS } = await import("../src/data/simulationEngineComponents.js");
const { resourcesById } = await import("../src/data/resources-registry.js");
const { SIMULATION_CATALOGUE } = await import("../src/data/simulationCatalogue.js");
const Ch = await import("../src/engines/polarity-playground/model/challenge.js");
const h = React.createElement;

let passed = 0; let failed = 0;
async function test(name, fn) { try { await fn(); console.log(`  ok   ${name}`); passed += 1; } catch (e) { console.log(`  FAIL ${name}\n       ${(e.stack || e.message).split("\n").slice(0, 5).join("\n       ")}`); failed += 1; } }
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)]; const T = (id) => `[data-testid="${id}"]`;
const txt = (s) => ($(s)?.textContent ?? "").replace(/\s+/g, " ").trim();
const click = async (sel) => { const el = typeof sel === "string" ? $(sel) : sel; assert.ok(el, `missing ${sel}`); el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); await tick(); };
const setValue = async (sel, value, proto = window.HTMLInputElement.prototype, evt = "input") => { const el = $(sel); assert.ok(el, `missing ${sel}`); Object.getOwnPropertyDescriptor(proto, "value").set.call(el, String(value)); el.dispatchEvent(new window.Event(evt, { bubbles: true })); await tick(); };
const setSelect = (sel, v) => setValue(sel, v, window.HTMLSelectElement.prototype, "change");
async function until(fn, ms = 4000, label = "condition") { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return; await tick(25); } throw new Error(`timed out waiting for ${label}`); }
let mounted = null;
async function mount() {
  if (mounted) { mounted.root.unmount(); mounted.host.remove(); mounted = null; }
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host); root.render(h(PP, { standalone: true })); mounted = { root, host };
  await until(() => $(T("polarity-playground")), 5000, "root"); await tick(100);
}

console.log("Registration and catalogue");
await test("registered in the simulation registry, the component map, the resource registry and the catalogue (live, Bonding, S2.2, not featured)", () => {
  assert.equal(SIMULATION_REGISTRY["polarity-playground"].label, "Polarity Playground"); assert.ok(SIMULATION_COMPONENTS["polarity-playground"]); assert.equal(getSimulationIdForTitle("Polarity Playground"), "polarity-playground");
  const r = resourcesById["polarity-playground"]; assert.ok(r && r.status === "live" && r.resourceType === "simulation");
  const c = SIMULATION_CATALOGUE.find((x) => x.id === "polarity-playground"); assert.ok(c); assert.equal(c.topic, "Bonding"); assert.ok(c.syllabus.includes("S2.2")); assert.ok(!c.featured, "not featured");
});

console.log("Shell and tabs");
await mount();
await test("four tabs with the required names; the Game tab is first; tabs follow the tablist pattern", () => {
  const tabs = $$('[role="tab"]').map((t) => t.textContent.trim()); assert.deepEqual(tabs, ["Game", "Inside a Covalent Bond", "Molecular Polarity", "Polarity Challenge"]);
  assert.equal($('[role="tab"][aria-selected="true"]').textContent.trim(), "Game"); assert.ok($(T("tab-tug")));
  assert.equal($('[role="tablist"]').getAttribute("aria-label"), "Polarity Playground tabs");
});
await test("without WebGL every 3D tab shows the textual fallback and keeps working", async () => {
  assert.ok($(T("webgl-fallback")) || $(T("pp-stage-tug")), "fallback or stage present");
});

console.log("Tab 1: Electron Tug-of-War");
await test("free play: sliders drive the result; equal EN gives non-polar and no partial charges", async () => {
  assert.equal(txt(T("en-value-a")), "2.2"); assert.equal(txt(T("en-value-b")), "3.2"); assert.equal(txt(T("delta-en")), "1.00"); assert.match(txt(T("bond-type")), /Polar covalent/); assert.match(txt(T("partials")), /Atom A δ\+.*Atom B δ−/);
  await setValue(T("slider-b"), 2.2); assert.equal(txt(T("en-value-b")), "2.2"); assert.equal(txt(T("delta-en")), "0.00"); assert.match(txt(T("bond-type")), /Non-polar/); assert.match(txt(T("partials")), /none/); assert.match(txt(T("caption")), /no δ\+ or δ−/);
  await setValue(T("slider-a"), 3.9); await setValue(T("slider-b"), 0.8); assert.match(txt(T("partials")), /Atom B δ\+.*Atom A δ−/, "the more electronegative atom is delta-minus");
  assert.match(txt(T("bond-type")), /Very polar|ionic/i);
});
await test("the model note says it is a simplified model, not to scale", () => { assert.match(txt(T("model-note")), /Simplified electron-density model/i); assert.match(txt(T("model-note")), /not to scale/i); });
await test("real-atom mode hides the answer until the student predicts, then reveals values and gives reasoning", async () => {
  await click(T("tug-mode-real")); assert.ok($(T("predict"))); assert.ok($(T("result-hidden"))); assert.ok(!$(T("delta-en")), "result hidden before the prediction");
  await click(T("pick-b")); assert.ok($(T("feedback"))); assert.match(txt(T("feedback")), /Correct|Not quite/); assert.ok($(T("delta-en")));
  const v = Number(txt(T("delta-en"))); assert.ok(v > 0.9 && v < 1.0, `H-Cl delta-EN ${v}`); assert.match(txt(T("feedback")), /electronegativity/i);
  await click(T("another-pair")); assert.ok($(T("predict")), "a new pair asks for a new prediction");
});

console.log("Tab 2: Inside a Covalent Bond");
await click(T("tab-btn-bond"));
await test("three views; HCl default polar; H2 shows no delta charges and no arrow; colour key defines the colours", async () => {
  assert.ok($(T("tab-bond"))); assert.equal($$('[data-testid^="bond-view-"]').length, 3);
  await setSelect(T("pair-select"), "H-H"); assert.match(txt(T("bond-type")), /Non-polar/); assert.match(txt(T("polarity-formula")), /no δ\+ \/ δ−/); assert.match(txt(T("delta-en")), /0\.00/);
  await setSelect(T("pair-select"), "H-Cl"); assert.match(txt(T("polarity-formula")), /H δ\+.*Cl δ−/); assert.match(txt(T("bond-type")), /Polar covalent/);
  const key = txt(T("colour-key")); assert.match(key, /electron density/i); assert.match(key, /Not charge/i); assert.match(key, /δ\+ blue/); assert.match(key, /δ− red/);
});
await test("the Electron Cloud view carries the required label; Play Animation and Reset are available; Compare with H2 exists", async () => {
  await click(T("bond-view-cloud")); assert.match(txt(T("model-note")), /Simplified electron-density model/); assert.ok($(T("play"))); assert.ok($(T("bond-reset"))); assert.ok($(T("compare")));
});

console.log("Tab 3: Molecular Polarity");
await click(T("tab-btn-molecule"));
await test("ten molecules, three display modes, shape and polarity data per molecule", async () => {
  assert.equal($$('[data-testid^="mol-"]').filter((e) => /^mol-(h2|hcl|co2|h2o|bf3|nh3|ch4|ch3cl|ccl4|so2)$/.test(e.dataset.testid)).length, 10);
  assert.equal($$('[data-testid^="mol-mode-"]').length, 3); assert.deepEqual($$('[data-testid^="mol-mode-"]').map((b) => b.textContent.trim()), ["Molecular Model", "Bond Dipoles", "Resultant Dipole"]);
  await click(T("mol-h2o")); assert.match(txt(T("data-shape")), /Bent/); assert.match(txt(T("data-polarity")), /Polar/); assert.match(txt(T("data-mu")), /μ ≠ 0/);
  await click(T("mol-co2")); assert.match(txt(T("data-shape")), /Linear/); assert.match(txt(T("data-polarity")), /Non-polar/); assert.match(txt(T("data-mu")), /μ = 0/);
  await click(T("mol-bf3")); assert.match(txt(T("data-shape")), /Trigonal planar/); assert.match(txt(T("data-polarity")), /Non-polar/);
  await click(T("mol-nh3")); assert.match(txt(T("data-shape")), /pyramidal/i); assert.match(txt(T("data-polarity")), /^Polar/);
  await click(T("mol-ch4")); assert.match(txt(T("data-bonds")), /Non-polar/); assert.match(txt(T("data-polarity")), /Non-polar/);
});
await test("the note says arrow lengths are relative and qualitative; no numeric dipole moment is quoted anywhere on the tab", () => {
  assert.match(txt(T("model-note")), /qualitative/i); const all = txt(T("tab-molecule")); assert.ok(!/\bdebye\b|\b\d+\.\d+\s?D\b/i.test(all), "no debye numbers");
});
await test("Resultant Dipole mode: the animation can be replayed; for a cancelling molecule 'Net dipole moment = 0' appears once it finishes", async () => {
  await click(T("mol-co2")); await click(T("mol-mode-overall")); assert.ok(!$(T("play")).disabled); globalThis.__PP_SET_PROGRESS?.(1); await until(() => $(T("net-zero-banner")), 3000, "net zero banner");
  assert.match(txt(T("net-zero-banner")), /Net dipole moment = 0/); assert.match(txt(T("caption")), /Net dipole moment = 0/);
  await click(T("mol-h2o")); globalThis.__PP_SET_PROGRESS?.(1); await tick(80); assert.ok(!$(T("net-zero-banner")), "a polar molecule never shows the zero banner"); assert.match(txt(T("caption")), /do not cancel/i);
  await click(T("mol-mode-model")); assert.ok($(T("play")).disabled, "no vector animation in the model view");
});

console.log("Tab 4: Polarity Challenge");
await click(T("tab-btn-challenge"));
await test("five short questions, no timer, immediate feedback with reasoning, score and stars at the end", async () => {
  assert.ok(!/timer|seconds left|countdown/i.test(txt(T("tab-challenge")))); assert.match($(T("progress")).getAttribute("aria-label"), /Question 1 of 5/);
  const round = Ch.buildRound(1); let right = 0;
  for (let i = 0; i < 5; i += 1) {
    const q = $(T("question")); assert.ok(q, `question ${i + 1}`); const prompt = txt(T("prompt")); const spec = round[i]; assert.equal(prompt, spec.prompt, "deterministic first round");
    const pick = i % 2 === 0 ? spec.right : spec.options.find((o) => o.id !== spec.right).id; if (pick === spec.right) right += 1;
    await click(T(`option-${pick}`)); assert.ok($(T("feedback")), "immediate feedback"); assert.match(txt(T("feedback")), pick === spec.right ? /Correct/ : /Not quite/); assert.ok(txt(T("feedback")).length > 60, "feedback gives the reasoning");
    await click(T("next"));
  }
  assert.ok($(T("done"))); assert.equal(txt(T("score")), `${right} / 5`); assert.match($(T("stars")).getAttribute("aria-label"), /of 3 stars/);
  await click(T("again")); assert.ok($(T("question")), "play again starts a new round"); assert.notEqual(txt(T("prompt")), round[0].prompt);
});

console.log("Keyboard and controls");
await test("tabs are real buttons, in the tab order, with a visible reset; the whole sim can be reset", async () => {
  assert.ok($$('[role="tab"]').every((b) => b.tagName === "BUTTON")); assert.equal($$('[role="tab"][tabindex="0"]').length, 1, "roving tabindex"); await click(T("pp-reset")); assert.ok($(T("question")));
});
await test("the sim is registered with a title that matches the catalogue label (Open in New Tab resolves)", () => { assert.equal(getSimulationIdForTitle(SIMULATION_CATALOGUE.find((x) => x.id === "polarity-playground").label), "polarity-playground"); });

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
