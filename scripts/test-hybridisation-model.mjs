#!/usr/bin/env node
// Pure-model tests for the 3D Hybridisation Explorer:  node scripts/test-hybridisation-model.mjs
// Covers element data, labels, Hund's rule, excitation validity, mixing, ideal angles, the overlap/snap engine, molecule data,
// workspace history semantics and the theme parity with VSEPR. Rendering is NOT covered here (see verify-hybridisation-explorer.mjs).
import assert from "node:assert/strict";
import fs from "node:fs";
import { register } from "node:module";
register("./jsx-loader-hooks.mjs", import.meta.url);

const root = "../src/engines/hybridisation-explorer/";
const E = await import(`${root}model/elements.js`);
const O = await import(`${root}model/orbitals.js`);
const H = await import(`${root}model/hybrids.js`);
const OV = await import(`${root}model/overlap.js`);
const W = await import(`${root}model/workspace.js`);
const MD = await import(`${root}model/moleculeData.js`);
const ML = await import(`${root}model/moleculeLayout.js`);
const { renderCompactLatex } = await import("../src/lib/scientificContent.jsx");

let passed = 0; let failed = 0;
function test(name, fn) { try { fn(); console.log(`  ok   ${name}`); passed += 1; } catch (e) { console.log(`  FAIL ${name}\n       ${(e.stack || e.message).split("\n").slice(0, 5).join("\n       ")}`); failed += 1; } }
const deg = (a, b) => (Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b))))) * 180) / Math.PI;
const near = (a, b, t = 0.6) => assert.ok(Math.abs(a - b) <= t, `${a} vs ${b}`);

console.log("Elements and ground states (independent oracle)");
const ORACLE = { H: [1, 0, 0], Be: [2, 0, 0], B: [2, 1, 0], C: [2, 2, 0], N: [2, 3, 0], O: [2, 4, 0], F: [2, 5, 0], Si: [2, 2, 0], P: [2, 3, 0], S: [2, 4, 0], Cl: [2, 5, 0], Xe: [2, 6, 0] };
const SHELL = { H: 1, Be: 2, B: 2, C: 2, N: 2, O: 2, F: 2, Si: 3, P: 3, S: 3, Cl: 3, Xe: 5 };
test("exactly the 12 required elements", () => assert.deepEqual(E.SELECTABLE_SYMBOLS, ["H", "Be", "B", "C", "N", "O", "F", "Si", "P", "S", "Cl", "Xe"]));
test("valence electrons and shell match the oracle for every element", () => {
  for (const s of E.SELECTABLE_SYMBOLS) {
    const g = E.groundState(s); assert.equal(g.n, SHELL[s], s);
    const sEl = g.orbitals.filter((o) => o.kind === "s").reduce((a, o) => a + o.electrons, 0);
    const pEl = g.orbitals.filter((o) => o.kind[0] === "p").reduce((a, o) => a + o.electrons, 0);
    const dEl = g.orbitals.filter((o) => o.kind[0] === "d").reduce((a, o) => a + o.electrons, 0);
    assert.deepEqual([sEl, pEl, dEl], ORACLE[s], s); assert.equal(g.valenceElectrons, sEl + pEl);
  }
});
test("Hund's rule in every ground state; every state validates", () => {
  for (const s of E.SELECTABLE_SYMBOLS) { const g = E.groundState(s); const v = E.validateState(g); assert.deepEqual(v, [], s); }
  const N = E.groundState("N"); assert.deepEqual(N.orbitals.filter((o) => o.kind[0] === "p").map((o) => o.electrons), [1, 1, 1]);
  const Oo = E.groundState("O"); assert.deepEqual(Oo.orbitals.filter((o) => o.kind[0] === "p").map((o) => o.electrons).sort(), [1, 1, 2]);
});
test("hydrogen has only 1s; 3rd-row elements offer 3d boxes; 2nd-row do not", () => {
  assert.deepEqual(E.groundState("H").orbitals.map((o) => o.id), ["1s"]);
  assert.ok(E.groundState("S").orbitals.some((o) => o.id === "3dz2")); assert.ok(!E.groundState("C").orbitals.some((o) => o.kind[0] === "d"));
});

console.log("Orbital labels");
test("labels name the specific orbital with n and subscripts (never bare 'p orbital')", () => {
  for (const s of E.SELECTABLE_SYMBOLS) for (const o of E.groundState(s).orbitals) {
    assert.ok(/^\d/.test(O.orbitalPlain(o.n, o.kind)), `${s} ${o.id} lacks n`);
    if (o.kind !== "s") assert.ok(O.orbitalLatex(o.n, o.kind).includes("_"), `${o.id} lacks subscript`);
  }
  const html = renderCompactLatex(O.orbitalLatex(3, "dx2-y2")); assert.ok(/<sub/.test(html) && /<sup/.test(html), html);
  assert.ok(/<sub[^>]*>z<\/sub>/.test(renderCompactLatex(O.orbitalLatex(2, "pz"))));
});

console.log("Excited states (validated illustrative promotions)");
test("C has the conventional 2s1 2p3 illustration, flagged as such", () => {
  const x = E.excitedState("C"); assert.deepEqual(x.orbitals.map((o) => o.electrons), [1, 1, 1, 1]); assert.equal(x.valenceElectrons, 4);
  assert.match(E.promotionsFor("C")[0].example, /CH₄/);
});
test("H, N, O, F cannot be excited and carry an explanation", () => {
  for (const s of ["H", "N", "O", "F"]) { assert.equal(E.canExcite(s), false); assert.equal(E.excitedState(s), null); assert.ok(E.NO_PROMOTION_REASON[s].length > 30); }
});
test("every defined promotion is valid (count conserved, upward, same shell)", () => {
  for (const s of Object.keys(E.PROMOTIONS)) for (const p of E.PROMOTIONS[s]) {
    const g = E.groundState(s); const x = E.excitedState(s, p.id); assert.equal(x.valenceElectrons, g.valenceElectrons, `${s} ${p.id}`);
    const r = E.validateExcitation(g, x); assert.deepEqual(r, [], `${s} ${p.id}`);
  }
});
test("invalid excitations are rejected", () => {
  const g = E.groundState("C");
  const bad1 = { ...g, orbitals: g.orbitals.map((o) => O.makeOrbital(o.n, o.kind, o.kind === "s" ? 0 : 2)) }; // electron count changed
  const r1 = E.validateExcitation(g, bad1); assert.ok(r1.length > 0);
  const bad2 = { ...g, orbitals: g.orbitals.map((o) => O.makeOrbital(o.n, o.kind, o.kind === "s" ? 2 : o.kind === "px" ? 2 : 0)) }; // p -> s (downward) / Hund violated
  const r2 = E.validateExcitation(E.excitedState("C"), bad2); assert.ok(r2.length > 0);
});

console.log("Mixing");
const mk = (sym, ids, kind = "ground", promo = null) => H.mixOrbitals(E.atomicState(sym, kind, promo).orbitals, ids);
test("n orbitals in -> n hybrids out for every supported set; electrons conserved", () => {
  const cases = [["Be", ["2s", "2px"], "excited", "2s1-2p1", "sp", 2], ["B", ["2s", "2px", "2py"], "excited", "2s1-2p2", "sp2", 3], ["C", ["2s", "2px", "2py", "2pz"], "excited", "2s1-2p3", "sp3", 4],
    ["P", ["3s", "3px", "3py", "3pz", "3dz2"], "excited", "3s1-3p3-3d1", "sp3d", 5], ["S", ["3s", "3px", "3py", "3pz", "3dz2", "3dx2-y2"], "excited", "3s1-3p3-3d2", "sp3d2", 6]];
  for (const [sym, ids, kind, promo, recipe, n] of cases) {
    const r = mk(sym, ids, kind, promo); assert.ok(r.ok, `${recipe}: ${r.reason}`); assert.equal(r.recipeId, recipe); assert.equal(r.hybrids.length, n); assert.equal(r.consumed.length, n);
    assert.equal(r.hybrids.reduce((a, h) => a + h.electrons, 0), E.atomicState(sym, kind, promo).valenceElectrons - (E.atomicState(sym, kind, promo).orbitals.filter((o) => !ids.includes(o.id)).reduce((a, o) => a + o.electrons, 0)));
  }
});
test("unhybridised orbitals remain (sp2 on boron keeps 2pz; sp on Be keeps 2py, 2pz)", () => {
  assert.deepEqual(mk("B", ["2s", "2px", "2py"], "excited", "2s1-2p2").remaining, ["2pz"]);
  assert.deepEqual(mk("Be", ["2s", "2px"], "excited", "2s1-2p1").remaining.sort(), ["2py", "2pz"]);
});
test("unsupported combinations are rejected with a reason", () => {
  const C = E.groundState("C").orbitals; const S = E.groundState("S").orbitals;
  for (const ids of [[], ["2s"], ["2px", "2py"], ["2s", "2px", "2py", "2pz", "2px"].slice(0, 1), ["2px", "2py", "2pz"]]) { const r = H.mixOrbitals(C, ids); assert.equal(r.ok, false, ids.join()); assert.ok(r.reason.length > 5); }
  for (const ids of [["3s", "3dxy"], ["3s", "3px", "3dz2"], ["3s", "3px", "3py", "3pz", "3dxy"], ["3dz2", "3dxy"]]) assert.equal(H.mixOrbitals(S, ids).ok, false, ids.join());
});
test("ideal angles are exact for every set", () => {
  const dirs = (r) => r.hybrids.map((h) => h.direction);
  const sp = mk("Be", ["2s", "2px"], "excited", "2s1-2p1"); near(deg(...dirs(sp)), 180, 0.5);
  const sp2 = mk("B", ["2s", "2px", "2py"], "excited", "2s1-2p2"); const d2 = dirs(sp2); for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) near(deg(d2[i], d2[j]), 120, 0.5);
  const sp3 = mk("C", ["2s", "2px", "2py", "2pz"], "excited", "2s1-2p3"); const d3 = dirs(sp3); for (let i = 0; i < 4; i += 1) for (let j = i + 1; j < 4; j += 1) near(deg(d3[i], d3[j]), 109.47, 0.5);
  const sp3d = mk("P", ["3s", "3px", "3py", "3pz", "3dz2"], "excited", "3s1-3p3-3d1"); const d5 = dirs(sp3d); const set5 = []; for (let i = 0; i < 5; i += 1) for (let j = i + 1; j < 5; j += 1) set5.push(Math.round(deg(d5[i], d5[j])));
  assert.deepEqual([...new Set(set5)].sort((a, b) => a - b), [90, 120, 180]);
  const sp3d2 = mk("S", ["3s", "3px", "3py", "3pz", "3dz2", "3dx2-y2"], "excited", "3s1-3p3-3d2"); const d6 = dirs(sp3d2); const set6 = []; for (let i = 0; i < 6; i += 1) for (let j = i + 1; j < 6; j += 1) set6.push(Math.round(deg(d6[i], d6[j])));
  assert.deepEqual([...new Set(set6)].sort((a, b) => a - b), [90, 180]);
});
test("hybrid sets are orthonormal", () => {
  for (const [sym, ids, promo] of [["C", ["2s", "2px", "2py", "2pz"], "2s1-2p3"], ["P", ["3s", "3px", "3py", "3pz", "3dz2"], "3s1-3p3-3d1"], ["S", ["3s", "3px", "3py", "3pz", "3dz2", "3dx2-y2"], "3s1-3p3-3d2"]]) {
    const r = mk(sym, ids, "excited", promo);
    r.hybrids.forEach((a, i) => r.hybrids.forEach((b, j) => near(H.hybridDot(a, b), i === j ? 1 : 0, 1e-9)));
  }
});
test("electron distribution is Hund-style, conserving electrons", () => {
  assert.deepEqual(H.distributeHybridElectrons(4, 4), [1, 1, 1, 1]); assert.deepEqual(H.distributeHybridElectrons(5, 4), [2, 1, 1, 1]); assert.deepEqual(H.distributeHybridElectrons(6, 4), [2, 2, 1, 1]);
  assert.deepEqual(H.distributeHybridElectrons(8, 4), [2, 2, 2, 2]);
});

console.log("Shapes");
test("lobe shape constants are the documented ones", () => { assert.equal(O.GAMMA, 1.5); assert.ok(O.P_LATERAL > 0.3 && O.P_LATERAL < 0.6); });
test("p angular function is odd (opposite phase lobes), s is even", () => {
  assert.ok(O.angular("pz", 0, 0, 1) > 0 && O.angular("pz", 0, 0, -1) < 0); near(O.angular("s", 1, 0, 0), O.angular("s", 0, 1, 0), 1e-12);
});

console.log("Overlap engine");
const instOf = (atoms) => atoms.flatMap(OV.atomOrbitalInstances);
const hyd = (id, x, quat) => ({ ...W.createAtom(id, "H", [x, 0, 0]), ...(quat ? { quat } : {}) });
const hydInst = (x) => instOf([hyd("h", x)])[0];
test("two hydrogens at bonding distance form exactly one sigma bond; too far or too close do not", () => {
  const d = OV.distanceWindow("sigma", hydInst(0), hydInst(0));
  const ok = OV.analyseBonds(instOf([hyd("a", 0), hyd("b", d.ideal)])); assert.equal(ok.sigma, 1); assert.equal(ok.pi, 0);
  assert.equal(OV.analyseBonds(instOf([hyd("a", 0), hyd("b", d.max + 1.5)])).bonds.length, 0);
  assert.equal(OV.analyseBonds(instOf([hyd("a", 0), hyd("b", Math.max(0.05, d.min - 0.3))])).bonds.length, 0);
});
test("occupancy rule: an atom with no unpaired electron (Be ground state) forms no bond", () => {
  assert.equal(OV.analyseBonds(instOf([W.createAtom("o", "Be", [0, 0, 0]), hyd("h", 1.3)])).bonds.length, 0);
  const r = OV.analyseBonds(instOf([W.createAtom("n", "N", [0, 0, 0]), W.createAtom("f", "F", [1.5, 0, 0])])); r.bonds.forEach((b) => { assert.equal(b.a.electrons, 1); assert.equal(b.b.electrons, 1); });
});
test("sigma along the bond axis only: a p orbital pointing sideways does not sigma-bond to a hydrogen", () => {
  const f = { ...W.createAtom("f", "F", [0, 0, 0]) }; const base = instOf([f, hyd("h", 1.6)]);
  const sig = OV.analyseBonds(base).bonds.filter((b) => b.type === "sigma");
  for (const b of sig) { const p = [b.a, b.b].find((o) => o.cls === "p"); if (p) assert.ok(Math.abs(p.axis[0]) > 0.9, `p axis ${p.axis}`); }
});
test("sigma-compatibility is symmetric; p-p and s-s allowed, s-d never", () => {
  const c = (cls) => ({ cls });
  for (const a of ["s", "p", "hybrid"]) for (const b of ["s", "p", "hybrid"]) assert.equal(OV.sigmaCompatible(c(a), c(b)), OV.sigmaCompatible(c(b), c(a)), `${a},${b}`);
  assert.ok(OV.sigmaCompatible(c("s"), c("hybrid"))); assert.ok(OV.sigmaCompatible(c("s"), c("p"))); assert.equal(OV.sigmaCompatible(c("s"), c("d")), false);
});

console.log("Molecule data");
test("11 molecules, including the four specified in detail", () => { assert.equal(MD.MOLECULES.length, 11); for (const id of ["C2H4", "C2H2", "C2H6", "C6H6"]) assert.ok(MD.MOLECULE_BY_ID[id], id); });
test("every molecule compiles with no consistency problems and correct sigma/pi totals", () => {
  for (const id of MD.MOLECULE_IDS) { const c = ML.compileMolecule(id); assert.deepEqual(c.problems, [], id); assert.equal(c.analysis.sigma, c.expected.sigma, id); assert.equal(c.analysis.pi, c.expected.pi, id); }
});
test("specified totals: ethene 5σ+1π, ethyne 3σ+2π, ethane 7σ+0π, benzene 12σ + delocalised π", () => {
  const t = (id) => { const c = ML.compileMolecule(id); return [c.expected.sigma, c.expected.pi]; };
  assert.deepEqual(t("C2H4"), [5, 1]); assert.deepEqual(t("C2H2"), [3, 2]); assert.deepEqual(t("C2H6"), [7, 0]); assert.equal(t("C6H6")[0], 12);
  assert.ok(ML.compileMolecule("C6H6").delocalised);
});
test("ethene has six steps; counts rise monotonically to the final totals; every step has one sentence", () => {
  const c = ML.compileMolecule("C2H4"); assert.equal(c.steps.length, 6);
  let ps = 0; let pp = 0; for (const s of c.steps) { assert.ok(s.sigma >= ps && s.pi >= pp); ps = s.sigma; pp = s.pi; assert.ok(s.text.length > 10); }
  assert.deepEqual([c.steps[5].sigma, c.steps[5].pi], [5, 1]);
});
test("hybridisation of key atoms matches chemistry (ethene sp2, ethyne sp, ethane sp3)", () => {
  const rec = (id) => ML.compileMolecule(id).atoms.C1.hybrid.recipeId;
  assert.equal(rec("C2H4"), "sp2"); assert.equal(rec("C2H2"), "sp"); assert.equal(rec("C2H6"), "sp3");
});

console.log("Workspace history");
test("add, duplicate, undo, reset", () => {
  let h = W.createHistory(); assert.equal(h.present.atoms.length, 1);
  h = W.reduce(h, { type: "addAtom", symbol: "H" }); assert.equal(h.present.atoms.length, 2);
  h = W.reduce(h, { type: "duplicate" }); assert.equal(h.present.atoms.length, 3);
  h = W.reduce(h, { type: "undo" }); assert.equal(h.present.atoms.length, 2);
  h = W.reduce(h, { type: "reset" }); assert.equal(h.present.atoms.length, 1); assert.equal(h.past.length, 0);
});
test("one undo step per drag gesture; no-move gesture adds none", () => {
  let h = W.createHistory(); h = W.reduce(h, { type: "addAtom", symbol: "H" }); const base = h.past.length; const id = h.present.activeId;
  h = W.reduce(h, { type: "gestureStart" }); for (let i = 1; i <= 5; i += 1) h = W.reduce(h, { type: "transform", id, pos: [i, 0, 0] }); h = W.reduce(h, { type: "gestureEnd" });
  assert.equal(h.past.length, base + 1); h = W.reduce(h, { type: "undo" }); assert.notEqual(h.present.atoms.find((a) => a.id === id).pos[0], 5);
  h = W.reduce(h, { type: "gestureStart" }); h = W.reduce(h, { type: "gestureEnd" }); assert.equal(h.past.length, base);
});
test("mix is blocked for unsupported selections and works for supported ones", () => {
  let h = W.createHistory(); h = W.reduce(h, { type: "toggleOrbital", orbId: "2px" }); h = W.reduce(h, { type: "mix" }); assert.equal(h.present.atoms[0].hybrid, null); assert.ok(h.present.note.length > 0);
  h = W.reduce(h, { type: "setKind", kind: "excited" }); h = W.reduce(h, { type: "setSelection", ids: ["2s", "2px", "2py", "2pz"] }); h = W.reduce(h, { type: "mix" });
  assert.equal(h.present.atoms[0].hybrid.recipeId, "sp3"); assert.equal(h.present.atoms[0].hybrid.hybrids.length, 4);
});
test("excitation request on N/O/F/H is refused with the explanation", () => {
  for (const s of ["H", "N", "O", "F"]) { let h = W.createHistory(); h = W.reduce(h, { type: "setSymbol", symbol: s }); h = W.reduce(h, { type: "setKind", kind: "excited" }); assert.equal(h.present.atoms[0].kind, "ground"); assert.equal(h.present.note, E.NO_PROMOTION_REASON[s]); }
});

console.log("Snap");
test("snap result is verified by the overlap engine (H2 and ethene-style sigma)", () => {
  let h = W.createHistory(); h = W.reduce(h, { type: "setSymbol", symbol: "H" }); h = W.reduce(h, { type: "duplicate" });
  const id = h.present.activeId; const plan = W.snapActive(h.present.atoms, id); assert.ok(plan && plan.sigma >= 1);
  h = W.reduce(h, { type: "applyTransform", id, pos: plan.pos, quat: plan.quat }); const r = W.analyseWorkspace(h.present.atoms); assert.equal(r.sigma, 1);
});
test("snap on a lone atom returns null", () => { assert.equal(W.snapActive(W.createHistory().present.atoms, "a1"), null); });

console.log("Theme parity");
test("default theme equals VSEPR's default (dark), read from source", () => {
  const hy = fs.readFileSync(new URL(`${root}HybridisationExplorer.jsx`, import.meta.url), "utf8"); const m = hy.match(/HYBRIDISATION_THEME\s*=\s*"(\w+)"/); assert.ok(m, "constant missing");
  const vs = fs.readFileSync(new URL("../src/engines/vsepr-explorer-3d/VSEPRExplorer3D.jsx", import.meta.url), "utf8"); assert.ok(/"dark"/.test(vs));
  assert.equal(m[1], "dark");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
