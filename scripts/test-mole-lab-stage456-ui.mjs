#!/usr/bin/env node
// jsdom UI tests for Mole Lab Stages 4, 5 and 6 (Gas Volume, Chemical Equations, Limiting Reagents):  node scripts/test-mole-lab-stage456-ui.mjs
// jsdom has no WebGL, so this exercises the 2D fallback bench, the tabs, controls, validation and registration.
// Real 3D, layout and pointer behaviour are covered by scripts/verify-mole-lab.mjs (headless Chromium).
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { register } from "node:module";
import fs from "node:fs";

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: "http://localhost/", pretendToBeVisual: true });
for (const k of ["window", "document", "HTMLElement", "HTMLInputElement", "HTMLSelectElement", "Node", "MouseEvent", "KeyboardEvent", "Event", "XMLSerializer", "MutationObserver", "getComputedStyle"]) {
  try { globalThis[k] = dom.window[k]; } catch { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true }); }
}
globalThis.requestAnimationFrame = () => 0; globalThis.cancelAnimationFrame = () => {};
dom.window.HTMLCanvasElement.prototype.getContext = () => null;
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
globalThis.IS_REACT_ACT_ENVIRONMENT = false;
register("./jsx-loader-hooks.mjs", import.meta.url);
register("./image-viewer-loader-hooks.mjs", import.meta.url);

const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const { default: MoleLab } = await import("../src/engines/mole-lab/MoleLab.jsx");

let passed = 0; let failed = 0; const pending = [];
const test = (name, fn) => pending.push({ name, fn });
const wait = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const $ = (s) => document.querySelector(s);
const text = (s) => ($(s)?.textContent ?? "").replace(/\s+/g, " ").trim();
const click = async (s) => { $(s).dispatchEvent(new MouseEvent("click", { bubbles: true })); await wait(); };

const root = createRoot(document.getElementById("root"));
root.render(React.createElement(MoleLab, { standalone: true }));
await wait(150);
const setInput = async (sel, v) => { const el = $(sel); assert.ok(el, sel); const set = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set; set.call(el, v); el.dispatchEvent(new dom.window.Event("input", { bubbles: true })); el.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true })); el.dispatchEvent(new dom.window.Event("blur", { bubbles: true })); await wait(); };
const answer = async () => { const b = $('[data-testid="ml-predict-choice"][data-correct="1"]'); if (b && !b.disabled) { b.dispatchEvent(new MouseEvent("click", { bubbles: true })); await wait(60); } };
const st = () => document.querySelector('[data-testid="mole-lab"]').__moleLab.getState();
const total = (s) => { const sc = s.scenes[3]; let t = sc.packets.reduce((a, p) => a + p.q, 0); for (const v of sc.vessels) for (const q of Object.values(v.contents)) t += q; return t; };

const { checkInvariants } = await import("../src/engines/mole-lab/engine/index.js");
const dispatch = (a) => document.querySelector('[data-testid="mole-lab"]').__moleLab.dispatch(a);
const modeBtn = async (label) => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === label); b.dispatchEvent(new MouseEvent("click", { bubbles: true })); await wait(60); };
const freeMode = () => modeBtn("Free"); const guidedMode = () => modeBtn("Guided");
const clean = () => assert.deepEqual(checkInvariants(st()), []);

test("stage 4 tab is built (no placeholder), shows the 2D fallback bench and labels the RTP value as a convention", async () => {
  await click('[data-testid="ml-tab-4"]'); await wait(120);
  assert.ok($('[data-testid="ml-controls-4"]')); assert.equal($('[data-testid="ml-pending"]'), null); assert.ok($('[data-testid="ml-fallback"]'));
  assert.match(text('[data-testid="ml-rtp-note"]'), /convention|rounded/i);
});
test("guided: releasing the gas is blocked until the prediction is answered", async () => {
  await click('[data-testid="ml-packet-p1"]'); await click('[data-testid="ml-open-btn"]');
  assert.ok($('[data-testid="ml-zone-pour-btn"]').disabled, "release disabled before the answer");
  assert.equal(st().scenes[4].vessels[0].contents.O2 ?? 0, 0);
  await answer(); assert.equal($('[data-testid="ml-zone-pour-btn"]').disabled, false);
});
test("releasing 1 mol gives 24.0 dm3 at RTP, a repeated click cannot duplicate the gas, and nothing is lost", async () => {
  await click('[data-testid="ml-zone-pour-btn"]'); await wait(60); await click('[data-testid="ml-zone-pour-btn"]');
  const sc = st().scenes[4]; assert.equal(sc.vessels[0].contents.O2, 1e9); assert.equal(sc.packets.reduce((a, p) => a + p.q, 0), 0); clean();
  assert.match(text('[data-testid="ml-working"]') || text('[data-testid="ml-calc"]'), /= 24 dm³/);
});
test("collecting returns exactly the same amount to packets; a second collect is refused", async () => {
  await click('[data-testid="ml-collect-btn"]'); const sc = st().scenes[4]; assert.equal(sc.packets.reduce((a, p) => a + p.q, 0), 1e9); assert.equal(sc.vessels[0].contents.O2 ?? 0, 0); clean();
  assert.ok($('[data-testid="ml-collect-btn"]').disabled);
});
test("0.5 and 2 mol give 12.0 and 48.0 dm3 (convention) and the amounts are exact", async () => {
  for (const [n, v] of [[0.5, "12"], [2, "48"]]) {
    await click(`[data-testid="ml-quick-${n}"]`);
    for (let g = 0; g < 4 && st().scenes[4].packets.some((p) => p.q > 0); g += 1) { const p = st().scenes[4].packets.find((x) => x.q > 0); dispatch({ type: "packet/open", stage: 4, id: p.id }); dispatch({ type: "packet/pour", stage: 4, sourceId: p.id, destId: "chamber" }); }
    await wait(60); assert.match(text('[data-testid="ml-calc"]'), new RegExp(`= ${v} dm³`)); clean();
    await click('[data-testid="ml-collect-btn"]');
  }
});
test("advanced PV = nRT: 373.15 K gives 30.62 dm3 (not 24.0) and the difference from the convention is shown", async () => {
  await click('[data-testid="ml-quick-1"]'); await click('[data-testid="ml-model-ideal"]'); assert.ok($('[data-testid="ml-advanced"]'));
  dispatch({ type: "s4/setTemperature", stage: 4, kelvin: 373.15 }); await wait(40);
  const sc = st().scenes[4]; dispatch({ type: "packet/open", stage: 4, id: sc.packets[0].id }); dispatch({ type: "packet/pour", stage: 4, sourceId: sc.packets[0].id, destId: "chamber" }); await wait(60);
  const calc = document.querySelector('[data-testid="ml-calc"]'); if (calc.getAttribute("data-open") !== "1") await click('[data-testid="ml-calc-toggle"]');
  assert.match(text('[data-testid="ml-working"]'), /30\.6/); assert.match(text('[data-testid="ml-working"]'), /24 dm³ mol⁻¹ convention/); clean();
});
test("invalid temperature / pressure are refused with a message; nothing changes; every gas is offered", async () => {
  const before = JSON.stringify([st().scenes[4].data.tempK, st().scenes[4].data.pressurePa]);
  for (const a of [{ type: "s4/setTemperature", kelvin: "-5" }, { type: "s4/setTemperature", kelvin: "abc" }, { type: "s4/setTemperature", kelvin: "0" }, { type: "s4/setPressure", kPa: "0" }, { type: "s4/setPressure", kPa: "9999" }]) { const r = dispatch({ ...a, stage: 4 }); assert.equal(r.last.ok, false, JSON.stringify(a)); }
  assert.equal(JSON.stringify([st().scenes[4].data.tempK, st().scenes[4].data.pressurePa]), before); clean();
  for (const g of ["H2", "O2", "N2", "CO2", "NH3", "CH4"]) assert.ok($(`[data-testid="ml-gas-${g}"]`), g);
});

test("stage 5: the four reactions are offered with state symbols; the guided run is gated by the prediction", async () => {
  await click('[data-testid="ml-tab-5"]'); await wait(120); assert.ok($('[data-testid="ml-controls-5"]'));
  for (const id of ["water-synthesis", "ammonia-synthesis", "magnesium-oxide", "sodium-water"]) assert.ok($(`[data-testid="ml-rx-${id}"]`), id);
  assert.match(text('[data-testid="ml-equation"]'), /2H₂\(g\).*O₂\(g\).*2H₂O\(l\)/);
  await click('[data-testid="ml-run"]'); assert.equal(st().scenes[5].data.lastRun, null, "gated"); assert.match(text('[data-testid="ml-status"]'), /prediction/i);
});
test("stage 5: add the packets and run: 2 mol H2O formed, atoms conserved; the x2 repeat gives 4 mol", async () => {
  await answer(); await click('[data-testid="ml-load-all"]'); assert.equal(st().scenes[5].packets.length, 0); clean();
  await click('[data-testid="ml-run"]'); await wait(60); const run = st().scenes[5].data.lastRun; assert.ok(run); assert.equal(run.afterQ.H2O, 2e9); clean();
  assert.match(text('[data-testid="ml-result-table"]'), /\+2\.00/);
  await click('[data-testid="ml-scale-2"]'); await answer(); await click('[data-testid="ml-load-all"]'); await click('[data-testid="ml-run"]'); await wait(60); assert.equal(st().scenes[5].data.lastRun.afterQ.H2O, 4e9); clean();
});
test("stage 5: a wrong ratio is a partial reaction with honest feedback, never an error or a negative amount", async () => {
  await freeMode(); await click('[data-testid="ml-scale-1"]'); dispatch({ type: "s5/setAmount", stage: 5, substanceId: "H2", value: "3" }); await wait(40);
  await click('[data-testid="ml-load-all"]'); await click('[data-testid="ml-run"]'); await wait(60); const run = st().scenes[5].data.lastRun;
  assert.equal(run.afterQ.H2, 1e9); assert.equal(run.afterQ.O2, 0); assert.match(text('[data-testid="ml-run-feedback"]'), /partial|limits/i); clean();
});
test("stage 5: running with an empty zone is refused", async () => {
  const r = dispatch({ type: "s5/run", stage: 5 }); assert.equal(r.last.ok, false); clean();
});
test("stage 5: sodium + water shows aqueous NaOH as ions, a conceptual mole summary and hazard notes", async () => {
  await click('[data-testid="ml-rx-sodium-water"]'); await click('[data-testid="ml-load-all"]'); await click('[data-testid="ml-run"]'); await wait(60);
  assert.match(text('[data-testid="ml-aq-note"]'), /Na⁺/); assert.match(text('[data-testid="ml-aq-note"]'), /conceptual mole summary/i); assert.match(text('[data-testid="ml-notes"]'), /hazard|violent/i);
  assert.match(text('[data-testid="ml-equation"]'), /NaOH.*\(aq\)/); clean();
});

test("stage 6: default 3 mol H2 + 1 mol O2: O2 limits, 1 mol H2 left, 2 mol H2O (after the prediction)", async () => {
  await click('[data-testid="ml-tab-6"]'); await wait(120); await guidedMode(); assert.ok($('[data-testid="ml-controls-6"]'));
  await click('[data-testid="ml-run"]'); assert.equal(st().scenes[6].data.lastRun, null, "gated until predicted");
  await answer(); await click('[data-testid="ml-run"]'); await wait(60); const run = st().scenes[6].data.lastRun;
  assert.deepEqual([run.afterQ.H2, run.afterQ.O2, run.afterQ.H2O], [1e9, 0, 2e9]); assert.deepEqual(run.limiting, ["O2"]); clean();
});
test("stage 6: tied ratios do not name one limiting reagent; a zero reactant is refused", async () => {
  await freeMode(); await click('[data-testid="ml-again"]');
  dispatch({ type: "s6/setAmount", stage: 6, substanceId: "H2", value: "4" }); dispatch({ type: "s6/setAmount", stage: 6, substanceId: "O2", value: "2" }); await wait(40);
  await click('[data-testid="ml-run"]'); await wait(60); const run = st().scenes[6].data.lastRun; assert.equal(run.tied, true); assert.equal(run.afterQ.H2, 0); assert.match(text('[data-testid="ml-result"]'), /neither is in excess|both/i); clean();
  dispatch({ type: "s6/setAmount", stage: 6, substanceId: "O2", value: "0" }); const r = dispatch({ type: "s6/run", stage: 6 }); assert.equal(r.last.ok, false); clean();
});
test("stage 6: mass inputs (g), and 3 mol Na + 2 mol H2O leaves 1 mol Na", async () => {
  await click('[data-testid="ml-rx-sodium-water"]'); await wait(40); const d = st().scenes[6].data; assert.equal(d.initialQ.Na, 3e9); assert.equal(d.initialQ.H2O, 2e9);
  await click('[data-testid="ml-inputmode-mass"]'); await setInput('input[data-testid="ml-in-Na"]', "45.98"); await wait(40); assert.equal(st().scenes[6].data.initialQ.Na, 2e9);
  await click('[data-testid="ml-inputmode-mol"]'); dispatch({ type: "s6/setAmount", stage: 6, substanceId: "Na", value: "3" }); await click('[data-testid="ml-run"]'); await wait(60);
  const run = st().scenes[6].data.lastRun; assert.equal(run.afterQ.Na, 1e9); assert.equal(run.afterQ.NaOH_aq, 2e9); assert.equal(run.afterQ.H2, 1e9); clean();
});
test("stage 6: percentage yield is an optional extension that needs an actual yield", async () => {
  await click('[data-testid="ml-yield-toggle"]'); assert.match(text('[data-testid="ml-yield-result"]'), /Enter an actual yield/);
  await setInput('input[data-testid="ml-actual"]', "-1"); assert.ok(text('[data-testid="ml-yield"]').length > 20);
});
test("switching tabs 4 -> 5 -> 6 -> 4 keeps every stage consistent", async () => {
  for (const n of [4, 5, 6, 4, 6, 5]) { await click(`[data-testid="ml-tab-${n}"]`); await wait(40); clean(); }
});
test("no global CSS leakage: stages 4-6 styles are scoped under .ml-root", () => {
  const css = fs.readFileSync(new URL("../src/engines/mole-lab/ui/stages/stages456.css", import.meta.url), "utf8");
  for (const rule of css.split("}").map((r) => r.trim()).filter((r) => r && !r.startsWith("/*") && !r.startsWith("@media"))) assert.match(rule.replace(/^\/\*.*?\*\/\s*/s, ""), /^\.ml-root/, rule.slice(0, 60));
});

for (const t of pending) { try { await t.fn(); console.log(`  ok   ${t.name}`); passed += 1; } catch (e) { console.log(`  FAIL ${t.name}\n       ${(e.stack || e.message).split("\n").slice(0, 5).join("\n       ")}`); failed += 1; } }
console.log(`\n${passed} passed, ${failed} failed`); root.unmount(); process.exit(failed ? 1 : 0);
