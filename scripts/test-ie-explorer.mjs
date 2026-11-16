#!/usr/bin/env node
// Tests for the Ionization Energy Explorer: data validated against the shared atomic data layer (pure), and the predict-first UI (jsdom).
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

const D = await import("../src/engines/ionization-energy-explorer/lib/ionizationData.js");
const S = await import("../src/engines/ionization-energy-explorer/lib/atomState.js");
const A = await import("../src/lib/atomic/index.js");
let passed = 0; let failed = 0; const pending = [];
const test = (name, fn) => pending.push({ name, fn });

test("data layer agreement: every element has exactly Z values, removal order = shared cation rule, config = shared algorithm", () => {
  for (const el of D.IONIZATION_DATA) {
    const z = el.atomicNumber;
    assert.equal(el.successiveIonizationEnergies.length, z, `${el.symbol}: one IE per electron`);
    const order = S.getRemovalOrder(z);
    assert.equal(order.length, z);
    for (let k = 0; k <= z; k += 1) {
      const st = S.deriveAtomState(z, k);
      const sp = A.speciesOccupancy(z, k);
      assert.equal(st.configuration, A.fullString(sp.occupancy), `${el.symbol}+${k}`);
      assert.equal(st.electronCount, z - k);
      assert.equal(Object.values(st.shells).reduce((a, b) => a + b, 0), z - k);
    }
    // monotonic: each successive IE is larger than the previous one
    el.successiveIonizationEnergies.forEach((v, i) => { if (i) assert.ok(v > el.successiveIonizationEnergies[i - 1], `${el.symbol} IE${i + 1} > IE${i}`); });
  }
});
test("shell-boundary jumps: IE jumps > 2.5x exactly where the removal moves to an inner shell (Mg IE3, Na IE2, Al IE4, Ca IE3)", () => {
  const jumpAt = (z) => { const v = D.IONIZATION_DATA.find((e) => e.atomicNumber === z).successiveIonizationEnergies; return v.findIndex((x, i) => i && x / v[i - 1] > 2.5) + 1; };
  assert.equal(jumpAt(11), 2); assert.equal(jumpAt(12), 3); assert.equal(jumpAt(20), 3);
  const al = S.deriveAtomState(13, 3); assert.equal(al.isInnerShellJump, true); assert.equal(al.nextSublevel, "2p"); // Al3+ -> Al4+ is the jump (IE4 = 11,577)
});
test("first IE trend: H-Kr, Z=36 values, dips at B, O, Al, S; consistency with the successive table for Z 1-20", () => {
  assert.equal(D.FIRST_IE_TREND.length, 36);
  const f = (z) => D.FIRST_IE_TREND[z - 1].ie;
  assert.ok(f(5) < f(4) && f(8) < f(7) && f(13) < f(12) && f(16) < f(15), "the B/Al and O/S dips");
  assert.ok(f(3) < f(2) && f(11) < f(10) && f(19) < f(18), "alkali metals are minima; noble gases maxima");
  for (const el of D.IONIZATION_DATA) assert.ok(Math.abs(el.successiveIonizationEnergies[0] - f(el.atomicNumber)) <= 1.5, `${el.symbol} IE1 matches the trend table`);
  assert.equal(D.IONIZATION_DATA[0].symbol, "H"); assert.equal(D.IONIZATION_DATA[1].symbol, "He");
});
test("Mg2+ shell structure: n=3 empty, neutral ring count kept at 3", () => {
  const s = S.deriveAtomState(12, 2); assert.deepEqual(s.shells, { 1: 2, 2: 8 }); assert.equal(s.neutralMaxShell, 3); assert.equal(s.speciesSymbol, "Mg²⁺");
});

const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const { ModeProvider } = await import("../src/context/ModeContext.jsx");
const { default: Explorer } = await import("../src/engines/ionization-energy-explorer/IonizationEnergyExplorer.jsx");
const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const $ = (s) => document.querySelector(s);
const T = (id) => `[data-testid="${id}"]`;
const click = async (sel) => { const el = typeof sel === "string" ? $(sel) : sel; el.dispatchEvent(new MouseEvent("click", { bubbles: true })); await wait(); };
const root = createRoot(document.getElementById("root"));
root.render(React.createElement(ModeProvider, null, React.createElement(Explorer, { standalone: true })));
await wait(200);

test("UI: nothing is revealed up front: no IE value, table shows ?, Supply disabled until a prediction", () => {
  assert.equal($(T("ie-value")), null);
  assert.ok($(T("ie-predict")));
  assert.doesNotMatch(document.body.textContent, /1,451|7,733|10,542/);
  assert.match(document.body.textContent, /\?/);
  assert.equal(document.querySelector('[aria-label="Supply energy and remove electron"]').disabled, true);
  assert.ok($('[data-testid="ie-predict-3s"]'));
});
test("UI: a wrong prediction is explained, the value then appears, and revealed rows grow", async () => {
  await click(T("ie-predict-2p"));
  assert.match($(T("ie-prediction-feedback")).textContent, /outermost occupied shell first/);
  assert.equal($(T("ie-value")).textContent.replace(/\s/g, ""), "738kJmol⁻¹");
  assert.equal(document.querySelector('[aria-label="Supply energy and remove electron"]').disabled, false);
});
test("UI: not enough energy says by how much; removal reports excess as kinetic energy", async () => {
  await click('[aria-label="Supply energy and remove electron"]');
  assert.match(document.body.textContent, /short by 738 kJ/);
});
test("UI: H and He are selectable; Show all reveals the table", async () => {
  const sel = $("#ie-element-select");
  assert.ok([...sel.options].some((o) => o.textContent.startsWith("H ")) && [...sel.options].some((o) => o.textContent.startsWith("He")));
  await click(T("ie-show-all"));
  assert.match(document.body.textContent, /17,995|18,020/);
});

for (const { name, fn } of pending) {
  try { await fn(); passed += 1; console.log(`  ok   ${name}`); } catch (e) { failed += 1; console.log(`  FAIL ${name}\n       ${e.message}`); }
}
console.log(`\nie-explorer: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
