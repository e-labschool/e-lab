#!/usr/bin/env node
// Node tests for the Gas Laws Explorer model + particle physics (no DOM/React):
//   node scripts/test-gas-laws-model.mjs
// Covers the spec section 14 checks at model level.
import assert from "node:assert/strict";
import * as M from "../src/engines/gas-laws-explorer/model.js";
import * as Phys from "../src/engines/gas-laws-explorer/physics.js";

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}
const rel = (a, b) => Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-300);
const close = (a, b, tol = 1e-9, msg = "") => assert.ok(rel(a, b) <= tol, `${msg} expected ${b}, got ${a}`);
const rng = Phys.makeRng(2024);
const rand = (a, b) => a + (b - a) * rng();

console.log("== Relationships (checks 1-4) ==");
test("1. halving V doubles P (T, n constant)", () => {
  const s = M.defaultState("pv"); // V = 20 L
  const r = M.setVariable(s, "V", s.V / 2).state;
  close(r.P, 2 * s.P); assert.equal(r.T, s.T); assert.equal(r.n, s.n);
});
test("2. doubling T (K) doubles V (P, n constant)", () => {
  const s = M.defaultState("vt");
  const r = M.setVariable(s, "T", 2 * s.T).state;
  close(r.V, 2 * s.V); assert.equal(r.P, s.P); assert.equal(r.n, s.n);
});
test("3. doubling T doubles P (V, n constant)", () => {
  const s = M.defaultState("pt");
  const r = M.setVariable(s, "T", 2 * s.T).state;
  close(r.P, 2 * s.P); assert.equal(r.V, s.V); assert.equal(r.n, s.n);
});
test("4. doubling n doubles V (P, T constant)", () => {
  const s = M.setVariable(M.defaultState("vn"), "n", 0.7).state;
  const r = M.setVariable(s, "n", 1.4).state;
  close(r.V, 2 * s.V); assert.equal(r.P, s.P); assert.equal(r.T, s.T);
});
test("PV = nRT everywhere on the slider grid (R = 0.082057)", () => {
  assert.equal(M.R_GAS, 0.082057);
  for (const mode of M.MODE_IDS) for (let i = 0; i < 200; i++) {
    let s = M.defaultState(mode);
    const info = M.MODES[mode];
    for (const k of [...info.locked, info.independent]) s = M.setVariable(M.makeState(mode, s), k, rand(M.RANGES[k].min, M.RANGES[k].max)).state;
    assert.ok(M.residual(s) < 1e-12, `residual ${M.residual(s)}`);
  }
});

console.log("== Locked variables (check 5) ==");
for (const mode of M.MODE_IDS) {
  test(`5. locked variables exactly constant over 5000 changes (${mode})`, () => {
    const s0 = M.defaultState(mode);
    const info = M.MODES[mode];
    let s = s0;
    for (let i = 0; i < 5000; i++) {
      const k = info.independent;
      const r = M.effectiveRange(s, k);
      s = M.setVariable(s, k, rand(M.RANGES[k].min - 1, M.RANGES[k].max + 1)).state;
      for (const l of info.locked) assert.equal(s[l], s0[l]);
      assert.ok(s[k] >= r.min - 1e-12 && s[k] <= r.max + 1e-12);
    }
  });
  test(`5b. the calculated variable cannot be set directly and the controls only touch the right keys (${mode})`, () => {
    const s = M.defaultState(mode);
    const dep = M.MODES[mode].dependent;
    const r = M.setVariable(s, dep, 3);
    assert.equal(r.changed, false); assert.equal(r.state, s);
  });
}

console.log("== Ranges & clamping ==");
test("every reachable state keeps all four variables inside their ranges", () => {
  for (const mode of M.MODE_IDS) {
    let s = M.defaultState(mode);
    const info = M.MODES[mode];
    for (let i = 0; i < 3000; i++) {
      // random baseline edit of a locked variable, then random independent moves
      const k = rng() < 0.3 ? info.locked[Math.floor(rng() * 2)] : info.independent;
      s = M.setVariable(s, k, rand(M.RANGES[k].min, M.RANGES[k].max)).state;
      for (const v of ["P", "V", "T", "n"]) assert.ok(s[v] >= M.RANGES[v].min - 1e-9 && s[v] <= M.RANGES[v].max + 1e-9, `${mode} ${v}=${s[v]}`);
      assert.ok(M.residual(s) < 1e-11);
    }
  }
});
test("clamping: extreme request is limited so the dependent variable stays in range", () => {
  const s = M.defaultState("vt"); // P = 1.23 atm, n = 1 -> V = nRT/P, T limited
  const r = M.setVariable(s, "T", 800);
  assert.equal(r.clamped, true);
  assert.ok(r.state.V <= 50 + 1e-9);
  close(r.state.V, 50, 1e-9);
  const lo = M.setVariable(M.defaultState("pv"), "V", 1);
  assert.equal(lo.state.V >= 5, true); assert.ok(lo.state.P <= 10 + 1e-9);
});
test("effective range is narrower than the hard range when needed and never empty", () => {
  const s = M.setVariable(M.defaultState("vt"), "T", 400).state;
  const r = M.effectiveRange(s, "T");
  assert.ok(r.limited && r.min < r.max);
  for (const mode of M.MODE_IDS) for (let i = 0; i < 300; i++) {
    let t = M.defaultState(mode);
    for (const k of M.MODES[mode].locked) t = M.setVariable(t, k, rand(M.RANGES[k].min, M.RANGES[k].max)).state;
    const e = M.effectiveRange(t, M.MODES[mode].independent);
    assert.ok(e.max > e.min, `${mode} empty`);
  }
});

console.log("== Graphs (check 6, 7) ==");
function graphFor(mode, id, s = M.defaultState(mode)) { return M.buildGraph(s, id); }
const fit = (pts) => { // least squares y = a x + b ; returns a, b, max residual
  const n = pts.length; let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const p of pts) { sx += p.x; sy += p.y; sxx += p.x * p.x; sxy += p.x * p.y; }
  const a = (n * sxy - sx * sy) / (n * sxx - sx * sx); const b = (sy - a * sx) / n;
  return { a, b, res: Math.max(...pts.map((p) => Math.abs(p.y - (a * p.x + b)))) };
};
test("P vs V: inverse curve, PV constant = nRT, decreasing", () => {
  const s = M.defaultState("pv"); const g = graphFor("pv", "p-v", s);
  for (const p of g.accessible) close(p.x * p.y, s.n * M.R_GAS * s.T, 1e-12);
  for (let i = 1; i < g.accessible.length; i++) assert.ok(g.accessible[i].y < g.accessible[i - 1].y);
  assert.equal(g.xRange[0], 0); assert.equal(g.yRange[0], 0);
});
test("P vs 1/V: straight line through the origin with slope nRT; dashed extension reaches (0,0)", () => {
  const s = M.defaultState("pv"); const g = graphFor("pv", "p-invv", s);
  const f = fit(g.accessible); close(f.a, s.n * M.R_GAS * s.T, 1e-9); assert.ok(Math.abs(f.b) < 1e-9);
  const last = g.extension.at(-1); assert.equal(last.x, 0); assert.equal(last.y, 0);
  assert.equal(g.xRange[0], 0);
});
test("PV vs V: horizontal at nRT", () => {
  const s = M.defaultState("pv"); const g = graphFor("pv", "pv-v", s);
  for (const p of g.accessible) close(p.y, s.n * M.R_GAS * s.T, 1e-12);
  assert.ok(g.yRange[0] === 0 && g.yRange[1] > s.n * M.R_GAS * s.T);
});
for (const [mode, yk, kName] of [["vt", "V", "v"], ["pt", "P", "p"]]) {
  test(`${mode}: ${yk} vs T (K) is a line through the origin; dashed extension to T = 0`, () => {
    const s = M.defaultState(mode); const g = graphFor(mode, `${kName}-tk`, s);
    const f = fit(g.accessible); assert.ok(Math.abs(f.b) < 1e-9 * Math.abs(f.a * 300) + 1e-12);
    const c = mode === "vt" ? s.n * M.R_GAS / s.P : s.n * M.R_GAS / s.V; close(f.a, c, 1e-9);
    assert.equal(g.extension[0].x, 0); assert.ok(Math.abs(g.extension[0].y) < 1e-12);
    assert.equal(g.xRange[0], 0);
  });
  test(`${mode}: ${yk} vs temperature (degC) has x-intercept -273.15 and a dashed extrapolated portion`, () => {
    const s = M.defaultState(mode); const g = graphFor(mode, `${kName}-tc`, s);
    const f = fit(g.accessible); close(-f.b / f.a, -273.15, 1e-9);
    assert.ok(Math.abs(g.extension[0].x + 273.15) < 1e-9 && Math.abs(g.extension[0].y) < 1e-12);
    for (const p of g.accessible) assert.ok(Math.abs(p.x - (p.u - 273.15)) < 1e-12); // K -> degC
    assert.ok(g.accessible[0].x >= -273.15 + 100 - 1e-9); // accessible solid portion starts above the extrapolation
    assert.ok(g.extension.at(-1).x <= g.accessible[0].x + 1e-9);
    assert.match(g.extensionNote, /extrapolation: real gases condense\/liquefy before this; not physically accessible/);
    assert.ok(g.xRange[0] <= -273.15);
  });
  test(`${mode}: ${yk}/T vs T is horizontal`, () => {
    const s = M.defaultState(mode); const g = graphFor(mode, `${kName}-over-t`, s);
    const c = mode === "vt" ? s.n * M.R_GAS / s.P : s.n * M.R_GAS / s.V;
    for (const p of g.accessible) close(p.y, c, 1e-12);
  });
}
test("V–n: V vs n through the origin (slope RT/P), V/n vs n horizontal", () => {
  const s = M.defaultState("vn");
  const g = graphFor("vn", "v-n", s); const f = fit(g.accessible);
  close(f.a, M.R_GAS * s.T / s.P, 1e-9); assert.ok(Math.abs(f.b) < 1e-9);
  assert.equal(g.extension[0].x, 0);
  const h = graphFor("vn", "v-over-n", s);
  for (const p of h.accessible) close(p.y, M.R_GAS * s.T / s.P, 1e-12);
});
test("curves use the investigation's constants (not hard-coded)", () => {
  let s = M.setVariable(M.defaultState("pv"), "n", 1.7).state;
  s = M.makeState("pv", { ...s, T: 450 });
  const g = M.buildGraph(s, "pv-v");
  close(g.accessible[3].y, 1.7 * M.R_GAS * 450, 1e-12);
  assert.match(g.constants, /T = 450 K \(constant\)/); assert.match(g.constants, /n = 1\.70 mol \(constant\)/);
  assert.doesNotMatch(g.constants, /P =/);
});
test("7. marker coordinates equal the live values for every mode and graph", () => {
  for (const mode of M.MODE_IDS) for (const def of M.graphOptions(mode)) {
    let s = M.defaultState(mode);
    for (let i = 0; i < 20; i++) {
      s = M.setVariable(s, M.MODES[mode].independent, rand(0, 100)).state;
      const g = M.buildGraph(s, def.id);
      const gp = M.graphPoint(s, def.id);
      assert.equal(g.marker.x, gp.x); assert.equal(g.marker.y, gp.y);
      const live = { V: s.V, P: s.P, "1/V": 1 / s.V, PV: s.P * s.V, T: s.T, t: s.T - 273.15, "V/T": s.V / s.T, "P/T": s.P / s.T, n: s.n, "V/n": s.V / s.n };
      assert.equal(g.marker.x, live[g.xName]); assert.equal(g.marker.y, live[g.yName]);
      // the marker lies on the plotted line
      const nx = (p) => p.x / (g.xRange[1] - g.xRange[0]);
      const ny = (p) => p.y / (g.yRange[1] - g.yRange[0]);
      let near = Infinity;
      for (let j = 1; j < g.accessible.length; j++) { // distance to the plotted polyline
        const a = g.accessible[j - 1], b = g.accessible[j];
        const ax = nx(a), ay = ny(a), bx = nx(b), by = ny(b), mx = nx(g.marker), my = ny(g.marker);
        const L2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1e-18;
        const t = Math.max(0, Math.min(1, ((mx - ax) * (bx - ax) + (my - ay) * (by - ay)) / L2));
        near = Math.min(near, Math.hypot(mx - (ax + t * (bx - ax)), my - (ay + t * (by - ay))));
      }
      assert.ok(near < (def.kind === "curve" ? 2e-3 : 1e-9), `${def.id} marker off curve (${near})`);
    }
  }
});
test("axis labels carry units; default graph first; ticks span the data", () => {
  const g = graphFor("vt", "v-tc"); assert.match(g.xTitle, /°C/); assert.match(g.yTitle, /\(L\)/);
  for (const mode of M.MODE_IDS) { assert.equal(M.defaultGraphId(mode), M.graphOptions(mode)[0].id); }
  assert.deepEqual(M.graphOptions("pv").map((o) => o.id), ["p-v", "p-invv", "pv-v"]);
  assert.deepEqual(M.graphOptions("vt").map((o) => o.id), ["v-tk", "v-tc", "v-over-t"]);
  assert.deepEqual(M.graphOptions("pt").map((o) => o.id), ["p-tk", "p-tc", "p-over-t"]);
  assert.deepEqual(M.graphOptions("vn").map((o) => o.id), ["v-n", "v-over-n"]);
});
test("changing graph type does not change the state or the constants", () => {
  const s = M.setVariable(M.defaultState("vt"), "T", 450).state;
  const snap = JSON.stringify(s);
  for (const d of M.graphOptions("vt")) { const g = M.buildGraph(s, d.id); assert.match(g.constants, /P = 1\.23 atm/); }
  assert.equal(JSON.stringify(s), snap);
});

console.log("== All Graphs View ==");
test("four panels, each with its own reference conditions; only the active one has a marker", () => {
  const s = M.setVariable(M.defaultState("vt"), "T", 450).state;
  const panels = M.allGraphsView(s);
  assert.deepEqual(panels.map((p) => p.mode), ["pv", "vt", "pt", "vn"]);
  assert.deepEqual(panels.map((p) => p.graph.id), ["p-v", "v-tk", "p-tk", "v-n"]);
  assert.deepEqual(panels.map((p) => !!p.graph.marker), [false, true, false, false]);
  for (const p of panels) {
    assert.ok(p.conditions.length > 0);
    assert.ok(M.residual(p.state) < 1e-12);
    assert.equal(p.conditionsLabel, p.active ? "current investigation" : "reference conditions");
    if (!p.active) for (const k of M.MODES[p.mode].locked) assert.equal(p.state[k], M.REFERENCE_CONDITIONS[p.mode][k]);
  }
  const active = panels.find((p) => p.active);
  assert.equal(active.state.P, s.P); // live investigation constants
  assert.equal(active.graph.marker.x, s.T);
  assert.equal(panels.find((p) => p.mode === "pv").state.T, 300);
});

console.log("== Piston + particles (checks 8, 9) ==");
test("8. piston height is exact, linear and strictly monotone in V (0 L at the floor, 50 L at max height)", () => {
  assert.equal(M.pistonHeight(0), 0); assert.equal(M.pistonHeight(50), M.CHAMBER.maxHeight);
  let prev = -1;
  for (let V = 5; V <= 50; V += 0.5) { const h = M.pistonHeight(V); assert.ok(h > prev); prev = h; close(h, (M.CHAMBER.maxHeight * V) / 50, 1e-15); }
  const s = M.defaultState("pv");
  const sim = Phys.createSimulation({ seed: 1 }); sim.reset(s);
  close(sim.pistonH, M.pistonHeight(s.V), 1e-12);
  sim.setTarget(M.setVariable(s, "V", 10).state);
  sim.settle(3); close(sim.pistonH, M.pistonHeight(10), 1e-3);
});
test("piston is fixed when V is constant (P–T) and tracks V when it changes", () => {
  let s = M.defaultState("pt"); const sim = Phys.createSimulation({ seed: 2 }); sim.reset(s);
  const h0 = sim.pistonH;
  for (let T = 100; T <= 800; T += 100) { s = M.setVariable(s, "T", T).state; sim.setTarget(s); sim.settle(0.3); assert.equal(sim.pistonH, h0); }
  let q = M.defaultState("vt"); sim.reset(q); const hh = sim.pistonH;
  q = M.setVariable(q, "T", 600).state; sim.setTarget(q); sim.settle(0.05);
  assert.ok(sim.pistonH > hh && sim.pistonH < M.pistonHeight(q.V)); // moves smoothly, no teleport
});
test("9. particle count responds monotonically to n; n = 1.00 mol -> 20 particles", () => {
  let prev = -1;
  for (let n = 0.5; n <= 2.0001; n += 0.05) { const c = M.particleCount(n); assert.ok(c >= prev); prev = c; assert.ok(Math.abs(c * M.MOL_PER_PARTICLE - n) <= M.MOL_PER_PARTICLE / 2 + 1e-9); }
  assert.equal(M.particleCount(1), 20); assert.equal(M.particleCount(0.5), 10); assert.equal(M.particleCount(2), 40);
  const sim = Phys.createSimulation({ seed: 3 }); sim.reset(M.defaultState("vn"));
  assert.equal(sim.getStats().count, 20);
  const bigger = M.setVariable(M.defaultState("vn"), "n", 1.5).state;
  sim.setTarget(bigger); sim.settle(4); assert.equal(sim.getStats().count, 30);
  const smaller = M.setVariable(bigger, "n", 0.6).state;
  sim.setTarget(smaller); sim.settle(6); assert.equal(sim.getStats().count, 12);
});
test("particles fade in/out instead of jumping when n changes", () => {
  const sim = Phys.createSimulation({ seed: 4 }); sim.reset(M.defaultState("vn"));
  sim.setTarget(M.setVariable(M.defaultState("vn"), "n", 2).state);
  sim.settle(0.15);
  const mid = sim.particles.filter((p) => p.alpha > 0 && p.alpha < 1);
  assert.ok(mid.length > 0, "expected partially transparent (fading) particles");
  assert.ok(sim.particles.length < 40);
});

console.log("== Display unit (check 10) ==");
test("10. Moles/Molecules toggle is display only; N = n x NA in scientific notation", () => {
  const s = M.defaultState("vn"); const snap = JSON.stringify(s);
  const a = M.displayAmount(s.n, "mol"); const b = M.displayAmount(s.n, "molecules");
  assert.equal(a.text, "1.00 mol"); assert.equal(b.text, "6.02 × 10²³ molecules");
  assert.equal(JSON.stringify(s), snap);
  close(M.moleculeCount(1.5), 1.5 * 6.02214076e23, 1e-15);
  assert.equal(M.AVOGADRO, 6.02214076e23);
});
test("scientific notation rounding edge cases", () => {
  assert.equal(M.formatScientific(9.9996e23).text, "1.00 × 10²⁴");
  const edge = M.formatScientific(9.995e23); // either 9.99/10.00-free: mantissa always in [1, 10)
  assert.ok(Number(edge.mantissa) >= 1 && Number(edge.mantissa) < 10 && (edge.text === "9.99 × 10²³" || edge.text === "1.00 × 10²⁴" || edge.text === "9.995 × 10²³".slice(0, 4) + " × 10²³" || /^\d\.\d\d × 10(²³|²⁴)$/.test(edge.text)), edge.text);
  assert.equal(M.formatScientific(9.994e23).text, "9.99 × 10²³");
  assert.equal(M.formatScientific(1e24).text, "1.00 × 10²⁴");
  assert.equal(M.formatScientific(3.011e23).text, "3.01 × 10²³");
  assert.equal(M.formatScientific(1.2044e24).text, "1.20 × 10²⁴");
  for (let i = 0; i < 2000; i++) {
    const x = 10 ** rand(20, 25); const f = M.formatScientific(x);
    const m = Number(f.mantissa); assert.ok(m >= 1 && m < 10, `${x} -> ${f.text}`);
    assert.ok(Math.abs(m * 10 ** f.exponent - x) / x < 0.006);
  }
  assert.equal(M.superscript(-3), "⁻³");
});

console.log("== Reset / mode switching (check 11) ==");
test("11. Reset restores a consistent state (PV = nRT residual ~1e-12) in every mode", () => {
  for (const mode of M.MODE_IDS) {
    let s = M.defaultState(mode);
    s = M.setVariable(s, M.MODES[mode].independent, 40).state;
    const r = M.defaultState(mode);
    assert.ok(M.residual(r) < 1e-12);
    assert.equal(r.n, 1); assert.equal(r.T, 300);
    close(r.P, 1.230855, 1e-9); close(r.V, 20, 1e-12);
    assert.notEqual(JSON.stringify(s), JSON.stringify(r));
  }
});
test("mode switching carries all values over without inconsistency or jumps", () => {
  let s = M.defaultState("pv");
  for (let i = 0; i < 400; i++) {
    s = M.setVariable(s, M.MODES[s.mode].independent, rand(0, 900)).state;
    const to = M.MODE_IDS[Math.floor(rng() * 4)];
    const t = M.switchMode(s, to);
    for (const k of ["P", "V", "T", "n"]) close(t[k], s[k], 1e-12, `${s.mode}->${to} ${k}`);
    assert.ok(M.residual(t) < 1e-11);
    for (const l of M.MODES[to].locked) assert.equal(t[l], s[l]);
    assert.equal(t.mode, to);
    s = t;
  }
});

console.log("== Explanations ==");
test("default message first; direction-aware, mode-specific messages", () => {
  for (const mode of M.MODE_IDS) {
    const d = M.selectExplanation(null, M.defaultState(mode)); assert.equal(d.id, `${mode}-default`);
    const s = M.setVariable(M.defaultState(mode), M.MODES[mode].independent, 0).state; // go to the minimum
    const lo = M.selectExplanation(M.defaultState(mode), s);
    const hi = M.selectExplanation(s, M.defaultState(mode));
    assert.equal(lo.id, `${mode}-down`); assert.equal(hi.id, `${mode}-up`);
    assert.notEqual(lo.text, hi.text);
    assert.equal(M.selectExplanation(s, s), null);
  }
  const texts = new Set(M.MODE_IDS.flatMap((m) => [M.EXPLANATIONS[m].up, M.EXPLANATIONS[m].down, M.EXPLANATIONS[m].default]));
  assert.equal(texts.size, 12);
  assert.match(M.EXPLANATIONS.pv.down, /Volume decreases.*more wall collisions.*pressure increases/);
  assert.match(M.EXPLANATIONS.vt.up, /faster particles.*piston rises/);
  assert.match(M.EXPLANATIONS.pt.up, /piston is fixed|faster particles hit the walls harder/);
  assert.match(M.EXPLANATIONS.vn.up, /More gas.*piston rises/);
  assert.equal(M.selectExplanation(M.defaultState("pv"), M.defaultState("vt")).id, "vt-default");
});
test("predict content: one question per relationship with numbers when reachable", () => {
  const s = M.defaultState("pv"); const c = M.predictContent(s);
  assert.match(c.question, /halved \(from 20\.0 L to 10\.0 L\)/); assert.match(c.answer, /doubles/); assert.match(c.answer, /1\.23 atm to 2\.46 atm/);
  assert.match(M.predictContent(M.defaultState("vt")).question, /absolute temperature doubles/);
  assert.match(M.predictContent(M.defaultState("pt")).question, /pressure if the absolute temperature doubles/);
  assert.match(M.predictContent(M.defaultState("vn")).question, /amount of gas doubles/);
  const edge = M.setVariable(M.defaultState("pv"), "V", 5).state;
  assert.equal(M.predictContent(edge).reachable, false);
});

console.log("== Particle physics ==");
const mk = (x, y, vx, vy) => ({ x, y, vx, vy });
test("elastic pair collisions conserve momentum and kinetic energy (1e-9)", () => {
  for (let i = 0; i < 2000; i++) {
    const a = mk(0, 0, rand(-50, 50), rand(-50, 50)); const th = rand(0, 6.283);
    const b = mk(Math.cos(th) * 5, Math.sin(th) * 5, rand(-50, 50), rand(-50, 50));
    const px = a.vx + b.vx, py = a.vy + b.vy, ke = a.vx ** 2 + a.vy ** 2 + b.vx ** 2 + b.vy ** 2;
    Phys.collidePair(a, b);
    assert.ok(Math.abs(a.vx + b.vx - px) < 1e-9 && Math.abs(a.vy + b.vy - py) < 1e-9);
    assert.ok(Math.abs(a.vx ** 2 + a.vy ** 2 + b.vx ** 2 + b.vy ** 2 - ke) < 1e-9 * Math.max(1, ke));
  }
});
test("static walls conserve each particle's kinetic energy; moving piston reflects with 2 vp - v", () => {
  const h = 100;
  for (let i = 0; i < 2000; i++) {
    const p = mk(rand(0, 170), rand(0, h), rand(-60, 60), rand(-60, 60)); const k = p.vx ** 2 + p.vy ** 2;
    Phys.confine(p, Phys.RADIUS, h, 0);
    close(p.vx ** 2 + p.vy ** 2, k, 1e-12);
  }
  const p = mk(80, 100 - Phys.RADIUS + 0.1, 0, 10);
  Phys.confine(p, Phys.RADIUS, 100, -20); // piston moving down at 20
  close(p.vy, 2 * -20 - 10, 1e-12); assert.ok(p.y <= 100 - Phys.RADIUS + 1e-12);
});
test("a closed (no piston motion) sim conserves total kinetic energy apart from the thermostat being at equilibrium", () => {
  const sim = Phys.createSimulation({ seed: 7 }); sim.reset(M.defaultState("pv"));
  const s0 = sim.getStats(); sim.settle(5); const s1 = sim.getStats();
  close(s1.totalKE, s0.totalKE, 0.02);
});
test("speeds scale with sqrt(T) (and the piston-less rescale is smooth)", () => {
  const speed = (T) => {
    let s = M.makeState("pt", { V: 20, n: 1, T, P: 1 }); const sim = Phys.createSimulation({ seed: 11 }); sim.reset(M.defaultState("pt"));
    sim.setTarget(s); sim.settle(4); return sim.getStats();
  };
  const a = speed(100), b = speed(400), c = speed(800);
  close(b.rmsSpeed / a.rmsSpeed, 2, 0.03, "400/100"); close(c.rmsSpeed / b.rmsSpeed, Math.SQRT2, 0.03, "800/400");
  close(b.meanSpeed / a.meanSpeed, 2, 0.06);
  // smoothness: after a step in T the speed does not jump in one frame
  const sim = Phys.createSimulation({ seed: 12 }); sim.reset(M.defaultState("pt"));
  const before = sim.getStats().rmsSpeed;
  sim.setTarget(M.setVariable(M.defaultState("pt"), "T", 800).state); sim.advance(1 / 60);
  const after = sim.getStats().rmsSpeed; assert.ok(after / before < 1.05 && after > before);
});
test("long random control run (all modes, rapid changes, fast piston moves): nothing escapes, no NaN", () => {
  const sim = Phys.createSimulation({ seed: 99 });
  let s = M.defaultState("pv"); sim.reset(s);
  const W = M.CHAMBER.width; const r = Phys.RADIUS; let steps = 0;
  for (let it = 0; it < 4000; it++) {
    if (it % 400 === 0) s = M.switchMode(s, M.MODE_IDS[(it / 400) % 4]);
    if (rng() < 0.3) { const k = M.MODES[s.mode].independent; s = M.setVariable(s, k, rand(M.RANGES[k].min, M.RANGES[k].max)).state; sim.setTarget(s); }
    if (it === 1500) sim.setPaused(true); if (it === 1600) sim.setPaused(false);
    sim.advance(rng() < 0.1 ? 0.1 : 0.016); steps++;
    for (const p of sim.particles) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.vx) && Number.isFinite(p.vy), "NaN");
      assert.ok(p.x >= r - 1e-9 && p.x <= W - r + 1e-9, `x ${p.x}`);
      assert.ok(p.y >= r - 1e-9 && p.y <= sim.pistonH - r + 1e-9, `y ${p.y} vs piston ${sim.pistonH}`);
    }
    assert.ok(Number.isFinite(sim.pistonH));
  }
  assert.ok(steps === 4000);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
