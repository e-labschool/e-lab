#!/usr/bin/env node
// jsdom UI tests for the Bonding Visualizer:  node scripts/test-bonding-ui.mjs
// Renders the REAL BondingVisualizer (and the lesson-block renderer / editor options) into jsdom and drives it with DOM
// events. Honest limits: jsdom has no layout, no canvas and no WebGL, so pointer dragging, geometry, clipping and the
// 3D scenes are covered by the pure scene tests (test-bonding-model.mjs) and headless Chromium
// (scripts/verify-bonding-visualizer.mjs); this file checks behaviour and state wiring only.
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { register } from "node:module";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/simulation/bonding-visualizer", pretendToBeVisual: true });
for (const k of ["window", "document", "HTMLElement", "HTMLInputElement", "HTMLSelectElement", "Node", "MouseEvent", "KeyboardEvent", "Event", "XMLSerializer", "MutationObserver", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"]) {
  try { globalThis[k] = dom.window[k]; } catch { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true }); }
}
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
dom.window.HTMLCanvasElement.prototype.getContext = () => null;
// The animations are compressed by the component's own reduced-motion path so the suite is quick; one test also runs the
// normal-speed path.
globalThis.__ELAB_ASSUME_GL = true; // jsdom has no WebGL: let the metallic logic run; one test below clears it to check the no-WebGL state
dom.window.__reduced = true;
dom.window.matchMedia = () => ({ get matches() { return dom.window.__reduced === true; }, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.IS_REACT_ACT_ENVIRONMENT = false;
register("./jsx-loader-hooks.mjs", import.meta.url);
register("./image-viewer-loader-hooks.mjs", import.meta.url);

const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const BondingVisualizer = (await import("../src/engines/bonding-visualizer/BondingVisualizer.jsx")).default;
const BondingBlockOptions = (await import("../src/engines/bonding-visualizer/teacher/BondingBlockOptions.jsx")).default;
const LearnBlockRenderer = (await import("../src/components/learn/LearnBlockRenderer.jsx")).default;
const { SIMULATION_REGISTRY } = await import("../src/data/simulationRegistry.js");
const { SIMULATION_COMPONENTS } = await import("../src/data/simulationEngineComponents.js");
const h = React.createElement;

let passed = 0; let failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ok   ${name}`); passed += 1; } catch (e) { console.log(`  FAIL ${name}\n       ${(e.stack || e.message).split("\n").slice(0, 6).join("\n       ")}`); failed += 1; }
}
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const txt = (sel) => ($(sel)?.textContent ?? "").replace(/\s+/g, " ").trim();
const click = async (sel) => { const el = typeof sel === "string" ? $(sel) : sel; assert.ok(el, `missing ${sel}`); el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); await tick(); };
const stage = () => $('[data-testid="canvas"]')?.getAttribute("data-stage");
async function until(fn, ms = 6000, label = "condition") { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return; await tick(25); } throw new Error(`timed out waiting for ${label}`); }
const disabled = (sel) => $(sel).disabled === true;

let mounted = null;
async function mount(props = { standalone: true }, el = null, ready = '[data-testid="bonding-workspace"]') {
  if (mounted) { mounted.root.unmount(); mounted.host.remove(); mounted = null; }
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host); root.render(el ?? h(BondingVisualizer, props)); mounted = { root, host };
  await until(() => $(ready), 5000, "workspace"); await tick(60);
}
const tabs = () => $$('[data-testid="mode-tabs"] [role="tab"]').map((t) => t.textContent.trim());
const shells = () => $$('[data-testid^="shells-"]').map((e) => e.textContent.trim());

console.log("Registration");
await test("registered once in the simulation registry and component map, label matches the frame title", () => {
  assert.equal(SIMULATION_REGISTRY["bonding-visualizer"].label, "Bonding Visualizer");
  assert.ok(SIMULATION_COMPONENTS["bonding-visualizer"]);
});

console.log("Ionic mode");
await mount({ standalone: true });
await test("opens in Ionic with all three tabs; Ionize and Show Attraction start disabled", () => {
  assert.deepEqual(tabs(), ["Ionic Bonding", "Covalent Bonding", "Metallic Bonding"]);
  assert.equal($('[data-testid="tab-ionic"]').getAttribute("aria-selected"), "true");
  assert.ok(disabled('[data-testid="tool-ionize"]')); assert.ok(disabled('[data-testid="tool-attraction"]')); assert.ok(disabled('[data-testid="tool-lattice"]'));
  assert.equal(stage(), "setup");
});
await test("library is searchable and lists metals and non-metals", async () => {
  assert.ok($('[data-testid="el-Li"]') && $('[data-testid="el-Cl"]') && $('[data-testid="el-Al"]'));
  const input = $('[data-testid="library-search"]');
  const set = (v) => { Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(input, v); input.dispatchEvent(new window.Event("input", { bubbles: true })); };
  set("chl"); await tick(); assert.ok($('[data-testid="el-Cl"]')); assert.equal($('[data-testid="el-Li"]'), null);
  set("fe"); await tick(); assert.match(txt('[data-testid="library-empty"]'), /Iron \(Fe\) is not part of this model/);
  set(""); await tick(); assert.ok($('[data-testid="el-Li"]'));
});
await test("[check 1,2] Li shows 2,1 and Cl shows 2,8,7 on the canvas", async () => {
  await click('[data-testid="el-Li"]'); assert.deepEqual(shells(), ["2,1"]);
  await click('[data-testid="el-Cl"]'); assert.deepEqual(shells(), ["2,1", "2,8,7"]);
  assert.equal($('[data-testid="canvas"]').getAttribute("data-formula"), "LiCl");
  assert.equal(txt('[data-testid="live-formula"] dd'), "LiCl");
  assert.equal($$('[data-testid="atom-Li"] [data-ring]').length, 2); assert.equal($$('[data-testid="atom-Cl"] [data-ring]').length, 3);
});
await test("[check 7] Show Attraction is disabled before ionization; Ionize enabled for LiCl", () => {
  assert.ok(!disabled('[data-testid="tool-ionize"]')); assert.ok(disabled('[data-testid="tool-attraction"]')); assert.ok(disabled('[data-testid="tool-lattice"]'));
});
await test("[check 3,4,7] Ionize: one electron moves, Li+ shows 2 (outer ring gone), Cl- shows 2,8,8; attraction only afterwards", async () => {
  await click('[data-testid="tool-ionize"]');
  assert.equal(stage(), "ionizing"); assert.ok(disabled('[data-testid="tool-attraction"]'), "attraction disabled while electrons are still moving");
  await until(() => stage() === "ionized", 6000, "ionized");
  assert.deepEqual(shells(), ["Li⁺ · 2", "Cl⁻ · 2,8,8"]);
  assert.equal($$('[data-testid="atom-Li"] [data-ring]').filter((r) => Number(r.getAttribute("stroke-opacity")) > 0.01).length, 1, "Li+ has one visible shell");
  assert.equal($('[data-testid="atom-Li"]').getAttribute("data-rings"), "1");
  assert.equal($$('[data-testid^="charge-"]').map((c) => c.getAttribute("data-charge")).join(), "1,-1");
  assert.equal(txt('[data-testid="live-moved"] dd'), "1");
  assert.ok(!disabled('[data-testid="tool-attraction"]'));
  assert.ok(!disabled('[data-testid="tool-lattice"]'), "LiCl is rock-salt: lattice available");
  assert.match(txt('[data-testid="bv-explain"]'), /slightly apart/);
});
await test("Show Attraction runs as a second stage, then Replay and Reset work", async () => {
  await click('[data-testid="tool-attraction"]'); assert.equal(stage(), "attracting"); assert.match(txt('[data-testid="stage-badge"]'), /Stage 2/);
  await until(() => stage() === "attracted", 6000, "attracted");
  await click('[data-testid="tool-replay"]'); assert.equal(stage(), "attracting");
  await until(() => stage() === "attracted", 6000, "attracted again");
  await click('[data-testid="tool-pause"]'); assert.match(txt('[data-testid="tool-pause"]'), /Play/); await click('[data-testid="tool-pause"]');
  await click('[data-testid="tool-reset"]'); await tick(50);
  assert.equal(stage(), "setup"); assert.equal($('[data-testid="canvas"]').getAttribute("data-atoms"), "0"); assert.deepEqual(shells(), []);
});
await test("[check 5] MgCl2: Mg + Cl is incomplete, 'Add missing atoms' adds one Cl, then it ionizes with two electrons", async () => {
  await click('[data-testid="el-Mg"]'); await click('[data-testid="el-Cl"]');
  assert.ok(disabled('[data-testid="tool-ionize"]')); assert.match(txt('[data-testid="bv-explain"]'), /MgCl₂ needs 1 Mg \+ 2 Cl\. Add 1 Cl/);
  await click('[data-testid="tool-add-missing"]');
  assert.equal($('[data-testid="canvas"]').getAttribute("data-atoms"), "3"); assert.equal($('[data-testid="canvas"]').getAttribute("data-formula"), "MgCl₂");
  assert.equal($('[data-testid="tool-add-missing"]'), null); assert.ok(!disabled('[data-testid="tool-ionize"]'));
  await click('[data-testid="tool-ionize"]'); await until(() => stage() === "ionized", 6000, "ionized");
  assert.equal(txt('[data-testid="live-moved"] dd'), "2"); assert.deepEqual(shells().sort(), ["Cl⁻ · 2,8,8", "Cl⁻ · 2,8,8", "Mg²⁺ · 2,8"].sort());
  assert.ok(disabled('[data-testid="tool-lattice"]'), "MgCl2 lattice is not implemented"); assert.match($('[data-testid="tool-lattice"]').title, /isn.t available for MgCl₂/);
});
await test("[check 6] Na2O: Na + O needs one more Na; extra atoms are refused with an explanation", async () => {
  await click('[data-testid="tool-reset"]');
  await click('[data-testid="el-Na"]'); await click('[data-testid="el-O"]');
  assert.match(txt('[data-testid="bv-explain"]'), /Na₂O needs 2 Na \+ 1 O\. Add 1 Na/);
  await click('[data-testid="tool-add-missing"]'); assert.equal($('[data-testid="canvas"]').getAttribute("data-formula"), "Na₂O");
  await click('[data-testid="el-O"]'); assert.ok(disabled('[data-testid="tool-ionize"]')); assert.match(txt('[data-testid="bv-explain"]'), /Remove 1 O/);
  await click('[data-testid="el-Na"]'); await click('[data-testid="el-Li"]'); assert.match(txt('[data-testid="bv-explain"]'), /one metal and one non-metal/i);
});
await test("unsupported covalent-like ionic request (Al + Cl x3) explains instead of ionizing", async () => {
  await click('[data-testid="tool-reset"]');
  await click('[data-testid="el-Al"]'); for (let i = 0; i < 3; i += 1) await click('[data-testid="el-Cl"]');
  assert.ok(disabled('[data-testid="tool-ionize"]')); assert.match(txt('[data-testid="bv-explain"]'), /largely covalent/);
});

console.log("Mode switching, covalent and metallic wiring");
await test("[check 13] switching tabs changes the whole canvas and controls and resets state (modes never mix)", async () => {
  await click('[data-testid="tool-reset"]');
  await click('[data-testid="el-Na"]'); await click('[data-testid="el-Cl"]');
  assert.ok($('[data-testid="tool-ionize"]'));
  await click('[data-testid="tab-covalent"]'); await tick(80);
  assert.equal($('[data-testid="tab-covalent"]').getAttribute("aria-selected"), "true");
  assert.equal($('[data-testid="tool-ionize"]'), null); assert.equal($('[data-testid="tool-attraction"]'), null); assert.ok($('[data-testid="tool-form-bond"]'));
  assert.equal($('[data-testid="canvas"]').getAttribute("data-atoms"), "2"); assert.equal($('[data-testid="canvas"]').getAttribute("data-formula"), "H₂");
  assert.deepEqual($$('[data-testid^="atom-"]').map((a) => a.getAttribute("data-symbol")), ["H", "H"]);
  assert.equal($('[data-testid="el-Na"]'), null); assert.ok($('[data-testid="el-H"]') && $('[data-testid="el-Be"]'));
  await click('[data-testid="tab-ionic"]'); await tick(80);
  assert.equal($('[data-testid="canvas"]').getAttribute("data-atoms"), "0"); assert.ok($('[data-testid="tool-ionize"]')); assert.deepEqual(shells(), []);
});
// ---- covalent round 2: the molecule is recognised from the atoms, then formed automatically ----
const setRange = async (sel, v) => { const el = $(sel); Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(el, String(v)); el.dispatchEvent(new window.Event("input", { bubbles: true })); await tick(40); };
const setText = async (sel, v) => { const el = $(sel); Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(el, v); el.dispatchEvent(new window.Event("input", { bubbles: true })); await tick(40); };
const cv = (a) => $('[data-testid="canvas"]').getAttribute(a);
const formed = async (label) => { await click('[data-testid="tool-form-bond"]'); await until(() => stage() === "bonded", 8000, `${label} bonded`); };
const settled = async (label = "recognised") => until(() => cv("data-status") !== "pending", 4000, `${label}: recognition finished`); // sets of more than 4 atoms are worked out after a short pause
const addAtoms = async (list) => { await click('[data-testid="tool-clear"]'); for (const s of list) await click(`[data-testid="el-${s}"]`); await tick(60); await settled(list.join("")); };
await test("[check 9] covalent starts with two H (different electron colours), already recognised as H2", async () => {
  await click('[data-testid="tab-covalent"]'); await tick(80);
  const cols = $$('[data-testid="electrons"] circle').map((c) => c.getAttribute("fill"));
  assert.equal(cols.length, 2); assert.notEqual(cols[0], cols[1]);
  assert.equal(cv("data-status"), "ok"); assert.equal(cv("data-formula"), "H₂"); assert.match(txt('[data-testid="card-name"]'), /Hydrogen/);
  assert.ok(!disabled('[data-testid="tool-form-bond"]'), "Form molecule is available even though the atoms are far apart");
  assert.equal(stage(), "setup");
});
await test("[check 9] H2: Form molecule brings the far-apart atoms together; shared pair keeps both colours, overlap shown, 1 shared pair / 0 lone pairs", async () => {
  await formed("H2");
  const shared = $$('[data-testid="electrons"] circle[data-state="shared"]'); assert.equal(shared.length, 2);
  assert.notEqual(shared[0].getAttribute("fill"), shared[1].getAttribute("fill"));
  assert.ok($('[data-testid="overlap"]')); assert.match(txt('[data-testid="molecule-label"]'), /H2\s*H–H/);
  assert.equal(txt('[data-testid="live-shared"] dd'), "1"); assert.equal(txt('[data-testid="live-lone"] dd'), "0"); assert.equal(txt('[data-testid="live-charge"] dd'), "0");
  assert.equal($$('[data-testid="bond-line"]').length, 1);
  await click('[data-testid="tool-replay"]'); assert.notEqual(stage(), "setup"); await until(() => stage() === "bonded", 6000, "bonded again");
  await click('[data-testid="tool-reset"]'); await tick(80); assert.equal(stage(), "setup"); assert.equal(cv("data-formula"), "H₂");
});
await test("slider scrubs far apart to bonded (and back); the picture is a pure function of the slider", async () => {
  await setRange('[data-testid="tool-bring"]', 500); assert.equal(stage(), "forming"); assert.ok(Math.abs(Number(cv("data-p")) - 0.5) < 0.01);
  await setRange('[data-testid="tool-bring"]', 1000); assert.equal(stage(), "bonded");
  await setRange('[data-testid="tool-bring"]', 0); assert.equal(stage(), "setup");
  assert.equal($$('[data-testid="bond-line"]').length, 0, "no bond lines while the atoms are apart");
});
await test("[owner case] C + O + O is recognised as CO2 and Form molecule forms two double bonds (no 'bring closer' dead end)", async () => {
  await addAtoms(["C", "O", "O"]);
  assert.equal(cv("data-status"), "ok"); assert.equal(cv("data-formula"), "CO₂"); assert.match(txt('[data-testid="card-name"]'), /Carbon dioxide/);
  assert.ok(!disabled('[data-testid="tool-form-bond"]'));
  await formed("CO2");
  assert.deepEqual($$('[data-testid="bond-line"]').map((b) => b.dataset.order), ["2", "2"]);
  assert.equal(txt('[data-testid="live-shared"] dd'), "4"); assert.equal(txt('[data-testid="live-lone"] dd'), "4"); assert.equal(txt('[data-testid="live-central"] dd'), "C");
  assert.equal($$('[data-testid="electrons"] circle[data-state="shared"]').length, 8); assert.equal($$('[data-testid="electrons"] circle[data-state="lone"]').length, 8);
  assert.match(txt('[data-testid="card-shape"]'), /Linear/); assert.match(txt('[data-testid="card-polarity"]'), /non-polar/);
});
await test("[owner case] 'Only outer-shell electrons' is a labelled checkbox, ON by default: no inner shells, labelled cores; off shows them; the choice is remembered for the session", async () => {
  const box = $('[data-testid="outer-only"]'); assert.equal(box.type, "checkbox"); assert.equal(box.checked, true); assert.match(txt('[data-testid="outer-only-label"]'), /Only outer-shell electrons/);
  assert.equal($$('[data-ring]').length, 0, "no inner shell rings"); assert.equal($$('[data-core="1"]').length, 0, "no inner electrons");
  assert.equal($$('[data-valence-ring="1"]').length, 3); assert.ok($$('[data-testid="core"]').length === 3);
  assert.ok($('[data-testid="legend"]'), "legend present");
  await click(box); assert.equal($('[data-testid="outer-only"]').checked, false);
  assert.ok($$('[data-ring]').length >= 3, "inner shells appear"); assert.ok($$('[data-core="1"]').length > 0, "inner electrons appear");
  assert.equal(cv("data-outer"), "0"); assert.equal(window.sessionStorage.getItem("bv.outerOnly"), "false");
  await click('[data-testid="tool-reset"]'); await tick(80);
  assert.equal($('[data-testid="outer-only"]').checked, false, "remembered after reset (session)");
  await click('[data-testid="outer-only"]'); assert.equal($('[data-testid="outer-only"]').checked, true);
});
await test("C + 3 O needs a charge: the card says carbonate and one click applies CO3 2-", async () => {
  await addAtoms(["C", "O", "O", "O"]);
  assert.equal(cv("data-status"), "needs-charge"); assert.match(txt('[data-testid="card-message"]'), /carbonate/i);
  await click('[data-testid="tool-form-bond"]'); assert.equal(stage(), "setup"); assert.match(txt('[data-testid="bv-explain"]'), /carbonate/i);
  await click('[data-testid="apply-charge--2"]');
  assert.equal(cv("data-status"), "ok"); assert.match(cv("data-formula"), /^CO₃/); assert.match(txt('[data-testid="charge-value"]'), /2/);
  await formed("CO3");
  assert.equal(txt('[data-testid="live-shared"] dd'), "4"); assert.match(txt('[data-testid="resonance-note"]'), /resonance/);
  assert.ok($$('[data-testid="formal-charge"]').length >= 2, "formal charges shown");
});
await test("beyond-the-course species are refused with a reason until the HL switch is on (SF6), then drawn with an expanded octet", async () => {
  await addAtoms(["S", "F", "F", "F", "F", "F", "F"]);
  assert.equal($('[data-testid="beyond-toggle"]').checked, false);
  assert.equal(cv("data-status"), "needs-beyond"); assert.match(txt('[data-testid="card-message"]'), /expanded octet|Beyond the course/i);
  await click('[data-testid="apply-beyond"]'); await settled("SF6 with the switch");
  assert.equal(cv("data-status"), "ok"); assert.equal(cv("data-formula"), "SF₆"); assert.match(txt('[data-testid="card-octet"]'), /12/);
  await formed("SF6"); assert.equal($$('[data-testid="bond-line"]').length, 6); assert.equal(txt('[data-testid="live-lone"] dd'), "18");
  await click('[data-testid="beyond-toggle"]'); await settled("SF6 switch off again"); assert.equal(cv("data-status"), "needs-beyond");
});
await test("picker: searchable list of 80+ molecules; picking NH4+ sets the charge, places 5 atoms and forms the coordinate bond by itself", async () => {
  await click('[data-testid="picker-button"]'); assert.ok($('[data-testid="picker-panel"]'));
  assert.ok(Number(txt('[data-testid="picker-button"] .bv-picker-count')) >= 80);
  assert.ok($$('[data-testid="picker-list"] [role="option"]').length >= 80);
  await setText('[data-testid="picker-search"]', "ammon"); assert.ok($('[data-testid="pick-NH4+"]')); assert.ok($$('[data-testid="picker-list"] [role="option"]').length <= 3);
  await setText('[data-testid="picker-search"]', "zzzz"); assert.ok($('[data-testid="picker-empty"]'));
  await setText('[data-testid="picker-search"]', "ammon");
  await click('[data-testid="pick-NH4+"]'); assert.equal($('[data-testid="picker-panel"]'), null);
  assert.equal(cv("data-atoms"), "5"); assert.match(txt('[data-testid="charge-value"]'), /1/);
  await until(() => stage() === "bonded", 8000, "NH4+ auto-forms"); assert.equal(cv("data-formula"), "NH₄⁺");
  assert.equal($$('[data-testid="dative-arrow"]').length, 1); assert.match(txt('[data-testid="card-structural"]'), /N/);
});
await test("3D view of the recognised structure: right atoms and bond orders (CO2: 3 atoms, two double bonds)", async () => {
  await addAtoms(["C", "O", "O"]); await formed("CO2 for 3D");
  await click($$('[data-testid="view-tabs"] [role="radio"]').find((r) => r.textContent.includes("3D")));
  await until(() => $('[data-testid="structure"]'), 6000, "structure mounted");
  assert.equal($('[data-testid="structure"]').getAttribute("data-atoms"), "3"); assert.deepEqual($$('[data-testid="struct-bond"]').map((b) => b.dataset.order).sort(), ["2", "2", "2", "2"]);
  assert.equal($('[data-testid="structure"]').getAttribute("data-bonds"), "2");
});
await test("impossible sets explain themselves; Form molecule re-announces the reason; the 14-atom limit is explained", async () => {
  await click($$('[data-testid="view-tabs"] [role="radio"]').find((r) => r.textContent.includes("Electrons")));
  await addAtoms(["O", "Cl"]); assert.equal(cv("data-status"), "needs-beyond", "ClO has 13 valence electrons: an odd-electron radical, only behind the HL switch"); assert.ok(txt('[data-testid="card-message"]').length > 20);
  await click('[data-testid="tool-form-bond"]'); assert.equal(stage(), "setup"); assert.ok(txt('[data-testid="bv-explain"]').length > 20);
  await addAtoms(["He"].filter(() => false)); // (no He in the model)
  await addAtoms(Array(14).fill("H")); await click('[data-testid="el-H"]');
  assert.equal(cv("data-atoms"), "14"); assert.match(txt('[data-testid="bv-explain"]'), /Up to 14 atoms/);
  await addAtoms(["H"]); assert.equal(cv("data-status"), "few"); assert.match(txt('[data-testid="card-message"]'), /Add at least one more atom/);
});
await test("two noble-gas atoms explain that full shells do not share (contact message)", async () => {
  const { contactMessage } = await import("../src/engines/bonding-visualizer/components/CovalentMode.jsx");
  assert.match(contactMessage("Xe", "Xe", null), /full outer shells/);
  assert.match(contactMessage("O", "O", { status: "ok", structure: { atoms: ["C", "O", "O"], bonds: [[0, 1, 2], [0, 2, 2]] }, info: { formula: "CO₂" } }), /not bonded to each other/);
  assert.equal(contactMessage("C", "O", { status: "ok", structure: { atoms: ["C", "O", "O"], bonds: [[0, 1, 2], [0, 2, 2]] }, info: { formula: "CO₂" } }), null);
});
await test("metallic mode without WebGL: controls are disabled with a visible reason, no dead 3D stage", async () => {
  globalThis.__ELAB_ASSUME_GL = false;
  try {
    await click('[data-testid="tab-ionic"]'); await click('[data-testid="tab-metallic"]');
    await until(() => $('[data-testid="tool-release"]'), 8000, "metallic controls");
    for (const id of ["tool-release", "tool-form-lattice", "tool-pause", "tool-replay", "add-1", "add-5"]) assert.ok(disabled(`[data-testid="${id}"]`), id);
    assert.match(txt('[data-testid="bv-explain"]'), /3D view unavailable on this device/);
    assert.ok($('[data-testid="webgl-fallback"]')); assert.equal($('[data-testid="tool-reset-view"]'), null);
  } finally { globalThis.__ELAB_ASSUME_GL = true; await click('[data-testid="tab-ionic"]'); }
});
await test("metallic mode opens its own 3D workspace and controls (WebGL fallback in jsdom)", async () => {
  await click('[data-testid="tab-metallic"]');
  await until(() => $('[data-testid="tool-release"]'), 8000, "metallic controls");
  assert.ok($('[data-testid="tool-form-lattice"]')); assert.equal($('[data-testid="tool-form-bond"]'), null); assert.ok(disabled('[data-testid="tool-release"]'));
  assert.ok($('[data-testid="el-Na"]') && !$('[data-testid="el-Cl"]'));
  await click('[data-testid="el-Na"]'); assert.ok(disabled('[data-testid="tool-release"]')); await click('[data-testid="el-Na"]');
  assert.ok(!disabled('[data-testid="tool-release"]')); assert.ok(disabled('[data-testid="tool-form-lattice"]'));
  assert.equal($('[data-testid="canvas"]').getAttribute("data-atoms"), "2"); assert.ok($('[data-testid="webgl-fallback"]'));
  await click('[data-testid="el-Mg"]'); assert.match(txt('[data-testid="bv-explain"]'), /one metal at a time/);
  assert.equal($('[data-testid="canvas"]').getAttribute("data-atoms"), "2");
  await click('[data-testid="tool-release"]'); await tick(200);
  assert.ok(["releasing", "released"].includes(stage()), stage());
});

await test("[spec 1] metallic add buttons: +1, +5, +20, +50 add that many atoms, counters follow, the 200 cap clamps and disables", async () => {
  await click('[data-testid="tool-reset"]'); await tick(100);
  await until(() => $('[data-testid="add-50"]'), 8000, "add buttons");
  assert.deepEqual($$('.bv-addbtn').map((b) => b.textContent.trim()), ["+1", "+5", "+20", "+50"]);
  const n = () => Number($('[data-testid="canvas"]').getAttribute("data-atoms"));
  assert.equal(n(), 0); assert.match(txt('[data-testid="atom-count"]'), /^0 \/ 200$/);
  await click('[data-testid="add-1"]'); assert.equal(n(), 1);
  await click('[data-testid="add-5"]'); assert.equal(n(), 6);
  await click('[data-testid="add-20"]'); assert.equal(n(), 26);
  await click('[data-testid="add-50"]'); assert.equal(n(), 76);
  assert.match(txt('[data-testid="atom-count"]'), /^76 \/ 200$/); assert.equal(txt('[data-testid="live-cores"] dd'), "76");
  for (const k of [50, 50]) await click(`[data-testid="add-${k}"]`);
  assert.equal(n(), 176); await click('[data-testid="add-50"]'); assert.equal(n(), 200);
  assert.match(txt('[data-testid="bv-explain"]'), /Added 24 of 50: the limit is 200/);
  assert.ok($$('.bv-addbtn').every((b) => b.disabled), "all four buttons disabled at the limit"); assert.ok($('[data-testid="atom-limit"]'));
  await click('[data-testid="el-Na"]'); assert.equal(n(), 200); assert.match(txt('[data-testid="bv-explain"]'), /Limit reached/);
  await click('[data-testid="tool-release"]'); await until(() => ["releasing", "released"].includes(stage()), 3000, "releasing");
  assert.ok($$('.bv-addbtn').every((b) => b.disabled), "no adding after release");
  // (the release/lattice animations are driven by the WebGL frame loop, which jsdom does not have; counters after release are
  // covered by metalCounts in test-bonding-model.mjs and by the headless Chromium run)
  await click('[data-testid="tool-reset"]'); await tick(100); assert.equal(n(), 0);
});
await test("[spec 1] the selected metal is used by the add buttons; one metal at a time (alloys refused)", async () => {
  await click('[data-testid="el-Mg"]'); await click('[data-testid="add-20"]'); await click('[data-testid="add-5"]'); await click('[data-testid="add-5"]');
  assert.equal($('[data-testid="canvas"]').getAttribute("data-atoms"), "31"); assert.match($('[data-testid="add-atoms"]').getAttribute("aria-label"), /Mg/);
  await click('[data-testid="el-Al"]'); assert.match(txt('[data-testid="bv-explain"]'), /one metal at a time/); assert.equal($('[data-testid="canvas"]').getAttribute("data-atoms"), "31");
  await click('[data-testid="tool-release"]'); await until(() => ["releasing", "released"].includes(stage()), 3000, "releasing");
  assert.equal(txt('[data-testid="live-metal"] dd'), "Mg 2,8,2");
  await click('[data-testid="tool-reset"]'); await tick(100);
});
console.log("Lesson configuration");
await test("[S2.1/S2.2/S2.3] config opens the chosen mode and restricts the tabs", async () => {
  await mount({ config: { initialMode: "covalent", allowedModes: ["covalent"] } });
  assert.deepEqual(tabs(), ["Covalent Bonding"]); assert.ok($('[data-testid="tool-form-bond"]'));
  await mount({ config: { initialMode: "ionic", allowedModes: ["ionic"] } });
  assert.deepEqual(tabs(), ["Ionic Bonding"]); assert.ok($('[data-testid="tool-ionize"]'));
  await mount({ config: { initialMode: "covalent", allowedModes: ["ionic", "covalent"] } });
  assert.deepEqual(tabs(), ["Ionic Bonding", "Covalent Bonding"]); assert.equal($('[data-testid="tab-covalent"]').getAttribute("aria-selected"), "true");
  await mount({ config: { initialMode: "metallic", allowedModes: ["metallic"] } });
  await until(() => $('[data-testid="tool-release"]'), 8000, "metallic opens directly"); assert.deepEqual(tabs(), ["Metallic Bonding"]);
  await mount({});
  assert.deepEqual(tabs(), ["Ionic Bonding", "Covalent Bonding", "Metallic Bonding"]);
});
await test("standalone route also accepts ?mode= / ?modes= (used for previews)", async () => {
  dom.reconfigure({ url: "http://localhost/simulation/bonding-visualizer?mode=covalent&modes=ionic,covalent" });
  await mount({ standalone: true });
  assert.deepEqual(tabs(), ["Ionic Bonding", "Covalent Bonding"]); assert.equal($('[data-testid="tab-covalent"]').getAttribute("aria-selected"), "true");
  dom.reconfigure({ url: "http://localhost/simulation/bonding-visualizer" });
});
await test("a Learn 'simulation' block passes its simulationConfig to the visualizer (lesson embed)", async () => {
  const block = { id: "b1", block_type: "simulation", content: { simulationId: "bonding-visualizer", simulationConfig: { initialMode: "covalent", allowedModes: ["covalent"] } } };
  await mount(null, h(LearnBlockRenderer, { block }));
  await until(() => $('[data-testid="bonding-workspace"]'), 8000, "lazy simulation");
  assert.deepEqual(tabs(), ["Covalent Bonding"]); assert.equal($('[data-testid="bonding-workspace"]').getAttribute("data-embedded"), "true");
  const none = { id: "b2", block_type: "simulation", content: { simulationId: "bonding-visualizer" } };
  await mount(null, h(LearnBlockRenderer, { block: none })); await until(() => $('[data-testid="bonding-workspace"]'), 8000, "lazy simulation");
  assert.deepEqual(tabs(), ["Ionic Bonding", "Covalent Bonding", "Metallic Bonding"]);
});
await test("the lesson editor options choose the opening mode and restrict the modes (keeps at least one, keeps initial inside)", async () => {
  let cfg = { initialMode: "ionic", allowedModes: ["ionic", "covalent", "metallic"] };
  const render = async () => { await mount(null, h(BondingBlockOptions, { config: cfg, onChange: (c) => { cfg = c; } }), '[data-testid="bonding-block-options"]'); };
  await render();
  const boxes = () => $$('[data-testid="bonding-block-options"] input[type="checkbox"]');
  await click(boxes()[0]); assert.deepEqual(cfg.allowedModes, ["covalent", "metallic"]); assert.equal(cfg.initialMode, "covalent");
  await render(); await click(boxes()[2]); assert.deepEqual(cfg.allowedModes, ["covalent"]);
  await render(); assert.ok(boxes()[1].disabled, "the last remaining mode cannot be unticked");
  const sel = $("#bv-initial-mode"); assert.equal(sel.options.length, 1);
  cfg = { initialMode: "ionic", allowedModes: ["ionic", "covalent", "metallic"] }; await render();
  const s2 = $("#bv-initial-mode"); Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, "value").set.call(s2, "metallic"); s2.dispatchEvent(new window.Event("change", { bubbles: true })); await tick();
  assert.equal(cfg.initialMode, "metallic");
});
await test("normal-speed (non reduced-motion) ionization also completes", async () => {
  dom.window.__reduced = false;
  await mount({ standalone: true });
  await click('[data-testid="el-K"]'); await click('[data-testid="el-Br"]'); await click('[data-testid="tool-ionize"]');
  assert.equal(stage(), "ionizing"); await until(() => stage() === "ionized", 9000, "ionized at normal speed");
  assert.deepEqual(shells(), ["K⁺ · 2,8,8", "Br⁻ · 2,8,18,8"]);
  dom.window.__reduced = true;
});

if (mounted) { mounted.root.unmount(); mounted.host.remove(); }
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
