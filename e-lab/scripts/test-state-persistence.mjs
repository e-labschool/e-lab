#!/usr/bin/env node
// jsdom/Node unit tests for the PART 4/5 persistence helpers:
//   src/lib/sessionState.js (useSessionState + storage helpers)
//   src/lib/frameTime.js (frame-delta clamp / visibility-aware clock)
//   src/lib/authSessionMerge.js (same-user token refresh keeps `user` identity)
//   src/lib/scrollRestore.js (restoreWhenTall)
//   src/lib/draftStore.js is covered in test-rich-text-selection.mjs
// Real-browser tab-switch behaviour is verified by scripts/verify-state-persistence.mjs.
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><body><div id=root></div></body>", { url: "http://localhost/" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.sessionStorage = dom.window.sessionStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
const ss = await import("../src/lib/sessionState.js");
const ft = await import("../src/lib/frameTime.js");
const am = await import("../src/lib/authSessionMerge.js");
const sr = await import("../src/lib/scrollRestore.js");

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.stack || e.message}`); failed++; }
}

console.log("\n== state persistence helpers ==");

await test("sessionKey namespaces and skips empty parts", () => {
  assert.equal(ss.sessionKey("sim", "L1", "", "B2", "controls"), "e-lab:ss:sim:L1:B2:controls");
});

await test("read/write/remove round-trip, corrupt JSON and missing storage fall back", () => {
  const k = ss.sessionKey("t", "a");
  assert.equal(ss.readSession(k, "fb"), "fb");
  assert.equal(ss.writeSession(k, { a: [1, 2] }), true);
  assert.deepEqual(ss.readSession(k, null), { a: [1, 2] });
  sessionStorage.setItem(k, "{bad");
  assert.equal(ss.readSession(k, "fb"), "fb");
  ss.removeSession(k);
  assert.equal(sessionStorage.getItem(k), null);
  assert.equal(ss.readSession(k, "fb", null), "fb", "no storage -> fallback");
  assert.equal(ss.writeSession(k, 1, null), false);
  const throwing = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("quota"); } };
  assert.equal(ss.readSession(k, "fb", throwing), "fb");
  assert.equal(ss.writeSession(k, 1, throwing), false);
});

await test("useSessionState persists, restores after a 'reload' (new mount), validates, and resets", async () => {
  const key = ss.sessionKey("hook", "L", "B");
  sessionStorage.clear();
  let api;
  function Probe({ k = key, validate }) {
    const [v, setV, reset] = ss.useSessionState(k, { mode: "a", n: 1 }, { validate });
    api = { v, setV, reset };
    return null;
  }
  const el = document.createElement("div");
  let root = createRoot(el);
  await act(async () => root.render(React.createElement(Probe)));
  assert.deepEqual(api.v, { mode: "a", n: 1 });
  await act(async () => api.setV({ mode: "b", n: 7 }));
  assert.deepEqual(JSON.parse(sessionStorage.getItem(key)), { mode: "b", n: 7 });
  await act(async () => root.unmount());
  root = createRoot(document.createElement("div"));
  await act(async () => root.render(React.createElement(Probe)));
  assert.deepEqual(api.v, { mode: "b", n: 7 }, "restored on remount");
  await act(async () => root.unmount());
  root = createRoot(document.createElement("div"));
  await act(async () => root.render(React.createElement(Probe, { validate: (x) => x.mode === "zzz" })));
  assert.deepEqual(api.v, { mode: "a", n: 1 }, "invalid stored shape ignored");
  await act(async () => api.reset());
  assert.equal(sessionStorage.getItem(key), null);
  await act(async () => root.unmount());
});

await test("useSessionState with a null key behaves like plain useState (no scope, no storage writes)", async () => {
  sessionStorage.clear();
  let api;
  function Probe() { const [v, setV] = ss.useSessionState(null, 5); api = { v, setV }; return null; }
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(React.createElement(Probe)));
  await act(async () => api.setV(9));
  assert.equal(api.v, 9);
  assert.equal(sessionStorage.length, 0);
  await act(async () => root.unmount());
});

await test("useSessionState loads the new key's value when the key changes (e.g. another lesson)", async () => {
  sessionStorage.clear();
  ss.writeSession("e-lab:ss:k1", "one"); ss.writeSession("e-lab:ss:k2", "two");
  let api;
  function Probe({ k }) { const [v] = ss.useSessionState(k, "init"); api = v; return null; }
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(React.createElement(Probe, { k: "e-lab:ss:k1" })));
  assert.equal(api, "one");
  await act(async () => root.render(React.createElement(Probe, { k: "e-lab:ss:k2" })));
  assert.equal(api, "two");
  assert.equal(sessionStorage.getItem("e-lab:ss:k1"), '"one"', "old key not overwritten by the new value");
  await act(async () => root.unmount());
});

console.log("\n== frame time (tab-return delta clamp) ==");

await test("clampFrameDelta caps a hidden-tab jump and rejects bad values", () => {
  assert.equal(ft.clampFrameDelta(0.016), 0.016);
  assert.equal(ft.clampFrameDelta(60), ft.MAX_FRAME_DT_SECONDS, "60 s in the background -> one 50 ms step");
  assert.equal(ft.clampFrameDelta(-1), 0);
  assert.equal(ft.clampFrameDelta(NaN), 0);
  assert.equal(ft.clampFrameDeltaMs(60000), 50);
  assert.equal(ft.clampFrameDeltaMs(16), 16);
});

await test("createFrameClock: first tick 0, steady ticks pass, huge gap clamped, hidden period resets", () => {
  const clock = ft.createFrameClock({ doc: document });
  assert.equal(clock.tick(1000), 0);
  assert.ok(Math.abs(clock.tick(1016) - 0.016) < 1e-9);
  assert.equal(clock.tick(1016 + 120000), ft.MAX_FRAME_DT_SECONDS);
  Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
  document.dispatchEvent(new window.Event("visibilitychange"));
  Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
  assert.equal(clock.tick(500000), 0, "first frame after a hidden period is 0, not a jump");
  clock.dispose();
});

console.log("\n== auth session merge (same-user events must not change identity) ==");

await test("mergeSameUserSession keeps the user object for token refresh, replaces it for real changes", () => {
  const u = { id: "u1", email: "a@b.c", updated_at: "t1", user_metadata: { n: 1 } };
  const prev = { access_token: "old", user: u };
  const refreshed = { access_token: "new", user: { ...u } };
  const merged = am.mergeSameUserSession(prev, refreshed);
  assert.equal(merged.access_token, "new");
  assert.equal(merged.user, u, "same identity -> effects keyed on `user` do not re-run");
  const changed = { access_token: "new2", user: { ...u, updated_at: "t2" } };
  assert.equal(am.mergeSameUserSession(prev, changed).user, changed.user);
  const other = { access_token: "x", user: { id: "u2" } };
  assert.equal(am.mergeSameUserSession(prev, other), other);
  assert.equal(am.mergeSameUserSession(null, refreshed), refreshed);
  assert.equal(am.sameJson({ a: 1 }, { a: 1 }), true);
  assert.equal(am.sameJson({ a: 1 }, { a: 2 }), false);
});

console.log("\n== scroll restore ==");

await test("restoreWhenTall waits for content height, then scrolls; gives up cleanly; aborts if the user scrolled", async () => {
  const el = { scrollTop: 0, scrollHeight: 500, clientHeight: 400 };
  const cancel = sr.restoreWhenTall(el, 900, 800);
  await new Promise((r) => setTimeout(r, 150));
  el.scrollHeight = 2000; // content finished loading
  await new Promise((r) => setTimeout(r, 250));
  assert.equal(el.scrollTop, 900);
  cancel();
  const short = { scrollTop: 0, scrollHeight: 500, clientHeight: 400 };
  sr.restoreWhenTall(short, 5000, 300);
  await new Promise((r) => setTimeout(r, 500));
  assert.equal(short.scrollTop, 100, "never reachable -> ends at the bottom, no throw");
  const touched = { scrollTop: 0, scrollHeight: 500, clientHeight: 400 };
  sr.restoreWhenTall(touched, 900, 1500);
  await new Promise((r) => setTimeout(r, 120));
  touched.scrollTop = 300; // user scrolled meanwhile
  touched.scrollHeight = 3000;
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(touched.scrollTop, 300, "restoration aborted once the user scrolled");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
