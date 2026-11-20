#!/usr/bin/env node
// Scientific tests for the Equilibrium Lab engine:  node scripts/test-equilibrium-model.mjs
// Covers the 15 test cases of docs/EQUILIBRIUM_LAB_SPEC.md part 22 (cases 13 and 14 live in test-equilibrium-store.mjs because they
// are about the reducer), plus atom conservation, stoichiometry, Q vs K, K invariance, van 't Hoff / Arrhenius consistency, the
// stochastic passenger model and the molecule bookkeeping.
import assert from "node:assert/strict";
import { REACTIONS, REACTION_IDS, GEOMETRY, atomsOf } from "../src/engines/equilibrium-lab/model/reactions.js";
import * as C from "../src/engines/equilibrium-lab/model/chem.js";
import * as K from "../src/engines/equilibrium-lab/model/kinetics.js";
import * as T from "../src/engines/equilibrium-lab/model/thermo.js";
import * as E from "../src/engines/equilibrium-lab/model/everyday.js";
import * as V from "../src/engines/equilibrium-lab/model/visual.js";
import { binomial } from "../src/engines/equilibrium-lab/model/rng.js";
import { R } from "../src/engines/equilibrium-lab/model/constants.js";

let passed = 0; let failed = 0;
async function test(name, fn) { try { await fn(); console.log(`  ok   ${name}`); passed += 1; } catch (e) { console.log(`  FAIL ${name}\n       ${(e.stack || e.message).split("\n").slice(0, 5).join("\n       ")}`); failed += 1; } }
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} expected ${b} +/- ${tol}, got ${a}`);
const rel = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol * Math.max(Math.abs(a), Math.abs(b), 1e-300), `${msg ?? ""} expected ${b} (rel ${tol}), got ${a}`);
const settle = (ch, t = 400) => { let s = ch; for (let i = 0; i < 40; i += 1) s = C.advanceChem(s, t / 40); return s; };
const equil = (ch) => C.equilibriumStatus(...(([x]) => [x.rf, x.rr])([C.chemSnapshot(ch)])).status;
const ab = (kf, kr) => C.createChem("ab", { kfRef: kf, krRef: kr });

console.log("Reaction data");
await test("every reaction balances: atoms in = atoms out for the stoichiometric equation", () => {
  for (const id of REACTION_IDS) {
    const rx = REACTIONS[id]; const net = {};
    for (const s of rx.species) for (const [el, k] of Object.entries(s.atoms)) net[el] = (net[el] ?? 0) + rx.nu[s.id] * k;
    for (const [el, v] of Object.entries(net)) assert.equal(v, 0, `${id}: ${el} imbalance ${v}`);
  }
});
await test("correct formulas and molecular compositions (N2O4 = 2 N + 4 O, NO2 = 1 N + 2 O, N2, H2, NH3, I2, HI)", () => {
  const at = (rid, sp) => atomsOf(REACTIONS[rid], sp);
  assert.deepEqual(at("n2o4", "N2O4"), { N: 2, O: 4 }); assert.deepEqual(at("n2o4", "NO2"), { N: 1, O: 2 });
  assert.deepEqual(at("haber", "N2"), { N: 2 }); assert.deepEqual(at("haber", "H2"), { H: 2 }); assert.deepEqual(at("haber", "NH3"), { N: 1, H: 3 });
  assert.deepEqual(at("hi", "I2"), { I: 2 }); assert.deepEqual(at("hi", "HI"), { H: 1, I: 1 });
  assert.deepEqual(at("fescn", "FeSCN"), { Fe: 1, S: 1, C: 1, N: 1 });
  assert.deepEqual(REACTIONS.n2o4.nu, { N2O4: -1, NO2: 2 }); assert.deepEqual(REACTIONS.haber.nu, { N2: -1, H2: -3, NH3: 2 });
});
await test("drawn molecules have exactly the atoms of their formula and sensible geometry (N2O4 planar O2N-NO2, NO2 bent, NH3 pyramidal, diatomics)", () => {
  for (const id of REACTION_IDS) for (const s of REACTIONS[id].species) {
    if (id === "ab") continue; const g = GEOMETRY[s.geom]; const count = {}; for (const a of g.atoms) count[a.el] = (count[a.el] ?? 0) + 1;
    assert.deepEqual(count, s.atoms, `${id}/${s.id} geometry atoms`);
  }
  const d = (g, i, j) => Math.hypot(g.atoms[i].x - g.atoms[j].x, g.atoms[i].y - g.atoms[j].y, g.atoms[i].z - g.atoms[j].z);
  const ang = (g, c, i, j) => { const a = g.atoms; const u = [a[i].x - a[c].x, a[i].y - a[c].y, a[i].z - a[c].z]; const v = [a[j].x - a[c].x, a[j].y - a[c].y, a[j].z - a[c].z]; const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2]; return (Math.acos(dot / (Math.hypot(...u) * Math.hypot(...v))) * 180) / Math.PI; };
  near(ang(GEOMETRY.NO2, 0, 1, 2), 134, 1.5, "NO2 O-N-O"); assert.notEqual(Math.round(ang(GEOMETRY.NO2, 0, 1, 2)), 180, "NO2 is bent, not linear");
  near(ang(GEOMETRY.NH3, 0, 1, 2), 107, 1.5, "NH3 H-N-H"); const nh3 = GEOMETRY.NH3.atoms; assert.ok(nh3.slice(1).every((h) => h.z < nh3[0].z), "NH3 H atoms below N: trigonal pyramid, not planar");
  near(d(GEOMETRY.N2, 0, 1), 1.10, 0.02, "N#N"); near(d(GEOMETRY.H2, 0, 1), 0.74, 0.02, "H-H"); near(d(GEOMETRY.I2, 0, 1), 2.67, 0.02, "I-I"); near(d(GEOMETRY.HI, 0, 1), 1.61, 0.02, "H-I");
  const n2o4 = GEOMETRY.N2O4; assert.equal(n2o4.bonds.filter(([i, j]) => n2o4.atoms[i].el === "N" && n2o4.atoms[j].el === "N").length, 1, "one N-N bond"); assert.ok(n2o4.atoms.every((a) => Math.abs(a.z) < 1e-9), "N2O4 planar");
  assert.equal(n2o4.bonds.filter(([i, j]) => (n2o4.atoms[i].el === "N") !== (n2o4.atoms[j].el === "N")).length, 4, "four N-O bonds");
  for (const m of ["N2", "H2", "I2", "HI"]) assert.equal(GEOMETRY[m].atoms.length, 2, `${m} diatomic`);
});

console.log("Thermodynamic parameters and consistency");
await test("literature K and dH values reproduce their sources (JANAF N2O4/NO2 at 298.15 K; JANAF NH3 at 600 K; Bodenstein HI fit; Below et al. FeSCN2+)", () => {
  const n = REACTIONS.n2o4; near(T.kStandard(n, 298.15), 0.1484, 0.001, "K-standard of N2O4 <=> 2NO2"); near(n.thermo.dH, 57111, 1, "dH"); near(T.kc(n, 298.15), 5.99e-3, 5e-5, "Kc mol/dm3");
  rel(T.kp(n, 298.15), T.kStandard(n, 298.15), 1e-9, "Kp (bar) equals K-standard numerically");
  const h = REACTIONS.haber; rel(T.kStandard(h, 600), Math.pow(10, -2.764), 0.01, "log10 K(600 K) = 2 x -1.382"); near(h.thermo.dH, -102748, 1);
  const hi = REACTIONS.hi; near(T.kStandard(hi, 700.15), 52.1, 0.05); near(hi.thermo.dH, -12170, 10); near(T.kStandard(hi, 700.15 + 0), 52.1, 0.1);
  near(T.kc(REACTIONS.fescn, 298.15), 146, 1e-9);
});
await test("van 't Hoff: endothermic -> K rises with T, exothermic -> K falls; matches d lnK/dT = dH/RT^2 numerically", () => {
  for (const id of ["n2o4", "haber", "hi", "ab"]) {
    const rx = REACTIONS[id]; const T0 = rx.run.T; const h = 0.01; const dln = (Math.log(T.kStandard(rx, T0 + h)) - Math.log(T.kStandard(rx, T0 - h))) / (2 * h);
    rel(dln, rx.thermo.dH / (R * T0 * T0), 1e-6, `${id} slope`);
    const hot = T.kStandard(rx, T0 + 50); const cold = T.kStandard(rx, T0 - 50); assert.equal(hot > cold, rx.thermo.dH > 0, id);
  }
  assert.ok(REACTIONS.n2o4.thermo.dH > 0 && REACTIONS.haber.thermo.dH < 0 && REACTIONS.hi.thermo.dH < 0);
});
await test("kr = kf / Kc at every temperature, with and without catalyst; catalyst lowers Ea of BOTH directions (same factor) and leaves K unchanged", () => {
  for (const id of REACTION_IDS) {
    const rx = REACTIONS[id]; const lo = rx.run.Tmin ?? rx.run.T; const hi = rx.run.Tmax ?? rx.run.T;
    for (const Tt of [lo, rx.run.T, hi]) {
      const a = T.rateConstants(rx, Tt, false); const b = T.rateConstants(rx, Tt, true);
      rel(a.kf / a.kr, a.Kc, 1e-12, `${id} T=${Tt}`); rel(b.kf / b.kr, b.Kc, 1e-12); rel(a.Kc, b.Kc, 1e-12, `${id}: catalyst leaves K unchanged`);
      if (rx.kinetics.catalystDEa > 0) { rel(b.kf / a.kf, b.kr / a.kr, 1e-12, `${id}: same speed-up forward and reverse`); assert.ok(b.kf > a.kf && b.kr > a.kr); }
    }
  }
});
await test("Arrhenius: forward rate constant rises with T; apparent Ea(reverse) = Ea(forward) - dH(+ dn RT term for Kc)", () => {
  for (const id of ["n2o4", "haber", "hi"]) {
    const rx = REACTIONS[id]; const T1 = rx.run.T; const T2 = T1 + 40;
    const a = T.rateConstants(rx, T1); const b = T.rateConstants(rx, T2);
    assert.ok(b.kf > a.kf); const Ef = -R * Math.log(b.kf / a.kf) / (1 / T2 - 1 / T1); rel(Ef, rx.kinetics.Ea, 1e-9, `${id} Ea fwd`);
  }
  const rx = REACTIONS.hi; const T1 = 700; const T2 = 800; const Er = -R * Math.log(T.rateConstants(rx, T2).kr / T.rateConstants(rx, T1).kr) / (1 / T2 - 1 / T1); rel(Er, rx.kinetics.Ea - rx.thermo.dH, 1e-9, "dn = 0: Ea(r) = Ea(f) - dH");
});
await test("Kc from K-standard uses the ideal-gas conversion: Kc = K (RT/p)^-dn (N2O4: dn=+1, Haber: dn=-2), Kp = Kc (RT)^dn", () => {
  const n = REACTIONS.n2o4; const Tn = 310; rel(T.kc(n, Tn), T.kStandard(n, Tn) / (0.08314462618 * Tn), 1e-9);
  const h = REACTIONS.haber; rel(T.kc(h, 600), T.kStandard(h, 600) * Math.pow(0.08314462618 * 600, 2), 1e-9);
});

console.log("Integrator");
await test("RK45 agrees with the exact A <=> B solution (rel. error < 1e-7) for several k and times", () => {
  for (const [kf, kr] of [[0.25, 1], [1, 1], [1, 0.25], [0.05, 2]]) {
    const ch = ab(kf, kr); const rx = REACTIONS.ab; const { kf: f, kr: r } = T.rateConstants(rx, ch.T, false, { kfRef: kf, krRef: kr });
    for (const t of [0.1, 1, 5, 30]) { const num = K.integrate(rx, ch.c, f, r, t).c; const ex = K.exactAB(1, 0, f, r, t); near(num.A, ex.A, 1e-7, `kf=${kf} t=${t}`); near(num.B, ex.B, 1e-7); }
  }
});
await test("RK45 error control: tightening rtol reduces the error; step count stays modest for a stiff-ish case", () => {
  const rx = REACTIONS.ab; const e = (rt) => Math.abs(K.integrate(rx, { A: 1, B: 0 }, 3, 7, 2, { rtol: rt, atol: rt * 1e-3 }).c.A - K.exactAB(1, 0, 3, 7, 2).A);
  assert.ok(e(1e-10) <= e(1e-4) + 1e-15); const r = K.integrate(rx, { A: 1, B: 0 }, 300, 700, 5); assert.ok(r.steps < 5000, `steps ${r.steps}`); near(r.c.A, K.exactAB(1, 0, 300, 700, 5).A, 1e-6);
});
await test("concentrations never go negative and stay finite, even from extreme starting points", () => {
  for (const id of REACTION_IDS) {
    const rx = REACTIONS[id]; for (const sp of rx.species) {
      let ch = C.createChem(id); ch = { ...ch, c: Object.fromEntries(rx.species.map((s) => [s.id, s.id === sp.id ? 1.5 : 0])) }; ch = { ...ch, atoms0: C.atomTotals(ch) };
      let s = ch; for (let i = 0; i < 60; i += 1) { s = C.advanceChem(s, 0.7); for (const v of Object.values(s.c)) assert.ok(v >= 0 && Number.isFinite(v), `${id} from pure ${sp.id}`); }
      assert.ok(C.atomConservationError(s) < 1e-9, `${id} from pure ${sp.id}: atoms`);
    }
  }
});

console.log("Specific test cases 1-3: A <=> B with K = 0.25, 1, 4");
for (const [n, kf, kr, K0, A, B] of [[1, 0.25, 1, 0.25, 0.8, 0.2], [2, 1, 1, 1, 0.5, 0.5], [3, 1, 0.25, 4, 0.2, 0.8]]) {
  await test(`case ${n}: K = ${K0}: deterministic equilibrium ${A * 100}/${B * 100}, Kc = [B]/[A], equal nonzero rates, Q -> K`, () => {
    let ch = ab(kf, kr); const s0 = C.chemSnapshot(ch); near(s0.Kc, K0, 1e-12); assert.ok(s0.rf > 0 && s0.rr === 0, "starts forward only"); assert.equal(s0.direction, "forward");
    ch = settle(ch, 80); near(ch.c.A, A, 1e-6); near(ch.c.B, B, 1e-6); const s = C.chemSnapshot(ch);
    near(s.Q, K0, 1e-5); rel(s.rf, s.rr, 1e-5); assert.ok(s.rf > 0.05, "rates stay positive"); assert.equal(s.status, "attained");
    near(ch.c.B / ch.c.A, kf / kr, 1e-5, "B_eq/A_eq = kf/kr");
  });
}
await test("equal rates do not mean equal amounts: A_eq = 80, B_eq = 20 gives 0.25 x 80 = 1.00 x 20 = 20 people per time unit", () => {
  const ev = E.createEveryday({ preset: "towardsA" }); const sn = E.everydaySnapshot({ ...ev, t: 60, det: { ...ev.det } }); near(sn.Aeq, 80, 1e-9); near(sn.Beq, 20, 1e-9);
  near(0.25 * 80, 20, 1e-12); near(1.0 * 20, 20, 1e-12); near(sn.rfDet, 20, 1e-6); near(sn.rrDet, 20, 1e-6); assert.equal(sn.status, "attained"); assert.notEqual(sn.A, sn.B);
});

console.log("Specific test cases 4-6: concentration disturbances at equilibrium (A <=> B, K = 0.25)");
const atEq = () => settle(ab(0.25, 1), 100);
await test("case 4: adding A at equilibrium: Q < K, forward rate > reverse rate at once, K unchanged, new equilibrium with A'+B' = 1.2", () => {
  const ch0 = atEq(); const K0 = C.chemSnapshot(ch0).Kc; const ch = C.addAmount(ch0, "A", 0.2); const s = C.chemSnapshot(ch);
  assert.ok(s.Q < s.Kc && s.direction === "forward"); assert.ok(s.rf > s.rr, "forward exceeds reverse"); near(s.rr, C.chemSnapshot(ch0).rr, 1e-12, "reverse rate initially unchanged");
  const end = settle(ch, 100); near(end.c.A + end.c.B, 1.2, 1e-9); near(end.c.B / end.c.A, 0.25, 1e-5); rel(C.chemSnapshot(end).Kc, K0, 1e-12); assert.ok(end.c.A > ch0.c.A && end.c.B > ch0.c.B);
});
await test("case 5: adding B at equilibrium: Q > K, reverse rate > forward rate at once, then a new equilibrium", () => {
  const ch0 = atEq(); const ch = C.addAmount(ch0, "B", 0.2); const s = C.chemSnapshot(ch);
  assert.ok(s.Q > s.Kc && s.direction === "reverse" && s.rr > s.rf); const end = settle(ch, 100); near(end.c.A + end.c.B, 1.2, 1e-9); near(end.c.B / end.c.A, 0.25, 1e-5);
});
await test("case 6: removing A, then B: the opposite shifts; removal cannot go below zero", () => {
  const ch0 = atEq(); let ch = C.removeAmount(ch0, "A", 0.3); let s = C.chemSnapshot(ch); assert.ok(s.Q > s.Kc && s.direction === "reverse");
  let end = settle(ch, 100); near(end.c.A + end.c.B, 0.7, 1e-9); near(end.c.B / end.c.A, 0.25, 1e-5);
  ch = C.removeAmount(ch0, "B", 0.1); s = C.chemSnapshot(ch); assert.ok(s.Q < s.Kc && s.direction === "forward"); end = settle(ch, 100); near(end.c.A + end.c.B, 0.9, 1e-9);
  const empty = C.removeAmount(C.removeAmount(ch0, "A", 99), "B", 99); assert.equal(empty.c.A, 0); assert.equal(empty.c.B, 0); assert.equal(C.chemSnapshot(empty).status, "empty");
  assert.ok(C.atomConservationError(C.removeAmount(ch0, "A", 0.3)) < 1e-12, "ledger-based atom check");
});

console.log("Specific test cases 7-10: temperature and volume");
const eqRx = (id, patch = null) => { let ch = C.createChem(id); if (patch) ch = patch(ch); return settle(ch, id === "fescn" ? 40 : 400); };
await test("case 7: N2O4 temperature increase: K rises (endothermic), Q unchanged at that instant so Q < K, net forward, more NO2; 1:2 stoichiometry", () => {
  const ch0 = eqRx("n2o4"); const s0 = C.chemSnapshot(ch0); const hot = C.setTemperature(ch0, 323.15); const s1 = C.chemSnapshot(hot);
  assert.ok(s1.Kc > s0.Kc * 2, "K increases strongly"); near(s1.Q, s0.Q, 1e-9 * s0.Q + 1e-12); assert.equal(s1.direction, "forward"); assert.ok(s1.kf > s0.kf && s1.kr !== s0.kr, "both rate constants change");
  const end = settle(hot, 400); assert.ok(end.c.NO2 > ch0.c.NO2 && end.c.N2O4 < ch0.c.N2O4); rel(C.chemSnapshot(end).Kc, s1.Kc, 1e-12);
  near((end.c.NO2 - ch0.c.NO2) / (end.c.N2O4 - ch0.c.N2O4), -2, 1e-6, "dNO2 : dN2O4 = -2");
  const cold = settle(C.setTemperature(ch0, 273.15), 600); assert.ok(cold.c.NO2 < ch0.c.NO2, "cooling favours N2O4");
  const rr = (a, b) => b.kr / a.kr; void rr;
});
await test("case 7b: exothermic reactions go the other way: heating Haber / HI lowers the product", () => {
  for (const [id, sp] of [["haber", "NH3"], ["hi", "HI"]]) { const ch0 = eqRx(id); const hot = settle(C.setTemperature(ch0, ch0.T + 100), 800); assert.ok(hot.c[sp] < ch0.c[sp], `${id}: heating lowers ${sp}`); }
});
await test("case 8: N2O4 volume decrease: every concentration doubles, Q rises to 2Q > K, reverse favoured, fewer gas molecules, more N2O4 by amount", () => {
  const ch0 = eqRx("n2o4"); const s0 = C.chemSnapshot(ch0); const sq = C.setVolume(ch0, ch0.V / 2); rel(sq.c.N2O4, 2 * ch0.c.N2O4, 1e-12); rel(sq.c.NO2, 2 * ch0.c.NO2, 1e-12);
  const s1 = C.chemSnapshot(sq); rel(s1.Q, 2 * s0.Q, 1e-9); assert.ok(s1.Q > s1.Kc && s1.direction === "reverse" && s1.rr > s1.rf); rel(s1.Kc, s0.Kc, 1e-12, "K unchanged by volume");
  const end = settle(sq, 400); assert.ok(end.c.NO2 * end.V < ch0.c.NO2 * ch0.V, "n(NO2) falls"); assert.ok(end.c.N2O4 * end.V > ch0.c.N2O4 * ch0.V, "n(N2O4) rises");
  rel(C.totalPressureBar(sq), 2 * C.totalPressureBar(ch0), 1e-9, "ideal gas: halving V doubles p at constant n, T");
  const big = settle(C.setVolume(ch0, ch0.V * 2), 400); assert.ok(big.c.NO2 * big.V > ch0.c.NO2 * ch0.V, "expansion favours the side with more gas moles (NO2)");
});
await test("case 9: Haber volume decrease: Q falls to Q/4 < K, forward favoured, more NH3; 1:3:2 changes; expansion favours N2 + H2", () => {
  const ch0 = eqRx("haber"); const s0 = C.chemSnapshot(ch0); const sq = C.setVolume(ch0, ch0.V / 2); const s1 = C.chemSnapshot(sq);
  rel(s1.Q, s0.Q / 4, 1e-9); assert.ok(s1.Q < s1.Kc && s1.direction === "forward" && s1.rf > s1.rr);
  const end = settle(sq, 800); const n = (ch) => ({ N2: ch.c.N2 * ch.V, H2: ch.c.H2 * ch.V, NH3: ch.c.NH3 * ch.V });
  const a = n(ch0); const b = n(end); assert.ok(b.NH3 > a.NH3); near((b.N2 - a.N2) / (b.NH3 - a.NH3), -0.5, 1e-6, "N2 : NH3 = 1 : 2"); near((b.H2 - a.H2) / (b.NH3 - a.NH3), -1.5, 1e-6, "H2 : NH3 = 3 : 2");
  const up = n(settle(C.setVolume(ch0, ch0.V * 2), 800)); assert.ok(up.NH3 < a.NH3 && up.N2 > a.N2 && up.H2 > a.H2);
});
await test("case 10: H2 + I2 <=> 2HI: volume change rescales concentrations but Q = K stays, the composition (amounts) does not shift, rates both change equally", () => {
  const ch0 = eqRx("hi"); const s0 = C.chemSnapshot(ch0); const sq = C.setVolume(ch0, ch0.V / 4); const s1 = C.chemSnapshot(sq);
  rel(s1.Q, s0.Q, 1e-9); assert.equal(s1.direction, "equilibrium"); rel(s1.rf / s1.rr, 1, 1e-6); assert.ok(s1.rf > 10 * s0.rf, "both rates rise (concentration up x4 -> rate up x16)");
  const end = settle(sq, 300); for (const id of Object.keys(ch0.c)) rel(end.c[id] * end.V, ch0.c[id] * ch0.V, 1e-6, `${id} amount unchanged`);
  const big = C.setVolume(ch0, ch0.V * 4); near(C.chemSnapshot(big).Q, s0.Q, 1e-9 * s0.Q);
});

console.log("Specific test cases 11-12: catalyst");
await test("case 11: catalyst before equilibrium: reaches equilibrium sooner, same K, same final composition", () => {
  const timeTo = (ch) => { let s = ch; let t = 0; while (t < 2000) { s = C.advanceChem(s, 0.05); t += 0.05; if (C.chemSnapshot(s).status === "attained") return { t, s }; } return { t, s }; };
  for (const id of ["n2o4", "haber", "hi"]) {
    const plain = timeTo(C.createChem(id)); const cat = timeTo(C.setCatalyst(C.createChem(id), true));
    assert.ok(cat.t < plain.t / 2, `${id}: catalyst ${cat.t} vs ${plain.t}`);
    const a = settle(plain.s, 3000); const b = settle(cat.s, 3000); for (const sp of Object.keys(a.c)) near(b.c[sp], a.c[sp], 1e-6 * Math.max(1, a.c[sp]) + 1e-9, `${id}/${sp} final`);
    rel(C.chemSnapshot(a).Kc, C.chemSnapshot(b).Kc, 1e-12);
  }
});
await test("case 12: catalyst added AT equilibrium: both rates jump by the same factor and stay equal; concentrations unchanged; Q = K", () => {
  for (const id of ["n2o4", "haber", "hi", "ab"]) {
    const ch0 = eqRx(id); const s0 = C.chemSnapshot(ch0); const ch = C.setCatalyst(ch0, true); const s1 = C.chemSnapshot(ch);
    assert.ok(s1.rf > 1.5 * s0.rf && s1.rr > 1.5 * s0.rr, `${id}: rates rise`); rel(s1.rf / s0.rf, s1.rr / s0.rr, 1e-6); rel(s1.rf, s1.rr, 1e-5); assert.equal(s1.status, "attained");
    const later = settle(ch, 100); for (const sp of Object.keys(ch0.c)) near(later.c[sp], ch0.c[sp], 1e-7 * Math.max(1, ch0.c[sp]), `${id}/${sp}`);
    const removed = C.setCatalyst(later, false); rel(C.chemSnapshot(removed).rf, s0.rf, 1e-5, "removing it restores the rates");
  }
});

console.log("Specific test case 15: long-duration stability");
await test("case 15: 20 000 time units for every reaction (also hot, with catalyst): constant composition, no NaN, atoms conserved, no negative values", () => {
  for (const id of REACTION_IDS) {
    let ch = C.createChem(id); if (REACTIONS[id].controls.catalyst) ch = C.setCatalyst(ch, true);
    ch = settle(ch, 200); const ref = { ...ch.c }; const t0 = Date.now();
    for (let i = 0; i < 400; i += 1) { ch = C.advanceChem(ch, 50); for (const v of Object.values(ch.c)) assert.ok(v >= 0 && Number.isFinite(v)); }
    for (const sp of Object.keys(ref)) near(ch.c[sp], ref[sp], 1e-8 * Math.max(1, ref[sp]) + 1e-10, `${id}/${sp} drifted`);
    assert.ok(C.atomConservationError(ch) < 1e-9, `${id} atoms`); assert.ok(Date.now() - t0 < 20000, `${id} too slow`);
  }
});
await test("the equilibrium composition found by the ODE equals the independent root-finder (solveEquilibrium) for every reaction", () => {
  for (const id of REACTION_IDS) { const ch = C.createChem(id); const root = C.solveEquilibrium(ch); const end = settle(ch, 600); for (const sp of Object.keys(ch.c)) near(end.c[sp], root.c[sp], 2e-7 * Math.max(1, root.c[sp]), `${id}/${sp}`); }
});

console.log("Atom conservation, stoichiometry, Q vs K");
await test("atoms are conserved through every reaction and every disturbance (ledger of added / removed species)", () => {
  for (const id of REACTION_IDS) {
    const rx = REACTIONS[id]; let ch = C.createChem(id); const sp = rx.species;
    ch = C.advanceChem(ch, 2); ch = C.addAmount(ch, sp[0].id, rx.run.steps[sp[0].id]); ch = C.advanceChem(ch, 3); ch = C.removeAmount(ch, sp[sp.length - 1].id, rx.run.steps[sp[sp.length - 1].id]);
    if (rx.controls.volume) ch = C.setVolume(ch, ch.V / 2); if (rx.controls.temperature) ch = C.setTemperature(ch, ch.T + rx.run.Tstep); if (rx.controls.catalyst) ch = C.setCatalyst(ch, true);
    ch = C.advanceChem(ch, 20); assert.ok(C.atomConservationError(ch) < 1e-10, `${id}: ${C.atomConservationError(ch)}`);
  }
});
await test("concentration changes obey the stoichiometric ratios during relaxation (dc_i / dc_j = nu_i / nu_j)", () => {
  for (const id of REACTION_IDS) {
    const rx = REACTIONS[id]; const ch0 = C.createChem(id); const ch1 = C.advanceChem(ch0, 3); const ids = Object.keys(rx.nu); const ref = ids[0]; const dRef = ch1.c[ref] - ch0.c[ref]; assert.ok(Math.abs(dRef) > 0);
    for (const sp of ids) near((ch1.c[sp] - ch0.c[sp]) / dRef, rx.nu[sp] / rx.nu[ref], 1e-8, `${id}/${sp}`);
  }
  const n = C.advanceChem(C.createChem("n2o4"), 2); near((n.c.NO2 - 0) / (0.1 - n.c.N2O4), 2, 1e-9);
});
await test("Q vs K gives the direction of net reaction and matches the rate comparison (r_f / r_r = K / Q) for every reaction and many states", () => {
  for (const id of REACTION_IDS) {
    const rx = REACTIONS[id]; let ch = C.createChem(id); ch = C.advanceChem(ch, 1);
    for (const [spId, f] of [[rx.species[0].id, 1.7], [rx.species.at(-1).id, 3.1], [rx.species[0].id, 0.2]]) {
      const c2 = { ...ch, c: { ...ch.c, [spId]: Math.max(1e-6, ch.c[spId] * f) } }; const s = C.chemSnapshot(c2);
      rel(s.rf / s.rr, s.Kc / s.Q, 1e-9, `${id}: rf/rr = K/Q`); assert.equal(s.direction, s.Q < s.Kc ? "forward" : s.Q > s.Kc ? "reverse" : "equilibrium"); assert.equal(s.rf > s.rr, s.Q < s.Kc);
    }
  }
});
await test("K is unchanged by every concentration change and by a catalyst; only temperature changes it", () => {
  for (const id of REACTION_IDS) {
    const rx = REACTIONS[id]; const ch0 = C.createChem(id); const K0 = C.chemSnapshot(ch0).Kc;
    let ch = C.addAmount(ch0, rx.species[0].id, 0.1 * rx.run.unit * 10); ch = C.removeAmount(ch, rx.species.at(-1).id, 0.01); ch = C.advanceChem(ch, 5); rel(C.chemSnapshot(ch).Kc, K0, 1e-12, `${id} concentration`);
    if (rx.controls.catalyst) rel(C.chemSnapshot(C.setCatalyst(ch0, true)).Kc, K0, 1e-12, `${id} catalyst`);
    if (rx.controls.volume) rel(C.chemSnapshot(C.setVolume(ch0, 0.5)).Kc, K0, 1e-12, `${id} volume`);
    if (rx.controls.temperature) assert.notEqual(C.chemSnapshot(C.setTemperature(ch0, ch0.T + 50)).Kc, K0, `${id} temperature changes K`);
  }
});
await test("Q edge cases: Q = 0 with no product, Infinity with product but no reactant, NaN when empty; direction text stays defined", () => {
  const rx = REACTIONS.ab; assert.equal(K.reactionQuotient(rx, { A: 1, B: 0 }), 0); assert.equal(K.reactionQuotient(rx, { A: 0, B: 1 }), Infinity); assert.ok(Number.isNaN(K.reactionQuotient(rx, { A: 0, B: 0 })));
  assert.equal(C.netDirection(NaN, 1, 0, 0), "none"); assert.equal(C.netDirection(Infinity, 1, 0, 1), "reverse"); assert.equal(C.netDirection(0, 1, 1, 0), "forward");
});
await test("equilibrium indicator uses tolerances: 0.5% mismatch is attained, 5% near, 50% approaching, never exact equality", () => {
  assert.equal(C.equilibriumStatus(1, 1.005).status, "attained"); assert.equal(C.equilibriumStatus(1, 1.05).status, "near"); assert.equal(C.equilibriumStatus(1, 1.5).status, "approaching"); assert.equal(C.equilibriumStatus(0, 0).status, "empty"); assert.equal(C.equilibriumStatus(5, 0).status, "approaching");
});

console.log("Everyday (stochastic passenger) model");
await test("starts with 100 in A, 0 in B; forward transfer begins at once; reverse emerges as soon as B has people", () => {
  let ev = E.createEveryday({ preset: "center" }); assert.equal(ev.A, 100); assert.equal(ev.B, 0);
  let firstF = null; let firstR = null;
  for (let i = 0; i < 4000 && (firstF === null || firstR === null); i += 1) { ev = E.advanceEveryday(ev, 0.005); if (firstF === null && ev.nF > 0) firstF = ev.t; if (firstR === null && ev.nR > 0) firstR = ev.t; }
  assert.ok(firstF !== null && firstF < 0.1, `forward starts at t=${firstF}`); assert.ok(firstR !== null && firstR > firstF, "reverse only after forward"); assert.ok(firstR < 0.5, `reverse emerges promptly (${firstR})`);
});
await test("presets: deterministic equilibria are exactly 80/20, 50/50 and 20/80 and the stochastic time-average matches", () => {
  for (const [p, A, B] of [["towardsA", 80, 20], ["center", 50, 50], ["towardsB", 20, 80]]) {
    let ev = E.createEveryday({ preset: p }); const sn = E.everydaySnapshot({ ...ev, t: 100 }); near(sn.Aeq, A, 1e-9); near(sn.Beq, B, 1e-9);
    ev = E.advanceEveryday(ev, 20); let sumA = 0; let n = 0; for (let i = 0; i < 40000; i += 1) { ev = E.advanceEveryday(ev, 0.02); sumA += ev.A; n += 1; }
    near(sumA / n, A, 1.2, `${p}: mean A`); assert.equal(ev.A + ev.B, 100);
  }
});
await test("total population conserved, populations never negative or fractional, over many seeds and tiny to huge steps (SSA and tau-leaping)", () => {
  for (const seed of [1, 7, 12345, 99999]) for (const [kf, kr, dt] of [[0.25, 1, 0.01], [1, 0.25, 0.3], [2, 2, 5], [30, 40, 2]]) {
    let ev = E.createEveryday({ kf, kr, A: 100, B: 0, seed }); for (let i = 0; i < 200; i += 1) { ev = E.advanceEveryday(ev, dt); assert.ok(Number.isInteger(ev.A) && Number.isInteger(ev.B) && ev.A >= 0 && ev.B >= 0 && ev.A + ev.B === 100, `seed ${seed} kf ${kf} dt ${dt}`); }
  }
});
await test("a city with nobody in it never sends anybody: with A = 0 only the reverse bus can run, and vice versa", () => {
  let ev = E.createEveryday({ kf: 1, kr: 1, A: 0, B: 5, seed: 3 }); const before = ev.nF; ev = E.advanceEveryday(ev, 0.0001); assert.equal(ev.nF, before); ev = E.createEveryday({ kf: 1, kr: 1, A: 0, B: 0, seed: 3 }); ev = E.advanceEveryday(ev, 100); assert.equal(ev.A + ev.B, 0); assert.equal(ev.nF + ev.nR, 0);
});
await test("deterministic seeds: same seed -> identical run; different seed -> different run; independent of how time is chunked", () => {
  const run = (seed, dts) => { let ev = E.createEveryday({ preset: "towardsA", seed }); for (const dt of dts) ev = E.advanceEveryday(ev, dt); return ev; };
  const a = run(5, Array(200).fill(0.05)); const b = run(5, Array(200).fill(0.05)); const c = run(6, Array(200).fill(0.05)); const d = run(5, Array(100).fill(0.1)); const e = run(5, Array(1000).fill(0.01));
  assert.deepEqual([a.A, a.B, a.nF, a.nR], [b.A, b.B, b.nF, b.nR]); assert.notDeepEqual([a.nF, a.nR], [c.nF, c.nR]); assert.deepEqual([a.A, a.nF, a.nR], [d.A, d.nF, d.nR]); assert.deepEqual([a.A, a.nF, a.nR], [e.A, e.nF, e.nR]);
});
await test("the mean field is the exact expectation: mean over many seeds tracks A(t) = A_eq + (A0 - A_eq) exp(-(kf+kr)t)", () => {
  const t = 1.0; let sum = 0; const N = 600; for (let seed = 1; seed <= N; seed += 1) { let ev = E.createEveryday({ preset: "towardsB", seed: seed * 17 }); ev = E.advanceEveryday(ev, t); sum += ev.A; }
  const ex = K.exactAB(100, 0, 1, 0.25, t); near(sum / N, ex.A, 1.2, "ensemble mean vs exact");
});
await test("disturbances: adding people to A at equilibrium raises the forward rate immediately, reverse unchanged; the system readjusts to the new equilibrium", () => {
  let ev = E.createEveryday({ preset: "towardsA", seed: 11 }); ev = E.advanceEveryday(ev, 30); const before = E.everydaySnapshot(ev);
  const r = E.changePeople(ev, "A", 20); assert.equal(r.moved, 20); const sn = E.everydaySnapshot(r.ev); assert.ok(sn.rfDet > before.rfDet + 4, "forward up"); near(sn.rrDet, before.rrDet, 1e-9, "reverse unchanged at that instant"); assert.ok(sn.rfDet > sn.rrDet);
  let e2 = r.ev; e2 = E.advanceEveryday(e2, 30); const after = E.everydaySnapshot(e2); near(after.Aeq, 96, 1e-9); near(after.Beq, 24, 1e-9); assert.equal(after.status, "attained"); assert.equal(e2.A + e2.B, 120);
  const rm = E.changePeople(e2, "A", -20); assert.equal(rm.moved, -20); assert.ok(E.everydaySnapshot(rm.ev).rrDet > E.everydaySnapshot(rm.ev).rfDet, "removing from A: reverse exceeds forward");
  const over = E.changePeople(E.createEveryday({ A: 3, B: 0 }), "A", -20); assert.equal(over.moved, -3, "cannot remove more people than are there"); assert.equal(over.ev.A, 0);
});
await test("measured event rates agree with the modelled rates at equilibrium (time-averaged, not instantaneous trips)", () => {
  let ev = E.createEveryday({ preset: "towardsA", seed: 21 }); ev = E.advanceEveryday(ev, 30); let f = 0; let r = 0; const n0f = ev.nF; const n0r = ev.nR; ev = E.advanceEveryday(ev, 400); f = (ev.nF - n0f) / 400; r = (ev.nR - n0r) / 400;
  near(f, 20, 1.0, "mean forward"); near(r, 20, 1.0, "mean reverse"); near(f - r, 0, 0.5, "equal on average");
});
await test("binomial sampler stays in range and has the right mean", () => {
  let seed = 3; let sum = 0; for (let i = 0; i < 2000; i += 1) { const r = binomial(200, 0.3, seed); seed = r.seed; assert.ok(r.value >= 0 && r.value <= 200); sum += r.value; } near(sum / 2000, 60, 1.5);
  assert.equal(binomial(5, 0, 1).value, 0); assert.equal(binomial(5, 1, 1).value, 5);
});

console.log("Molecule picture bookkeeping");
await test("every drawn event is stoichiometric: element totals of the drawn molecules never change between disturbances; counts are never negative; the picture follows the engine to within 2 events", () => {
  for (const id of REACTION_IDS) {
    const rx = REACTIONS[id]; let ch = C.createChem(id); let v = V.createVisual(ch); const a0 = V.visualAtoms(v); let events = 0; let worst = 0;
    for (let i = 0; i < 1800; i += 1) {
      ch = C.advanceChem(ch, (1 / 60) * rx.playback); const o = V.stepVisual(v, ch, C.chemSnapshot(ch), 1 / 60, rx.playback); v = o.v; events += o.events.length;
      assert.deepEqual(V.visualAtoms(v), a0, `${id}: drawn atoms changed`); for (const m of Object.values(V.visualCounts(v))) assert.ok(Number.isInteger(m) && m >= 0); worst = Math.max(worst, Math.abs(V.targetExtent(v, ch) - v.xi));
    }
    assert.ok(events > 20, `${id}: some events drawn`); assert.ok(worst < 2.5, `${id}: drift ${worst}`);
  }
});
await test("dynamic equilibrium is visible: at equilibrium both forward and reverse events keep being drawn, in proportion to the engine's rates", () => {
  const rx = REACTIONS.ab; let ch = settle(ab(1, 1), 60); let v = V.createVisual(ch); let f = 0; let r = 0;
  for (let i = 0; i < 3600; i += 1) { const o = V.stepVisual(v, ch, C.chemSnapshot(ch), 1 / 60, rx.playback); v = o.v; for (const e of o.events) { if (e.dir === "f") f += 1; else r += 1; } }
  assert.ok(f > 30 && r > 30, `forward ${f} reverse ${r}`); assert.ok(Math.abs(f - r) <= 0.25 * (f + r), "balanced when rf = rr");
});
await test("a disturbance is folded into the integer counts with the right number of molecules and re-anchors without events", () => {
  let ch = C.createChem("n2o4"); let v = V.createVisual(ch); const before = V.visualCounts(v); ch = C.addAmount(ch, "N2O4", 0.05); v = V.visualDisturbed(v, ch, "N2O4", 0.05); const after = V.visualCounts(v);
  assert.equal(after.N2O4 - before.N2O4, 10, "0.05 mol = 10 drawn molecules at 0.005 mol each"); assert.equal(v.xi, 0);
  const snapped = V.snapVisual(V.createVisual(settle(C.createChem("haber"), 600)), settle(C.createChem("haber"), 600)); void snapped;
});

console.log("CHANGED: smooth (expected-population) display, random fluctuations optional");
await test("CHANGED: smooth display: presets settle to EXACTLY 80/20, 50/50 and 20/80 and the counters then never change (0 change over 200 further ticks)", () => {
  for (const [p, A, B] of [["towardsA", 80, 20], ["center", 50, 50], ["towardsB", 20, 80]]) {
    let ev = E.createEveryday({ preset: p, seed: 4 }); let prev = E.expectedPopulation(ev); assert.deepEqual(prev, { A: 100, B: 0 });
    let settledAt = null; let changesAfter = 0;
    for (let i = 0; i < 4000; i += 1) {
      ev = E.advanceEveryday(ev, 0.05); const x = E.expectedPopulation(ev); assert.equal(x.A + x.B, 100, "total constant");
      if (x.A !== prev.A) { if (settledAt !== null) changesAfter += 1; settledAt = null; } if (settledAt === null && x.A === A && x.B === B) settledAt = ev.t; prev = x;
    }
    assert.ok(settledAt !== null && settledAt < 30, `${p}: settles to ${A}/${B} by t=${settledAt}`); assert.deepEqual(prev, { A, B }); assert.equal(changesAfter, 0, `${p}: counter changed after settling`);
  }
});
await test("CHANGED: smooth counters move monotonically (no back-and-forth) from 100/0 to equilibrium, whatever the random seed", () => {
  for (const seed of [1, 2, 3]) for (const p of ["towardsA", "center", "towardsB"]) {
    let ev = E.createEveryday({ preset: p, seed }); let last = 100; for (let i = 0; i < 1500; i += 1) { ev = E.advanceEveryday(ev, 0.05); const a = E.expectedPopulation(ev).A; assert.ok(a <= last, `${p} seed ${seed}: A went up ${last} -> ${a}`); last = a; }
  }
});
await test("CHANGED: the smooth display does not depend on the random seed at all (same numbers for any seed)", () => {
  const run = (seed) => { let ev = E.createEveryday({ preset: "towardsA", seed }); const out = []; for (let i = 0; i < 100; i += 1) { ev = E.advanceEveryday(ev, 0.1); out.push(E.expectedPopulation(ev).A); } return out; };
  assert.deepEqual(run(1), run(999));
});
await test("CHANGED: smooth display after a disturbance: +20 in A jumps the counter by 20, then settles to exactly 96/24 and stays", () => {
  let ev = E.createEveryday({ preset: "towardsA", seed: 9 }); ev = E.advanceEveryday(ev, 40); assert.deepEqual(E.expectedPopulation(ev), { A: 80, B: 20 });
  ev = E.changePeople(ev, "A", 20).ev; assert.deepEqual(E.expectedPopulation(ev), { A: 100, B: 20 }); let prev = null; for (let i = 0; i < 1000; i += 1) { ev = E.advanceEveryday(ev, 0.05); prev = E.expectedPopulation(ev); }
  assert.deepEqual(prev, { A: 96, B: 24 }); const again = E.expectedPopulation(E.advanceEveryday(ev, 5)); assert.deepEqual(again, prev);
});
await test("CHANGED: stochastic mode still conserves people and fluctuates around the mean with the predicted spread (SD = sqrt(N p q))", () => {
  let ev = E.createEveryday({ preset: "towardsA", seed: 77 }); ev = E.advanceEveryday(ev, 20); const xs = []; let distinct = new Set();
  for (let i = 0; i < 30000; i += 1) { ev = E.advanceEveryday(ev, 0.05); assert.equal(ev.A + ev.B, 100); xs.push(ev.A); distinct.add(ev.A); }
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length; const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
  near(mean, 80, 1.0, "mean"); near(sd, E.fluctuationSD(ev), 0.8, "SD"); near(E.fluctuationSD(ev), 4, 1e-9); assert.ok(distinct.size > 8, "the random counts really do fluctuate");
  const smooth = new Set(); for (let i = 0; i < 200; i += 1) { ev = E.advanceEveryday(ev, 0.05); smooth.add(E.expectedPopulation(ev).A); } assert.equal(smooth.size, 1, "smooth counter constant while the random one moves");
});
await test("CHANGED: drawn molecule COUNTS are constant at equilibrium (A <=> B, N2O4, Haber, HI, Fe/SCN) while forward AND reverse events keep being drawn in pairs", () => {
  for (const id of REACTION_IDS) {
    const rx = REACTIONS[id]; const ch = settle(C.createChem(id), id === "fescn" ? 120 : 600); let v = V.snapVisual(V.createVisual(ch), ch); v = { ...v }; const c0 = JSON.stringify(V.visualCounts(v)); let f = 0; let r = 0; const snap = C.chemSnapshot(ch);
    for (let i = 0; i < 3600; i += 1) { const o = V.stepVisual(v, ch, snap, 1 / 60, rx.playback); v = o.v; for (const e of o.events) { if (e.dir === "f") f += 1; else r += 1; } assert.equal(JSON.stringify(V.visualCounts(v)), c0, `${id}: counts changed at step ${i}`); }
    assert.ok(f > 0 && f === r, `${id}: paired events f=${f} r=${r}`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
