#!/usr/bin/env node
// jsdom UI tests for the Mass Spectrometry workspace (the MS tab of the Spectroscopy Simulation Lab):  node scripts/test-ms-ui.mjs
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
const { SPECTRA } = await import("../src/engines/spectroscopy-studio/ms/data/spectra.js");
const { CANDIDATES, ROUNDS } = await import("../src/engines/spectroscopy-studio/ms/physics/challenge.js");
const { fieldForMz } = await import("../src/engines/spectroscopy-studio/ms/physics/kinematics.js");
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
  root.render(h(Studio, { standalone: true })); mounted = { root, host };
  await until(() => $(T("spectroscopy-workspace")) && $(T("stage-stepper")), 6000, "workspace"); await tick(100);
  await click(T("tech-ms")); await until(() => $(T("stage-stepper"))?.getAttribute("data-count") === "13", 3000, "MS stepper"); await tick(100);
}



const { remaining, POOLS } = await import("../src/engines/spectroscopy-studio/ms/data/evidence.js");
const { radiusFromMz } = await import("../src/engines/spectroscopy-studio/ms/physics/kinematics.js");
const stageTxt = () => txt(T("step-panel"));
const viewTxt = (n) => txt(T(`step-view-${n}`));
const speedUp = async () => { const b = $(`${T("speed-switch")} button[data-value="2"], ${T("speed-switch")} [role=radio]:last-child, ${T("speed-switch")} button:last-child`); if (b) await click(b); };

console.log("MS tab: live, thirteen stages");
await mount();
await test("the MS tab is a live workspace (no placeholder); IR and NMR are still there", async () => {
  assert.ok(!$(T("dev-ms")), "placeholder shown"); assert.equal($(T("stage-box")).getAttribute("data-technique"), "ms");
  assert.match(txt(".sd-subtitle"), /Mass Spec · stage 1 of 13/);
  for (const t of ["ms", "ir", "nmr", "structure"]) assert.ok($(T(`tech-${t}`)), t);
});
await test("stepper: thirteen stages, Previous disabled on 1, Next on 13, Next / Previous / direct jump", async () => {
  for (let i = 1; i <= 13; i += 1) assert.ok($(T(`step-${i}`)), `step-${i}`);
  assert.equal($$(`${T("stage-stepper")} li`).length, 13); assert.ok($(T("step-prev")).disabled);
  await click(T("step-next")); assert.equal($(T("step-2")).getAttribute("aria-current"), "step"); assert.match(txt(".sd-subtitle"), /stage 2 of 13/);
  await click(T("step-prev")); assert.equal($(T("step-1")).getAttribute("aria-current"), "step");
  for (const i of [13, 6, 9, 2, 1]) { await go(i); assert.equal($(T(`step-${i}`)).getAttribute("aria-current"), "step"); }
  await go(13); assert.ok($(T("step-next")).disabled); await go(1);
});
await test("every stage has a title, a Teacher disclosure and only that stage's view (one tab, one page)", async () => {
  for (let i = 1; i <= 13; i += 1) { await go(i); assert.ok(txt(T("step-title")).length > 5, `title ${i}`); assert.ok($(T("teacher-details")), `teacher ${i}`); assert.equal($$(T("step-view-" + i)).length, 1); assert.match(stageTxt(), new RegExp(`Step ${i} of 13`)); }
  assert.equal($$(T("spectroscopy-workspace")).length, 1); assert.equal($$("[data-testid^='step-view-']").length, 1);
});
await test("the playback bar offers Pause/Play, Replay and speed", async () => {
  assert.ok($(T("btn-play-pause")) && $(T("btn-reset-playback")) && $(T("speed-switch"))); await click(T("btn-play-pause")); assert.equal($(T("playback-bar")).getAttribute("data-paused"), "1"); await click(T("btn-play-pause")); assert.equal($(T("playback-bar")).getAttribute("data-paused"), "0");
});

console.log("Stages 1-4: sample, ionisation, fragmentation");
await test("stage 1: rotating methane (SVG fallback without WebGL), the question, m/z definition and the chain; Begin goes to stage 2", async () => {
  await go(1); assert.ok($(T("methane-stage")) && ($(T("methane-svg")) || $(T("methane-canvas"))));
  assert.match(txt(T("intro-question")), /How can we determine the masses of atoms and molecules\?/);
  assert.match(stageTxt(), /mass-to-charge/i); assert.match(txt(T("mz-equation")), /m\/z/); assert.match(txt(T("intro-chain")), /Sample introduction.*Ionisation.*Ion separation.*Detection.*Mass spectrum/);
  await click(T("begin")); await until(() => $(T("step-view-2")), 2000, "stage 2");
});
await test("stage 2: Introduce Sample opens the valve and molecules arrive in the ionisation chamber; EI vs other methods are stated", async () => {
  assert.equal($(T("sample-view")).getAttribute("data-released"), "0"); assert.match(txt(T("sample-label")), /Illustrative instrument model/);
  await click(T("introduce-sample")); assert.equal($(T("sample-view")).getAttribute("data-released"), "1");
  await until(() => Number($(T("instrument-svg")).getAttribute("data-in-chamber")) >= 1, 8000, "molecules in the chamber");
  assert.match(txt(T("s2-note")), /not every sample has to be vaporised/i); assert.match(txt(T("teacher-details")), /electrospray|other ionisation methods/i);
  assert.match(txt(T("instrument-svg")), /Ionisation chamber/); assert.match(txt(T("instrument-svg")), /Inlet/);
});
await test("stage 3: Ionize shows incoming and ejected electrons and a distinct molecular ion; CH4 + e- -> CH4+. + 2e-; no proton attachment", async () => {
  await go(3); assert.equal($(T("ionise-view")).getAttribute("data-fired"), "0"); assert.ok($(T("neutral-molecule")) && $(T("electron-in")));
  await click(T("ionize")); assert.equal($(T("ionise-view")).getAttribute("data-fired"), "1");
  await until(() => Number($(T("ionise-view")).getAttribute("data-progress")) >= 0.99, 20000, "ionisation to finish");
  assert.ok($(T("molecular-ion")) && $(T("electron-ejected")) && $(T("electron-scattered")), "ion + two electrons");
  assert.match(txt(T("ion-equation")), /CH₄ \+ e⁻ → CH₄⁺• \+ 2e⁻/);
  const all = `${stageTxt()} ${txt(T("ionise-view"))}`; assert.ok(!/CH₅|protonated|\[M\+H\]/i.test(all), "no CH5+ / protonation"); assert.ok(!/(?<!No )proton attach/i.test(all), "proton attachment only mentioned as excluded");
  assert.match(stageTxt(), /fragment/i);
});
await test("stage 3: Replay runs the ionisation again from the start", async () => {
  await click(T("btn-reset-playback")); await tick(120);
  assert.ok(Number($(T("ionise-view")).getAttribute("data-progress")) < 0.5, "progress restarted");
  await until(() => Number($(T("ionise-view")).getAttribute("data-progress")) >= 0.99, 20000, "second run");
});
await test("stage 4: four pathways, charged and neutral products are labelled, unequal likelihoods are stated, only charged ions continue", async () => {
  await go(4); assert.equal($(T("fragment-view")).getAttribute("data-path"), "ch3"); assert.match(txt(T("path-equation")), /CH₄⁺• → CH₃⁺ \+ H•/);
  await click(T("path-ch2")); assert.equal($(T("fragment-view")).getAttribute("data-path"), "ch2"); assert.match(txt(T("path-equation")), /CH₂⁺• \+ H₂/);
  await until(() => $(T("charged-label")) && $(T("neutral-label")), 8000, "labels");
  assert.match(txt(T("s4-text")), /only charged particles/i); assert.match(stageTxt(), /not equally likely/i); assert.match(stageTxt(), /Fragmentation patterns provide information about molecular structure/);
  assert.equal($$(`${T("path-bars")} li`).length, 4);
  await click(T("path-ch3"));
});

console.log("Stages 5-8: acceleration, separation, TOF, detection");
await test("stage 5: the voltage slider changes Ek (same for every ion) and the speeds (lighter is faster)", async () => {
  await go(5); assert.equal($(T("accel-view")).getAttribute("data-v"), "2000"); assert.match(txt(T("readout-ek")), /2,000 eV/);
  await setRange(T("v-slider"), 4000); assert.equal($(T("accel-view")).getAttribute("data-v"), "4000"); assert.match(txt(T("readout-ek")), /4,000 eV/);
  const v16 = txt(`${T("readout-v16")} dd`); const v58 = txt(`${T("readout-v58")} dd`); assert.match(v16, /km\/s/); assert.ok(parseFloat(v16.replace(/[^0-9.]/g, "")) > parseFloat(v58.replace(/[^0-9.]/g, "")), `${v16} vs ${v58}`);
  assert.match(txt(T("s5-key")), /same kinetic energy, not the same speed/); assert.match(txt(T("ek-equation-panel")), /Eₖ = zeV/);
  await setRange(T("v-slider"), 2000);
});
await test("stage 6: m/z selector, circular path radius from the formula, B needed, detector hit vs miss, tuning B", async () => {
  await go(6); assert.equal($(T("sector-svg")).getAttribute("data-mz"), "16");
  const r16 = Number($(T("sector-svg")).getAttribute("data-radius")); const B = Number($(T("sector-svg")).getAttribute("data-b")); assert.ok(Math.abs(r16 - radiusFromMz(16, 2000, B)) < 1e-5, `r16 ${r16}`);
  assert.equal($(T("sector-svg")).getAttribute("data-outcome"), "detector"); assert.match(txt(T("sector-outcome")), /Detected/);
  await click(T("mz-58")); assert.equal($(T("sector-svg")).getAttribute("data-mz"), "58"); assert.notEqual($(T("sector-svg")).getAttribute("data-outcome"), "detector"); assert.match(txt(T("sector-outcome")), /Not detected/);
  assert.ok(Number($(T("sector-svg")).getAttribute("data-radius")) > r16, "larger m/z, larger radius");
  await click(T("tune-b")); assert.equal($(T("sector-svg")).getAttribute("data-outcome"), "detector"); assert.match(txt(T("readout-B")), /T/);
  await click(T("mz-31")); assert.notEqual($(T("sector-svg")).getAttribute("data-outcome"), "detector"); await setRange(T("b-slider"), 0.8); assert.ok(["wall", "plate", "detector"].includes($(T("sector-svg")).getAttribute("data-outcome")));
  assert.ok($(T("sector-ion")) && $$("[data-testid^='path-']").length >= 6, "ion marker and six paths");
  await click(T("mz-16")); await click(T("tune-b"));
});
await test("stage 7: Start Flight, ions race, arrival order lightest first, adjustable ion X changes its time and rank", async () => {
  await go(7); assert.equal($(T("tof-view")).getAttribute("data-started"), "0");
  await click(T("start-flight")); assert.equal($(T("tof-view")).getAttribute("data-started"), "1");
  await until(() => Number($(T("tof-view")).getAttribute("data-done")) >= 1, 15000, "first arrival");
  const ranks = () => ["m16", "m31", "m43", "x"].map((id) => Number($(T(`arrival-${id}`)).getAttribute("data-rank")));
  assert.deepEqual(ranks(), [1, 2, 3, 4], "X = 58 arrives last");
  const t58 = txt(T("readout-tx")); await setRange(T("massx-slider"), 20); assert.notEqual(txt(T("readout-tx")), t58); assert.deepEqual(ranks(), [1, 3, 4, 2].map((x, i) => (i === 3 ? 2 : x)).map((x, i) => [1, 3, 4, 2][i]), "X = 20 arrives between 16 and 31");
  assert.match(txt(T("tof-contrast")), /magnetic sector/i); assert.match(txt(T("t-equation-panel")), /t = L √\(m \/ 2zeV\)/); await setRange(T("massx-slider"), 58);
  await click(T("btn-reset-playback")); await tick(150); assert.ok(Number($(T("tof-svg")).getAttribute("data-progress")) < 0.3, "Replay restarts the race");
});
await test("stage 8: Detect ions builds the methane spectrum from arrivals; the peaks grow with counts and end at the spectrum", async () => {
  await go(8); assert.equal($(T("detect-view")).getAttribute("data-started"), "0"); assert.equal($(T("detect-view")).getAttribute("data-k"), "0");
  await speedUp(); await click(T("detect-ions"));
  await until(() => Number($(T("detect-view")).getAttribute("data-k")) > 10, 6000, "ions arriving");
  const mid = Number($(T("detect-spectrum")).querySelector(T("peak-15")).getAttribute("data-rel"));
  await until(() => $(T("detect-view")).getAttribute("data-k") === $(T("detect-view")).getAttribute("data-total"), 30000, "all ions detected");
  const rel = (mz) => Number($(`${T("detect-spectrum")} ${T("peak-" + mz)}`).getAttribute("data-rel"));
  assert.ok(mid < rel(15), "peak grew"); assert.ok(Math.abs(rel(16) - 100) < 0.5 && Math.abs(rel(15) - 85) < 1.5 && rel(12) < 5, `final heights ${rel(16)} ${rel(15)} ${rel(12)}`);
  assert.match(txt(T("s8-text")), /more ions, not heavier ions/i); assert.match(txt(T("sync-line")), /Ion reaches detector → signal recorded → peak grows/);
});

console.log("Stages 9-11: spectrum, isotopes, patterns");
await test("stage 9: methane spectrum, M+. = base peak, three terms, clicking a peak gives m/z, formula and origin; labelled representative", async () => {
  await go(9); await until(() => $(T("peak-16")), 3000, "spectrum");
  assert.match(txt(T("spectrum-note")), /Representative \/ idealised, not experimental/); assert.match(txt(T("terms")), /Molecular ion peak.*Base peak.*Fragment ion peaks/);
  assert.match(txt(T("peak-info")), /Click a peak/);
  await click(`${T("methane-spectrum")} ${T("peak-15")}`.replace(/\s/, " ")); assert.match(txt(T("info-formula")), /CH₃⁺/); assert.match(txt(T("info-origin")), /H•|H atom/); assert.match(txt(T("peak-info")), /m\/z 15/);
  await click(`${T("methane-spectrum")} ${T("peak-16")}`); assert.match(txt(T("info-formula")), /CH₄⁺•/); assert.match(txt(T("info-origin")), /Molecular ion/); assert.equal($(`${T("methane-spectrum")} ${T("peak-16")}`).getAttribute("data-selected"), "1");
});
await test("stage 10: abundance slider updates the peaks and Ar live (75:25 -> 35.50); preset natural; mass numbers vs isotopic masses", async () => {
  await go(10); await until(() => Number($(`${T("isotope-spectrum")} ${T("peak-35")}`)?.getAttribute("data-rel")) > 90, 6000, "peaks grown");
  assert.match(txt(T("readout-ar")), /35\.50/); assert.match(txt(T("ar-equation")), /\(35 × 75 \+ 37 × 25\) \/ 100 = 35\.50/);
  assert.match(stageTxt(), /17 protons/); assert.match(txt(T("s10-note")), /mass numbers/i);
  await setRange(T("abundance-slider"), 50); await tick(100); assert.match(txt(T("readout-ar")), /36\.00/);
  const rel = (mz) => Number($(`${T("isotope-spectrum")} ${T("peak-" + mz)}`).getAttribute("data-rel")); assert.ok(Math.abs(rel(35) - rel(37)) < 0.5, "equal peaks at 50:50");
  await setRange(T("abundance-slider"), 100); await tick(100); assert.match(txt(T("readout-ar")), /35\.00/); assert.equal($$(`${T("isotope-spectrum")} [data-testid^='peak-']`).length, 1);
  await click(T("preset-natural")); await tick(100); assert.match(txt(T("readout-ar")), /35\.48/); assert.match(txt(T("readout-ar-exact")), /35\.4\d/);
  await click(T("preset-teaching")); await tick(100); assert.match(txt(T("readout-ar")), /35\.50/);
});
await test("stage 11: Cl2 gives 70/72/74 = 9:6:1; CH3Cl 3:1; Br compounds 1:1; natural model differs; simplification stated", async () => {
  await go(11); await until(() => $(T("pattern-table")), 3000, "table"); assert.equal($(T("pattern-view")).getAttribute("data-ratio"), "9:6:1");
  assert.deepEqual([70, 72, 74].map((m) => $$(`${T(`pattern-row-${m}`)} td`)[2].textContent), ["9", "6", "1"]);
  await click(T("compound-ch3cl")); assert.equal($(T("pattern-view")).getAttribute("data-ratio"), "3:1"); assert.ok($(T("pattern-row-50")) && $(T("pattern-row-52")));
  await click(T("compound-ch2cl2")); assert.equal($(T("pattern-view")).getAttribute("data-ratio"), "9:6:1");
  await click(T("compound-ch3br")); assert.equal($(T("pattern-view")).getAttribute("data-ratio"), "1:1"); assert.ok($(T("pattern-row-94")) && $(T("pattern-row-96")));
  await click(T("compound-cl2")); await click(T("model-natural")); assert.equal($(T("pattern-view")).getAttribute("data-ratio"), "100.0:64.0:10.2");
  await click(T("model-teaching")); await click(`${T("pattern-spectrum")} ${T("peak-72")}`); assert.match(txt(T("pattern-ratio")), /³⁵Cl–³⁷Cl/);
  assert.match(txt(T("s11-note")), /simplified nominal-mass/i);
});

console.log("Stages 12-13: unknown challenge and comparison");
await test("stage 12: no compound name before submit; peak click gives a non-leaking hint; Submit needs all five tasks", async () => {
  await go(12); const t0 = viewTxt(12); assert.ok(!/methane|CH₄/i.test(t0.replace(/Unknown 1 of 5/, "")), `leak: ${t0.slice(0, 200)}`);
  assert.ok($(T("submit")).disabled); await click(`${T("unknown-spectrum")} ${T("peak-15")}`); assert.match(txt(T("hint")), /Hint for m\/z 15/); assert.ok(!/is the molecular ion|is the base peak|methane/i.test(txt(T("hint"))), txt(T("hint")));
  await click(`${T("unknown-spectrum")} ${T("peak-17")}`); assert.match(txt(T("hint")), /13C|¹³C/);
});
await test("stage 12: answer all five tasks (methane), submit, concise explanation, score; next unknown resets", async () => {
  const peak = (mz) => `${T("unknown-spectrum")} ${T("peak-" + mz)}`;
  await click(T("task-1")); await click(peak(16)); await click(T("use-peak")); assert.match(txt(T("picked-line")), /m\/z 16/);
  await click(T("task-2")); await click(peak(16)); await click(T("use-peak"));
  await click(T("task-3")); for (const m of [14, 15]) { await click(peak(m)); await click(T("use-peak")); } assert.match(txt(T("picked-line")), /14, 15/);
  await click(T("task-4")); await click(T("iso-none")); await click(T("task-5")); assert.equal($$(`${T("cand")} button`).length, 4);
  assert.ok($(T("submit")).disabled, "not yet answered"); await click(T("cand-methane")); assert.ok(!$(T("submit")).disabled);
  await click(T("submit")); await until(() => $(T("reveal")), 2000, "reveal");
  assert.match(txt(T("reveal-score")), /All five correct/); assert.match(txt(T("reveal-name")), /Methane/); assert.ok(txt(T("explanation")).length > 60 && txt(T("explanation")).length < 500, "concise");
  assert.equal($$(`${T("results")} li.is-correct`).length, 5);
  await click(T("next-unknown")); assert.match(txt(T("unknown-title")), /Unknown 2 of 5/); assert.ok(!$(T("reveal")));
});
await test("stage 12: a wrong compound with the same nominal mass is explained (ethanol vs methoxymethane), M alone is not enough", async () => {
  assert.equal($(T("unknown-view")).getAttribute("data-round"), "2");
  const peak = (mz) => `${T("unknown-spectrum")} ${T("peak-" + mz)}`;
  await click(T("task-1")); await click(peak(46)); await click(T("use-peak")); await click(T("task-2")); await click(peak(31)); await click(T("use-peak"));
  await click(T("task-3")); for (const m of [27, 29, 31, 43, 45]) { await click(peak(m)); await click(T("use-peak")); }
  await click(T("task-4")); await click(T("iso-none")); await click(T("task-5"));
  assert.ok(CANDIDATES.ethanol.filter((c) => c.M === 46).length >= 3, "three M = 46 candidates");
  await click(T("cand-methoxymethane")); await click(T("submit")); await until(() => $(T("reveal")), 2000, "reveal");
  assert.match(txt(T("reveal-score")), /4 of 5 correct/); assert.match(txt(T("reveal-name")), /Ethanol/); assert.match(txt(T("why-not")), /Methoxymethane/); assert.match(txt(T("why-not")), /base peak/);
  await click(T("try-again")); assert.ok(!$(T("reveal"))); assert.ok($(T("submit")).disabled);
});
await test("stage 12: all five unknowns are reachable; each has four choices and the answer is not always listed first", async () => {
  const seen = []; const firsts = [];
  for (let i = 0; i < 5; i += 1) {
    seen.push(Number($(T("unknown-view")).getAttribute("data-round"))); await click(T("task-5"));
    const ids = $$(`${T("cand")} button`).map((b) => b.getAttribute("data-testid").replace("cand-cand-", "")); assert.equal(ids.length, 4); firsts.push(ids[0]);
    const mz = [...$$(`${T("unknown-spectrum")} [data-testid^='peak-']`)].map((e) => Number(e.getAttribute("data-mz")));
    for (const t of [1, 2, 3]) { await click(T(`task-${t}`)); await click(`${T("unknown-spectrum")} ${T("peak-" + mz[0])}`); await click(T("use-peak")); }
    await click(T("task-4")); await click(T("iso-cl")); await click(T("task-5")); await click($$(`${T("cand")} button`)[0]); await click(T("submit")); await until(() => $(T("reveal")), 2000, "reveal"); await click(T("next-unknown"));
  }
  assert.deepEqual(seen, [2, 3, 4, 5, 1]);
  assert.ok(firsts.some((id, i) => id !== ROUNDS[[1, 2, 3, 4, 0][i]]), `the true compound is not always first: ${firsts}`);
});
await test("stage 13: table of the three techniques; evidence per technique; candidates narrow; chloromethane is decided by MS; no technique is universally sufficient", async () => {
  await go(13); assert.equal($$(`${T("technique-table")} tbody tr`).length, 3); assert.match(txt(T("technique-table")), /m\/z values, ion abundances, isotopic composition, molecular and fragment ions/); assert.match(txt(T("technique-table")), /bond vibrations and functional-group evidence/); assert.match(txt(T("technique-table")), /Hydrogen environments|hydrogen environments/i);
  assert.equal($(T("compare-view")).getAttribute("data-example"), "ethanol"); assert.equal($(T("ev-ms")).getAttribute("data-revealed"), "0");
  assert.equal($$(`${T("candidates")} li[data-in="1"]`).length, POOLS.ethanol.length, "all candidates before evidence");
  await click(T("reveal-ms")); assert.equal($(T("ev-ms")).getAttribute("data-revealed"), "1"); assert.equal($$(`${T("candidates")} li[data-in="1"]`).length, remaining("ethanol", ["ms"]).length); assert.match(txt(T("ev-ms")), /Molecular ion m\/z 46/);
  await click(T("reveal-ir")); await click(T("reveal-nmr")); assert.equal($$(`${T("candidates")} li[data-in="1"]`).length, 1); assert.match(txt(T("verdict")), /Only Ethanol/); assert.match(txt(T("ev-ir")), /O–H/); assert.match(txt(T("ev-nmr")), /ppm/);
  await click(T("example-propanone")); assert.equal($(T("compare-view")).getAttribute("data-example"), "propanone"); assert.equal($(T("ev-ms")).getAttribute("data-revealed"), "0"); await click(T("reveal-ms")); assert.ok($$(`${T("candidates")} li[data-in="1"]`).length > 1, "MS alone does not settle propanone");
  await click(T("example-chloromethane")); await click(T("reveal-ms")); assert.equal($$(`${T("candidates")} li[data-in="1"]`).length, 1); assert.match(txt(T("ev-ms")), /one chlorine/);
  assert.match(txt(T("no-single")), /No single technique is universally sufficient/);
});

console.log("Shell: Reset, persistence, other tabs, reduced motion");
await test("Reset clears the MS experiment but keeps the stage; IR, NMR and Structure Investigation stay reachable", async () => {
  await go(6); await setRange(T("b-slider"), 0.5); await click(T("mz-43")); await click(".sd-btn[aria-label*='Reset'], button[aria-label*='Reset' i]"); await tick(200);
  assert.equal($(T("sector-svg")).getAttribute("data-mz"), "16"); assert.match(txt(".sd-subtitle"), /stage 6 of 13/);
  await click(T("tech-ir")); await until(() => $(T("stage-box"))?.getAttribute("data-technique") === "ir", 3000, "IR"); await click(T("tech-nmr")); await until(() => /step/.test($(T("stage-box"))?.getAttribute("data-stage") ?? ""), 3000, "NMR");
  await click(T("tech-structure")); assert.ok($(T("dev-structure"))); await click(T("tech-ms")); await until(() => $(T("stage-box"))?.getAttribute("data-technique") === "ms", 3000, "MS again"); assert.match(txt(".sd-subtitle"), /stage 6 of 13/);
});
await test("the MS experiment survives switching tabs (V, B, m/z): the store outlives the stage views", async () => {
  await go(6); await click(T("mz-31")); await setRange(T("b-slider"), 0.4); await click(T("tech-ir")); await tick(80); await click(T("tech-ms")); await until(() => $(T("sector-svg")), 3000, "stage 6");
  assert.equal($(T("sector-svg")).getAttribute("data-mz"), "31"); assert.equal($(T("sector-svg")).getAttribute("data-b"), "0.4");
  await go(5); await go(6); assert.equal($(T("sector-svg")).getAttribute("data-mz"), "31");
});
await test("reduced motion: animations jump to their end state (no running animation)", async () => {
  const old = window.matchMedia; window.matchMedia = (q) => ({ matches: /reduce/.test(q), addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  await mount(); await go(3); await click(T("ionize")); await tick(200); assert.ok(Number($(T("ionise-view")).getAttribute("data-progress")) >= 0.99, "ionisation shown at its end at once");
  await go(7); await click(T("start-flight")); await tick(200); assert.equal($(T("tof-view")).getAttribute("data-done"), "4");
  window.matchMedia = old;
});
await test("no console.error output (React warnings: keys, act, state updates) during the whole run", async () => { console.error = origErr; assert.deepEqual(consoleErrors, []); });
console.log(`\n${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
