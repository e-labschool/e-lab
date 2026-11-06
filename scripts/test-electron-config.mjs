#!/usr/bin/env node
// Tests for Build an Atom's electron shells / arrangement / electronic configuration.
//   node scripts/test-electron-config.mjs
// Part 1: pure module src/engines/build-an-atom/lib/electronConfiguration.js against a table written BY HAND
//   (independent of the algorithm) for Z = 1-36 and 37-40.  Part 2: the real component in jsdom (the panel below
//   the atom updates live).  jsdom has no layout engine: geometry is checked in verify-build-atom-heating.mjs.
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

const M = await import("../src/engines/build-an-atom/lib/electronConfiguration.js");
const { shellDistribution } = await import("../src/engines/build-an-atom/lib/electronShells.js");
const { shellRadii } = await import("../src/engines/build-an-atom/lib/shellRadii.js");

let passed = 0; let failed = 0;
const pending = [];
function test(name, fn) { pending.push({ name, fn }); }

// ---- hand-written reference (ASCII, "3d5" style), ground-state neutral atoms ----
const He = "1s2"; const Ne = `${He} 2s2 2p6`; const Ar = `${Ne} 3s2 3p6`; const Zn = `${Ar} 3d10 4s2`;
const HAND = {
  1: ["1", "1s1"], 2: ["2", "1s2"],
  3: ["2,1", `${He} 2s1`], 4: ["2,2", `${He} 2s2`], 5: ["2,3", `${He} 2s2 2p1`], 6: ["2,4", `${He} 2s2 2p2`],
  7: ["2,5", `${He} 2s2 2p3`], 8: ["2,6", `${He} 2s2 2p4`], 9: ["2,7", `${He} 2s2 2p5`], 10: ["2,8", Ne],
  11: ["2,8,1", `${Ne} 3s1`], 12: ["2,8,2", `${Ne} 3s2`], 13: ["2,8,3", `${Ne} 3s2 3p1`], 14: ["2,8,4", `${Ne} 3s2 3p2`],
  15: ["2,8,5", `${Ne} 3s2 3p3`], 16: ["2,8,6", `${Ne} 3s2 3p4`], 17: ["2,8,7", `${Ne} 3s2 3p5`], 18: ["2,8,8", Ar],
  19: ["2,8,8,1", `${Ar} 4s1`], 20: ["2,8,8,2", `${Ar} 4s2`],
  21: ["2,8,9,2", `${Ar} 3d1 4s2`], 22: ["2,8,10,2", `${Ar} 3d2 4s2`], 23: ["2,8,11,2", `${Ar} 3d3 4s2`],
  24: ["2,8,13,1", `${Ar} 3d5 4s1`], // Cr exception
  25: ["2,8,13,2", `${Ar} 3d5 4s2`], 26: ["2,8,14,2", `${Ar} 3d6 4s2`], 27: ["2,8,15,2", `${Ar} 3d7 4s2`], 28: ["2,8,16,2", `${Ar} 3d8 4s2`],
  29: ["2,8,18,1", `${Ar} 3d10 4s1`], // Cu exception
  30: ["2,8,18,2", Zn],
  31: ["2,8,18,3", `${Zn} 4p1`], 32: ["2,8,18,4", `${Zn} 4p2`], 33: ["2,8,18,5", `${Zn} 4p3`], 34: ["2,8,18,6", `${Zn} 4p4`],
  35: ["2,8,18,7", `${Zn} 4p5`], 36: ["2,8,18,8", `${Zn} 4p6`],
  // beyond Kr (only reachable as anions in the simulation): a real 5th shell
  37: ["2,8,18,8,1", `${Zn} 4p6 5s1`], 38: ["2,8,18,8,2", `${Zn} 4p6 5s2`],
  39: ["2,8,18,9,2", `${Zn} 4p6 4d1 5s2`], 40: ["2,8,18,10,2", `${Zn} 4p6 4d2 5s2`],
};
const SUP = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9" };
const ascii = (str) => str.replace(/[⁰¹²³⁴-⁹]/g, (c) => SUP[c]);

test("hand table: arrangement and full configuration match for every electron count 1-40", () => {
  for (let e = 1; e <= 40; e++) {
    const [arr, cfg] = HAND[e];
    assert.equal(M.shellArrangement(e).join(","), arr, `arrangement e=${e}`);
    assert.equal(ascii(M.fullConfiguration(e)), cfg, `configuration e=${e}`);
  }
});
test("named examples from the brief", () => {
  const a = (e) => M.shellArrangement(e).join(",");
  assert.equal(a(25), "2,8,13,2"); // Mn
  assert.equal(a(24), "2,8,13,1"); // Cr
  assert.equal(a(29), "2,8,18,1"); // Cu
  assert.equal(a(19), "2,8,8,1"); // K
  assert.equal(a(20), "2,8,8,2"); // Ca
  assert.equal(a(21), "2,8,9,2"); // Sc
  assert.equal(a(30), "2,8,18,2"); // Zn
  assert.equal(a(31), "2,8,18,3"); // Ga
  assert.equal(a(36), "2,8,18,8"); // Kr
  assert.equal(M.fullConfiguration(25), "1s² 2s² 2p⁶ 3s² 3p⁶ 3d⁵ 4s²");
  assert.equal(M.shorthandConfiguration(25), "[Ar] 3d⁵ 4s²");
});
test("sums equal the electron count; no shell ever exceeds 2n^2; no empty shell inside the list", () => {
  for (let e = 0; e <= 40; e++) {
    const arr = M.shellArrangement(e);
    assert.equal(arr.reduce((x, y) => x + y, 0), e, `sum e=${e}`);
    arr.forEach((c, i) => { assert.ok(c <= 2 * (i + 1) ** 2, `shell ${i + 1} of e=${e} has ${c}`); assert.ok(c > 0, `shell ${i + 1} of e=${e} is empty`); });
    // subshell capacities too
    for (const s of M.groundStateSubshells(e)) assert.ok(s.count <= { s: 2, p: 6, d: 10, f: 14 }[s.label.slice(-1)], `${s.label} overfull at e=${e}`);
    assert.deepEqual(shellDistribution(e), arr, "drawing helper uses the same arrangement");
  }
  assert.deepEqual([1, 2, 3, 4, 5].map(M.shellMax), [2, 8, 18, 32, 50]);
});
test("arrangement is derived from the configuration (round trip through the written string)", () => {
  for (let e = 1; e <= 40; e++) {
    const perShell = [];
    for (const term of ascii(M.fullConfiguration(e)).split(" ")) { const n = Number(term[0]); perShell[n - 1] = (perShell[n - 1] ?? 0) + Number(term.slice(2)); }
    assert.deepEqual(perShell, M.shellArrangement(e), `e=${e}`);
  }
});
test("only Cr and Cu break the Madelung order in 1-40 (compare with a plain aufbau fill)", () => {
  const order = [[1, "s", 2], [2, "s", 2], [2, "p", 6], [3, "s", 2], [3, "p", 6], [4, "s", 2], [3, "d", 10], [4, "p", 6], [5, "s", 2], [4, "d", 10]];
  const plain = (e) => { let r = e; const m = {}; for (const [n, l, cap] of order) { const c = Math.min(cap, r); if (c) m[`${n}${l}`] = c; r -= c; } return m; };
  const differs = [];
  for (let e = 1; e <= 40; e++) {
    const got = Object.fromEntries(M.groundStateSubshells(e).map((s) => [s.label, s.count]));
    if (JSON.stringify(Object.entries(got).sort()) !== JSON.stringify(Object.entries(plain(e)).sort())) differs.push(e);
  }
  assert.deepEqual(differs, [24, 29]);
});
test("shorthand uses the right noble-gas core and leaves out the core subshells", () => {
  assert.equal(M.shorthandConfiguration(1), null);
  assert.equal(M.shorthandConfiguration(2), null);
  assert.equal(M.shorthandConfiguration(3), "[He] 2s¹");
  assert.equal(M.shorthandConfiguration(10), "[He] 2s² 2p⁶");
  assert.equal(M.shorthandConfiguration(11), "[Ne] 3s¹");
  assert.equal(M.shorthandConfiguration(19), "[Ar] 4s¹");
  assert.equal(M.shorthandConfiguration(24), "[Ar] 3d⁵ 4s¹");
  assert.equal(M.shorthandConfiguration(29), "[Ar] 3d¹⁰ 4s¹");
  assert.equal(M.shorthandConfiguration(37), "[Kr] 5s¹");
  assert.equal(M.shorthandConfiguration(40), "[Kr] 4d² 5s²");
});
test("describeElectrons: shells with max and full flag, none, ions, ion note", () => {
  const mn = M.describeElectrons(25, 25);
  assert.deepEqual(mn.shells.map((s) => [s.n, s.count, s.max, s.full]), [[1, 2, 2, true], [2, 8, 8, true], [3, 13, 18, false], [4, 2, 32, false]]);
  assert.equal(mn.arrangement, "2,8,13,2");
  assert.equal(mn.isIon, false);
  assert.equal(mn.ionNote, null);
  const none = M.describeElectrons(0, 6);
  assert.equal(none.none, true); assert.deepEqual(none.shells, []); assert.equal(none.configuration, ""); assert.equal(none.shorthand, null);
  // Na+ (11 p, 10 e): configuration is of 10 electrons (Ne), not 11
  const naPlus = M.describeElectrons(10, 11);
  assert.equal(naPlus.isIon, true); assert.equal(naPlus.netCharge, 1); assert.equal(naPlus.arrangement, "2,8"); assert.equal(naPlus.ionNote, null);
  // Cl- (17 p, 18 e) = Ar
  const clMinus = M.describeElectrons(18, 17);
  assert.equal(clMinus.netCharge, -1); assert.equal(clMinus.arrangement, "2,8,8");
  // Fe2+ (26 p, 24 e): count-based pattern + honest note
  const fe2 = M.describeElectrons(24, 26);
  assert.equal(fe2.isIon, true); assert.equal(fe2.arrangement, "2,8,13,1"); assert.match(fe2.ionNote, /Fe.*2,8,14/);
  // no protons, no ion label
  assert.equal(M.describeElectrons(3, 0).isIon, false);
  assert.throws(() => M.describeElectrons(41), RangeError);
  assert.throws(() => M.describeElectrons(-1), RangeError);
  assert.throws(() => M.describeElectrons(2.5), RangeError);
});
test("drawing radii: 4 rings up to 36 electrons, a compressed 5-ring set only for 37-40, all inside the viewBox (230)", () => {
  assert.deepEqual(shellRadii(4), [100, 132, 164, 196]);
  assert.equal(shellRadii(5).length, 5);
  assert.ok(shellRadii(5)[4] + 12 < 230);
  const r = shellRadii(5);
  for (let i = 1; i < 5; i++) assert.ok(r[i] - r[i - 1] >= 24, "ring spacing leaves room for an electron marker (19 + spin ring)");
  // crowding: the most electrons on any ring, spacing along the ring must exceed the marker diameter (~24)
  for (let e = 1; e <= 40; e++) {
    const arr = M.shellArrangement(e); const radii = shellRadii(arr.length);
    arr.forEach((c, i) => { if (c > 1) assert.ok((2 * Math.PI * radii[i]) / c >= 26, `e=${e} ring ${i + 1}: ${c} markers too tight`); });
  }
});

// ---------------------------------------------------------------- jsdom UI: the panel under the atom
const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const { ModeProvider } = await import("../src/context/ModeContext.jsx");
const { default: BuildAtomSimulation } = await import("../src/engines/build-an-atom/BuildAtomSimulation.jsx");
const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const $ = (sel) => document.querySelector(sel);
const click = async (sel) => { $(sel).dispatchEvent(new MouseEvent("click", { bubbles: true })); await wait(); };
const T = (id) => `[data-testid="${id}"]`;
const panel = () => ({
  arrangement: $(T("atom-shells-arrangement"))?.textContent,
  config: $(T("atom-shells-config"))?.textContent,
  shorthand: $(T("atom-shells-shorthand"))?.textContent,
  ion: $(T("atom-shells-ion"))?.textContent,
  none: !!$(T("atom-shells-none")),
  shells: [...document.querySelectorAll(`${T("atom-shells-list")} li`)].map((li) => `${li.dataset.count}/${li.dataset.max}:${li.dataset.state}`),
});
const root = createRoot(document.getElementById("root"));
root.render(React.createElement(ModeProvider, null, React.createElement(BuildAtomSimulation, { standalone: true })));
await wait(150);

test("UI: carbon-12 shows 2,4 with n=1 2/2 full and n=2 4/8 partial, no ion label", () => {
  const p = panel();
  assert.equal(p.arrangement, "2,4");
  assert.equal(p.config, "1s² 2s² 2p²");
  assert.equal(p.shorthand, "[He] 2s² 2p²");
  assert.deepEqual(p.shells, ["2/2:full", "4/8:partial"]);
  assert.equal(p.ion, undefined);
});
test("UI: manual electron +/- updates the panel live and uses the ELECTRON count, with an ion label", async () => {
  await click(T("atom-add-electron")); await click(T("atom-add-electron")); // 6 p, 8 e
  let p = panel();
  assert.equal(p.arrangement, "2,6"); assert.equal(p.config, "1s² 2s² 2p⁴"); // oxygen's pattern for 8 electrons
  assert.match(p.ion, /Ion, net charge −2/);
  await click(T("atom-remove-electron")); await click(T("atom-remove-electron")); await click(T("atom-remove-electron")); // 5 e
  p = panel();
  assert.equal(p.arrangement, "2,3"); assert.match(p.ion, /net charge \+1/);
  await click(T("atom-add-electron")); // back to neutral carbon
  assert.equal(panel().ion, undefined);
});
test("UI: manganese 25/25 -> 2,8,13,2 with 13/18 partial; Cr and Cu exceptions via proton +/- with matching electrons", async () => {
  await click(T("atom-auto-balance")); // ON: electrons follow protons
  for (let i = 0; i < 19; i++) await click(T("atom-add-proton")); // 6 -> 25
  assert.equal($(T("atom-count-electron")).textContent, "25");
  let p = panel();
  assert.equal(p.arrangement, "2,8,13,2");
  assert.deepEqual(p.shells, ["2/2:full", "8/8:full", "13/18:partial", "2/32:partial"]);
  assert.equal(p.config, "1s² 2s² 2p⁶ 3s² 3p⁶ 3d⁵ 4s²");
  assert.equal(p.shorthand, "[Ar] 3d⁵ 4s²");
  await click(T("atom-remove-proton"));
  assert.equal(panel().arrangement, "2,8,13,1");
  for (let i = 0; i < 5; i++) await click(T("atom-add-proton")); // 29
  assert.equal(panel().arrangement, "2,8,18,1");
  assert.equal(panel().shells[2], "18/18:full");
});
test("UI: ion of a transition metal (Fe 26 p, 24 e) gets the small honest note; a main-group ion does not", async () => {
  await click(T("atom-auto-balance")); // OFF
  for (let i = 0; i < 3; i++) await click(T("atom-remove-proton")); // 26 p, 29 e
  for (let i = 0; i < 5; i++) await click(T("atom-remove-electron")); // 24 e
  assert.equal($(T("atom-count-proton")).textContent, "26");
  assert.equal(panel().arrangement, "2,8,13,1");
  assert.match(panel().ion, /\+2/);
  assert.match($(T("atom-shells-ion-note")).textContent, /Fe.*2,8,14/);
  assert.match($(T("atom-shells-ion-basis")).textContent, /24 electrons.*26 protons/);
  await click(T("atom-start-empty"));
  assert.equal(panel().none, true);
  assert.match($(T("atom-shells")).textContent, /No electrons/);
  assert.equal($(T("atom-shells-ion-note")), null);
});
test("UI: 37-40 electrons (anions) show a real 5th shell and the panel never shows a shell above 2n^2", async () => {
  await click(T("atom-reset-carbon"));
  for (let i = 0; i < 34; i++) await click(T("atom-add-electron")); // 40 e
  const p = panel();
  assert.equal(p.arrangement, "2,8,18,10,2");
  assert.equal(p.shells.length, 5);
  for (const s of p.shells) { const [c, rest] = s.split("/"); const m = Number(rest.split(":")[0]); assert.ok(Number(c) <= m); }
  assert.equal(document.querySelectorAll('[data-testid="atom-svg"] foreignObject').length >= 40, true);
});

for (const { name, fn } of pending) {
  try { await fn(); passed += 1; console.log(`  ok   ${name}`); } catch (e) { failed += 1; console.log(`  FAIL ${name}\n       ${e.message}`); }
}
console.log(`\nelectron-config: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
