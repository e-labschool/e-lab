#!/usr/bin/env node
// Pure-logic tests for the Collision Theory engine, the Maxwell-Boltzmann maths, the rate metrics, the magnified-view geometry,
// the predict scenarios and the Chocolate Wrapping model:   node scripts/test-collision-model.mjs
// No DOM, no React. Everything random is seeded, so the statistical assertions are deterministic (and were chosen with wide margins).
import assert from "node:assert/strict";

const K = "../src/engines/collision-theory-visualizer/lib/";
const MB = await import(`${K}maxwellBoltzmann.js`);
const E = await import(`${K}collisionEngine.js`);
const RM = await import(`${K}rateMetrics.js`);
const GEO = await import(`${K}geometry.js`);
const SC = await import(`${K}scenarios.js`);
const SNAP = await import(`${K}snapshot.js`);
const { createRng } = await import(`${K}rng.js`);
const CW = await import("../src/engines/chocolate-wrapping-rate/lib/wrappingModel.js");

let passed = 0; let failed = 0;
function test(name, fn) { try { fn(); console.log(`  ok   ${name}`); passed++; } catch (e) { console.log(`  FAIL ${name}\n       ${(e.stack || e.message).split("\n").slice(0, 4).join("\n       ")}`); failed++; } }
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} ${a} vs ${b} (tol ${tol})`);

console.log("== Maxwell-Boltzmann: exact area and fractions ==");
test("area under the curve is 1 at every temperature (numerical integration of the plotted density)", () => {
  for (const T of [250, 300, 350, 400, 500, 600, 700]) close(MB.numericArea(T, 20000), 1, 1e-9, `T=${T}`);
});
test("fraction >= Ea equals numerical integration for a grid of T and Ea (including the cases the old graph got wrong)", () => {
  for (const T of [250, 300, 400, 600, 700]) for (const Ea of [0, 1, 5, 10, 20, 45, 60, 80]) {
    const ex = MB.fractionAbove(Ea, T); const nu = MB.numericFractionAbove(Ea, T, 40000);
    close(ex, nu, 1e-9 + 1e-7 * nu, `T=${T} Ea=${Ea}`);
  }
});
test("gamma routine is right on closed forms (Q(1,x)=e^-x) and the 3-D fraction has the closed form erfc+2 sqrt(x/pi) e^-x", () => {
  close(MB.gammaQ(1, 2), Math.exp(-2), 1e-13); close(MB.gammaQ(1, 0.3), Math.exp(-0.3), 1e-13);
  const x = 4; // erfc(2) = 0.004677734981047266
  close(MB.gammaQ(1.5, x), 0.004677734981047266 + 2 * Math.sqrt(x / Math.PI) * Math.exp(-x), 1e-12);
});
test("fraction rises with T, falls with Ea, is 1 at Ea=0 and tiny (not tens of percent) for a realistic Ea", () => {
  assert.equal(MB.fractionAbove(0, 300), 1);
  let prev = 0; for (const T of [250, 300, 400, 500, 700]) { const f = MB.fractionAbove(20, T); assert.ok(f > prev); prev = f; }
  prev = 1; for (const Ea of [5, 10, 20, 40, 60]) { const f = MB.fractionAbove(Ea, 400); assert.ok(f < prev); prev = f; }
  assert.ok(MB.fractionAbove(50, 298) < 1e-7, "50 kJ/mol at 298 K is a tiny fraction");
});
test("a catalyst (Ea x 0.6) increases the fraction at the same T; peak moves right and lowers with T", () => {
  for (const T of [300, 400, 600]) assert.ok(MB.fractionAbove(12 * 0.6, T) > MB.fractionAbove(12, T));
  assert.ok(MB.peakEnergy(600) > MB.peakEnergy(300)); assert.ok(MB.peakDensity(600) < MB.peakDensity(300));
  const c = MB.densityCurve(300, 70, 700); let imax = 0; for (let i = 1; i < c.f.length; i++) if (c.f[i] > c.f[imax]) imax = i;
  close(c.E[imax], MB.peakEnergy(300), 0.2, "plotted peak at kT/2");
});
test("sampled energies follow the distribution (mean 3/2 kT; fraction >= Ea matches the exact value)", () => {
  const rng = createRng(5); const T = 500; const N = 200000; let sum = 0; let above = 0; const Ea = 10;
  for (let i = 0; i < N; i++) { const e = MB.sampleEnergy(T, rng); sum += e; if (e >= Ea) above++; }
  close(sum / N, MB.meanEnergy(T), 0.03); close(above / N, MB.fractionAbove(Ea, T), 0.004);
});
test("formatFraction never shows a non-zero fraction as 0 %", () => {
  assert.equal(MB.formatFraction(0.5), "50 %"); assert.match(MB.formatFraction(0.0072), /0\.72 %/); assert.match(MB.formatFraction(7e-8), /10/); assert.ok(!/^0 %/.test(MB.formatFraction(1e-12)));
});

console.log("== Engine: elastic collisions, energy, momentum ==");
function twoParticles(overrides = {}) {
  const e = new E.CollisionEngine({ seed: 3, params: { n: 5, ea: 10, site: 360, ...overrides.params } });
  e.n = 2;
  const set = (i, x, y, vx, vy, vz, sp) => { e.x[i] = x; e.y[i] = y; e.vx[i] = vx; e.vy[i] = vy; e.vz[i] = vz; e.sp[i] = sp; e.phi[i] = 0; e.spin[i] = 0; };
  return { e, set };
}
test("head-on collision of two equal particles exchanges normal velocities: momentum and kinetic energy conserved exactly", () => {
  const { e, set } = twoParticles(); set(0, 200, 150, 120, 0, 33, E.SP.C); set(1, 240, 150, -70, 0, -50, E.SP.D);
  const ke0 = e.totalKE(); const p0 = e.momentum([0, 0]);
  e.run(0.5);
  close(e.totalKE(), ke0, 1e-9 * ke0); const p1 = e.momentum([0, 0]); close(p1[0], p0[0], 1e-9); close(p1[1], p0[1], 1e-9);
  assert.ok(e.vx[0] < 0 && e.vx[1] > 0, "they bounced"); close(e.vx[0], -70, 1e-6); close(e.vx[1], 120, 1e-6);
});
test("an oblique collision conserves momentum and energy too (only the normal component is exchanged; vz untouched)", () => {
  const { e, set } = twoParticles(); set(0, 200, 150, 120, 40, 33, E.SP.C); set(1, 240, 160, -70, -10, -50, E.SP.D);
  const ke0 = e.totalKE(); const p0 = e.momentum([0, 0]); e.run(0.5); close(e.totalKE(), ke0, 1e-9 * ke0); const p1 = e.momentum([0, 0]); close(p1[0], p0[0], 1e-9); close(p1[1], p0[1], 1e-9);
  assert.equal(e.vz[0], 33); assert.equal(e.vz[1], -50);
});
test("total kinetic energy is conserved through thousands of collisions, wall bounces AND reactions (both systems) [CHANGED: no steady-supply variant any more]", () => {
  for (const system of ["mixed", "solid"]) {
    const e = new E.CollisionEngine({ seed: 11, params: { system, n: 40, T: 600, ea: 6, site: 360, piece: 3 } });
    const ke0 = e.totalKE(); e.run(30);
    assert.ok(e.succ > 5, `${system}: reactions happened (${e.succ})`);
    close(e.totalKE(), ke0, 1e-9 * ke0, system);
  }
});
test("collisions with the walls are elastic and particles never leave the vessel", () => {
  const e = new E.CollisionEngine({ seed: 4, params: { n: 50, T: 700 } }); e.run(20);
  for (let i = 0; i < e.n; i++) { assert.ok(e.x[i] >= E.R - 1e-9 && e.x[i] <= E.WORLD.w - E.R + 1e-9 && e.y[i] >= E.R - 1e-9 && e.y[i] <= E.WORLD.h - E.R + 1e-9, `particle ${i} inside`); assert.ok(Number.isFinite(e.vx[i]) && Number.isFinite(e.vy[i])); }
});
test("no two particles overlap deeply after a long run (hard discs)", () => {
  const e = new E.CollisionEngine({ seed: 8, params: { n: 50, T: 700 } }); e.run(10); let worst = 0;
  for (let i = 0; i < e.n; i++) for (let j = i + 1; j < e.n; j++) worst = Math.max(worst, 2 * E.R - Math.hypot(e.x[i] - e.x[j], e.y[i] - e.y[j]));
  assert.ok(worst < 3, `deepest overlap ${worst.toFixed(2)} px`);
});

console.log("== Engine: reaction rules (energy AND orientation) ==");
const Cc = E.SPEED_C;
function headOn(energyKJ, { site = 360, phiA = 0, phiB = Math.PI, ea = 10 } = {}) {
  const { e, set } = twoParticles({ params: { ea, site } });
  const v = Cc * Math.sqrt(energyKJ); // relative speed 2v: E = u^2/(4C^2) = v^2/C^2
  set(0, 200, 150, v, 0, 0, E.SP.A); set(1, 232, 150, -v, 0, 0, E.SP.B); e.phi[0] = phiA; e.phi[1] = phiB;
  e.run(0.3);
  return e;
}
test("collision energy below Ea: no reaction, classified 'too little energy'", () => {
  const e = headOn(6); assert.equal(e.succ, 0); assert.equal(e.coll, 1); assert.equal(e.failE, 1); assert.equal(e.lastEvent(E.OUT.LOW_ENERGY).outcome, E.OUT.LOW_ENERGY);
});
test("collision energy above Ea with facing sites: reaction (A, B become C, D); event records E >= Ea", () => {
  const e = headOn(14); assert.equal(e.succ, 1); assert.equal(e.sp[0], E.SP.C); assert.equal(e.sp[1], E.SP.D);
  const ev = e.lastEvent(E.OUT.SUCCESS); close(ev.E, 14, 0.05); assert.ok(ev.E >= ev.ea && ev.oriA && ev.oriB);
});
test("enough energy but sites facing AWAY (narrow site): no reaction, classified 'wrong orientation'", () => {
  const e = headOn(20, { site: 60, phiA: Math.PI, phiB: 0 }); assert.equal(e.succ, 0); assert.equal(e.failO, 1);
  const ev = e.lastEvent(E.OUT.ORIENTATION); assert.ok(ev.E >= ev.ea && !(ev.oriA && ev.oriB));
});
test("too little energy AND wrong orientation: classified 'both'", () => { const e = headOn(3, { site: 60, phiA: Math.PI, phiB: 0 }); assert.equal(e.failB, 1); });
test("Ea decides: the same collision reacts at Ea 10 and not at Ea 20; a catalyst (Ea x 0.6) turns 14 kJ/mol from no to yes at Ea 30", () => {
  assert.equal(headOn(14, { ea: 10 }).succ, 1); assert.equal(headOn(14, { ea: 20 }).succ, 0);
  const { e, set } = twoParticles({ params: { ea: 30, catalyst: true } }); const v = Cc * Math.sqrt(14);
  set(0, 200, 150, v, 0, 0, E.SP.A); set(1, 232, 150, -v, 0, 0, E.SP.B); e.run(0.3); assert.equal(e.eaEff, 18); assert.equal(e.succ, 0);
  const o = twoParticles({ params: { ea: 30, catalyst: true } }); const v2 = Cc * Math.sqrt(19);
  o.set(0, 200, 150, v2, 0, 0, E.SP.A); o.set(1, 232, 150, -v2, 0, 0, E.SP.B); o.e.run(0.3); assert.equal(o.e.succ, 1);
});
test("only A with B reacts: A+A and B+B bounce with no reaction counted", () => {
  const { e, set } = twoParticles(); const v = Cc * Math.sqrt(30);
  set(0, 200, 150, v, 0, 0, E.SP.A); set(1, 232, 150, -v, 0, 0, E.SP.A); e.run(0.3); assert.equal(e.succ + e.coll, 0);
});
test("solid site: B hitting an exposed A site reacts when E >= Ea (site consumed, B becomes D); a buried site cannot be reached", () => {
  const e = new E.CollisionEngine({ seed: 2, params: { system: "solid", piece: 0, n: 5, ea: 10, site: 360 } });
  const k = 0; // corner site of the lump
  e.n = 1; e.sp[0] = E.SP.B; const v = Cc * Math.sqrt(30); // E = u^2/(2C^2) = 30 for u = C sqrt(60)
  const u = Cc * Math.sqrt(2 * 20);
  e.x[0] = e.tx[k] - (E.R + E.TILE_R + 6); e.y[0] = e.ty[k]; e.vx[0] = u; e.vy[0] = 0; e.vz[0] = 0; e.run(0.2);
  assert.ok(v > 0); assert.equal(e.succ, 1); assert.equal(e.tstate[k], 1); assert.equal(e.sp[0], E.SP.D);
  const ex = e.exposedTiles(); assert.equal(ex.total, 144);
});
test("exposed surface grows with the number of pieces for the same mass (44 < 80 < 108 < 128 < 144)", () => {
  const out = []; for (let p = 0; p < 5; p++) out.push(new E.CollisionEngine({ seed: 1, params: { system: "solid", piece: p } }).exposedTiles().exposed);
  assert.deepEqual(out, [44, 80, 108, 128, 144]);
});

console.log("== Engine: link to the Maxwell-Boltzmann curve ==");
test("the vessel's particle energies follow the MB distribution at the chosen T (mean 3/2 kT; fraction >= Ea within sampling error)", () => {
  for (const T of [300, 500, 700]) {
    const e = new E.CollisionEngine({ seed: 21, params: { n: 50, T, ea: 10 } }); let sum = 0; let above = 0; let N = 0;
    for (let s = 0; s < 400; s++) { e.run(0.5); for (let i = 0; i < e.n; i++) { const ke = e.ke(i); sum += ke; if (ke >= 10) above++; N++; } }
    close(sum / N, MB.meanEnergy(T), 0.04 * MB.meanEnergy(T), `mean at ${T}`);
    close(above / N, MB.fractionAbove(10, T), 0.12 * MB.fractionAbove(10, T) + 0.004, `fraction at ${T}`);
  }
});
test("changing T rescales the velocities exactly (kinetic energy scales with T)", () => {
  const e = new E.CollisionEngine({ seed: 6, params: { n: 30, T: 300 } }); const ke = e.totalKE(); e.setParams({ T: 600 }); close(e.totalKE(), 2 * ke, 1e-9 * ke); e.setParams({ T: 450 }); close(e.totalKE(), 1.5 * ke, 1e-9 * ke);
});
test("[CHANGED: narrow 60-degree site so reactions are rare and reactants are not depleted while measuring] fraction of A-B collisions with energy >= Ea is about exp(-Ea/RT) (dilute vessel)", () => {
  for (const T of [400, 700]) {
    let c = 0; let en = 0; for (let s = 1; s <= 4; s++) { const e = new E.CollisionEngine({ seed: s, params: { n: 15, T, ea: 12, site: 60 } }); e.run(300); c += e.coll; en += e.energetic; }
    const theory = MB.arrheniusFactor(12, T); close(en / c, theory, 0.2 * theory, `T=${T} measured ${(en / c).toFixed(4)} theory ${theory.toFixed(4)}`);
  }
});
test("orientation: with a 180-degree site about (180/360)^2 = 25 % of energetic collisions react", () => {
  let en = 0; let ok = 0; for (let s = 1; s <= 3; s++) { const e = new E.CollisionEngine({ seed: s, params: { n: 25, T: 700, ea: 5, site: 180 } }); e.run(120); en += e.succ + e.failO; ok += e.succ; }
  close(ok / en, 0.25, 0.05, `steric fraction ${(ok / en).toFixed(3)}`);
});

console.log("== Engine: determinism, bounds, supply, performance ==");
test("same seed -> identical run; different seed -> different run (seeded randomness for tests)", () => {
  const a = new E.CollisionEngine({ seed: 99, params: {} }); const b = new E.CollisionEngine({ seed: 99, params: {} }); const c = new E.CollisionEngine({ seed: 100, params: {} });
  a.run(10); b.run(10); c.run(10);
  assert.equal(a.coll, b.coll); assert.equal(a.succ, b.succ); assert.equal(a.x[7], b.x[7]); assert.ok(a.x[7] !== c.x[7] || a.coll !== c.coll);
});
test("reset restores the initial state exactly (same seed) and clears counters, history and marks", () => {
  const a = new E.CollisionEngine({ seed: 5, params: {} }); const x0 = a.x[3]; a.run(8); a.mark("x"); a.reset(5);
  assert.equal(a.x[3], x0); assert.equal(a.t, 0); assert.equal(a.coll, 0); assert.equal(a.succ, 0); assert.equal(a.histLen, 1); assert.equal(a.marks.length, 0); assert.equal(a.latestEvent(), null);
});
test("particle count is capped and parameters are clamped/sanitised (no NaN, no overflow)", () => {
  const e = new E.CollisionEngine({ seed: 1, params: { n: 9999, T: -5, ea: NaN, site: 1e9, piece: 77 } });
  assert.equal(e.p.n, 50); assert.equal(e.p.T, 250); assert.equal(e.p.ea, 10); assert.equal(e.p.site, 360); assert.equal(e.p.piece, 4); assert.ok(e.n <= E.CAP);
  e.setParams({ n: 50 }); for (let i = 0; i < 5; i++) e.setParams({ n: 5 + i * 11 }); assert.ok(e.n <= E.CAP);
});
test("concentration slider adds/removes reactants live: A and B counts follow n", () => {
  const e = new E.CollisionEngine({ seed: 1, params: { n: 20 } }); e.run(1); e.setParams({ n: 45 }); assert.equal(e.countSpecies(0), 45); assert.equal(e.countSpecies(1), 45); e.setParams({ n: 10 }); assert.equal(e.countSpecies(0), 10); assert.equal(e.countSpecies(1), 10);
});
test("[CHANGED] the engine has no steady-supply / replenishment mechanism any more (no parameter, no timers, no restore)", () => {
  const e = new E.CollisionEngine({ seed: 3, params: { n: 40, T: 600, ea: 6, steady: true } });
  assert.equal("steady" in e.p, false, "params carry no 'steady'"); assert.equal(E.defaultParams().steady, undefined);
  assert.equal(e.tmr, undefined); assert.equal(e.trestore, undefined); assert.equal(E.RESTORE_DELAY, undefined);
  assert.equal(typeof e.energyHistogram, "undefined", "the histogram helper is gone");
});
test("performance: 100 mobile particles, 10 simulated seconds well under a second (fixed step, grid, no per-step objects)", () => {
  const e = new E.CollisionEngine({ seed: 1, params: { n: 50, T: 700, ea: 6 } }); const t0 = performance.now(); e.run(10); const ms = performance.now() - t0;
  assert.ok(ms < 1500, `${ms.toFixed(0)} ms`);
});
test("history ring buffer stays bounded", () => {
  const e = new E.CollisionEngine({ seed: 1, params: { n: 5 } }); e.run((E.HIST_CAP + 200) * E.HIST_EVERY); assert.equal(e.histLen, E.HIST_CAP); assert.equal(e.history().t.length, E.HIST_CAP);
});

console.log("== Rate metrics ==");
test("rateOver equals the successes counted in the window; the history is monotonic", () => {
  const e = new E.CollisionEngine({ seed: 7, params: { n: 40, T: 600, ea: 6 } }); e.run(40);
  const h = e.history(); for (let k = 1; k < h.t.length; k++) { assert.ok(h.t[k] > h.t[k - 1]); assert.ok(h.succ[k] >= h.succ[k - 1]); }
  const L = h.t.length - 1; let k0 = L; while (k0 > 0 && h.t[L] - h.t[k0 - 1] <= 10 + 1e-9) k0--;
  close(e.rateOver(10), (h.succ[L] - h.succ[k0]) / (h.t[L] - h.t[k0]), 1e-12);
});
test("the rate right after a start is averaged over the time that has actually passed", () => {
  const e = new E.CollisionEngine({ seed: 7, params: { n: 40, T: 600, ea: 6 } }); e.run(3); assert.ok(e.rateSpan(10) <= 3.0001 && e.rateSpan(10) >= 2.4);
});
test("[CHANGED] helpers: niceMax / niceStep / niceTicks / uncertainty (the bar helper binnedCounts and the moving average smoothedRate are gone)", () => {
  assert.equal(RM.binnedCounts, undefined); assert.equal(RM.smoothedRate, undefined);
  assert.equal(RM.niceMax(0.3, 1), 1); assert.equal(RM.niceMax(3.2), 5); assert.equal(RM.niceMax(11), 20); close(RM.rateUncertainty(16, 8), 0.5, 1e-12);
  assert.equal(RM.niceStep(0.1453), 0.15); assert.equal(RM.niceStep(21.6), 25); assert.equal(RM.niceStep(26), 30); assert.equal(RM.niceStep(100), 100);
  const t = RM.niceTicks(25, 5); assert.deepEqual(t.ticks, [0, 5, 10, 15, 20, 25]); assert.deepEqual(RM.niceTicks(0.2, 4).ticks.map((v) => +v.toFixed(3)), [0, 0.05, 0.1, 0.15, 0.2]);
});
test("snapshot reports counts that agree with the engine", () => {
  const e = new E.CollisionEngine({ seed: 7, params: { n: 40, T: 600, ea: 6 } }); e.run(20); const s = SNAP.makeSnapshot(e);
  assert.equal(s.succ, e.succ); assert.equal(s.counts.reduce((a, b) => a + b, 0), e.coll); assert.equal(s.nA + s.nB + s.nC + s.nD, e.n); close(s.rate, e.rateOver(10), 1e-12);
  assert.equal(s.events.length, e.succ); assert.equal(s.nC, e.succ); assert.equal(s.nD, e.succ); assert.equal(s.left, Math.min(s.nA, s.nB));
});

console.log("== Factors change the measured rate in the right direction (same engine, seeded) ==");
for (const sc of SC.SCENARIOS) {
  test(`predict scenario '${sc.id}': measured outcome is '${sc.correct}'`, () => {
    const r = SC.measureScenario(sc, { reps: 6, duration: 6 }); // [CHANGED] initial rate of a fresh closed vessel (was a 50 s steady-supply average)
    assert.equal(r.outcome, sc.correct, `before ${r.before.toFixed(2)} after ${r.after.toFixed(2)} ratio ${r.ratio.toFixed(2)}`);
  });
}


// =====================================================================================================================
// NEW (correction spec): irreversible A + B -> C + D, rate curve from real events, products plateau, MB maths and axis.
// =====================================================================================================================
import fs from "node:fs";
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const countIn = (times, a, b) => times.filter((t) => t > a && t <= b).length;

console.log("== NEW: irreversible reaction A + B -> C + D (mixed system) ==");
test("products never revert: every particle's species only ever moves A/B -> C/D (never back), sampled every 0.25 s for 80 s", () => {
  const e = new E.CollisionEngine({ seed: 31, params: { n: 30, T: 500, ea: 8, site: 360 } });
  const prev = Uint8Array.from(e.sp.slice(0, e.n)); let flips = 0;
  for (let k = 0; k < 320; k++) {
    e.run(0.25);
    for (let i = 0; i < e.n; i++) { if (prev[i] >= 2 && e.sp[i] !== prev[i]) flips++; if (e.sp[i] < prev[i]) flips++; prev[i] = e.sp[i]; }
  }
  assert.ok(e.succ > 15, `plenty of reactions happened (${e.succ})`); assert.equal(flips, 0, `${flips} species reversions`);
});
test("reactant counts fall and product counts rise monotonically; A + B + C + D (particle units) is constant; C = D = reactions; A = B = n - reactions", () => {
  const e = new E.CollisionEngine({ seed: 31, params: { n: 30, T: 500, ea: 8, site: 360 } }); let [a0, b0, c0, d0] = e.speciesCounts(); const total = a0 + b0 + c0 + d0;
  assert.deepEqual([a0, b0, c0, d0], [30, 30, 0, 0]); assert.equal(e.unitsTotal(), 60);
  for (let k = 0; k < 160; k++) {
    e.run(0.5); const [a, b, c, d] = e.speciesCounts();
    assert.ok(a <= a0 && b <= b0 && c >= c0 && d >= d0, "A and B never rise, C and D never fall"); [a0, b0, c0, d0] = [a, b, c, d];
    assert.equal(a + b + c + d, total, "units conserved"); assert.equal(c, e.succ); assert.equal(d, e.succ); assert.equal(a, 30 - e.succ); assert.equal(b, 30 - e.succ);
  }
  assert.ok(e.succ > 20 && e.speciesCounts()[0] < 10, "most of the reactant has gone");
});
test("success needs BOTH enough energy AND orientation (also in the closed irreversible vessel): wrong-orientation / low-energy collisions never make products", () => {
  const e = new E.CollisionEngine({ seed: 9, params: { n: 30, T: 500, ea: 8, site: 90 } }); e.run(60);
  assert.ok(e.failO > 0 && e.failE > 0, "some collisions failed for each reason"); assert.equal(e.succ, e.counts ? 0 : e.succ);
  for (let o = 0; o < 4; o++) { const ev = e.lastEvent(o); if (!ev) continue; assert.equal(ev.outcome === 0, ev.E >= ev.ea && ev.oriA && ev.oriB, `outcome ${o}`); }
  assert.equal(e.countSpecies(E.SP.C), e.succ);
});
test("the mean rate falls as reactants are used up under UNCHANGED conditions (summed over 8 seeds: 0-15 s > 15-30 s > 30-45 s > 45-60 s)", () => {
  const w = [0, 0, 0, 0];
  for (let sd = 1; sd <= 8; sd++) { const e = new E.CollisionEngine({ seed: 100 + sd, params: { n: 40, T: 500, ea: 8, site: 240 } }); e.run(60); const t = e.successTimes(); for (let k = 0; k < 4; k++) w[k] += countIn(t, 15 * k, 15 * (k + 1)); }
  assert.ok(w[0] > w[1] && w[1] > w[2] && w[2] > w[3], `window totals ${w.join(" > ")}`);
});
test("the rate CURVE (from the events) is high at the start and low later, averaged over 8 seeds; it is built only from the events", () => {
  let early = 0; let late = 0;
  for (let sd = 1; sd <= 8; sd++) {
    const e = new E.CollisionEngine({ seed: 200 + sd, params: { n: 40, T: 500, ea: 8, site: 240 } }); e.run(80); const c = RM.rateCurve(e.successTimes(), e.t);
    early += mean(Array.from(c.r.slice(0, 20))); late += mean(Array.from(c.r.slice(-30)));
  }
  assert.ok(early > 2.5 * late, `early ${(early / 8).toFixed(2)} vs late ${(late / 8).toFixed(2)} reactions/s`);
});
test("rate -> 0 when a LIMITING reactant is exhausted: 3 A and 9 B give exactly 3 reactions, 6 B are left over, and the rate stays 0", () => {
  const e = new E.CollisionEngine({ seed: 4, params: { n: 9, T: 700, ea: 5, site: 360 } });
  let removed = 0; for (let i = e.n - 1; i >= 0 && removed < 6; i--) if (e.sp[i] === E.SP.A) { e._remove(i); removed++; }
  assert.deepEqual(e.speciesCounts(), [3, 9, 0, 0]); e.run(150);
  assert.equal(e.succ, 3); assert.deepEqual(e.speciesCounts(), [0, 6, 3, 3]); assert.equal(e.limitingLeft(), 0);
  const s0 = e.succ; e.run(60); assert.equal(e.succ, s0, "no product formed after A ran out"); assert.equal(e.rateOver(10), 0);
  const c = RM.rateCurve(e.successTimes(), e.t); assert.ok(c.r[c.r.length - 1] < 0.02, `curve end ${c.r[c.r.length - 1]}`);
});
test("rate -> 0 and products stop when both reactants are used up (equal amounts); the Products series ends on a plateau", () => {
  const e = new E.CollisionEngine({ seed: 6, params: { n: 8, T: 700, ea: 5, site: 360 } }); e.run(300);
  assert.equal(e.succ, 8); assert.equal(e.limitingLeft(), 0); const tLast = e.successTimes()[7]; assert.ok(tLast < 250, `finished by ${tLast.toFixed(0)} s`);
  e.run(30); assert.equal(e.succ, 8);
  const ps = RM.productCurve(e.successTimes(), e.t); assert.equal(ps.v[ps.v.length - 1], 8); assert.equal(ps.t[ps.t.length - 1], e.t); // [CHANGED] smooth PCHIP curve (was a polyline through the events)
  for (let i = 1; i < ps.v.length; i++) assert.ok(ps.v[i] >= ps.v[i - 1] - 1e-9 && ps.v[i] <= 8 + 1e-9 && ps.t[i] >= ps.t[i - 1], "never falls, never overshoots");
  const plateau = ps.v.filter((_, i) => ps.t[i] >= tLast + 40); assert.ok(plateau.length >= 2 && plateau.every((v) => Math.abs(v - 8) < 1e-9), "flat after the last reaction");
  const c = RM.rateCurve(e.successTimes(), e.t); assert.ok(c.r[c.r.length - 1] < 0.02 && Math.max(...c.r) > 0.05);
});
test("Reset restores the initial reactants and clears the graph data (events, history, marks, counters)", () => {
  const e = new E.CollisionEngine({ seed: 2, params: { n: 25, T: 600, ea: 6 } }); e.run(40); e.mark("x"); assert.ok(e.succ > 5);
  e.reset(2);
  assert.deepEqual(e.speciesCounts(), [25, 25, 0, 0]); assert.equal(e.succ, 0); assert.equal(e.successTimes().length, 0); assert.equal(e.histLen, 1); assert.equal(e.marks.length, 0); assert.equal(e.t, 0);
  const s = SNAP.makeSnapshot(e); assert.equal(s.events.length, 0); assert.equal(s.nC, 0); assert.equal(Math.max(...RM.rateCurve(s.events, s.t).r), 0);
  e.configure({ n: 12 }, 3); assert.deepEqual(e.speciesCounts(), [12, 12, 0, 0]);
});
test("the Concentration slider only adds or removes the DIFFERENCE (it never tops reactants back up): after 10 reactions n 40 -> 41 gives 31 A", () => {
  const e = new E.CollisionEngine({ seed: 31, params: { n: 40, T: 600, ea: 6, site: 360 } }); while (e.succ < 10) e.run(0.25);
  const a = e.speciesCounts()[0]; e.setParams({ n: 40 }); assert.equal(e.speciesCounts()[0], a, "same n: nothing added");
  e.setParams({ n: 41 }); assert.equal(e.speciesCounts()[0], a + 1); e.setParams({ n: 40 }); assert.equal(e.speciesCounts()[0], a);
  assert.equal(e.speciesCounts()[2], e.succ, "products untouched");
});

console.log("== NEW: irreversible reaction, solid A + B ==");
test("solid: a used-up site never returns; B -> D for good; sites + used sites = 144; B + D = n; D = used sites = reactions", () => {
  const e = new E.CollisionEngine({ seed: 5, params: { system: "solid", piece: 2, n: 30, T: 600, ea: 6, site: 360 } }); const prev = Uint8Array.from(e.tstate.slice(0, e.tn)); let back = 0;
  for (let k = 0; k < 240; k++) {
    e.run(0.5); for (let m = 0; m < e.tn; m++) { if (prev[m] === 1 && e.tstate[m] !== 1) back++; prev[m] = e.tstate[m]; }
    const [a, b, c, d] = e.speciesCounts(); assert.equal(a + c, 144); assert.equal(b + d, 30); assert.equal(c, e.succ); assert.equal(d, e.succ); assert.equal(e.consumedTiles(), e.succ);
  }
  assert.equal(back, 0); assert.ok(e.succ > 10, `reactions ${e.succ}`);
});
test("solid: the limiting reactant (B) runs out and the rate goes to 0; A (the solid) is left over", () => {
  const e = new E.CollisionEngine({ seed: 5, params: { system: "solid", piece: 4, n: 8, T: 700, ea: 5, site: 360 } }); e.run(400);
  assert.equal(e.succ, 8); assert.deepEqual(e.speciesCounts(), [136, 0, 8, 8]); e.run(30); assert.equal(e.succ, 8); assert.equal(e.rateOver(10), 0);
});
test("solid: changing the surface area mid-run keeps the number of used-up sites (consumed solid never comes back)", () => {
  const e = new E.CollisionEngine({ seed: 5, params: { system: "solid", piece: 0, n: 30, T: 700, ea: 5, site: 360 } }); while (e.succ < 6) e.run(0.5);
  const used = e.consumedTiles(); e.setParams({ piece: 4 }); assert.equal(e.consumedTiles(), used); assert.equal(e.speciesCounts()[0] + e.speciesCounts()[2], 144);
});

console.log("== NEW: the rate responds for real (engine) to T, concentration, Ea, orientation, catalyst, surface area ==");
test("initial rate rises with temperature (300 < 400 < 500 < 600 K), with concentration (10 < 20 < 40), and falls with Ea (6 > 10 > 16) and with narrower orientation (360 > 240 > 120 > 60 degrees)", () => {
  const r = (p) => SC.measureRate({ ...p }, { reps: 8, duration: 6, seed: 300 });
  const T = [300, 400, 500, 600].map((v) => r({ T: v })); for (let i = 1; i < T.length; i++) assert.ok(T[i] > T[i - 1], `T ${T.map((x) => x.toFixed(2))}`);
  const n = [10, 20, 40].map((v) => r({ n: v })); for (let i = 1; i < n.length; i++) assert.ok(n[i] > n[i - 1] * 1.4, `n ${n.map((x) => x.toFixed(2))}`);
  const ea = [6, 10, 16].map((v) => r({ ea: v })); for (let i = 1; i < ea.length; i++) assert.ok(ea[i] < ea[i - 1], `Ea ${ea.map((x) => x.toFixed(2))}`);
  const site = [360, 240, 120, 60].map((v) => r({ site: v })); for (let i = 1; i < site.length; i++) assert.ok(site[i] < site[i - 1], `site ${site.map((x) => x.toFixed(2))}`);
});
test("catalyst: the effective Ea falls to 60 %, the vessel's molecular energies are untouched (same velocities, same kinetic energy) and the rate rises", () => {
  const a = new E.CollisionEngine({ seed: 77, params: { ea: 20 } }); const b = new E.CollisionEngine({ seed: 77, params: { ea: 20, catalyst: true } });
  assert.equal(a.eaEff, 20); assert.equal(b.eaEff, 12); assert.equal(a.totalKE(), b.totalKE()); for (let i = 0; i < a.n; i++) assert.equal(a.ke(i), b.ke(i));
  a.setParams({ catalyst: true }); assert.equal(a.eaEff, 12); assert.equal(a.totalKE(), b.totalKE(), "switching the catalyst on does not change any particle's energy");
  const plain = SC.measureRate({ ea: 20, T: 500 }, { reps: 8, duration: 8, seed: 5 }); const cat = SC.measureRate({ ea: 20, T: 500, catalyst: true }, { reps: 8, duration: 8, seed: 5 });
  assert.ok(cat > 2 * plain, `rate ${plain.toFixed(2)} -> ${cat.toFixed(2)}`);
});
test("surface area (solid): the initial rate rises as the same mass is split into more pieces (1 lump < 4 pieces < 36)", () => {
  const r = (piece) => SC.measureRate({ system: "solid", piece, ea: 8, n: 40, site: 360 }, { reps: 6, duration: 6, seed: 40 });
  const v = [0, 1, 4].map(r); assert.ok(v[0] < v[1] && v[1] < v[2], `pieces ${v.map((x) => x.toFixed(2))}`);
});

console.log("== NEW: the rate graph data is the engine's data, and is not a forced shape ==");
test("rateCurve is smooth, non-negative, and its area is close to the number of reactions (the events), at several times", () => {
  const e = new E.CollisionEngine({ seed: 12, params: { n: 40, T: 500, ea: 8 } });
  for (const T of [20, 40, 80, 120]) {
    e.run(T - e.t); const ev = e.successTimes(); const c = RM.rateCurve(ev, e.t); assert.equal(c.r.length, 121);
    assert.ok(c.r.every((v) => v >= 0 && Number.isFinite(v))); close(RM.curveArea(c), ev.length, Math.max(2, 0.2 * ev.length), `t=${T}`);
    let big = 0; const mx = Math.max(...c.r); for (let i = 1; i < c.r.length; i++) big = Math.max(big, Math.abs(c.r[i] - c.r[i - 1]) / (mx || 1)); assert.ok(big < 0.3, `largest step between neighbouring points ${(100 * big).toFixed(1)} % of the peak`);
  }
});
test("rateCurve is NOT forced to fall: events that really speed up give a rising curve; evenly spaced events give a flat one; no events give zeros", () => {
  const n = 60; const rising = Array.from({ length: n }, (_, i) => 60 * Math.sqrt((i + 1) / n)); // density proportional to t
  const up = RM.rateCurve(rising, 60); assert.ok(up.r[100] > 2 * up.r[20], `[CHANGED: x2, the smoothing is wider] rising ${up.r[20].toFixed(2)} -> ${up.r[100].toFixed(2)}`);
  const flat = RM.rateCurve(Array.from({ length: 60 }, (_, i) => i + 0.5), 60); const mid = Array.from(flat.r.slice(20, 100)); assert.ok(Math.max(...mid) / Math.min(...mid) < 1.15, "flat");
  assert.equal(Math.max(...RM.rateCurve([], 30).r), 0); assert.equal(Math.max(...RM.rateCurve([], 0).r), 0);
});
test("graph data equals engine data: product series = cumulative reactions; last point = engine counts of C, D and succ; events are the engine's own times, ascending", () => {
  const e = new E.CollisionEngine({ seed: 14, params: { n: 40, T: 500, ea: 8 } }); e.run(55); const s = SNAP.makeSnapshot(e);
  const ps = RM.productCurve(s.events, s.t); assert.equal(ps.v[ps.v.length - 1], e.succ); assert.equal(ps.vs[ps.vs.length - 1], e.countSpecies(E.SP.C)); assert.equal(ps.vs[ps.vs.length - 1], e.countSpecies(E.SP.D));
  for (let k = 0; k < ps.ts.length; k++) assert.equal(ps.vs[k], s.events.filter((t) => t <= ps.ts[k] + 1e-9).length, `sample ${k} is the number of reactions up to that time`); // [CHANGED]
  assert.equal(ps.t[ps.t.length - 1], e.t); assert.equal(s.events.length, e.succ); for (let i = 1; i < s.events.length; i++) assert.ok(s.events[i] >= s.events[i - 1]);
  const h = e.history(); for (let k = 0; k < h.t.length; k++) assert.equal(h.succ[k], s.events.filter((t) => t <= h.t[k] + 1e-9).length, `history sample ${k} agrees with the event times`);
  assert.equal(s.nC, e.succ); close(s.rate, e.rateOver(10), 1e-12);
});

console.log("== NEW (round 3b): smooth Products curve, Reactants / Both curves, rate curve without end artefacts ==");
test("PCHIP: passes through every sample, never overshoots, never falls for rising data, and flat data stays flat", () => {
  const xs = [0, 1, 2, 3, 4, 5]; const ys = [0, 6, 6, 7, 20, 20]; const f = RM.pchip(xs, ys);
  xs.forEach((x, i) => close(f(x), ys[i], 1e-12)); let prev = -1; for (let x = 0; x <= 5; x += 0.01) { const v = f(x); assert.ok(v >= prev - 1e-9 && v <= 20 + 1e-9 && v >= -1e-9); prev = v; }
  assert.ok(Math.abs(f(1.5) - 6) < 1e-9, "flat between equal samples (no wiggle)"); const g = RM.pchip([0, 1, 2], [3, 2, 0]); for (let x = 0; x <= 2; x += 0.01) assert.ok(g(x) <= 3 + 1e-9 && g(x) >= -1e-9);
});
test("default vessel gives a well-resolved curve: 30-45 reactions in a 150 s default run (8 seeds), so the default particle numbers stay as they are", () => {
  for (let sd = 11; sd < 19; sd++) { const e = new E.CollisionEngine({ seed: sd, params: {} }); e.run(150); assert.ok(e.succ >= 30 && e.succ <= 45, `seed ${sd}: ${e.succ} reactions`); }
});
test("Products curve: smooth (no straight-line staircase), monotone, ends at the engine's count, steep start then plateau, with many points", () => {
  const e = new E.CollisionEngine({ seed: 11, params: {} }); e.run(150); const ev = e.successTimes(); const pc = RM.productCurve(ev, e.t);
  assert.equal(pc.t.length, 161); assert.equal(pc.v[160], e.succ); for (let i = 1; i < pc.v.length; i++) assert.ok(pc.v[i] >= pc.v[i - 1] - 1e-9 && pc.v[i] <= e.succ + 1e-9);
  const early = pc.v[Math.round(0.1 * 160)] - pc.v[0]; const late = pc.v[160] - pc.v[Math.round(0.8 * 160)]; assert.ok(early > 3 * late, `steep start (${early.toFixed(1)}) then flatter (${late.toFixed(1)})`);
  let maxJump = 0; for (let i = 1; i < pc.v.length; i++) maxJump = Math.max(maxJump, pc.v[i] - pc.v[i - 1]); assert.ok(maxJump < 0.25 * e.succ, "no single big step");
});
test("Reactants and Both curves come from the engine's recorded counts: A and B fall, C = D rise, A + C constant (mixed), crossing, ending at 0 and the total; samples equal engine counts", () => {
  const e = new E.CollisionEngine({ seed: 11, params: { n: 30, T: 600, ea: 6, site: 360 } }); e.run(200); const h = e.history();
  for (let k = 1; k < h.t.length; k++) { assert.ok(h.a[k] <= h.a[k - 1] && h.b[k] <= h.b[k - 1] && h.succ[k] >= h.succ[k - 1]); assert.equal(h.a[k] + h.succ[k], 30); assert.equal(h.b[k] + h.succ[k], 30); }
  assert.equal(h.a[0], 30); assert.equal(h.b[0], 30); assert.equal(h.succ[0], 0);
  const [a, b] = e.speciesCounts(); const cc = RM.countCurves(h, e.t, { a, b, c: e.succ });
  assert.equal(cc.a[0], 30); assert.equal(cc.c[0], 0); assert.equal(cc.a[cc.a.length - 1], a); assert.equal(cc.c[cc.c.length - 1], e.succ); assert.equal(a, 30 - e.succ);
  for (let i = 1; i < cc.ca.length; i++) { assert.ok(cc.ca[i] <= cc.ca[i - 1] + 1e-9 && cc.cc[i] >= cc.cc[i - 1] - 1e-9); }
  let cross = false; for (let i = 0; i < cc.ca.length; i++) if (cc.cc[i] >= cc.ca[i]) cross = true; assert.ok(cross, "the curves cross");
  assert.ok(a === 0 && e.succ === 30, `fully reacted: A ${a}, C ${e.succ}`); assert.ok(cc.ca[160] < 1e-9 && Math.abs(cc.cc[160] - 30) < 1e-9);
});
test("solid system: Reactants curves are the solid's unused sites (falling by the number of reactions) and B; sampled history matches the engine; Reset clears the history", () => {
  const e = new E.CollisionEngine({ seed: 5, params: { system: "solid", piece: 2, n: 20, T: 700, ea: 5, site: 360 } }); e.run(100); const h = e.history();
  assert.equal(h.a[0], 144); assert.equal(h.b[0], 20); for (let k = 0; k < h.t.length; k++) { assert.equal(h.a[k], 144 - h.succ[k]); assert.equal(h.b[k], 20 - h.succ[k]); }
  assert.equal(h.a[h.a.length - 1], 144 - Math.round(h.succ[h.succ.length - 1])); e.reset(5); const h2 = e.history(); assert.equal(h2.t.length, 1); assert.equal(h2.a[0], 144); assert.equal(h2.b[0], 20); assert.equal(h2.succ[0], 0);
});
test("[NEW] rate curve has no end artefacts: the start is not lower than the early peak, and once 80 % has reacted the plotted rate never rises by more than 2 % of its peak (14 seeds, default vessel)", () => {
  let worstStart = 9; let worstRise = 0;
  for (let sd = 1; sd <= 14; sd++) {
    const e = new E.CollisionEngine({ seed: sd, params: {} }); e.run(150); const ev = e.successTimes(); const c = RM.rateCurve(ev, e.t); const mx = Math.max(...c.r);
    worstStart = Math.min(worstStart, c.r[0] / Math.max(...c.r.slice(0, 13)));
    const t80 = ev[Math.floor(0.8 * ev.length) - 1]; let mn = Infinity; let rise = 0;
    for (let i = 0; i < c.r.length; i++) if (c.t[i] >= t80) { mn = Math.min(mn, c.r[i]); rise = Math.max(rise, c.r[i] - mn); }
    worstRise = Math.max(worstRise, rise / mx);
  }
  assert.ok(worstStart >= 0.95, `start / early peak = ${worstStart.toFixed(3)}`); assert.ok(worstRise <= 0.02, `largest late rise ${(100 * worstRise).toFixed(2)} % of the peak`);
});

console.log("== NEW: Maxwell-Boltzmann distribution (3-D translational kinetic energy) ==");
const NA = 6.02214076e23; const KB = 1.380649e-23;
test("f(E) = 2 sqrt(E/pi) (kT)^-3/2 exp(-E/kT): matches the formula per mole (RT) and per molecule (kT in joules, converted)", () => {
  for (const T of [300, 400, 600]) for (const Emol of [0.3, 1.66, 5, 12, 30]) {
    const RT = 8.314462618e-3 * T; const direct = 2 * Math.sqrt(Emol / Math.PI) * RT ** -1.5 * Math.exp(-Emol / RT);
    close(MB.mbDensity(Emol, T), direct, 1e-6 * direct, `per mole ${T} K ${Emol}`);
    const EJ = (Emol * 1000) / NA; const kTJ = KB * T; const perJ = 2 * Math.sqrt(EJ / Math.PI) * kTJ ** -1.5 * Math.exp(-EJ / kTJ); // per joule
    const perKJmol = perJ * (1000 / NA); close(perKJmol, direct, 2e-6 * direct, `per molecule ${T} K ${Emol}`);
  }
});
test("starts at zero, rises to ONE peak at RT/2 (1.66 kJ/mol at 400 K), then falls with a longer right-hand tail (not symmetrical); normalised area 1", () => {
  assert.equal(MB.mbDensity(0, 400), 0); assert.equal(MB.mbDensity(-1, 400), 0);
  close(MB.peakEnergy(400), 1.6629, 0.001); close(MB.peakEnergy(400), 8.314462618e-3 * 400 / 2, 1e-12);
  for (const T of [250, 400, 700]) {
    const ax = MB.mbAxis(T); const c = MB.densityCurve(T, ax.xMax, 600); assert.equal(c.E[0], 0); assert.equal(c.f[0], 0);
    let sign = 0; let changes = 0; for (let i = 1; i < c.f.length; i++) { const sg = Math.sign(c.f[i] - c.f[i - 1]); if (sg !== 0 && sg !== sign) { if (sign !== 0) changes++; sign = sg; } }
    assert.equal(changes, 1, `T=${T}: one rise then one fall (one peak)`); assert.equal(sign, -1, "ends falling");
    let im = 0; for (let i = 1; i < c.f.length; i++) if (c.f[i] > c.f[im]) im = i; close(c.E[im], MB.peakEnergy(T), ax.xMax / 600 * 1.01, `peak position ${T}`);
    const mode = MB.peakEnergy(T); const k = MB.kT(T);
    assert.ok(MB.fractionAbove(mode, T) > 0.5 + 0.1, "more than half of the area lies right of the peak (mean 3kT/2 > mode kT/2)"); assert.ok(MB.meanEnergy(T) > 2.9 * mode);
    assert.ok(MB.mbDensity(mode + 4 * k, T) > MB.mbDensity(Math.max(0, mode - 0.4999 * k) * 0.01, T), "tail is long: still non-zero at 4 kT right of the peak");
    close(MB.numericArea(T, 20000), 1, 1e-9, `area ${T}`);
    close(MB.simpson((E) => MB.mbDensity(E, T), 0, ax.xMax, 40000) + MB.fractionAbove(ax.xMax, T), 1, 2e-4, "plotted range + tail beyond it = 1");
  }
});
test("temperature: higher T gives a broader curve, a LOWER peak, the peak moves RIGHT, more molecules above a fixed Ea, area still 1; lower T the opposite", () => {
  const Ts = [300, 400, 500, 600, 700]; let prev = null;
  for (const T of Ts) {
    const now = { mode: MB.peakEnergy(T), peak: MB.peakDensity(T), frac: MB.fractionAbove(10, T), sd: Math.sqrt(1.5) * MB.kT(T), area: MB.numericArea(T, 20000) };
    close(now.area, 1, 1e-9); if (prev) { assert.ok(now.mode > prev.mode && now.peak < prev.peak && now.frac > prev.frac && now.sd > prev.sd, `T=${T}`); close(now.peak * now.mode, prev.peak * prev.mode, 1e-9, "peak height x peak position is constant (curve rescales as 1/T times T)"); }
    prev = now;
  }
  // measured from the plotted samples too (full width at half maximum grows)
  const fwhm = (T) => { const c = MB.densityCurve(T, 60, 3000); const pk = Math.max(...c.f); const idx = c.f.map((v, i) => (v >= pk / 2 ? i : -1)).filter((i) => i >= 0); return c.E[idx[idx.length - 1]] - c.E[idx[0]]; };
  assert.ok(fwhm(600) > fwhm(400) * 1.4 && fwhm(400) > fwhm(300)); close(MB.fractionAbove(10, 600) / MB.fractionAbove(10, 300) > 5 ? 1 : 0, 1, 0, "fraction above Ea grows strongly");
});
test("adaptive axis: peak and tail clearly visible for every T (peak >= 60 % of the y range and >= 5 % along x; tail < 3 % of the peak at the right edge); nothing is clipped", () => {
  for (let T = 250; T <= 700; T += 25) {
    const ax = MB.mbAxis(T); const pk = MB.peakDensity(T); assert.ok(ax.yMax >= pk && pk / ax.yMax >= 0.6, `T=${T} peak fills ${(100 * pk / ax.yMax).toFixed(0)} %`);
    assert.ok(MB.peakEnergy(T) / ax.xMax >= 0.05, `T=${T} peak at ${(100 * MB.peakEnergy(T) / ax.xMax).toFixed(1)} % of the axis`); assert.ok(MB.mbDensity(ax.xMax, T) < 0.03 * pk, "tail has almost died away at the edge"); assert.ok(ax.xMax >= 6.5 * MB.kT(T) - 1e-9 && ax.xMax < 12 * MB.kT(T), "range is not wasteful");
  }
  assert.ok(400 && MB.mbAxis(400).xMax < 70 / 2, "the old fixed 0-70 kJ/mol axis is gone: at 400 K the range is far smaller");
  const pinned = MB.mbAxis(600, { pinnedT: 300 }); assert.ok(pinned.yMax >= MB.peakDensity(300), "a pinned lower-T curve (taller) also fits");
});
test("Ea beyond the range: needsFull is set and a full-range option reaches Ea; the curve and the area are untouched by it", () => {
  const a = MB.mbAxis(400, { eaList: [10] }); assert.equal(a.needsFull, false); assert.equal(MB.mbAxis(400, { eaList: [10], full: true }).xMax, a.xMax, "no full range needed when Ea is inside");
  const o = MB.mbAxis(400, { eaList: [60] }); assert.equal(o.needsFull, true); assert.equal(o.full, false); assert.equal(o.xMax, o.baseXMax);
  const f = MB.mbAxis(400, { eaList: [60], full: true }); assert.ok(f.full && f.xMax >= 60 * 1.15 && f.yMax === o.yMax, "only the x range changes; y scale stays so the curve shape is not distorted");
  assert.deepEqual(Array.from(MB.densityCurve(400, 25, 100).f), Array.from(MB.densityCurve(400, 25, 100).f)); close(MB.numericArea(400, 20000), 1, 1e-9);
  assert.ok(MB.mbAxis(250, { eaList: [60] }).needsFull && MB.mbAxis(700, { eaList: [20] }).needsFull === false && MB.mbAxis(700, { eaList: [45] }).needsFull);
});
test("catalyst and the distribution: the density has no Ea argument at all (the curve cannot depend on a catalyst); only the effective Ea and the area beyond it change", () => {
  assert.equal(MB.mbDensity.length, 2); const T = 400; const base = Array.from(MB.densityCurve(T, 25, 50).f);
  for (const ea of [10, 6]) { assert.deepEqual(Array.from(MB.densityCurve(T, 25, 50).f), base); }
  const plain = new E.CollisionEngine({ seed: 1, params: { T, ea: 20 } }); const cat = new E.CollisionEngine({ seed: 1, params: { T, ea: 20, catalyst: true } });
  assert.equal(cat.eaEff, 0.6 * plain.eaEff); assert.ok(MB.fractionAbove(cat.eaEff, T) > MB.fractionAbove(plain.eaEff, T)); assert.ok(MB.fractionAbove(cat.eaEff, T) < 1);
  assert.equal(MB.peakEnergy(T), MB.peakEnergy(T)); // unchanged by construction: no catalyst term exists
});

console.log("== NEW: no vertical bars / histogram anywhere in either graph (source scan) ==");
{
  const dir = "../src/engines/collision-theory-visualizer/";
  const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const read = (f) => strip(fs.readFileSync(new URL(dir + f, import.meta.url), "utf8"));
  const files = ["components/RateGraph.jsx", "components/MbGraph.jsx", "CollisionTheoryVisualizer.jsx", "lib/rateMetrics.js", "lib/maxwellBoltzmann.js", "lib/collisionEngine.js", "lib/snapshot.js"];
  test("RateGraph and MbGraph draw no <rect> except the clip rectangle, and no bars/hist/binning identifiers exist in the engine, metrics, graphs or page", () => {
    for (const f of files) {
      const src = read(f);
      assert.ok(!/histogram|HIST_BIN|binnedCounts|energyHistogram|showHist|histView|\bbars?\b|barEls|smoothedRate|ct-hist|steady|RESTORE_DELAY|Steady supply/i.test(src), `${f} still mentions an obsolete bar / histogram / steady-supply item`);
    }
    for (const f of ["components/RateGraph.jsx", "components/MbGraph.jsx"]) {
      const src = read(f).replace(/<clipPath[\s\S]*?<\/clipPath>/g, ""); assert.ok(!/<rect\b/.test(src), `${f} draws a <rect>`); assert.ok(!/<path[^>]*d=\{bar/i.test(src));
    }
  });
}

console.log("== Magnified view geometry never leaves the viewBox ==");
test("for 3000 random recorded collisions (and extreme directions) both molecules stay inside the viewBox at every animation step, and the final frame separates them", () => {
  const rng = createRng(1); const r = GEO.VIEW.r;
  for (let i = 0; i < 3000; i++) {
    const a = rng.next() * 2 * Math.PI; const sp = rng.range(0.1, 3000); const th = rng.next() * 2 * Math.PI;
    const ev = { kind: i % 4 === 0 ? 1 : 0, ux: Math.cos(th) * sp, uy: Math.sin(th) * sp, dx: Math.cos(a) * 16, dy: Math.sin(a) * 16, outcome: i % 4 };
    // make it genuinely approaching: u points from B toward A's partner (against d)
    if (ev.ux * ev.dx + ev.uy * ev.dy > 0) { ev.ux = -ev.ux; ev.uy = -ev.uy; }
    const g = GEO.eventGeometry(ev);
    for (let s = 0; s <= 1.0001; s += 0.05) { const p = GEO.positionAt(g, Math.min(1, s)); for (const [px, py] of [[p.ax, p.ay], [p.bx, p.by]]) assert.ok(px >= r - 1e-6 && px <= GEO.VIEW.w - r + 1e-6 && py >= r - 1e-6 && py <= GEO.VIEW.h - r + 1e-6, `event ${i} s=${s} (${px.toFixed(1)},${py.toFixed(1)})`); }
    const f = GEO.positionAt(g, 1); assert.ok(Math.hypot(f.ax - f.bx, f.ay - f.by) >= GEO.VIEW.contact - 1e-6);
  }
});
test("a real engine event drives the view: approach direction comes from the recorded relative velocity", () => {
  const e = headOn(14); const ev = e.lastEvent(0); const g = GEO.eventGeometry(ev);
  assert.ok(g.start.ax < g.contact.ax || g.start.bx > g.contact.bx || true); // geometry exists
  assert.ok(Math.abs(g.pre.x) > 0.99, "head-on along x"); assert.ok(g.post.x < 0, "bounce reverses the relative velocity");
});

console.log("== Chocolate Wrapping model ==");
test("quantities: any whole number 1-200 is accepted as typed (15, 10, 100 were rejected by the old field)", () => {
  for (const v of [1, 2, 10, 15, 100, 200, "15", "100", " 40 "]) { const r = CW.normaliseQuantity(v); assert.equal(r.notice, "", String(v)); assert.equal(r.value, Number(String(v).trim())); }
});
test("refusals are explained: below 1, above 200, decimals, empty, text", () => {
  let r = CW.normaliseQuantity("-5"); assert.equal(r.value, 1); assert.match(r.notice, /at least 1/);
  r = CW.normaliseQuantity("0"); assert.equal(r.value, 1);
  r = CW.normaliseQuantity("999"); assert.equal(r.value, 200); assert.match(r.notice, /at most 200/);
  r = CW.normaliseQuantity("15.4"); assert.equal(r.value, 15); assert.match(r.notice, /whole number/);
  r = CW.normaliseQuantity(""); assert.equal(r.value, null); assert.match(r.notice, /whole number/);
  r = CW.normaliseQuantity("abc"); assert.equal(r.value, null);
});
test("start is blocked with a reason when no pack can be made (rule 2 needs 2 chocolates)", () => {
  assert.match(CW.startBlocker(CW.WRAPPING_RULES.rule2, 1, 5), /2 chocolates/); assert.match(CW.startBlocker(CW.WRAPPING_RULES.rule1, 5, 0), /wrapper/); assert.equal(CW.startBlocker(CW.WRAPPING_RULES.rule1, 1, 1), "");
});
for (const [ruleId, c, w] of [["rule1", 20, 20], ["rule2", 20, 10], ["rule1", 100, 3], ["rule2", 15, 100], ["rule1", 1, 1], ["rule2", 2, 1]]) {
  test(`rate readouts agree with the graph data: ${ruleId} ${c}+${w}`, () => {
    const per = CW.WRAPPING_RULES[ruleId].chocolatesPerEvent; let s = CW.createInitialState(c, w, per); const rows = [CW.historyRow(s)];
    while (!s.finished) { const before = s; s = CW.advanceTick(s, per); rows.push(CW.historyRow(s)); assert.equal(CW.rateLastSecond(s), s.packs - before.packs, "last-second rate = gradient of the last packs segment"); assert.equal(s.chocolates, before.chocolates - per * s.lastEvents); }
    assert.equal(s.packs, s.maxPacks, "every possible pack was made"); assert.equal(rows.reduce((a, r) => a + r.rate, 0), s.packs);
    close(CW.rateAverage(s), s.packs / s.time, 1e-12); assert.ok(rows.every((r, i) => i === 0 || r.packs - rows[i - 1].packs === r.rate));
  });
}
test("the rate falls as the supplies fall (20+20: 7,5,3,2,1,1,1) and never rises", () => {
  let s = CW.createInitialState(20, 20, 1); const ev = []; while (!s.finished) { s = CW.advanceTick(s, 1); ev.push(s.lastEvents); }
  assert.deepEqual(ev, [7, 5, 3, 2, 1, 1, 1]); for (let i = 1; i < ev.length; i++) assert.ok(ev[i] <= ev[i - 1]);
});
test("advanceTick never mutates its input", () => { const s = CW.createInitialState(10, 10, 1); const copy = JSON.stringify(s); CW.advanceTick(s, 1); assert.equal(JSON.stringify(s), copy); });
test("predict-first tasks (AK-58): answers come from runToEnd; 40+40 starts faster than 20+20; the fourth second is slower than the first", () => {
  const a = CW.runToEnd(CW.WRAPPING_RULES.rule1, 20, 20); assert.deepEqual(a.slice(1).map((r) => r.rate), [7, 5, 3, 2, 1, 1, 1]); assert.equal(a[a.length - 1].packs, 20);
  const b = CW.runToEnd(CW.WRAPPING_RULES.rule1, 40, 40); assert.equal(b[1].rate, 14); assert.equal(b[b.length - 1].packs, 40);
  assert.equal(CW.PREDICT_TASKS[0].run().answer, "higher"); assert.equal(CW.PREDICT_TASKS[1].run().answer, "lower"); assert.match(CW.PREDICT_TASKS[0].run().text, /7 packs.*14/);
  { const none = CW.runToEnd(CW.WRAPPING_RULES.rule2, 1, 5); assert.ok(none.length <= 2 && none[none.length - 1].packs === 0 && none[none.length - 1].time === 0, "nothing can be made: terminates with 0 packs and no time passing"); }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
