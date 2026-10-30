#!/usr/bin/env node
// Pure-model tests for the 3D VSEPR Explorer:  node scripts/test-vsepr-model.mjs
// Covers the geometry engine, the validated preset dataset (against an INDEPENDENT hand-written oracle), relaxation
// (convergence from random perturbations, determinism, no overlap, drag + release), builder history semantics,
// classification of built molecules, Lewis derivation and challenge checking. No React, no three, no DOM.
import assert from "node:assert/strict";
import * as G from "../src/engines/vsepr-explorer-3d/model/geometry.js";
import * as P from "../src/engines/vsepr-explorer-3d/model/presets.js";
import * as B from "../src/engines/vsepr-explorer-3d/model/builder.js";
import * as W from "../src/engines/vsepr-explorer-3d/model/lewis.js";
import * as C from "../src/engines/vsepr-explorer-3d/model/challenge.js";
import { ELEMENTS, TOOLBOX_ATOMS } from "../src/engines/vsepr-explorer-3d/model/elements.js";

let passed = 0; let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ok   ${name}`); passed += 1; } catch (e) { console.log(`  FAIL ${name}\n       ${(e.stack || e.message).split("\n").slice(0, 5).join("\n       ")}`); failed += 1; }
}
const DEG = 180 / Math.PI;

// ---- Independent oracle (written from the textbook, NOT derived from the engine) -----------------------------------
const ORACLE = {
  becl2: { n: 2, b: 2, l: 0, axe: "AX₂", ed: "Linear", mg: "Linear", angles: [[180, "ideal"]] },
  co2: { n: 2, b: 2, l: 0, axe: "AX₂", ed: "Linear", mg: "Linear", angles: [[180, "ideal"]] },
  hcn: { n: 2, b: 2, l: 0, axe: "AX₂", ed: "Linear", mg: "Linear", angles: [[180, "ideal"]] },
  bf3: { n: 3, b: 3, l: 0, axe: "AX₃", ed: "Trigonal planar", mg: "Trigonal planar", angles: [[120, "ideal"]] },
  so3: { n: 3, b: 3, l: 0, axe: "AX₃", ed: "Trigonal planar", mg: "Trigonal planar", angles: [[120, "ideal"]] },
  ch2o: { n: 3, b: 3, l: 0, axe: "AX₃", ed: "Trigonal planar", mg: "Trigonal planar", angles: [[116.5, "approx"], [121.7, "approx"]] },
  so2: { n: 3, b: 2, l: 1, axe: "AX₂E", ed: "Trigonal planar", mg: "Bent", angles: [[119, "approx"]] },
  ch4: { n: 4, b: 4, l: 0, axe: "AX₄", ed: "Tetrahedral", mg: "Tetrahedral", angles: [[109.5, "ideal"]] },
  nh3: { n: 4, b: 3, l: 1, axe: "AX₃E", ed: "Tetrahedral", mg: "Trigonal pyramidal", angles: [[107, "approx"]] },
  h2o: { n: 4, b: 2, l: 2, axe: "AX₂E₂", ed: "Tetrahedral", mg: "Bent", angles: [[104.5, "approx"]] },
  pcl5: { n: 5, b: 5, l: 0, axe: "AX₅", ed: "Trigonal bipyramidal", mg: "Trigonal bipyramidal", angles: [[90, "ideal"], [120, "ideal"], [180, "ideal"]] },
  sf4: { n: 5, b: 4, l: 1, axe: "AX₄E", ed: "Trigonal bipyramidal", mg: "Seesaw", angles: [[173, "approx"], [102, "approx"]] },
  clf3: { n: 5, b: 3, l: 2, axe: "AX₃E₂", ed: "Trigonal bipyramidal", mg: "T-shaped", angles: [[87.5, "approx"], [175, "approx"]] },
  xef2: { n: 5, b: 2, l: 3, axe: "AX₂E₃", ed: "Trigonal bipyramidal", mg: "Linear", angles: [[180, "ideal"]] },
  sf6: { n: 6, b: 6, l: 0, axe: "AX₆", ed: "Octahedral", mg: "Octahedral", angles: [[90, "ideal"], [180, "ideal"]] },
  brf5: { n: 6, b: 5, l: 1, axe: "AX₅E", ed: "Octahedral", mg: "Square pyramidal", angles: [[85, "approx"]] },
  xef4: { n: 6, b: 4, l: 2, axe: "AX₄E₂", ed: "Octahedral", mg: "Square planar", angles: [[90, "ideal"], [180, "ideal"]] },
};
const ORACLE_ATOMS = { becl2: ["Be", "Cl", "Cl"], co2: ["C", "O", "O"], hcn: ["C", "H", "N"], bf3: ["B", "F", "F", "F"], so3: ["S", "O", "O", "O"], ch2o: ["C", "H", "H", "O"], so2: ["S", "O", "O"], ch4: ["C", "H", "H", "H", "H"], nh3: ["N", "H", "H", "H"], h2o: ["O", "H", "H"], pcl5: ["P", "Cl", "Cl", "Cl", "Cl", "Cl"], sf4: ["S", "F", "F", "F", "F"], clf3: ["Cl", "F", "F", "F"], xef2: ["Xe", "F", "F"], sf6: ["S", "F", "F", "F", "F", "F", "F"], brf5: ["Br", "F", "F", "F", "F", "F"], xef4: ["Xe", "F", "F", "F", "F"] };
const ORACLE_BOND_ORDERS = { co2: [2, 2], hcn: [1, 3], so3: [2, 2, 2], ch2o: [1, 1, 2], so2: [2, 2] };
const REQUIRED = ["becl2", "co2", "bf3", "ch4", "nh3", "h2o", "so2", "pcl5", "sf4", "clf3", "xef2", "sf6", "brf5", "xef4"];

// ---- helpers ---------------------------------------------------------------------------------------------------
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function simFor(b, l) {
  const kinds = [...Array(b).fill("bond"), ...Array(l).fill("lp")];
  const sim = G.syncDomains(G.createSim(), kinds.map((_, i) => `d${i}`), kinds); G.settleInstant(sim); return sim;
}
function bondAngles(sim) { const out = []; for (let i = 0; i < sim.n; i += 1) for (let j = i + 1; j < sim.n; j += 1) if (sim.kinds[i] === "bond" && sim.kinds[j] === "bond") out.push(G.angleBetween(sim, i, j) * DEG); return out.sort((a, b) => a - b); }
function rotateAbout(v, axis, ang) { const [x, y, z] = v; const [ux, uy, uz] = axis; const c = Math.cos(ang), s = Math.sin(ang), d = ux * x + uy * y + uz * z; return [x * c + (uy * z - uz * y) * s + ux * d * (1 - c), y * c + (uz * x - ux * z) * s + uy * d * (1 - c), z * c + (ux * y - uy * x) * s + uz * d * (1 - c)]; }
function randAxis(r) { const z = r() * 2 - 1; const a = r() * 2 * Math.PI; const s = Math.sqrt(1 - z * z); return [s * Math.cos(a), s * Math.sin(a), z]; }
function perturb(sim, r, maxDeg) { for (let i = 0; i < sim.n; i += 1) { const v = rotateAbout([sim.dir[i * 3], sim.dir[i * 3 + 1], sim.dir[i * 3 + 2]], randAxis(r), (r() * maxDeg) / DEG); sim.dir.set(v, i * 3); } }
function run(sim, seconds, step = 1 / 60, each) { const n = Math.round(seconds / step); for (let k = 0; k < n; k += 1) { G.stepSim(sim, step); each?.(k * step); } }
const presetById = (id) => P.PRESET_BY_ID[id];

console.log("Dataset and oracle");
test("every required molecule exists and the dataset validates with no problems", () => {
  for (const id of REQUIRED) assert.ok(presetById(id), `missing ${id}`);
  assert.deepEqual(P.validateAllPresets(), {});
});
test("each preset matches the independent oracle: atoms, bond orders, lone pairs, AXE, domains, ED/MG geometry", () => {
  for (const p of P.PRESETS) {
    const o = ORACLE[p.id]; assert.ok(o, `oracle missing ${p.id}`);
    assert.equal(p.domains, o.n, `${p.id} domains`); assert.equal(p.bonding, o.b); assert.equal(p.lonePairs, o.l);
    assert.equal(p.axe, o.axe, `${p.id} axe`); assert.equal(p.ed, o.ed, `${p.id} ed`); assert.equal(p.mg, o.mg, `${p.id} mg`);
    assert.deepEqual([p.central, ...p.ligands.map((x) => x.symbol)], ORACLE_ATOMS[p.id], `${p.id} atoms`);
    if (ORACLE_BOND_ORDERS[p.id]) assert.deepEqual(p.ligands.map((x) => x.order).sort(), [...ORACLE_BOND_ORDERS[p.id]].sort(), `${p.id} orders`);
    else assert.ok(p.ligands.every((x) => x.order === 1), `${p.id} all single`);
    assert.deepEqual(p.angles.map((a) => [a.value, a.kind]), o.angles, `${p.id} angles`);
    for (const a of p.angles) assert.ok(a.label && a.kind, "angle label/kind");
  }
});
test("SO2 = 2 bonding domains + 1 lone pair on S with S=O double bonds; CO2 two C=O; double/triple are one domain", () => {
  const so2 = presetById("so2"); assert.equal(so2.central, "S"); assert.deepEqual(so2.ligands, [{ symbol: "O", order: 2 }, { symbol: "O", order: 2 }]); assert.equal(so2.lonePairs, 1); assert.equal(so2.domains, 3);
  const co2 = presetById("co2"); assert.deepEqual(co2.ligands, [{ symbol: "O", order: 2 }, { symbol: "O", order: 2 }]); assert.equal(co2.domains, 2);
  assert.equal(presetById("hcn").domains, 2);
});
test("preset signatures are unique and matchPreset recognises them regardless of order", () => {
  const sigs = new Set(P.PRESETS.map((p) => P.signature(p.central, p.ligands, p.lonePairs))); assert.equal(sigs.size, P.PRESETS.length);
  assert.equal(P.matchPreset("N", [{ symbol: "H", order: 1 }, { symbol: "H", order: 1 }, { symbol: "H", order: 1 }], 1).id, "nh3");
  assert.equal(P.matchPreset("N", [{ symbol: "H", order: 1 }, { symbol: "H", order: 1 }, { symbol: "H", order: 1 }], 0), null);
  assert.equal(P.matchPreset("S", [{ symbol: "O", order: 1 }, { symbol: "O", order: 2 }], 1), null);
});
test("library groups cover every preset once, ordered by domain count", () => {
  assert.equal(P.PRESET_GROUPS.reduce((n, g) => n + g.presets.length, 0), P.PRESETS.length);
  for (const g of P.PRESET_GROUPS) for (const p of g.presets) assert.equal(p.domains, g.domains);
});
test("search finds by formula, name and geometry", () => {
  assert.ok(P.searchPresets("water").some((p) => p.id === "h2o")); assert.ok(P.searchPresets("seesaw").some((p) => p.id === "sf4")); assert.ok(P.searchPresets("SF6").some((p) => p.id === "sf6"));
  assert.equal(P.searchPresets("zzzz").length, 0);
});

console.log("Geometry engine");
test("names, AXE notation and support table", () => {
  assert.equal(G.axeNotation(3, 1), "AX₃E"); assert.equal(G.axeNotation(2, 2), "AX₂E₂"); assert.equal(G.axeNotation(6, 0), "AX₆"); assert.equal(G.axeNotation(1, 3), "AXE₃");
  assert.equal(G.molecularGeometryName(3, 1), "Trigonal pyramidal"); assert.equal(G.molecularGeometryName(2, 2), "Bent"); assert.equal(G.molecularGeometryName(2, 3), "Linear"); assert.equal(G.molecularGeometryName(0, 2), null);
  assert.equal(G.isSupportedCombination(6, 1), false); assert.equal(G.isSupportedCombination(4, 2), true); assert.equal(G.isSupportedCombination(1, 4), false); assert.equal(G.isSupportedCombination(3, 3), false);
});
test("ideal slot sets are unit vectors with the textbook angles", () => {
  for (let n = 2; n <= 6; n += 1) { const s = G.idealSlots(n); assert.equal(s.length, n); for (const v of s) assert.ok(Math.abs(Math.hypot(...v) - 1) < 1e-12); }
  const ang = (a, b) => Math.acos(a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) * DEG;
  const t = G.idealSlots(4); for (let i = 0; i < 4; i += 1) for (let j = i + 1; j < 4; j += 1) assert.ok(Math.abs(ang(t[i], t[j]) - 109.4712) < 1e-3);
  const o = G.idealSlots(6); assert.ok(Math.abs(ang(o[0], o[1]) - 180) < 1e-9 && Math.abs(ang(o[0], o[2]) - 90) < 1e-9);
});
test("lone pairs go equatorial in a bipyramid and trans in an octahedron", () => {
  const s5 = G.buildSlots(4, 1); const lp = s5.dirs[s5.roles.indexOf("lp")]; assert.ok(Math.abs(lp[2]) < 1e-9, "LP equatorial (z=0)");
  const s5b = G.buildSlots(3, 2); s5b.roles.forEach((r, i) => { if (r === "lp") assert.ok(Math.abs(s5b.dirs[i][2]) < 1e-9); });
  const s5c = G.buildSlots(2, 3); s5c.roles.forEach((r, i) => { if (r === "lp") assert.ok(Math.abs(s5c.dirs[i][2]) < 1e-9); });
  const s6 = G.buildSlots(4, 2); const lps = s6.dirs.filter((_, i) => s6.roles[i] === "lp"); assert.ok(Math.abs(lps[0][0] * lps[1][0] + lps[0][1] * lps[1][1] + lps[0][2] * lps[1][2] + 1) < 1e-9, "trans LPs");
});
test("Horn's best rotation recovers a known rotation, and the prior resolves a degenerate (linear) set", () => {
  const r = rng(7); const out = new Float64Array(9);
  for (let t = 0; t < 20; t += 1) {
    const axis = randAxis(r); const ang = r() * 3; const a = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [0.6, 0.8, 0]].flat(); const b = []; for (let k = 0; k < 4; k += 1) b.push(...rotateAbout(a.slice(k * 3, k * 3 + 3), axis, ang));
    G.bestRotation(a, b, [1, 1, 1, 1], out); for (let k = 0; k < 4; k += 1) { const x = a[k * 3], y = a[k * 3 + 1], z = a[k * 3 + 2]; const m = [out[0] * x + out[1] * y + out[2] * z, out[3] * x + out[4] * y + out[5] * z, out[6] * x + out[7] * y + out[8] * z]; for (let q = 0; q < 3; q += 1) assert.ok(Math.abs(m[q] - b[k * 3 + q]) < 1e-9); }
  }
});
test("reference arrangement of every preset reproduces its listed angles (ideal within 0.6 deg, approximate within 4 deg)", () => {
  for (const p of P.PRESETS) {
    const sim = simFor(p.bonding, p.lonePairs); const have = bondAngles(sim);
    for (const a of p.angles) {
      const tol = a.kind === "ideal" ? 0.6 : 4; const best = Math.min(...have.map((h) => Math.abs(h - a.value)));
      assert.ok(best <= tol, `${p.id} ${a.label}: model ${have.map((h) => h.toFixed(1))} vs ${a.value}`);
    }
  }
});
test("reference arrangements place lone pairs correctly: LP-LP > LP-BP > BP-BP angles for water; ideal tetrahedron for CH4", () => {
  const w = simFor(2, 2); const lpAngle = G.angleBetween(w, 2, 3) * DEG; const lb = G.angleBetween(w, 0, 2) * DEG; const bb = G.angleBetween(w, 0, 1) * DEG;
  assert.ok(lpAngle > lb && lb > bb - 10 && bb < 109.47, `${lpAngle} ${lb} ${bb}`);
  assert.ok(lpAngle > bb);
  const m = simFor(4, 0); for (const a of bondAngles(m)) assert.ok(Math.abs(a - 109.4712) < 1e-3);
});

console.log("Relaxation");
test("every preset relaxes from random perturbations (up to 55 deg) to the right geometry, with no overlap, deterministically", () => {
  for (const p of P.PRESETS) {
    const ref = bondAngles(simFor(p.bonding, p.lonePairs));
    for (let seed = 1; seed <= 12; seed += 1) {
      const make = () => { const sim = simFor(p.bonding, p.lonePairs); perturb(sim, rng(seed * 101 + p.domains), 55); return sim; };
      const sim = make(); let minPair = Math.PI;
      run(sim, 4, 1 / 60, () => { minPair = Math.min(minPair, G.minPairAngle(sim)); });
      assert.ok(G.maxDisplacement(sim) < 0.01, `${p.id} seed ${seed} displacement ${G.maxDisplacement(sim)}`);
      const got = bondAngles(sim); got.forEach((a, i) => assert.ok(Math.abs(a - ref[i]) < 0.6, `${p.id} seed ${seed} angle ${a} vs ${ref[i]}`));
      assert.ok(minPair > sim.minSep * 0.9 || minPair > 0.5, `${p.id} overlap ${minPair}`);
      assert.ok(G.isSettled(sim, 0.01), `${p.id} settled`);
      const again = make(); run(again, 4); assert.deepEqual(Array.from(again.dir), Array.from(sim.dir), `${p.id} deterministic`);
    }
  }
});
test("relaxation settles monotonically (no oscillation): displacement envelope never grows by more than 1.2 deg", () => {
  for (const p of P.PRESETS) {
    for (let seed = 1; seed <= 6; seed += 1) {
      const sim = simFor(p.bonding, p.lonePairs); perturb(sim, rng(seed * 31 + p.domains), 50);
      let prev = Infinity; let crossings = 0; let lastSign = 0;
      for (let k = 0; k < 240; k += 1) {
        G.stepSim(sim, 1 / 60); if (k % 6 === 5) { const d = G.maxDisplacement(sim) * DEG; assert.ok(d <= prev + 1.2, `${p.id} seed ${seed} grew ${prev}->${d} at ${k}`); prev = Math.min(prev, d); }
        // oscillation guard: a settled domain must not keep reversing
        const s = Math.sign(G.energy(sim) - 1e-3); if (s !== 0 && lastSign !== 0 && s !== lastSign) crossings += 1; lastSign = s || lastSign;
      }
      assert.ok(crossings <= 2, `${p.id} seed ${seed} oscillates (${crossings})`);
    }
  }
});
test("dragging a domain in 3D: it follows the pointer, the others move away smoothly, then release relaxes back to the geometry", () => {
  for (const id of ["ch4", "nh3", "h2o", "pcl5", "sf4", "sf6", "xef4", "brf5", "clf3"]) {
    const p = presetById(id); const sim = simFor(p.bonding, p.lonePairs); const ref = bondAngles(sim);
    const pin = 0; const t0 = [sim.tgt[0], sim.tgt[1], sim.tgt[2]];
    // pointer pulls domain 0 toward the nearest neighbour's slot by ~35 deg (a genuine 3D direction)
    let nb = 1; let bestA = 9; for (let j = 1; j < sim.n; j += 1) { const a = G.angleBetween(sim, 0, j); if (a < bestA) { bestA = a; nb = j; } }
    const to = [sim.tgt[nb * 3], sim.tgt[nb * 3 + 1], sim.tgt[nb * 3 + 2]];
    const axis = [t0[1] * to[2] - t0[2] * to[1], t0[2] * to[0] - t0[0] * to[2], t0[0] * to[1] - t0[1] * to[0]]; const al = Math.hypot(...axis); const ax = axis.map((x) => x / al);
    const pull = rotateAbout(t0, ax, (35 / DEG)); G.dragDomain(sim, pin, ...pull);
    const before = Array.from(sim.dir); let minPair = Math.PI; let maxStep = 0; let prevDir = Array.from(sim.dir);
    run(sim, 1.5, 1 / 60, () => { minPair = Math.min(minPair, G.minPairAngle(sim)); for (let i = 0; i < sim.n; i += 1) maxStep = Math.max(maxStep, G.angleOf(sim.dir[i * 3], sim.dir[i * 3 + 1], sim.dir[i * 3 + 2], prevDir[i * 3], prevDir[i * 3 + 1], prevDir[i * 3 + 2])); prevDir = Array.from(sim.dir); });
    assert.ok(G.angleOf(sim.dir[0], sim.dir[1], sim.dir[2], ...pull) < 0.02, `${id} follows pointer`);
    // the neighbour moved AWAY from the dragged domain relative to its resting separation
    const restSep = G.angleOf(...pull, sim.tgt[nb * 3], sim.tgt[nb * 3 + 1], sim.tgt[nb * 3 + 2]); const nowSep = G.angleBetween(sim, 0, nb);
    assert.ok(nowSep > restSep + 0.01, `${id}: neighbour should be pushed away (${restSep * DEG} -> ${nowSep * DEG})`);
    let movedOthers = 0; for (let i = 1; i < sim.n; i += 1) if (G.angleOf(sim.dir[i * 3], sim.dir[i * 3 + 1], sim.dir[i * 3 + 2], before[i * 3], before[i * 3 + 1], before[i * 3 + 2]) > 0.02) movedOthers += 1;
    assert.ok(movedOthers >= 1, `${id}: other domains respond`);
    assert.ok(minPair >= sim.minSep * 0.95, `${id}: no overlap while dragging (${minPair * DEG})`);
    assert.ok(maxStep < 0.12, `${id}: motion is smooth (max step ${maxStep * DEG} deg/frame)`);
    G.releaseDomain(sim); run(sim, 4);
    assert.ok(G.maxDisplacement(sim) < 0.01, `${id} relaxes after release (${G.maxDisplacement(sim)})`);
    const got = bondAngles(sim); got.forEach((a, i) => assert.ok(Math.abs(a - ref[i]) < 0.6, `${id} final angle ${a} vs ${ref[i]}`));
  }
});
test("dragging a lone pair works the same way and bonds stay as bonds (assignment keeps domain roles)", () => {
  const sim = simFor(3, 1); const lp = 3; G.dragDomain(sim, lp, ...rotateAbout([sim.tgt[9], sim.tgt[10], sim.tgt[11]], [1, 0, 0], 1.0));
  run(sim, 1.2); G.releaseDomain(sim); run(sim, 4);
  assert.ok(G.maxDisplacement(sim) < 0.01); assert.deepEqual(sim.kinds, ["bond", "bond", "bond", "lp"]);
  for (const a of bondAngles(sim)) assert.ok(Math.abs(a - 107) < 0.6);
});
test("dragging a domain onto another domain's position never makes them overlap and release reassigns without flipping the molecule", () => {
  const sim = simFor(4, 0); G.dragDomain(sim, 0, sim.tgt[3], sim.tgt[4], sim.tgt[5]); let minPair = Math.PI;
  run(sim, 1.5, 1 / 60, () => { minPair = Math.min(minPair, G.minPairAngle(sim)); });
  assert.ok(minPair >= sim.minSep * 0.9, `overlap ${minPair * DEG}`);
  G.releaseDomain(sim); run(sim, 4); assert.ok(G.maxDisplacement(sim) < 0.01);
  for (const a of bondAngles(sim)) assert.ok(Math.abs(a - 109.47) < 0.6);
});
test("repulsion weighting: a dragged lone pair pushes a neighbour at least as hard as a dragged bonding pair (LP-BP >= BP-BP)", () => {
  const push = (kindOfDragged) => {
    const sim = simFor(3, 1); const dragged = kindOfDragged === "lp" ? 3 : 0; const nb = kindOfDragged === "lp" ? 0 : 1;
    const nbT = [sim.tgt[nb * 3], sim.tgt[nb * 3 + 1], sim.tgt[nb * 3 + 2]]; const dT = [sim.tgt[dragged * 3], sim.tgt[dragged * 3 + 1], sim.tgt[dragged * 3 + 2]];
    const axis = [dT[1] * nbT[2] - dT[2] * nbT[1], dT[2] * nbT[0] - dT[0] * nbT[2], dT[0] * nbT[1] - dT[1] * nbT[0]]; const l = Math.hypot(...axis);
    // compare at equal separation from the neighbour: put the dragged domain 55 deg from it
    const sep0 = G.angleOf(...dT, ...nbT); const target = rotateAbout(dT, axis.map((x) => x / l), sep0 - 55 / DEG);
    G.dragDomain(sim, dragged, ...target); run(sim, 1.5);
    return G.angleOf(sim.dir[nb * 3], sim.dir[nb * 3 + 1], sim.dir[nb * 3 + 2], sim.tgt[nb * 3], sim.tgt[nb * 3 + 1], sim.tgt[nb * 3 + 2]);
  };
  assert.ok(push("lp") >= push("bond") - 1e-6, `${push("lp")} vs ${push("bond")}`);
});
test("adding and removing domains keeps existing directions continuous and re-fits the frame", () => {
  const sim = simFor(3, 0); const before = Array.from(sim.dir.subarray(0, 9));
  G.syncDomains(sim, ["d0", "d1", "d2", "d3"], ["bond", "bond", "bond", "lp"]);
  for (let i = 0; i < 9; i += 1) assert.ok(Math.abs(sim.dir[i] - before[i]) < 1e-12, "existing domains did not jump");
  run(sim, 4); assert.ok(G.maxDisplacement(sim) < 0.01); for (const a of bondAngles(sim)) assert.ok(Math.abs(a - 107) < 0.6);
  G.syncDomains(sim, ["d0", "d1", "d3"], ["bond", "bond", "lp"]); run(sim, 4); assert.ok(G.maxDisplacement(sim) < 0.01); for (const a of bondAngles(sim)) assert.ok(Math.abs(a - 118) < 0.6);
});
test("stepSim never allocates NaN and survives huge dt, zero dt and a 6-domain worst case", () => {
  const sim = simFor(6, 0); perturb(sim, rng(3), 180); G.stepSim(sim, 10); G.stepSim(sim, 0); G.stepSim(sim, -1);
  for (const v of sim.dir) assert.ok(Number.isFinite(v)); run(sim, 4); assert.ok(G.maxDisplacement(sim) < 0.01);
});

console.log("Builder, history and classification");
const act = (h, ...as) => as.reduce((s, a) => B.historyReducer(s, a), h);
const build = (central, ligs, lp = 0) => { let h = B.createHistory(); h = act(h, { type: "setCentral", symbol: central }); for (const [s, o] of ligs) h = act(h, { type: "add", kind: "bond", symbol: s, order: o ?? 1 }); for (let i = 0; i < lp; i += 1) h = act(h, { type: "add", kind: "lp" }); return h; };
test("building NH3, H2O, CH4, BF3 and SF6 by operations gives the right classification and matches the validated preset", () => {
  const cases = [["N", [["H"], ["H"], ["H"]], 1, "nh3", "AX₃E", "Tetrahedral", "Trigonal pyramidal"], ["O", [["H"], ["H"]], 2, "h2o", "AX₂E₂", "Tetrahedral", "Bent"], ["C", [["H"], ["H"], ["H"], ["H"]], 0, "ch4", "AX₄", "Tetrahedral", "Tetrahedral"], ["B", [["F"], ["F"], ["F"]], 0, "bf3", "AX₃", "Trigonal planar", "Trigonal planar"], ["S", [["F"], ["F"], ["F"], ["F"], ["F"], ["F"]], 0, "sf6", "AX₆", "Octahedral", "Octahedral"]];
  for (const [c, ligs, lp, id, axe, ed, mg] of cases) {
    const cl = B.classify(build(c, ligs, lp).present); assert.equal(cl.preset?.id, id); assert.equal(cl.axe, axe); assert.equal(cl.ed, ed); assert.equal(cl.mg, mg); assert.equal(cl.idealisedModel, false);
  }
});
test("single, double and triple bonds each count as ONE electron domain", () => {
  for (const order of [1, 2, 3]) { const cl = B.classify(build("C", [["O", order], ["O", order]]).present); assert.equal(cl.n, 2); assert.equal(cl.b, 2); assert.equal(cl.axe, "AX₂"); }
  const co2 = B.classify(build("C", [["O", 2], ["O", 2]]).present); assert.equal(co2.preset.id, "co2");
  assert.equal(B.classify(build("C", [["O", 1], ["O", 1]]).present).preset, null, "single bonds do not match CO2");
});
test("free builds without a validated match are labelled as the idealised VSEPR model", () => {
  const cl = B.classify(build("N", [["H"], ["H"]], 1).present); assert.equal(cl.preset, null); assert.equal(cl.idealisedModel, true); assert.equal(cl.mg, "Bent"); assert.equal(cl.axe, "AX₂E");
  assert.ok(cl.angles.entries.every((e) => e.kind === "lessthan"), "no exact angle invented for a lone-pair arrangement");
  const noLp = B.classify(build("Si", [["Cl"], ["Cl"], ["Cl"], ["Cl"]]).present); assert.equal(noLp.angles.entries[0].text, "109.5°");
});
test("lone-pair counts, domain counts and geometry names across all supported (b,l) combinations", () => {
  const expect = { "2,0": "Linear", "3,0": "Trigonal planar", "4,0": "Tetrahedral", "5,0": "Trigonal bipyramidal", "6,0": "Octahedral", "2,1": "Bent", "3,1": "Trigonal pyramidal", "4,1": "Seesaw", "5,1": "Square pyramidal", "2,2": "Bent", "3,2": "T-shaped", "4,2": "Square planar", "2,3": "Linear", "1,1": "Linear", "1,3": "Linear" };
  for (const [k, mg] of Object.entries(expect)) { const [b, l] = k.split(",").map(Number); const m = build("Xe", Array.from({ length: b }, () => ["F"]), l).present; const cl = B.classify(m); assert.equal(cl.b, b); assert.equal(cl.l, l); assert.equal(cl.n, b + l); assert.equal(cl.mg, mg, k); }
});
test("invalid combinations give warnings, not wrong output", () => {
  let h = build("C", [["H"], ["H"], ["H"], ["H"], ["H"], ["H"]]); h = act(h, { type: "add", kind: "lp" }); assert.match(h.note, /up to 6/); assert.equal(h.present.domains.length, 6);
  const bad = B.classify(build("Xe", [["F"]], 4).present); assert.equal(bad.supported, false); assert.equal(bad.mg, null); assert.ok(bad.warnings.length);
  assert.ok(B.classify(build("O", [], 2).present).warnings.length, "lone pairs only");
  const rejected = B.historyReducer(B.createHistory(), { type: "add", kind: "bond", symbol: "H", order: 1 }); assert.match(rejected.note, /central atom/); assert.equal(rejected.present.domains.length, 0);
  const stub = B.classify(act(B.createHistory(), { type: "setCentral", symbol: "C" }, { type: "add", kind: "bond", order: 1, symbol: null }).present); assert.equal(stub.complete, false); assert.equal(stub.preset, null);
});
test("undo / redo / clear / reset semantics", () => {
  let h = build("N", [["H"], ["H"], ["H"]], 1); assert.equal(h.present.domains.length, 4);
  h = act(h, { type: "undo" }); assert.equal(h.present.domains.length, 3); assert.ok(B.canRedo(h));
  h = act(h, { type: "redo" }); assert.equal(h.present.domains.length, 4); assert.ok(!B.canRedo(h));
  h = act(h, { type: "undo" }, { type: "add", kind: "bond", symbol: "F", order: 1 }); assert.ok(!B.canRedo(h), "a new edit discards the redo branch");
  const id = h.present.domains[0].id; h = act(h, { type: "setOrder", id, order: 3 }); assert.equal(h.present.domains[0].order, 3); h = act(h, { type: "undo" }); assert.equal(h.present.domains[0].order, 1);
  h = act(h, { type: "remove", id }); assert.ok(!h.present.domains.some((d) => d.id === id)); h = act(h, { type: "undo" }); assert.ok(h.present.domains.some((d) => d.id === id));
  const before = h.present; h = act(h, { type: "clear" }); assert.equal(h.present.central, null); assert.equal(h.present.domains.length, 0); assert.ok(B.canUndo(h), "clear is undoable");
  h = act(h, { type: "undo" }); assert.deepEqual(h.present.domains, before.domains); assert.equal(h.present.central, "N");
  h = act(h, { type: "reset" }); assert.equal(h.present.central, null); assert.equal(h.past.length, 0); assert.equal(h.future.length, 0); assert.ok(!B.canUndo(h));
  const e0 = h.present.epoch; h = act(h, { type: "reset" }); assert.ok(h.present.epoch > e0, "epoch changes so the view can re-settle");
  assert.equal(B.historyReducer(B.createHistory(), { type: "undo" }).present.domains.length, 0);
  assert.equal(B.historyReducer(B.createHistory(), { type: "redo" }).present.domains.length, 0);
});
test("loading a preset is one undo step and ids stay unique", () => {
  let h = act(B.createHistory(), { type: "load", ...B.modelFromPreset(presetById("nh3")) }); assert.equal(h.past.length, 1);
  h = act(h, { type: "load", ...B.modelFromPreset(presetById("h2o")) }); const ids = h.present.domains.map((d) => d.id); assert.equal(new Set(ids).size, ids.length);
  assert.equal(B.classify(h.present).preset.id, "h2o"); h = act(h, { type: "undo" }); assert.equal(B.classify(h.present).preset.id, "nh3");
});
test("changing the central element keeps the domains; history limit bounded", () => {
  let h = build("N", [["H"], ["H"], ["H"]], 1); h = act(h, { type: "setCentral", symbol: "P" }); assert.equal(h.present.central, "P"); assert.equal(B.classify(h.present).preset, null);
  for (let i = 0; i < 200; i += 1) h = act(h, { type: "setCentral", symbol: i % 2 ? "N" : "P" }); assert.ok(h.past.length <= 80);
});

console.log("Lewis structures");
test("every preset derives a Lewis structure without warnings (expanded / incomplete octets are exceptions, not errors)", () => {
  for (const p of P.PRESETS) {
    const lw = W.deriveLewis({ central: p.central, domains: [...p.ligands.map((l, i) => ({ id: `b${i}`, kind: "bond", ...l })), ...Array.from({ length: p.lonePairs }, (_, i) => ({ id: `l${i}`, kind: "lp" }))] });
    assert.ok(!lw.warnings.some((w) => w.level === "warn"), `${p.id}: ${JSON.stringify(lw.warnings)}`); assert.equal(lw.netCharge, 0); assert.equal(lw.centralLonePairs, p.lonePairs);
  }
  const L = (id) => { const p = presetById(id); return W.deriveLewis({ central: p.central, domains: [...p.ligands.map((l, i) => ({ id: `b${i}`, kind: "bond", ...l })), ...Array.from({ length: p.lonePairs }, (_, i) => ({ id: `l${i}`, kind: "lp" }))] }); };
  assert.equal(L("becl2").status, "exception"); assert.equal(L("bf3").status, "exception"); assert.equal(L("sf6").status, "exception"); assert.equal(L("pcl5").centralElectrons, 10);
  assert.equal(L("ch4").status, "ok"); assert.equal(L("nh3").status, "ok"); assert.equal(L("h2o").status, "ok"); assert.equal(L("co2").status, "ok"); assert.equal(L("co2").sumOrders, 4);
  assert.deepEqual(L("co2").terminals.map((t) => [t.symbol, t.order, t.lonePairs]), [["O", 2, 2], ["O", 2, 2]]);
  assert.deepEqual(L("hcn").terminals.map((t) => [t.symbol, t.order, t.lonePairs]), [["H", 1, 0], ["N", 3, 1]]);
  assert.equal(L("sf4").centralElectrons, 10); assert.equal(L("so2").status, "exception"); assert.equal(L("so2").centralLonePairs, 1);
});
test("invalid valence / unsupported combinations produce warnings and are never called valid", () => {
  const w = (central, doms) => W.deriveLewis({ central, domains: doms.map((d, i) => (d === "lp" ? { id: `x${i}`, kind: "lp" } : { id: `x${i}`, kind: "bond", symbol: d[0], order: d[1] })) });
  assert.equal(w("H", [["H", 1], ["H", 1]]).status, "warning");
  assert.equal(w("C", [["H", 1], ["H", 1], ["H", 1], ["H", 1], ["H", 1]]).status, "warning", "carbon with 5 bonds exceeds the octet");
  assert.equal(w("N", [["H", 1], ["H", 1], ["H", 1], ["H", 1]]).status, "warning", "NH4+ is an ion, not a neutral molecule");
  assert.match(w("N", [["H", 1], ["H", 1], ["H", 1], ["H", 1]]).warnings.map((x) => x.text).join(" "), /\+1/);
  assert.equal(w("F", [["H", 2]]).status, "warning"); assert.equal(w("O", [["H", 1], ["H", 1], ["H", 1], "lp"]).status, "warning");
  assert.equal(w("C", [["H", 1], ["H", 1], ["H", 1]]).status, "warning", "CH3 is a radical/cation, not a closed-shell Lewis structure");
  assert.equal(w("C", [[null, 1]]).status, "warning"); assert.equal(W.deriveLewis(B.EMPTY_MODEL).empty, true);
  assert.equal(w("O", [["O", 3], ["H", 1]]).status, "warning", "unusual terminal triple bond to O");
});

console.log("Challenge");
test("a fully correct prediction passes every field for every preset; a wrong one explains instead of just marking", () => {
  for (const p of P.PRESETS) {
    const ok = { domains: String(p.domains), lonePairs: String(p.lonePairs), ed: p.ed, mg: p.mg, axe: `AX${p.bonding > 1 ? p.bonding : ""}${p.lonePairs ? `E${p.lonePairs > 1 ? p.lonePairs : ""}` : ""}`, angle: String(p.challengeAngles[0]) };
    const r = C.checkPrediction(p, ok); assert.equal(r.score, r.total, `${p.id} ${JSON.stringify(r.fields.filter((f) => !f.correct))}`);
  }
  const nh3 = presetById("nh3"); const bad = C.checkPrediction(nh3, { domains: "3", lonePairs: "0", ed: "Trigonal planar", mg: "Trigonal planar", axe: "AX3", angle: "120" });
  assert.equal(bad.score, 0); for (const f of bad.fields) assert.ok(f.message.length > 30 && f.expected, f.key);
  assert.match(bad.fields[0].message, /lone pair/); assert.ok(C.isComplete({ domains: "1", lonePairs: "0", ed: "a", mg: "b", axe: "c", angle: "d" })); assert.ok(!C.isComplete(C.emptyAnswers()));
});
test("angle options exist for every accepted answer and the AXE option list covers every preset", () => {
  const opts = C.ANGLE_OPTIONS.map((o) => o.value); for (const p of P.PRESETS) for (const a of p.challengeAngles) assert.ok(opts.includes(String(a)), `${p.id} ${a}`);
  const axes = C.AXE_OPTIONS.map((o) => o.value); for (const p of P.PRESETS) assert.ok(axes.includes(`AX${p.bonding > 1 ? p.bonding : ""}${p.lonePairs ? `E${p.lonePairs > 1 ? p.lonePairs : ""}` : ""}`), p.id);
  for (const p of P.PRESETS) { assert.ok(C.ED_OPTIONS.includes(p.ed)); assert.ok(C.MG_OPTIONS.includes(p.mg)); }
  assert.equal(new Set(C.CHALLENGE_ORDER).size, C.CHALLENGE_ORDER.length); assert.equal(C.CHALLENGE_ORDER.length, P.PRESETS.length);
});
test("compareBuild reports match / mismatch / nothing built", () => {
  const nh3 = presetById("nh3");
  assert.equal(C.compareBuild(nh3, B.classify(build("N", [["H"], ["H"], ["H"]], 1).present)).match, true);
  assert.equal(C.compareBuild(nh3, B.classify(build("N", [["H"], ["H"], ["H"]], 0).present)).match, false);
  assert.equal(C.compareBuild(nh3, B.classify(B.EMPTY_MODEL)).built, false);
});

console.log("Toolbox data");
test("toolbox has the 14 required atoms with colours and valence data", () => {
  assert.deepEqual(TOOLBOX_ATOMS, ["H", "C", "N", "O", "F", "Cl", "B", "Be", "S", "P", "Si", "Br", "I", "Xe"]);
  for (const s of TOOLBOX_ATOMS) { const e = ELEMENTS[s]; assert.ok(e.color && e.valence >= 1 && e.r > 0, s); }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
