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

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
