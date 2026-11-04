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
const SF = await import(`${root}model/surface.js`);
const OVV = await import(`${root}model/overlapVolume.js`);
const VM = await import(`${root}scene/viewModel.js`);
const OF = await import(`${root}scene/orbitalField.js`);
const SV = await import(`${root}scene/stepView.js`);
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
test("surface exponents are the documented ones (s sphere K=1, p/d 2.3, hybrid 2.0)", () => { assert.deepEqual(O.SURFACE_K, { s: 1, p: 2.3, hybrid: 2.0, d: 2.3 }); assert.ok(O.DRAW_WIDTH.hybrid < 1); });
const hybOf = (sym, ids, promo) => mk(sym, ids, "excited", promo).hybrids;
const bigSmall = (h) => { const t = H.termsToKinds(h.terms); const sf = SF.makeSurface(t, "hybrid", 1); const d = h.direction; return { sf, big: sf.at(d[0], d[1], d[2]), small: sf.at(-d[0], -d[1], -d[2]), t }; };
const HYB_CASES = [["sp", "Be", ["2s", "2px"], "2s1-2p1", 2, 0.2679], ["sp2", "B", ["2s", "2px", "2py"], "2s1-2p2", 3, 0.42020], ["sp3", "C", ["2s", "2px", "2py", "2pz"], "2s1-2p3", 4, 0.5]];
test("sp / sp2 / sp3 surfaces: one big lobe along the hybrid axis, one small lobe opposite, with the ratio of the real coefficients", () => {
  for (const [name, sym, ids, promo, n, fr] of HYB_CASES) {
    const hs = hybOf(sym, ids, promo); assert.equal(hs.length, n, name);
    for (const h of hs) {
      const { sf, big, small } = bigSmall(h); assert.ok(big > 0 && small < 0, `${name}: opposite phase`);
      const f = (d) => sf.f(d[0], d[1], d[2]); const fr0 = Math.abs(f(h.direction.map((x) => -x))) / f(h.direction); near(fr0, fr, 2e-3);
      near(Math.abs(small) / big, fr0 ** O.SURFACE_K.hybrid, 2e-3); near(big, 1, 1e-3); // the big lobe peaks at R along the hybrid axis
      const pk = SF.lobePeaks(sf); near(deg(pk.pos.dir, h.direction), 0, 0.5); near(deg(pk.neg.dir, h.direction), 180, 0.5);
    }
  }
});
test("p surface is pinched at the nucleus: r = 0 at 90 degrees off axis, two equal opposite-phase lobes", () => {
  const sf = SF.makeSurface([["pz", 1]], "p", 1); near(sf.at(1, 0, 0), 0, 1e-9); near(sf.at(0, 1, 0), 0, 1e-9); near(sf.at(Math.SQRT1_2, 0, Math.SQRT1_2), sf.at(Math.SQRT1_2, 0, Math.SQRT1_2), 0);
  near(sf.at(0, 0, 1), 1, 1e-9); near(sf.at(0, 0, -1), -1, 1e-9); assert.ok(Math.abs(sf.at(Math.sin(1.4), 0, Math.cos(1.4))) < 0.12, "narrow close to the equator");
});
test("lobe count per orbital type: s 1, p 2, hybrids 2 (big + small), dxy 4, dz2 3", () => {
  assert.equal(SF.lobeCount([["s", 1]]), 1); for (const k of ["px", "py", "pz"]) assert.equal(SF.lobeCount([[k, 1]]), 2);
  for (const [, sym, ids, promo] of HYB_CASES) for (const h of hybOf(sym, ids, promo)) assert.equal(SF.lobeCount(H.termsToKinds(h.terms)), 2);
  assert.equal(SF.lobeCount([["dxy", 1]]), 4); assert.equal(SF.lobeCount([["dz2", 1]]), 3);
});
test("mixing conserves the number of orbitals and ends at the exact ideal angles", () => {
  for (const [name, sym, ids, promo, n, ] of HYB_CASES) {
    const r = mk(sym, ids, "excited", promo); assert.equal(r.hybrids.length, ids.length, name); assert.equal(r.consumed.length, ids.length);
    const ideal = { sp: 180, sp2: 120, sp3: 109.4712206 }[name]; const d = r.hybrids.map((h) => h.direction);
    for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) near(deg(d[i], d[j]), ideal, 1e-4);
  }
  const un = (sym, ids, promo) => mk(sym, ids, "excited", promo).hybrids.length;
  assert.equal(un("Be", ["2s", "2px"], "2s1-2p1"), 2);
});
test("colour mapping: s red/orange, px blue, py green, pz purple, d own colour, every hybrid of a set a distinct palette", () => {
  assert.deepEqual(["s", "px", "py", "pz", "dxy", "dz2"].map(VM.paletteOf), ["s", "px", "py", "pz", "d", "d"]);
  assert.deepEqual(O.COLOUR_NAMES, { s: "red/orange", px: "blue", py: "green", pz: "purple", d: "teal/gold" });
  assert.equal(new Set([0, 1, 2, 3].map(VM.hybridPalette)).size, 4);
  const css = fs.readFileSync(new URL(`${root}HybridisationExplorer.css`, import.meta.url), "utf8");
  for (const n of ["s", "px", "py", "pz", "d", "h0", "h1", "h2", "h3"]) assert.ok(css.includes(`-${n}-pos`) && css.includes(`-${n}-neg`), `css colours for ${n}`);
});
test("morph endpoints: the blended field equals the source at t=0 and the hybrid at t=1 (same code path as the static meshes)", () => {
  const h0 = hybOf("C", ["2s", "2px", "2py", "2pz"], "2s1-2p3")[0]; const tgt = H.termsToKinds(h0.terms);
  const src = [["px", 1]]; const V = OF.GRID.V; const a = new Float32Array(V); const tmp = new Float32Array(V);
  const Rs = 1.3; const Rt = 1.05; const Ks = O.SURFACE_K.p; const Kt = O.SURFACE_K.hybrid;
  const p0 = SF.blendedSurfaceParams({ terms: src, R: Rs, k: Ks, cls: "p" }, { terms: tgt, R: Rt, k: Kt, cls: "hybrid" }, 0);
  OF.fillField(p0.terms, p0.R, p0.k, a, tmp); assert.deepEqual([...a], [...OF.signedField(src, Rs, Ks)]);
  const p1 = SF.blendedSurfaceParams({ terms: src, R: Rs, k: Ks, cls: "p" }, { terms: tgt, R: Rt, k: Kt, cls: "hybrid" }, 1);
  OF.fillField(p1.terms, p1.R, p1.k, a, tmp); assert.deepEqual([...a], [...OF.signedField(tgt, Rt, Kt)]);
  assert.equal(SF.morphParameter(0), 0); assert.equal(SF.morphParameter(1), 1); assert.equal(SF.morphParameter(0.1), 0);
  let prev = -1; for (let i = 0; i <= 20; i += 1) { const m = SF.morphParameter(i / 20); assert.ok(m >= prev); prev = m; }
});
test("morph passes through a genuine intermediate shape (not a cross-fade of two meshes)", () => {
  const h0 = hybOf("C", ["2s", "2px", "2py", "2pz"], "2s1-2p3")[0]; const mid = SF.blendTerms([["s", 1]], H.termsToKinds(h0.terms), 0.5);
  const sf = SF.makeSurface(mid, "hybrid", 1, 2); const pk = SF.lobePeaks(sf); assert.ok(pk.pos.r > 0.99); assert.ok(pk.neg ? pk.neg.r < pk.pos.r : true);
});
test("overlap measure: monotonic with distance, zero when misaligned, signed negative for out-of-phase", () => {
  const C = W.createAtom("c", "C", [0, 0, 0]); const pz = OV.atomOrbitalInstances(C).find((o) => o.kind === "pz");
  const hAt = (x, y, z, quat) => OV.atomOrbitalInstances({ ...W.createAtom("h", "H", [x, y, z]), ...(quat ? { quat } : {}) })[0];
  const ds = [0.7, 0.9, 1.1, 1.3, 1.5, 1.8, 2.2]; const ms = ds.map((d) => OVV.overlapBetween(pz, hAt(0, 0, d)).measure);
  for (let i = 1; i < ms.length; i += 1) assert.ok(ms[i] <= ms[i - 1] + 1e-9, `non-increasing ${ms.join()}`); assert.ok(ms[0] > 0.1); assert.equal(ms.at(-1), 0);
  near(OVV.overlapBetween(pz, hAt(1.0, 0, 0)).measure, 0, 0.02); // sideways approach to a p orbital: in-phase = out-of-phase
  const s2 = [0.6, 0.8, 1.0, 1.2, 1.4].map((d) => OVV.overlapBetween(hAt(0, 0, 0), hAt(d, 0, 0)).measure); for (let i = 1; i < s2.length; i += 1) assert.ok(s2[i] <= s2[i - 1] + 1e-9);
  const strengths = ds.map((d, i) => OVV.highlightStrength(ms[i])); for (let i = 1; i < strengths.length; i += 1) assert.ok(strengths[i] <= strengths[i - 1] + 1e-9);
  assert.equal(OVV.highlightStrength(0), 0); assert.equal(OVV.highlightStrength(1), 1);
});
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
test("ethene has five steps (sp2 + 2pz separated, sigma pair, pi, H + 4 C-H sigma, complete); counts rise monotonically to the final totals", () => {
  const c = ML.compileMolecule("C2H4"); assert.equal(c.steps.length, 5);
  assert.deepEqual(c.steps.map((s) => [s.sigma, s.pi]), [[0, 0], [1, 0], [1, 1], [5, 1], [5, 1]]);
  let ps = 0; let pp = 0; for (const s of c.steps) { assert.ok(s.sigma >= ps && s.pi >= pp); ps = s.sigma; pp = s.pi; assert.ok(s.text.length > 10); }
  assert.deepEqual([c.steps[4].sigma, c.steps[4].pi], [5, 1]);
});
test("ethyne has six steps (sp + 2py/2pz, sigma, pi-y, pi-z, H + 2 C-H sigma, complete) ending 3 sigma + 2 pi; no molecule has compile problems", () => {
  const c = ML.compileMolecule("C2H2"); assert.equal(c.steps.length, 6); assert.deepEqual(c.steps.map((s) => [s.sigma, s.pi]), [[0, 0], [1, 0], [1, 1], [1, 2], [3, 2], [3, 2]]);
  for (const id of MD.MOLECULE_IDS) assert.deepEqual(ML.compileMolecule(id).problems ?? [], [], id);
});
test("step views: every step of every molecule asks only for geometries the warm-up list contains", () => {
  for (const id of MD.MOLECULE_IDS) { const c = ML.compileMolecule(id); const all = new Set(SV.geometryRequests(c).map((r) => `${r.R.toFixed(3)}|${r.palette}|${r.terms.map(([k, v]) => `${k}:${v.toFixed(5)}`).join('+')}`)); for (let i = 0; i < c.steps.length; i += 1) for (const a of SV.stepView(c, i, 0).atoms) for (const o of a.orbitals) assert.ok(all.has(`${o.R.toFixed(3)}|${o.palette}|${o.terms.map(([k, v]) => `${k}:${v.toFixed(5)}`).join('+')}`), `${id} step ${i}`); }
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
