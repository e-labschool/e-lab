#!/usr/bin/env node
// jsdom UI tests for the IR Spectroscopy workspace (the IR tab of the Spectroscopy Simulation Lab):  node scripts/test-ir-ui.mjs
// Renders the REAL SpectroscopyStudio into jsdom (no layout, no WebGL: the molecule viewers use their SVG fallback).
// Honest limits: 3D rendering, SVG geometry, clipping, overflow, animation smoothness and frame timing are NOT checked here
// (see scripts/verify-ir-spectroscopy.mjs in headless Chromium); this checks navigation, state wiring, controls, texts and the science messages.
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

const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const Studio = (await import("../src/engines/spectroscopy-studio/SpectroscopyStudio.jsx")).default;
const { COMPOUNDS } = await import("../src/engines/spectroscopy-studio/ir/data/compounds.js");
const { SPEC_GROUPS } = await import("../src/engines/spectroscopy-studio/ir/physics/functionalGroups.js");
const { makeRound, evaluateRound } = await import("../src/engines/spectroscopy-studio/ir/physics/challenge.js");
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
  await click(T("tech-ir")); await until(() => $(T("stage-stepper"))?.getAttribute("data-count") === "9", 3000, "IR stepper"); await tick(100);
}

console.log("IR tab: live, nine stages");
await mount();
await test("the IR tab is a live workspace (no placeholder) and NMR is still there", async () => {
  assert.ok(!$(T("dev-ir")), "placeholder shown"); assert.equal($(T("stage-box")).getAttribute("data-technique"), "ir");
  assert.match(txt(".sd-subtitle"), /IR Spectroscopy · stage 1 of 9/);
});
await test("stepper: nine stages, Previous disabled on 1, Next on 9, Next/Previous/direct jump", async () => {
  for (let i = 1; i <= 9; i += 1) assert.ok($(T(`step-${i}`)), `step-${i}`);
  assert.equal($$(`${T("stage-stepper")} li`).length, 9); assert.ok($(T("step-prev")).disabled);
  await click(T("step-next")); assert.equal($(T("step-2")).getAttribute("aria-current"), "step"); assert.match(txt(".sd-subtitle"), /stage 2 of 9/);
  await click(T("step-prev")); assert.equal($(T("step-1")).getAttribute("aria-current"), "step");
  for (const i of [9, 4, 7, 2, 1]) { await go(i); assert.equal($(T(`step-${i}`)).getAttribute("aria-current"), "step"); }
  await go(9); assert.ok($(T("step-next")).disabled); await go(1);
});
await test("every stage has a title, a Teacher disclosure and only that stage's view", async () => {
  for (let i = 1; i <= 9; i += 1) { await go(i); assert.ok(txt(T("step-title")).length > 5, `title ${i}`); assert.ok($(T("teacher-details")), `teacher ${i}`); assert.equal($$(T("step-view-" + i)).length, 1); assert.match(txt(T("step-panel")), new RegExp(`Step ${i} of 9`)); }
});
await test("a single IR tab: no sub-pages (one stage view at a time, one workspace)", async () => { assert.equal($$(T("spectroscopy-workspace")).length, 1); assert.equal($$("[data-testid^='step-view-']").length, 1); });

console.log("Stages 1-2: vibrations and their types");
await test("stage 1: HCl first, switch to H2O and CO2 changes the molecule, shows the molecule viewer (SVG fallback) and the levels inset", async () => {
  await go(1); assert.equal($(T("mol-stage")).getAttribute("data-mol"), "hcl"); assert.ok($(T("mol-svg")), "SVG fallback"); assert.ok($(T("levels-inset")));
  assert.match(txt(T("vib-caption")), /2\s?886/);
  await click(T("s1-mol-h2o")); assert.equal($(T("mol-stage")).getAttribute("data-mol"), "h2o");
  await click(T("s1-mol-co2")); assert.equal($(T("mol-stage")).getAttribute("data-mol"), "co2");
  assert.match(txt(T("step-panel")), /quantised/i);
  await click(T("s1-mol-hcl"));
});
await test("stage 2: symmetric / asymmetric / bending for H2O and CO2 with their literature wavenumbers", async () => {
  await go(2);
  const expect = { h2o: { sym: "3\\s?657", asym: "3\\s?756", bend: "1\\s?595" }, co2: { sym: "1\\s?388", asym: "2\\s?349", bend: "667" } };
  for (const [mol, t] of Object.entries(expect)) { await click(T(`s2-mol-${mol}`)); for (const [type, wn] of Object.entries(t)) { await click(T(`s2-type-${type}`)); assert.equal($(T("mol-stage")).getAttribute("data-mol"), mol); assert.match(txt(T("vib-caption")), new RegExp(wn)); } }
});

console.log("Stage 3: interaction with IR radiation");
await test("stage 3: slider, photon equation, state follows the wavenumber", async () => {
  await go(3); await click(T("s3-mol-hcl"));
  assert.ok($(T("photon-eq")) && /ΔE\s*=\s*hν/.test(txt(T("photon-eq"))), "ΔE = hν shown");
  await setRange("input[type=range]", 4400 - 2886); assert.equal($(T("absorb-view")).getAttribute("data-state"), "absorbed"); assert.match(txt(T("absorb-head")), /absorbed/i);
  await setRange("input[type=range]", 4400 - 1000); assert.equal($(T("absorb-view")).getAttribute("data-state"), "off"); assert.match(txt(T("absorb-head")), /little or no/i);
  assert.ok($(T("levels-pane")) && $(T("level-v0")) && $(T("level-v1")));
});
await test("stage 3: CO2 symmetric stretch matches in frequency but is NOT absorbed (no dipole change)", async () => {
  await click(T("s3-mol-co2")); await click(T("s3-mode-sym")); await setRange("input[type=range]", 4400 - 1388);
  assert.equal($(T("absorb-view")).getAttribute("data-state"), "match-inactive"); assert.match(txt(T("absorb-head")), /frequency matches, but no dipole change/i); assert.match(txt(T("absorb-head")), /not absorbed/i);
  assert.equal($(T("s3-activity")).getAttribute("data-active"), "0"); assert.ok(txt(T("s3-reason")).length > 20, "reason shown");
  assert.ok(Number($(T("absorb-view")).getAttribute("data-absorption")) < 0.001, "absorption must be zero");
  await click(T("s3-mode-asym")); await setRange("input[type=range]", 4400 - 2349); assert.equal($(T("absorb-view")).getAttribute("data-state"), "absorbed");
});

console.log("Stage 4: explorer");
await test("stage 4: the five molecules, every mode shows IR active / inactive with a reason", async () => {
  await go(4);
  for (const mol of ["h2o", "co2", "hcl", "ch4", "ethanol"]) {
    await click(T(`s4-mol-${mol}`)); assert.equal($(T("mol-stage")).getAttribute("data-mol"), mol);
    const modes = $$(`${T("s4-mode")} button`); assert.ok(modes.length >= (mol === "hcl" ? 1 : 3), `${mol} modes`);
    for (const m of modes) { await click(m); assert.ok($(T("activity-pill")), `${mol} pill`); assert.match(txt(T("activity-pill")), /IR (in)?active/); assert.ok(txt(T("s4-reason")).length > 15, `${mol} reason`); }
  }
});
await test("stage 4: CO2 symmetric stretch inactive, asymmetric active; ethanol is labelled a simplified normal-mode representation", async () => {
  await click(T("s4-mol-co2")); await click(T("s4-mode-sym")); assert.equal($(T("activity-pill")).getAttribute("data-active"), "0");
  await click(T("s4-mode-asym")); assert.equal($(T("activity-pill")).getAttribute("data-active"), "1");
  await click(T("s4-mol-ethanol")); assert.match(txt(T("simplified-note")), /simplified normal-mode representation/i);
  await click(T("s4-mol-h2o")); assert.ok(!$(T("simplified-note")));
});

console.log("Stage 5: FTIR");
await test("stage 5: six parts in order, interferogram + Fourier transform, no 'scans one frequency' claim", async () => {
  await go(5);
  assert.equal($$(`${T("ftir-view")} ~ *, ${T("step-strip")} [data-testid^='op-dot-']`).length >= 6, true);
  assert.match(txt(T("ftir-statement")), /does not scan one frequency at a time/i); assert.match(txt(T("ftir-statement")), /interferogram/i); assert.match(txt(T("ftir-label")), /illustrative/i);
  const names = []; for (let i = 0; i < 6; i += 1) { await click(T(`op-dot-${i}`)); names.push(txt(T("ftir-part"))); assert.equal($(T("ftir-view")).getAttribute("data-op"), String(i)); }
  assert.match(names.join("|"), /IR source.*Interferometer.*Sample.*Detector.*Computer.*IR spectrum/);
  await click(T("op-dot-0")); await click(T("next-stage")); assert.equal($(T("ftir-view")).getAttribute("data-op"), "1");
});

console.log("Stage 6: building a spectrum");
await test("stage 6: axis 4000 -> 400 with 100% on top, three linked events, a band per active mode", async () => {
  await go(6);
  const svg = $(T("ir-spectrum")); assert.equal(svg.getAttribute("data-xleft"), "4000"); assert.equal(svg.getAttribute("data-xright"), "400"); assert.equal(svg.getAttribute("data-ytop"), "100");
  assert.ok($(T("sync-vib")) && $(T("sync-abs")) && $(T("sync-band")), "three-way sync");
  await click(T("s6-mol-co2")); await click(T("s6-mode-sym")); assert.match(txt(T("sync-abs")), /none \(IR inactive\)/); assert.match(txt(T("sync-band")), /no band/); assert.equal($(T("s6-activity")).getAttribute("data-active"), "0");
  await click(T("s6-mode-asym")); assert.match(txt(T("sync-band")), /band appears/); assert.match(txt(T("s6-text")), /2\s?349/);
  await click(T("s6-mol-h2o")); assert.ok(Number($(T("build-view")).getAttribute("data-bands")) >= 0);
});
await test("stage 6: the spectrum is completed after a while and all three H2O bands are clickable", async () => {
  await click(T("s6-mol-h2o")); await until(() => $(T("build-view")).getAttribute("data-finished") === "1", 12000, "build finished");
  assert.equal($$(`${T("ir-spectrum")} [data-testid^='band-'][role=button]`).length, 3); assert.equal($(T("build-view")).getAttribute("data-bands"), "3");
  await click(`${T("ir-spectrum")} [data-testid='band-0']`); assert.match(txt(T("s6-text")), /cm⁻¹/);
});

console.log("Stage 7: functional groups");
await test("stage 7: the table is exactly the specification's, labelled representative", async () => {
  await go(7);
  const spec = { "oh-alc": "3200–3600, broad", "oh-acid": "2500–3300, very broad", nh: "3300–3500", ch: "2850–3000", cn: "2210–2260", cdo: "1650–1750", cdc: "1620–1680" };
  assert.equal(SPEC_GROUPS.length, 7);
  for (const [id, r] of Object.entries(spec)) assert.equal(txt(T(`range-${id}`)), r, id);
  assert.match(txt(T("range-caveat")), /representative/i); assert.match(txt(T("range-caveat")), /structure and environment/i);
});
await test("stage 7: clicking a row or a band highlights the group, shows wavenumber and assignment, animates the vibration", async () => {
  for (const g of SPEC_GROUPS) {
    await click(T(`row-${g.id}`)); assert.equal($(T("groups-view")).getAttribute("data-group"), g.id);
    assert.ok($(T("mol-stage")).getAttribute("data-highlight").length > 0, `${g.id} highlight`); assert.ok($(T("mol-stage")).getAttribute("data-mode").startsWith("s7-"), `${g.id} animated`);
    assert.match(txt(T("group-caption")), new RegExp(String(Math.round(g.bands[0].nu)).replace(/(\d)(\d{3})/, "$1\\s?$2"))); assert.ok(txt(T("group-info")).includes("stretch"), `${g.id} assignment`);
  }
  await click(`${T("ir-spectrum")} [data-testid='curve-hit-cdc']`); assert.equal($(T("groups-view")).getAttribute("data-group"), "cdc");
  await click(`${T("ir-spectrum")} [data-testid='curve-hit-nh']`); assert.equal($(T("groups-view")).getAttribute("data-group"), "nh");
  assert.equal($(T("groups-view")).getAttribute("data-molecule"), "methylamine");
});

console.log("Stage 8: guided interpretation");
await test("stage 8: the five compounds, representative label, fingerprint toggle, no single-band claim", async () => {
  await go(8);
  for (const id of ["ethanol", "ethanal", "propanone", "ethanoic-acid", "ethyl-ethanoate"]) { await click(T(`s8-compound-${id}`)); assert.equal($(T("interp-view")).getAttribute("data-compound"), id); assert.equal($$(`${T("ir-spectrum")} [role=button]`).length, COMPOUNDS[id].bands.length, `${id} clickable bands`); }
  assert.match(txt(T("interp-caption")), /not an experimental spectrum/i); assert.match(txt(T("s8-caveat")), /no single band identifies a compound/i);
  assert.ok(!$(T("fingerprint-shade"))); await click(T("fingerprint-toggle")); assert.ok($(T("fingerprint-shade"))); assert.match(txt(T("s8-caveat")), /fingerprint|unique to each compound/i);
  await click(T("fingerprint-toggle"));
});
await test("stage 8: click a band, choose a group, get feedback; structure highlight and animation after answering", async () => {
  await click(T("s8-compound-propanone"));
  const i = COMPOUNDS.propanone.bands.findIndex((b) => b.group === "cdo");
  await click(`${T("ir-spectrum")} [data-testid='band-${i}']`); assert.ok($(T("s8-picks")));
  assert.equal($(T("interp-view")).getAttribute("data-answered"), "0"); assert.equal($(T("mol-stage")).getAttribute("data-highlight"), "");
  await click(T("pick-cdo")); assert.equal($(T("s8-feedback")).getAttribute("data-correct"), "1"); assert.ok($(T("mol-stage")).getAttribute("data-highlight").length > 0); assert.ok($(T("mol-stage")).getAttribute("data-mode").startsWith("s8-"));
  assert.match(txt(T("s8-feedback")), /C=O stretch/);
  const k = COMPOUNDS.propanone.bands.findIndex((b) => b.group === null && b.nu > 1200 && b.nu < 1250);
  await click(`${T("ir-spectrum")} [data-testid='band-${k}']`); await click(T("pick-co")); assert.equal($(T("s8-feedback")).getAttribute("data-correct"), "0"); assert.match(txt(T("s8-feedback")), /no such bond|no C–O|skeletal/i);
  await click(T("pick-none")); assert.equal($(T("s8-feedback")).getAttribute("data-correct"), "1");
});
await test("stage 8: ethanol O-H band (ambiguous with N-H by range) is answered by width", async () => {
  await click(T("s8-compound-ethanol")); await click(`${T("ir-spectrum")} [data-testid='band-0']`);
  assert.ok($(T("pick-oh-alc")) && $(T("pick-nh")), "both candidate groups offered"); await click(T("pick-nh")); assert.equal($(T("s8-feedback")).getAttribute("data-correct"), "0"); await click(T("pick-oh-alc")); assert.equal($(T("s8-feedback")).getAttribute("data-correct"), "1");
});

console.log("Stage 9: unknown compound challenge");
await test("stage 9: unknown spectrum, 3-4 candidates, nothing revealed up front, no answer leak", async () => {
  await go(9);
  const r = makeRound(1, 0); const ev = evaluateRound(r); const best = ev.best; const bestName = COMPOUNDS[best].name;
  const n = $$(`${T("candidates")} [role=radio]`).length; assert.ok(n >= 3 && n <= 4, `${n} candidates`);
  assert.equal($(T("unknown-view")).getAttribute("data-reveal"), "0"); assert.ok(!$(T("clue-1")) && !$(T("clue-2")) && !$(T("clue-3")));
  assert.ok($(T("reveal-next")).disabled, "no clue before a choice");
  // the DOM must not carry the answer: the only attribute naming a compound is the student's own choice
  const dom = $(T("unknown-view")).outerHTML + $(T("ir-spectrum")).outerHTML; assert.ok(!/data-compound|data-answer|data-best/.test(dom), "no answer attribute"); assert.ok(!new RegExp(`aria-label="[^"]*${bestName}`).test($(T("ir-spectrum")).outerHTML), "spectrum label does not name the compound");
  assert.equal(txt(T("clues")), "", "no clue text yet");
});
await test("stage 9: progressive feedback 1 -> 2 -> 3, the verdict only at the end, others explained", async () => {
  const r = makeRound(1, 0); const ev = evaluateRound(r); const wrong = r.candidates.find((c) => c !== ev.best);
  await click(T(`cand-${wrong}`)); assert.ok(!$(T("reveal-next")).disabled);
  await click(T("reveal-next")); assert.ok($(T("clue-1")) && !$(T("clue-2")) && !$(T("clue-3"))); assert.match(txt(T("clue-1")), /Groups present/); assert.ok(!txt(T("clues")).includes(`Most consistent: ${COMPOUNDS[ev.best].name}`));
  await click(T("reveal-next")); assert.ok($(T("clue-2")) && !$(T("clue-3"))); assert.match(txt(T("clue-2")), /Missing from the spectrum/);
  await click(T("reveal-next")); assert.ok($(T("clue-3"))); assert.match(txt(T("clue-3")), new RegExp(`Most consistent: ${COMPOUNDS[ev.best].name}`)); assert.equal($(T("clue-3")).getAttribute("data-correct"), "0");
  assert.equal($$(`${T("clue-3")} li`).length, r.candidates.length - 1, "every other option explained"); assert.match(txt(T("clue-3")), /less suitable/); assert.ok($(T("reveal-next")).disabled);
});
await test("stage 9: choosing the right compound is confirmed; Next unknown gives a new, different round", async () => {
  const r = makeRound(1, 0); const ev = evaluateRound(r);
  await click(T(`cand-${ev.best}`)); assert.equal($(T("clue-3")).getAttribute("data-correct"), "1");
  await click(T("next-unknown")); assert.equal($(T("unknown-view")).getAttribute("data-round"), "1"); assert.equal($(T("unknown-view")).getAttribute("data-reveal"), "0"); assert.ok(!$(T("clue-1")));
  const r1 = makeRound(1, 1); assert.deepEqual($$(`${T("candidates")} [role=radio]`).map((b) => b.getAttribute("data-testid").replace("cand-", "")), r1.candidates, "candidate order is the seeded, shuffled one");
});

console.log("State and neighbours");
await test("the IR experiment survives a visit to NMR and back; NMR is untouched (six steps)", async () => {
  await go(7); await click(T("row-nh")); await click(T("tech-nmr")); await until(() => $(T("stage-stepper"))?.getAttribute("data-count") === "6", 3000, "NMR stepper");
  assert.equal($$(`${T("stage-stepper")} li`).length, 6); assert.match(txt(".sd-subtitle"), /¹H NMR · step/);
  await click(T("tech-ir")); await until(() => $(T("stage-stepper"))?.getAttribute("data-count") === "9", 3000, "IR stepper"); assert.equal($(T("step-7")).getAttribute("aria-current"), "step"); assert.equal($(T("groups-view")).getAttribute("data-group"), "nh");
});
await test("Reset restores the IR defaults but keeps the stage; MS and Structure remain placeholders", async () => {
  await click(T("row-cdc")); await click(".sd-btn[aria-label*='Reset'], button[aria-label*='Reset' i]"); await tick(150);
  assert.equal($(T("groups-view")).getAttribute("data-group"), "cdo"); assert.equal($(T("step-7")).getAttribute("aria-current"), "step");
  await click(T("tech-ms")); assert.ok($(T("stage-box")).getAttribute("data-technique") === "ms" && !$(T("dev-ms"))); await click(T("tech-structure")); assert.ok($(T("dev-structure"))); await click(T("tech-ir"));
});
await test("playback bar: Play/Pause, Replay and speed are present for IR", async () => {
  assert.ok($(T("btn-play-pause")) && $(T("btn-reset-playback")) && $(T("speed-switch"))); await click(T("btn-play-pause")); assert.equal($(T("playback-bar")).getAttribute("data-paused"), "1"); await click(T("btn-play-pause")); assert.equal($(T("playback-bar")).getAttribute("data-paused"), "0");
  assert.match(txt(T("time-note")), /not real time/i);
});
await test("the persisted slice round-trips through sanitize (restored sessions are repaired, never trusted)", async () => {
  const { sanitize, pickPersisted, createIrStore, DEFAULTS } = await import("../src/engines/spectroscopy-studio/ir/state/irState.js");
  const { modesOf } = await import("../src/engines/spectroscopy-studio/ir/state/IrContext.jsx");
  const st = createIrStore({ stage: 8, s8: { compound: "ethanal", band: 2, pick: "cdo", fingerprint: true } }, modesOf).getState();
  assert.deepEqual(sanitize(JSON.parse(JSON.stringify(pickPersisted(st))), modesOf), pickPersisted(st));
  const bad = sanitize({ stage: 99, s3: { mol: "xx", mode: "nope", nu: 1e9 }, s9: { reveal: 17, choice: 5 } }, modesOf);
  assert.equal(bad.stage, 9); assert.equal(bad.s3.mol, DEFAULTS.s3.mol); assert.ok(bad.s3.nu <= 4000); assert.equal(bad.s9.reveal, 3); assert.equal(bad.s9.choice, null);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (mounted) { mounted.root.unmount(); }
process.exit(failed ? 1 : 0);
