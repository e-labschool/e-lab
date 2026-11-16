#!/usr/bin/env node
// jsdom tests for the rebuilt Electron Configuration Explorer: no answer leak, Pauli/Hund refusals, Check gating and explanations,
// ions, compact picker, combobox search with Enter. Geometry/contrast are checked in verify-ec-explorer.mjs (Chromium).
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { register } from "node:module";

const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
for (const k of ["window", "document", "HTMLElement", "HTMLInputElement", "Node", "MouseEvent", "KeyboardEvent", "Event", "XMLSerializer", "MutationObserver", "getComputedStyle"]) {
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
const { default: Explorer } = await import("../src/engines/electron-configuration/ElectronConfigurationExplorer.jsx");
const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const T = (id) => `[data-testid="${id}"]`;
const click = async (sel) => { const el = typeof sel === "string" ? $(sel) : sel; el.dispatchEvent(new MouseEvent("click", { bubbles: true })); await wait(); };
const put = async (key, i, tool = "up") => { await click(T(`ec-tool-${tool}`)); await click(`[data-orbital="${key}:${i}"]`); };
async function fill(occ) {
  for (const [key, count] of Object.entries(occ)) {
    const l = "spdf".indexOf(key[1]); const k = [1, 3, 5, 7][l];
    for (let i = 0; i < count; i += 1) await put(key, i < k ? i : i - k, i < k ? "up" : "down");
  }
}
let passed = 0; let failed = 0; const pending = [];
const test = (name, fn) => pending.push({ name, fn });

const root = createRoot(document.getElementById("root"));
root.render(React.createElement(ModeProvider, null, React.createElement(Explorer, { standalone: true })));
await wait(200);

test("first screen: no 118-cell wall; species bar + builder; the answer is not shown", () => {
  assert.equal($$("[data-z]").length, 0);
  assert.ok($(T("ec-builder")));
  assert.match($(T("ec-species")).textContent, /Iron/);
  assert.equal($(T("ec-answer")), null);
  assert.equal($(T("ec-success")), null);
  assert.doesNotMatch(document.body.textContent, /3d⁶ 4s²|3d6 4s2/); // the configuration never appears before the student tries
  // all candidate subshells are offered, not just the answer's
  const keys = new Set($$("[data-orbital]").map((b) => b.dataset.orbital.split(":")[0]));
  for (const k of ["1s", "2s", "2p", "3s", "3p", "3d", "4s", "4p", "4d", "4f", "5s"]) assert.ok(keys.has(k), `${k} offered`);
});
test("Check is disabled until all electrons are placed, and says why", async () => {
  assert.equal($(T("ec-check")).disabled, true);
  assert.match(document.body.textContent, /Check unlocks when all 26 electrons/);
  assert.match($(T("ec-total")).textContent, /Placed 0 \/ 26/);
});
test("Pauli: a second same-spin electron in one orbital is refused with the rule named", async () => {
  await put("1s", 0, "up"); await put("1s", 0, "up");
  assert.match($(T("ec-message")).textContent, /Pauli exclusion principle/);
  assert.match($(T("ec-total")).textContent, /Placed 1 \/ 26/);
  await put("1s", 0, "down"); await put("1s", 0, "down");
  assert.match($(T("ec-message")).textContent, /full/);
});
test("Hund: pairing before every orbital is singly occupied is refused; opposite spin in a new orbital is refused", async () => {
  await put("2p", 0, "up");
  await put("2p", 0, "down");
  assert.match($(T("ec-message")).textContent, /Hund's rule/);
  await put("2p", 1, "down");
  assert.match($(T("ec-message")).textContent, /parallel/);
  await put("2p", 1, "up");
  assert.equal($(T("ec-message")).textContent.trim(), "");
});
test("Remove tool and Clear reset the builder", async () => {
  await put("2p", 1, "remove");
  assert.match($(T("ec-total")).textContent, /Placed 3 \/ 26/);
  await click([...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Clear"));
  assert.match($(T("ec-total")).textContent, /Placed 0 \/ 26/);
});
test("Cr exception: the plain-Aufbau answer is explained, the correct answer succeeds with the unpaired-electron story", async () => {
  await click(T("ec-ex-Cr"));
  assert.match($(T("ec-species")).textContent, /Chromium/);
  await fill({ "1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 6, "3d": 4, "4s": 2 });
  assert.equal($(T("ec-check")).disabled, false);
  await click(T("ec-check"));
  assert.match($(T("ec-result")).textContent, /Not quite/);
  assert.match($(T("ec-result")).textContent, /half-filled/);
  assert.ok($(T("ec-reveal")), "Show me the answer appears after a failed check");
  await click([...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Clear"));
  await fill({ "1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 6, "3d": 5, "4s": 1 });
  await click(T("ec-check"));
  assert.match($(T("ec-result")).textContent, /Correct/);
  assert.equal($(T("ec-unpaired")).textContent, "6");
  assert.match($(T("ec-success")).textContent, /\[Ar\] 3d⁵ 4s¹/);
});
test("ions: Fe2+ answer written like the neutral atom is explained (4s leaves first); charge limits refuse with a reason", async () => {
  await click(T("ec-ex-Fe²⁺"));
  assert.equal($(T("ec-charge")).textContent, "2+");
  assert.match($(T("ec-need")).textContent, /24/);
  await fill({ "1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 6, "3d": 4, "4s": 2 });
  await click(T("ec-check"));
  assert.match($(T("ec-result")).textContent, /OUTERMOST shell first/);
  for (let i = 0; i < 6; i += 1) await click(T("ec-charge-plus"));
  assert.match($(T("ec-notice")).textContent, /forms ions up to 6\+/);
  await click(T("ec-ex-O²⁻"));
  await click(T("ec-charge-minus"));
  assert.match($(T("ec-notice")).textContent, /at most 2 electrons/);
});
test("compact picker opens on demand, search Enter selects the first result, arrow keys move focus", async () => {
  await click(T("ec-change-element"));
  assert.equal($$("[data-z]").length, 118);
  const input = $(T("ec-search"));
  input.focus();
  const setVal = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set;
  setVal.call(input, "Cu"); input.dispatchEvent(new dom.window.Event("input", { bubbles: true })); await wait();
  assert.equal(input.getAttribute("role"), "combobox");
  assert.ok($$('[role="option"]').length > 0);
  input.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true })); await wait();
  assert.match($(T("ec-species")).textContent, /Copper/);
  assert.equal($(T("ec-picker")), null, "picker closes after a choice");
  await click(T("ec-change-element"));
  const cu = $('[data-z="29"]'); cu.focus();
  cu.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })); await wait();
  assert.equal(document.activeElement?.dataset.z, "30");
  assert.equal($('[data-z="29"]').getAttribute("tabindex"), "-1");
  assert.ok($(T("ec-periodic-table")).querySelector('[role="group"]'));
  assert.equal($(T("ec-periodic-table")).querySelector('[role="grid"]'), null, "no invalid grid role");
});

for (const { name, fn } of pending) {
  try { await fn(); passed += 1; console.log(`  ok   ${name}`); } catch (e) { failed += 1; console.log(`  FAIL ${name}\n       ${e.message}`); }
}
console.log(`\nec-explorer: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
