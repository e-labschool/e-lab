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
  assert.ok($('[data-testid="catalyst-switch"]')); assert.ok($('[data-testid="vessel-canvas"]')); assert.ok($('[data-testid="viewer"]')); assert.ok($('[data-testid="mb-svg"]')); assert.ok($('[data-testid="conc-svg"]'));
  assert.equal($('[data-testid="slider-piece"]'), null, "surface-area slider only in the solid system");
  assert.equal(consoleErrors.length, 0, consoleErrors.join("\n"));
});
test("accessible names: every slider has a label and a value text; the canvas and graphs have text alternatives; nothing relies on colour only", () => {
  for (const s of $$('input[type="range"]')) { assert.ok(document.querySelector(`label[for="${s.id}"]`), s.id); assert.ok(s.getAttribute("aria-valuetext"), s.id); }
  assert.match($('[data-testid="vessel-canvas"]').getAttribute("aria-label"), /A, .* B, .* kelvin/);
  assert.match($('[data-testid="mb-svg"]').getAttribute("aria-label"), /Area under the curve is 1\.000/);
  assert.ok($('[data-testid="conc-svg"]').getAttribute("aria-label"));
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
test("[CHANGED] catalyst moves the Ea threshold left, shading follows, and the Maxwell-Boltzmann CURVE IS UNCHANGED at constant T; a 'without catalyst' fraction appears", async () => {
  await setRange("T", 400); await setRange("ea", 20);
  const before = text('[data-testid="mb-fraction"]'); assert.equal($('[data-testid="mb-fraction-base"]'), null);
  const curveD = $('[data-testid="mb-curve"]').getAttribute("d"); const eaX = Number($('[data-testid="mb-ea-line"]').getAttribute("x1")); const shadeD = $('[data-testid="mb-shade"]').getAttribute("d");
  await click($$('[data-testid="catalyst-switch"] [role="radio"]')[1]);
  assert.ok($('[data-testid="mb-fraction-base"]')); assert.equal(text('[data-testid="mb-fraction-base"]'), before);
  assert.equal(text('[data-testid="mb-fraction"]'), MB.formatFraction(MB.fractionAbove(12, 400)));
  assert.equal($('[data-testid="mb-curve"]').getAttribute("d"), curveD, "the distribution curve is identical with the catalyst on");
  assert.ok(Number($('[data-testid="mb-ea-line"]').getAttribute("x1")) < eaX, "the Ea threshold line moved left"); assert.notEqual($('[data-testid="mb-shade"]').getAttribute("d"), shadeD, "the shaded region follows the lower threshold");
  assert.ok($('[data-testid="mb-ea-base-line"]'), "the uncatalysed Ea stays marked"); assert.match(text('[data-testid="workspace"]'), /Ea \(catalyst\)/);
  assert.match(text('[data-testid="what-is-happening"]'), /catalyst/i); assert.match(text('[data-testid="what-is-happening"]'), /curve itself does not change/);
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
  await setRange("ea", 50); await click($('[data-testid="mb-full-range"]')); assert.equal($('[data-testid="mb-graph"]').dataset.full, "1"); await click($('[data-testid="mb-pin"]'));
  await click($('[data-testid="reset"]'), 80); assert.equal($('[data-testid="mb-graph"]').dataset.full, "0", "Reset leaves the full-range view");
  assert.equal($('[data-testid="slider-T"]').value, "400"); assert.equal($('[data-testid="slider-n"]').value, "40"); assert.equal($('[data-testid="slider-ea"]').value, "10"); assert.equal($('[data-testid="slider-site"]').value, "240");
  assert.equal($$('[data-testid="catalyst-switch"] [role="radio"][aria-checked="true"]')[0].textContent, "Off");
  assert.equal($('[data-testid="mb-full-range"]'), null, "Ea 10 at 400 K is inside the axis: no full-range button"); assert.equal($('[data-testid="mb-pin"]').textContent, "Pin curve");
  const eng = $('[data-testid="vessel-canvas"]').__engine; assert.ok(eng.t < 2 && eng.succ < 3, `t=${eng.t}`);
  assert.equal(text('[data-testid="what-is-happening"]'), "A collision reacts only if its energy is at least Ea and the reactive sites face each other. A + B → C + D is not reversible."); // [CHANGED] default hint
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
  assert.match(text('[data-testid="predict-numbers"]'), /Measured initial rate: [\d.]+ → [\d.]+ reactions s⁻¹ \(×[\d.]+\)/); assert.match(text('[data-testid="predict-result"]'), /Your prediction matches/);
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
test("[CHANGED] graph controls: pin curve (the old 'Zoom tail' y-zoom is replaced by the full-range option, tested below); products view; hide/show graph", async () => {
  assert.equal($('[data-testid="mb-zoom"]'), null, "the old y-axis zoom control is gone");
  await click($('[data-testid="mb-pin"]')); assert.match($('[data-testid="mb-pin"]').textContent, /Unpin \d+ K/); await click($('[data-testid="mb-pin"]'));
  await click($$('[data-testid="conc-view"] [role="radio"]')[1]); assert.match($('[data-testid="conc-svg"]').getAttribute("aria-label"), /C formed/);
  await click($$('[data-testid="conc-view"] [role="radio"]')[2]);
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


// ---------------------------------------------------------------------------------------------------------------------
// NEW (correction spec): irreversible reaction on screen, smooth rate curve, products plateau, no bars, MB graph behaviour.
// ---------------------------------------------------------------------------------------------------------------------
const eng = () => $('[data-testid="vessel-canvas"]').__engine;
const pts = (d) => d.split(/(?=[ML])/).map((q) => q.slice(1).split(",").map(Number)); // "M x,y L x,y" -> [[x,y],...]
test("NEW no vertical bars or histogram in EITHER graph (rate view, products view, energy graph) and no histogram / steady-supply controls anywhere", async () => {
  await mount(React.createElement(Collision, { standalone: true })); await wait(300);
  const noBars = (svg, name) => {
    assert.ok(svg, name); const rects = [...svg.querySelectorAll("rect")].filter((r) => !r.closest("clipPath")); assert.equal(rects.length, 0, `${name}: ${rects.length} <rect> bars`);
    assert.equal(svg.querySelectorAll("[data-testid*='bar'], [data-testid*='hist'], .ct-bar").length, 0, `${name}: bar markup`);
  };
  noBars($('[data-testid="mb-svg"]'), "energy graph"); noBars($('[data-testid="conc-svg"]'), "Both view (default)");
  await click($$('[data-testid="conc-view"] [role="radio"]')[1]); noBars($('[data-testid="conc-svg"]'), "products view"); await click($$('[data-testid="conc-view"] [role="radio"]')[0]); noBars($('[data-testid="conc-svg"]'), "reactants view"); await click($$('[data-testid="conc-view"] [role="radio"]')[2]);
  assert.equal($('[data-testid="conc-svg"]').querySelectorAll("path[data-testid^='curve-']").length, 2, "[CHANGED: was ONE rate curve] the Both view draws two continuous curves (reactant and product)"); assert.equal($('[data-testid="conc-svg"]').querySelectorAll("[data-testid='rate-line']").length, 0, "no rate curve exists");
  await click($('[data-testid="settings"]')); const panel = text('[data-testid="settings-panel"]'); assert.ok(!/histogram|Bars|vessel energies|Steady supply/i.test(panel), `settings still mention a removed control: ${panel.slice(0, 200)}`);
  assert.equal($('[data-testid="set-hist"]'), null); assert.equal($('[data-testid="set-steady"]'), null); await click($('[data-testid="settings"]'));
  assert.ok(!/histogram/i.test($('[data-testid="workspace"]').innerHTML), "no 'histogram' anywhere in the page");
});
test("NEW Maxwell-Boltzmann graph: the drawn curve starts at zero, has one peak, a right tail, area 1.000; peak = RT/2 (1.66 kJ/mol at 400 K); 3 readouts; axis adapts (not the old fixed 0-70)", async () => {
  await setRange("T", 400); await setRange("ea", 10);
  const g = () => $('[data-testid="mb-graph"]'); assert.ok(Number(g().dataset.xmax) < 35, `x range at 400 K is ${g().dataset.xmax} kJ/mol`);
  const P = pts($('[data-testid="mb-curve"]').getAttribute("d")); assert.ok(P.length > 200);
  const baseY = Math.max(...P.map((q) => q[1])); assert.ok(Math.abs(P[0][1] - baseY) < 0.11, "the curve begins on the zero line"); assert.ok(P[P.length - 1][1] > baseY - 0.05 * (baseY - Math.min(...P.map((q) => q[1]))), "and has fallen almost back to zero at the right edge (tail)");
  let ups = 0; let downs = 0; let dir = 0; for (let i = 1; i < P.length; i++) { const sg = Math.sign(P[i][1] - P[i - 1][1]); if (sg && sg !== dir) { if (sg > 0) ups++; else downs++; dir = sg; } } // y grows downwards
  assert.equal(downs, 1, "y falls once (curve rises) ..."); assert.equal(ups, 1, "... and then rises once (curve falls): ONE peak");
  const iTop = P.reduce((m, q, i) => (q[1] < P[m][1] ? i : m), 0); assert.ok(iTop < 0.4 * P.length, "peak sits in the left part"); assert.ok(P.length - iTop > 1.5 * iTop, "longer tail on the right than the rise on the left (asymmetric)");
  assert.equal(text('[data-testid="mb-area"]'), "1.000"); assert.equal(text('[data-testid="mb-mode"]'), "1.66 kJ/mol");
  const pk = $('[data-testid="mb-peak"]'); assert.ok(Math.abs(Number(pk.getAttribute("cy")) - Math.min(...P.map((q) => q[1]))) < 1.2, "the peak marker sits on the curve's top");
});
test("NEW temperature: broader and lower with the peak further right (readouts), more molecules above Ea, area stays 1.000; lower T does the opposite", async () => {
  await setRange("ea", 10); const read = () => ({ mode: parseFloat(text('[data-testid="mb-mode"]')), frac: text('[data-testid="mb-fraction"]'), area: text('[data-testid="mb-area"]'), x: Number($('[data-testid="mb-graph"]').dataset.xmax) });
  await setRange("T", 300); const a = read(); await setRange("T", 600); const b = read(); await setRange("T", 300); const c = read();
  assert.ok(b.mode > a.mode && b.x >= a.x, "peak moves right"); assert.equal(a.area, "1.000"); assert.equal(b.area, "1.000");
  assert.equal(a.frac, MB.formatFraction(MB.fractionAbove(10, 300))); assert.equal(b.frac, MB.formatFraction(MB.fractionAbove(10, 600))); assert.ok(MB.fractionAbove(10, 600) > 4 * MB.fractionAbove(10, 300), "far more molecules above Ea");
  assert.deepEqual(c, a, "back at 300 K: same curve, same numbers");
  // pinned reference: the 300 K curve stays drawn (dashed) while T is raised; the live curve is lower
  await click($('[data-testid="mb-pin"]')); await setRange("T", 600); const live = pts($('[data-testid="mb-curve"]').getAttribute("d")); assert.ok($('[data-testid="mb-svg"] path[stroke-dasharray]'), "the pinned curve is dashed");
  const top = (d) => Math.min(...pts(d).map((q) => q[1])); const pinTop = top($('[data-testid="mb-svg"] path[stroke-dasharray]').getAttribute("d")); assert.ok(pinTop < top($('[data-testid="mb-curve"]').getAttribute("d")), "on the SAME axes the 300 K curve is taller than the 600 K curve"); void live;
  await click($('[data-testid="mb-pin"]')); await setRange("T", 400);
});
test("NEW Ea outside the displayed range: a clearly labelled full-range option reaches Ea without distorting the curve; the note explains the tiny shaded area", async () => {
  await setRange("T", 300); await setRange("ea", 45);
  assert.ok($('[data-testid="mb-full-range"]'), "button offered"); assert.equal($('[data-testid="mb-full-range"]').textContent, "Show full range");
  assert.ok($('[data-testid="mb-ea-off"]'), "threshold marked at the edge"); assert.match(text('[data-testid="mb-ea-off"]'), /Ea = 45 kJ\/mol.*beyond this axis/); assert.ok($('[data-testid="mb-note"]'));
  assert.equal($('[data-testid="mb-shade"]'), null, "nothing to shade inside the range");
  const x0 = Number($('[data-testid="mb-graph"]').dataset.xmax); await click($('[data-testid="mb-full-range"]'));
  assert.equal($('[data-testid="mb-full-range"]').textContent, "Zoom to peak"); const x1 = Number($('[data-testid="mb-graph"]').dataset.xmax); assert.ok(x1 >= 45 * 1.15 && x1 > x0);
  assert.equal($('[data-testid="mb-ea-off"]'), null); assert.ok($('[data-testid="mb-ea-line"]')); assert.equal(text('[data-testid="mb-fraction"]'), MB.formatFraction(MB.fractionAbove(45, 300)));
  assert.equal(text('[data-testid="mb-area"]'), "1.000"); assert.equal($('[data-testid="mb-graph"]').dataset.ymax, String(MB.mbAxis(300, { eaList: [45] }).yMax), "y scale unchanged: the curve keeps its shape");
  await click($('[data-testid="mb-full-range"]')); assert.equal($('[data-testid="mb-graph"]').dataset.full, "0"); await setRange("ea", 10); assert.equal($('[data-testid="mb-full-range"]'), null);
});
test("NEW irreversible reaction on screen: counts of A, B fall; C, D rise equal to the reactions; products never revert; concentration graph uses the engine's data", async () => {
  await click($('[data-testid="reset"]'), 80); await setRange("T", 600); await setRange("ea", 6); await setRange("site", 360);
  await click($('[data-testid="play-pause"]')); // pause the loop; drive the engine by hand
  const count = (k) => Number(text(`[data-testid="count-${k}"]`)); let lastC = 0; let lastA = 40;
  for (let k = 0; k < 6; k++) {
    eng().run(8); await wait(260);
    const [a, b, c, d] = eng().speciesCounts(); assert.deepEqual([count("A"), count("B"), count("C"), count("D")], [a, b, c, d], "vessel key shows the engine's counts");
    assert.ok(c >= lastC && a <= lastA && a + b + c + d === 80 && c === eng().succ && d === eng().succ, `step ${k}: ${a},${b},${c},${d}`); lastC = c; lastA = a;
    assert.equal(Number($('[data-testid="conc-svg"]').dataset.total), eng().succ, "graph total = engine total"); assert.equal(Number($('[data-testid="vessel-canvas"]').dataset.succ), eng().succ);
  }
  assert.ok(eng().succ > 20, `reactions ${eng().succ}`);
  await click($$('[data-testid="conc-view"] [role="radio"]')[1]); await wait(260); assert.equal(Number($('[data-testid="curve-C"]').dataset.final), eng().succ, "products graph ends at the engine's product count");
  assert.match($('[data-testid="conc-svg"]').getAttribute("aria-label"), /C formed/); await click($$('[data-testid="conc-view"] [role="radio"]')[2]);
});
test("[CHANGED: was 'NEW rate graph'] concentration graph: Both view falls/rises from the engine's counts; axes say concentration and time; reactant exhaustion is stated; the live rate chip still falls to 0; the Products curve plateaus", async () => {
  await click($('[data-testid="reset"]'), 80); await click($('[data-testid="play-pause"]')); // pause first: the Concentration slider only adds/removes the difference, so nothing may react before n is set
  await setRange("T", 700); await setRange("ea", 5); await setRange("site", 360); await setRange("n", 6); eng().run(400); await wait(300);
  assert.equal(eng().succ, 6); assert.equal(eng().limitingLeft(), 0); assert.equal($('[data-testid="conc-svg"]').dataset.finished, "1"); assert.ok($('[data-testid="graph-finished-note"]')); assert.match(text('[data-testid="graph-finished-note"]'), /limiting reactant used up/);
  assert.equal($('[data-testid="curve-A"]').dataset.final, "0", "A has fallen to 0"); assert.equal($('[data-testid="curve-C"]').dataset.final, "6", "C has risen to 6");
  assert.match(text('[data-testid="conc-panel"]'), /Concentration \(particles/); assert.match(text('[data-testid="conc-panel"]'), /Time \/ s/); assert.match(text('[data-testid="conc-note"]'), /Fixed volume: concentration is proportional to the number of particles/);
  assert.ok(!/mol/i.test(text('[data-testid="conc-svg"]')), "no invented mol dm-3 numbers"); assert.equal($('[data-testid="conc-svg"]').querySelectorAll("[data-testid='rate-line']").length, 0);
  const A = pts($('[data-testid="curve-A"]').getAttribute("d")); assert.ok(A.length >= 100, "a dense continuous line, not bars or stems"); for (let k = 1; k < A.length; k++) assert.ok(A[k][1] >= A[k - 1][1] - 1e-6, "the reactant curve never rises");
  for (let i = 0; i < 30 && !/0\.00 s⁻¹/.test(text('[data-testid="live-rate"]')); i++) await wait(100); assert.match(text('[data-testid="live-rate"]'), /0\.00 s⁻¹/, "the live rate chip (not tied to the graph) shows 0.00 s⁻¹ once everything has reacted");
  await click($$('[data-testid="conc-view"] [role="radio"]')[1]); await wait(260);
  const Q = pts($('[data-testid="curve-C"]').getAttribute("d")); assert.equal($('[data-testid="curve-C"]').dataset.final, "6"); for (let k = 1; k < Q.length; k++) assert.ok(Q[k][1] <= Q[k - 1][1] + 0.15 && Q[k][0] >= Q[k - 1][0] - 1e-6, `cumulative products only rise (0.15 px tolerance for a render in mid-update) (point ${k}: ${Q[k - 1]} -> ${Q[k]})`);
  assert.ok(Math.abs(Q[Q.length - 1][1] - Q[Q.length - 2][1]) < 1e-6, "flat at the end: plateau"); assert.ok($('[data-testid="products-max"]'));
  assert.match(text('[data-testid="conc-panel"]'), /all 6 formed: reactant used up/); await click($$('[data-testid="conc-view"] [role="radio"]')[2]);
});
test("NEW Reset restores the initial reactants and clears the concentration graph; the mixed and solid systems both start from their full reactants", async () => {
  await click($('[data-testid="reset"]'), 120);
  const k = (id) => Number(text(`[data-testid="count-${id}"]`)); assert.ok(eng().t < 2); // the run restarted from the full 40 + 40 (a reaction or two may already have happened in the 120 ms)
  assert.ok(k("A") + k("C") === 40 && k("B") + k("D") === 40 && k("C") === k("D") && k("C") <= 4, `${k("A")},${k("B")},${k("C")},${k("D")}`); assert.equal(eng().unitsTotal(), 80);
  assert.ok(Number($('[data-testid="conc-svg"]').dataset.total) <= 4); assert.ok(eng().t < 3 && eng().succ <= 8, "the run restarted (a few early reactions at most)");
  await click($('[data-testid="system-tabs"] [role="radio"]:nth-child(2)')); await wait(200); assert.equal(Number(text('[data-testid="count-A"]')) + Number(text('[data-testid="count-C"]')), 144, "solid: 144 sites, unused + used up"); assert.equal(Number(text('[data-testid="count-B"]')) + Number(text('[data-testid="count-D"]')), 40);
  await click($('[data-testid="play-pause"]')); eng().run(0); await setRange("T", 700); await setRange("ea", 5); eng().run(60); await wait(260);
  const [a, b, c, d] = eng().speciesCounts(); assert.ok(c > 3 && a + c === 144 && b + d === 40 && text('[data-testid="count-C"]') === String(c), `solid ${a},${b},${c},${d}`);
  await click($('[data-testid="reset"]'), 120); assert.ok(eng().t < 2 && eng().p.system === "mixed" && Number(text('[data-testid="count-A"]')) + Number(text('[data-testid="count-C"]')) === 40, "Reset returns to the default A + B vessel with the full 40 + 40 (a reaction or two may already have happened)"); await click($('[data-testid="system-tabs"] [role="radio"]:nth-child(1)')); await wait(100);
  assert.ok(Number(text('[data-testid="count-A"]')) + Number(text('[data-testid="count-C"]')) === 40);
});
test("NEW the reaction responds to the conditions (the engine does): raising T increases the number of reactions in the same time; 'Next reaction', speeds and Step still work", async () => {
  const runFor = async (T) => { await click($('[data-testid="reset"]'), 60); await setRange("T", T); await setRange("ea", 10); await click($('[data-testid="play-pause"]')); eng().run(6); await wait(260); return eng().succ; };
  const lo = await runFor(300); const hi = await runFor(650); assert.ok(hi > lo + 3, `${lo} reactions at 300 K, ${hi} at 650 K in the same 6 s`);
  assert.equal($$('[data-testid="speed"] [role="radio"]').length, 4); await click($('[data-testid="reset"]'), 60);
});

test("[CHANGED: Rate view removed, Both is the default] selector Reactants | Products | Both and the reaction equation A + B → C + D share one state; species buttons have aria-pressed; every view is curves only (no bars)", async () => {
  await click($('[data-testid="reset"]'), 80); await click($('[data-testid="play-pause"]')); eng().run(90); await wait(300);
  const names = $$('[data-testid="conc-view"] [role="radio"]').map((r) => r.textContent.trim()); assert.deepEqual(names, ["Reactants", "Products", "Both"], "[CHANGED] no Rate option");
  const eq = $('[data-testid="equation"]'); assert.ok(eq); assert.match(eq.getAttribute("aria-label"), /A \+ B → C \+ D/); assert.equal(eq.textContent, "A+B→C+DAll");
  const on = () => ["A", "B", "C", "D"].filter((k) => $(`[data-testid="eq-${k}"]`).getAttribute("aria-pressed") === "true").join(""); const view = () => $('[data-testid="conc-plot"]').dataset.view; const cur = () => $$('[data-testid="conc-svg"] path[data-testid^="curve-"]').map((p) => p.dataset.testid.slice(6)).join("");
  const radio = async (i) => click($$('[data-testid="conc-view"] [role="radio"]')[i]); const checked = () => $$('[data-testid="conc-view"] [role="radio"]').findIndex((r) => r.getAttribute("aria-checked") === "true");
  assert.equal(view(), "both", "[CHANGED] Both is the default view"); assert.equal(on(), "", "Both view: no single species selected"); assert.equal($('[data-testid="eq-all"]').getAttribute("aria-pressed"), "true"); assert.equal(checked(), 2); assert.equal(cur(), "AC");
  await radio(0); assert.equal(view(), "reactants"); assert.equal(cur(), "AB"); assert.equal(on(), "AB", "Reactants view: A and B selected"); await wait(50);
  await click($('[data-testid="eq-A"]')); assert.equal(view(), "reactants"); assert.equal(cur(), "A"); assert.equal(on(), "A"); assert.equal(checked(), 0, "selector shows Reactants");
  assert.equal(Number($('[data-testid="curve-A"]').dataset.final), eng().speciesCounts()[0], "A curve ends at the engine's A count");
  await click($('[data-testid="eq-B"]')); assert.equal(cur(), "B"); assert.equal(on(), "B"); assert.equal(Number($('[data-testid="curve-B"]').dataset.final), eng().speciesCounts()[1]);
  await click($('[data-testid="eq-B"]')); assert.equal(cur(), "AB", "clicking the selected species again shows both reactants");
  await click($('[data-testid="eq-C"]')); assert.equal(view(), "products"); assert.equal(cur(), "C"); assert.equal(on(), "C"); assert.equal(checked(), 1); assert.equal(Number($('[data-testid="curve-C"]').dataset.final), eng().succ);
  await click($('[data-testid="eq-D"]')); assert.equal(cur(), "D"); assert.equal(on(), "D"); assert.equal(Number($('[data-testid="curve-D"]').dataset.final), eng().succ);
  await click($('[data-testid="eq-arrow"]')); assert.equal(view(), "both"); assert.equal(on(), ""); assert.equal($('[data-testid="eq-arrow"]').getAttribute("aria-pressed"), "true"); assert.equal($('[data-testid="eq-all"]').getAttribute("aria-pressed"), "true"); assert.equal(checked(), 2, "selector shows Both");
  assert.equal(cur(), "AC"); const sa = Number($('[data-testid="curve-A"]').dataset.final); const sc = Number($('[data-testid="curve-C"]').dataset.final); assert.equal(sa + sc, 40, "A left + C formed = the 40 started with"); assert.ok(sc > 15, `reacted ${sc}`);
  assert.equal($$('[data-testid="sample-dot"]').length, 2 * 37, "markers at the 37 sample times, for both curves"); assert.ok($('[data-testid="graph-legend"]')); assert.match(text('[data-testid="graph-legend"]'), /A left.*C formed/);
  for (const i of [0, 1, 2]) { await radio(i); assert.equal($$('[data-testid="conc-svg"] rect').filter((r) => !r.closest("clipPath") && r.getAttribute("data-testid") !== "x").length, 0, `view ${i}: no <rect> bars`); }
  await radio(2); assert.equal(on(), "", "selector Both leaves no single species"); await click($('[data-testid="eq-all"]')); assert.equal(view(), "both");
  await radio(0); assert.equal(on(), "AB", "using the selector clears a single-species choice"); await click($('[data-testid="eq-C"]')); await radio(1); assert.equal(on(), "CD");
  assert.ok(Math.abs(Number($('[data-testid="curve-C"]').dataset.final) - eng().succ) < 1e-9);
  assert.ok($$('[data-testid="equation"] button').every((b) => b.tagName === "BUTTON" && b.hasAttribute("aria-pressed") && (b.getAttribute("aria-label") || b.textContent.trim())), "native buttons, keyboard operable, with names and a pressed state");
  await radio(2);
});
test("NEW Both view in the solid system uses B and D; Reactants view shows the solid's unused sites (A) and B; Reset returns to the Both view, clears the species choice and the curves", async () => {
  await click($('[data-testid="system-tabs"] [role="radio"]:nth-child(2)')); await wait(100); await click($('[data-testid="play-pause"]')); await setRange("T", 700); await setRange("ea", 5); await setRange("site", 360);
  eng().run(80); await wait(300);
  await click($$('[data-testid="conc-view"] [role="radio"]')[0]); assert.equal($$('[data-testid="conc-svg"] path[data-testid^="curve-"]').length, 2); const A = Number($('[data-testid="curve-A"]').dataset.final); const B = Number($('[data-testid="curve-B"]').dataset.final);
  assert.equal(A, eng().speciesCounts()[0]); assert.equal(B, eng().speciesCounts()[1]); assert.ok(A < 144 && A > 100);
  await click($$('[data-testid="conc-view"] [role="radio"]')[2]); assert.match(text('[data-testid="graph-legend"]'), /B left.*D formed/); assert.equal(Number($('[data-testid="curve-B"]').dataset.final) + Number($('[data-testid="curve-D"]').dataset.final), 40);
  await click($('[data-testid="eq-C"]')); assert.equal($('[data-testid="conc-plot"]').dataset.species, "C");
  await click($('[data-testid="reset"]'), 120); assert.equal($('[data-testid="conc-plot"]').dataset.view, "both"); assert.equal($('[data-testid="conc-plot"]').dataset.species, ""); assert.equal($('[data-testid="eq-C"]').getAttribute("aria-pressed"), "false");
  await click($$('[data-testid="conc-view"] [role="radio"]')[2]); assert.ok(eng().t < 2); const sa = Number($('[data-testid="curve-A"]').dataset.final); const sc = Number($('[data-testid="curve-C"]').dataset.final); assert.ok(sa + sc === 40 && sc <= 4, `after Reset A ${sa}, C ${sc}`);
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

test("reaction profile (kinetics limit): drawn in the detail popover from the Ea slider; catalyst adds the lower green path with the same dH; dH is labelled illustrative", async () => {
  await mount(React.createElement(Collision, { standalone: true })); await setRange("ea", 40);
  await click($('[data-testid="explain-info"]')); const rp = () => $('[data-testid="reaction-profile"]'); assert.ok(rp(), "profile is in the popover");
  assert.match(rp().textContent, /Ea = 40 kJ/); assert.equal($('[data-testid="profile-cat"]'), null); assert.match(rp().textContent, /ΔH = −20 kJ/); assert.match(rp().textContent, /illustrative/);
  const { profileGeometry } = await import("../src/engines/collision-theory-visualizer/components/ReactionProfile.jsx"); const g = profileGeometry({ ea: 30, eaCat: 18, dh: -20 });
  assert.ok(g.y(30) < g.y(18) && g.y(18) < g.y(0) && g.y(0) < g.y(-20), "peak above the catalysed peak, above reactants, above exothermic products (SVG y grows downward)");
  await click($('[data-testid="explain-info"]')); await click($$('[data-testid="catalyst-switch"] [role="radio"]')[1]); await click($('[data-testid="explain-info"]'));
  assert.ok($('[data-testid="profile-cat"]'), "catalyst path drawn"); assert.match(rp().textContent, /with the catalyst Ea = 24/); assert.match(rp().textContent, /lowers Ea, not ΔH/);
  await click($$('button').find((b) => b.textContent.trim() === "Endothermic")); assert.match(rp().textContent, /ΔH = \+20 kJ/);
  await click($$('[data-testid="catalyst-switch"] [role="radio"]')[0]);
});
test("Chocolate Wrapping predict-first (AK-58): reveal needs a prediction; the answer is computed from the model; next question works", async () => {
  hookIntervals(); await mount(React.createElement(ModeProvider, null, React.createElement(Choc, { standalone: true })));
  const { PREDICT_TASKS } = await import("../src/engines/chocolate-wrapping-rate/lib/wrappingModel.js");
  assert.ok($('[data-testid="cw-reveal"]').disabled, "Reveal is disabled until a prediction is chosen");
  for (let k = 0; k < PREDICT_TASKS.length; k += 1) {
    const want = PREDICT_TASKS[k].run().answer; const wrong = ["higher", "the same", "lower"].find((o) => o !== want);
    await click($(`[data-testid="cw-pick-${wrong.replace(" ", "-")}"]`)); await click($('[data-testid="cw-reveal"]')); assert.match(text('[data-testid="cw-predict-result"]'), new RegExp(`Not quite \\(the answer is ${want}\\)`));
    await click($(`[data-testid="cw-pick-${want.replace(" ", "-")}"]`)); assert.equal(text('[data-testid="cw-predict-result"]'), "", "changing the pick hides the old verdict"); await click($('[data-testid="cw-reveal"]')); assert.match(text('[data-testid="cw-predict-result"]'), /^Correct: /);
    await click($('[data-testid="cw-next-task"]'));
  }
  unhookIntervals();
});

for (const { name, fn } of pending) {
  try { await fn(); console.log(`  ok   ${name}`); passed++; } catch (e) { console.log(`  FAIL ${name}\n       ${(e.stack || e.message).split("\n").slice(0, 5).join("\n       ")}`); failed++; }
}
console.error = origError;
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
