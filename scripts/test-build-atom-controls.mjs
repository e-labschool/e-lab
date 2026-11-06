#!/usr/bin/env node
// Tests for Build an Atom: independent particle controls, Auto-balance, derived quantities, isotope data.
//   node scripts/test-build-atom-controls.mjs
// Part 1: pure rules (src/engines/build-an-atom/lib/atomControls.js).  Part 2: the REAL component in jsdom.
// Honest limits: jsdom has no layout engine, so geometry (overlap, clipping, resize) is covered by
// scripts/verify-build-atom-heating.mjs in headless Chromium, not here.
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

const C = await import("../src/engines/build-an-atom/lib/atomControls.js");
const N = await import("../src/engines/build-an-atom/data/nuclides.js");
const { deriveAtom } = await import("../src/engines/build-an-atom/lib/atomState.js");
const { shellDistribution } = await import("../src/engines/build-an-atom/lib/electronShells.js");
const { nucleusScaling } = await import("../src/engines/build-an-atom/lib/nucleusScaling.js");

let passed = 0; let failed = 0;
const pending = [];
function test(name, fn) { pending.push({ name, fn }); }
const TYPES = ["proton", "neutron", "electron"];
const KEY = { proton: "protons", neutron: "neutrons", electron: "electrons" };
const OTHERS = (type) => TYPES.filter((t) => t !== type).map((t) => KEY[t]);

// ---------------------------------------------------------------- pure: independence (auto-balance OFF)
test("OFF: every +/- changes only its own count by exactly 1, for many starting atoms", () => {
  const starts = [];
  for (const p of [0, 1, 2, 6, 11, 17, 20, 36]) for (const n of [0, 1, 7, 30, 60]) for (const e of [0, 1, 5, 18, 40]) starts.push({ protons: p, neutrons: n, electrons: e });
  let checked = 0;
  for (const atom of starts) {
    for (const type of TYPES) {
      for (const delta of [1, -1]) {
        const next = C.applyChange(atom, type, delta, { autoBalance: false });
        const key = KEY[type];
        for (const other of OTHERS(type)) assert.equal(next[other], atom[other], `${type}${delta > 0 ? "+" : "-"} changed ${other} for ${JSON.stringify(atom)}`);
        const expected = Math.max(0, Math.min(C.LIMITS[key], atom[key] + delta));
        assert.equal(next[key], expected, `${type} ${delta} from ${JSON.stringify(atom)}`);
        checked += 1;
      }
    }
  }
  assert.ok(checked > 1000);
});
test("OFF: adding a proton to carbon-12 gives exactly 7 protons, 6 neutrons, 6 electrons (no hidden neutron)", () => {
  const n = C.applyChange({ protons: 6, neutrons: 6, electrons: 6 }, "proton", 1);
  assert.deepEqual(n, { protons: 7, neutrons: 6, electrons: 6 });
  const id = C.isotopeIdentity(n.protons, n.neutrons);
  assert.equal(id.name, "nitrogen-13"); // N-13 (not the reference N-14): no silent isotope conversion
  assert.equal(deriveAtom(n).netCharge, 1);
});
test("OFF: removing a proton from carbon-12 -> boron-11 count 5/6/6 (not snapped to a boron isotope)", () => {
  assert.deepEqual(C.applyChange({ protons: 6, neutrons: 6, electrons: 6 }, "proton", -1), { protons: 5, neutrons: 6, electrons: 6 });
});
test("lower bounds: no negative counts, and the same object is returned when nothing changes", () => {
  const zero = { protons: 0, neutrons: 0, electrons: 0 };
  for (const t of TYPES) { assert.equal(C.applyChange(zero, t, -1), zero); assert.equal(C.applyChange(zero, t, -1, { autoBalance: true }), zero); }
  for (let i = 0; i < 100; i++) { /* hammer */ }
  let a = { protons: 2, neutrons: 1, electrons: 3 };
  for (let i = 0; i < 10; i++) for (const t of TYPES) a = C.applyChange(a, t, -1);
  assert.deepEqual(a, zero);
});
test("upper bounds are respected, never exceeded", () => {
  let a = { protons: 35, neutrons: 59, electrons: 39 };
  for (let i = 0; i < 5; i++) for (const t of TYPES) a = C.applyChange(a, t, 1);
  assert.deepEqual(a, { protons: C.LIMITS.protons, neutrons: C.LIMITS.neutrons, electrons: C.LIMITS.electrons });
});
test("OFF: periodic-table selection sets protons only", () => {
  assert.deepEqual(C.setProtons({ protons: 6, neutrons: 6, electrons: 6 }, 11), { protons: 11, neutrons: 6, electrons: 6 });
});
test("OFF: unchecking after being on changes nothing; toggling ON balances once", () => {
  const a = { protons: 6, neutrons: 8, electrons: 3 };
  assert.equal(C.toggleAutoBalance(a, false), a);
  assert.deepEqual(C.toggleAutoBalance(a, true), { protons: 6, neutrons: 6, electrons: 6 });
});

// ---------------------------------------------------------------- pure: auto-balance ON
test("ON: for every element with data, a proton change gives electrons = protons and neutrons = reference isotope", () => {
  for (let z = 1; z <= 36; z++) {
    const ref = C.referenceIsotope(z);
    assert.ok(ref, `reference for Z=${z}`);
    const start = { protons: z - 1, neutrons: 3, electrons: 40 };
    const up = C.applyChange(start, "proton", 1, { autoBalance: true });
    assert.deepEqual(up, { protons: z, neutrons: ref.neutrons, electrons: z }, `Z=${z}`);
    const via = C.setProtons({ protons: 1, neutrons: 99 % 60, electrons: 0 }, z, { autoBalance: true });
    assert.deepEqual(via, z === 1 ? { protons: 1, neutrons: 99 % 60, electrons: 0 } : { protons: z, neutrons: ref.neutrons, electrons: z });
  }
});
test("ON: electrons locked; neutrons locked where a reference exists and free where it does not", () => {
  const c = { protons: 6, neutrons: 6, electrons: 6 };
  assert.equal(C.applyChange(c, "electron", 1, { autoBalance: true }), c);
  assert.equal(C.applyChange(c, "neutron", 1, { autoBalance: true }), c);
  assert.equal(C.isLocked("electron", c, true), true);
  assert.equal(C.isLocked("proton", c, true), false);
  const zero = { protons: 0, neutrons: 2, electrons: 0 }; // no element, no reference
  assert.equal(C.referenceIsotope(0), null);
  assert.equal(C.applyChange(zero, "neutron", 1, { autoBalance: true }).neutrons, 3);
  const big = { protons: 40, neutrons: 51, electrons: 40 }; // Z > 36: no data -> neutrons are never changed automatically
  assert.equal(C.referenceIsotope(40), null);
  assert.deepEqual(C.balance({ protons: 40, neutrons: 51, electrons: 3 }), big);
});
test("ON: going up from hydrogen to carbon follows the reference isotopes (1H, 4He, 7Li, 9Be, 11B, 12C)", () => {
  let a = { protons: 1, neutrons: 0, electrons: 1 };
  const seen = [];
  for (let i = 0; i < 5; i++) { a = C.applyChange(a, "proton", 1, { autoBalance: true }); seen.push(C.referenceIsotope(a.protons).notation + ":" + a.neutrons); }
  assert.deepEqual(seen, ["⁴He:2", "⁷Li:4", "⁹Be:5", "¹¹B:6", "¹²C:6"]);
});

// ---------------------------------------------------------------- reference data
const EXPECT_REF = { 1: 1, 2: 4, 3: 7, 4: 9, 5: 11, 6: 12, 7: 14, 8: 16, 9: 19, 10: 20, 11: 23, 12: 24, 13: 27, 14: 28, 15: 31, 16: 32, 17: 35, 18: 40, 19: 39, 20: 40, 21: 45, 22: 48, 23: 51, 24: 52, 25: 55, 26: 56, 27: 59, 28: 58, 29: 63, 30: 64, 31: 69, 32: 74, 33: 75, 34: 80, 35: 79, 36: 84 };
test("reference isotopes = most abundant isotope (IUPAC/CIAAW) for Z=1-36, and are not N=Z", () => {
  let notNZ = 0;
  for (const [z, a] of Object.entries(EXPECT_REF)) {
    const ref = C.referenceIsotope(+z);
    assert.equal(ref.massNumber, a, `Z=${z}`);
    assert.equal(ref.neutrons, a - +z);
    assert.equal(N.classifyNuclide(+z, a - +z), "stable", `reference of Z=${z} is a stable nuclide`);
    if (ref.neutrons !== +z) notNZ += 1;
  }
  assert.ok(notNZ >= 25, "N = Z is not assumed (e.g. Fe-56, Kr-84)");
  assert.equal(C.referenceIsotope(6).notation, "¹²C");
  assert.equal(C.referenceIsotope(26).notation, "⁵⁶Fe");
});
test("stable isotope counts per element match the IUPAC natural isotopes minus the known radioactive ones", () => {
  const stableCount = { 1: 2, 2: 2, 3: 2, 4: 1, 5: 2, 6: 2, 7: 2, 8: 3, 9: 1, 10: 3, 11: 1, 12: 3, 13: 1, 14: 3, 15: 1, 16: 4, 17: 2, 18: 3, 19: 2, 20: 5, 21: 1, 22: 5, 23: 1, 24: 4, 25: 1, 26: 4, 27: 1, 28: 5, 29: 2, 30: 5, 31: 2, 32: 4, 33: 1, 34: 5, 35: 2, 36: 5 };
  for (const [z, count] of Object.entries(stableCount)) {
    const n = N.curatedIsotopesFor(+z).filter((i) => i.stability === "stable").length;
    assert.equal(n, count, `stable isotopes of Z=${z}`);
  }
});
test("nuclide status: reference / stable / radioactive / not stable / no data", () => {
  assert.equal(C.nuclideStatus(6, 6).status, "reference");
  assert.equal(C.nuclideStatus(6, 7).status, "stable");       // carbon-13
  assert.equal(C.nuclideStatus(6, 8).status, "radioactive");  // carbon-14
  assert.equal(C.nuclideStatus(6, 2).status, "not-stable");   // carbon-8
  assert.equal(C.nuclideStatus(7, 6).status, "not-stable");   // nitrogen-13 (the +1 proton example)
  assert.equal(C.nuclideStatus(1, 0).status, "reference");
  assert.equal(C.nuclideStatus(40, 50).status, "no-data");
  assert.equal(C.nuclideStatus(0, 5).status, "no-data");
  assert.equal(C.nuclideStatus(1, 5).status, "not-stable");
});
test("derived quantities and isotope naming", () => {
  const d = deriveAtom({ protons: 6, neutrons: 7, electrons: 6 });
  assert.equal(d.atomicNumber, 6); assert.equal(d.massNumber, 13); assert.equal(d.netCharge, 0);
  assert.equal(C.isotopeIdentity(6, 7).name, "carbon-13");
  assert.equal(C.isotopeIdentity(6, 7).notation, "¹³C");
  assert.equal(C.isotopeIdentity(6, 7).isReference, false);
  assert.equal(C.isotopeIdentity(6, 6).isReference, true);
  assert.equal(deriveAtom({ protons: 11, neutrons: 12, electrons: 10 }).netCharge, 1);
  assert.equal(deriveAtom({ protons: 17, neutrons: 18, electrons: 18 }).netCharge, -1);
  assert.equal(deriveAtom({ protons: 17, neutrons: 18, electrons: 18 }).classification, "anion");
  assert.equal(deriveAtom({ protons: 11, neutrons: 12, electrons: 10 }).classification, "cation");
  assert.equal(C.isotopeIdentity(0, 3), null);
  assert.equal(deriveAtom({ protons: 8, neutrons: 8, electrons: 8 }).element.symbol, "O");
});
test("electron shells: 1-20 unchanged, 21-36 neutral-atom pattern, always sums to the count", () => {
  assert.deepEqual(shellDistribution(11), [2, 8, 1]);
  assert.deepEqual(shellDistribution(20), [2, 8, 8, 2]);
  assert.deepEqual(shellDistribution(26), [2, 8, 14, 2]);
  for (let e = 0; e <= 40; e++) assert.equal(shellDistribution(e).reduce((a, b) => a + b, 0), e);
  for (let e = 0; e <= 40; e++) assert.ok(shellDistribution(e).length <= 4, `at most 4 shells (e=${e})`);
});
test("nucleus scaling: unchanged up to calcium-40, shrinks for heavy nuclei so it clears the first shell (r=100)", () => {
  assert.equal(nucleusScaling(6, 6).scale, 1.3);
  assert.equal(nucleusScaling(20, 20).scale, 1.3);
  const k = nucleusScaling(36, 60);
  assert.ok(k.scale < 1.3 && k.sphere < 26);
  const maxSlot = 2 * 59 + 1;
  assert.ok(7.5 * Math.sqrt(maxSlot + 0.5) * k.scale + k.sphere / 2 <= 78.01);
});

// ---------------------------------------------------------------- jsdom UI
const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const { ModeProvider } = await import("../src/context/ModeContext.jsx");
const { default: BuildAtomSimulation } = await import("../src/engines/build-an-atom/BuildAtomSimulation.jsx");
const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const $ = (sel) => document.querySelector(sel);
const num = (sel) => Number($(sel).textContent);
const click = async (sel) => { $(sel).dispatchEvent(new MouseEvent("click", { bubbles: true })); await wait(); };
const counts = () => ({ p: num('[data-testid="atom-count-proton"]'), n: num('[data-testid="atom-count-neutron"]'), e: num('[data-testid="atom-count-electron"]') });
const host = document.getElementById("root");
const root = createRoot(host);
root.render(React.createElement(ModeProvider, null, React.createElement(BuildAtomSimulation, { standalone: true })));
await wait(150);

test("UI: starts at carbon-12 with Auto-balance unchecked", () => {
  assert.deepEqual(counts(), { p: 6, n: 6, e: 6 });
  assert.equal($('[data-testid="atom-auto-balance"]').checked, false);
  assert.match(host.textContent, /Auto-balance particles/);
  assert.match($('[data-testid="atom-reference-isotope"]').textContent, /Reference isotope:\s*¹²C/);
});
test("UI (OFF): + proton changes only protons; readouts follow", async () => {
  await click('[data-testid="atom-add-proton"]');
  assert.deepEqual(counts(), { p: 7, n: 6, e: 6 });
  assert.equal($('[data-testid="atom-Z"]').textContent, "7");
  assert.equal($('[data-testid="atom-A"]').textContent, "13");
  assert.equal($('[data-testid="atom-charge"]').textContent, "+1");
  assert.equal($('[data-testid="atom-isotope-name"]').textContent, "Nitrogen-13");
  assert.equal($('[data-testid="atom-element"]').textContent, "Nitrogen");
  assert.match($('[data-testid="atom-stability"]').textContent, /Not a stable nuclide/);
  assert.match($('[data-testid="atom-reference-isotope"]').textContent, /¹⁴N/); // reference is N-14, the atom is N-13
});
test("UI (OFF): neutron + and electron + each change only themselves; minus too", async () => {
  await click('[data-testid="atom-add-neutron"]');
  assert.deepEqual(counts(), { p: 7, n: 7, e: 6 });
  await click('[data-testid="atom-add-electron"]');
  assert.deepEqual(counts(), { p: 7, n: 7, e: 7 });
  await click('[data-testid="atom-remove-electron"]');
  await click('[data-testid="atom-remove-electron"]');
  assert.deepEqual(counts(), { p: 7, n: 7, e: 5 });
  assert.equal($('[data-testid="atom-charge"]').textContent, "+2");
  await click('[data-testid="atom-remove-neutron"]');
  await click('[data-testid="atom-remove-proton"]');
  assert.deepEqual(counts(), { p: 6, n: 6, e: 5 });
});
test("UI: minus buttons disabled at 0 (no negative counts)", async () => {
  await click('[data-testid="atom-start-empty"]');
  assert.deepEqual(counts(), { p: 0, n: 0, e: 0 });
  for (const t of TYPES) assert.equal($(`[data-testid="atom-remove-${t}"]`).disabled, true);
  await click('[data-testid="atom-add-proton"]');
  assert.deepEqual(counts(), { p: 1, n: 0, e: 0 }); // proton only, no neutron, no electron
  assert.equal($('[data-testid="atom-isotope-name"]').textContent, "Hydrogen-1");
  await click('[data-testid="atom-reset-carbon"]');
});
test("UI (ON): checking balances once, locks electrons + neutrons, and a proton press follows the reference isotope", async () => {
  await click('[data-testid="atom-remove-electron"]');
  await click('[data-testid="atom-add-neutron"]');
  assert.deepEqual(counts(), { p: 6, n: 7, e: 5 });
  await click('[data-testid="atom-auto-balance"]');
  assert.equal($('[data-testid="atom-auto-balance"]').checked, true);
  assert.deepEqual(counts(), { p: 6, n: 6, e: 6 }); // balanced to carbon-12
  assert.equal($('[data-testid="atom-add-electron"]').disabled, true);
  assert.equal($('[data-testid="atom-add-neutron"]').disabled, true);
  assert.equal($('[data-testid="atom-add-proton"]').disabled, false);
  await click('[data-testid="atom-add-proton"]');
  assert.deepEqual(counts(), { p: 7, n: 7, e: 7 }); // nitrogen-14
  assert.equal($('[data-testid="atom-isotope-name"]').textContent, "Nitrogen-14");
  assert.match($('[data-testid="atom-reference-isotope"]').textContent, /Reference isotope:\s*¹⁴N/);
  assert.match(host.textContent, /Auto-balance also changed neutrons: 6 → 7/);
  await click('[data-testid="atom-add-electron"]'); // locked: no effect
  assert.deepEqual(counts(), { p: 7, n: 7, e: 7 });
});
test("UI (ON -> OFF): unchecking changes nothing and unlocks the controls", async () => {
  await click('[data-testid="atom-auto-balance"]');
  assert.equal($('[data-testid="atom-auto-balance"]').checked, false);
  assert.deepEqual(counts(), { p: 7, n: 7, e: 7 });
  await click('[data-testid="atom-add-neutron"]');
  assert.deepEqual(counts(), { p: 7, n: 8, e: 7 });
  assert.equal($('[data-testid="atom-isotope-name"]').textContent, "Nitrogen-15");
  assert.match($('[data-testid="atom-stability"]').textContent, /Stable nuclide/);
});
test("UI: isotope indications do not block (carbon-14 is labelled radioactive and still buildable)", async () => {
  await click('[data-testid="atom-reset-carbon"]');
  await click('[data-testid="atom-add-neutron"]');
  await click('[data-testid="atom-add-neutron"]');
  assert.deepEqual(counts(), { p: 6, n: 8, e: 6 });
  assert.match($('[data-testid="atom-stability"]').textContent, /Radioactive/);
  assert.equal($('[data-testid="atom-isotope-name"]').textContent, "Carbon-14");
});

for (const { name, fn } of pending) {
  try { await fn(); passed += 1; console.log(`  ok   ${name}`); } catch (e) { failed += 1; console.log(`  FAIL ${name}\n       ${e.message}`); }
}
console.log(`\nbuild-an-atom: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
