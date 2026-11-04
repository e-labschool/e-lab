#!/usr/bin/env node
// Node/jsdom tests for the Gas Laws Explorer UI additions (tab labels, dynamic heading + law
// sentence, instrument gauges):  node scripts/test-gas-laws-ui.mjs
// Renders the REAL GasLawsExplorer component into jsdom and drives it with DOM events.
// Honest limits: jsdom has no layout engine and no canvas, so geometry (deck placement, overlap,
// clipping) is covered by the pure deckLayout tests here plus headless Chromium
// (scripts/verify-simulation-dashboards.mjs); this file checks content and values only.
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { register } from "node:module";

const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
for (const k of ["window", "document", "HTMLElement", "HTMLInputElement", "Node", "MouseEvent", "KeyboardEvent", "Event", "XMLSerializer", "MutationObserver", "getComputedStyle"]) {
  try { globalThis[k] = dom.window[k]; } catch { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true }); }
}
globalThis.requestAnimationFrame = () => 0; // no animation loop in this harness (physics is tested separately)
globalThis.cancelAnimationFrame = () => {};
dom.window.HTMLCanvasElement.prototype.getContext = () => null;
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.IS_REACT_ACT_ENVIRONMENT = false;
register("./jsx-loader-hooks.mjs", import.meta.url);
register("./image-viewer-loader-hooks.mjs", import.meta.url);

const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const M = await import("../src/engines/gas-laws-explorer/model.js");
const { LAW_INFO, lawHeading } = await import("../src/engines/gas-laws-explorer/lawInfo.js");
const { computeDeckLayout, DECK_H } = await import("../src/engines/gas-laws-explorer/deckLayout.js");
const { default: GasLawsExplorer } = await import("../src/engines/gas-laws-explorer/GasLawsExplorer.jsx");

let passed = 0;
let failed = 0;
const pending = [];
function test(name, fn) { pending.push({ name, fn }); }
const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const $ = (sel) => document.querySelector(sel);
const text = (sel) => ($(sel)?.textContent ?? "").replace(/\s+/g, " ").trim();

const host = document.getElementById("root");
const root = createRoot(host);
root.render(React.createElement(GasLawsExplorer, { standalone: true }));
await wait(100);

async function openMode(id) {
  $(`[data-testid="tab-${id}"]`).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await wait();
}
async function setSlider(testId, value) {
  const el = $(`[data-testid="slider-${testId}"]`);
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(el, String(value));
  el.dispatchEvent(new Event("input", { bubbles: true }));
  await wait();
}
async function fresh(id) {
  await openMode(id);
  $('[data-testid="reset"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await wait();
}
const gauge = (k) => text(`[data-testid="gauge-${k}-value"]`);
const strip = (k) => text(`[data-testid="live-${k}"] dd`);
const expectText = (k, s) => `${M.formatValue(k, s[k])} ${M.VARS[k].unit}`;

const EXPECT = {
  pv: { law: "Boyle's Law", heading: "Boyle's Law — Pressure and Volume", sentence: "At constant temperature and amount of gas, pressure is inversely proportional to volume." },
  vt: { law: "Charles's Law", heading: "Charles's Law — Volume and Temperature", sentence: "At constant pressure and amount of gas, volume is directly proportional to absolute temperature." },
  pt: { law: "Gay-Lussac's Law", heading: "Gay-Lussac's Law — Pressure and Temperature", sentence: "At constant volume and amount of gas, pressure is directly proportional to absolute temperature." },
  vn: { law: "Avogadro's Law", heading: "Avogadro's Law — Volume and Amount of Gas", sentence: "At constant pressure and temperature, volume is directly proportional to the amount of gas." },
};

console.log("== tabs, heading and law sentence ==");
test("four tabs keep P–V, V–T, P–T, V–n and carry the law name underneath (two lines)", () => {
  const tabs = [...document.querySelectorAll('[data-testid="mode-tabs"] [role="tab"], [data-testid="mode-tabs"] [role="radio"]')];
  assert.equal(tabs.length, 4);
  const want = [["P–V", "Boyle's Law"], ["V–T", "Charles's Law"], ["P–T", "Gay-Lussac's Law"], ["V–n", "Avogadro's Law"]];
  tabs.forEach((t, i) => {
    assert.equal(t.querySelector(".sd-tab-main")?.textContent, want[i][0]);
    assert.equal(t.querySelector(".sd-tab-sub")?.textContent, want[i][1]);
  });
});
test("model-level law table matches the specified wording", () => {
  for (const id of M.MODE_IDS) {
    assert.equal(LAW_INFO[id].law, EXPECT[id].law);
    assert.equal(lawHeading(id), EXPECT[id].heading);
    assert.equal(LAW_INFO[id].sentence, EXPECT[id].sentence);
  }
});
test("selecting each tab updates the heading, the one-sentence explanation and aria-selected; tabs are not duplicated", async () => {
  for (const id of M.MODE_IDS) {
    await openMode(id);
    assert.equal($(`[data-testid="tab-${id}"]`).getAttribute("aria-selected") ?? $(`[data-testid="tab-${id}"]`).getAttribute("aria-checked"), "true");
    const sub = $('[data-testid="sd-subtitle"]');
    assert.ok(sub.textContent.includes(EXPECT[id].heading), sub.textContent);
    assert.equal(sub.getAttribute("title"), EXPECT[id].heading);
    assert.equal(text('[data-testid="law-statement"]'), EXPECT[id].sentence);
    assert.equal(document.querySelectorAll('[data-testid="mode-tabs"]').length, 1);
  }
});
test("exactly one law sentence is visible; the dynamic 'what is happening' note is separate and short", async () => {
  await openMode("pv");
  assert.equal(document.querySelectorAll('[data-testid="law-statement"]').length, 1);
  const note = text('[data-testid="what-is-happening"]');
  assert.ok(note.length > 0 && note.length < 110, note);
  assert.notEqual(note, text('[data-testid="law-statement"]'));
});

console.log("== instrument gauges ==");
test("gauges show the resolved state in every mode, with the same text as the live strip", async () => {
  for (const id of M.MODE_IDS) {
    await fresh(id);
    const s = M.defaultState(id);
    assert.equal(gauge("P"), expectText("P", s), `${id} P`);
    assert.equal(gauge("T"), expectText("T", s), `${id} T`);
    assert.equal(gauge("P"), strip("P"));
    assert.equal(gauge("T"), strip("T"));
  }
  await fresh("pv");
  assert.equal(gauge("P"), "1.23 atm");
  assert.equal(gauge("T"), "300 K");
});
test("labels: PRESSURE and TEMPERATURE (full labels), soft blue / soft amber tones, deck inside the chamber", () => {
  assert.match(text('[data-testid="gauge-P"] .gl-gauge-label'), /PRESSURE/);
  assert.match(text('[data-testid="gauge-T"] .gl-gauge-label'), /TEMPERATURE/);
  assert.ok($('[data-testid="gauge-P"]').classList.contains("gl-gauge--p"));
  assert.ok($('[data-testid="gauge-T"]').classList.contains("gl-gauge--t"));
  assert.ok($('[data-testid="chamber"] [data-testid="instrument-deck"]'));
});

// slider sweeps: gauge === (what the Controls panel shows) === model, and constants never move
const INDEP = { pv: "V", vt: "T", pt: "T", vn: "n" };
const SWEEP = {
  pv: [5, 7.5, 12, 20, 33.5, 50],
  vt: [100, 150, 300, 450, 800],
  pt: [100, 250, 300, 500, 800],
  vn: [0.5, 0.8, 1, 1.45, 2],
};
for (const id of M.MODE_IDS) {
  test(`sweep ${id}: gauges track the resolved state; ${id === "pv" ? "T" : id === "vt" || id === "vn" ? "P" : "V"} constants stay constant`, async () => {
    await fresh(id);
    const start = M.defaultState(id);
    const seen = { P: new Set(), T: new Set() };
    for (const x of SWEEP[id]) {
      await setSlider(INDEP[id], x);
      const ind = INDEP[id];
      const r = M.setVariable(start, ind, x).state; // same model call the component makes (starting from the same baseline)
      assert.equal(gauge("P"), expectText("P", r), `${id} P at ${ind}=${x}`);
      assert.equal(gauge("T"), expectText("T", r), `${id} T at ${ind}=${x}`);
      assert.equal(gauge("P"), strip("P"));
      assert.equal(gauge("T"), strip("T"));
      // Controls panel: the calculated row / constants row display the same strings
      const panel = text('[data-testid="control-panel"]');
      for (const k of ["P", "T"]) assert.ok(panel.includes(expectText(k, r)), `${id}: controls panel lacks "${expectText(k, r)}" in "${panel}"`);
      seen.P.add(gauge("P")); seen.T.add(gauge("T"));
    }
    if (id === "pv" || id === "vn") assert.equal(seen.T.size, 1, `${id}: T gauge must not move`);
    if (id === "vt" || id === "vn") assert.equal(seen.P.size, 1, `${id}: P gauge must not move`);
    if (id === "pv") assert.ok(seen.P.size > 1);
    if (id === "vt") assert.ok(seen.T.size > 1);
    if (id === "pt") { assert.ok(seen.P.size > 1 && seen.T.size > 1, "P–T: both gauges update"); }
    if (id === "vn") assert.equal(seen.T.size, 1);
  });
}
test("P–T: the piston stays fixed (volume row constant) while both gauges change", async () => {
  await fresh("pt");
  const v0 = text('[data-testid="const-V"]');
  await setSlider("T", 700);
  assert.equal(text('[data-testid="const-V"]'), v0);
  assert.equal(gauge("T"), "700 K");
  assert.notEqual(gauge("P"), expectText("P", M.defaultState("pt")));
  assert.match(text('[data-testid="piston-callout"]'), /fixed/i);
});
test("Reset returns the gauges to the defaults", async () => {
  $('[data-testid="reset"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await wait();
  const s = M.defaultState("pt");
  assert.equal(gauge("P"), expectText("P", s));
  assert.equal(gauge("T"), expectText("T", s));
});

console.log("== deck geometry (pure) ==");
test("deck sits under the drawn base, inside the chamber, clear of the caption, for desktop and phone boxes", () => {
  for (const [w, h] of [[1002, 540], [464, 540], [1549, 840], [790, 840], [342, 386], [320, 300], [1071, 664]]) {
    const d = computeDeckLayout(w, h);
    assert.equal(d.height, DECK_H);
    assert.ok(d.left >= 0 && d.left + d.width <= w, `${w}x${h} horizontal: ${JSON.stringify(d)}`);
    assert.ok(d.top > 0 && d.top + d.height <= h - 1, `${w}x${h} vertical: ${JSON.stringify(d)}`);
    assert.ok(d.reserve >= 34);
    if (d.left <= 224) assert.ok(d.top + d.height <= h - 18, `${w}x${h} caption overlap: ${JSON.stringify(d)}`);
  }
});

for (const { name, fn } of pending) {
  try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}
root.unmount();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
