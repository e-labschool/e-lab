#!/usr/bin/env node
// UI + pure-model tests for the six acid-base simulations (REAL components in jsdom, REAL models).
//   node scripts/test-acidbase-round2-ui.mjs   (round-2 features: AK-05/07/15/17/38/41/48/51 and the polyprotic buffer bands)
// Honest limits: jsdom has no layout, so geometry (no clipping, no scroll at 1366x768, contrast of rendered pixels, focus ring
// visibility) is covered by scripts/verify-acidbase-sims.mjs in headless Chromium, not here. ResizeObserver is absent, so the
// titration chart uses its default 640x340 box here.
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { register } from "node:module";

const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
for (const k of ["window", "document", "HTMLElement", "HTMLInputElement", "HTMLSelectElement", "Node", "MouseEvent", "KeyboardEvent", "Event", "PointerEvent", "MutationObserver", "getComputedStyle"]) {
  try { globalThis[k] = dom.window[k]; } catch { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true }); }
}
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.IS_REACT_ACT_ENVIRONMENT = false;
globalThis.localStorage = dom.window.localStorage;
register("./jsx-loader-hooks.mjs", import.meta.url);
register("./image-viewer-loader-hooks.mjs", import.meta.url);

const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const { ModeProvider } = await import("../src/context/ModeContext.jsx");

let passed = 0;
const pending = [];
const test = (name, fn) => pending.push({ name, fn });
const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const say = (m) => console.log("   " + m);
const btn = (text) => $$("button").find((b) => b.textContent.trim() === text);
const click = async (text) => { const b = typeof text === "string" ? btn(text) : text; assert.ok(b, `button ${text}`); b.dispatchEvent(new MouseEvent("click", { bubbles: true })); await wait(); };
async function select(label, value) { const el = $(`select[aria-label="${label}"]`); assert.ok(el, label); Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, "value").set.call(el, String(value)); el.dispatchEvent(new Event("change", { bubbles: true })); await wait(); }
async function typeInto(el, text, commit = "blur") { Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(el, text); el.dispatchEvent(new Event("input", { bubbles: true })); await wait(10); if (commit === "blur") { el.dispatchEvent(new Event("focusout", { bubbles: true })); } else el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); await wait(); }
let root = null;
async function mount(modPath) {
  if (root) { root.unmount(); await wait(); }
  document.getElementById("root").innerHTML = "";
  const { default: C } = await import(modPath);
  root = createRoot(document.getElementById("root"));
  root.render(React.createElement(ModeProvider, null, React.createElement(C, { standalone: true })));
  await wait(120);
}


const PHC = "../src/engines/ph-calculator-visualizer/PHCalculatorVisualizer.jsx";
const HOH = "../src/engines/h-oh-balance/HOHBalance.jsx";
const TIT = "../src/engines/titration-ph-curve/TitrationPHCurve.jsx";
const EQ = "../src/engines/equivalence-point/EquivalencePoint.jsx";
const BUF = "../src/engines/buffer-action-visualizer/BufferActionVisualizer.jsx";
const NEU = "../src/engines/neutralization-particle-visualizer/NeutralizationParticleVisualizer.jsx";
const fs = await import("node:fs");
const readFile = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");

test("pH Calculator challenge (AK-07): question is generated, answer checked with a reason, working shown, score kept, Reset restarts", async () => {
  await mount(PHC);
  const q1 = $('[data-testid="phc-question"]').textContent; assert.match(q1, /pH|\[/);
  const { phChallenge } = await import("../src/lib/acidbase/challenges.js"); const ch = phChallenge(1 * 7919 + 13); assert.equal(q1, ch.prompt, "the first question is the seeded one (repeatable)");
  const inp = $('input[aria-label="Your answer"]');
  await typeInto(inp, "banana", "enter"); assert.match($('[data-testid="phc-result"]').textContent, /Type a number/); assert.doesNotMatch($(".phc-score").textContent, /correct/, "a non-number is not scored");
  await typeInto(inp, String(ch.answer), "enter"); assert.match($('[data-testid="phc-result"]').textContent, /Correct/); assert.match($(".phc-score").textContent, /1 of 1 correct/);
  await typeInto(inp, "123456", "enter"); assert.match($('[data-testid="phc-result"]').textContent, /Not yet|Close|Check/); assert.match($(".phc-score").textContent, /1 of 1 correct/, "re-checking the same question is not double counted");
  await click("Show working"); assert.equal($('[data-testid="phc-working"]').textContent, ch.working); await click("Hide working");
  await click("New question"); assert.notEqual($('[data-testid="phc-question"]').textContent, q1);
  await click("Show on scale"); const ch2 = phChallenge(2 * 7919 + 13); const want = ch2.kind === "ph-to-conc" ? ch2.pH : ch2.answer; assert.equal(Number($('[role="slider"]').getAttribute("aria-valuenow")), Math.min(15, Math.max(-1, want)), "Show on scale moves the marker to the pH in the question (was NaN)");
  await click("Reset"); assert.equal($('[data-testid="phc-question"]').textContent, q1); assert.doesNotMatch($(".phc-score").textContent, /correct/);
});

test("H+/OH- temperature (AK-15): pKw and the neutral pH follow Kw(T); 25 C is the IB value; heating water stays neutral", async () => {
  await mount(HOH);
  const sl = $('input[aria-label="Temperature in degrees Celsius"]'); assert.ok(sl);
  assert.equal($('[data-testid="pkw"]').textContent, "14.00"); assert.equal($('[data-testid="ph"]').textContent, "7.00");
  await typeInto(sl, "100", "input"); assert.equal($('[data-testid="pkw"]').textContent, "12.29"); assert.equal($('[data-testid="ph"]').textContent, "6.14"); assert.match(document.body.textContent, /Neutral/i);
  await typeInto(sl, "0", "input"); assert.equal($('[data-testid="pkw"]').textContent, "14.94"); assert.equal($('[data-testid="ph"]').textContent, "7.47");
  await typeInto(sl, "25", "input"); assert.equal($('[data-testid="ph"]').textContent, "7.00");
  say("pKw at 0, 25, 100 degC: 14.94, 14.00, 12.29; pure-water pH 7.47, 7.00, 6.14");
});

test("Titration unknown-concentration practical (AK-38): find V(eq) from readings, answer within 2 %, wrong answer explained, reveal, new unknown", async () => {
  await mount(TIT);
  const { makeUnknown, concFromVeq } = await import("../src/lib/acidbase/challenges.js"); const { makeTitration } = await import("../src/lib/acidbase/titration.js");
  const u = makeUnknown(1 * 7919 + 11); const tu = makeTitration({ flaskId: u.flaskId, buretteId: u.buretteId, cFlask: u.cFlask, cBurette: u.cBurette });
  await click("Unknown"); assert.ok($('[data-testid="unknown-panel"]')); assert.doesNotMatch($('[data-testid="unknown-head"]').textContent, new RegExp(u.cFlask.toFixed(3)), "the hidden value is not on screen");
  assert.doesNotMatch($('[data-testid="unknown-panel"]').textContent, new RegExp(String(u.cFlask).replace(".", "\\.") + "(?!\\d)"));
  for (let i = 0; i < 3; i += 1) await click("+1.0 cm³"); await click("+0.1 cm³");
  assert.ok($('[data-testid="record-reading"]')); await click($('[data-testid="record-reading"]')); assert.equal($('[data-testid="readings-panel"]').getAttribute("data-count"), "1");
  const tx = $('[data-testid="unknown-answer"]');
  await typeInto(tx, "abc", "enter"); assert.match($('[data-testid="unknown-result"]').textContent, /Type a concentration/);
  const right = concFromVeq(tu.veq); const wrong = right * 1.3;
  await typeInto(tx, wrong.toFixed(4), "enter"); assert.match($('[data-testid="unknown-result"]').textContent, /too high by 30 %/);
  await typeInto(tx, right.toFixed(4), "enter"); assert.match($('[data-testid="unknown-result"]').textContent, /Correct: within 2 %/);
  await click("Reveal"); assert.match($('[data-testid="unknown-result"]').textContent, new RegExp(`${u.cFlask.toFixed(3).replace(".", "\\.")} mol dm`));
  await click("New unknown"); assert.equal($('[data-testid="unknown-answer"]').value, ""); assert.equal($('[data-testid="readings-panel"]').getAttribute("data-count"), "0");
  say(`flask ${u.flaskId}, V(eq) ${tu.veq.toFixed(2)} cm3, c = ${right.toFixed(4)} mol dm-3`);
});

test("Titration polyprotic (AK-41): H3PO4 / H2CO3 show a buffer band at each reachable pKa, and the text no longer says 'no buffer region'", async () => {
  const { makePolyTitration } = await import("../src/lib/acidbase/polyprotic.js"); const { buildExperimentGraph } = await import("../src/engines/titration-ph-curve/lib/graphModel.js"); const { explainPair, titrantNote } = await import("../src/engines/titration-ph-curve/lib/explain.js");
  for (const [id, n] of [["H3PO4", 2], ["H2CO3", 2]]) {
    const t = makePolyTitration({ acidId: id }); assert.equal(t.buffers.length, n, `${id}: ${n} buffer bands (a pKa >= 12 is lost in the water)`);
    for (const b of t.buffers) { const mid = (b.vLow + b.vHigh) / 2; assert.ok(Math.abs(t.phAt(b.index * t.veq - t.veq / 2) - b.pKa) < 0.2, `${id}: pH at half-equivalence ${b.index} is within 0.2 of pKa${b.index}`); assert.ok(b.vLow < mid && mid < b.vHigh && b.vHigh < b.index * t.veq); const lowOK = b.vLow === (b.index - 1) * t.veq ? t.phAt(b.vLow) >= b.pKa - 1 : Math.abs(t.phAt(b.vLow) - (b.pKa - 1)) < 1e-6; assert.ok(lowOK && Math.abs(t.phAt(b.vHigh) - (b.pKa + 1)) < 1e-6, `${id}: band ${b.index} edges are exactly pH pKa-1 and pKa+1 (low edge clipped to the start of the step when the acid already starts above pKa-1)`); }
    const m = buildExperimentGraph(t, { W: 640, H: 340 }); assert.equal(m.buffers.length, n); assert.ok(m.buffers.every((b) => b.x2 > b.x1));
    assert.equal(titrantNote(t), null); assert.doesNotMatch(explainPair(t).text, /no buffer region/); assert.match(explainPair(t).text, /buffer region/);
  }
  await mount(TIT); await select("Flask solution", "H3PO4"); assert.equal($$('[data-testid="buffer-region"]').length, 2); assert.match($('[data-testid="legend"]').textContent, /Buffer regions/);
  assert.doesNotMatch($('[data-testid="explain"]').textContent, /no buffer region/);
  await select("Flask solution", "CH3COOH"); assert.equal($$('[data-testid="buffer-region"]').length, 1); assert.match($('[data-testid="legend"]').textContent, /Buffer region: \[A⁻\]\/\[HA\] between 1:10 and 10:1/);
  await select("Flask solution", "HCl"); assert.equal($$('[data-testid="buffer-region"]').length, 0, "strong/strong: no buffer band");
});

test("Shared readings panel: the Record button gets a visible fill inside the titration practical (--sd-blue was undefined there)", () => {
  const css = readFile("../src/engines/titration-ph-curve/TitrationPHCurve.css"); assert.match(css, /\.tit-readings\s*\{[^}]*--sd-blue:\s*#[0-9a-f]{6}/i);
});

test("Equivalence Point (AK-30/31): 0.1 cm3 drop button moves the pH trace by exactly 0.1; Buffer sticky controls and trace exist (AK-48/51)", async () => {
  await mount(EQ); const before = $('[data-testid="ph"]').textContent; await click($('[data-testid="add-drop"]')); await click($('[data-testid="add-drop"]')); await click($('[data-testid="add-drop"]')); assert.match($('[data-testid="setup"]').textContent, /0\.3 mmol H\+|0\.30 mmol H\+|0\.3 cm³ added/); say("after 3 drops: " + $('[data-testid="setup"]').textContent.slice(0, 160));
  await mount(BUF); assert.ok($('[data-testid="buf-sticky"]')); assert.ok($("svg.buf-trace")); await click("Add H⁺ (HCl)"); assert.equal($$("svg.buf-trace circle").length, 2, "start + 1 addition for the buffer"); assert.equal($$("svg.buf-trace rect").length >= 2, true, "and the unbuffered series");
  await mount(NEU); assert.ok($('[data-testid="equations"]'));
});

for (const { name, fn } of pending) { try { await fn(); passed += 1; console.log(`ok  ${name}`); } catch (e) { process.exitCode = 1; console.error(`FAIL ${name}\n${e.stack}`); } }
if (root) root.unmount();
console.log(`\n${passed}/${pending.length} acid-base round-2 UI tests passed`);
process.exit(process.exitCode ?? 0);
