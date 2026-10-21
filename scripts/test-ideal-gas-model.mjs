#!/usr/bin/env node
// Node tests for the Ideal Gas Simulation model (pure JS, no DOM/React):
//   node scripts/test-ideal-gas-model.mjs
// Covers the ten checks in the spec (section 11) plus reset/pause semantics
// and the deviation-indicator thresholds.
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
const nOf = (N) => M.amountOfSubstance(N);
const P = (N, T, V, mode = "ideal") => M.computeReadings({ mode, N, T, V }).pressure;

console.log("== Ideal gas law (checks 1-4) ==");
test("1. T up at constant V, n => P up", () => {
  let prev = 0;
  for (let T = 100; T <= 800; T += 50) { const p = P(50, T, 25); assert.ok(p > prev); prev = p; }
});
test("2. V down at constant T, n => P up", () => {
  let prev = 0;
  for (let V = 50; V >= 5; V -= 5) { const p = P(50, 300, V); assert.ok(p > prev); prev = p; }
});
test("3. n up at constant T, V => P up", () => {
  let prev = 0;
  for (let N = 5; N <= 100; N += 5) { const p = P(N, 300, 25); assert.ok(p > prev); prev = p; }
});
test("4. PV = nRT within 1e-9 relative over the whole slider grid", () => {
  for (const N of [5, 23, 50, 77, 100]) for (const T of [100, 333, 800]) for (const V of [5, 12, 25, 50]) {
    const n = nOf(N);
    assert.ok(rel(M.idealPressure(n, T, V) * V, n * M.R_GAS * T) < 1e-9);
  }
});
test("default state (N=50, 300 K, 25 L) gives 1.00 atm; n_ref ~ 1.0156 mol", () => {
  assert.ok(Math.abs(P(50, 300, 25) - 1.0) < 1e-9);
  assert.ok(Math.abs(nOf(50) - 1.0156) < 1e-3);
});
test("mode switch preserves N, T, V and displayed readings use the same inputs", () => {
  const sim = M.createSimulation({ seed: 1 });
  sim.setControls({ N: 70, T: 450, V: 12 });
  sim.setControls({ mode: "real" });
  assert.deepEqual({ N: sim.controls.N, T: sim.controls.T, V: sim.controls.V }, { N: 70, T: 450, V: 12 });
  assert.equal(sim.getReadings().mode, "real");
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

console.log("== Temperature scaling (check: v ~ sqrt(T)) ==");
test("mean speed ratio 800 K / 200 K ~ 2 after rescale (and = sqrt(T) for several pairs)", () => {
  function meanSpeedAt(T, seed) {
    const sim = M.createSimulation({ seed });
    sim.setControls({ T, N: 100 });
    sim.settle(5);
    let acc = 0;
    for (let k = 0; k < 20; k++) { sim.settle(0.25); acc += sim.getStats().meanSpeed; }
    return acc / 20;
  }
  const r = meanSpeedAt(800, 3) / meanSpeedAt(200, 4);
  assert.ok(Math.abs(r - 2) < 0.1, `ratio ${r}`);
  const r2 = meanSpeedAt(400, 5) / meanSpeedAt(100, 6);
  assert.ok(Math.abs(r2 - 2) < 0.1, `ratio ${r2}`);
});
test("changing T rescales smoothly (no single-step jump) and converges", () => {
  const sim = M.createSimulation({ seed: 9 });
  sim.settle(2);
  sim.setControls({ T: 800 });
  const v0 = sim.getStats().meanSpeed;
  sim.settle(1 / 240 * 2);
  const v1 = sim.getStats().meanSpeed;
  assert.ok(v1 / v0 < 1.02, "should not jump instantly");
  sim.settle(5);
  assert.ok(Math.abs(sim.getStats().kineticTemperature - 800) / 800 < 0.15);
});

console.log("== Real gas (checks 6-7) ==");
test("6. deviation small at high T / low density, larger at low T / high density", () => {
  const easy = M.computeReadings({ mode: "real", N: 5, T: 800, V: 50 });
  const hard = M.computeReadings({ mode: "real", N: 100, T: 100, V: 5 });
  assert.ok(easy.deviationPct < 1, `${easy.deviationPct}`);
  assert.equal(easy.deviationLevel, "Low");
  assert.ok(hard.deviationPct > 15);
  assert.equal(hard.deviationLevel, "High");
  assert.ok(hard.deviationPct > 20 * easy.deviationPct);
  assert.ok(M.computeReadings({ mode: "real", N: 50, T: 300, V: 25 }).deviationPct < 2);
});
test("7a. attraction lowers P (low T); excluded volume raises P (high T, compressed)", () => {
  const lowT = M.computeReadings({ mode: "real", N: 100, T: 100, V: 5 });
  assert.ok(lowT.pReal < lowT.pIdeal);
  const hotCompressed = M.computeReadings({ mode: "real", N: 100, T: 800, V: 5 });
  assert.ok(hotCompressed.pReal > hotCompressed.pIdeal);
  // each term alone, directionally
  const n = nOf(100);
  assert.ok(n * M.R_GAS * 300 / (5 - n * M.VDW_B) > M.idealPressure(n, 300, 5));
});
test("7b. at moderate density, relative deviation grows as T falls (attraction-dominated regime)", () => {
  let prev = -1;
  for (const T of [300, 250, 200, 150, 100]) {
    const d = M.computeReadings({ mode: "real", N: 80, T, V: 15 }).deviationPct;
    assert.ok(d > prev, `T=${T}`);
    prev = d;
  }
});
test("7b'. at fixed T, deviation grows as V falls from 50 L (more compressed)", () => {
  let prev = -1;
  for (const V of [50, 35, 25, 15, 10]) {
    const d = M.computeReadings({ mode: "real", N: 100, T: 150, V }).deviationPct;
    assert.ok(d > prev, `V=${V}`);
    prev = d;
  }
});
test("7c. real-gas particles cohere more at 100 K than at 300 K and 800 K (animation model)", () => {
  function neighbours(T) {
    let acc = 0;
    for (const seed of [1, 2, 3]) {
      const s = M.createSimulation({ seed });
      s.setControls({ mode: "real", T, V: 25, N: 50 });
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
  const n100 = neighbours(100), n300 = neighbours(300), n800 = neighbours(800);
  assert.ok(n100 > 1.5 * n300, `100K ${n100} vs 300K ${n300}`);
  assert.ok(n300 < 0.8, `300K should not clump: ${n300}`);
  assert.ok(n800 < 0.8);
});
test("7d. real mode uses a larger collision radius than ideal (excluded volume cue)", () => {
  const s = M.createSimulation({ seed: 2 });
  s.setControls({ mode: "real" });
  s.settle(3);
  assert.ok(Math.abs(s.radius - M.R_REAL) < 1e-3 && M.R_REAL > M.R_IDEAL);
  s.setControls({ mode: "ideal" });
  s.settle(3);
  assert.ok(Math.abs(s.radius - M.R_IDEAL) < 1e-3);
});
test("force pairs only exist in real mode", () => {
  const s = M.createSimulation({ seed: 2 });
  s.setControls({ N: 100, V: 5, T: 100 });
  s.settle(1);
  assert.equal(s.getForcePairs().length, 0);
  s.setControls({ mode: "real" });
  s.settle(1);
  assert.ok(s.getForcePairs().length > 0);
});
test("vdW finite, positive and V - nb comfortably positive over the full slider grid (incl. extremes)", () => {
  let minFree = Infinity;
  for (let N = 5; N <= 100; N += 1) for (let T = 100; T <= 800; T += 25) for (let V = 5; V <= 50; V += 1) {
    const r = M.computeReadings({ mode: "real", N, T, V });
    assert.ok(Number.isFinite(r.pReal) && r.pReal > 0, `${N},${T},${V}`);
    assert.ok(Number.isFinite(r.deviationPct));
    minFree = Math.min(minFree, (V - r.n * M.VDW_B) / V);
  }
  assert.ok(minFree > 0.8, `free fraction ${minFree}`);
  // out-of-range inputs are clamped, never NaN
  for (const bad of [{ N: 1e9, T: 1e9, V: 0 }, { N: -5, T: -1, V: -1 }, { N: NaN, T: 300, V: 25 }]) {
    const r = M.computeReadings({ mode: "real", ...bad });
    assert.ok(Number.isFinite(r.pressure) || bad.N !== bad.N);
  }
  // direct defensive clamp: V barely above nb
  assert.ok(Number.isFinite(M.vdwPressure(2, 300, 0.5)));
});
test("deviation indicator thresholds: <5 Low, 5-15 Moderate, >15 High", () => {
  assert.equal(M.deviationLevel(0), "Low");
  assert.equal(M.deviationLevel(4.999), "Low");
  assert.equal(M.deviationLevel(5), "Moderate");
  assert.equal(M.deviationLevel(15), "Moderate");
  assert.equal(M.deviationLevel(15.001), "High");
  assert.ok(Math.abs(M.deviationPercent(2, 1.5) - 25) < 1e-12);
  assert.equal(M.deviationPercent(0, 1), 0);
});

console.log("== Chamber integrity (checks 9-10), count, pause, reset (check 8) ==");
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
        N: 5 + Math.floor(rng() * 96), T: 100 + Math.floor(rng() * 701), V: 5 + Math.floor(rng() * 46),
        mode: rng() < 0.5 ? "ideal" : "real",
      });
    }
    sim.advance(dt);
    assertInside(sim, `frame ${frame}`);
  }
});
test("9. piston squeezes quickly from 50 L to 5 L with 100 particles: nobody passes the piston", () => {
  for (const mode of ["ideal", "real"]) {
    const sim = M.createSimulation({ seed: 21 });
    sim.setControls({ mode, N: 100, V: 50 });
    sim.settle(4);
    sim.setControls({ V: 5 });
    for (let i = 0; i < 60 * 8; i++) { sim.advance(1 / 60); assertInside(sim, `${mode} ${i}`); }
    assert.ok(Math.abs(sim.pistonH - M.pistonHeight(5)) < 0.5);
  }
});
test("piston height tracks V (height fraction = V / V_max) and moves smoothly, not teleporting", () => {
  const sim = M.createSimulation({ seed: 4 });
  assert.ok(Math.abs(sim.pistonH - M.CHAMBER.maxHeight * 25 / 50) < 1e-9);
  sim.setControls({ V: 10 });
  sim.advance(1 / 60);
  assert.ok(sim.pistonH < M.pistonHeight(25) && sim.pistonH > M.pistonHeight(25) - 3);
  sim.settle(6);
  assert.ok(Math.abs(sim.pistonH - M.pistonHeight(10)) < 0.01);
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
  sim.setControls({ V: 5, N: 20, T: 800, mode: "real" });
  assert.equal(sim.particles.length, 20);
  assert.ok(Math.abs(sim.pistonH - M.pistonHeight(5)) < 1e-9);
  assertInside(sim, "paused");
  assert.ok(Math.abs(sim.getStats().kineticTemperature - 800) < 1e-6);
});
test("8. reset restores N=50, T=300, V=25, ideal, default display, playing", () => {
  const sim = M.createSimulation({ seed: 6 });
  sim.setControls({ N: 90, T: 700, V: 8, mode: "real" });
  sim.setDisplay({ trails: false, collisions: true, forces: true });
  sim.setPaused(true);
  sim.reset();
  assert.deepEqual(sim.controls, M.DEFAULT_CONTROLS);
  assert.deepEqual(sim.display, M.DEFAULT_DISPLAY);
  assert.equal(sim.paused, false);
  assert.equal(sim.particles.length, 50);
  assert.ok(Math.abs(sim.getReadings().pressure - 1) < 1e-9);
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


// ===========================================================================
// Update: pressure control, comparison classes, explanations, graph explorer
// ===========================================================================
const st = (o) => M.resolveState({ ...M.DEFAULT_CONTROLS, ...o });
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const vdwIndep = (n, T, V) => (n * 0.082057 * T) / (V - n * 0.4) - 15 * (n / V) ** 2; // independent re-implementation

console.log("== Pressure control (Mode B) ==");
test("scenario: V down at fixed T,n => ideal P up; T up at fixed V,n => P up (resolveState)", () => {
  let prev = 0;
  for (const V of [50, 40, 30, 20, 10, 5]) { const p = st({ V }).pressure; assert.ok(p > prev); prev = p; }
  prev = 0;
  for (const T of [100, 200, 400, 800]) { const p = st({ T }).pressure; assert.ok(p > prev); prev = p; }
});
test("scenario: at fixed T and P, n up => V up (ideal and real, solver)", () => {
  for (const gas of ["ideal", "real"]) {
    let prev = 0;
    for (const N of [5, 20, 40, 60, 80, 100]) {
      const sol = M.solveVolumeForPressure(nOf(N), 400, 1.0, gas);
      assert.ok(sol.vRequired > prev, `${gas} N=${N}`);
      prev = sol.vRequired;
    }
  }
});
test("ideal solver: PV = nRT within 1e-9 and V = nRT/P", () => {
  for (const N of [5, 50, 100]) for (const T of [100, 300, 800]) for (const P of [0.2, 1, 5]) {
    const n = nOf(N), sol = M.solveVolumeForPressure(n, T, P, "ideal");
    assert.ok(rel(sol.vRequired * P, n * M.R_GAS * T) < 1e-9);
    if (sol.status === "ok") assert.ok(rel(M.idealPressure(n, T, sol.V), P) < 1e-9);
  }
});
test("real solver: residual |P_vdW(V*) - P| tiny and branch is stable (dP/dV < 0), V* > n b", () => {
  let solved = 0;
  for (let N = 5; N <= 100; N += 19) for (let T = 100; T <= 800; T += 100) for (const P of [0.2, 0.5, 1, 2, 3.5, 5]) {
    const n = nOf(N), sol = M.solveVolumeForPressure(n, T, P, "real");
    if (sol.vRequired == null) { assert.equal(sol.status, "no-gas-solution"); continue; }
    solved++;
    const Vs = sol.vRequired;
    assert.ok(Vs > n * M.VDW_B * 1.2);
    assert.ok(Math.abs(vdwIndep(n, T, Vs) - P) < 1e-9, `${N},${T},${P}: ${vdwIndep(n, T, Vs) - P}`);
    assert.ok(M.vdwDPdV(n, T, Vs) < 0);
  }
  assert.ok(solved > 100);
});
test("real solver picks the gas branch below Tc (largest-V root), not the unstable/liquid-like roots", () => {
  const n = nOf(100), T = 100;
  const vs = M.vdwSpinodalVolume(n, T);
  assert.ok(vs > n * M.VDW_B && Math.abs(M.vdwDPdV(n, T, vs)) < 1e-6);
  const pMax = vdwIndep(n, T, vs);
  const sol = M.solveVolumeForPressure(n, T, pMax * 0.5, "real");
  assert.ok(sol.vRequired > vs);
  const none = M.solveVolumeForPressure(n, T, pMax * 1.2, "real");
  assert.equal(none.status, "no-gas-solution");
  assert.equal(none.reachable, false);
  assert.equal(M.vdwSpinodalVolume(n, 200), null); // above Tc ~135 K: monotone isotherm
});
test("solver grid (N,T,P incl. extremes): converges or reports, never NaN / non-positive free volume", () => {
  const statuses = new Set();
  for (let N = 5; N <= 100; N += 5) for (let T = 100; T <= 800; T += 50) for (const P of [0.01, 0.2, 0.7, 1, 2.5, 5, 50]) for (const gas of ["ideal", "real"]) {
    const n = nOf(N), sol = M.solveVolumeForPressure(n, T, P, gas);
    statuses.add(sol.status);
    assert.ok(Number.isFinite(sol.V) && sol.V >= 5 && sol.V <= 50, `${gas} ${N},${T},${P} V=${sol.V}`);
    assert.ok(sol.V - n * M.VDW_B > 0);
    assert.ok(["ok", "below-range", "above-range", "no-gas-solution"].includes(sol.status));
    assert.equal(sol.reachable, sol.status === "ok");
    if (sol.status === "ok") assert.ok(Math.abs((gas === "ideal" ? M.idealPressure(n, T, sol.V) : vdwIndep(n, T, sol.V)) - P) < 1e-7 * Math.max(1, P));
  }
  assert.ok(statuses.has("ok") && statuses.has("below-range") && statuses.has("above-range"));
  assert.equal(M.solveVolumeForPressure(1, 300, -1).status, "invalid");
  assert.equal(M.solveVolumeForPressure(1, 300, NaN).status, "invalid");
});
test("0.2-5.0 atm reachability (ideal): window is [nRT/50, nRT/5]; both ends reachable at suitable N,T", () => {
  const n = nOf(50), T = 300, nRT = n * M.R_GAS * T; // = 25 L atm at the default state
  assert.ok(near(nRT, 25, 1e-9));
  assert.equal(M.solveVolumeForPressure(n, T, 0.5, "ideal").status, "ok");
  assert.equal(M.solveVolumeForPressure(n, T, 5, "ideal").status, "ok");
  assert.equal(M.solveVolumeForPressure(n, T, 0.45, "ideal").status, "above-range");
  assert.equal(M.solveVolumeForPressure(nOf(20), 200, 0.2, "ideal").status, "ok"); // 33 L
  assert.equal(M.solveVolumeForPressure(nOf(100), 800, 5, "ideal").status, "ok"); // 10.7 L
  assert.equal(M.solveVolumeForPressure(nOf(10), 100, 5, "ideal").status, "below-range");
});
test("Volume->Pressure switch: no jump (V unchanged, target P = current P), ideal and real; back keeps V", () => {
  for (const mode of ["ideal", "real"]) for (const V of [8, 17, 25, 41]) {
    const c0 = { ...M.DEFAULT_CONTROLS, mode, V, T: 350, N: 63 };
    const s0 = M.resolveState(c0);
    const c1 = M.applyControlChange(c0, { control: "pressure" });
    const s1 = M.resolveState(c1);
    assert.equal(c1.control, "pressure");
    assert.ok(Math.abs(s1.V - s0.V) < 1e-6 * s0.V, `${mode} V ${s1.V} vs ${s0.V}`);
    assert.ok(Math.abs(s1.pressure - s0.pressure) < 1e-6);
    const c2 = M.applyControlChange(c1, { control: "volume" });
    assert.equal(c2.control, "volume");
    assert.ok(Math.abs(c2.V - s0.V) < 1e-6 * s0.V);
  }
});
test("switch with current P outside 0.2-5 atm: slider clamped, exact pressure held, piston does not move", () => {
  const c0 = { ...M.DEFAULT_CONTROLS, V: 5, T: 800, N: 100 }; // ~26.7 atm
  const s0 = M.resolveState(c0);
  assert.ok(s0.pressure > 5);
  const c1 = M.applyControlChange(c0, { control: "pressure" });
  assert.equal(c1.P, M.LIMITS.P.max);
  assert.ok(near(c1.Phold, s0.pressure));
  const s1 = M.resolveState(c1);
  assert.ok(Math.abs(s1.V - 5) < 1e-6);
  assert.ok(/outside the slider range/.test(s1.note));
  const c2 = M.applyControlChange(c1, { P: 4 }); // user moves slider: hold released
  assert.equal(c2.Phold, null);
  assert.ok(M.resolveState(c2).V > 5);
});
test("switch from an unstable real state (T<Tc) holds the volume instead of jumping", () => {
  const c0 = { ...M.DEFAULT_CONTROLS, mode: "real", N: 100, T: 100, V: 5 };
  const c1 = M.applyControlChange(c0, { control: "pressure" });
  assert.ok(c1.Vpin != null);
  assert.ok(Math.abs(M.resolveState(c1).V - 5) < 1e-12);
  const c2 = M.applyControlChange(c1, { P: 1 });
  assert.equal(c2.Vpin, null);
});
test("Pressure mode: T or N change re-solves V at the held P; P slider moves the piston target", () => {
  let c = M.applyControlChange({ ...M.DEFAULT_CONTROLS }, { control: "pressure" });
  const P0 = M.resolveState(c).pressure;
  const V0 = M.resolveState(c).V;
  c = M.applyControlChange(c, { T: 450 });
  let s = M.resolveState(c);
  assert.ok(near(s.pressure, P0, 1e-9) && near(s.V, V0 * 450 / 300, 1e-9)); // V ~ T at constant P
  c = M.applyControlChange(c, { N: 60 });
  s = M.resolveState(c);
  assert.equal(s.status, "ok");
  assert.ok(near(s.pressure, P0, 1e-9));
  const sFewer = M.resolveState(M.applyControlChange(c, { N: 25 }));
  assert.ok(sFewer.V < s.V);
  const hi = M.resolveState(M.applyControlChange(c, { P: 4 })), lo = M.resolveState(M.applyControlChange(c, { P: 1 }));
  assert.ok(hi.V < lo.V);
  // Volume mode: P recalculates instead
  const v = M.applyControlChange({ ...M.DEFAULT_CONTROLS }, { T: 450 });
  assert.ok(near(M.resolveState(v).pressure, 1.5, 1e-9) && M.resolveState(v).V === 25);
});
test("V patch is ignored in Pressure mode (read-only); Ideal<->Real in Pressure mode changes solved V, keeps P,T,N", () => {
  let c = M.applyControlChange({ ...M.DEFAULT_CONTROLS, N: 100, T: 150 }, { control: "pressure" });
  const sId = M.resolveState(c);
  assert.equal(M.applyControlChange(c, { V: 7 }).V, c.V);
  const cr = M.applyControlChange(c, { mode: "real" });
  const sRe = M.resolveState(cr);
  assert.equal(cr.T, 150); assert.equal(cr.N, 100); assert.equal(cr.control, "pressure");
  assert.ok(near(sRe.pressure, sId.pressure, 1e-8));
  assert.notEqual(sRe.V.toFixed(3), sId.V.toFixed(3));
});
test("simulation piston follows the SOLVED volume in Pressure mode (and reset restores Control: Volume)", () => {
  const sim = M.createSimulation({ seed: 3 });
  let c = M.applyControlChange(sim.controls, { control: "pressure" });
  c = M.applyControlChange(c, { P: 2 });
  sim.setControls(c);
  const want = M.resolveState(c).V;
  assert.ok(near(want, 12.5, 1e-9));
  sim.settle(6);
  assert.ok(Math.abs(sim.pistonH - M.pistonHeight(want)) < 0.01);
  assert.ok(near(sim.getReadings().pressure, 2, 1e-9));
  sim.reset();
  assert.equal(sim.controls.control, "volume");
  assert.deepEqual(sim.controls, M.DEFAULT_CONTROLS);
  assert.ok(Math.abs(sim.pistonH - M.pistonHeight(25)) < 1e-9);
});

console.log("== Comparison with ideal gas ==");
test("deviation classes: <2 very close, <5 small, <=15 moderate, >15 large; single source of truth", () => {
  const cases = [[0, 0], [1.999, 0], [2, 1], [4.999, 1], [5, 2], [15, 2], [15.001, 3], [80, 3]];
  for (const [d, idx] of cases) assert.equal(M.classifyDeviation(d).index, idx, `d=${d}`);
  assert.deepEqual(M.DEVIATION_CLASSES.map((c) => c.label), ["Very close to ideal", "Small deviation", "Moderate deviation", "Large deviation"]);
  assert.equal(M.DEVIATION_LOW_MAX, M.DEVIATION_BOUNDS.small);
  assert.equal(M.DEVIATION_MODERATE_MAX, M.DEVIATION_BOUNDS.moderate);
});
test("marker position: continuous, monotone, 0..1, class quarters", () => {
  let prev = -1;
  for (let d = 0; d <= 60; d += 0.05) {
    const p = M.deviationMarkerPosition(d);
    assert.ok(p >= prev - 1e-12 && p >= 0 && p <= 1); prev = p;
  }
  assert.equal(M.deviationMarkerPosition(0), 0);
  assert.ok(near(M.deviationMarkerPosition(2), 0.25) && near(M.deviationMarkerPosition(5), 0.5) && near(M.deviationMarkerPosition(15), 0.75));
  assert.equal(M.deviationMarkerPosition(M.DEVIATION_SCALE_MAX), 1);
  assert.equal(M.deviationMarkerPosition(1e6), 1);
  assert.ok(Math.abs(M.deviationMarkerPosition(5 + 1e-9) - M.deviationMarkerPosition(5)) < 1e-6); // continuity
});
test("comparison is computed from the model at the SAME T, V, n (independent recomputation)", () => {
  for (const [N, T, V] of [[50, 300, 25], [100, 150, 12], [80, 700, 6], [10, 500, 40]]) {
    const n = nOf(N), s = st({ mode: "real", N, T, V }), c = s.comparison;
    assert.equal(c.status, "ok");
    const pi = n * 0.082057 * T / V, pr = vdwIndep(n, T, V);
    assert.ok(near(c.pIdeal, pi) && near(c.pReal, pr));
    assert.ok(near(c.deviationPct, Math.abs(pr - pi) / pi * 100, 1e-9));
    assert.ok(near(c.signedPct, (pr - pi) / pi * 100, 1e-9));
    assert.equal(c.cls.index, M.classifyDeviation(c.deviationPct).index);
    assert.ok(near(c.marker, M.deviationMarkerPosition(c.deviationPct)));
  }
});
test("Pressure mode: real comparison uses the solved V and P_ideal at that same V", () => {
  const c = M.applyControlChange({ ...M.DEFAULT_CONTROLS, mode: "real", N: 100, T: 200 }, { control: "pressure" });
  const s = M.resolveState(M.applyControlChange(c, { P: 3 }));
  const n = s.n;
  assert.ok(near(s.comparison.pIdeal, n * M.R_GAS * s.T / s.V));
  assert.ok(near(s.comparison.pReal, 3, 1e-8));
});
test("near-ideal at high T / low density, larger at low T / high density; deviation is signed and non-monotonic in T", () => {
  const easy = st({ mode: "real", N: 5, T: 800, V: 50 }).comparison.deviationPct;
  const mid = st({ mode: "real", N: 50, T: 300, V: 25 }).comparison.deviationPct;
  const hard = st({ mode: "real", N: 100, T: 120, V: 8 }).comparison.deviationPct;
  assert.ok(easy < 0.5 && easy < mid && mid < hard && hard > 15);
  // sign: attraction (low T) => P_real < P_ideal ; compressed hot gas => P_real > P_ideal
  assert.ok(st({ mode: "real", N: 100, T: 150, V: 10 }).comparison.signedPct < 0);
  assert.ok(st({ mode: "real", N: 100, T: 800, V: 5 }).comparison.signedPct > 0);
  // crossing: along T the signed deviation changes sign and |d| is non-monotonic
  const ds = []; for (let T = 100; T <= 800; T += 10) ds.push(st({ mode: "real", N: 100, T, V: 10 }).comparison);
  assert.ok(ds.some((c) => c.signedPct < 0) && ds.some((c) => c.signedPct > 0));
  let dec = false, inc = false;
  for (let i = 1; i < ds.length; i++) { const dd = ds[i].deviationPct - ds[i - 1].deviationPct; if (dd < -1e-9) dec = true; if (dd > 1e-9) inc = true; }
  assert.ok(dec && inc, "|deviation| must not be monotone along T");
  // very close to ideal near the Boyle-like crossover
  assert.ok(ds.some((c) => c.cls.index === 0));
});
test("unreliable region: reported instead of a number (unstable branch, free volume, P_ideal ~ 0, invalid)", () => {
  const unstable = st({ mode: "real", N: 100, T: 100, V: 5 }).comparison;
  assert.equal(unstable.status, "unreliable"); assert.equal(unstable.reason, "unstable-region"); assert.equal(unstable.deviationPct, null);
  assert.equal(M.compareWithIdeal(1, 300, 0.45).reason, "excluded-volume");
  assert.equal(M.compareWithIdeal(1, 300, 0.2).reason, "excluded-volume"); // V < n b
  assert.equal(M.compareWithIdeal(1e-12, 300, 25).reason, "ideal-pressure-near-zero");
  assert.equal(M.compareWithIdeal(NaN, 300, 25).status, "unreliable");
  assert.equal(M.compareWithIdeal(1, -5, 25).status, "unreliable");
  assert.ok(M.UNRELIABLE_TEXT["unstable-region"].length > 10);
  // over the whole slider grid the comparison is ok everywhere except the unstable corner
  let bad = 0;
  for (let N = 5; N <= 100; N += 5) for (let T = 100; T <= 800; T += 25) for (let V = 5; V <= 50; V += 5) if (st({ mode: "real", N, T, V }).comparison.status !== "ok") bad++;
  assert.ok(bad <= 3, `bad ${bad}`);
});

console.log("== What Is Happening explanations ==");
const E = (a, b) => M.selectExplanation({ ...M.DEFAULT_CONTROLS, ...a }, { ...M.DEFAULT_CONTROLS, ...b });
test("explanations correspond to the change (ideal, Volume control)", () => {
  assert.equal(E({}, { T: 400 }).id, "tempUpV");
  assert.ok(/kinetic energy/.test(E({}, { T: 400 }).text) && /constant volume/.test(E({}, { T: 400 }).text) && /increases the pressure/.test(E({}, { T: 400 }).text));
  assert.equal(E({}, { T: 200 }).id, "tempDownV");
  assert.equal(E({}, { V: 10 }).id, "volDown");
  assert.ok(/less space/.test(E({}, { V: 10 }).text));
  assert.equal(E({}, { V: 40 }).id, "volUp");
  assert.equal(E({}, { N: 80 }).id, "nUpV");
  assert.ok(/More particles/.test(E({}, { N: 80 }).text));
  assert.equal(E({}, { N: 20 }).id, "nDownV");
  assert.equal(E({}, { mode: "real" }).id, "realSelected");
  assert.ok(/finite volume and experience intermolecular forces/.test(E({}, { mode: "real" }).text));
  assert.equal(E({ mode: "real" }, { mode: "ideal" }).id, "idealSelected");
  assert.equal(E({}, { control: "pressure" }).id, "controlPressure");
  assert.equal(E({ control: "pressure" }, { control: "volume" }).id, "controlVolume");
  assert.equal(E({}, {}), null); // nothing changed => keep the message
  assert.equal(M.selectExplanation(null, M.DEFAULT_CONTROLS).id, "initial");
  const ids = new Set([E({}, { T: 400 }).id, E({}, { V: 10 }).id, E({}, { N: 80 }).id, E({}, { mode: "real" }).id]);
  assert.equal(ids.size, 4);
});
test("explanations in Pressure control state the held-constant relationship and the pressure cases", () => {
  const p = { control: "pressure", V: 25, P: 1 };
  assert.equal(E(p, { ...p, T: 500 }).id, "tempUpP");
  assert.ok(/constant/.test(E(p, { ...p, T: 500 }).text) && /volume increases/.test(E(p, { ...p, T: 500 }).text));
  assert.equal(E(p, { ...p, T: 200 }).id, "tempDownP");
  assert.equal(E(p, { ...p, N: 80 }).id, "nUpP");
  assert.equal(E(p, { ...p, N: 30 }).id, "nDownP");
  assert.equal(E(p, { ...p, P: 3 }).id, "pressureUp");
  assert.ok(/piston moves down/.test(E(p, { ...p, P: 3 }).text));
  assert.equal(E(p, { ...p, P: 0.6 }).id, "pressureDown");
  assert.ok(/piston moves up/.test(E(p, { ...p, P: 0.6 }).text));
  assert.equal(E({ ...p, N: 10, T: 100, P: 4 }, { ...p, N: 10, T: 100, P: 5 }).id, "unreachableLow");
  assert.equal(E({ ...p, N: 100, T: 800, P: 0.4 }, { ...p, N: 100, T: 800, P: 0.3 }).id, "unreachableHigh");
});
test("'approaches ideal' and 'deviation increasing' only when the computed state warrants them", () => {
  const r = { mode: "real", N: 100, T: 150, V: 12 };
  const far = M.resolveState({ ...M.DEFAULT_CONTROLS, ...r }).comparison.deviationPct;
  assert.ok(far > 5);
  // low T -> much hotter at the same V: deviation shrinks to <5% => approaches ideal
  const near1 = M.resolveState({ ...M.DEFAULT_CONTROLS, ...r, T: 400 }).comparison;
  assert.ok(near1.deviationPct < 5 && near1.deviationPct < far);
  assert.equal(E(r, { ...r, T: 400 }).id, "approachIdeal");
  assert.ok(/approximately like an ideal gas/.test(E(r, { ...r, T: 400 }).text));
  // compress a hot, dilute real gas: deviation grows => deviation increasing
  const a = { mode: "real", N: 50, T: 300, V: 40 }, b = { ...a, V: 8 };
  const da = M.resolveState({ ...M.DEFAULT_CONTROLS, ...a }).comparison.deviationPct, db = M.resolveState({ ...M.DEFAULT_CONTROLS, ...b }).comparison.deviationPct;
  assert.ok(db > da + 0.2);
  assert.equal(E(a, b).id, "deviationUp");
  // never in ideal mode, never when deviation is not changing materially
  assert.ok(!["approachIdeal", "deviationUp"].includes(E({ ...a, mode: "ideal" }, { ...b, mode: "ideal" }).id));
  const tiny = E({ mode: "real", N: 5, T: 800, V: 50 }, { mode: "real", N: 5, T: 800, V: 49 });
  assert.ok(!["approachIdeal", "deviationUp"].includes(tiny.id));
  // unreliable state => honest message
  assert.equal(E({ mode: "real", N: 100, T: 100, V: 8 }, { mode: "real", N: 100, T: 100, V: 5 }).id, "unreliable");
});

console.log("== Real vs Ideal Gas Behaviour: Z(P) graph ==");
const dPdVIndep = (n, T, V) => (-n * 0.082057 * T) / (V - n * 0.4) ** 2 + (2 * 15 * n * n) / V ** 3;
const Z_TEMPS = [100, 120, 135, 140, 150, 200, 250, 300, 400, 460, 600, 800];
test("removed: the four-graph Graph Explorer API no longer exists", () => {
  for (const k of ["generateGraphSeries", "graphSentence", "GRAPHS", "GRAPH_ORDER", "resetGraphView", "DEFAULT_GRAPH_VIEW", "interpolateSeries"]) assert.equal(M[k], undefined, k);
});
test("critical constants: Tc = 8a/(27Rb), Pc = a/(27b^2), T_Boyle = a/(Rb), Vc = 3b (a = 15, b = 0.40 unchanged)", () => {
  const c = M.vdwCriticalConstants();
  assert.equal(M.VDW_A, 15); assert.equal(M.VDW_B, 0.4);
  assert.ok(near(c.Tc, (8 * 15) / (27 * 0.082057 * 0.4)) && Math.abs(c.Tc - 135.41) < 0.01);
  assert.ok(near(c.Pc, 15 / (27 * 0.16)) && Math.abs(c.Pc - 3.4722) < 1e-3);
  assert.ok(near(c.TBoyle, 15 / (0.082057 * 0.4)) && Math.abs(c.TBoyle - 457.0) < 0.01);
  assert.ok(near(c.Vc, 1.2));
  // at Tc the isotherm has an inflection: dP/dV = 0 and d2P/dV2 = 0 at Vc (per mole)
  const h = 1e-4, p = (V) => vdwIndep(1, c.Tc, V);
  assert.ok(Math.abs(dPdVIndep(1, c.Tc, c.Vc)) < 1e-9);
  assert.ok(Math.abs((p(c.Vc + h) - 2 * p(c.Vc) + p(c.Vc - h)) / (h * h)) < 1e-3);
  assert.ok(near(p(c.Vc), c.Pc, 1e-9));
});
test("saturation pressure: Maxwell equal-area (independent numeric integral), reduced Psat(0.9 Tc) = 0.647 Pc, monotone in T, null at/above Tc", () => {
  const c = M.vdwCriticalConstants();
  assert.equal(M.vdwSaturationPressure(c.Tc), null);
  assert.equal(M.vdwSaturationPressure(300), null);
  assert.ok(Math.abs(M.vdwSaturationPressure(0.9 * c.Tc) / c.Pc - 0.647) < 1e-3);
  let prev = 0;
  for (let T = 100; T < c.Tc; T += 5) {
    const ps = M.vdwSaturationPressure(T);
    assert.ok(ps > prev, `T=${T}`); prev = ps;
    // independent: find outer roots by scanning and integrate (P_vdW - Psat) dV by trapezoid
    const P1 = (V) => vdwIndep(1, T, V);
    let vl = null, vg = null;
    for (let V = 0.4001; V < 400; V *= 1.0005) {
      if (P1(V) > ps && P1(V * 1.0005) <= ps && vl == null) vl = V;
      if (P1(V) < ps && P1(V * 1.0005) >= ps) { /* middle root */ }
      if (P1(V) >= ps && P1(V * 1.0005) < ps) vg = V; // last downward crossing = gas root
    }
    let area = 0; const steps = 20000;
    for (let i = 0; i < steps; i++) { const V0 = vl + ((vg - vl) * i) / steps, V1 = vl + ((vg - vl) * (i + 1)) / steps; area += ((P1(V0) - ps + P1(V1) - ps) / 2) * (V1 - V0); }
    assert.ok(Math.abs(area) < 2e-2, `equal-area T=${T}: ${area}`);
  }
});
test("ideal gas: Z = 1 exactly (function, curve reference line, marker in Volume and Pressure control)", () => {
  assert.equal(M.compressibilityFactor(1.2, 300, 20, "ideal"), 1);
  assert.deepEqual(M.compressibilityAtPressure(1.2, 300, 3, "ideal").Z, 1);
  assert.ok(near(M.compressibilityAtPressure(1.2, 300, 3, "ideal").V, (1.2 * M.R_GAS * 300) / 3));
  const c = M.generateZCurve(1.2, 300, "ideal");
  assert.ok(c.ideal.length === 2 && c.ideal.every((p) => p.Z === 1) && c.ideal[0].P === M.Z_P_MIN && c.ideal[1].P === M.Z_P_MAX);
  for (const s of [st({}), st({ N: 90, T: 700, V: 6 }), M.resolveState(M.applyControlChange(st({ N: 30, T: 200 }), { control: "pressure" })),
    M.resolveState(M.applyControlChange(M.applyControlChange(st({ N: 30, T: 200 }), { control: "pressure" }), { P: 4.2 }))]) {
    const m = M.zMarker(s);
    assert.equal(m.Z, 1); assert.equal(m.status, "ok"); assert.equal(m.deviationPct, 0);
    assert.equal(m.P, s.pressure); // equals the Live value
    assert.ok(near(m.P * s.V, s.n * M.R_GAS * s.T));
  }
});
test("real Z from the solved gas-branch volume equals PV/(nRT); vdW residual tiny; every curve point is on the stable gas branch, finite", () => {
  for (const N of [5, 50, 100]) for (const T of Z_TEMPS) {
    const n = nOf(N), c = M.generateZCurve(n, T, "real");
    assert.ok(c.points.length > 2, `T=${T}`);
    const vLo = M.vdwGasBranchMinVolume(n, T);
    for (const p of c.points) {
      assert.ok(Number.isFinite(p.Z) && p.Z > 0 && Number.isFinite(p.V) && p.P >= M.Z_P_MIN * (1 - 1e-12));
      assert.ok(near(p.Z, (p.P * p.V) / (n * M.R_GAS * T), 1e-12));
      assert.ok(Math.abs(vdwIndep(n, T, p.V) - p.P) <= 1e-7 * p.P, `residual T=${T} P=${p.P}`);
      assert.ok(dPdVIndep(n, T, p.V) < 0, `stable (dP/dV<0) T=${T} P=${p.P}`);
      assert.ok(p.V >= vLo * (1 - 1e-9) && (p.V - n * 0.4) / p.V >= M.VDW_MIN_FREE_FRACTION - 1e-9); // same 20 % free-volume reliability bound as the comparison panel
      assert.ok(near(M.compressibilityFactor(n, T, p.V, "real"), p.Z, 1e-9));
    }
    for (let i = 1; i < c.points.length; i++) assert.ok(c.points[i].P > c.points[i - 1].P);
  }
});
test("no points from the loop / metastable region: below Tc the curve stops at P_sat; above it, at the excluded-volume limit; end reported", () => {
  const n = nOf(50), { Tc } = M.vdwCriticalConstants();
  for (const T of [100, 110, 120, 130, 135]) {
    const c = M.generateZCurve(n, T, "real"), ps = M.vdwSaturationPressure(T);
    assert.ok(c.points.every((p) => p.P <= ps * (1 + 1e-9)), `T=${T}`);
    assert.ok(near(c.points[c.points.length - 1].P, ps, 1e-9));
    assert.equal(c.end.reason, "condensation"); assert.match(c.end.text, /condensation/); assert.ok(near(c.end.P, ps));
    // all molar volumes are above the vapour spinodal (not in the loop)
    const xg = M.vdwSpinodalVolume(1, T);
    assert.ok(c.points.every((p) => p.V / n > xg - 1e-9), `T=${T} stays right of the spinodal`);
  }
  for (const T of [140, 150]) { const c = M.generateZCurve(n, T, "real"); assert.equal(c.end.reason, "excluded-volume"); assert.ok(c.end.P < M.Z_P_MAX); assert.ok(T > Tc); }
  for (const T of [200, 300, 800]) assert.equal(M.generateZCurve(n, T, "real").end, null);
});
test("Z -> 1 as P -> 0 and |Z-1| shrinks monotonically as P decreases (to the minimum of Z; over the whole range above T_Boyle)", () => {
  const n = nOf(50), TB = M.vdwCriticalConstants().TBoyle;
  for (const T of [150, 200, 250, 300, 400, 460, 600, 800]) {
    const c = M.generateZCurve(n, T, "real"), pts = c.points;
    assert.ok(Math.abs(pts[0].Z - 1) < 2e-3, `T=${T} Z(0.01 atm)=${pts[0].Z}`);
    const stop = T >= 460 ? pts.length - 1 : pts.indexOf(c.zMin);
    for (let i = 1; i <= stop; i++) assert.ok(Math.abs(pts[i].Z - 1) >= Math.abs(pts[i - 1].Z - 1) - 1e-12, `T=${T} i=${i}`);
  }
  assert.ok(460 > TB);
});
test("low T: attractions give Z < 1 (minimum found); at higher P the excluded volume lifts Z above 1; above T_Boyle Z > 1 everywhere", () => {
  const n = nOf(50), TB = M.vdwCriticalConstants().TBoyle;
  for (const T of [200, 250, 300, 400]) {
    const c = M.generateZCurve(n, T, "real");
    assert.ok(c.zMin.Z < (T === 400 ? 0.999 : 0.96), `T=${T} min ${c.zMin.Z}`);
    const iMin = c.points.indexOf(c.zMin);
    assert.ok(c.points.slice(0, iMin).every((p) => p.Z > c.zMin.Z - 1e-12) && c.points.slice(iMin).every((p) => p.Z >= c.zMin.Z - 1e-12));
    const last = c.points[c.points.length - 1];
    assert.ok(last.Z > 1.05, `T=${T} Z(${last.P}) = ${last.Z}`);
    assert.ok(c.points.some((p) => p.P > c.zMin.P && p.Z > 1), `T=${T} crosses 1 after the minimum`);
  }
  assert.ok(M.generateZCurve(n, 200, "real").zMin.Z < 0.8);
  for (const T of [460, 500, 600, 800]) assert.ok(M.generateZCurve(n, T, "real").points.every((p) => p.Z > 1), `T=${T} > T_Boyle=${TB.toFixed(0)}`);
  // the Boyle temperature separates the two behaviours at low P
  assert.ok(M.compressibilityAtPressure(n, 400, 0.5).Z < 1 && M.compressibilityAtPressure(n, 520, 0.5).Z > 1);
});
test("Z = P_real / P_ideal at the same T, V, n and |Z-1| x 100 equals the comparison panel's deviation (Volume and Pressure control)", () => {
  const states = [];
  for (const N of [10, 50, 100]) for (const T of [150, 300, 600, 800]) for (const V of [8, 25, 48]) states.push(st({ mode: "real", N, T, V }));
  for (const N of [20, 60]) for (const T of [250, 500]) for (const P of [0.5, 2, 4.5]) {
    states.push(M.resolveState(M.applyControlChange(M.applyControlChange(st({ mode: "real", N, T }), { control: "pressure" }), { P })));
  }
  let checked = 0;
  for (const s of states) {
    if (s.comparison.status !== "ok") continue;
    const m = M.zMarker(s);
    assert.ok(near(m.Z, s.comparison.pReal / s.comparison.pIdeal, 1e-12));
    assert.ok(Math.abs(m.deviationPct - s.comparison.deviationPct) < 1e-9, `${m.deviationPct} vs ${s.comparison.deviationPct}`);
    assert.ok(Math.abs(m.deviationPct - M.deviationPercent(s.pIdeal, s.pReal)) < 1e-9);
    assert.ok(near(m.Z, M.compressibilityFactor(s.n, s.T, s.V, "real"), 1e-12));
    checked++;
  }
  assert.ok(checked > 40);
});
test("marker = Live values (P and Z) in Volume and Pressure control, ideal and real; on the real curve when the state is stable", () => {
  const logInterp = (pts, P) => {
    if (P < pts[0].P || P > pts[pts.length - 1].P) return null;
    for (let i = 1; i < pts.length; i++) if (P <= pts[i].P) { const a = pts[i - 1], b = pts[i], t = Math.log(P / a.P) / Math.log(b.P / a.P); return a.Z + t * (b.Z - a.Z); }
    return null;
  };
  const volStates = [st({ mode: "real" }), st({ mode: "real", N: 80, T: 500, V: 7 }), st({ mode: "real", N: 30, T: 250, V: 40 }), st({ mode: "real", N: 100, T: 800, V: 5 })];
  const presStates = [
    M.resolveState(M.applyControlChange(st({ mode: "real", N: 70, T: 400 }), { control: "pressure" })),
    M.resolveState(M.applyControlChange(M.applyControlChange(st({ mode: "real", N: 40, T: 250 }), { control: "pressure" }), { P: 2.5 })),
    M.resolveState(M.applyControlChange(M.applyControlChange(st({ mode: "real", N: 60, T: 600 }), { control: "pressure" }), { P: 4.9 })),
  ];
  let onCurve = 0;
  for (const s of [...volStates, ...presStates]) {
    const m = M.zMarker(s);
    assert.equal(s.comparison.status, "ok");
    assert.ok(near(m.P, s.pressure, 1e-12), "marker P = Live pressure");
    assert.ok(near(m.Z, (s.pressure * s.V) / (s.n * M.R_GAS * s.T), 1e-12), "Z = PV/nRT of the Live values");
    if (s.control === "pressure" && s.status === "ok") assert.ok(near(m.P, s.pTarget, 1e-6), "Pressure mode: marker P = target");
    if (m.onCurve) {
      const yc = logInterp(M.generateZCurve(s.n, s.T, "real").points, m.P);
      assert.ok(yc != null && Math.abs(yc - m.Z) < 2e-3, `on the curve: ${yc} vs ${m.Z}`);
      onCurve++;
    }
  }
  assert.ok(onCurve >= 5);
  // exact: solve P -> V on the curve and compare with a Volume-control state of the same V
  const s0 = st({ mode: "real", N: 50, T: 300, V: 25 });
  const sol = M.compressibilityAtPressure(s0.n, 300, s0.pReal, "real");
  assert.ok(near(sol.V, 25, 1e-9) && near(sol.Z, M.zMarker(s0).Z, 1e-9));
});
test("curve depends on T (and the model) only: T changes it; V or P changes (either control mode) only move the marker; n is constant along each curve", () => {
  const base = st({ mode: "real", N: 50, T: 300, V: 25 });
  const curveOf = (s) => JSON.stringify(M.generateZCurve(s.n, s.T, s.mode).points);
  const c0 = curveOf(base);
  assert.notEqual(curveOf(st({ mode: "real", N: 50, T: 200, V: 25 })), c0);
  assert.notEqual(curveOf(st({ mode: "real", N: 50, T: 305, V: 25 })), c0);
  for (const V of [6, 12, 40]) assert.equal(curveOf(st({ mode: "real", N: 50, T: 300, V })), c0);
  const pm = M.applyControlChange(base, { control: "pressure" });
  for (const P of [0.3, 1.7, 4.4]) assert.equal(curveOf(M.resolveState(M.applyControlChange(pm, { P }))), c0);
  assert.notEqual(M.zMarker(base).P, M.zMarker(st({ mode: "real", N: 50, T: 300, V: 12 })).P); // marker moved
  // n is constant along a curve: recompute n = PV/(ZRT) at every point
  const n = nOf(73), c = M.generateZCurve(n, 250, "real");
  for (const p of c.points) assert.ok(near((p.P * p.V) / (p.Z * M.R_GAS * 250), n, 1e-12));
  // van der Waals with per-mole constants: Z(P, T) is intensive, so a different n gives the same curve (marker moves instead)
  const a = M.generateZCurve(nOf(10), 250, "real").points, b = M.generateZCurve(nOf(100), 250, "real").points;
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) assert.ok(near(a[i].Z, b[i].Z, 1e-9) && near(a[i].P, b[i].P));
  assert.notEqual(M.zMarker(st({ mode: "real", N: 10, T: 250, V: 25 })).P, M.zMarker(st({ mode: "real", N: 100, T: 250, V: 25 })).P);
});
test("ghost: in Ideal mode the real curve is flagged as a ghost and equals the real-mode curve; Real mode is not a ghost", () => {
  const g = M.generateZCurve(1, 300, "ideal"), r = M.generateZCurve(1, 300, "real");
  assert.equal(g.ghost, true); assert.equal(r.ghost, false);
  assert.deepEqual(g.points, r.points);
});
test("zExplanation: Z ~ 1 / below / above at the tolerance boundary (2 %, shared with 'very close to ideal'); no 'becomes ideal' wording", () => {
  assert.equal(M.Z_TOLERANCE_PCT, M.DEVIATION_BOUNDS.veryClose);
  const cases = [[1, "ideal"], [0.9801, "ideal"], [1.0199, "ideal"], [0.9799, "below"], [1.0201, "above"], [0.5, "below"], [2.3, "above"]];
  for (const [Z, id] of cases) { const e = M.zExplanation(Z); assert.equal(e.id, id, `Z=${Z}`); assert.ok(near(e.deviationPct, Math.abs(Z - 1) * 100, 1e-9)); }
  assert.equal(M.zExplanation(1).text, "The real gas behaves approximately like an ideal gas.");
  assert.equal(M.zExplanation(0.9).text, "Attractive interactions dominate the deviation.");
  assert.equal(M.zExplanation(1.1).text, "Repulsive or excluded-volume effects dominate the deviation.");
  assert.equal(M.zExplanation(NaN).id, "unreliable");
  for (const t of Object.values(M.Z_EXPLANATIONS)) assert.doesNotMatch(t, /becomes? (an )?ideal/i);
  // consistent with the comparison classification: 'very close' <=> Z explanation 'ideal'
  for (const s of [st({ mode: "real", N: 5, T: 800, V: 50 }), st({ mode: "real" }), st({ mode: "real", N: 100, T: 150, V: 12 }), st({ mode: "real", N: 100, T: 800, V: 5 })]) {
    if (s.comparison.status !== "ok") continue;
    assert.equal(M.zMarker(s).id === "ideal", s.comparison.cls.index === 0);
  }
});
test("unreliable / invalid handling: unreliable state gives no numbers and the same message; invalid inputs and pressures past the limit are rejected cleanly", () => {
  const bad = st({ mode: "real", N: 100, T: 100, V: 5 });
  assert.notEqual(bad.comparison.status, "ok");
  const m = M.zMarker(bad);
  assert.equal(m.status, "unreliable"); assert.equal(m.Z, null); assert.equal(m.deviationPct, null);
  assert.equal(m.text, M.UNRELIABLE_TEXT[bad.comparison.reason]);
  for (const args of [[0, 300, 1], [1, 0, 1], [1, 300, 0], [1, 300, -2], [1, 300, NaN]]) assert.equal(M.compressibilityAtPressure(...args).valid, false);
  const past = M.compressibilityAtPressure(1, 100, 50, "real");
  assert.equal(past.valid, false); assert.equal(past.reason, "condensation");
  assert.equal(M.compressibilityAtPressure(1, 150, 90, "real").valid, false);
  assert.ok(Number.isNaN(M.compressibilityFactor(1, 300, 0.3, "real"))); // V < n b
});
test("supersaturated states (T < Tc, P above P_sat) keep their numbers but are flagged: marker off the curve with a caution; stable states are not flagged", () => {
  let flagged = 0, stable = 0;
  for (let N = 20; N <= 100; N += 10) for (let T = 100; T <= 135; T += 5) for (let V = 5; V <= 50; V += 5) {
    const s = st({ mode: "real", N, T, V });
    if (s.comparison.status !== "ok") continue;
    const ps = M.vdwSaturationPressure(T), m = M.zMarker(s);
    if (s.comparison.pReal > ps * (1 + 1e-9)) { assert.equal(s.comparison.caution, "supersaturated"); assert.equal(m.onCurve, false); assert.ok(Number.isFinite(m.Z)); flagged++; }
    else { assert.equal(s.comparison.caution, null); assert.equal(m.onCurve, true); stable++; }
  }
  assert.ok(flagged > 0 && stable > 0, `${flagged}/${stable}`);
  assert.equal(st({ mode: "real" }).comparison.caution, null);
  assert.equal(st({ mode: "real", N: 50, T: 800, V: 5 }).comparison.caution, null);
});
test("curve over the whole slider grid is finite and never empty or NaN; marker always inside the plotted pressure range", () => {
  for (const N of [5, 50, 100]) for (let T = 100; T <= 800; T += 50) {
    const c = M.generateZCurve(nOf(N), T, "real");
    assert.ok(c.points.length > 0 && c.points.every((p) => Number.isFinite(p.Z) && Number.isFinite(p.P) && Number.isFinite(p.V)));
    const ax = M.zAxisRange(c, null);
    assert.ok(ax.yMin >= 0 && ax.yMax <= M.Z_Y_CAP && ax.yMin < 1 && ax.yMax > 1);
  }
  for (const N of [5, 100]) for (const T of [100, 800]) for (const V of [5, 50]) for (const mode of ["ideal", "real"]) {
    const m = M.zMarker(st({ mode, N, T, V }));
    if (m.status === "ok") assert.equal(m.outside, false, `${mode} ${N} ${T} ${V} P=${m.P}`);
  }
});
test("axis range contains the marker and the curve (up to the cap)", () => {
  const s = st({ mode: "real", N: 50, T: 200, V: 25 }), c = M.generateZCurve(s.n, s.T, "real"), m = M.zMarker(s);
  const ax = M.zAxisRange(c, m);
  assert.ok(ax.yMin <= c.zMin.Z && ax.yMin <= m.Z && ax.yMax >= m.Z);
  assert.equal(ax.clipped, c.zMax.Z > M.Z_Y_CAP);
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
      else if (k < 0.7) controls = M.applyControlChange(controls, { T: 100 + Math.floor(rng() * 701) });
      else if (k < 0.85) controls = M.applyControlChange(controls, { V: 5 + Math.floor(rng() * 46) });
      else controls = M.applyControlChange(controls, { P: 0.2 + rng() * 4.8 });
      sim.setControls(controls);
      const r = sim.getReadings();
      assert.ok(Number.isFinite(r.V) && Number.isFinite(r.pressure) && r.V >= 5 && r.V <= 50);
    }
    sim.advance(1 / 60);
    assertInside(sim, `frame ${frame}`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
