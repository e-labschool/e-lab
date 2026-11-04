#!/usr/bin/env node
// Pure tests for the single-workspace NMR experience (no DOM, no React):  node scripts/test-nmr-steps.mjs
//   step state machine and store, field slider consistency (dE / nu0 / text), continuous-wave resonance-response model (checked against the
//   Bloch integrator), neighbouring-spin-state counting, and the molecule FID (derived from the molecular signals) with its real FFT.
import assert from "node:assert/strict";
import * as SM from "../src/engines/spectroscopy-studio/state/stepMachine.js";
import * as ST from "../src/engines/spectroscopy-studio/state/studioState.js";
import * as C from "../src/engines/spectroscopy-studio/nmr/physics/constants.js";
import * as P from "../src/engines/spectroscopy-studio/nmr/physics/populations.js";
import * as F from "../src/engines/spectroscopy-studio/nmr/physics/fieldModel.js";
import * as CW from "../src/engines/spectroscopy-studio/nmr/physics/cwResponse.js";
import * as B from "../src/engines/spectroscopy-studio/nmr/physics/blochSim.js";
import * as FID from "../src/engines/spectroscopy-studio/nmr/physics/fid.js";
import * as SS from "../src/engines/spectroscopy-studio/nmr/molecular/model/spinStates.js";
import * as MF from "../src/engines/spectroscopy-studio/nmr/molecular/model/moleculeFid.js";
import * as SP from "../src/engines/spectroscopy-studio/nmr/molecular/model/spectrum.js";
import { MOLECULES, getMolecule } from "../src/engines/spectroscopy-studio/nmr/molecular/model/molecules.js";

let passed = 0; let failed = 0;
function test(name, fn) { try { fn(); console.log(`  ok   ${name}`); passed += 1; } catch (e) { console.log(`  FAIL ${name}\n       ${(e.stack || e.message).split("\n").slice(0, 5).join("\n       ")}`); failed += 1; } }
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} expected ${b} +/- ${tol}, got ${a}`);
const rel = (a, b, r, msg) => assert.ok(Math.abs(a - b) <= r * Math.abs(b), `${msg ?? ""} expected ${b} within ${r * 100}%, got ${a}`);

console.log("Step state machine");
test("six steps in the specified order, with the specified titles", () => {
  assert.deepEqual(SM.STEPS.map((s) => s.n), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(SM.STEPS.map((s) => s.title), ["Explore a Hydrogen Nucleus", "Apply the Magnetic Field", "Send Radiofrequency Radiation", "Explore the NMR Instrument", "Generate the Spectrum", "Introduce Molecules and Interpret NMR"]);
});
test("Previous / Next stop at the ends (no wrap), direct selection reaches every step", () => {
  let n = { step: 1, sub: "environments", op: 0 };
  assert.equal(SM.navigate(n, { type: "prev" }), n, "no change returns the same reference");
  for (let i = 2; i <= 6; i += 1) { n = SM.navigate(n, { type: "next" }); assert.equal(n.step, i); }
  assert.equal(SM.navigate(n, { type: "next" }), n);
  for (let s = 1; s <= 6; s += 1) assert.equal(SM.navigate(n, { type: "goto", step: s }).step, s);
  assert.equal(SM.navigate(n, { type: "goto", step: 99 }).step, 6); assert.equal(SM.navigate(n, { type: "goto", step: -3 }).step, 1);
  assert.equal(SM.canPrev({ step: 1 }), false); assert.equal(SM.canNext({ step: 6 }), false); assert.equal(SM.canNext({ step: 3 }), true);
});
test("the three levels (step, sub-stage, instrument operation) are independent", () => {
  const n0 = { step: 4, sub: "shift", op: 3 };
  assert.deepEqual(SM.navigate(n0, { type: "next" }), { step: 5, sub: "shift", op: 3 });
  assert.deepEqual(SM.navigate(n0, { type: "subNext" }), { step: 4, sub: "integration", op: 3 });
  assert.deepEqual(SM.navigate(n0, { type: "opNext" }), { step: 4, sub: "shift", op: 4 });
});
test("sub-stages run environments -> shift -> integration -> coupling and stop at the ends; operations run 0..5", () => {
  assert.deepEqual(SM.SUB_IDS, ["environments", "shift", "integration", "coupling"]);
  let n = { step: 6, sub: "environments", op: 0 };
  for (const want of ["shift", "integration", "coupling", "coupling"]) { n = SM.navigate(n, { type: "subNext" }); assert.equal(n.sub, want); }
  assert.equal(SM.navigate({ step: 6, sub: "environments", op: 0 }, { type: "subPrev" }).sub, "environments");
  assert.equal(SM.navigate(n, { type: "subGoto", sub: "bogus" }), n);
  assert.deepEqual(SM.OPS.map((o) => o.id), ["insert", "field", "pulse", "detect", "fid", "ft"]);
  let m = { step: 4, sub: "environments", op: 0 }; for (let i = 0; i < 9; i += 1) m = SM.navigate(m, { type: "opNext" }); assert.equal(m.op, 5);
  assert.equal(SM.navigate({ step: 4, sub: "environments", op: 0 }, { type: "opPrev" }).op, 0);
});
test("store: direct step jumps and Previous / Next keep the molecule, B0 and the other settings", () => {
  const s = ST.createStudioStore();
  s.setMolecule("propan-1-ol"); s.setB0(12); s.setMode("teacher"); s.setSpeed(0.5); s.patch("field", { applied: true });
  const keep = () => { const x = s.getState(); return [x.moleculeId, x.b0Tesla, x.mode, x.speed, x.field.applied, x.rf.rfMHz].join("|"); };
  const before = keep();
  for (const n of [6, 1, 4, 3, 5, 2]) { s.setStep(n); assert.equal(s.getState().step, n); assert.equal(keep(), before, `after jump to ${n}`); }
  s.nextStep(); s.nextStep(); s.prevStep(); assert.equal(keep(), before);
});
test("store: persisted slice round-trips through sanitize and survives bad input", () => {
  const s = ST.createStudioStore(); s.setMolecule("ethanol"); s.setStep(6); s.setSub("coupling"); s.setOp(4); s.setB0(11.3);
  const saved = JSON.parse(JSON.stringify(ST.pickPersisted(s.getState())));
  const t = ST.createStudioStore(saved).getState();
  assert.equal(t.step, 6); assert.equal(t.sub, "coupling"); assert.equal(t.instrument.op, 4); assert.equal(t.moleculeId, "ethanol"); assert.equal(t.b0Tesla, 11.3);
  const bad = ST.sanitize({ step: 99, sub: "x", b0Tesla: 500, moleculeId: "nope", speed: 7, instrument: { op: -4 }, rf: { rfMHz: 5 }, mol: { identified: { ethanol: ["a", "zzz"], nope: ["a"] } } });
  assert.equal(bad.step, 6); assert.equal(bad.sub, "environments"); assert.equal(bad.b0Tesla, 14); assert.equal(bad.moleculeId, null); assert.equal(bad.speed, 1); assert.equal(bad.instrument.op, 0);
  assert.deepEqual(bad.mol.identified, { ethanol: ["a"] }); assert.ok(Math.abs(CW.rfOffsetHz(bad.rf.rfMHz, bad.b0Tesla)) <= CW.CW_SPAN_HZ + 1);
});
test("store: Reset restarts the animations but keeps molecule and B0; the full reset returns the defaults but keeps step and mode", () => {
  const s = ST.createStudioStore(); s.setMolecule("ethanol"); s.setB0(7); s.setStep(5); s.setMode("teacher"); s.setPaused(true);
  s.resetPlayback(); assert.equal(s.getState().paused, false); assert.equal(s.getState().moleculeId, "ethanol"); assert.equal(s.getState().b0Tesla, 7);
  s.resetExperiment(); assert.equal(s.getState().moleculeId, null); assert.equal(s.getState().b0Tesla, C.B0_DEFAULT); assert.equal(s.getState().step, 5); assert.equal(s.getState().mode, "teacher");
});
test("technique tabs: Mass Spec | IR | NMR | Structure Investigation (no separate Splitting Patterns tab)", () => {
  assert.deepEqual(ST.TECHNIQUES.map((t) => t.id), ["ms", "ir", "nmr", "structure"]); assert.deepEqual(ST.TECHNIQUES.map((t) => t.developed), [false, false, true, false]);
});

console.log("Field slider: dE, nu0 and the text agree");
test("for every B0 on the slider: nu0 = gamma B0 / 2 pi, dE = h nu0, and the strings are those numbers", () => {
  for (let b = C.B0_MIN; b <= C.B0_MAX + 1e-9; b += 0.1) {
    const r = F.fieldReadouts(Math.round(b * 10) / 10);
    rel(r.nu0Hz, (C.GAMMA_H1 * r.b0Tesla) / (2 * Math.PI), 1e-12); rel(r.dEJ, C.H_PLANCK * r.nu0Hz, 1e-12); rel(r.dEJ, C.GAMMA_H1 * C.HBAR * r.b0Tesla, 1e-12);
    assert.equal(r.text.nu0, `${(r.nu0Hz / 1e6).toFixed(1)} MHz`); assert.equal(r.text.b0, `${r.b0Tesla.toFixed(1)} T`);
    assert.equal(r.text.dE, `${C.sci(r.dEJ, 2)} J`);
    const sentence = F.fieldSentence(r.b0Tesla, true);
    assert.ok(sentence.includes(r.text.nu0) && sentence.includes(r.text.dE) && sentence.includes(r.text.b0) && sentence.includes(r.text.excess), sentence);
  }
});
test("doubling B0 doubles nu0 and dE; the excess is the real Boltzmann value (about 32 per million at 9.4 T) and grows with B0", () => {
  const a = F.fieldReadouts(5); const b = F.fieldReadouts(10);
  rel(b.nu0Hz / a.nu0Hz, 2, 1e-12); rel(b.dEJ / a.dEJ, 2, 1e-12);
  near(F.fieldReadouts(9.4).excessPerMillion, 32.2, 0.3); assert.equal(F.fieldReadouts(9.4).text.excess, "32 per million");
  assert.ok(F.fieldReadouts(14).excessPerMillion > F.fieldReadouts(1).excessPerMillion);
  rel(F.fieldReadouts(9.4).polarization, P.polarization(9.4), 1e-12);
});
test("zero-field text says the levels are degenerate; the exaggeration is a labelled option and the real mode uses the true value", () => {
  assert.match(F.fieldSentence(9.4, false), /degenerate|same energy/);
  rel(P.displayPolarization("real", 9.4), P.polarization(9.4), 1e-12); assert.ok(P.displayPolarization("teaching", 9.4) > 1000 * P.polarization(9.4));
});
test("the slider range is 1-14 T and the store clamps to it in 0.1 T steps", () => {
  const s = ST.createStudioStore(); s.setB0(0); assert.equal(s.getState().b0Tesla, 1); s.setB0(99); assert.equal(s.getState().b0Tesla, 14); s.setB0(7.34); assert.equal(s.getState().b0Tesla, 7.3);
});

console.log("Continuous-wave resonance response (simplified, introductory)");
test("labelled model name, documented widths", () => {
  assert.equal(CW.CW_LABEL, "Simplified continuous-wave model (introductory)"); assert.equal(CW.CW_FWHM_HZ, 20); assert.ok(CW.CW_SATURATION < 0.1, "weak field");
});
test("the response peaks exactly at resonance (value 1) and is symmetric", () => {
  assert.equal(CW.cwAbsorption(0), 1);
  for (const d of [0.5, 3, 17, 60, 100]) { near(CW.cwAbsorption(d), CW.cwAbsorption(-d), 1e-12); assert.ok(CW.cwAbsorption(d) < 1); }
  const c = CW.cwCurve(100, 401); let imax = 0; for (let i = 0; i < c.y.length; i += 1) if (c.y[i] > c.y[imax]) imax = i; near(c.x[imax], 0, 1e-9);
});
test("the response is strictly monotonic towards resonance on both sides", () => {
  let prev = -1; for (let d = -100; d <= 0; d += 0.5) { const y = CW.cwAbsorption(d); assert.ok(y > prev, `left side at ${d}`); prev = y; }
  prev = 2; for (let d = 0; d <= 100; d += 0.5) { const y = CW.cwAbsorption(d); assert.ok(y < prev, `right side at ${d}`); prev = y; }
});
test("width: FWHM = (1 / pi T2) sqrt(1 + s) = 20 Hz, half height at +-10 Hz; weak far off resonance", () => {
  near(CW.cwFwhm(), 20, 1e-9); near(CW.cwAbsorption(10), 0.5, 1e-9); near(CW.cwAbsorption(-10), 0.5, 1e-9);
  assert.ok(CW.cwAbsorption(100) < 0.04, `at 5 FWHM ${CW.cwAbsorption(100)}`); assert.ok(CW.cwAbsorption(60) < 0.1);
  const wide = CW.cwParams({ fwhmHz: 40 }); near(CW.cwFwhm(wide), 40, 1e-9); near(CW.cwAbsorption(20, wide), 0.5, 1e-9);
});
test("power broadening: a stronger RF field (larger s) gives a wider line than (1/pi T2) alone", () => {
  const p = { ...CW.CW }; const strong = { ...p, omega1: p.omega1 * 6 };
  assert.ok(CW.cwFwhm(strong) > 1.5 * CW.cwFwhm(p)); rel(CW.cwFwhm(strong), Math.sqrt(1 + strong.omega1 ** 2 * strong.t1 * strong.t2) / (Math.PI * strong.t2), 1e-12);
});
test("the analytic steady state agrees with the Bloch-equation integrator (long CW irradiation) at several offsets", () => {
  const p = CW.CW; const tEnd = 40 * p.t2;
  for (const off of [0, 5, 15, 40, -25]) {
    const delta = B.deltaFromRfOffsetHz(off);
    const m = B.integrateRK4(B.equilibrium(1), tEnd, { omega1: p.omega1, delta, t1: p.t1, t2: p.t2, m0: 1 }, 60000);
    const ss = CW.cwSteadyState(off, p);
    near(m[1], ss.my, 2e-4 * Math.max(1, Math.abs(ss.my) * 1e3) * 1e-3 + 1e-5, `My at ${off} Hz`); near(m[0], ss.mx, 1e-5, `Mx at ${off} Hz`); near(m[2], ss.mz, 1e-5, `Mz at ${off} Hz`);
  }
});
test("the RF slider is centred on the resonance of the CURRENT field and follows B0", () => {
  for (const b0 of [1, 5.5, 9.4, 14]) {
    const r = CW.rfRangeMHz(b0); near((r.min + r.max) / 2, C.larmorMHz(b0), 1e-6); near(r.max - r.min, 2 * CW.CW_SPAN_HZ / 1e6, 2e-6); near(r.centre, C.larmorMHz(b0), 1e-12);
    near(CW.rfOffsetHz(CW.rfFromOffset(33, b0), b0), 33, 0.51);
  }
  const s = ST.createStudioStore(); s.setB0(12.1); const off = CW.rfOffsetHz(s.getState().rf.rfMHz, s.getState().b0Tesla); near(off, CW.CW_DEFAULT_OFFSET_HZ, 0.51);
  s.patch("rf", { rfMHz: CW.rfFromOffset(-70, 12.1) }); s.setB0(3.3); near(CW.rfOffsetHz(s.getState().rf.rfMHz, 3.3), -70, 1.01, "offset kept while it fits (two 1 Hz roundings)");
});
test("on resonance <=> |offset| <= FWHM/2; at the resonance h nu_rf = dE", () => {
  assert.equal(CW.cwOnResonance(0), true); assert.equal(CW.cwOnResonance(9.9), true); assert.equal(CW.cwOnResonance(10.5), false);
  const b0 = 9.4; near(C.H_PLANCK * CW.rfFromOffset(0, b0) * 1e6, C.energyGapJ(b0), 1e-6 * C.energyGapJ(b0));
});

console.log("Neighbouring spin states (why a signal splits)");
test("counting 2^n combinations gives 1:1, 1:2:1 and 1:3:3:1 for n = 1, 2, 3 and a singlet for n = 0", () => {
  assert.deepEqual(SS.spinStateCounts(SS.equivalentNeighbours(0)), [1]); assert.deepEqual(SS.spinStateCounts(SS.equivalentNeighbours(1)), [1, 1]);
  assert.deepEqual(SS.spinStateCounts(SS.equivalentNeighbours(2)), [1, 2, 1]); assert.deepEqual(SS.spinStateCounts(SS.equivalentNeighbours(3)), [1, 3, 3, 1]);
});
test("the combinations are really enumerated (2^n) and every one lands in the group of its offset", () => {
  for (let n = 0; n <= 6; n += 1) {
    const spins = SS.equivalentNeighbours(n, 7); assert.equal(SS.enumerateSpinStates(spins).length, 2 ** n);
    const g = SS.groupSpinStates(spins); assert.equal(g.reduce((a, x) => a + x.count, 0), 2 ** n); near(g.reduce((a, x) => a + x.weight, 0), 1, 1e-12);
    g.forEach((x) => { assert.equal(x.combos.length, x.count); x.combos.forEach((c) => near(c.reduce((a, s, i) => a + (s * spins[i].J) / 2, 0), x.offsetHz, 1e-9)); });
  }
});
test("group sizes are the binomial coefficients, line spacing is J, and the weights equal splitOffsets() / Pascal's row", () => {
  for (let n = 1; n <= 6; n += 1) {
    const spins = SS.equivalentNeighbours(n, 7); const g = SS.groupSpinStates(spins); const lines = SP.splitOffsets(spins);
    assert.deepEqual(g.map((x) => x.count), SP.pascalRow(n)); assert.equal(g.length, n + 1);
    g.forEach((x, i) => { near(x.weight, lines[lines.length - 1 - i].rel, 1e-12); near(x.offsetHz, lines[lines.length - 1 - i].offsetHz, 1e-9); if (i > 0) near(g[i - 1].offsetHz - x.offsetHz, 7, 1e-9); });
    g.forEach((x, i) => assert.equal(x.nAlpha, n - i));
  }
});
test("unequal J values give more lines than n + 1, with the same total number of combinations", () => {
  const spins = [{ J: 7 }, { J: 3 }]; const g = SS.groupSpinStates(spins); assert.equal(g.length, 4); assert.deepEqual(g.map((x) => x.count), [1, 1, 1, 1]); assert.equal(g[0].nAlpha, null);
});
test("molecule neighbours: ethanol CH3 -> 1:2:1 (triplet), CH2 -> 1:3:3:1 (quartet), propan-2-ol CH -> septet 1:6:15:20:15:6:1 capped at 10 spins", () => {
  const eth = getMolecule("ethanol"); assert.deepEqual(SS.spinStateCounts(SP.neighbourSpins(eth, "c")), [1, 2, 1]); assert.deepEqual(SS.spinStateCounts(SP.neighbourSpins(eth, "a")), [1, 3, 3, 1]);
  assert.deepEqual(SS.spinStateCounts(SP.neighbourSpins(getMolecule("propan-2-ol"), "a")), [1, 6, 15, 20, 15, 6, 1]);
  assert.throws(() => SS.enumerateSpinStates(SS.equivalentNeighbours(11)));
  for (const m of MOLECULES) for (const e of m.environments) { const sp = SP.neighbourSpins(m, e.id); assert.ok(sp.length <= 10); const counts = SS.spinStateCounts(sp); assert.equal(counts.reduce((a, b) => a + b, 0), 2 ** sp.length); }
});
test("labels use alpha = up, beta = down", () => { assert.equal(SS.comboLabel([1, -1, 1]), "↑↓↑"); assert.equal(SS.comboAria([1, -1]), "alpha, beta"); });

console.log("Step 5: the FID of the current molecule and its real FFT");
const peakNear = (spec, hz, halfWin = 2) => { let best = -1; let bi = 0; for (let i = 0; i < spec.freq.length; i += 1) { if (Math.abs(spec.freq[i] - hz) <= halfWin && spec.re[i] > best) { best = spec.re[i]; bi = i; } } return { hz: spec.freq[bi], height: best }; };
test("components are derived from the molecule's multiplets: ethanol = 3 + 4 + 1 lines at (delta - carrier) x nu0 Hz", () => {
  const op = C.larmorMHz(9.4); const { comps, mol } = MF.fidComponents("ethanol", op);
  assert.equal(mol.id, "ethanol"); assert.equal(comps.length, 8);
  const sig = SP.buildSignals(mol, { freqMHz: op, coupling: true });
  const expect = sig.flatMap((s) => s.lines.map((l) => l.hz - MF.CARRIER_PPM * op)).sort((a, b) => a - b);
  const got = comps.map((c) => c.freqHz).sort((a, b) => a - b); got.forEach((f, i) => near(f, expect[i], 1e-9));
  near(comps.reduce((a, c) => a + c.amplitude, 0), 1, 1e-12);
  assert.ok(comps.filter((c) => c.envId === "b").every((c) => near(c.t2star, 1 / (Math.PI * 12), 1e-12) || true)); near(comps.find((c) => c.envId === "b").widthHz, 12, 0);
});
test("the FFT of the sampled FID has a peak at every expected Hz offset (ethanol at 9.4 T and at 14 T)", () => {
  for (const b0 of [9.4, 14]) {
    const op = C.larmorMHz(b0); const m = MF.buildMoleculeFid("ethanol", op); const bin = 1 / (m.spec.size * m.spec.dwell);
    near(bin, 1 / (2 * m.acq.aq), 1e-9); assert.ok(bin < 0.2, `bin ${bin}`);
    for (const c of m.comps) {
      if (c.envId === "b") continue; // the broad OH line (12 Hz) has no resolved neighbours; checked below
      const pk = peakNear(m.spec, c.freqHz, 1.5); near(pk.hz, c.freqHz, 0.12, `line at ${c.freqHz.toFixed(2)} Hz (${b0} T)`);
    }
    const oh = m.comps.find((c) => c.envId === "b"); near(peakNear(m.spec, oh.freqHz, 8).hz, oh.freqHz, 0.5);
    for (const c of m.comps) near(offsetPpm(m, c.freqHz), c.ppm, 1e-9);
  }
});
function offsetPpm(m, hz) { return FID.offsetHzToPpm(hz, m.carrierPpm, m.opMHz); }
test("the transform separates the environments: integrals of the multiplets keep the H ratio (CH3 : CH2 : OH = 3 : 2 : 1)", () => {
  const op = C.larmorMHz(9.4); const m = MF.buildMoleculeFid("ethanol", op); const area = (id) => { const cs = m.comps.filter((c) => c.envId === id); const lo = Math.min(...cs.map((c) => c.freqHz)) - 250; const hi = Math.max(...cs.map((c) => c.freqHz)) + 250; return FID.integrateHz(m.spec, lo, hi); };
  const aC = area("c"); const aA = area("a"); const aB = area("b");
  rel(aC / aB, 3, 0.04); rel(aA / aB, 2, 0.04);
});
test("a different molecule gives a different FID: propanone is ONE line, propan-2-ol has a septet; ppm positions do not depend on B0, Hz offsets do", () => {
  const op = C.larmorMHz(9.4); assert.equal(MF.fidComponents("propanone", op).comps.length, 1); assert.equal(MF.fidComponents("propan-2-ol", op).comps.filter((c) => c.envId === "a").length, 7);
  const lo = MF.fidComponents("ethanol", 4.7); const hi = MF.fidComponents("ethanol", 9.4);
  for (const id of ["a", "b", "c"]) { const mean = (r) => { const cs = r.comps.filter((c) => c.envId === id); return cs.reduce((a, c) => a + c.ppm, 0) / cs.length; }; near(mean(lo), mean(hi), 1e-6, `centre of ${id}`); } const mean = (r, id) => { const cs = r.comps.filter((c) => c.envId === id); return cs.reduce((a, c) => a + c.freqHz, 0) / cs.length; };
  rel((mean(hi, "a") - mean(hi, "c")) / (mean(lo, "a") - mean(lo, "c")), 2, 1e-6);
});
test("fall back to a stated default when no molecule is chosen (three singlets, areas 3 : 2 : 1) and for an unknown id", () => {
  for (const id of [null, undefined, "nope"]) { const m = MF.buildMoleculeFid(id, 400); assert.equal(m.isDefault, true); assert.equal(m.comps.length, 3); assert.match(m.label, /no molecule/i); }
  const m = MF.buildMoleculeFid(null, 400); const hz = m.comps.map((c) => c.freqHz); const peaks = hz.map((f) => peakNear(m.spec, f, 3).height);
  rel(peaks[0] / peaks[2], 3, 0.02); rel(peaks[1] / peaks[2], 2, 0.02);
});
test("the FID is the sum of the damped oscillations: starts at 1 (amplitudes sum to 1), decays, and its window covers the decay", () => {
  const m = MF.buildMoleculeFid("ethanol", C.larmorMHz(9.4)); near(m.fid.re[0], 1, 1e-9); near(m.fid.im[0], 0, 1e-9);
  const n = Math.round(m.fidWindowS / m.acq.dwell); let late = 0; for (let i = n - 50; i < n; i += 1) late = Math.max(late, Math.abs(m.fid.re[i])); assert.ok(late < 0.05, `late amplitude ${late}`);
  assert.ok(m.fidWindowS <= m.acq.aq);
});
test("the cached model is reused for the same molecule and frequency", () => { const a = MF.getMoleculeFid("ethanol", 400.2); assert.equal(MF.getMoleculeFid("ethanol", 400.2), a); assert.notEqual(MF.getMoleculeFid("ethanal", 400.2), a); });

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
