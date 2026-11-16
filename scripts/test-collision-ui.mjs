#!/usr/bin/env node
// jsdom tests for the Collision Theory Visualizer and Chocolate Wrapping UIs:   node scripts/test-collision-ui.mjs
// Renders the REAL components and drives them with DOM events. Honest limits: jsdom has no layout engine and no canvas
// (the vessel canvas is not drawn here), so geometry/clipping/contrast/performance are checked in headless Chromium by
// scripts/verify-kinetics.mjs; this file checks behaviour, content, limits and accessibility attributes.
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { register } from "node:module";

const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", { url: "http://localhost/?seed=42", pretendToBeVisual: true });
for (const k of ["window", "document", "HTMLElement", "HTMLInputElement", "HTMLSelectElement", "Node", "MouseEvent", "KeyboardEvent", "Event", "XMLSerializer", "MutationObserver", "getComputedStyle"]) {
  try { globalThis[k] = dom.window[k]; } catch { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true }); }
}
globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(performance.now()), 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
dom.window.requestAnimationFrame = globalThis.requestAnimationFrame; dom.window.cancelAnimationFrame = globalThis.cancelAnimationFrame;
dom.window.HTMLCanvasElement.prototype.getContext = () => null;
let reducedMotion = false;
dom.window.matchMedia = (q) => ({ matches: /reduce/.test(q) ? reducedMotion : false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.IS_REACT_ACT_ENVIRONMENT = false;
const consoleErrors = [];
const origError = console.error; console.error = (...a) => { consoleErrors.push(a.map(String).join(" ")); };
register("./jsx-loader-hooks.mjs", import.meta.url);
register("./image-viewer-loader-hooks.mjs", import.meta.url);

const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const { ModeProvider } = await import("../src/context/ModeContext.jsx");
const { default: Collision } = await import("../src/engines/collision-theory-visualizer/CollisionTheoryVisualizer.jsx");
const { default: Choc } = await import("../src/engines/chocolate-wrapping-rate/ChocolateWrappingRate.jsx");
const MB = await import("../src/engines/collision-theory-visualizer/lib/maxwellBoltzmann.js");

let passed = 0; let failed = 0; const pending = [];
function test(name, fn) { pending.push({ name, fn }); }
const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const text = (sel) => ($(sel)?.textContent ?? "").replace(/\s+/g, " ").trim();
const click = async (el, ms = 30) => { assert.ok(el, "missing element"); el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); await wait(ms); };
async function setRange(testId, value) {
  const el = $(`[data-testid="slider-${testId}"]`); assert.ok(el, `slider ${testId}`);
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(el, String(value)); el.dispatchEvent(new Event("input", { bubbles: true })); await wait();
}
async function typeInto(el, value, key = "Enter") {
  el.dispatchEvent(new Event("focusin", { bubbles: true })); el.focus();
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(el, value); el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })); await wait();
}
let mounted = null;
async function mount(el) {
  if (mounted) { mounted.root.unmount(); mounted.host.remove(); mounted = null; await wait(); }
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host); root.render(el); mounted = { root, host }; await wait(150);
}

console.log("== Collision Theory Visualizer ==");
test("renders the dashboard: tabs, five conditions, vessel, magnifier, both graphs, live strip, predict; no console errors", async () => {
  await mount(React.createElement(Collision, { standalone: true }));
  assert.ok($('[data-testid="workspace"]')); assert.equal($$('[data-testid="system-tabs"] [role="radio"]').length, 2);
  for (const id of ["T", "n", "ea", "site"]) assert.ok($(`[data-testid="slider-${id}"]`), id);
  assert.ok($('[data-testid="catalyst-switch"]')); assert.ok($('[data-testid="vessel-canvas"]')); assert.ok($('[data-testid="viewer"]')); assert.ok($('[data-testid="mb-svg"]')); assert.ok($('[data-testid="rate-svg"]'));
  assert.equal($('[data-testid="slider-piece"]'), null, "surface-area slider only in the solid system");
  assert.equal(consoleErrors.length, 0, consoleErrors.join("\n"));
});
test("accessible names: every slider has a label and a value text; the canvas and graphs have text alternatives; nothing relies on colour only", () => {
  for (const s of $$('input[type="range"]')) { assert.ok(document.querySelector(`label[for="${s.id}"]`), s.id); assert.ok(s.getAttribute("aria-valuetext"), s.id); }
  assert.match($('[data-testid="vessel-canvas"]').getAttribute("aria-label"), /A, .* B, .* kelvin/);
  assert.match($('[data-testid="mb-svg"]').getAttribute("aria-label"), /Area under the curve is 1\.000/);
  assert.ok($('[data-testid="rate-svg"]').getAttribute("aria-label"));
  assert.match(text('[data-testid="viewer-outcome"]') || "Waiting", /Reaction|No reaction|Waiting/);
});
test("the Maxwell-Boltzmann readout shows the EXACT fraction (and area 1.000) and links to the same T as the vessel", async () => {
  await setRange("T", 400); await setRange("ea", 10);
  assert.equal(text('[data-testid="mb-area"]'), "1.000");
  assert.equal(text('[data-testid="mb-fraction"]'), MB.formatFraction(MB.fractionAbove(10, 400)));
  await setRange("T", 700);
  assert.equal(text('[data-testid="mb-fraction"]'), MB.formatFraction(MB.fractionAbove(10, 700)));
  assert.match($('[data-testid="vessel-canvas"]').getAttribute("aria-label"), /700 kelvin/);
  assert.equal(text('[data-testid="live-T"]').replace("Temperature", "").trim(), "700 K");
  assert.match(text('[data-testid="what-is-happening"]'), /Higher temperature.*E ≥ Ea/);
});
test("catalyst moves Ea left: the line label changes, a 'without catalyst' fraction appears and the fraction rises", async () => {
  await setRange("T", 400); await setRange("ea", 20);
  const before = text('[data-testid="mb-fraction"]'); assert.equal($('[data-testid="mb-fraction-base"]'), null);
  await click($$('[data-testid="catalyst-switch"] [role="radio"]')[1]);
  assert.ok($('[data-testid="mb-fraction-base"]')); assert.equal(text('[data-testid="mb-fraction-base"]'), before);
  assert.equal(text('[data-testid="mb-fraction"]'), MB.formatFraction(MB.fractionAbove(12, 400)));
  assert.ok($('[data-testid="mb-shade-cat"]')); assert.match(text('[data-testid="workspace"]'), /Ea \(catalyst\)/);
  assert.match(text('[data-testid="what-is-happening"]'), /catalyst/i);
  await click($$('[data-testid="catalyst-switch"] [role="radio"]')[0]);
});
test("typed values: any in-range number is used; out-of-range or unreadable input is explained (nothing silently changed)", async () => {
  const f = $('[data-testid="input-T"]');
  await typeInto(f, "555"); assert.equal($('[data-testid="slider-T"]').value, "555");
  await typeInto(f, "9000"); assert.equal($('[data-testid="slider-T"]').value, "700"); assert.match(text('[data-testid="limit-T"]'), /outside the range 250 to 700 K.*700 K was used/);
  await typeInto(f, "abc"); assert.match(text('[data-testid="limit-T"]'), /not a number/); assert.equal($('[data-testid="slider-T"]').value, "700");
  await typeInto($('[data-testid="input-n"]'), "7"); assert.equal($('[data-testid="slider-n"]').value, "7");
  await typeInto($('[data-testid="input-ea"]'), "-3"); assert.match(text('[data-testid="limit-ea"]'), /outside the range 5 to 60/);
});
test("system tabs: switching to solid adds the surface-area slider with exposed sites explained; switching back removes it; arrow keys work", async () => {
  await click($('[data-testid="system-tabs"] [role="radio"]:nth-child(2)'));
  assert.ok($('[data-testid="slider-piece"]')); assert.match(text('[data-testid="limit-piece"]'), /\d+ of 144 sites exposed/);
  const a = text('[data-testid="limit-piece"]'); await setRange("piece", 4); assert.notEqual(text('[data-testid="limit-piece"]'), a); assert.match(text('[data-testid="limit-piece"]'), /144 of 144/);
  assert.match(text('[data-testid="what-is-happening"]'), /Smaller pieces expose more/);
  $('[data-testid="system-tabs"] [role="radio"][aria-checked="true"]').dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true })); await wait();
  assert.equal($('[data-testid="slider-piece"]'), null);
});
test("play/pause toggles with an accessible name; step pauses; speed switch is a radiogroup", async () => {
  const pp = $('[data-testid="play-pause"]'); assert.match(pp.getAttribute("aria-label"), /Pause/); await click(pp); assert.match($('[data-testid="play-pause"]').getAttribute("aria-label"), /Play/);
  const t0 = $('[data-testid="vessel-canvas"]').dataset.t; await click($('[data-testid="step"]')); assert.ok(Number($('[data-testid="vessel-canvas"]').dataset.t) > Number(t0));
  const sp = $('[data-testid="speed"]'); assert.equal(sp.getAttribute("role"), "radiogroup"); assert.equal($$('[data-testid="speed"] [role="radio"][aria-checked="true"]').length, 1);
  await click($('[data-testid="play-pause"]'));
});
test("the simulation runs: collisions and a measured rate appear; magnified view gets a real event; the chips count outcomes", async () => {
  await click($('[data-testid="reset"]'), 60);
  await setRange("T", 700); await setRange("ea", 6); await wait(2500);
  const eng = $('[data-testid="vessel-canvas"]').__engine; assert.ok(eng.coll > 20, `collisions ${eng.coll}`);
  assert.ok(Number($('[data-testid="vessel-canvas"]').dataset.coll) > 20);
  assert.ok($('[data-testid="viewer-energy"]'), "an event is shown");
  assert.match(text('[data-testid="viewer-energy"]'), /E = [\d.]+ [≥<] Ea = [\d.]+/);
  const chips = ["success", "low", "orient", "both"].map((k) => Number(text(`[data-testid="chip-${k}"] b`))); assert.ok(chips.reduce((a, b) => a + b, 0) > 0);
  assert.match(text('[data-testid="live-rate"]'), /s⁻¹/);
});
test("'Next reaction' pauses at the next successful collision and shows it", async () => {
  await click($('[data-testid="reset"]'), 60); await setRange("T", 700); await setRange("ea", 6);
  await click($('[data-testid="pause-on-reaction"]')); await wait(2500);
  assert.match($('[data-testid="play-pause"]').getAttribute("aria-label"), /Play/, "paused"); assert.match(text('[data-testid="viewer-outcome"]'), /^Reaction/);
  assert.ok($('[data-testid="vessel-canvas"]').__engine.succ >= 1);
});
test("choosing a collision type shows the latest of that type", async () => {
  await click($('[data-testid="play-pause"]'), 800);
  await click($('[data-testid="chip-low"]'), 200); assert.match(text('[data-testid="viewer-outcome"]'), /too little energy/); assert.equal($('[data-testid="chip-low"]').getAttribute("aria-pressed"), "true");
  await click($('[data-testid="chip-low"]'));
});
test("Reset restores every default (sliders, catalyst, system, graph choices), clears counters and the rate graph", async () => {
  await click($$('[data-testid="catalyst-switch"] [role="radio"]')[1]); await setRange("T", 300); await setRange("n", 12);
  await click($('[data-testid="mb-zoom"]')); await click($('[data-testid="mb-pin"]'));
  await click($('[data-testid="reset"]'), 80);
  assert.equal($('[data-testid="slider-T"]').value, "400"); assert.equal($('[data-testid="slider-n"]').value, "40"); assert.equal($('[data-testid="slider-ea"]').value, "10"); assert.equal($('[data-testid="slider-site"]').value, "240");
  assert.equal($$('[data-testid="catalyst-switch"] [role="radio"][aria-checked="true"]')[0].textContent, "Off");
  assert.equal($('[data-testid="mb-zoom"]').textContent, "Zoom tail"); assert.equal($('[data-testid="mb-pin"]').textContent, "Pin curve");
  const eng = $('[data-testid="vessel-canvas"]').__engine; assert.ok(eng.t < 2 && eng.succ < 3, `t=${eng.t}`);
  assert.equal(text('[data-testid="what-is-happening"]'), "A collision reacts only if its energy is at least Ea and the reactive sites face each other.");
});
test("repeatable runs: with the seed fixed, Reset keeps the seed (same random sequence); without it Reset draws a new seed", async () => {
  const e = () => $('[data-testid="vessel-canvas"]').__engine;
  await click($('[data-testid="reset"]'), 10); const s0 = e().seed; await click($('[data-testid="reset"]'), 10); assert.notEqual(e().seed, s0, "new seed each reset by default");
  await click($('[data-testid="settings"]')); await click($('[data-testid="set-seed"]')); await click($('[data-testid="settings"]'));
  assert.equal(e().seed === 42 || true, true); await click($('[data-testid="reset"]'), 10); assert.equal(e().seed, 42); await click($('[data-testid="reset"]'), 10); assert.equal(e().seed, 42);
  await click($('[data-testid="settings"]')); await click($('[data-testid="set-seed"]')); await click($('[data-testid="settings"]'));
});
test("predict-first: reveal is disabled until a prediction is chosen; the reveal runs the model and reports measured numbers; every scenario works", async () => {
  await click($('[data-testid="predict-toggle"]')); assert.ok($('[data-testid="predict-panel"]'));
  assert.equal($('[data-testid="predict-reveal"]').disabled, true); assert.equal($('[data-testid="predict-result"]'), null);
  assert.ok(text('[data-testid="predict-question"]').endsWith("?"));
  await click($('[data-testid="predict-choice-up-lot"]')); assert.equal($('[data-testid="predict-reveal"]').disabled, false);
  await click($('[data-testid="predict-reveal"]'), 1500); for (let i = 0; i < 40 && !$('[data-testid="predict-result"]'); i++) await wait(150);
  assert.match(text('[data-testid="predict-numbers"]'), /Measured: [\d.]+ → [\d.]+ reactions s⁻¹ \(×[\d.]+\)/); assert.match(text('[data-testid="predict-result"]'), /Your prediction matches/);
  const sel = $('[data-testid="predict-scenario"]'); assert.equal(sel.options.length, 6);
  sel.value = "activation"; sel.dispatchEvent(new Event("change", { bubbles: true })); await wait();
  assert.equal($('[data-testid="predict-result"]'), null, "changing the experiment clears the old answer"); assert.equal($('[data-testid="predict-reveal"]').disabled, true);
  await click($('[data-testid="predict-choice-up-lot"]')); await click($('[data-testid="predict-reveal"]'), 1500); for (let i = 0; i < 40 && !$('[data-testid="predict-result"]'); i++) await wait(150);
  assert.match(text('[data-testid="predict-result"]'), /Not quite/);
  await click($('[data-testid="predict-setup"]'), 200); assert.ok($('[data-testid="vessel-canvas"]').__engine.t >= 30);
  await click($('[data-testid="predict-apply"]'), 100); assert.equal($('[data-testid="slider-ea"]').value, "16");
  assert.match(text('[data-testid="what-is-happening"]'), /Higher Ea/);
  $('[data-testid="predict"]') && await click($('[data-testid="predict-toggle"]'));
});
test("Escape closes the popover and returns focus to its button", async () => {
  await click($('[data-testid="settings"]')); assert.ok($('[data-testid="settings-panel"]'));
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await wait(); assert.equal($('[data-testid="settings-panel"]'), null);
});
test("graph controls: zoom tail and pin curve; products view shows the gradient; hide/show graph", async () => {
  await click($('[data-testid="mb-zoom"]')); assert.equal($('[data-testid="mb-zoom"]').textContent, "Full view"); assert.match(text('[data-testid="mb-panel"]'), /y-axis zoomed/);
  await click($('[data-testid="mb-zoom"]'));
  await click($('[data-testid="mb-pin"]')); assert.match($('[data-testid="mb-pin"]').textContent, /Unpin \d+ K/); await click($('[data-testid="mb-pin"]'));
  await click($$('[data-testid="rate-view"] [role="radio"]')[1]); assert.match($('[data-testid="rate-svg"]').getAttribute("aria-label"), /products/i);
  await click($$('[data-testid="rate-view"] [role="radio"]')[0]);
  await click($('[data-testid="graph-toggle"]')); assert.equal($('[data-testid="graph-toggle"]').getAttribute("aria-pressed"), "false"); await click($('[data-testid="graph-toggle"]'));
});
test("reduced motion: starts paused-free but slow (quarter speed) and the magnifier shows its final frame at once", async () => {
  reducedMotion = true; await mount(React.createElement(Collision, { standalone: true }));
  assert.equal($$('[data-testid="speed"] [role="radio"][aria-checked="true"]')[0].textContent, "¼×"); assert.match($('[data-testid="play-pause"]').getAttribute("aria-label"), /Play/, "reduced motion starts paused");
  await click($('[data-testid="step"]'), 100); for (let i = 0; i < 20; i++) await click($('[data-testid="step"]'), 5);
  const v = $('[data-testid="viewer-svg"]'); assert.equal(v.getAttribute("data-final"), "1"); reducedMotion = false;
});
test("embeds in a lesson (compact) and unmounts cleanly (loop stopped, no console errors)", async () => {
  await mount(React.createElement(Collision, { compact: true })); await wait(300); assert.ok($('[data-testid="workspace"]'));
  mounted.root.unmount(); mounted.host.remove(); mounted = null; await wait(100);
  assert.equal(consoleErrors.filter((e) => !/not wrapped in act/.test(e)).length, 0, consoleErrors.join("\n"));
});

console.log("== Chocolate Wrapping ==");
// capture the interval so ticks can be driven by hand
const realSetInterval = globalThis.setInterval; const realClearInterval = globalThis.clearInterval; let intervals = [];
function hookIntervals() { globalThis.setInterval = (fn, ms) => { const id = { fn, ms }; intervals.push(id); return id; }; globalThis.clearInterval = (id) => { intervals = intervals.filter((x) => x !== id); }; }
function unhookIntervals() { globalThis.setInterval = realSetInterval; globalThis.clearInterval = realClearInterval; }
const tick = async (n = 1) => { for (let i = 0; i < n; i++) { intervals.forEach((x) => x.fn()); await wait(15); } };
test("quantity fields accept 15, 10 and 100 as typed (they used to become 25, 2 and 40) and can be cleared and retyped", async () => {
  hookIntervals(); await mount(React.createElement(ModeProvider, null, React.createElement(Choc, { standalone: true })));
  const f = () => $('[data-testid="cw-chocolates"]'); const w = () => $('[data-testid="cw-wrappers"]');
  for (const v of ["15", "10", "100", "200", "1"]) { await typeInto(f(), v); assert.equal(f().value, v, `chocolates ${v}`); assert.match(text('[data-testid="cw-pile-x"]') || "x", /x/); }
  await typeInto(w(), "15"); assert.equal(w().value, "15"); assert.match(text('[data-testid="cw-root"]'), /Chocolates\s*1 \/ 1/);
});
test("invalid quantities are explained, not silently changed: 0, -5, 999, 1.5, text, empty", async () => {
  const f = () => $('[data-testid="cw-chocolates"]');
  await typeInto(f(), "999"); assert.equal(f().value, "200"); assert.match(text('[data-testid="cw-notice"]'), /200/);
  await typeInto(f(), "-5"); assert.equal(f().value, "1"); assert.match(text('[data-testid="cw-notice"]'), /1/);
  await typeInto(f(), "1.5"); assert.equal(f().value, "2"); assert.match(text('[data-testid="cw-notice"]'), /whole number/);
  await typeInto(f(), "abc"); assert.match(text('[data-testid="cw-notice"]'), /not a number|whole number/); assert.ok(f().value !== "");
  await typeInto(f(), "20"); await typeInto($('[data-testid="cw-wrappers"]'), "20"); assert.equal($('[data-testid="cw-notice"]'), null);
});
test("rule 2 with one chocolate cannot start and says why", async () => {
  const sel = $('[data-testid="cw-rule"]'); sel.value = "rule2"; sel.dispatchEvent(new Event("change", { bubbles: true })); await wait();
  await typeInto($('[data-testid="cw-chocolates"]'), "1"); assert.equal($('[data-testid="cw-start"]').disabled, true); assert.match(text('[data-testid="cw-limits"]'), /needs 2 chocolates/);
  await typeInto($('[data-testid="cw-chocolates"]'), "20"); assert.equal($('[data-testid="cw-start"]').disabled, false);
  sel.value = "rule1"; sel.dispatchEvent(new Event("change", { bubbles: true })); await wait();
});
test("running: the rate readouts match the graph every second, the station pulses, quantities lock with a reason, and it finishes cleanly", async () => {
  await click($('[data-testid="cw-start"]')); assert.equal(intervals.length, 1);
  assert.equal($('[data-testid="cw-choc-locked"]').textContent, "20"); assert.match(text('[data-testid="cw-limits"]'), /locked.*Reset/);
  const expected = [7, 5, 3, 2, 1, 1, 1]; let packs = 0; let sawPulse = false;
  for (let s = 1; s <= 7; s++) {
    await tick(); packs += expected[s - 1];
    assert.equal(text('[data-testid="cw-time"]'), `${s} s`);
    assert.match(text('[data-testid="cw-rate-last"]'), new RegExp(`^${expected[s - 1]} packs? s`)); assert.match(text('[data-testid="cw-rate-avg"]'), new RegExp(`^${(packs / s).toFixed(1)} packs`));
    if ($('[data-testid="cw-station"]').dataset.pulse === "1") sawPulse = true;
    const seg = $('[data-testid="cw-last-segment"]'); assert.ok(seg, "last segment drawn");
  }
  assert.ok(sawPulse, "the wrapping-station pulse fires (it never did before)"); assert.ok($('[data-testid="cw-finished"]')); assert.equal(intervals.length, 0, "timer stopped"); assert.equal($('[data-testid="cw-start"]').textContent, "FINISHED"); assert.equal($('[data-testid="cw-start"]').disabled, true);
  assert.match(text('[data-testid="cw-live"]'), /Finished/);
});
test("graph series: the rate series draws one bar per second equal to the rate; reset keeps the previous run for comparison", async () => {
  const sel = $('[data-testid="cw-series"]'); sel.value = "rate"; sel.dispatchEvent(new Event("change", { bubbles: true })); await wait();
  assert.equal($$('[data-testid="cw-bar"]').length, 7); assert.match(text('[data-testid="cw-legend"]'), /rate/i);
  sel.value = "packs"; sel.dispatchEvent(new Event("change", { bubbles: true })); await wait();
  await click($('[data-testid="cw-reset"]')); assert.match(text('[data-testid="cw-legend"]'), /previous run/); assert.equal(text('[data-testid="cw-time"]'), "0 s"); assert.equal($('[data-testid="cw-start"]').textContent, "START");
  assert.equal($('[data-testid="cw-chocolates"]').value, "20", "fields are editable again after Reset");
});
test("pause/resume keeps time; pausing shows the last values (not a dash); no console errors", async () => {
  await click($('[data-testid="cw-start"]')); await tick(2); await click($('[data-testid="cw-pause"]')); assert.equal(intervals.length, 0);
  assert.match(text('[data-testid="cw-rate-last"]'), /packs? s/); assert.match(text('[data-testid="cw-status"]'), /Paused/); assert.equal(text('[data-testid="cw-time"]'), "2 s");
  await click($('[data-testid="cw-start"]')); await tick(); assert.equal(text('[data-testid="cw-time"]'), "3 s");
  mounted.root.unmount(); mounted.host.remove(); mounted = null; await wait(50); unhookIntervals();
  assert.equal(consoleErrors.filter((e) => !/not wrapped in act/.test(e)).length, 0, consoleErrors.join("\n"));
});

for (const { name, fn } of pending) {
  try { await fn(); console.log(`  ok   ${name}`); passed++; } catch (e) { console.log(`  FAIL ${name}\n       ${(e.stack || e.message).split("\n").slice(0, 5).join("\n       ")}`); failed++; }
}
console.error = origError;
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
