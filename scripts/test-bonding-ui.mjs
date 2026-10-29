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
  assert.equal($('[data-testid="canvas"]').getAttribute("data-atoms"), "2"); assert.equal($('[data-testid="canvas"]').getAttribute("data-formula"), "H2");
  assert.deepEqual($$('[data-testid^="atom-"]').map((a) => a.getAttribute("data-symbol")), ["H", "H"]);
  assert.equal($('[data-testid="el-Na"]'), null); assert.ok($('[data-testid="el-H"]') && $('[data-testid="el-Be"]'));
  await click('[data-testid="tab-ionic"]'); await tick(80);
  assert.equal($('[data-testid="canvas"]').getAttribute("data-atoms"), "0"); assert.ok($('[data-testid="tool-ionize"]')); assert.deepEqual(shells(), []);
});
await test("[check 9] covalent starts with two H with different electron colours; Form Bond needs the atoms close", async () => {
  await click('[data-testid="tab-covalent"]'); await tick(80);
  const cols = $$('[data-testid="electrons"] circle').map((c) => c.getAttribute("fill"));
  assert.equal(cols.length, 2); assert.notEqual(cols[0], cols[1]);
  assert.ok(disabled('[data-testid="tool-form-bond"]')); assert.equal($('[data-testid="canvas"]').getAttribute("data-close"), "0");
  assert.match(txt('[data-testid="bv-explain"]'), /drag the atoms closer/);
  await click('[data-testid="tool-bring"]'); await until(() => $('[data-testid="canvas"]').getAttribute("data-close") === "1", 3000, "atoms close");
  assert.ok(!disabled('[data-testid="tool-form-bond"]'));
});
await test("[check 9] H2 bond: shared pair keeps both colours, overlap shown, H–H and 1 shared pair / 0 lone pairs", async () => {
  await click('[data-testid="tool-form-bond"]'); assert.equal(stage(), "bonding");
  await until(() => stage() === "bonded", 6000, "bonded");
  const shared = $$('[data-testid="electrons"] circle[data-state="shared"]'); assert.equal(shared.length, 2);
  assert.notEqual(shared[0].getAttribute("fill"), shared[1].getAttribute("fill"));
  assert.ok($('[data-testid="overlap"]')); assert.match(txt('[data-testid="molecule-label"]'), /H2\s*H–H/);
  assert.equal(txt('[data-testid="live-shared"] dd'), "1"); assert.equal(txt('[data-testid="live-lone"] dd'), "0"); assert.equal(txt('[data-testid="live-charge"] dd'), "0");
  assert.match(txt('[data-testid="bv-explain"]'), /one from each H/);
  await click('[data-testid="tool-replay"]'); assert.equal(stage(), "bonding"); await until(() => stage() === "bonded", 6000, "bonded again");
  await click('[data-testid="tool-reset"]'); await tick(80); assert.equal(stage(), "setup"); assert.equal($('[data-testid="canvas"]').getAttribute("data-formula"), "H2");
});
await test("[check 10] bond selector loads only scientifically valid examples: Double = O₂, Triple = N₂; Single set has no O₂/N₂", async () => {
  const ex = () => $$('[data-testid="examples"] button').map((b) => b.textContent.trim());
  assert.deepEqual(ex(), ["H₂", "Cl₂", "HCl", "H₂O", "NH₃", "CH₄"]);
  await click($$('[role="radio"]').find((r) => r.textContent.includes("Double Bond"))); assert.deepEqual(ex(), ["O₂"]); assert.equal($('[data-testid="canvas"]').getAttribute("data-formula"), "O2");
  await click('[data-testid="tool-bring"]'); await tick(700); await click('[data-testid="tool-form-bond"]'); await until(() => stage() === "bonded", 6000, "O2 bonded");
  assert.equal(txt('[data-testid="live-shared"] dd'), "2"); assert.equal(txt('[data-testid="live-lone"] dd'), "4"); assert.match(txt('[data-testid="molecule-label"]'), /O=O/);
  await click($$('[role="radio"]').find((r) => r.textContent.includes("Triple Bond"))); assert.deepEqual(ex(), ["N₂"]);
  await click('[data-testid="tool-bring"]'); await tick(700); await click('[data-testid="tool-form-bond"]'); await until(() => stage() === "bonded", 6000, "N2 bonded");
  assert.equal(txt('[data-testid="live-shared"] dd'), "3"); assert.equal(txt('[data-testid="live-lone"] dd'), "2"); assert.match(txt('[data-testid="molecule-label"]'), /N≡N/);
  assert.equal($$('[data-testid="electrons"] circle[data-state="shared"]').length, 6);
});
await test("[check 11] octet subtabs: CH4 (8), BF3 (6), BeCl2 (4), PCl5 (10), SF6 (12) electrons around the central atom", async () => {
  const pick = async (label, id) => {
    if (label) await click($$('[role="radio"]').find((r) => r.textContent.includes(label)));
    await click(`[data-testid="example-${id}"]`); await click('[data-testid="tool-bring"]'); await tick(700);
    await click('[data-testid="tool-form-bond"]'); await until(() => stage() === "bonded", 6000, `${id} bonded`);
    return Number(txt('[data-testid="live-central"] dd'));
  };
  assert.equal(await pick("Normal Octet", "CH4"), 8); assert.match(txt('[data-testid="central-count"]'), /C has 8 electrons/);
  assert.equal(await pick("Incomplete Octet", "BF3"), 6); assert.match(txt('[data-testid="central-count"]'), /B has 6 electrons around it \(incomplete octet\)/);
  assert.equal(await pick(null, "BeCl2"), 4);
  assert.equal(await pick("Expanded Octet", "PCl5"), 10); assert.match(txt('[data-testid="central-count"]'), /expanded octet/);
  assert.equal(await pick(null, "SF6"), 12); assert.ok($('.bv-ahl'), "AHL tag shown");
  assert.equal($('[data-testid="order-tabs"]'), null, "bond-order selector only belongs to the normal octet group");
});
await test("building a molecule by hand: an unsupported set explains itself, a supported set is recognised", async () => {
  await click('[data-testid="tool-reset"]'); await tick(60);
  await click('[data-testid="el-O"]'); await click('[data-testid="el-Cl"]');
  assert.equal($('[data-testid="canvas"]').getAttribute("data-formula"), ""); assert.ok(disabled('[data-testid="tool-form-bond"]'));
  assert.match(txt('[data-testid="bv-explain"]'), /No validated molecule|Not a complete molecule/);
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
await test("[spec 3] covalent: after bonding the Lewis picture hands over to a clean sphere-and-bond structure (SF6: 1 S + 6 F, 6 single bonds)", async () => {
  await click('[data-testid="tab-covalent"]'); await tick(80);
  await click($$('[role="radio"]').find((r) => r.textContent.includes("Expanded Octet")));
  await click('[data-testid="example-SF6"]'); await click('[data-testid="tool-bring"]'); await tick(700);
  await click('[data-testid="tool-form-bond"]'); assert.equal($('[data-testid="canvas"]').getAttribute("data-crowded"), "1");
  await until(() => $$('[data-testid^="atom-"]').length === 7, 1000, "7 atoms");
  assert.ok($$('[data-testid^="atom-"]').every((a) => a.getAttribute("data-rings") === "0" || stage() === "bonding"));
  await until(() => stage() === "bonded", 6000, "bonded");
  assert.equal($$('[data-testid="electrons"] circle[data-state="shared"]').length, 12); assert.equal($$('[data-testid="electrons"] circle[data-state="lone"]').length, 36);
  assert.ok($$('[data-testid^="atom-"]').every((a) => a.getAttribute("data-rings") === "0"), "no shell rings in the dot view");
  await until(() => $('[data-testid="canvas"]').getAttribute("data-view") === "structure", 6000, "structure view");
  await until(() => $('[data-testid="structure"]'), 6000, "structure mounted");
  const st = $('[data-testid="structure"]');
  assert.equal(st.getAttribute("data-atoms"), "7"); assert.equal(st.getAttribute("data-bonds"), "6");
  assert.equal($$('[data-testid="struct-atom"]').filter((a) => a.dataset.symbol === "S").length, 1); assert.equal($$('[data-testid="struct-atom"]').filter((a) => a.dataset.symbol === "F").length, 6);
  assert.equal($$('[data-testid="struct-bond"]').length, 6); assert.ok($$('[data-testid="struct-bond"]').every((b) => b.dataset.order === "1"));
  assert.equal($$('[data-testid^="atom-"]').length, 0, "overlapping shell diagrams are gone"); assert.equal($$('[data-testid="electrons"] circle').length, 0);
  assert.match(txt('[data-testid="molecule-label"]'), /^SF6S\(–F\)6$/);
  assert.equal(txt('[data-testid="live-shared"] dd'), "6"); assert.equal(txt('[data-testid="live-lone"] dd'), "18"); assert.equal(txt('[data-testid="live-central"] dd'), "12"); assert.match(txt('[data-testid="central-count"]'), /S has 12 electrons/);
  await click('[data-testid="tool-replay"]'); assert.equal(stage(), "bonding"); assert.equal($('[data-testid="structure"]'), null, "replay returns to the electron-sharing picture");
  await until(() => stage() === "bonded", 6000, "bonded again");
  await click('[data-testid="tool-reset"]'); await tick(80); assert.equal(stage(), "setup"); assert.equal($('[data-testid="canvas"]').getAttribute("data-formula"), "H2");
});
await test("[spec 3] every supported molecule ends in a sphere-and-bond structure with the right atoms and bond orders", async () => {
  const want = { H2: [2, [1]], Cl2: [2, [1]], HCl: [2, [1]], O2: [2, [2]], N2: [2, [3]], H2O: [3, [1, 1]], NH3: [4, [1, 1, 1]], CH4: [5, [1, 1, 1, 1]], BF3: [4, [1, 1, 1]], BeCl2: [3, [1, 1]], PCl5: [6, [1, 1, 1, 1, 1]], SF6: [7, [1, 1, 1, 1, 1, 1]] };
  const groups = { H2: "Normal", Cl2: "Normal", HCl: "Normal", O2: "Double", N2: "Triple", H2O: "Normal", NH3: "Normal", CH4: "Normal", BF3: "Incomplete", BeCl2: "Incomplete", PCl5: "Expanded", SF6: "Expanded" };
  for (const [id, [nAtoms, orders]] of Object.entries(want)) {
    await click('[data-testid="tool-reset"]'); await tick(60); await click('[data-testid="tab-covalent"]').catch(() => {}); await tick(30);
    await click($$('[role="radio"]').find((r) => r.textContent.includes(groups[id])));
    await click(`[data-testid="example-${id}"]`); await click('[data-testid="tool-bring"]'); await tick(700);
    await click('[data-testid="tool-form-bond"]'); await until(() => stage() === "bonded", 8000, `${id} bonded`);
    await until(() => $('[data-testid="canvas"]').getAttribute("data-view") === "structure" && $('[data-testid="structure"]'), 8000, `${id} structure`);
    const st = $('[data-testid="structure"]');
    assert.equal(Number(st.getAttribute("data-atoms")), nAtoms, id); assert.deepEqual($$('[data-testid="struct-bond"]').map((b) => Number(b.dataset.order)).sort(), orders.flatMap((o) => Array(o).fill(o)).sort(), `${id}: one line per shared pair`);
    assert.equal(st.getAttribute("data-bonds"), String(orders.length), id);
    assert.equal($$('[data-testid^="atom-"]').length, 0, `${id}: no leftover shell diagrams`);
  }
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
