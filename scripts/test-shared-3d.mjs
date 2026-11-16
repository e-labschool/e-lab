#!/usr/bin/env node
// Tests for the shared 3D module (src/engines/shared-3d):  node scripts/test-shared-3d.mjs
// Pure: element colour table agreement across VSEPR / Bonding / IMF, keyboard camera maths.
// jsdom: GuardedFrame (no-WebGL notice, focus + key help, WebGL context lost / restored handling with a stubbed WebGL probe).
// Honest limits: a real GPU context loss is NOT exercised (the lost / restored events are dispatched by hand).
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { register } from "node:module";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
for (const k of ["window", "document", "HTMLElement", "Node", "MouseEvent", "KeyboardEvent", "Event", "MutationObserver", "getComputedStyle"]) {
  try { globalThis[k] = dom.window[k]; } catch { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true }); }
}
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.IS_REACT_ACT_ENVIRONMENT = false;
register("./jsx-loader-hooks.mjs", import.meta.url);
register("./image-viewer-loader-hooks.mjs", import.meta.url);

const React = (await import("react")).default; const { createRoot } = await import("react-dom/client"); const h = React.createElement;
const S = await import("../src/engines/shared-3d/elementStyle.js");
const K = await import("../src/engines/shared-3d/stageKeys.js");
const GuardedFrame = (await import("../src/engines/shared-3d/GuardedFrame.jsx")).default;
const V = (await import("../src/engines/vsepr-explorer-3d/model/elements.js")).ELEMENTS;
const B = await import("../src/engines/bonding-visualizer/model/elements.js");
const I = (await import("../src/engines/intermolecular-forces-visualiser/model/molecules.js")).ELEM;

let passed = 0; let failed = 0;
async function test(name, fn) { try { await fn(); console.log(`  ok   ${name}`); passed += 1; } catch (e) { console.log(`  FAIL ${name}\n       ${(e.stack || e.message).split("\n").slice(0, 5).join("\n       ")}`); failed += 1; } }
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const $ = (s) => document.querySelector(s);

console.log("Colour table (BS-18)");
await test("one element colour per symbol: VSEPR, Bonding and IMF all read the shared table", () => {
  const shared = ["H", "C", "N", "O", "F", "S", "Cl", "Br", "P", "I"];
  for (const el of shared) {
    const c = S.elementColor(el); assert.match(c, /^#[0-9a-f]{6}$/i, el);
    assert.equal(V[el]?.color, c, `VSEPR ${el}`); if (B.getBondingElement(el)) assert.equal(B.getBondingElement(el).color, c, `Bonding ${el}`); if (I[el]) assert.equal(I[el].color, c, `IMF ${el}`);
  }
});
await test("every element has a label colour with readable contrast (WCAG ratio >= 4.5)", () => {
  const lum = (hex) => { const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  for (const [el, st] of Object.entries(S.ELEMENT_STYLE)) { const a = lum(st.color); const b = lum(st.text); const r = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); assert.ok(r >= 4.5, `${el} contrast ${r.toFixed(2)}`); }
});

console.log("Keyboard camera");
await test("arrows orbit, +/- zoom, 0 resets; modifiers are ignored; Shift is a finer step", () => {
  const ev = (key, o = {}) => ({ key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...o });
  assert.equal(K.cameraKeyAction(ev("ArrowLeft")).type, "orbit"); assert.ok(K.cameraKeyAction(ev("ArrowLeft")).az < 0); assert.ok(K.cameraKeyAction(ev("ArrowRight")).az > 0);
  assert.ok(K.cameraKeyAction(ev("ArrowUp")).pol < 0); assert.ok(K.cameraKeyAction(ev("ArrowDown")).pol > 0);
  assert.ok(K.cameraKeyAction(ev("+")).factor < 1); assert.ok(K.cameraKeyAction(ev("-")).factor > 1); assert.equal(K.cameraKeyAction(ev("0")).type, "reset");
  assert.equal(K.cameraKeyAction(ev("ArrowLeft", { ctrlKey: true })), null); assert.equal(K.cameraKeyAction(ev("a")), null);
  assert.ok(Math.abs(K.cameraKeyAction(ev("ArrowRight", { shiftKey: true })).az) < Math.abs(K.cameraKeyAction(ev("ArrowRight")).az));
});
await test("orbitPosition keeps the distance to the target and never passes over the poles", () => {
  const p0 = [3, 2, 5]; const t = [0, 0, 0]; const d = (p) => Math.hypot(p[0] - t[0], p[1] - t[1], p[2] - t[2]);
  let p = p0; for (let i = 0; i < 40; i += 1) p = K.orbitPosition(p, t, 0.2, -0.3); assert.ok(Math.abs(d(p) - d(p0)) < 1e-9);
  const top = K.orbitPosition([0, 5, 0.01], t, 0, -3); assert.ok(Math.abs(top[0]) < 1 && top[1] < 5 && top[1] > 4.5, "stays below the pole");
});

console.log("GuardedFrame");
const mount = async (el) => { document.body.innerHTML = '<div id="r"></div>'; const root = createRoot($("#r")); root.render(el); await tick(60); return root; };
await test("no WebGL: a clear notice replaces the stage, no key help, not focusable", async () => {
  dom.window.HTMLCanvasElement.prototype.getContext = () => null;
  const r = await mount(h(GuardedFrame, { testId: "frame", ariaLabel: "x", fallback: "Text alternative here.", render: () => h("div", { "data-testid": "child" }) }));
  assert.ok($('[data-testid="webgl-fallback"]')); assert.match($('[data-testid="webgl-fallback"]').textContent, /3D view unavailable on this device[\s\S]*Text alternative here/);
  assert.equal($('[data-testid="child"]'), null); assert.equal($('[data-testid="stage-keyhint"]'), null); assert.equal($('[data-testid="frame"]').getAttribute("tabindex"), "-1"); r.unmount();
});
await test("with WebGL: focusable application region with key help; context lost shows the notice and is preventDefault-ed; restored remounts the canvas (new key)", async () => {
  dom.window.WebGLRenderingContext = function WebGLRenderingContext() {}; globalThis.window.WebGLRenderingContext = dom.window.WebGLRenderingContext;
  dom.window.HTMLCanvasElement.prototype.getContext = () => ({ getExtension: () => null });
  const keys = []; const r = await mount(h(GuardedFrame, { testId: "frame", ariaLabel: "A 3D stage", render: ({ canvasKey, camRef }) => { keys.push(canvasKey); camRef.current = { orbit() {}, zoom() {}, reset() {} }; return h("div", { "data-testid": "child", "data-key": canvasKey }); } }));
  const f = $('[data-testid="frame"]'); assert.equal(f.getAttribute("tabindex"), "0"); assert.equal(f.getAttribute("role"), "application"); assert.ok(f.hasAttribute("data-s3d-stage"));
  assert.match($('[data-testid="stage-keyhint"]').textContent, /arrow keys rotate.*zoom/); assert.equal($('[data-testid="child"]').getAttribute("data-key"), "0");
  const lost = new window.Event("webglcontextlost", { bubbles: false, cancelable: true }); $('[data-testid="child"]').dispatchEvent(lost); await tick();
  assert.equal(lost.defaultPrevented, true, "preventDefault lets the browser restore the context"); assert.ok($('[data-testid="webgl-context-lost"]'));
  $('[data-testid="child"]').dispatchEvent(new window.Event("webglcontextrestored", { bubbles: false })); await tick();
  assert.equal($('[data-testid="webgl-context-lost"]'), null); assert.equal($('[data-testid="child"]').getAttribute("data-key"), "1", "canvas remounted"); r.unmount();
});
await test("keyboard on the frame is handled (arrows do not bubble)", async () => {
  let called = 0; const r = await mount(h(GuardedFrame, { testId: "frame", ariaLabel: "A 3D stage", render: ({ camRef }) => { camRef.current = { orbit() { called += 1; }, zoom() {}, reset() {} }; return h("div"); } }));
  const e = new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }); $('[data-testid="frame"]').dispatchEvent(e); await tick(); assert.equal(called, 1); assert.equal(e.defaultPrevented, true); r.unmount();
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
