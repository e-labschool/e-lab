#!/usr/bin/env node
// jsdom tests for the shared simulation shell (Task 2 of docs/UNIVERSAL_AUDIT_SPEC.md):
//   node scripts/test-simulation-shell.mjs
// Covers SimulationActions / useFullscreen / InteractiveFrame (the REAL modules) and a static guard over every registered
// simulation. Honest limits: jsdom has no layout, no real Fullscreen API and no browser Escape handling for native
// fullscreen; real fullscreen, layout, overlap and canvas resizing are measured by scripts/audit-simulations.mjs in
// headless Chromium.
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";
import { register } from "node:module";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
for (const k of ["window", "document", "HTMLElement", "HTMLInputElement", "Node", "MouseEvent", "KeyboardEvent", "Event", "MutationObserver", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"]) {
  try { globalThis[k] = dom.window[k]; } catch { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true }); }
}
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = false;
register("./jsx-loader-hooks.mjs", import.meta.url);
register("./image-viewer-loader-hooks.mjs", import.meta.url);

const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const { useRef } = React;
const SimulationActions = (await import("../src/components/interactive-shell/SimulationActions.jsx")).default;
const InteractiveFrame = (await import("../src/components/interactive-shell/InteractiveFrame.jsx")).default;
const { ModeProvider } = await import("../src/context/ModeContext.jsx");
const { SIMULATION_REGISTRY, getSimulationIdForTitle } = await import("../src/data/simulationRegistry.js");
const h = React.createElement;

let passed = 0; let failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ok   ${name}`); passed += 1; } catch (e) { console.log(`  FAIL ${name}\n       ${(e.stack || e.message).split("\n").slice(0, 5).join("\n       ")}`); failed += 1; }
}
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const click = async (el) => { assert.ok(el, "missing element"); el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); await tick(); };
const press = async (key) => { document.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })); await tick(); };
const named = (re) => $$("button").filter((b) => re.test(b.getAttribute("aria-label") || b.textContent));

let mounted = null;
async function mount(el) {
  if (mounted) { mounted.root.unmount(); mounted.host.remove(); mounted = null; await tick(); }
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host); root.render(el); mounted = { root, host }; await tick(60);
}
async function unmount() { if (mounted) { mounted.root.unmount(); mounted.host.remove(); mounted = null; await tick(); } }

// A listener ledger on document (the place the fullscreen hook registers).
const docLedger = { n: 0 };
{
  const add = document.addEventListener.bind(document); const rem = document.removeEventListener.bind(document); const seen = new Set();
  document.addEventListener = (t, f, o) => { if (!seen.has(f)) { seen.add(f); docLedger.n += 1; } return add(t, f, o); };
  document.removeEventListener = (t, f, o) => { if (seen.delete(f)) docLedger.n -= 1; return rem(t, f, o); };
}

function Harness({ simulationId = "ideal-gas-simulation" }) {
  const ref = useRef(null);
  return h("div", { ref, className: "elab-sim", "data-testid": "target" }, h(SimulationActions, { targetRef: ref, simulationId }), h("input", { type: "range", min: 0, max: 100, defaultValue: 40, "data-testid": "slider" }));
}

console.log("SimulationActions: the two controls");
await test("exactly one Fullscreen and one Open in New Tab control, with accessible names and tooltips", async () => {
  await mount(h(Harness));
  const fs1 = named(/^fullscreen$/i); const nt = named(/open in new tab/i);
  assert.equal(fs1.length, 1, "one Fullscreen button"); assert.equal(nt.length, 1, "one Open in New Tab button");
  assert.equal(fs1[0].getAttribute("aria-label"), "Fullscreen"); assert.equal(fs1[0].getAttribute("title"), "Fullscreen");
  assert.equal(nt[0].getAttribute("aria-label"), "Open in New Tab"); assert.equal(nt[0].getAttribute("title"), "Open in New Tab");
  assert.equal($$("button").length, 2, "no extra buttons");
});
await test("Open in New Tab opens /simulation/:id with noopener,noreferrer", async () => {
  await mount(h(Harness, { simulationId: "gas-laws-explorer" }));
  const calls = []; window.open = (...a) => { calls.push(a); return null; };
  await click(named(/new tab/i)[0]);
  assert.deepEqual(calls, [["/simulation/gas-laws-explorer", "_blank", "noopener,noreferrer"]]);
});
await test("without a simulationId only Fullscreen renders (still exactly once)", async () => {
  await mount(h(Harness, { simulationId: null }));
  assert.equal(named(/new tab/i).length, 0); assert.equal(named(/fullscreen/i).length, 1);
});

console.log("useFullscreen: CSS fallback (no element Fullscreen API, e.g. iPhone Safari)");
await test("the control is still shown, enters CSS fullscreen without remounting, and flips to Exit", async () => {
  await mount(h(Harness));
  const slider = $('[data-testid="slider"]'); slider.value = "73";
  assert.equal(typeof $('[data-testid="target"]').requestFullscreen, "undefined", "jsdom has no Fullscreen API");
  await click(named(/^fullscreen$/i)[0]);
  const target = $('[data-testid="target"]');
  assert.equal(target.getAttribute("data-elab-fullscreen"), "css");
  assert.ok(document.documentElement.classList.contains("elab-css-fullscreen"), "page behind stops scrolling");
  assert.equal(named(/exit fullscreen/i).length, 1); assert.equal(named(/^fullscreen$/i).length, 0, "no second Fullscreen button");
  assert.equal($('[data-testid="slider"]'), slider, "the same DOM node (not remounted)"); assert.equal(slider.value, "73", "state kept");
});
await test("Escape exits the CSS fullscreen and restores the page; state is kept", async () => {
  const slider = $('[data-testid="slider"]');
  await press("Escape");
  assert.equal($('[data-testid="target"]').hasAttribute("data-elab-fullscreen"), false);
  assert.ok(!document.documentElement.classList.contains("elab-css-fullscreen"));
  assert.equal(named(/^fullscreen$/i).length, 1); assert.equal($('[data-testid="slider"]'), slider); assert.equal(slider.value, "73");
});
await test("the Exit button also leaves the CSS fullscreen", async () => {
  await click(named(/^fullscreen$/i)[0]); assert.equal($('[data-testid="target"]').getAttribute("data-elab-fullscreen"), "css");
  await click(named(/exit fullscreen/i)[0]); assert.equal($('[data-testid="target"]').hasAttribute("data-elab-fullscreen"), false);
});
await test("Escape does nothing when not in fullscreen; unmounting while fullscreen unlocks the page", async () => {
  await press("Escape"); assert.equal(named(/^fullscreen$/i).length, 1);
  await click(named(/^fullscreen$/i)[0]); assert.ok(document.documentElement.classList.contains("elab-css-fullscreen"));
  await unmount();
  assert.ok(!document.documentElement.classList.contains("elab-css-fullscreen"), "page unlocked after unmount");
});
await test("no listener growth after 30 mount / enter / exit / unmount cycles", async () => {
  await mount(h(Harness)); await unmount();
  const base = docLedger.n;
  for (let i = 0; i < 30; i += 1) { await mount(h(Harness)); await click(named(/^fullscreen$/i)[0]); await click(named(/exit fullscreen/i)[0]); await unmount(); }
  assert.equal(docLedger.n, base, `document listeners ${base} -> ${docLedger.n}`);
});

console.log("useFullscreen: native Fullscreen API");
function installNativeApi({ reject = false } = {}) {
  let fsEl = null; const log = [];
  Object.defineProperty(document, "fullscreenEnabled", { configurable: true, get: () => true });
  Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => fsEl });
  window.HTMLElement.prototype.requestFullscreen = function () { log.push("request"); if (reject) return Promise.reject(new Error("denied")); fsEl = this; document.dispatchEvent(new window.Event("fullscreenchange")); return Promise.resolve(); };
  document.exitFullscreen = () => { log.push("exit"); fsEl = null; document.dispatchEvent(new window.Event("fullscreenchange")); return Promise.resolve(); };
  return { log, browserEscape() { fsEl = null; document.dispatchEvent(new window.Event("fullscreenchange")); } };
}
function removeNativeApi() {
  delete document.fullscreenEnabled; delete document.fullscreenElement; delete window.HTMLElement.prototype.requestFullscreen; delete document.exitFullscreen;
}
await test("uses requestFullscreen on the frame element, reflects the real fullscreenchange (incl. the browser's own Escape)", async () => {
  const api = installNativeApi(); await mount(h(Harness));
  await click(named(/^fullscreen$/i)[0]);
  assert.deepEqual(api.log, ["request"]); assert.equal($('[data-testid="target"]').getAttribute("data-elab-fullscreen"), "native");
  assert.equal(named(/exit fullscreen/i).length, 1); assert.ok(!document.documentElement.classList.contains("elab-css-fullscreen"), "no CSS lock for native");
  api.browserEscape(); await tick();
  assert.equal(named(/^fullscreen$/i).length, 1, "state follows the browser exit"); assert.equal($('[data-testid="target"]').hasAttribute("data-elab-fullscreen"), false);
  await click(named(/^fullscreen$/i)[0]); await click(named(/exit fullscreen/i)[0]);
  assert.deepEqual(api.log, ["request", "request", "exit"]); removeNativeApi();
});
await test("falls back to the CSS fullscreen when requestFullscreen is rejected", async () => {
  installNativeApi({ reject: true }); await mount(h(Harness));
  await click(named(/^fullscreen$/i)[0]); await tick(30);
  assert.equal($('[data-testid="target"]').getAttribute("data-elab-fullscreen"), "css"); removeNativeApi();
  await press("Escape"); assert.equal($('[data-testid="target"]').hasAttribute("data-elab-fullscreen"), false);
});

console.log("InteractiveFrame: one pair of controls in every presentation");
const frame = (props, children = h("p", null, "content")) => h(ModeProvider, null, h(InteractiveFrame, props, children));
await test("embedded compact (Learn block): actions only, once", async () => {
  await mount(frame({ title: "Ideal Gas Simulation", compact: true }));
  assert.equal(named(/^fullscreen$/i).length, 1); assert.equal(named(/new tab/i).length, 1); assert.equal($$("h2").length, 0, "no title header embedded");
});
await test("standalone: full header, controls exactly once", async () => {
  await mount(frame({ title: "Ideal Gas Simulation", standalone: true }));
  assert.equal(named(/^fullscreen$/i).length, 1); assert.equal(named(/new tab/i).length, 1); assert.equal($$("h2").length, 1);
});
await test("CSS fullscreen turns a compact frame into the full-header viewport frame without remounting its content", async () => {
  await mount(frame({ title: "Ideal Gas Simulation", compact: true }, h("input", { "data-testid": "kept", defaultValue: "x" })));
  const kept = $('[data-testid="kept"]'); kept.value = "typed";
  await click(named(/^fullscreen$/i)[0]);
  assert.equal($(".elab-sim").getAttribute("data-elab-fullscreen"), "css"); assert.equal($$("h2").length, 1, "title header shown in fullscreen");
  assert.equal(named(/exit fullscreen/i).length, 1); assert.equal(named(/new tab/i).length, 1);
  assert.equal($('[data-testid="kept"]'), kept); assert.equal(kept.value, "typed");
  await press("Escape"); assert.equal($$("h2").length, 0); assert.equal($('[data-testid="kept"]'), kept);
});
await test("an explicit simulationId gives Open in New Tab to an engine whose on-screen title differs from the registry label", async () => {
  await mount(frame({ title: "Particle Model of Solids, Liquids & Gases", compact: true, simulationId: "particle-model-visualizer" }));
  assert.equal(named(/new tab/i).length, 1);
  await mount(frame({ title: "Some title that is not registered", compact: true }));
  assert.equal(named(/new tab/i).length, 0, "no id -> no target (guarded by the registry test below)");
});
await unmount();

console.log("Registry guard: every registered simulation is wrapped by the shell");
const componentSrc = fs.readFileSync(new URL("../src/data/simulationEngineComponents.js", import.meta.url), "utf8");
const entries = [...componentSrc.matchAll(/"([^"]+)": lazy\(\(\) => import\("\.\.\/([^"]+)"\)/g)].map((m) => ({ id: m[1], file: m[2] }));
await test("component map and registry list the same simulations", () => {
  assert.deepEqual(entries.map((e) => e.id).sort(), Object.keys(SIMULATION_REGISTRY).sort());
});
for (const { id, file } of entries) {
  await test(`${id}: entry file renders exactly one InteractiveFrame, never bypasses it when compact, resolves its New Tab id`, () => {
    const src = fs.readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
    const frames = [...src.matchAll(/<InteractiveFrame\b([\s\S]*?)>/g)];
    assert.equal(frames.length, 1, `${frames.length} <InteractiveFrame> in ${file}`);
    assert.ok(!/if \(compact\) return body;?/.test(src), "`if (compact) return body` skips the shell (no Fullscreen / New Tab in Learn lessons)");
    assert.ok(/compact=\{compact\}/.test(frames[0][1]), "the frame must receive compact");
    assert.ok(/standalone=\{standalone\}/.test(frames[0][1]), "the frame must receive standalone");
    const explicit = frames[0][1].match(/simulationId="([^"]+)"/);
    if (explicit) assert.equal(explicit[1], id);
    else {
      const t = frames[0][1].match(/title=(?:"([^"]*)"|\{("(?:[^"\\]|\\.)*")\})/);
      assert.ok(t, "frame title not found");
      assert.ok(!(t[1] && /\\u[0-9a-f]{4}/i.test(t[1])), "a JSX attribute string does not process \\u escapes; use title={\"...\"}");
      const title = t[1] ?? JSON.parse(t[2]);
      assert.equal(getSimulationIdForTitle(title), id, `title "${title}" does not resolve to ${id}; pass simulationId="${id}"`);
    }
  });
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
