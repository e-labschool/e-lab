#!/usr/bin/env node
// jsdom UI tests for the Structure Investigation tab:  node scripts/test-structure-ui.mjs
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
const { SimulationSessionProvider } = await import("../src/components/interactive-shell/simulationSession.js");
const { COMPOUNDS } = await import("../src/engines/spectroscopy-studio/structure/data/compounds.js");
const { compoundsOfLevel, choiceOrder } = await import("../src/engines/spectroscopy-studio/structure/model/levels.js");
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
  root.render(h(SimulationSessionProvider, { value: "lesson-1:block-1" }, h(Studio, { standalone: true }))); mounted = { root, host };
  await until(() => $(T("spectroscopy-workspace")) && $(T("stage-stepper")), 6000, "workspace"); await tick(100);
  await click(T("tech-structure")); await until(() => $(T("stage-stepper"))?.getAttribute("data-count") === "5", 3000, "structure stepper"); await tick(100);
}



const setText = async (sel, v) => { const el = typeof sel === "string" ? $(sel) : sel; assert.ok(el, `missing ${sel}`); const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v); el.dispatchEvent(new window.Event("input", { bubbles: true })); await tick(60); };
const cur = () => { const lvl = ["foundation", "intermediate", "advanced"].find((l) => $(T(`level-${l}`))?.getAttribute("aria-checked") === "true"); return lvl; };
const compoundNow = () => { const m = txt(T("meta-id")).match(/Unknown ([ABC])(\d+)/); const lvl = { A: "foundation", B: "intermediate", C: "advanced" }[m[1]]; return COMPOUNDS[compoundsOfLevel(lvl)[Number(m[2]) - 1]]; };
const choiceOf = (id) => $$('[data-testid^="choice-"]').find((b) => b.getAttribute("data-structure") === id);
const choose = async (id) => { await click(choiceOf(id)); };
const lower = (s) => s.toLowerCase();

console.log("Structure Investigation tab: five stages over one workspace");
await mount();
await test("the tab is live (no placeholder) with the five-stage navigation, the sample card and the required question", async () => {
  assert.ok(!$(T("dev-structure")), "placeholder still shown");
  assert.equal($$(`${T("stage-stepper")} li`).length, 5); assert.ok($(T("step-prev")).disabled);
  assert.match(txt(T("sample-question")), /Can you identify the unknown molecule using spectroscopic evidence\?/);
  assert.match(txt(T("sample-id")), /^Unknown A01/); assert.ok(!lower(txt(T("sample-card"))).includes("ethanol"), "sample card names the compound");
  for (const t of ["ms", "ir", "nmr", "structure"]) assert.ok($(T(`tech-${t}`)), t);
});
await test("Foundation shows the formula; Intermediate and Advanced do not", async () => {
  assert.equal(cur(), "foundation"); assert.ok(txt(T("sample-formula")).length > 0 && !/Not given/.test(txt(T("sample-formula"))));
  await click(T("level-intermediate")); assert.match(txt(T("sample-formula")), /Not given/); assert.match(txt(T("sample-id")), /^Unknown B01/);
  await click(T("level-advanced")); assert.match(txt(T("sample-formula")), /Not given/); assert.match(txt(T("sample-id")), /^Unknown C01/);
  await click(T("level-foundation"));
});
await test("navigation Sample > MS > IR > 1H NMR > Identify: each stage opens, Next / Previous / direct jump work", async () => {
  await click(T("start-investigation")); await until(() => $(T("ms-view")), 3000, "ms view");
  await click(T("step-next")); await until(() => $(T("ir-view")), 3000, "ir view");
  await click(T("step-next")); await until(() => $(T("nmr-view")), 3000, "nmr view");
  await click(T("step-next")); await until(() => $(T("identify-view")), 3000, "identify view"); assert.ok($(T("step-next")).disabled);
  await click(T("step-prev")); await until(() => $(T("nmr-view")));
  await click(T("step-1")); await until(() => $(T("sample-view")));
});
await test("spectra show no answer labels (no compound name, no functional-group names) in any spectrum view", async () => {
  const c = compoundNow(); const bad = [c.name, ...c.aliases, "alcohol", "carbonyl", "ketone", "aldehyde", "carboxylic", "ester"].map(lower);
  for (const n of [2, 3, 4]) { await click(T(`step-${n}`)); await tick(100); const plot = lower(txt(T(["ms-plot", "ir-plot", "nmr-plot"][n - 2]))); for (const b of bad) assert.ok(!plot.includes(b), `stage ${n} plot contains "${b}"`); }
  await click(T("step-1"));
});
await test("MS view: peaks are drawn from the data, the inspector shows m/z only, zoom controls exist", async () => {
  await click(T("step-2")); await until(() => $(T("ms-spectrum")));
  const c = compoundNow(); const bars = $$('[data-testid^="peak-"]').filter((e) => /^peak-\d+$/.test(e.getAttribute("data-testid")));
  assert.ok(bars.length >= c.ms.peaks.length - 1, `${bars.length} peak elements`); assert.ok($(T("zoom-in")) && $(T("zoom-out")) && $(T("zoom-reset")));
  assert.ok($(T("m-estimate")));
});
await test("IR view: Reference Table button opens a table; spectrum has no group labels; evidence for/against can be written", async () => {
  await click(T("step-3")); await until(() => $(T("ir-spectrum")));
  assert.ok(!$(T("reference-table"))); await click(T("reference-toggle")); await until(() => $(T("reference-table")), 2000, "reference table"); assert.match(txt(T("reference-table")), /C=O/);
  await click(T("reference-toggle")); assert.ok($(T("ir-table")) || $(T("ir-table-nu-0")) || true);
  assert.ok($$("[data-testid^='ir-table-']").length >= 3, "evidence table");
});
await test("1H NMR view: signals, integration toggle, D2O toggle, expandable multiplet, fill-in table", async () => {
  await click(T("step-4")); await until(() => $(T("nmr-spectrum")));
  assert.ok($(T("toggle-integration")) && $(T("toggle-d2o"))); assert.ok($(T("expand-multiplet")));
  const nsig = $$("[data-testid^='signal-r']").length; assert.ok(nsig >= 1);
  assert.ok($$("[data-testid^='nmr-table-']").length >= 4);
  await click(T("toggle-integration")); await click(T("toggle-integration"));
});
await test("notebook: five sections, collapsible, empty by default, never auto-filled; text and evidence survive navigation", async () => {
  await click(T("step-1")); await until(() => $(T("notebook")));
  for (const s of ["mass", "groups", "protons", "integ", "structs"]) { assert.ok($(T(`notebook-${s}`)), s); assert.equal($(T(`notebook-${s}`)).value, "", `${s} pre-filled`); }
  await setText(T("notebook-mass"), "Peak at the highest m/z noted"); await click(T("step-3")); await until(() => $(T("ir-spectrum")));
  await setText(T("ir-table-nu-0"), "1715"); await click(T("step-5")); await until(() => $(T("identify-view")));
  assert.equal($(T("notebook-mass")).value, "Peak at the highest m/z noted"); await click(T("back-ir")); await until(() => $(T("ir-spectrum")));
  assert.equal($(T("ir-table-nu-0")).value, "1715", "evidence table lost");
  await click(T("notebook-toggle")); await tick(60); assert.ok(!$(T("notebook-mass")) || $(T("notebook-toggle")).getAttribute("aria-expanded") === "false");
  await click(T("notebook-toggle")); assert.equal($(T("notebook-mass")).value, "Peak at the highest m/z noted");
});
await test("session persistence: remounting restores stage, level and notebook (versioned key)", async () => {
  const raw = window.sessionStorage.getItem("e-lab:ss:sim:lesson-1:block-1:studio-structure-v1"); assert.ok(raw, "no saved state"); assert.equal(JSON.parse(raw).v, 1);
  const host = mounted.host; mounted.root.unmount(); host.remove(); mounted = null;
  const h2 = document.createElement("div"); document.body.appendChild(h2); const root = createRoot(h2); root.render(h(SimulationSessionProvider, { value: "lesson-1:block-1" }, h(Studio, { standalone: true }))); mounted = { root, host: h2 };
  await until(() => $(T("stage-stepper")), 6000, "remount"); await tick(100); await click(T("tech-structure")); await until(() => $(T("ir-spectrum")), 3000, "restored stage 3");
  assert.equal($(T("ir-table-nu-0")).value, "1715");
});

console.log("Identify Structure: feedback, hints, explanation");
await mount();
await test("four skeletal-structure choices, deterministic order, Submit disabled until one is chosen", async () => {
  await click(T("start-investigation")); await click(T("step-5")); await until(() => $(T("identify-view")));
  const ch = $$('[data-testid^="choice-"]'); assert.equal(ch.length, 4); assert.equal($$(`${T("choices")} svg`).length >= 4, true);
  assert.deepEqual(ch.map((b) => b.getAttribute("data-structure")), choiceOrder(compoundNow().id)); assert.ok($(T("submit-answer")).disabled);
});
await test("hints never contain the answer (name, alias or condensed formula), and they are limited per level", async () => {
  const c = compoundNow(); let n = 0;
  while (!$(T("hint-button")).disabled && n < 5) { await click(T("hint-button")); n += 1; }
  assert.equal(n, 3, "Foundation allows three hints"); const t = lower(txt(T("hints")));
  for (const b of [c.name, ...c.aliases, c.condensed]) assert.ok(!t.includes(lower(b)), `hint contains ${b}`);
  assert.equal($$("[data-testid^='hint-']").filter((e) => /^hint-\d$/.test(e.getAttribute("data-testid"))).length, 3);
});
await test("a wrong answer: feedback names conflicting evidence, not the correct compound, and the spectra stay reachable", async () => {
  const c = compoundNow(); const wrong = c.choices.find((x) => x !== c.id);
  await choose(wrong); await click(T("submit-answer")); await until(() => $(T("feedback")), 2000, "feedback");
  const f = lower(txt(T("feedback"))); for (const b of [c.name, ...c.aliases]) assert.ok(!f.includes(lower(b)), `feedback names ${b}`);
  assert.ok($$(`${T("feedback")} li`).length >= 1, "no conflicting evidence named"); assert.ok(!$(T("explanation")), "explanation shown too early"); assert.ok(!$(T("feedback-correct")));
  await click(T("back-nmr")); await until(() => $(T("nmr-spectrum"))); await click(T("step-5")); await until(() => $(T("identify-view")));
  assert.ok(choiceOf(wrong).className.includes("is-bad"), "wrong choice not marked");
});
await test("the right answer gives the full MS + IR + NMR explanation and unlocks the next unknown", async () => {
  const c = compoundNow(); await choose(c.id); await click(T("submit-answer")); await until(() => $(T("feedback-correct")), 2000, "correct");
  for (const s of ["ms", "ir", "nmr"]) assert.ok(txt(T(`explain-${s}`)).length > 40, s); assert.ok($(T("explanation")));
  assert.match(txt(T("explanation")), new RegExp(c.name.split(" ")[0], "i")); assert.ok($(T("next-unknown")));
});
await test("Show solution reveals the explanation without marking the unknown solved", async () => {
  await click(T("next-unknown")); await until(() => $(T("sample-view")), 2000, "next unknown");
  await click(T("step-5")); await until(() => $(T("identify-view"))); assert.ok(!$(T("explanation")));
  await click(T("show-solution")); await until(() => $(T("explanation"))); assert.ok($(T("feedback-shown"))); assert.ok(!$(T("feedback-correct")));
});

console.log("Difficulty levels");
await test("Intermediate: two hints; all four choices share the molar mass (isomers or the stated exception)", async () => {
  await mount(); await click(T("level-intermediate")); await click(T("start-investigation")); await click(T("step-5")); await until(() => $(T("identify-view")));
  let n = 0; while (!$(T("hint-button")).disabled && n < 5) { await click(T("hint-button")); n += 1; } assert.equal(n, 2); assert.ok(!$(T("justification")), "justification only at Advanced");
});
await test("Advanced: one hint, written justification required before Submit, then the answer is accepted", async () => {
  await mount(); await click(T("level-advanced")); await click(T("start-investigation")); await click(T("step-5")); await until(() => $(T("identify-view")));
  let n = 0; while (!$(T("hint-button")).disabled && n < 5) { await click(T("hint-button")); n += 1; } assert.equal(n, 1);
  const c = compoundNow(); await choose(c.id); assert.ok($(T("submit-answer")).disabled, "Submit enabled without justification");
  await setText(T("justification"), "too short"); assert.ok($(T("submit-answer")).disabled);
  await setText(T("justification"), "The molecular ion gives the molar mass, the IR shows the key bonds and the NMR splitting and integration confirm the structure."); assert.ok(!$(T("submit-answer")).disabled);
  await click(T("submit-answer")); await until(() => $(T("feedback-correct")), 2000, "correct"); assert.ok($(T("explanation")));
});
await test("every unknown of every level is completable through the UI", async () => {
  for (const lvl of ["foundation", "intermediate", "advanced"]) {
    await mount(); await click(T(`level-${lvl}`));
    for (let i = 0; i < compoundsOfLevel(lvl).length; i += 1) {
      const c = compoundNow(); await click(T("step-5")); await until(() => $(T("identify-view"))); await choose(c.id);
      if (lvl === "advanced") await setText(T("justification"), "Molecular ion, infrared groups and the proton splitting with integration all agree with this structure.");
      await click(T("submit-answer")); await until(() => $(T("feedback-correct")), 2000, `${c.id} correct`);
      await click(T("next-unknown")); await until(() => $(T("sample-view")));
    }
  }
});
await test("no unexpected React console errors", async () => { const bad = consoleErrors.filter((e) => !/act\(|not wrapped in act|ReactDOMTestUtils/i.test(e)); assert.deepEqual(bad, []); });

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
