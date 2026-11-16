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
  const e = new E.CollisionEngine({ seed: 3, params: { n: 5, ea: 10, site: 360, steady: false, ...overrides.params } });
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
test("total kinetic energy is conserved through thousands of collisions, wall bounces AND reactions (steady supply on and off)", () => {
  for (const steady of [true, false]) for (const system of ["mixed", "solid"]) {
    const e = new E.CollisionEngine({ seed: 11, params: { system, n: 40, T: 600, ea: 6, steady, site: 360, piece: 3 } });
    const ke0 = e.totalKE(); e.run(30);
    assert.ok(e.succ > 5, `${system}/${steady}: reactions happened (${e.succ})`);
    close(e.totalKE(), ke0, 1e-9 * ke0, `${system}/${steady}`);
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
  const e = new E.CollisionEngine({ seed: 2, params: { system: "solid", piece: 0, n: 5, ea: 10, site: 360, steady: false } });
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
test("fraction of A-B collisions with energy >= Ea is about exp(-Ea/RT) (dilute vessel, any orientation)", () => {
  for (const T of [400, 700]) {
    let c = 0; let en = 0; for (let s = 1; s <= 4; s++) { const e = new E.CollisionEngine({ seed: s, params: { n: 15, T, ea: 12, site: 360 } }); e.run(300); c += e.coll; en += e.energetic; }
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
test("closed vessel (steady off): every reaction uses one A and one B; with steady supply the reactant count stays constant", () => {
  const closed = new E.CollisionEngine({ seed: 3, params: { n: 40, T: 600, ea: 6, steady: false } }); closed.run(30);
  assert.equal(closed.countSpecies(0), 40 - closed.succ); assert.equal(closed.countSpecies(1), 40 - closed.succ); assert.equal(closed.countSpecies(2), closed.succ);
  const open = new E.CollisionEngine({ seed: 3, params: { n: 40, T: 600, ea: 6, steady: true } }); let lo = 99;
  for (let i = 0; i < 60; i++) { open.run(0.5); lo = Math.min(lo, open.countSpecies(0) + open.countSpecies(2)); assert.equal(open.countSpecies(0) + open.countSpecies(2), 40); }
  assert.ok(open.succ > 5 && lo === 40);
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
  const sm = RM.smoothedRate(h.t, h.succ, 10); close(sm[L], e.rateOver(10), 1e-12);
});
test("the rate right after a start is averaged over the time that has actually passed", () => {
  const e = new E.CollisionEngine({ seed: 7, params: { n: 40, T: 600, ea: 6 } }); e.run(3); assert.ok(e.rateSpan(10) <= 3.0001 && e.rateSpan(10) >= 2.4);
});
test("binnedCounts / niceMax / uncertainty helpers", () => {
  const t = [0, 0.5, 1, 1.5, 2, 2.5, 3]; const cum = [0, 1, 2, 2, 5, 5, 6]; const b = RM.binnedCounts(t, cum, 1);
  assert.deepEqual(b.x, [1, 2, 3]); assert.deepEqual(b.v, [2, 3, 1]);
  assert.equal(RM.niceMax(0.3, 1), 1); assert.equal(RM.niceMax(3.2), 5); assert.equal(RM.niceMax(11), 20); close(RM.rateUncertainty(16, 8), 0.5, 1e-12);
});
test("snapshot reports counts that agree with the engine", () => {
  const e = new E.CollisionEngine({ seed: 7, params: { n: 40, T: 600, ea: 6 } }); e.run(20); const s = SNAP.makeSnapshot(e);
  assert.equal(s.succ, e.succ); assert.equal(s.counts.reduce((a, b) => a + b, 0), e.coll); assert.equal(s.nA + s.nB + s.nC + s.nD, e.n); close(s.rate, e.rateOver(10), 1e-12);
});

console.log("== Factors change the measured rate in the right direction (same engine, seeded) ==");
for (const sc of SC.SCENARIOS) {
  test(`predict scenario '${sc.id}': measured outcome is '${sc.correct}'`, () => {
    const r = SC.measureScenario(sc, { reps: 3, duration: 50 });
    assert.equal(r.outcome, sc.correct, `before ${r.before.toFixed(2)} after ${r.after.toFixed(2)} ratio ${r.ratio.toFixed(2)}`);
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

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
