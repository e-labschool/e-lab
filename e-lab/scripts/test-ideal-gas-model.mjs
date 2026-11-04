#!/usr/bin/env node
// Node tests for the Ideal vs Real Gas model (pure JS, no DOM/React):
//   node scripts/test-ideal-gas-model.mjs
// Real gas = van der Waals CO2 (a = 3.640 L^2 atm/mol^2, b = 0.04267 L/mol) in a
// consistent unit system (atm, L, mol, K). Sections:
//   1. ideal gas law            2. the 8 spec cases (Z, deviation, graph, limits)
//   3. pressure control solver  4. explanations   5. particle illustration + chamber integrity
import assert from "node:assert/strict";
import * as M from "../src/engines/ideal-gas-simulation/model.js";

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL ${name}\n       ${e.message}`);
  }
}
const rel = (a, b) => Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-300);
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const nOf = (N) => M.amountOfSubstance(N);
const st = (o) => M.resolveState({ ...M.DEFAULT_CONTROLS, ...o });
const stV = (o) => st({ control: "volume", ...o }); // Volume control
const stP = (o) => st({ control: "pressure", ...o }); // Pressure control
// Independent re-implementation of the vdW equation with the literature constants (not imported from the model).
const A_CO2 = 3.640, B_CO2 = 0.04267, R = 0.082057;
const vdwIndep = (n, T, V) => (n * R * T) / (V - n * B_CO2) - A_CO2 * (n / V) ** 2;
const dPdVIndep = (n, T, V) => (-n * R * T) / (V - n * B_CO2) ** 2 + (2 * A_CO2 * n * n) / V ** 3;

console.log("== Ideal gas law ==");
test("1. T up at constant V, n => P up", () => {
  let prev = 0;
  for (let T = 250; T <= 700; T += 50) { const p = stV({ T, V: 1 }).pressure; assert.ok(p > prev); prev = p; }
});
test("2. V down at constant T, n => P up", () => {
  let prev = 0;
  for (const V of [50, 20, 10, 5, 2, 1, 0.5, 0.1]) { const p = stV({ V }).pressure; assert.ok(p > prev); prev = p; }
});
test("3. n up at constant T, V => P up", () => {
  let prev = 0;
  for (let N = 5; N <= 100; N += 5) { const p = stV({ N, V: 1 }).pressure; assert.ok(p > prev); prev = p; }
});
test("4. PV = nRT within 1e-9 relative over the whole slider grid", () => {
  for (const N of [5, 23, 50, 77, 100]) for (const T of [250, 333, 700]) for (const V of [0.01, 0.2, 5, 100]) {
    const n = nOf(N);
    assert.ok(rel(M.idealPressure(n, T, V) * V, n * M.R_GAS * T) < 1e-9);
  }
});
test("default state: ideal CO2-sample, N=50 -> n = 0.50 mol, T = 300 K, Change Pressure at 30 atm, volume nRT/P", () => {
  const s = st({});
  assert.equal(M.DEFAULT_CONTROLS.control, "pressure"); assert.equal(M.DEFAULT_CONTROLS.mode, "ideal");
  assert.ok(near(s.n, 0.5) && s.T === 300 && s.pressure === 30);
  assert.ok(near(s.V, 0.5 * R * 300 / 30, 1e-9));
  assert.ok(Math.abs(M.DEFAULT_CONTROLS.V - s.V) < 5e-3, "stored V matches the solved V");
});
test("mode switch preserves N, T, V/P and the control selector", () => {
  const sim = M.createSimulation({ seed: 1 });
  sim.setControls({ N: 70, T: 450, V: 1.2, control: "volume" });
  sim.setControls({ mode: "real" });
  assert.deepEqual({ N: sim.controls.N, T: sim.controls.T, V: sim.controls.V, c: sim.controls.control }, { N: 70, T: 450, V: 1.2, c: "volume" });
  assert.equal(sim.getReadings().mode, "real");
});

console.log("== Documented real gas: van der Waals CO2 ==");
test("constants are the documented CO2 values in atm/L/mol/K; one gas identity", () => {
  assert.equal(M.VDW_A, 3.64); assert.equal(M.VDW_B, 0.04267); assert.equal(M.R_GAS, 0.082057);
  assert.equal(M.GAS.id, "co2"); assert.match(M.GAS.name, /Carbon dioxide/);
  const c = M.vdwCriticalConstants();
  assert.ok(near(c.Tc, 8 * 3.64 / (27 * 0.082057 * 0.04267)) && Math.abs(c.Tc - 308.03) < 0.01, `Tc ${c.Tc}`);
  assert.ok(Math.abs(c.Tc - 304.13) / 304.13 < 0.02, "within 2% of the experimental Tc of CO2");
  assert.ok(near(c.Pc, 3.64 / (27 * 0.04267 ** 2)) && Math.abs(c.Pc - 74.04) < 0.01);
  assert.ok(Math.abs(c.Pc - 72.8) / 72.8 < 0.02, "within 2% of the experimental Pc of CO2");
  assert.ok(near(c.TBoyle, 3.64 / (0.082057 * 0.04267)) && Math.abs(c.TBoyle - 1039.6) < 0.1);
  assert.ok(near(c.Vc, 3 * 0.04267));
});
test("critical point: dP/dV = d2P/dV2 = 0 at (Vc, Tc), P(Vc) = Pc (per mole)", () => {
  const c = M.vdwCriticalConstants(), h = 1e-5, p = (V) => vdwIndep(1, c.Tc, V);
  assert.ok(Math.abs(dPdVIndep(1, c.Tc, c.Vc)) < 1e-6);
  assert.ok(Math.abs((p(c.Vc + h) - 2 * p(c.Vc) + p(c.Vc - h)) / (h * h)) < 1);
  assert.ok(near(p(c.Vc), c.Pc, 1e-9));
});
test("saturation pressure from the Maxwell equal-area rule matches an independent integral; ~67 atm at 300 K; monotone in T; null at/above Tc", () => {
  const { Tc } = M.vdwCriticalConstants();
  assert.equal(M.vdwSaturationPressure(Tc), null); assert.equal(M.vdwSaturationPressure(320), null);
  assert.ok(Math.abs(M.vdwSaturationPressure(300) - 66.6) < 0.3, String(M.vdwSaturationPressure(300)));
  assert.ok(Math.abs(M.vdwSaturationPressure(0.9 * Tc) / (74.044) - 0.647) < 2e-3, "reduced vdW Psat(0.9 Tc) = 0.647 Pc");
  let prev = 0;
  for (let T = 250; T < Tc - 1; T += 6) {
    const sat = M.vdwSaturation(T); assert.ok(sat.P > prev, `T=${T}`); prev = sat.P;
    const P1 = (V) => vdwIndep(1, T, V);
    assert.ok(Math.abs(P1(sat.xg) - sat.P) < 1e-6 * sat.P && Math.abs(P1(sat.xl) - sat.P) < 1e-6 * sat.P, `roots at T=${T}`);
    let area = 0; const steps = 40000;
    for (let i = 0; i < steps; i++) { const v0 = sat.xl + ((sat.xg - sat.xl) * i) / steps, v1 = sat.xl + ((sat.xg - sat.xl) * (i + 1)) / steps; area += ((P1(v0) - sat.P + P1(v1) - sat.P) / 2) * (v1 - v0); }
    assert.ok(Math.abs(area) < 2e-3 * sat.P * (sat.xg - sat.xl) + 1e-3, `equal-area T=${T}: ${area}`);
  }
});
test("literature sanity: vdW CO2 at 300 K gives Z = 0.996 at 1 atm and Psat within 1% of the measured 67 atm", () => {
  assert.ok(Math.abs(M.compressibilityAtPressure(0.5, 300, 1).Z - 0.996) < 1e-3);
  assert.ok(Math.abs(M.vdwSaturationPressure(300) - 67) / 67 < 0.01);
});

console.log("== Spec case 1: ideal gas always gives Z = 1 ==");
test("1. Z = 1 exactly for every state of the grid (both controls), the curve reference line and the marker", () => {
  assert.equal(M.compressibilityFactor(1.2, 300, 20, "ideal"), 1);
  for (const control of ["volume", "pressure"]) for (const N of [5, 50, 100]) for (const T of [250, 300, 500, 700]) for (const x of [1, 10, 100, 400]) {
    const s = st({ mode: "ideal", control, N, T, V: control === "volume" ? 0.01 + x / 10 : 1, P: control === "pressure" ? x : 30 });
    assert.equal(s.Z, 1); assert.equal(s.cls.index, 0);
    const m = M.zMarker(s);
    assert.equal(m.Z, 1); assert.equal(m.status, "ok"); assert.ok(near(m.P * s.V, s.n * M.R_GAS * s.T));
    assert.equal(m.P, s.pressure);
  }
  const c = M.generateZCurve(1.2, 300, "ideal");
  assert.ok(c.ideal.length === 2 && c.ideal.every((p) => p.Z === 1) && c.ideal[0].P === M.Z_P_MIN && c.ideal[1].P === M.Z_P_MAX);
  assert.deepEqual(M.compressibilityAtPressure(1.2, 300, 3, "ideal").Z, 1);
});

console.log("== Spec case 2: real gas approaches Z = 1 at low pressure ==");
test("2. Z(0.1 atm) within 0.1% of 1 for every temperature; |Z-1| decreases monotonically as P falls (to the Z minimum)", () => {
  const n = nOf(50);
  for (let T = 250; T <= 700; T += 25) {
    const c = M.generateZCurve(n, T, "real"), pts = c.points;
    assert.ok(Math.abs(pts[0].Z - 1) < 1e-3, `T=${T} Z(${pts[0].P})=${pts[0].Z}`);
    const stop = pts.indexOf(c.zMin);
    for (let i = 1; i <= stop; i++) assert.ok(Math.abs(pts[i].Z - 1) >= Math.abs(pts[i - 1].Z - 1) - 1e-12, `T=${T} i=${i}`);
  }
  // second-virial limit: Z - 1 -> (b - a/RT) P / RT
  for (const T of [260, 300, 500]) {
    const z = M.compressibilityAtPressure(0.5, T, 0.2).Z;
    const B = 0.04267 - 3.64 / (R * T);
    assert.ok(Math.abs((z - 1) - (B * 0.2) / (R * T)) < 2e-5, `T=${T}`);
  }
});

console.log("== Spec case 3: the real-gas graph responds to temperature ==");
test("3. the Z curve is recomputed when T changes; V, P and n do not change it; the ideal line is fixed", () => {
  const curveOf = (s) => JSON.stringify(M.generateZCurve(s.n, s.T, s.mode).points);
  const base = stV({ mode: "real", T: 320, V: 0.3 });
  const c0 = curveOf(base);
  for (const T of [260, 300, 315, 400, 600]) assert.notEqual(curveOf(stV({ mode: "real", T, V: 0.3 })), c0, `T=${T}`);
  for (const V of [0.1, 0.3, 2]) assert.equal(curveOf(stV({ mode: "real", T: 320, V })), c0);
  for (const P of [2, 20, 200]) assert.equal(curveOf(stP({ mode: "real", T: 320, P })), c0);
  const a = M.generateZCurve(nOf(10), 400, "real").points, b = M.generateZCurve(nOf(100), 400, "real").points;
  for (let i = 0; i < a.length; i++) assert.ok(near(a[i].Z, b[i].Z, 1e-9)); // Z(P,T) is intensive for per-mole constants
  // the curve at two temperatures differs materially (min Z), and lower T gives the deeper dip
  const z300 = M.generateZCurve(0.5, 300, "real").zMin.Z, z400 = M.generateZCurve(0.5, 400, "real").zMin.Z, z600 = M.generateZCurve(0.5, 600, "real").zMin.Z;
  assert.ok(z300 < 0.7 && z300 < z400 && z400 < z600 && z600 < 0.95, `${z300} ${z400} ${z600}`);
  assert.deepEqual(M.generateZCurve(1, 300, "real").ideal, M.generateZCurve(1, 650, "real").ideal);
});
test("3b. Z < 1 (attraction) and Z > 1 (excluded volume) are both reachable inside the control ranges", () => {
  const n = nOf(50);
  assert.ok(M.compressibilityAtPressure(n, 300, 30).Z < 0.9);
  assert.ok(M.compressibilityAtPressure(n, 350, 100).Z < 0.65);
  assert.ok(M.compressibilityAtPressure(n, 320, M.LIMITS.P.max).Z > 1.1, "supercritical, 500 atm");
  assert.ok(M.compressibilityAtPressure(n, 400, M.LIMITS.P.max).Z > 1.02);
  const lowT = M.generateZCurve(n, 320, "real");
  assert.ok(lowT.points.some((p) => p.Z < 0.5) && lowT.points.some((p) => p.Z > 1.5));
  // the curve crosses Z = 1 above the minimum
  const iMin = lowT.points.indexOf(lowT.zMin);
  assert.ok(lowT.points.slice(iMin).some((p) => p.Z > 1));
  // above T_Boyle Z > 1 at every pressure
  assert.ok(M.generateZCurve(n, 1100, "real").points.every((p) => p.Z > 1));
});

console.log("== Spec case 4: changing pressure moves the operating point ==");
test("4. Pressure control: the live point moves along the real curve (P = target, Z from the solved volume) and V falls as P rises", () => {
  let prevV = Infinity, prevP = 0;
  for (const P of [1, 3, 10, 30, 60, 150, 300, 500]) {
    const s = stP({ mode: "real", T: 360, P });
    assert.equal(s.status, "ok");
    const m = M.zMarker(s);
    assert.ok(near(m.P, P, 1e-8), "marker P = target");
    assert.ok(near(s.pressure, P, 1e-8));
    assert.ok(near(m.Z, (P * s.V) / (s.n * M.R_GAS * 360), 1e-12));
    assert.ok(m.P > prevP && s.V < prevV);
    prevV = s.V; prevP = m.P;
    const onCurve = M.generateZCurve(s.n, 360, "real").points;
    const i = onCurve.findIndex((p) => p.P >= P);
    if (i > 0) { const a = onCurve[i - 1], b = onCurve[i], t = Math.log(P / a.P) / Math.log(b.P / a.P); assert.ok(Math.abs(a.Z + t * (b.Z - a.Z) - m.Z) < 5e-3, `P=${P}`); }
  }
});

console.log("== Spec case 5: changing volume updates pressure and Z ==");
test("5. Volume control: P and Z are recomputed from the vdW equation (independent re-implementation) when V changes", () => {
  let prevP = 0;
  for (const V of [20, 8, 3, 1, 0.5, 0.3, 0.2]) {
    const s = stV({ mode: "real", T: 400, V });
    assert.equal(s.limit, null);
    const n = s.n;
    assert.ok(near(s.pressure, vdwIndep(n, 400, V), 1e-12), `V=${V}`);
    assert.ok(near(s.Z, (s.pressure * V) / (n * R * 400), 1e-12));
    assert.ok(near(M.zMarker(s).Z, s.Z, 1e-12));
    assert.ok(s.pressure > prevP); prevP = s.pressure;
    assert.ok(near(s.Z, s.pressure / M.idealPressure(n, 400, V), 1e-12), "Z = P_real / P_ideal at the same V");
  }
  // Z changes with V
  assert.notEqual(stV({ mode: "real", T: 400, V: 5 }).Z.toFixed(4), stV({ mode: "real", T: 400, V: 0.3 }).Z.toFixed(4));
});

console.log("== Spec case 6: Ideal <-> Real at unchanged conditions differ meaningfully ==");
test("6. switching Ideal <-> Real keeps N, T, control and its value; at 30 atm / 300 K the volume differs by > 10 % and Z by > 0.1", () => {
  const ci = { ...M.DEFAULT_CONTROLS }; // ideal, Change Pressure 30 atm
  const cr = M.applyControlChange(ci, { mode: "real" });
  assert.deepEqual({ N: cr.N, T: cr.T, P: cr.P, control: cr.control }, { N: ci.N, T: ci.T, P: ci.P, control: ci.control });
  const si = M.resolveState(ci), sr = M.resolveState(cr);
  assert.ok(near(si.pressure, 30, 1e-9) && near(sr.pressure, 30, 1e-8));
  assert.ok(Math.abs(sr.V - si.V) / si.V > 0.10, `V ideal ${si.V} real ${sr.V}`);
  assert.ok(sr.V < si.V, "attraction => smaller volume at the same P");
  assert.ok(1 - sr.Z > 0.1 && sr.cls.id === "strong");
  assert.equal(si.Z, 1);
  // the ideal state already reports what the real gas would do
  assert.ok(near(si.ref.Z, sr.Z, 1e-9) && near(si.ref.V, sr.V, 1e-9));
  // Volume control: same V, different P
  const vi = M.resolveState(M.applyControlChange({ ...M.DEFAULT_CONTROLS, mode: "ideal", control: "volume", V: 0.4 }, {}));
  const vr = M.resolveState(M.applyControlChange({ ...M.DEFAULT_CONTROLS, mode: "ideal", control: "volume", V: 0.4 }, { mode: "real" }));
  assert.equal(vr.V, vi.V); assert.ok(vr.pressure < vi.pressure * 0.9, `${vr.pressure} vs ${vi.pressure}`);
  assert.ok(near(vi.ref.Z, vr.Z, 1e-9) && near(vi.ref.P, vr.pressure, 1e-9));
  // at low P the two models agree (< 1 % apart)
  const lo = M.resolveState({ ...M.DEFAULT_CONTROLS, P: 1, mode: "real" });
  assert.ok(Math.abs(lo.Z - 1) < 0.01 && lo.cls.id === "near");
  // everywhere in a Volume/Pressure grid the real-vs-ideal contrast is large somewhere and small elsewhere
  let strong = 0, near1 = 0;
  for (let T = 250; T <= 700; T += 50) for (const P of [1, 5, 30, 100, 400]) { const z = M.compressibilityAtPressure(0.5, T, P); if (!z.valid) continue; if (Math.abs(z.Z - 1) >= 0.1) strong++; if (Math.abs(z.Z - 1) < 0.02) near1++; }
  assert.ok(strong >= 8 && near1 >= 10, `${strong}/${near1}`);
});
test("6b. deviation classes use documented |Z-1| thresholds (0.02, 0.10), independent of P and T ranges", () => {
  assert.deepEqual(M.DEVIATION_CLASSES.map((c) => c.label), ["Near ideal", "Noticeable deviation", "Strong deviation"]);
  assert.deepEqual(M.Z_BOUNDS, { nearIdeal: 0.02, noticeable: 0.1 });
  for (const [dev, idx] of [[0, 0], [0.0199, 0], [0.0201, 1], [0.0999, 1], [0.1001, 2], [0.7, 2]]) {
    assert.equal(M.classifyZDeviation(dev).index, idx, `dev=${dev}`);
    assert.equal(M.classifyZ(1 + dev).index, idx); assert.equal(M.classifyZ(1 - dev).index, idx);
  }
  // the same Z gives the same class at different T and P
  const a = M.compressibilityAtPressure(0.5, 300, 20), b = M.compressibilityAtPressure(0.5, 500, 150);
  const z = (a.Z + b.Z) / 2; assert.equal(M.classifyZ(z).index, M.classifyZ(z).index);
  for (const s of [stP({ mode: "real", P: 3 }), stP({ mode: "real", P: 12 }), stP({ mode: "real", P: 50 })]) assert.equal(s.cls.index, M.classifyZ(s.Z).index);
  assert.equal(stP({ mode: "real", P: 3 }).cls.id, "near"); assert.equal(stP({ mode: "real", P: 12 }).cls.id, "noticeable"); assert.equal(stP({ mode: "real", P: 50 }).cls.id, "strong");
});

console.log("== Spec case 7: graph and numerical values agree ==");
test("7. marker (P, Z) = Live values in both controls, both models; Z = PV/nRT of the displayed numbers; real marker sits on the plotted curve", () => {
  const logInterp = (pts, P) => {
    if (P < pts[0].P || P > pts[pts.length - 1].P) return null;
    for (let i = 1; i < pts.length; i++) if (P <= pts[i].P) { const a = pts[i - 1], b = pts[i], t = Math.log(P / a.P) / Math.log(b.P / a.P); return a.Z + t * (b.Z - a.Z); }
    return null;
  };
  const states = [
    stV({ mode: "real" }), stV({ mode: "real", N: 80, T: 500, V: 0.4 }), stV({ mode: "real", N: 30, T: 330, V: 0.8 }), stV({ mode: "real", N: 100, T: 700, V: 0.3 }),
    stP({ mode: "real", N: 70, T: 400, P: 60 }), stP({ mode: "real", N: 40, T: 270, P: 20 }), stP({ mode: "real", N: 60, T: 600, P: 400 }), stP({ mode: "real", T: 320, P: 5 }),
  ];
  let onCurve = 0;
  for (const s of states) {
    const m = M.zMarker(s);
    assert.equal(s.limit, null, `${s.T},${s.N}`);
    assert.ok(near(m.P, s.pressure, 1e-12) && near(m.Z, (s.pressure * s.V) / (s.n * M.R_GAS * s.T), 1e-12));
    assert.ok(near(m.deviationPct, Math.abs(s.Z - 1) * 100, 1e-9));
    const yc = logInterp(M.generateZCurve(s.n, s.T, "real").points, m.P);
    assert.ok(yc != null && Math.abs(yc - m.Z) < 6e-3, `on curve ${yc} vs ${m.Z}`); onCurve++;
  }
  assert.equal(onCurve, states.length);
  // Ideal mode: the live point is (P, 1) and the comparison point is the real curve at the same P / V
  for (const s of [stP({ mode: "ideal", T: 320, P: 40 }), stV({ mode: "ideal", T: 320, V: 0.5 })]) {
    const m = M.zMarker(s);
    assert.equal(m.Z, 1); assert.ok(m.real && m.real.Z < 1);
    if (s.control === "pressure") assert.ok(near(m.real.P, m.P, 1e-9));
    const yc = (() => { const pts = M.generateZCurve(s.n, s.T, "real").points; for (let i = 1; i < pts.length; i++) if (m.real.P <= pts[i].P) { const a = pts[i - 1], b = pts[i], t = Math.log(m.real.P / a.P) / Math.log(b.P / a.P); return a.Z + t * (b.Z - a.Z); } return null; })();
    assert.ok(Math.abs(yc - m.real.Z) < 6e-3);
  }
  // the numbers shown in the indicator, the live strip and the graph come from one state
  const s = stP({ mode: "real", P: 45 });
  assert.equal(s.cls.index, M.zMarker(s).real === null ? s.cls.index : s.cls.index);
  assert.ok(near(s.ref.Z, s.Z, 1e-9));
});

console.log("== Spec case 8: safe near the limits ==");
test("8a. two-phase region (T < Tc): gas branch only; targets >= P_sat give a model-limit state, never a liquid-like root", () => {
  const n = nOf(50);
  for (const T of [250, 270, 290, 300, 305]) {
    const sat = M.vdwSaturation(T);
    const below = M.solveVolumeForPressure(n, T, sat.P * 0.97, "real");
    assert.equal(below.status === "ok" || below.status === "below-range", true);
    assert.ok(below.vRequired > n * sat.xg * (1 - 1e-9), `T=${T}: V ${below.vRequired} vs saturated-gas V ${n * sat.xg}`);
    assert.ok(dPdVIndep(n, T, below.vRequired) < 0);
    for (const f of [1.0001, 1.05, 3]) {
      const above = M.solveVolumeForPressure(n, T, sat.P * f, "real");
      assert.equal(above.status, "no-gas-solution"); assert.equal(above.reason, "condensation"); assert.equal(above.reachable, false);
      assert.ok(above.V <= M.LIMITS.V.max && above.V >= M.LIMITS.V.min);
    }
    const s = stP({ mode: "real", T, P: Math.min(M.LIMITS.P.max, sat.P * 1.1) });
    assert.ok(s.limit && s.limit.reason === "condensation"); assert.match(s.note, /Model limit/); assert.equal(s.cls, null);
    const m = M.zMarker(s); assert.equal(m.status, "limit"); assert.equal(m.onCurve, false);
  }
  // the whole sweep never lands on the liquid branch: V_real >= saturated-gas volume
  for (let T = 250; T < 308; T += 4) for (let P = 1; P <= 500; P *= 1.4) {
    const s = stP({ mode: "real", T, P });
    if (s.status === "ok") assert.ok(s.V >= nOf(50) * M.vdwSaturation(T).xg * (1 - 1e-9), `${T} ${P}`);
  }
});
test("8b. Volume control inside the two-phase region: pressure is the saturation plateau, flagged as a model limit; above Tc the isotherm is single-valued", () => {
  const sat = M.vdwSaturation(280);
  const s = stV({ mode: "real", T: 280, N: 50, V: 0.2 * nOf(50) * sat.xg });
  assert.equal(s.limit.reason, "two-phase"); assert.ok(near(s.pressure, sat.P, 1e-9)); assert.match(s.note, /Model limit/);
  assert.equal(s.comparison.status, "unreliable");
  const hot = stV({ mode: "real", T: 320, N: 50, V: 0.05 });
  assert.equal(hot.limit, null);
  for (let V = 0.03; V < 50; V *= 1.2) { const n = nOf(50); if (V > n * 0.04267 / 0.8) assert.ok(dPdVIndep(n, 320, V) < 0, `monotone above Tc, V=${V}`); }
});
test("8c. extreme / invalid inputs never produce NaN or non-physical numbers", () => {
  for (const bad of [{ N: 1e9, T: 1e9, V: 0 }, { N: -5, T: -1, V: -1 }, { N: NaN, T: 300, V: 1 }, { N: 50, T: 300, V: NaN }, { P: NaN }, { P: 1e9, control: "pressure" }]) {
    for (const mode of ["ideal", "real"]) {
      const s = M.resolveState({ ...M.DEFAULT_CONTROLS, mode, ...bad });
      assert.ok(Number.isFinite(s.pressure) && s.pressure >= 0 && Number.isFinite(s.V) && s.V >= M.LIMITS.V.min && s.V <= M.LIMITS.V.max, JSON.stringify(bad));
      assert.ok(Number.isFinite(s.Z));
      const m = M.zMarker(s); assert.ok(Number.isFinite(m.P) && Number.isFinite(m.plotP));
    }
  }
  for (const args of [[0, 300, 1], [1, 0, 1], [1, 300, 0], [1, 300, -2], [1, 300, NaN]]) assert.equal(M.compressibilityAtPressure(...args).valid, false);
  assert.ok(Number.isNaN(M.compressibilityFactor(1, 300, 0.03, "real"))); // V < n b
  assert.equal(M.compareWithIdeal(1, 300, 0.05).reason, "excluded-volume");
  assert.equal(M.compareWithIdeal(NaN, 300, 25).status, "unreliable");
  assert.equal(M.compareWithIdeal(1e-12, 300, 25).reason, "ideal-pressure-near-zero");
  assert.equal(M.solveVolumeForPressure(1, 300, -1).status, "invalid");
});
test("8d. whole control grid: states are finite; every real state is ok or an explicit model limit; curves are finite, ordered and on the gas branch", () => {
  let limits = 0, ok = 0;
  for (const control of ["pressure", "volume"]) for (const N of [5, 50, 100]) for (let T = 250; T <= 700; T += 30) for (const x of [1, 2.5, 7, 20, 60, 150, 500]) {
    const s = st({ mode: "real", control, N, T, V: control === "volume" ? 100 / x : 1, P: x });
    assert.ok(Number.isFinite(s.pressure) && Number.isFinite(s.V) && Number.isFinite(s.Z) && s.pressure > 0, `${control},${N},${T},${x}`);
    if (s.limit || s.status !== "ok") limits++; else ok++;
  }
  assert.ok(ok > 400 && limits > 20, `${ok}/${limits}`);
  for (const N of [5, 50, 100]) for (let T = 250; T <= 700; T += 50) {
    const n = nOf(N), c = M.generateZCurve(n, T, "real"), vLo = M.vdwGasBranchMinVolume(n, T);
    assert.ok(c.points.length > 5);
    for (let i = 0; i < c.points.length; i++) {
      const p = c.points[i];
      assert.ok(Number.isFinite(p.Z) && p.Z > 0 && Math.abs(vdwIndep(n, T, p.V) - p.P) <= 1e-7 * p.P && dPdVIndep(n, T, p.V) < 0 && p.V >= vLo * (1 - 1e-9));
      assert.ok(near(p.Z, (p.P * p.V) / (n * M.R_GAS * T), 1e-12));
      if (i) assert.ok(p.P > c.points[i - 1].P);
    }
    if (T < 308) assert.equal(c.end.reason, "condensation"); else assert.ok(c.end == null || c.end.reason === "excluded-volume");
  }
  const ax = M.zAxisRange(M.generateZCurve(0.5, 320, "real"), null);
  assert.ok(ax.yMin >= 0 && ax.yMax <= M.Z_Y_CAP && ax.yMin < 0.5 && ax.yMax > 1.5);
});
test("8e. unreachable pressures report their reason (volume range) without NaN", () => {
  assert.equal(M.solveVolumeForPressure(nOf(5), 700, 1, "ideal").status, "ok"); // 2.9 L
  assert.equal(M.solveVolumeForPressure(nOf(5), 250, 500, "ideal").status, "below-range"); // 0.0021 L
  assert.equal(M.solveVolumeForPressure(nOf(100), 700, 1, "ideal").status, "ok");
  const s = stP({ mode: "ideal", N: 5, T: 250, P: 500 });
  assert.equal(s.status, "below-range"); assert.equal(s.V, M.LIMITS.V.min); assert.match(s.note, /unreachable/);
});

console.log("== Pressure control (solver) ==");
test("ideal solver: PV = nRT within 1e-9 and V = nRT/P", () => {
  for (const N of [5, 50, 100]) for (const T of [250, 300, 700]) for (const P of [1, 30, 500]) {
    const n = nOf(N), sol = M.solveVolumeForPressure(n, T, P, "ideal");
    assert.ok(rel(sol.vRequired * P, n * M.R_GAS * T) < 1e-9);
  }
});
test("real solver: residual |P_vdW(V*) - P| tiny and branch stable (dP/dV < 0) with V* > n b", () => {
  let solved = 0;
  for (let N = 5; N <= 100; N += 19) for (let T = 250; T <= 700; T += 50) for (const P of [1, 5, 20, 60, 150, 400]) {
    const n = nOf(N), sol = M.solveVolumeForPressure(n, T, P, "real");
    if (sol.vRequired == null) { assert.equal(sol.status, "no-gas-solution"); continue; }
    solved++;
    assert.ok(sol.vRequired > n * 0.04267 * 1.2);
    assert.ok(Math.abs(vdwIndep(n, T, sol.vRequired) - P) < 1e-8 * Math.max(1, P), `${N},${T},${P}`);
    assert.ok(dPdVIndep(n, T, sol.vRequired) < 0);
  }
  assert.ok(solved > 100);
});
test("scenario: at fixed T and P, n up => V up (ideal and real)", () => {
  for (const gas of ["ideal", "real"]) {
    let prev = 0;
    for (const N of [5, 20, 40, 60, 80, 100]) { const sol = M.solveVolumeForPressure(nOf(N), 400, 20, gas); assert.ok(sol.vRequired > prev, `${gas} N=${N}`); prev = sol.vRequired; }
  }
});
test("Volume->Pressure switch: no jump (V unchanged, target P = current P), ideal and real; back keeps V", () => {
  for (const mode of ["ideal", "real"]) for (const V of [0.12, 0.5, 2, 9]) {
    const c0 = { ...M.DEFAULT_CONTROLS, control: "volume", mode, V, T: 350, N: 63 };
    const s0 = M.resolveState(c0);
    const c1 = M.applyControlChange(c0, { control: "pressure" });
    const s1 = M.resolveState(c1);
    assert.equal(c1.control, "pressure");
    assert.ok(Math.abs(s1.V - s0.V) < 1e-6 * s0.V, `${mode} V ${s1.V} vs ${s0.V}`);
    assert.ok(Math.abs(s1.pressure - s0.pressure) < 1e-6 * Math.max(1, s0.pressure));
    const c2 = M.applyControlChange(c1, { control: "volume" });
    assert.equal(c2.control, "volume"); assert.ok(Math.abs(c2.V - s0.V) < 1e-6 * s0.V);
  }
});
test("switch with current P outside 1-500 atm: slider clamped, exact pressure held, piston does not move", () => {
  const c0 = { ...M.DEFAULT_CONTROLS, control: "volume", V: 0.02, T: 700, N: 100 };
  const s0 = M.resolveState(c0);
  assert.ok(s0.pressure > 500);
  const c1 = M.applyControlChange(c0, { control: "pressure" });
  assert.equal(c1.P, M.LIMITS.P.max); assert.ok(near(c1.Phold, s0.pressure));
  const s1 = M.resolveState(c1);
  assert.ok(Math.abs(s1.V - 0.02) < 1e-6); assert.ok(/outside the slider range/.test(s1.note));
  const c2 = M.applyControlChange(c1, { P: 300 });
  assert.equal(c2.Phold, null); assert.ok(M.resolveState(c2).V > 0.02);
});
test("switch from a state that cannot be solved (real gas beyond P_sat) holds the volume instead of jumping", () => {
  const sat = M.vdwSaturation(280);
  const V = 0.2 * nOf(50) * sat.xg;
  const c0 = { ...M.DEFAULT_CONTROLS, mode: "real", control: "volume", T: 280, V };
  const c1 = M.applyControlChange(c0, { control: "pressure" });
  assert.ok(c1.Vpin != null && Math.abs(M.resolveState(c1).V - V) < 1e-12);
  const c2 = M.applyControlChange(c1, { P: 5 });
  assert.equal(c2.Vpin, null);
});
test("Pressure control: T or N change re-solves V at the held P; P slider moves the piston; Volume control recalculates P", () => {
  let c = { ...M.DEFAULT_CONTROLS };
  const s0 = M.resolveState(c);
  c = M.applyControlChange(c, { T: 450 });
  let s = M.resolveState(c);
  assert.ok(near(s.pressure, 30, 1e-9) && near(s.V, s0.V * 450 / 300, 1e-9)); // ideal: V ~ T at constant P
  assert.ok(M.resolveState(M.applyControlChange(c, { N: 25 })).V < s.V);
  assert.ok(M.resolveState(M.applyControlChange(c, { P: 100 })).V < M.resolveState(M.applyControlChange(c, { P: 10 })).V);
  assert.equal(M.applyControlChange(c, { V: 7 }).V, c.V, "V patch ignored in Pressure control");
  const v = M.applyControlChange({ ...M.DEFAULT_CONTROLS, control: "volume", V: 0.5 }, { T: 450 });
  assert.ok(near(M.resolveState(v).pressure, 0.5 * M.R_GAS * 450 / 0.5, 1e-9));
});
test("simulation piston follows the SOLVED volume (and reset restores the default Change Pressure state)", () => {
  const sim = M.createSimulation({ seed: 3 });
  const c = M.applyControlChange(sim.controls, { P: 100 });
  sim.setControls(c);
  const want = M.resolveState(c).V;
  sim.settle(6);
  assert.ok(Math.abs(sim.pistonH - M.pistonHeight(want)) < 0.01);
  assert.ok(near(sim.getReadings().pressure, 100, 1e-9));
  sim.reset();
  assert.deepEqual(sim.controls, M.DEFAULT_CONTROLS);
  assert.ok(Math.abs(sim.pistonH - M.pistonHeight(M.resolveState(M.DEFAULT_CONTROLS).V)) < 1e-9);
});

console.log("== What Is Happening explanations ==");
const E = (a, b) => M.selectExplanation({ ...M.DEFAULT_CONTROLS, ...a }, { ...M.DEFAULT_CONTROLS, ...b });
test("explanations correspond to the change (Volume control)", () => {
  const v = { control: "volume", V: 1 };
  assert.equal(E(v, { ...v, T: 400 }).id, "tempUpV"); assert.equal(E(v, { ...v, T: 270 }).id, "tempDownV");
  assert.equal(E(v, { ...v, V: 0.4 }).id, "volDown"); assert.equal(E(v, { ...v, V: 3 }).id, "volUp");
  assert.equal(E(v, { ...v, N: 80 }).id, "nUpV"); assert.equal(E(v, { ...v, N: 20 }).id, "nDownV");
  assert.equal(E(v, { ...v, mode: "real" }).id, "realSelected"); assert.equal(E({ ...v, mode: "real" }, { ...v, mode: "ideal" }).id, "idealSelected");
  assert.equal(E({}, { control: "volume" }).id, "controlVolume"); assert.equal(E({ control: "volume" }, { control: "pressure" }).id, "controlPressure");
  assert.equal(E({}, {}), null);
  assert.equal(M.selectExplanation(null, M.DEFAULT_CONTROLS).id, "initial");
  assert.equal(M.selectExplanation(null, { ...M.DEFAULT_CONTROLS, mode: "real" }).id, "initialReal");
});
test("explanations in Pressure control state the held-constant relationship and the pressure cases", () => {
  const p = { control: "pressure", P: 10 };
  assert.equal(E(p, { ...p, T: 500 }).id, "tempUpP"); assert.equal(E(p, { ...p, T: 270 }).id, "tempDownP");
  assert.equal(E(p, { ...p, N: 80 }).id, "nUpP"); assert.equal(E(p, { ...p, N: 30 }).id, "nDownP");
  assert.equal(E(p, { ...p, P: 40 }).id, "pressureUp"); assert.equal(E(p, { ...p, P: 3 }).id, "pressureDown");
  assert.equal(E({ ...p, N: 5, T: 250, P: 400 }, { ...p, N: 5, T: 250, P: 500 }).id, "unreachableLow");
  // (V_max = 100 L is never hit: the largest volume in range is n R T / P_min = 57 L, so "unreachableHigh" cannot occur with these ranges.)
  const r = { ...p, mode: "real", T: 280 };
  assert.equal(E({ ...r, P: 30 }, { ...r, P: 60 }).id, "noGasSolutionCondensation");
});
test("'approaches ideal' and 'deviation increasing' only when the computed state warrants them", () => {
  const r = { mode: "real", control: "pressure", P: 40, T: 320 };
  const far = M.resolveState({ ...M.DEFAULT_CONTROLS, ...r }).ref;
  assert.equal(far.cls.index, 2);
  assert.equal(E(r, { ...r, T: 700 }).id, "approachIdeal"); // hotter, same P: closer to ideal
  assert.equal(E({ ...r, P: 2 }, { ...r, P: 20 }).id, "deviationUp");
  assert.ok(!["approachIdeal", "deviationUp"].includes(E({ ...r, mode: "ideal" }, { ...r, mode: "ideal", P: 80 }).id));
  assert.ok(!["approachIdeal", "deviationUp"].includes(E({ mode: "real", control: "pressure", P: 1, T: 600 }, { mode: "real", control: "pressure", P: 1.1, T: 600 }).id));
  assert.equal(E({ mode: "real", control: "volume", T: 280, V: 1 }, { mode: "real", control: "volume", T: 280, V: 0.05 }).id, "unreliable");
});
test("no text claims the particle picture is molecular dynamics", () => {
  const all = JSON.stringify(M.EXPLANATIONS) + JSON.stringify(M.UNRELIABLE_TEXT);
  assert.doesNotMatch(all, /molecular dynamics/i);
});
test("source of truth: deviationPercent helper and Z identity", () => {
  assert.ok(Math.abs(M.deviationPercent(2, 1.5) - 25) < 1e-12); assert.equal(M.deviationPercent(0, 1), 0);
  const s = stV({ mode: "real", T: 330, V: 0.35 });
  assert.ok(near(s.deviationPct, M.deviationPercent(s.pIdeal, s.pReal), 1e-9));
  assert.equal(M.zExplanation(1).id, "ideal"); assert.equal(M.zExplanation(0.9).id, "below"); assert.equal(M.zExplanation(1.1).id, "above");
  assert.equal(M.zExplanation(0.9799).id, "below"); assert.equal(M.zExplanation(0.9801).id, "ideal"); assert.equal(M.zExplanation(NaN).id, "unreliable");
});


console.log("== Collisions (check 5) ==");
test("5a. particle-particle collision conserves momentum and KE (1e-9), many random cases", () => {
  const rng = M.makeRng(7);
  let applied = 0;
  for (let i = 0; i < 5000; i++) {
    const a = { x: 0, y: 0, vx: (rng() - 0.5) * 400, vy: (rng() - 0.5) * 400 };
    const ang = rng() * 2 * Math.PI;
    const b = { x: 3 * Math.cos(ang), y: 3 * Math.sin(ang), vx: (rng() - 0.5) * 400, vy: (rng() - 0.5) * 400 };
    const p0 = [a.vx + b.vx, a.vy + b.vy];
    const k0 = a.vx ** 2 + a.vy ** 2 + b.vx ** 2 + b.vy ** 2;
    if (M.collidePair(a, b)) applied++;
    const p1 = [a.vx + b.vx, a.vy + b.vy];
    const k1 = a.vx ** 2 + a.vy ** 2 + b.vx ** 2 + b.vy ** 2;
    assert.ok(Math.abs(p1[0] - p0[0]) < 1e-9 && Math.abs(p1[1] - p0[1]) < 1e-9);
    assert.ok(rel(k0, k1) < 1e-9);
  }
  assert.ok(applied > 1000);
});
test("5b. separating particles do not collide", () => {
  const a = { x: 0, y: 0, vx: -1, vy: 0 }, b = { x: 3, y: 0, vx: 1, vy: 0 };
  assert.equal(M.collidePair(a, b), false);
  assert.deepEqual([a.vx, b.vx], [-1, 1]);
});
test("5c. static wall reflection conserves KE; moving wall reflects in the wall frame", () => {
  assert.equal(Math.abs(M.reflectWall1D(-37.5, 0)), 37.5);
  assert.equal(M.reflectWall1D(10, 4), -2); // wall moving toward particle at +4: relative speed preserved
  assert.equal(10 - 4, -(M.reflectWall1D(10, 4) - 4));
});
test("5d. ideal-mode run settles at the chosen temperature (kinetic T within 15% of 300 K)", () => {
  const sim = M.createSimulation({ seed: 5 });
  sim.settle(3);
  const s = sim.getStats();
  assert.ok(Math.abs(s.kineticTemperature - 300) / 300 < 0.15);
});


console.log("== Temperature scaling (v ~ sqrt(T)) ==");
test("mean speed ratio 700 K / 250 K = sqrt(2.8) after rescale (and 500/250 = sqrt 2)", () => {
  function meanSpeedAt(T, seed) {
    const sim = M.createSimulation({ seed });
    sim.setControls({ T, N: 100, control: "volume", V: 1 });
    sim.settle(5);
    let acc = 0;
    for (let k = 0; k < 20; k++) { sim.settle(0.25); acc += sim.getStats().meanSpeed; }
    return acc / 20;
  }
  const r = meanSpeedAt(700, 3) / meanSpeedAt(250, 4);
  assert.ok(Math.abs(r - Math.sqrt(2.8)) < 0.1, `ratio ${r}`);
  const r2 = meanSpeedAt(500, 5) / meanSpeedAt(250, 6);
  assert.ok(Math.abs(r2 - Math.SQRT2) < 0.08, `ratio ${r2}`);
});
test("changing T rescales smoothly (no single-step jump) and converges", () => {
  const sim = M.createSimulation({ seed: 9 });
  sim.settle(2);
  sim.setControls({ T: 700 });
  const v0 = sim.getStats().meanSpeed;
  sim.settle(1 / 240 * 2);
  assert.ok(sim.getStats().meanSpeed / v0 < 1.02, "should not jump instantly");
  sim.settle(5);
  assert.ok(Math.abs(sim.getStats().kineticTemperature - 700) / 700 < 0.15);
});

console.log("== Particle illustration: Real vs Ideal ==");
test("real mode uses a larger collision radius than ideal (finite size / excluded volume cue); ideal = point-particle model", () => {
  const s = M.createSimulation({ seed: 2 });
  s.setControls({ mode: "real" }); s.settle(3);
  assert.ok(Math.abs(s.radius - M.R_REAL) < 1e-3 && M.R_REAL > M.R_IDEAL);
  s.setControls({ mode: "ideal" }); s.settle(3);
  assert.ok(Math.abs(s.radius - M.R_IDEAL) < 1e-3);
  s.setControls({ mode: "ideal", N: 100, control: "volume", V: 0.02, T: 250 }); s.settle(1);
  assert.equal(s.getForcePairs().length, 0);
});
test("real-gas particles cohere more at 250 K than at 700 K (attraction visual relative to kT); ideal never attracts", () => {
  function neighbours(T, mode) {
    let acc = 0;
    for (const seed of [1, 2, 3]) {
      const s = M.createSimulation({ seed });
      s.setControls({ mode, T, control: "volume", V: 0.3, N: 50 });
      s.settle(3);
      for (let k = 0; k < 16; k++) {
        s.settle(0.5);
        const ps = s.particles, S = 2 * s.radius;
        let c = 0;
        for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) if (Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y) < 1.6 * S) c += 2;
        acc += c / ps.length;
      }
    }
    return acc / 48;
  }
  const n250 = neighbours(250, "real"), n700 = neighbours(700, "real"), ideal250 = neighbours(250, "ideal");
  assert.ok(n250 > 1.2 * n700, `250K ${n250} vs 700K ${n700}`);
  assert.ok(n250 > ideal250, `real ${n250} vs ideal ${ideal250}`);
});
test("real gas shows crowding: compressing (smaller V) raises the neighbour count", () => {
  function nb(V) {
    const s = M.createSimulation({ seed: 5 });
    s.setControls({ mode: "real", control: "volume", V, N: 80, T: 300 }); s.settle(4);
    const ps = s.particles, S = 2 * s.radius; let c = 0;
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) if (Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y) < 1.6 * S) c += 2;
    return c / ps.length;
  }
  assert.ok(nb(0.05) > nb(5) + 0.3, `${nb(0.05)} vs ${nb(5)}`);
});


console.log("== Chamber integrity, count, pause, reset ==");
function assertInside(sim, tag) {
  const r = sim.radius, h = sim.pistonH, eps = 1e-9;
  for (const p of sim.particles) {
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.vx) && Number.isFinite(p.vy), `NaN ${tag}`);
    assert.ok(p.x >= r - eps && p.x <= M.CHAMBER.width - r + eps, `x out ${p.x} ${tag}`);
    assert.ok(p.y >= r - eps && p.y <= h - r + eps, `y out ${p.y} (piston ${h}) ${tag}`);
  }
}
test("9/10. long randomised run: no escapes past walls/piston, no NaN (ideal + real, fast control changes)", () => {
  const rng = M.makeRng(99);
  const sim = M.createSimulation({ seed: 11 });
  const dt = 1 / 60;
  for (let frame = 0; frame < 12000; frame++) {
    if (frame % 7 === 0) {
      sim.setControls({
        N: 5 + Math.floor(rng() * 96), T: 250 + Math.floor(rng() * 451), V: 0.01 * Math.pow(1e4, rng()), control: "volume",
        mode: rng() < 0.5 ? "ideal" : "real",
      });
    }
    sim.advance(dt);
    assertInside(sim, `frame ${frame}`);
  }
});
test("9. piston squeezes quickly from 100 L to 0.05 L with 100 particles: nobody passes the piston", () => {
  for (const mode of ["ideal", "real"]) {
    const sim = M.createSimulation({ seed: 21 });
    sim.setControls({ mode, N: 100, V: 100, control: "volume" });
    sim.settle(4);
    sim.setControls({ V: 0.05 });
    for (let i = 0; i < 60 * 8; i++) { sim.advance(1 / 60); assertInside(sim, `${mode} ${i}`); }
    assert.ok(Math.abs(sim.pistonH - M.pistonHeight(0.05)) < 0.5);
  }
});
test("piston height follows log(V) (monotone, fixed ends) and moves smoothly, not teleporting", () => {
  const sim = M.createSimulation({ seed: 4 });
  assert.ok(Math.abs(M.pistonHeight(M.LIMITS.V.max) - M.CHAMBER.maxHeight) < 1e-9);
  assert.ok(Math.abs(M.pistonHeight(M.LIMITS.V.min) - M.CHAMBER.maxHeight * M.MIN_HEIGHT_FRACTION) < 1e-9);
  assert.ok(Math.abs(M.pistonHeight(1) - M.pistonHeight(0.1) - (M.pistonHeight(10) - M.pistonHeight(1))) < 1e-9, "equal ratios give equal steps");
  let prevH = 0; for (let V = 0.01; V <= 100; V *= 1.3) { const h = M.pistonHeight(V); assert.ok(h > prevH); prevH = h; }
  const V0 = M.resolveState(M.DEFAULT_CONTROLS).V;
  assert.ok(Math.abs(sim.pistonH - M.pistonHeight(V0)) < 1e-9);
  sim.setControls({ control: "volume", V: 0.1 });
  sim.advance(1 / 60);
  assert.ok(sim.pistonH < M.pistonHeight(V0) && sim.pistonH > M.pistonHeight(V0) - 3);
  sim.settle(6);
  assert.ok(Math.abs(sim.pistonH - M.pistonHeight(0.1)) < 0.01);
});
test("particle count: smooth add (fade-in) and remove (fade-out) to the slider value, no overlaps at spawn", () => {
  const sim = M.createSimulation({ seed: 8 });
  sim.setControls({ N: 100 });
  sim.advance(1 / 60);
  assert.ok(sim.particles.length > 50 && sim.particles.length < 100, "added gradually");
  assert.ok(sim.particles.some((p) => p.alpha < 1), "fading in");
  sim.settle(3);
  assert.equal(sim.particles.filter((p) => p.fade >= 0).length, 100);
  assert.ok(sim.particles.every((p) => p.alpha === 1));
  sim.setControls({ N: 10 });
  sim.advance(0.05);
  assert.ok(sim.particles.some((p) => p.fade < 0));
  sim.settle(3);
  assert.equal(sim.particles.length, 10);
  // spawn positions are non-overlapping at default density
  const s2 = M.createSimulation({ seed: 3 });
  const D = 2 * s2.radius;
  for (let i = 0; i < s2.particles.length; i++) for (let j = i + 1; j < s2.particles.length; j++) {
    assert.ok(Math.hypot(s2.particles[i].x - s2.particles[j].x, s2.particles[i].y - s2.particles[j].y) >= D);
  }
});
test("8. pause freezes motion without resetting; resume continues", () => {
  const sim = M.createSimulation({ seed: 6 });
  sim.advance(0.5);
  const snap = sim.particles.map((p) => [p.x, p.y]);
  const t = sim.time;
  sim.setPaused(true);
  sim.advance(2);
  assert.equal(sim.time, t);
  assert.deepEqual(sim.particles.map((p) => [p.x, p.y]), snap);
  sim.setPaused(false);
  sim.advance(0.2);
  assert.notDeepEqual(sim.particles.map((p) => [p.x, p.y]), snap);
});
test("8. while paused, control changes apply instantly (piston, count, T) with nobody out of bounds", () => {
  const sim = M.createSimulation({ seed: 6 });
  sim.setPaused(true);
  sim.setControls({ control: "volume", V: 0.05, N: 20, T: 700, mode: "real" });
  assert.equal(sim.particles.length, 20);
  assert.ok(Math.abs(sim.pistonH - M.pistonHeight(0.05)) < 1e-9);
  assertInside(sim, "paused");
  assert.ok(Math.abs(sim.getStats().kineticTemperature - 700) < 1e-6);
});
test("8. reset restores N=50, T=300 K, Change Pressure at 30 atm, ideal, default display, playing", () => {
  const sim = M.createSimulation({ seed: 6 });
  sim.setControls({ N: 90, T: 650, V: 8, mode: "real", control: "volume" });
  sim.setDisplay({ trails: false, collisions: true, forces: true });
  sim.setPaused(true);
  sim.reset();
  assert.deepEqual(sim.controls, M.DEFAULT_CONTROLS);
  assert.deepEqual(sim.display, M.DEFAULT_DISPLAY);
  assert.equal(sim.paused, false);
  assert.equal(sim.particles.length, 50);
  assert.ok(Math.abs(sim.getReadings().pressure - 30) < 1e-9);
  assertInside(sim, "reset");
});
test("8. collision events are only recorded when the display option is on", () => {
  const sim = M.createSimulation({ seed: 6 });
  sim.advance(1);
  assert.equal(sim.events.length, 0);
  sim.setDisplay({ collisions: true });
  let sawWall = false, sawPair = false, max = 0;
  for (let i = 0; i < 300; i++) {
    sim.advance(1 / 60);
    max = Math.max(max, sim.events.length);
    sawWall ||= sim.events.some((e) => e.kind === "wall");
    sawPair ||= sim.events.some((e) => e.kind === "pair");
  }
  assert.ok(sawWall && sawPair && max <= 80);
});
test("simulation is deterministic for a given seed", () => {
  const a = M.createSimulation({ seed: 77 }), b = M.createSimulation({ seed: 77 });
  a.advance(1); b.advance(1);
  assert.deepEqual(a.particles.map((p) => p.x), b.particles.map((p) => p.x));
});

test("long random run in BOTH control modes: nobody leaves the chamber, no NaN, state always finite", () => {
  const rng = M.makeRng(2024);
  const sim = M.createSimulation({ seed: 31 });
  let controls = { ...sim.controls };
  for (let frame = 0; frame < 9000; frame++) {
    if (frame % 9 === 0) {
      const k = rng();
      if (k < 0.15) controls = M.applyControlChange(controls, { control: rng() < 0.5 ? "pressure" : "volume" });
      else if (k < 0.3) controls = M.applyControlChange(controls, { mode: rng() < 0.5 ? "ideal" : "real" });
      else if (k < 0.5) controls = M.applyControlChange(controls, { N: 5 + Math.floor(rng() * 96) });
      else if (k < 0.7) controls = M.applyControlChange(controls, { T: 250 + Math.floor(rng() * 451) });
      else if (k < 0.85) controls = M.applyControlChange(controls, { V: 0.01 * Math.pow(1e4, rng()) });
      else controls = M.applyControlChange(controls, { P: Math.pow(500, rng()) });
      sim.setControls(controls);
      const r = sim.getReadings();
      assert.ok(Number.isFinite(r.V) && Number.isFinite(r.pressure) && r.V >= M.LIMITS.V.min && r.V <= M.LIMITS.V.max);
    }
    sim.advance(1 / 60);
    assertInside(sim, `frame ${frame}`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
