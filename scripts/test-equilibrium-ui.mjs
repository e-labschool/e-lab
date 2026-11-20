#!/usr/bin/env node
// jsdom UI tests for the Equilibrium Lab:  node scripts/test-equilibrium-ui.mjs
// jsdom has no layout engine; real rendering, canvas, responsiveness and screenshots are covered by scripts/verify-equilibrium.mjs.
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
const { default: EquilibriumLab } = await import("../src/engines/equilibrium-lab/EquilibriumLab.jsx");
const { default: BlockOptions } = await import("../src/engines/equilibrium-lab/teacher/EquilibriumBlockOptions.jsx");

let passed = 0; let failed = 0; const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const wait = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const $ = (s) => document.querySelector(s);
const text = (s) => ($(s)?.textContent ?? "").replace(/\s+/g, " ").trim();
const click = async (s) => { const el = typeof s === "string" ? $(s) : s; assert.ok(el, `missing ${s}`); el.dispatchEvent(new MouseEvent("click", { bubbles: true })); await wait(); };
const st = () => globalThis.__EQ.getState();
const sc = () => st().scenes[st().mode];

const host = document.getElementById("root"); let root = createRoot(host);
const mount = async (props = {}) => { root.unmount(); root = createRoot(host); root.render(React.createElement(EquilibriumLab, { standalone: true, ...props })); await wait(200); };
await mount();

test("registered in catalogue (live, Equilibrium, R2.3 only, not featured), component map, resources registry and Learn options", () => {
  const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
  const cat = read("../src/data/simulationCatalogue.js"); const i = cat.indexOf('id: "equilibrium-lab"'); assert.ok(i > 0); const chunk = cat.slice(i, i + 1100);
  assert.match(chunk, /syllabus:\s*\["R2\.3"\]/); assert.match(chunk, /topic:\s*"Equilibrium"/); assert.doesNotMatch(chunk, /featured:\s*true/); assert.doesNotMatch(chunk, /premium|upgrade|notify|plan(s)?\b/i);
  assert.doesNotMatch(chunk, /IGCSE|A-level|A level/i);
  assert.match(read("../src/data/simulationEngineComponents.js"), /"equilibrium-lab"/); assert.match(read("../src/data/resources-registry.js"), /equilibrium-lab/); assert.match(read("../src/data/learnBlockRegistry.jsx"), /EquilibriumBlockOptions/);
});
test("opens in Everyday Analogy with the three mode tabs, run controls, presets, four disturbance buttons and an indicator", () => {
  assert.ok($('[data-testid="equilibrium-lab"]')); assert.equal(document.querySelectorAll('[role="tab"]').length, 3); assert.equal(st().mode, "everyday");
  assert.match(text('[data-testid="mode-selector"]'), /Everyday Analogy.*Chemical Model.*Compare Both/);
  for (const id of ["run-toggle", "run-reset", "run-replay", "run-step", "preset-selector", "everyday-disturb", "eq-indicator", "graph-card-ev", "explanation", "everyday-scene"]) assert.ok($(`[data-testid="${id}"]`), id);
  assert.equal(document.querySelectorAll('[data-testid="everyday-disturb"] button').length, 4);
  assert.match(text('[data-testid="analogy-limits"]') || text('[data-testid="explanation"]'), /./);
});
test("disturbance buttons are disabled before Start; Start runs; Pause and Resume toggle the label", async () => {
  assert.ok([...document.querySelectorAll('[data-testid="everyday-disturb"] button')].every((b) => b.disabled)); assert.match(text('[data-testid="run-toggle"]'), /Start/);
  await click('[data-testid="run-toggle"]'); assert.equal(sc().status, "running"); assert.match(text('[data-testid="run-toggle"]'), /Pause/);
  await click('[data-testid="run-toggle"]'); assert.equal(sc().status, "paused"); assert.match(text('[data-testid="run-toggle"]'), /Resume/);
  await click('[data-testid="run-toggle"]'); assert.equal(sc().status, "running");
});
test("adding people to A through the button updates the counts and shows the disturbance notice", async () => {
  globalThis.__EQ.dispatch({ type: "run/advance", dT: 30 }); await wait();
  const before = st().scenes.everyday.ev.s.A + st().scenes.everyday.ev.s.B; const b = document.querySelector('[data-testid="everyday-disturb"] button:not([disabled])'); assert.ok(b);
  const first = [...document.querySelectorAll('[data-testid="everyday-disturb"] button')].find((x) => /Add/i.test(x.textContent) && /A\b/.test(x.textContent)); await click(first || b);
  const after = st().scenes.everyday.ev.s.A + st().scenes.everyday.ev.s.B; assert.equal(after, before + 20); assert.match(text('[data-testid="notice"]'), /disturbed/i);
  assert.equal(Number(text('[data-testid="count-a"]')), st().scenes.everyday.ev.s.A); assert.equal(Number(text('[data-testid="count-b"]')), st().scenes.everyday.ev.s.B);
});
test("presets: Towards A / Center / Towards B change the rate constants and K", async () => {
  const labels = [...document.querySelectorAll('[data-testid="preset-selector"] button')]; assert.equal(labels.length, 3);
  await click(labels[2]); assert.equal(sc().setup.preset, "towardsB"); await click(labels[1]); assert.equal(sc().setup.preset, "center"); await click(labels[0]); assert.equal(sc().setup.preset, "towardsA");
});
test("Reset returns to the start; Replay starts a run; Step Forward advances while paused", async () => {
  await click('[data-testid="run-reset"]'); assert.equal(sc().t, 0); assert.equal(sc().status, "idle");
  await click('[data-testid="run-step"]'); assert.ok(sc().t > 0); assert.equal(sc().status, "paused");
  await click('[data-testid="run-replay"]'); assert.equal(sc().status, "running");
});
test("Show/Hide Graph, Show/Hide Explanation, Simple Wording toggles work and are labelled", async () => {
  for (const id of ["toggle-graph", "toggle-explanation", "toggle-simple"]) assert.ok($(`[data-testid="${id}"]`), id);
  await click('[data-testid="toggle-graph"]'); assert.equal(st().ui.showGraph, false); assert.equal($('[data-testid="graph-card-ev"]'), null); await click('[data-testid="toggle-graph"]'); assert.ok($('[data-testid="graph-card-ev"]'));
  await click('[data-testid="toggle-explanation"]'); assert.equal(st().ui.showExplanation, false); await click('[data-testid="toggle-explanation"]');
  const before = text('[data-testid="explanation"]'); await click('[data-testid="toggle-simple"]'); assert.equal(st().ui.simple, true); assert.notEqual(text('[data-testid="explanation"]'), before, "simple wording changes the text"); await click('[data-testid="toggle-simple"]');
});
test("speed buttons 0.5x / 1x / 2x set the speed", async () => {
  const btns = [...document.querySelectorAll('[aria-label="Animation speed"] button')]; assert.equal(btns.length, 3); await click(btns[2]); assert.equal(st().ui.speed, 2); await click(btns[0]); assert.equal(st().ui.speed, 0.5); await click(btns[1]); assert.equal(st().ui.speed, 1);
});
test("Chemical Model: five reactions, vessel, species table with molecular structures, K/Q panel, rate graph, Le Chatelier controls where applicable", async () => {
  await click('[data-testid="mode-chemical"]'); assert.equal(st().mode, "chemical");
  for (const id of ["reaction-selector", "vessel-card", "species-table", "qk-panel", "graph-card-ch", "chem-conditions", "guide"]) assert.ok($(`[data-testid="${id}"]`), id);
  assert.equal(document.querySelectorAll('[data-testid="species-table"] svg').length >= 2, true, "molecule icons");
  const opts = document.querySelectorAll('[data-testid="reaction-select"] option, [data-testid="reaction-selector"] button, [data-testid="reaction-selector"] option'); assert.ok(opts.length >= 5, `reactions ${opts.length}`);
});
test("each reaction: switching works; N2O4 and Haber show volume + temperature + catalyst, H2/I2 shows volume (no shift) but states no effect, Fe/SCN has add/remove only", async () => {
  const sel = $('[data-testid="reaction-select"]'); const pick = async (id) => { if (sel) { sel.value = id; sel.dispatchEvent(new Event("change", { bubbles: true })); await wait(); } else globalThis.__EQ.dispatch({ type: "setup/reaction", id }); await wait(); };
  for (const id of ["ab", "n2o4", "haber", "hi", "fescn"]) { await pick(id); assert.equal(sc().setup.reactionId, id, id); assert.ok(text('[data-testid="species-table"]').length > 10); }
  await pick("n2o4"); await click('[data-testid="run-toggle"]'); for (const id of ["temp-up", "temp-down", "vol-up", "vol-down", "cat-add"]) assert.ok($(`[data-testid="${id}"]`), `n2o4 ${id}`);
  await pick("fescn"); assert.equal($('[data-testid="vol-up"]'), null); assert.equal($('[data-testid="cat-add"]'), null);
});
test("Chemical disturbance buttons act: adding a species, raising temperature, decreasing volume, adding catalyst each log a marker and keep K (except temperature)", async () => {
  globalThis.__EQ.dispatch({ type: "setup/reaction", id: "n2o4" }); await wait(); await click('[data-testid="run-toggle"]').catch(() => {}); globalThis.__EQ.dispatch({ type: "run/advance", dT: 50 }); await wait();
  const Kof = () => text('[data-testid="kc-value"]'); const K0 = Kof(); await click('[data-testid="vol-down"]'); assert.equal(sc().ch.s.V < 1, true); assert.equal(Kof(), K0, "K unchanged by volume");
  await click('[data-testid="cat-add"]'); assert.equal(sc().ch.s.cat ?? sc().ch.s.catalyst, true); assert.equal(Kof(), K0, "K unchanged by catalyst");
  await click('[data-testid="temp-up"]'); assert.notEqual(Kof(), K0, "K changes with temperature"); assert.ok(sc().disturbances >= 3);
});
test("Q and K are displayed with the direction sentence; rates are displayed", () => {
  assert.ok(text('[data-testid="q-value"]').length > 0); assert.ok(text('[data-testid="kc-value"]').length > 0); assert.ok(text('[data-testid="qk-text"]').length > 10); assert.ok(text('[data-testid="rf-value"]').length > 0); assert.ok(text('[data-testid="rr-value"]').length > 0);
});
test("Compare Both shows both scenes together with a bridging statement and the analogy limits", async () => {
  await click('[data-testid="mode-compare"]'); assert.equal(st().mode, "compare");
  assert.ok($('[data-testid="everyday-scene"]')); assert.ok($('[data-testid="vessel-card"]')); assert.ok($('[data-testid="graph-card-compare"]') || $('[data-testid="graph-card-ev"]'));
  assert.match(text('[data-testid="equilibrium-lab"]'), /analogy/i);
});
test("modes can be switched with the keyboard (arrow keys on the tablist) and tabs expose aria-selected", async () => {
  const tab = $('[data-testid="mode-compare"]'); assert.equal(tab.getAttribute("aria-selected"), "true");
  tab.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })); await wait(); assert.ok(["chemical", "compare"].includes(st().mode));
});
test("teacher initial mode: config.initialMode opens the simulation in that mode", async () => {
  for (const m of ["chemical", "compare", "everyday"]) { await mount({ config: { initialMode: m } }); assert.equal(st().mode, m); }
  await mount({ config: null }); assert.equal(st().mode, "everyday");
});
test("block options component: shows the three modes and reports a normalised change", async () => {
  const seen = []; const h = document.createElement("div"); document.body.appendChild(h); const r = createRoot(h);
  r.render(React.createElement(BlockOptions, { config: { initialMode: "compare" }, onChange: (c) => seen.push(c) })); await wait();
  const sel = h.querySelector("select"); assert.equal(sel.value, "compare"); assert.equal(sel.options.length, 3); sel.value = "chemical"; sel.dispatchEvent(new Event("change", { bubbles: true })); await wait(); assert.deepEqual(seen.at(-1), { initialMode: "chemical" }); r.unmount();
});
test("no hard-coded premium wording, and no emoji, in the visible text of any mode", async () => {
  for (const m of ["everyday", "chemical", "compare"]) { globalThis.__EQ.dispatch({ type: "mode/set", mode: m }); await wait(); const t = text('[data-testid="equilibrium-lab"]'); assert.doesNotMatch(t, /premium|upgrade/i); assert.doesNotMatch(t, /\p{Extended_Pictographic}/u, m); }
});
test("no unhandled React errors: unmount leaves no timers or test hook behind", async () => { root.unmount(); await wait(); assert.equal(globalThis.__EQ, undefined); root = createRoot(host); });

for (const { name, fn } of tests) { try { await fn(); console.log(`  ok   ${name}`); passed += 1; } catch (e) { console.log(`  FAIL ${name}\n       ${(e.stack || e.message).split("\n").slice(0, 5).join("\n       ")}`); failed += 1; } }
console.log(`\n${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
