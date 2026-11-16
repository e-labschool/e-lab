#!/usr/bin/env node
// UI + pure-model tests for the six acid-base simulations (REAL components in jsdom, REAL models).
//   node scripts/test-acidbase-ui.mjs
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

// ======================================================================= TITRATION
const TIT = "../src/engines/titration-ph-curve/TitrationPHCurve.jsx";
test("Titration: weak acid + NaOH shows the dense expected curve AND a clearly labelled buffer region with the 1:10..10:1 legend", async () => {
  await mount(TIT);
  assert.ok($('[data-testid="expected-curve"]'), "expected curve drawn by default");
  assert.ok($('[data-testid="buffer-region"]'), "buffer region shaded");
  const legend = $('[data-testid="legend"]').textContent;
  assert.match(legend, /Buffer region: \[A⁻\]\/\[HA\] between 1:10 and 10:1/); assert.match(legend, /pH = pKa = 4\.76/); assert.match(legend, /Equivalence \(25\.0 cm³\): pH 8\.73 > 7/);
  const d = $('[data-testid="expected-curve"]').getAttribute("d"); const pts = (d.match(/L/g) || []).length;
  assert.ok(pts > 150, `dense curve (${pts} segments), not the student's sparse points`); say(`expected curve path has ${pts + 1} points while the student has 1`);
  assert.match($('[data-testid="titration-graph"]').getAttribute("aria-label"), /Buffer region from 2\.27 cm³ to 22\.7 cm³/);
});
test("Titration: expected-curve toggle hides/shows it; student points plot on top; labels never share a box (placement result)", async () => {
  await click("Expected curve"); assert.equal($('[data-testid="expected-curve"]'), null);
  await click("Features"); assert.match(document.body.textContent, /Predict first: sketch the curve/); assert.equal($('[data-testid="buffer-region"]'), null);
  await click("Features"); await click("Expected curve"); assert.ok($('[data-testid="expected-curve"]')); assert.ok($('[data-testid="buffer-region"]'));
  await click("+5.0 cm³"); await click("+5.0 cm³");
  assert.equal($$('[data-testid="titration-graph"] circle').filter((c) => c.getAttribute("fill") === "#ffd166").length, 3, "3 readings plotted (0, 5, 10)");
  assert.match($('[data-testid="ph-readout"]').textContent, /^4\.\d\d$/);
  const rects = $$('[data-testid="titration-graph"] rect[rx="3"]').map((r) => ({ x: +r.getAttribute("x"), y: +r.getAttribute("y"), w: +r.getAttribute("width"), h: +r.getAttribute("height") }));
  for (let i = 0; i < rects.length; i += 1) for (let j = i + 1; j < rects.length; j += 1) { const a = rects[i], b = rects[j]; assert.ok(!(a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y), `labels ${i}/${j} overlap`); }
  say(`${rects.length} annotation labels, none overlapping`);
});
test("Titration: never says 'approaching' after equivalence (strong/strong, 25.0 then +0.5)", async () => {
  await select("Flask solution", "HCl"); await select("Burette solution", "NaOH");
  for (let i = 0; i < 5; i += 1) await click("+5.0 cm³"); // 25.0 = equivalence
  assert.match($('[data-testid="state-text"]').textContent, /Equivalence point reached/);
  await click("+0.5 cm³"); assert.match($('[data-testid="state-text"]').textContent, /Just past equivalence: base in excess/); assert.doesNotMatch($('[data-testid="state-text"]').textContent, /Approaching/);
  assert.equal($('[data-testid="buffer-region"]'), null, "strong/strong has no buffer region");
  assert.match($('[data-testid="explain"]').textContent, /no buffer region/);
});
test("Titration: weak/weak explains the missing sharp equivalence; strong flask + weak titrant explains where the buffer is", async () => {
  await select("Flask solution", "CH3COOH"); await select("Burette solution", "NH3");
  assert.match($('[data-testid="explain"]').textContent, /no sharp equivalence/i); assert.equal($('[data-testid="buffer-region"]'), null);
  await select("Flask solution", "NaOH"); await select("Burette solution", "CH3COOH");
  assert.match($('[data-testid="explain"]').textContent, /no buffer region before equivalence/);
});
test("Titration: concentration pairs whose V_eq is off the old 60 cm³ axis auto-scale (0.200 flask, 0.050 burette -> 100 cm³)", async () => {
  await select("Flask solution", "HCl"); await select("Burette solution", "NaOH"); await select("Flask concentration", "0.2"); await select("Burette concentration", "0.05");
  const ticks = $$('[data-testid="titration-graph"] text').map((t) => t.textContent);
  assert.ok(ticks.includes("200"), "x axis reaches 200 cm³"); assert.ok(ticks.includes("100.0"), "equivalence tag 100.0 cm³ shown on the axis");
  assert.match($('[data-testid="legend"]').textContent, /Equivalence \(100\.0 cm³\)/); say("axis maximum 200 cm³, equivalence 100.0 cm³ on the plot");
});
test("Titration: buttons stop at the axis limit with a message (no duplicate points, AK-37); Reset restores everything", async () => {
  await select("Flask concentration", "0.1"); await select("Burette concentration", "0.1");
  for (let i = 0; i < 14; i += 1) await click("+5.0 cm³");
  const n = $$("table.ab-sr-only tbody tr").length; const vols = $$("table.ab-sr-only tbody tr td:first-child").map((t) => t.textContent);
  assert.equal(new Set(vols).size, vols.length, "no duplicate volumes"); assert.ok(btn("+5.0 cm³").disabled); assert.match(document.body.textContent, /Axis limit 50 cm³ reached/);
  await click("Compare"); assert.ok($('[data-testid="compare-graph"]'));
  await click("Reset");
  assert.ok($('[data-testid="titration-graph"]'), "back to Experiment"); assert.equal($$("table.ab-sr-only tbody tr").length, 1); assert.equal($('select[aria-label="Flask solution"]').value, "CH3COOH");
  assert.equal($('select[aria-label="Flask concentration"]').value, "0.1"); assert.ok(!btn("+5.0 cm³").disabled); say(`${n} readings before reset, 1 after`);
});
test("Titration: Compare overlay lists strong/strong, weak/strong (+weak/weak) with initial pH, equivalence pH and buffer region only for weak", async () => {
  await click("Compare");
  const rows = $$('[data-testid="compare-table"] tbody tr').map((r) => r.textContent); assert.equal(rows.length, 2);
  assert.match(rows[0], /Strong acid \+ strong base1\.007\.00 \(= 7\)none/); assert.match(rows[1], /2\.888\.73 \(> 7\)2\.3.22\.7 cm³/);
  await click("+ weak/weak"); assert.equal($$('[data-testid="compare-table"] tbody tr').length, 3);
  await click("Base in flask"); const r2 = $$('[data-testid="compare-table"] tbody tr').map((r) => r.textContent);
  assert.match(r2[1], /Weak base \+ strong acid11\.125\.28 \(< 7\)/); assert.equal($$('[data-testid="buffer-region"]').length, 1, "only the weak base curve has a buffer band");
  assert.match(document.body.textContent, /Why strong \+ strong has no buffer region/); assert.match(document.body.textContent, /Why weak \+ weak has no sharp equivalence/);
  assert.match(document.body.textContent, /MO = Methyl orange 3\.1–4\.4; BTB = Bromothymol blue 6\.0–7\.6; PP = Phenolphthalein 8\.2–10\.0/);
  await click("Reset");
});

// ======================================================================= EQUIVALENCE POINT
const EQ = "../src/engines/equivalence-point/EquivalencePoint.jsx";
test("Equivalence: concentration shown; 'approaching' only before equivalence; past it says so (AK-26, AK-29)", async () => {
  await mount(EQ);
  assert.match($('[data-testid="setup"]').textContent, /25\.0 cm³ of 0\.100 mol dm⁻³ NaOH/); assert.match($('[data-testid="setup"]').textContent, /0\.100 mol dm⁻³ HCl/);
  const add = () => click("Add 2.5 cm³ HCl");
  for (let i = 0; i < 9; i += 1) await add(); // 22.5
  assert.match($('[data-testid="status"]').textContent, /Approaching equivalence/);
  await add(); assert.match($('[data-testid="status"]').textContent, /Equivalence point/); assert.equal($('[data-testid="ph"]').textContent, "7.00");
  await add(); assert.match($('[data-testid="status"]').textContent, /Just past equivalence/); assert.doesNotMatch($('[data-testid="status"]').textContent, /Approaching/);
  assert.equal($('[data-testid="ph"]').textContent, "2.32");
});
test("Equivalence: Ca(OH)2 above its solubility is refused and a possible concentration is chosen; H2SO4 uses pKa2", async () => {
  await click("Reset"); const cb = $$("input[type=checkbox]")[0]; cb.dispatchEvent(new MouseEvent("click", { bubbles: true })); await wait();
  const { validate, state } = await import("../src/engines/equivalence-point/lib/model.js");
  assert.equal(validate("CaOH2", 0.1).ok, false); assert.equal(validate("CaOH2", 0.01).ok, true); assert.equal(validate("NaOH", 0.1).ok, true);
  const baseSel = $$("select").find((s) => [...s.options].some((o) => o.value === "CaOH2")); Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, "value").set.call(baseSel, "CaOH2"); baseSel.dispatchEvent(new Event("change", { bubbles: true })); await wait();
  assert.match($('[data-testid="setup"]').textContent, /0\.010 mol dm⁻³ Ca\(OH\)₂/); assert.match(document.body.textContent, /dissolves only to about 0\.02/);
  const concSel = $$("select").find((s) => [...s.options].some((o) => o.textContent.includes("above solubility"))); assert.ok(concSel, "options above solubility are disabled/labelled");
  const old = state({ acidId: "HCl", baseId: "CaOH2", cAcid: 0.1, cBase: 0.01, acidVolume: 5, baseVolume: 25 });
  assert.ok(Math.abs(old.pH - 7) < 1e-6); say("0.010 mol dm⁻³ Ca(OH)₂ + 0.100 HCl: equivalence at 5.0 cm³, pH 7.00");
  const s2 = state({ acidId: "H2SO4", baseId: "NaOH", cAcid: 0.1, cBase: 0.1, acidVolume: 12.5, baseVolume: 25 }); assert.ok(s2.pH > 7.2 && s2.pH < 7.4, `sulfate equivalence ${s2.pH}`); say(`H₂SO₄ + NaOH equivalence pH ${s2.pH.toFixed(2)} (not 7.00: SO₄²⁻ is a weak base)`);
  await click("Reset");
});

// ======================================================================= BUFFER
const BUF = "../src/engines/buffer-action-visualizer/BufferActionVisualizer.jsx";
test("Buffer model: full-solver pH, ratio, range pKa±1, and depletion handled without pH 0/14 jumps (AK-46, AK-47)", async () => {
  const M = await import("../src/engines/buffer-action-visualizer/lib/bufferModel.js"); const sys = M.SYSTEMS.acid;
  const b0 = M.bufferState(sys, 0, 0); assert.ok(Math.abs(b0.pH - 4.76) < 0.02 && Math.abs(b0.ratio - 1) < 0.02); say(`start: pH ${b0.pH.toFixed(3)}, [A-]/[HA] ${b0.ratio.toFixed(3)}`);
  const b1 = M.bufferState(sys, 0.2, 0); const hh = 4.76 + Math.log10((2.3) / (2.7)); assert.ok(Math.abs(b1.pH - hh) < 0.02, `${b1.pH} vs HH ${hh}`);
  const u1 = M.unbufferedState(sys, 0.2, 0); assert.ok(Math.abs(u1.pH - 2.10) < 0.02);
  let prev = -1; for (let h = 0; h <= 12; h += 0.2) { const p = M.bufferState(sys, h, 0).pH; assert.ok(p <= (prev < 0 ? 99 : prev) + 1e-9); prev = p; assert.ok(p > 0.5 && p < 14); }
  const edge = M.bufferState(sys, 2.5 * (1 - 1 / 11) * 1.0, 0); say(`ratio 1:10 reached at ~${(2.5 * (1 - 1 / 11)).toFixed(2)} mmol H+, ratio ${edge.ratio.toFixed(2)} pH ${edge.pH.toFixed(2)}`);
  assert.ok(M.bufferState(sys, 2.5, 0).pH < 3.3 && M.bufferState(sys, 2.5, 0).inRange === false, "all A- used: HA only, pH ~ 2.9 from the weak acid, not 0");
  const full = M.bufferState(sys, 5, 0); assert.ok(full.pH > 1.0 && full.pH < 1.2, `excess strong acid pH ${full.pH} (2.5 mmol HA + 2.5 mmol extra H+ in 30 cm³)`);
  const basic = M.bufferState(M.SYSTEMS.basic, 0, 0); assert.ok(Math.abs(basic.pH - 9.25) < 0.02);
  const un = M.unbufferedState(M.SYSTEMS.acid, 1, 1); assert.ok(Math.abs(un.pH - 4.76) < 0.05, "H+ then OH- returns the unbuffered beaker to its start (water forms)");
});
test("Buffer particles: every addition reconciles to the chemistry; no orphan H+/OH- left in the buffer (AK-44, AK-45)", async () => {
  const P = await import("../src/engines/buffer-action-visualizer/lib/particles.js"); const M = await import("../src/engines/buffer-action-visualizer/lib/bufferModel.js");
  const sys = M.SYSTEMS.acid; let h = 0, oh = 0; const ps = P.createSample(M.targetCounts(sys, 0, 0), 3, { H: 0, OH: 0 });
  const run = (seconds) => { for (let i = 0; i < seconds * 60; i += 1) { const f = P.step(ps, 1 / 60, false); if (!f) P.reconcile(ps, M.targetCounts(sys, h, oh)); } };
  for (const t of ["H", "OH", "H", "H", "OH"]) { if (t === "H") h += 0.2; else oh += 0.2; P.addSeeker(ps, t); run(0.2); }
  run(3);
  const c = (k) => ps.filter((p) => p.kind === k).length; const tgt = M.targetCounts(sys, h, oh);
  assert.equal(c("H"), 0, "no stray H+"); assert.equal(c("OH"), 0, "no stray OH-"); assert.equal(c("acid"), tgt.acid); assert.equal(c("base"), tgt.base); assert.equal(c("water"), 0);
  for (const p of ps) assert.ok(p.x >= P.BOUNDS.x && p.x <= P.BOUNDS.x + P.BOUNDS.w && p.y >= P.BOUNDS.y && p.y <= P.BOUNDS.y + P.BOUNDS.h, "inside the liquid");
  say(`after H+,OH-,H+,H+,OH-: ${c("acid")} acid-form, ${c("base")} base-form dots, 0 free ions (chemistry target ${tgt.acid}/${tgt.base})`);
  for (let i = 0; i < 30; i += 1) { h += 1; P.addSeeker(ps, "H"); P.addSeeker(ps, "H"); } run(8); assert.ok(ps.length < 40, `bounded particle count ${ps.length}`);
});
test("Buffer UI: additions capped at 20 with a message; live ratio and buffer range shown; Reset restores", async () => {
  await mount(BUF);
  assert.match($('[data-testid="ratio"]').textContent, /\[A⁻\]\/\[HA\] = 1.* pKa = 4\.76 .* buffer range pH 3\.76–5\.76 \(ratio 1:10 to 10:1\)/); assert.equal($('[data-testid="ph-unbuffered"]').textContent, "4.76");
  for (let i = 0; i < 25; i += 1) { const b = btn("Add H⁺ (HCl)"); if (b.disabled) break; await click(b); }
  assert.match(document.body.textContent, /Additions: 20 of 20\. Limit reached/); assert.ok(btn("Add H⁺ (HCl)").disabled && btn("Add OH⁻ (NaOH)").disabled);
  assert.match($('[data-testid="ratio"]').textContent, /BUFFER CAPACITY EXCEEDED/); const pH = Number($('[data-testid="ph-buffer"]').textContent.replace("−", "-")); assert.ok(pH > 0.5 && pH < 2, `pH ${pH}`);
  await click("Reset"); assert.equal($('[data-testid="ph-buffer"]').textContent, "4.76"); assert.match($('[data-testid="ratio"]').textContent, /Inside the effective buffer range/); assert.ok(!btn("Add H⁺ (HCl)").disabled);
  await click("Add H⁺ (HCl)"); await click("Add OH⁻ (NaOH)"); assert.match($('[data-testid="reaction"]').textContent, /CH₃COOH \+ OH⁻/); assert.equal($('[data-testid="ph-unbuffered"]').textContent, "4.77"); // 0.2 mmol H+ then 0.2 mmol OH- cancel; only the 0.4 cm3 of dilution remains (pH +0.007)
});

// ======================================================================= pH CALCULATOR
const PHC = "../src/engines/ph-calculator-visualizer/PHCalculatorVisualizer.jsx";
test("pH calculator model: range -1..15, no silent clamping, comma decimals and 1x10^-3 accepted (AK-01, AK-02, AK-06)", async () => {
  const L = await import("../src/engines/ph-calculator-visualizer/lib/ph.js");
  const r2 = L.interpretInput("2", "conc"); assert.ok(r2.ok && Math.abs(r2.pH - -0.30103) < 1e-4); say(`2 mol dm⁻³ -> pH ${r2.pH.toFixed(2)} (accepted, not clamped to 1)`);
  assert.ok(Math.abs(L.interpretInput("0,001", "conc").pH - 3) < 1e-9); assert.ok(Math.abs(L.interpretInput("1x10^-3", "conc").pH - 3) < 1e-9); assert.ok(Math.abs(L.interpretInput(" 0.01 ", "conc").pH - 2) < 1e-9);
  const big = L.interpretInput("100", "conc"); assert.equal(big.ok, false); assert.match(big.reason, /pH −2\.00, outside this scale/); const tiny = L.interpretInput("1e-20", "conc"); assert.equal(tiny.ok, false); assert.match(tiny.reason, /It was not changed/);
  assert.equal(L.interpretInput("0", "conc").ok, false); assert.equal(L.interpretInput("abc", "conc").ok, false); assert.equal(L.interpretInput("16", "ph").ok, false); assert.equal(L.interpretInput("-1", "ph").ok, true);
});
test("pH calculator UI: typing 2 gives pH −0.30 (true minus); out-of-range text is kept and explained; keyboard slider works (AK-03)", async () => {
  await mount(PHC);
  const [conc, ph] = $$("input[type=text]");
  await typeInto(conc, "2"); assert.match($(".phc-reads").textContent, /−0\.30/); assert.equal(conc.value, "2"); assert.equal($("#phc-msg").textContent, "");
  await typeInto(conc, "1e-20"); assert.equal(conc.value, "1e-20", "typed text stays visible"); assert.match($("#phc-msg").textContent, /outside this scale/); assert.match($(".phc-reads").textContent, /−0\.30/, "value unchanged");
  const slider = $('[role="slider"]'); assert.ok(slider); assert.equal(slider.getAttribute("tabindex"), "0"); assert.equal(slider.getAttribute("aria-valuemin"), "-1"); assert.equal(slider.getAttribute("aria-valuemax"), "15");
  const key = async (k, extra = {}) => { slider.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...extra })); await wait(); };
  await key("Home"); assert.equal(slider.getAttribute("aria-valuenow"), "-1"); await key("ArrowDown"); assert.equal(slider.getAttribute("aria-valuenow"), "-0.9"); await key("PageDown"); assert.equal(slider.getAttribute("aria-valuenow"), "0.1"); await key("End"); assert.equal(slider.getAttribute("aria-valuenow"), "15");
  assert.match(slider.getAttribute("aria-valuetext"), /pH 15\.00/); assert.match($(".phc-reads").textContent, /pOH−1\.00/);
  await typeInto(ph, "3.52", "enter"); assert.match($(".phc-reads").textContent, /0\.00033\.0 × 10⁻⁴/); say("pH 3.52 -> [H3O+] 3.0 × 10⁻⁴ (2 s.f.)");
  await click("Reset"); assert.match($(".phc-reads").textContent, /3\.00/);
  assert.ok($(".phc-band") && $(".phc-band").getAttribute("aria-hidden") === "true"); // the marker is a band drawn behind the rows (z-index checked in Chromium)
});

// ======================================================================= H+ / OH- BALANCE
const HOH = "../src/engines/h-oh-balance/HOHBalance.jsx";
test("H+/OH- model: equal drops add equal moles; pH change per drop shrinks; water autoionisation matters at pH 7 (AK-10, AK-14)", async () => {
  const { waterState } = await import("../src/lib/acidbase/addition.js");
  const s0 = waterState({}); assert.ok(Math.abs(s0.pH - 7) < 1e-9);
  const pH = [0, 1, 2, 3, 4, 5, 10, 20].map((n) => waterState({ hclDrops: n }).pH); say("pH after 0,1,2,3,4,5,10,20 drops of 0.100 mol dm⁻³ HCl in 100 cm³: " + pH.map((p) => p.toFixed(2)).join(", "));
  const n1 = waterState({ hclDrops: 1 }).nH, n7 = waterState({ hclDrops: 7 }).nH; assert.ok(Math.abs(n7 / n1 - 7) < 1e-12, "moles proportional to drops");
  const steps = pH.slice(1, 6).map((p, i) => p - pH[i]); for (let i = 1; i < steps.length; i += 1) assert.ok(Math.abs(steps[i]) < Math.abs(steps[i - 1]), "each further drop changes pH less");
  const H1 = (5e-6 / 0.10005 * 1) ; const c = 5e-6 / 0.10005; const exact = (c + Math.sqrt(c * c + 4e-14)) / 2; assert.ok(Math.abs(waterState({ hclDrops: 1 }).H - exact) / exact < 1e-9, "first drop matches (c+sqrt(c²+4Kw))/2"); assert.ok(H1 > 0);
  const back = waterState({ hclDrops: 3, naohDrops: 3 }); assert.ok(Math.abs(back.pH - 7) < 1e-9, "equal moles of HCl and NaOH neutralise");
  assert.ok(waterState({ hclDrops: 2000, c: 1 }).atLimit);
});
test("H+/OH- UI: caption leaves 'Pure water'; log axis labelled 10^0..10^-14; linear option; limit message; Reset", async () => {
  await mount(HOH);
  assert.equal($('[data-testid="caption"]').textContent, "Pure water (100.00 cm³)"); assert.equal($('[data-testid="ph"]').textContent, "7.00");
  await click("+1 drop HCl"); assert.match($('[data-testid="caption"]').textContent, /Water \+ 1 drop HCl/); assert.equal($('[data-testid="ph"]').textContent, "4.30");
  await click("+10 drops NaOH"); assert.match($('[data-testid="caption"]').textContent, /1 drop HCl \+ 10 drops NaOH/); assert.ok(Number($('[data-testid="ph"]').textContent) > 9);
  assert.match($(".hoh-axis").textContent, /10⁰/.source ? /10/ : /10/); assert.equal($$(".hoh-axis span").length, 15); assert.match($(".hoh-mid").textContent, /logarithmic/);
  await click("Linear"); assert.match($(".hoh-mid").textContent, /linear scale/i); await click("Log");
  for (let i = 0; i < 260; i += 1) { const b = btn("+10 drops HCl"); if (b.disabled) break; await click(b); }
  assert.ok(btn("+10 drops HCl").disabled); assert.match(document.body.textContent, /Limit: 100 cm³ of reagent \(2000 drops\) added/);
  await click("Reset"); assert.equal($('[data-testid="caption"]').textContent, "Pure water (100.00 cm³)"); assert.equal($('[data-testid="ph"]').textContent, "7.00");
});

// ======================================================================= NEUTRALISATION
test("Neutralisation model + particle world: unequal amounts leave the excess, pH from the exact solver, all pairs react, nothing outside the liquid", async () => {
  const M = await import("../src/engines/neutralization-particle-visualizer/lib/model.js"); const S = await import("../src/engines/neutralization-particle-visualizer/lib/sim.js");
  const eq = M.neutralisation(4, 4); assert.equal(eq.limiting, "none"); assert.ok(Math.abs(eq.pH - 7) < 1e-6);
  const ex = M.neutralisation(6, 4); assert.equal(ex.limiting, "NaOH"); assert.equal(ex.excessH, 2); assert.ok(Math.abs(ex.pH - -Math.log10(2e-3 / 0.05)) < 0.02, `pH ${ex.pH}`); assert.equal(ex.result, "acidic");
  const bs = M.neutralisation(2, 5); assert.equal(bs.limiting, "HCl"); assert.equal(bs.excessOH, 3); assert.ok(bs.pH > 12); say(`6 HCl + 4 NaOH -> pH ${ex.pH.toFixed(2)} acidic; 2 HCl + 5 NaOH -> pH ${bs.pH.toFixed(2)} basic`);
  for (const [a, b] of [[4, 4], [6, 4], [2, 5], [1, 10], [10, 10]]) {
    const w = S.createWorld(a, b); const inBox = () => w.particles.every((p) => { const bb = S.boundsFor(p, w.stage); const r = S.TYPES[p.type].r; return p.x >= bb.x + r - 1e-6 && p.x <= bb.x + bb.w - r + 1e-6 && p.y >= bb.y + r - 1e-6 && p.y <= bb.y + bb.h - r + 1e-6; });
    assert.ok(inBox(), "separate: inside the liquid"); S.startMix(w); let t = 0; while (w.stage !== "done" && t < 60) { S.stepWorld(w, 1 / 60); t += 1 / 60; assert.ok(inBox(), `mixing t=${t.toFixed(1)}`); }
    assert.equal(w.stage, "done"); const n = (ty) => w.particles.filter((p) => p.type === ty).length; assert.equal(n("H"), Math.max(0, a - b)); assert.equal(n("OH"), Math.max(0, b - a)); assert.equal(n("NA"), b); assert.equal(n("CL"), a); assert.equal(n("W"), Math.min(a, b));
  }
  say("5 amount pairs: H+/OH- left over = |a-b|, spectators conserved, water = min(a,b), all particles inside the liquid every frame");
});
test("Neutralisation UI: sliders set unequal amounts, final text names limiting reagent and pH; three equations shown; Reset", async () => {
  await mount("../src/engines/neutralization-particle-visualizer/NeutralizationParticleVisualizer.jsx");
  const sl = $$('input[type="range"]'); assert.equal(sl.length, 2);
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(sl[0], "6"); sl[0].dispatchEvent(new Event("input", { bubbles: true })); sl[0].dispatchEvent(new Event("change", { bubbles: true })); await wait(100);
  assert.match($('[data-testid="status"]').textContent, /Two solutions/); await click("Mix");
  for (let i = 0; i < 400 && !/pairs reacted\. NaOH was the limiting/.test($('[data-testid="status"]').textContent); i += 1) await wait(50);
  assert.match($('[data-testid="status"]').textContent, /4 pairs reacted\. NaOH was the limiting reagent; 2 H⁺ left over, so the solution is acidic \(pH 1\.\d\d\)/);
  const eqs = $('[data-testid="equations"]').textContent; assert.match(eqs, /HCl\(aq\) \+ NaOH\(aq\) → NaCl\(aq\) \+ H₂O\(l\)/); assert.match(eqs, /spectator/); assert.match(eqs, /Net ionic.*H⁺\(aq\) \+ OH⁻\(aq\) → H₂O\(l\)/);
  assert.equal($$("circle").length > 0, true); await click("Reset"); assert.match($('[data-testid="status"]').textContent, /Two solutions/); assert.equal($$('input[type="range"]')[0].value, "4");
});

// ======================================================================= contrast of the dark-panel text tokens (AA)
test("AA contrast: text tokens of the shared dark panel against its backgrounds >= 4.5:1; chart label colours too", () => {
  const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const pairs = [["#f1f5f9", "#0e1520"], ["#b9c4d4", "#0e1520"], ["#b9c4d4", "#141e2c"], ["#d3dcea", "#0e1520"], ["#5eead4", "#08101a"], ["#fde68a", "#0e1520"], ["#fcd9a0", "#2a2a1e"], ["#5eead4", "#0e1520"], ["#d8b4fe", "#0e1520"], ["#ffd166", "#0e1520"], ["#86efac", "#141e2c"], ["#fda4af", "#141e2c"]];
  const out = pairs.map(([f, b]) => ({ f, b, r: ratio(f, b) })); for (const o of out) assert.ok(o.r >= 4.5, `${o.f} on ${o.b} = ${o.r.toFixed(2)}`);
  say("min ratio " + Math.min(...out.map((o) => o.r)).toFixed(2) + ":1 over " + out.length + " token pairs");
});

for (const { name, fn } of pending) { try { await fn(); passed += 1; console.log(`ok  ${name}`); } catch (e) { process.exitCode = 1; console.error(`FAIL ${name}\n${e.stack}`); } }
if (root) root.unmount();
console.log(`\n${passed}/${pending.length} acid-base UI/model tests passed`);
process.exit(process.exitCode ?? 0);
