#!/usr/bin/env node
// Unit tests for the pure NMR physics modules used by the Spectroscopy Simulation Lab:  node scripts/test-nmr-physics.mjs
// constants / energy gap / Boltzmann populations / Bloch integrator / FID synthesis / FFT. No DOM, no React.
import assert from "node:assert/strict";
import * as C from "../src/engines/spectroscopy-studio/nmr/physics/constants.js";
import * as P from "../src/engines/spectroscopy-studio/nmr/physics/populations.js";
import * as B from "../src/engines/spectroscopy-studio/nmr/physics/blochSim.js";
import * as F from "../src/engines/spectroscopy-studio/nmr/physics/fid.js";
import * as T from "../src/engines/spectroscopy-studio/nmr/physics/fft.js";
import * as I from "../src/engines/spectroscopy-studio/nmr/physics/instrumentModel.js";
import * as S from "../src/engines/spectroscopy-studio/nmr/physics/spinEnsemble.js";

let passed = 0; let failed = 0;
function test(name, fn) { try { fn(); console.log(`  ok   ${name}`); passed += 1; } catch (e) { console.log(`  FAIL ${name}\n       ${(e.stack || e.message).split("\n").slice(0, 5).join("\n       ")}`); failed += 1; } }
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} expected ${b} +/- ${tol}, got ${a}`);
const rel = (a, b, r, msg) => assert.ok(Math.abs(a - b) <= r * Math.abs(b), `${msg ?? ""} expected ${b} within ${r * 100}%, got ${a}`);

console.log("Constants and the resonance condition");
test("gamma(1H) = 2.675222e8 rad s^-1 T^-1 and gamma/2pi = 42.577 MHz/T", () => {
  assert.equal(C.GAMMA_H1, 2.675222e8); near(C.GAMMA_BAR_MHZ_PER_T, 42.5775, 1e-3);
});
test("9.4 T -> 400.2 MHz (about 400 MHz); 1 T -> 42.58 MHz; 14 T -> 596 MHz", () => {
  near(C.larmorMHz(9.4), 400.2, 0.1); near(C.larmorMHz(1), 42.577, 0.01); near(C.larmorMHz(14), 596.1, 0.2);
});
test("B0 range is 1-14 T and clampB0 enforces it", () => {
  assert.equal(C.B0_MIN, 1); assert.equal(C.B0_MAX, 14); assert.equal(C.clampB0(0), 1); assert.equal(C.clampB0(99), 14); assert.equal(C.clampB0(NaN), C.B0_DEFAULT);
});
test("nu0 is linear in B0 and b0ForMHz inverts larmorMHz", () => {
  for (const b of [1, 2.5, 7, 9.4, 14]) { near(C.b0ForMHz(C.larmorMHz(b)), b, 1e-12); rel(C.larmorHz(2 * b), 2 * C.larmorHz(b), 1e-12); }
});
test("energy gap Delta E = h nu0 = gamma hbar B0, proportional to B0, 2.65e-25 J at 9.4 T", () => {
  for (const b of [1, 4, 9.4, 14]) rel(C.energyGapJ(b), C.GAMMA_H1 * C.HBAR * b, 1e-12);
  rel(C.energyGapJ(9.4), 2.652e-25, 1e-3); rel(C.energyGapJ(14) / C.energyGapJ(7), 2, 1e-12);
});
test("proton magnetic moment z-component gamma hbar / 2 = 1.4106e-26 J/T", () => { rel(C.MU_Z, 1.4106e-26, 1e-4); });

console.log("Equilibrium populations");
test("Boltzmann polarisation at 9.4 T, 298 K is about 3.2e-5 (computed, not hard-coded)", () => {
  const p = P.polarization(9.4, 298); near(p, 3.22e-5, 0.03e-5); rel(P.polarizationApprox(9.4, 298), p, 1e-6);
  near(P.excessPerMillion(9.4), 32.2, 0.3);
});
test("polarisation grows monotonically with B0 and falls with temperature", () => {
  let last = 0; for (let b = 1; b <= 14; b += 0.5) { const p = P.polarization(b); assert.ok(p > last); last = p; }
  assert.ok(P.polarization(9.4, 250) > P.polarization(9.4, 350));
});
test("populations sum to N, alpha (lower) > beta; ratio equals exp(-dE/kT)", () => {
  const n = P.populations(1e6, 9.4); near(n.alpha + n.beta, 1e6, 1e-6); assert.ok(n.alpha > n.beta);
  rel(n.beta / n.alpha, P.boltzmannRatio(9.4), 1e-9); near(n.excess, n.alpha - n.beta, 1e-6);
});
test("net magnetisation M0 = N gamma hbar P / 2 and increases with B0", () => {
  rel(P.netMagnetization(1, 9.4), C.MU_Z * P.polarization(9.4), 1e-12); assert.ok(P.netMagnetization(1, 14) > P.netMagnetization(1, 1));
});
test("teaching-mode exaggeration is a constant factor (still linear/monotonic) and is NOT used in real mode", () => {
  const k = P.exaggerationFactor(); assert.ok(k > 1000);
  near(P.displayPolarization("teaching", 9.4), 0.2, 1e-9); rel(P.displayPolarization("real", 9.4), P.polarization(9.4), 1e-12);
  assert.ok(P.displayPolarization("teaching", 14) > P.displayPolarization("teaching", 1));
  rel(P.displayPolarization("teaching", 14) / P.displayPolarization("teaching", 7), 2, 1e-3);
  // 200 drawn arrows: real mode is 100:100 (the true excess is far below one arrow), teaching mode is visibly unequal
  assert.equal(P.drawnAlphaCount(200, P.displayPolarization("real", 9.4)), 100); assert.equal(P.drawnAlphaCount(200, P.displayPolarization("teaching", 9.4)), 120);
});

console.log("Bloch equations");
const W1 = 2 * Math.PI * 25000; // nu1 = 25 kHz  -> 90 degree pulse = 10 us
const tp90 = B.pulseDurationFor(Math.PI / 2, W1);
test("flip angle = gamma B1 tp; nu1 and B1 relations", () => {
  near(tp90, 10e-6, 1e-12); near(B.flipAngle(W1, tp90), Math.PI / 2, 1e-12);
  const b1 = W1 / C.GAMMA_H1; near(B.omega1FromB1(b1), W1, 1e-3); near(B.nu1FromB1(b1), 25000, 1e-6); near(b1 * 1e6, 587.0, 0.5); // ~587 uT
});
test("on resonance: 90 degree pulse -> Mz = 0, |Mxy| = M0; 180 degree -> Mz = -M0", () => {
  const m90 = B.stateAt({ omega1: W1, delta: 0, tp: tp90 }, tp90); near(m90[2], 0, 1e-9); near(B.transverse(m90), 1, 1e-9); near(m90[1], 1, 1e-9);
  const tp180 = 2 * tp90; const m180 = B.stateAt({ omega1: W1, delta: 0, tp: tp180 }, tp180); near(m180[2], -1, 1e-9); near(B.transverse(m180), 0, 1e-9);
});
test("on resonance Mz = cos(theta) and Mxy = |sin(theta)| for any flip angle", () => {
  for (const deg of [10, 45, 90, 135, 180, 270, 360, 450]) {
    const th = (deg * Math.PI) / 180; const tp = th / W1; const m = B.stateAt({ omega1: W1, delta: 0, tp }, tp);
    near(m[2], Math.cos(th), 1e-8, `${deg}`); near(B.transverse(m), Math.abs(Math.sin(th)), 1e-8, `${deg}`);
  }
});
test("off resonance: RK4 matches the analytic effective-field (Rabi) result", () => {
  for (const off of [-40000, -10000, -2500, 0, 500, 7500, 25000, 60000]) {
    const delta = B.deltaFromRfOffsetHz(off); const num = B.stateAt({ omega1: W1, delta, tp: tp90 }, tp90); const ana = B.analyticPulseResponse(W1, delta, tp90);
    near(num[0], ana.mx, 1e-8, `mx @${off}`); near(num[1], ana.my, 1e-8, `my @${off}`); near(num[2], ana.mz, 1e-8, `mz @${off}`);
    const ex = B.rotateExact([0, 0, 1], W1, delta, tp90); near(num[0], ex[0], 1e-8); near(num[1], ex[1], 1e-8); near(num[2], ex[2], 1e-8);
  }
});
test("off resonance reduces the transverse response (90 pulse): monotonic decrease from the resonance to 1 nu1", () => {
  const r = B.responseVsOffset({ omega1: W1, tp: tp90, t1: Infinity, t2: Infinity }, [0, 5000, 10000, 20000, 25000]);
  for (let i = 1; i < r.length; i += 1) assert.ok(r[i].mxy < r[i - 1].mxy, `offset ${r[i].offsetHz}`);
  near(r[0].mxy, 1, 1e-8); assert.ok(r[4].mxy < 0.99 * r[0].mxy, `${r[4].mxy}`);
});
test("response vs offset is symmetric in |Mxy| and Mz, and has its first Mxy zero where the effective flip is 2 pi (sinc-like)", () => {
  const off = [-12000, 12000, -30000, 30000]; const r = B.responseVsOffset({ omega1: W1, tp: tp90, t1: Infinity, t2: Infinity }, off);
  near(r[0].mxy, r[1].mxy, 1e-9); near(r[0].mz, r[1].mz, 1e-9); near(r[2].mxy, r[3].mxy, 1e-9);
  // |Omega_eff| tp = 2 pi -> nu_eff = 1/tp = 100 kHz -> offset = sqrt(100^2 - 25^2) kHz = 96.8 kHz
  const z = Math.sqrt(100000 ** 2 - 25000 ** 2); const rz = B.responseVsOffset({ omega1: W1, tp: tp90, t1: Infinity, t2: Infinity }, [z]);
  near(rz[0].mxy, 0, 1e-6); near(rz[0].mz, 1, 1e-6);
});
test("norm of M is conserved without relaxation (pulse and free precession)", () => {
  const s = { omega1: W1, delta: B.deltaFromRfOffsetHz(8000), tp: 3 * tp90, t1: Infinity, t2: Infinity };
  for (const t of [0, s.tp / 3, s.tp, s.tp + 2e-4, s.tp + 3e-3]) near(B.norm(B.stateAt(s, t)), 1, 1e-8, `t=${t}`);
});
test("T2 decay of transverse magnetisation and T1 recovery of Mz after a 90 degree pulse (free precession)", () => {
  const s = { omega1: W1, delta: 0, tp: tp90, t1: 1.0, t2: 0.4 };
  for (const dt of [0.1, 0.4, 1.2]) {
    const m = B.stateAt(s, tp90 + dt); near(B.transverse(m), Math.exp(-dt / 0.4), 2e-4, `T2 ${dt}`); near(m[2], 1 - Math.exp(-dt / 1.0), 2e-4, `T1 ${dt}`);
  }
  const inv = { omega1: W1, delta: 0, tp: 2 * tp90, t1: 1.0, t2: 0.4 }; near(B.stateAt(inv, inv.tp + 0.7)[2], 1 - 2 * Math.exp(-0.7), 2e-4, "inversion recovery");
});
test("free precession in the rotating frame rotates at the offset (Delta) and matches RK4", () => {
  const delta = B.deltaFromRfOffsetHz(1234); const m0 = [1, 0, 0]; const t = 3e-4;
  const a = B.freePrecession(m0, delta, t); const r = B.integrateRK4(m0, t, { omega1: 0, delta }, 3000);
  near(a[0], r[0], 1e-9); near(a[1], r[1], 1e-9); near(Math.atan2(-a[1], a[0]), delta * t, 1e-9);
});
test("deterministic: the state at time t does not depend on the path (scrub / step back = recompute)", () => {
  const s = { omega1: W1, delta: B.deltaFromRfOffsetHz(5000), tp: tp90, t1: 1, t2: 0.5 };
  const ts = [0, 3e-6, 1e-5, 4e-5, 2.5e-4]; const fwd = ts.map((t) => B.stateAt(s, t)); const back = [...ts].reverse().map((t) => B.stateAt(s, t)).reverse();
  for (let i = 0; i < ts.length; i += 1) for (let k = 0; k < 3; k += 1) assert.equal(fwd[i][k], back[i][k]);
  assert.deepEqual(B.stateAt(s, 0), [0, 0, 1]);
});
test("excitation timeline maps display time to physical time monotonically; pulse ends exactly at tp", () => {
  const s = { omega1: W1, delta: B.deltaFromRfOffsetHz(8000), tp: tp90, t2: 0.5 }; const tl = B.makeExcitationTimeline(s);
  near(tl.toPhysical(tl.pulseDisplayS), s.tp, 1e-15); let last = -1; for (let tau = 0; tau <= tl.totalDisplayS; tau += 0.25) { const t = tl.toPhysical(tau); assert.ok(t >= last); last = t; }
  near(tl.tFree, 3 / 8000, 1e-12);
  const res = B.makeExcitationTimeline({ ...s, delta: 0 }); near(res.tFree, 1.0, 1e-12);
});

test("trajectory table agrees with stateAt (including a far-off-resonance pulse that uses the exact rotation)", () => {
  for (const off of [0, 7000, -22000, 5e6]) {
    const s = { omega1: W1, delta: B.deltaFromRfOffsetHz(off), tp: tp90 * 2, t1: 1, t2: 0.5 }; const tl = B.makeExcitationTimeline(s); const tr = B.trajectory(s, tl, 160);
    assert.equal(tr.length, 161); near(tr[0].m[2], 1, 1e-12);
    for (const k of [10, 40, 60, 61, 100, 160]) { const a = tr[k].m; const b = B.stateAt(s, tr[k].t); for (let i = 0; i < 3; i += 1) near(a[i], b[i], 2e-6, `off ${off} k ${k} i ${i}`); }
  }
  // 5 MHz away from resonance the magnetisation stays on z (no excitation)
  const far = B.stateAt({ omega1: W1, delta: B.deltaFromRfOffsetHz(5e6), tp: 1e-5 }, 1e-5); assert.ok(B.transverse(far) < 0.01);
});

console.log("FFT");
test("FFT equals the naive DFT (forward and inverse) for random data", () => {
  const n = 64; const rng = F.mulberry32(7); const re = Float64Array.from({ length: n }, () => rng() - 0.5); const im = Float64Array.from({ length: n }, () => rng() - 0.5);
  const d = T.dft(re, im); const f = T.fft(Float64Array.from(re), Float64Array.from(im));
  for (let k = 0; k < n; k += 1) { near(f.re[k], d.re[k], 1e-9); near(f.im[k], d.im[k], 1e-9); }
  const inv = T.fft(Float64Array.from(f.re), Float64Array.from(f.im), true); for (let k = 0; k < n; k += 1) { near(inv.re[k], re[k], 1e-12); near(inv.im[k], im[k], 1e-12); }
});
test("a complex exponential exp(+2 pi i f t) peaks at +f with the correct frequency axis (Parseval holds too)", () => {
  const n = 256; const dt = 1 / 1024; const f0 = 100; const re = new Float64Array(n); const im = new Float64Array(n);
  for (let i = 0; i < n; i += 1) { re[i] = Math.cos(2 * Math.PI * f0 * i * dt); im[i] = Math.sin(2 * Math.PI * f0 * i * dt); }
  let e1 = 0; for (let i = 0; i < n; i += 1) e1 += re[i] ** 2 + im[i] ** 2;
  T.fft(re, im); let e2 = 0; for (let i = 0; i < n; i += 1) e2 += re[i] ** 2 + im[i] ** 2; near(e2 / n, e1, 1e-9);
  const sh = T.fftShift(re); const fr = T.shiftedFrequencies(n, dt); let k = 0; for (let i = 0; i < n; i += 1) if (Math.hypot(sh[i]) > Math.hypot(sh[k])) k = i;
  near(fr[k], f0, 1 / (n * dt)); near(fr[n / 2], 0, 1e-12); near(fr[1] - fr[0], 1 / (n * dt), 1e-12);
});
test("non power-of-two lengths are rejected", () => { assert.throws(() => T.fft(new Float64Array(12), new Float64Array(12))); assert.equal(T.nextPow2(1000), 1024); });

console.log("FID and spectrum");
const OP = 400.2; const ACQ = F.acquisitionFor(OP);
test("acquisition covers a 20 ppm window", () => { near(ACQ.sw, 20 * OP, 1e-9); near(ACQ.dwell * ACQ.sw, 1, 1e-12); assert.ok(T.isPow2(ACQ.n)); });
test("single resonance: spectrum peak position equals the input frequency within the resolution", () => {
  for (const f0 of [-3000, -812.5, 0, 250, 1234.5, 3300]) {
    const fid = F.synthesizeFid({ components: [{ freqHz: f0, amplitude: 1, t2star: 0.1 }], dwell: ACQ.dwell, n: ACQ.n });
    const sp = F.transformFid(fid); const k = F.argMax(sp.re); const pf = F.peakFrequency(sp, k - 3, k + 3);
    near(pf, f0, F.binWidthHz(sp), `f0=${f0}`); near(Math.abs(sp.freq[k] - f0), 0, F.binWidthHz(sp));
  }
});
test("negative frequency offsets appear on the negative side (sign convention)", () => {
  const sp = F.transformFid(F.synthesizeFid({ components: [{ freqHz: -1000, amplitude: 1, t2star: 0.1 }], dwell: ACQ.dwell, n: ACQ.n }));
  assert.ok(sp.freq[F.argMax(sp.re)] < 0);
});
test("linewidth (FWHM) = 1 / (pi T2*)", () => {
  for (const t2s of [0.03, 0.1, 0.3]) {
    const fid = F.synthesizeFid({ components: [{ freqHz: 500, amplitude: 1, t2star: t2s }], dwell: ACQ.dwell, n: ACQ.n });
    const sp = F.transformFid(fid, { zeroFillTo: 4 * ACQ.n }); const k = F.argMax(sp.re); rel(F.fwhmHz(sp, k), F.lorentzianFwhmHz(t2s), 0.03, `T2*=${t2s}`);
  }
});
test("exponential apodisation adds its line-broadening to the FWHM", () => {
  const t2s = 0.3; const fid = F.synthesizeFid({ components: [{ freqHz: 500, amplitude: 1, t2star: t2s }], dwell: ACQ.dwell, n: ACQ.n });
  const sp = F.transformFid(fid, { lbHz: 3, zeroFillTo: 4 * ACQ.n }); rel(F.fwhmHz(sp, F.argMax(sp.re)), F.lorentzianFwhmHz(t2s) + 3, 0.03);
});
test("multiple components: peaks at the right positions, areas proportional to the amplitudes (3:2:1)", () => {
  const comps = [{ freqHz: -1500, amplitude: 3, t2star: 0.15 }, { freqHz: 200, amplitude: 2, t2star: 0.15 }, { freqHz: 1300, amplitude: 1, t2star: 0.15 }];
  const sp = F.transformFid(F.synthesizeFid({ components: comps, dwell: ACQ.dwell, n: ACQ.n }));
  const nearest = (f) => { let k = 0; for (let i = 0; i < sp.freq.length; i += 1) if (Math.abs(sp.freq[i] - f) < Math.abs(sp.freq[k] - f)) k = i; return k; };
  const areas = comps.map((c) => { const k = nearest(c.freqHz); near(F.peakFrequency(sp, k - 40, k + 40), c.freqHz, 3); return F.integrateHz(sp, c.freqHz - 400, c.freqHz + 400); });
  rel(areas[0] / areas[2], 3, 0.03); rel(areas[1] / areas[2], 2, 0.03); rel(areas[0] / areas[1], 1.5, 0.03);
  // area of one Lorentzian = A / 2 (one-sided transform)
  rel(areas[2], 0.5, 0.03);
  // exactly three local maxima above 10 % of the strongest
  const mx = Math.max(...sp.re); let peaks = 0; for (let i = 1; i < sp.re.length - 1; i += 1) if (sp.re[i] > 0.1 * mx && sp.re[i] > sp.re[i - 1] && sp.re[i] >= sp.re[i + 1]) peaks += 1; assert.equal(peaks, 3);
});
test("noise: seeded (deterministic), has the requested standard deviation, and lowers the spectral signal-to-noise", () => {
  const mk = (noise) => F.synthesizeFid({ components: [{ freqHz: 300, amplitude: 1, t2star: 0.1 }], dwell: ACQ.dwell, n: ACQ.n, noise, seed: 5 });
  const a = mk(0.2); const b = mk(0.2); assert.deepEqual(Array.from(a.re.slice(0, 50)), Array.from(b.re.slice(0, 50)));
  const clean = mk(0); let s2 = 0; for (let i = 20000; i < ACQ.n; i += 1) s2 += (a.re[i] - clean.re[i]) ** 2; near(Math.sqrt(s2 / (ACQ.n - 20000)), 0.2, 0.01);
  const snr = (noise) => { const sp = F.transformFid(mk(noise)); const k = F.argMax(sp.re); let q = 0; let c = 0; for (let i = 0; i < sp.re.length; i += 1) if (Math.abs(sp.freq[i] - 300) > 1500) { q += sp.re[i] ** 2; c += 1; } return sp.re[k] / Math.sqrt(q / c); };
  assert.ok(snr(0.05) > 2.5 * snr(0.2), "SNR must fall as the noise rises"); assert.ok(snr(0.2) > 10);
  assert.notDeepEqual(Array.from(mk(0.2).re.slice(0, 20)), Array.from(F.synthesizeFid({ components: [{ freqHz: 300, amplitude: 1, t2star: 0.1 }], dwell: ACQ.dwell, n: ACQ.n, noise: 0.2, seed: 6 }).re.slice(0, 20)));
});
test("the FID itself decays as exp(-t/T2*) and oscillates at the input frequency", () => {
  const fid = F.synthesizeFid({ components: [{ freqHz: 1000, amplitude: 1, t2star: 0.05 }], dwell: ACQ.dwell, n: ACQ.n });
  const i = Math.round(0.05 / ACQ.dwell); near(Math.hypot(fid.re[i], fid.im[i]), Math.exp(-1), 1e-3); near(F.analyticFidReal([{ freqHz: 1000, amplitude: 1, t2star: 0.05 }], 0.0005), Math.exp(-0.01) * Math.cos(Math.PI), 1e-12);
});
test("ppm/Hz conversion follows the operating frequency (Hz separations scale with B0, ppm does not)", () => {
  near(F.ppmToOffsetHz(3, 5, 400), -800, 1e-9); near(F.ppmToOffsetHz(3, 5, 600), -1200, 1e-9); near(F.offsetHzToPpm(-800, 5, 400), 3, 1e-12);
});

console.log("Spectrometer sequence, spin ensemble and shared models");
test("guided sequence: 6 steps of 4 s; stepAt is clamped and exact at the boundaries", () => {
  assert.equal(I.GUIDED_DURATION, 24); assert.deepEqual(I.stepAt(0), { step: 0, p: 0 }); assert.deepEqual(I.stepAt(4), { step: 1, p: 0 }); assert.deepEqual(I.stepAt(24), { step: 5, p: 1 }); assert.deepEqual(I.stepAt(99), { step: 5, p: 1 });
  assert.equal(I.STEPS.length, 6); assert.deepEqual(I.STEPS.map((s) => s.id), ["insert", "field", "pulse", "detect", "fid", "ft"]);
});
test("guided state follows the physics: sample in -> M0 builds up -> 90 degree pulse from the Bloch model -> transverse magnetisation decays", () => {
  near(I.guidedState(0, 0).insert, 0, 1e-12); near(I.guidedState(0, 1).insert, 1, 1e-12); near(I.guidedState(0, 1).mz, 0, 1e-12);
  near(I.guidedState(1, 1).mz, 1, 1e-12); assert.ok(I.guidedState(1, 0.5).mz > 0 && I.guidedState(1, 0.5).mz < 1);
  const s0 = I.guidedState(2, 0); const s1 = I.guidedState(2, 1); near(s0.mz, 1, 1e-9); near(s1.mz, 0, 1e-6); near(s1.mxy, 1, 1e-6); near(I.guidedState(2, 0.5).mz, Math.cos(Math.PI / 4), 1e-6);
  assert.ok(I.guidedState(3, 1).mxy < I.guidedState(3, 0).mxy); assert.equal(I.guidedState(4, 0.5).display, "fid"); assert.equal(I.guidedState(5, 0.5).display, "spec"); assert.equal(I.guidedState(3, 0.5).display, "none");
  assert.equal(I.guidedState(2, 0.5).tx, 1); assert.equal(I.guidedState(3, 0.5).rx, 1);
});
test("spin ensemble: alpha count follows the polarisation, cone angle 54.74 degrees, zero net transverse moment, zero net at random start", () => {
  const ens = S.makeEnsemble(160); const st = S.assignStates(ens, 0.2); assert.equal(st.nAlpha, 96); assert.equal(st.nAlpha + st.nBeta, 160);
  near((S.CONE_ANGLE * 180) / Math.PI, 54.7356, 1e-3);
  const d = S.arrowDirection(ens, 3, true, { apply: 1, phase: 0.7, view: "scientific" }); near(Math.hypot(...d), 1, 1e-9); near(d[2], 1 / Math.sqrt(3), 1e-9);
  const net = S.netOfDrawn(ens, S.assignStates(ens, 0), { apply: 1, phase: 1.3, view: "scientific" }); assert.ok(Math.hypot(net[0], net[1]) < 0.02, `transverse ${net}`); near(net[2], 0, 1e-9);
  const withP = S.netOfDrawn(ens, st, { apply: 1, view: "scientific" }); near(withP[2], 0.2 / Math.sqrt(3), 1e-9);
  const off = S.netOfDrawn(ens, st, { apply: 0, view: "scientific" }); assert.ok(Math.hypot(...off) < 0.2, "field off: no preferred direction");
  // real-scale polarisation changes no arrow at 160 arrows
  assert.equal(S.assignStates(ens, P.polarization(9.4)).nAlpha, 80);
  const a0 = S.slerp([1, 0, 0], [0, 1, 0], 0.5); near(Math.hypot(...a0), 1, 1e-12); near(a0[0], Math.SQRT1_2, 1e-12);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
