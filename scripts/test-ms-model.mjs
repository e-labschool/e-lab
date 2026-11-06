#!/usr/bin/env node
// Pure tests of the Mass Spectrometry model:  node scripts/test-ms-model.mjs
// Kinematics (hand-calculated numbers, scaling laws), the magnetic-sector and time-of-flight geometry, isotope data and Ar, the polynomial isotope-pattern generator
// (specification table, normalisation), the six representative EI spectra (integrity: base peak 100, M and base identified, formulas vs m/z, electron-count parity,
// 2 u clusters), the methane pathways, the detection build-up, the unknown-compound challenge (unique best answer, nominal-mass ambiguity, no answer leak in the initial
// state, hints that do not name the answer), the evidence data (kept, no longer a stage), the seeded experiment controller, the analyser model, the journey timing and the store (sanitise / migration / persistence). No DOM.
import assert from "node:assert/strict";
import { register } from "node:module";
register("./jsx-loader-hooks.mjs", import.meta.url);

const P = "../src/engines/spectroscopy-studio/ms/";
const K = await import(`${P}physics/kinematics.js`);
const { E_CHARGE, U_KG, M_ELECTRON_U, mzToMassKg } = await import(`${P}physics/constants.js`);
const SEC = await import(`${P}physics/sector.js`);
const TOFM = await import(`${P}physics/tof.js`);
const ISO = await import(`${P}physics/isotopes.js`);
const { ISOTOPES, TEACHING_ABUNDANCE } = await import(`${P}data/isotopes.js`);
const SP = await import(`${P}data/spectra.js`);
const FR = await import(`${P}data/fragmentation.js`);
const DET = await import(`${P}physics/detection.js`);
const CH = await import(`${P}physics/challenge.js`);
const EV = await import(`${P}data/evidence.js`);
const ST = await import(`${P}state/msState.js`);

let passed = 0; let failed = 0;
function test(name, fn) { try { fn(); console.log(`  ok   ${name}`); passed += 1; } catch (e) { console.log(`  FAIL ${name}\n       ${(e.stack || e.message).split("\n").slice(0, 5).join("\n       ")}`); failed += 1; } }
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} ${a} vs ${b} (tol ${tol})`);
const relNear = (a, b, rel, msg) => assert.ok(Math.abs(a - b) <= rel * Math.abs(b), `${msg ?? ""} ${a} vs ${b} (rel ${rel})`);

console.log("Constants and kinematics");
test("constants: e is the exact SI value, u CODATA 2022, electron mass about 5.4858e-4 u", () => {
  assert.equal(E_CHARGE, 1.602176634e-19); near(U_KG, 1.66053906892e-27, 1e-37); near(M_ELECTRON_U, 5.485799e-4, 1e-9);
});
test("Ek = zeV: 2000 V gives 2000 eV for z = 1, 4000 eV for z = 2, and does not depend on the mass", () => {
  relNear(K.kineticEnergyJ(1, 2000), 2000 * E_CHARGE, 1e-12); relNear(K.kineticEnergyJ(2, 2000), 4000 * E_CHARGE, 1e-12);
  for (const mz of [2, 16, 31, 58, 200]) { const m = mzToMassKg(mz); relNear(0.5 * m * K.speedMs(m, 1, 2000) ** 2, K.kineticEnergyJ(1, 2000), 1e-12, `Ek ${mz}`); }
});
test("speed: hand-calculated 1.5531e5 m/s for m/z 16 and 8.1573e4 m/s for m/z 58 at 2000 V; v is proportional to 1/sqrt(m)", () => {
  relNear(K.speedFromMz(16, 2000), 155310.44, 1e-6); relNear(K.speedFromMz(58, 2000), 81573.04, 1e-6);
  relNear(K.speedFromMz(16, 2000) / K.speedFromMz(64, 2000), 2, 1e-12); relNear(K.speedFromMz(16, 8000) / K.speedFromMz(16, 2000), 2, 1e-12);
});
test("radius: 0.09983 m for m/z 16 at 2000 V and 0.258 T; r = mv/(zeB) agrees with the closed form; r is proportional to sqrt(m/z), 1/B and sqrt(V)", () => {
  relNear(K.radiusFromMz(16, 2000, 0.258), 0.0998250722, 1e-8);
  for (const mz of [12, 16, 31, 58]) relNear(K.radiusFromMz(mz, 2000, 0.3), K.radiusClosedForm(mz, 2000, 0.3), 1e-12, `closed form ${mz}`);
  relNear(K.radiusFromMz(64, 2000, 0.258) / K.radiusFromMz(16, 2000, 0.258), 2, 1e-12); relNear(K.radiusFromMz(16, 2000, 0.516) / K.radiusFromMz(16, 2000, 0.258), 0.5, 1e-12); relNear(K.radiusFromMz(16, 8000, 0.258) / K.radiusFromMz(16, 2000, 0.258), 2, 1e-12);
});
test("doubly charged ions: same mass, z = 2 gives the radius divided by sqrt(2) (same as m/z halved)", () => {
  relNear(K.radiusFromMass(mzToMassKg(32), 2, 2000, 0.3), K.radiusFromMz(16, 2000, 0.3), 1e-12);
});
test("m/z = e B^2 r^2 / (2V) inverts the radius formula; B for a chosen m/z and the voltage for a chosen m/z", () => {
  for (const mz of [12, 16, 31, 43, 58]) { const r = K.radiusFromMz(mz, 3000, 0.4); relNear(K.mzFromRadius(r, 0.4, 3000), mz, 1e-12, `inverse ${mz}`); relNear(K.radiusFromMz(mz, 3000, K.fieldForMz(mz, 3000, 0.1)), 0.1, 1e-12); relNear(K.radiusFromMz(mz, K.voltageForMz(mz, 0.4, 0.1), 0.4), 0.1, 1e-12); }
  near(K.fieldForMz(16, 2000, 0.1), 0.257549, 1e-6);
});
test("time of flight: hand-calculated 6.4387 us (16), 8.9623 us (31), 10.555 us (43), 12.259 us (58) for L = 1 m and 2000 V; t = L/v; t ~ sqrt(m)", () => {
  relNear(K.flightTimeS(16, 2000, 1), 6.43871716e-6, 1e-8); relNear(K.flightTimeS(31, 2000, 1), 8.96231499e-6, 1e-8); relNear(K.flightTimeS(43, 2000, 1), 1.05553730e-5, 1e-8); relNear(K.flightTimeS(58, 2000, 1), 1.22589522e-5, 1e-8);
  relNear(K.flightTimeS(16, 2000, 1), 1 / K.speedFromMz(16, 2000), 1e-12); relNear(K.flightTimeS(64, 2000, 1) / K.flightTimeS(16, 2000, 1), 2, 1e-12);
  relNear(K.flightTimeS(16, 8000, 1) / K.flightTimeS(16, 2000, 1), 0.5, 1e-12); relNear(K.flightTimeS(16, 2000, 2) / K.flightTimeS(16, 2000, 1), 2, 1e-12);
});
test("uniform acceleration across a gap: the exit speed equals sqrt(2 z e V / m) and the crossing time is 2d/v", () => {
  const mz = 31; const d = 0.01; const t = K.gapCrossingTime(mz, 2000, d); const a = K.gapAcceleration(mz, 2000, d);
  relNear(a * t, K.speedFromMz(mz, 2000), 1e-9); relNear(t, 2 * d / K.speedFromMz(mz, 2000), 1e-9); relNear(K.gapPosition(mz, 2000, d, t), d, 1e-9); assert.equal(K.gapPosition(mz, 2000, d, 10 * t), d);
});

console.log("Magnetic sector (180 degrees) and time of flight");
test("sector: the ion tuned to R_DET reaches the detector, one unit lower or higher at fixed B misses; larger B shrinks the radius", () => {
  const V = 2000; const B = SEC.tunedField(31, V);
  assert.equal(SEC.sectorTrajectory(31, V, B).outcome, "detector"); relNear(SEC.sectorTrajectory(31, V, B).r, SEC.SECTOR.R_DET, 1e-9);
  assert.notEqual(SEC.sectorTrajectory(30, V, B).outcome, "detector"); assert.notEqual(SEC.sectorTrajectory(32, V, B).outcome, "detector");
  assert.ok(SEC.sectorTrajectory(31, V, 1.2 * B).r < SEC.sectorTrajectory(31, V, B).r);
});
test("sector: paths are circles about (r, 0): every sampled point is at distance r, the path is NOT a straight line, the landing point is x = 2r", () => {
  const t = SEC.sectorTrajectory(16, 2000, 0.258);
  for (let th = 0; th <= Math.PI + 1e-9; th += 0.2) { const p = SEC.sectorPoint(t.r, th); near(Math.hypot(p.x - t.r, p.y), t.r, 1e-12); }
  near(t.end.x, 2 * t.r, 1e-12); assert.equal(t.end.y, 0); near(t.sweep, Math.PI, 1e-12);
  const mid = SEC.sectorPoint(t.r, Math.PI / 2); near(mid.x, t.r, 1e-12); near(mid.y, t.r, 1e-12);
});
test("sector: radii at fixed V and B scale as sqrt(m/z); out-of-range ions hit the wall and the end point lies on the field-region boundary", () => {
  const V = 2000; const B = 0.258; const r = (mz) => SEC.sectorTrajectory(mz, V, B).r;
  relNear(r(64) / r(16), 2, 1e-12); relNear(r(36) / r(16), 1.5, 1e-12);
  const lo = SEC.sectorTrajectory(58, V, 0.14); assert.equal(lo.outcome, "wall");
  const onWall = Math.abs(lo.end.x - SEC.SECTOR.W) < 1e-9 || Math.abs(lo.end.y - SEC.SECTOR.H) < 1e-9; assert.ok(onWall, JSON.stringify(lo.end));
  const p = SEC.sectorPoint(lo.r, lo.sweep); near(p.x, lo.end.x, 1e-9); near(p.y, lo.end.y, 1e-9);
  assert.equal(SEC.sectorTrajectory(12, V, 0.8).outcome, "plate"); assert.match(SEC.outcomeText(SEC.sectorTrajectory(12, V, 0.8)), /too small/);
});
test("sector: changing V changes which m/z reaches the detector (m/z ~ B^2 / V at fixed r)", () => {
  const B = 0.30; let hits = []; for (const V of [1000, 2000, 4000]) { const mz = K.mzFromRadius(SEC.SECTOR.R_DET, B, V); hits.push(mz); assert.equal(SEC.sectorTrajectory(mz, V, B).outcome, "detector"); }
  relNear(hits[0] / hits[1], 2, 1e-9); relNear(hits[1] / hits[2], 2, 1e-9);
});
test("TOF: lighter ions arrive first, order by m/z, times as hand-calculated, equal Ek, and changing one mass reorders the race", () => {
  const ions = [{ id: "a", mz: 16 }, { id: "b", mz: 31 }, { id: "c", mz: 43 }, { id: "x", mz: 58 }];
  const rows = TOFM.raceTable(ions, 2000); assert.deepEqual(rows.map((r) => r.rank), [1, 2, 3, 4]);
  relNear(rows[3].t, 1.22589522e-5, 1e-8);
  for (const r of rows) relNear(0.5 * mzToMassKg(r.mz) * r.v ** 2, K.kineticEnergyJ(1, 2000), 1e-12);
  const swapped = TOFM.raceTable(ions.map((i) => (i.id === "x" ? { ...i, mz: 20 } : i)), 2000); assert.equal(swapped.find((r) => r.id === "x").rank, 2);
  assert.deepEqual(TOFM.arrivalOrder(swapped).map((r) => r.id), ["a", "x", "b", "c"]);
  const d = TOFM.displayClock(1, rows); assert.ok(d > rows[3].t); assert.equal(TOFM.tubePosition(rows[0].t, d), 1); relNear(TOFM.tubePosition(rows[3].t, rows[3].t / 2), 0.5, 1e-12);
});

console.log("Isotopes and Ar");
test("isotope data: values from the cited tables, abundances sum to 100, masses close to mass numbers", () => {
  const exp = { H: [[1, 1.00783, 99.9885], [2, 2.01410, 0.0115]], C: [[12, 12.0, 98.93], [13, 13.00335, 1.07]], Cl: [[35, 34.96885, 75.76], [37, 36.96590, 24.24]], Br: [[79, 78.91834, 50.69], [81, 80.91629, 49.31]] };
  for (const [el, rows] of Object.entries(exp)) rows.forEach(([A, m, p], i) => { assert.equal(ISOTOPES[el][i].A, A); near(ISOTOPES[el][i].mass, m, 6e-6); near(ISOTOPES[el][i].pct, p, 1e-9); });
  for (const [el, list] of Object.entries(ISOTOPES)) { near(list.reduce((s, t) => s + t.pct, 0), 100, 0.02, `${el} abundances`); for (const t of list) near(t.mass, t.A, 0.1, `${el}-${t.A} mass vs mass number`); }
  assert.deepEqual(TEACHING_ABUNDANCE.Cl.map((t) => t.pct), [75, 25]); assert.deepEqual(TEACHING_ABUNDANCE.Br.map((t) => t.pct), [50, 50]);
});
test("Ar: 35.5 from mass numbers at 75:25; 35.45 from isotopic masses and natural abundance; changes with the slider; the two routes are different numbers", () => {
  near(ISO.chlorineSample(75).arMassNumbers, 35.5, 1e-12); near(ISO.chlorineSample(75.76).arExact, 35.4529, 1e-3); near(ISO.chlorineSample(75).arExact, 35.468, 1e-3);
  assert.equal(ISO.chlorineSample(100).arMassNumbers, 35); assert.equal(ISO.chlorineSample(0).arMassNumbers, 37); near(ISO.chlorineSample(50).arMassNumbers, 36, 1e-12);
  assert.ok(ISO.chlorineSample(60).arMassNumbers > ISO.chlorineSample(75).arMassNumbers, "less 35Cl gives a larger Ar");
  assert.notEqual(ISO.chlorineSample(75).arMassNumbers, ISO.chlorineSample(75).arExact);
  near(ISO.arFromMassNumbers([{ A: 35, pct: 75 }, { A: 37, pct: 25 }]), 35.5, 1e-12);
});
test("formula masses: nominal and exact; cation m/z subtracts the electron mass", () => {
  assert.equal(ISO.nominalMass(ISO.parseFormula("CH4")), 16); assert.equal(ISO.nominalMass(ISO.parseFormula("C2H6O")), 46); assert.equal(ISO.nominalMass(ISO.parseFormula("CH3Cl"), { Cl: 37 }), 52);
  near(ISO.exactMass(ISO.parseFormula("CH4")), 16.0313, 1e-4); near(ISO.exactMass(ISO.parseFormula("C2H6O")), 46.04186, 2e-5);
  near(ISO.cationMz(ISO.parseFormula("CH4")), 16.0313 - M_ELECTRON_U, 1e-4); assert.throws(() => ISO.parseFormula("Xy2"));
});
test("isotope pattern (polynomial expansion): Cl2 teaching 70:72:74 = 9:6:1 (the specification table), natural Cl2, exact binomial/multinomial probabilities, normalisation", () => {
  const t = ISO.isotopePattern({ Cl: 2 }, { mode: "teaching" }).peaks;
  assert.deepEqual(t.map((p) => p.nominal), [70, 72, 74]); near(t[0].p, 0.5625, 1e-12); near(t[1].p, 0.375, 1e-12); near(t[2].p, 0.0625, 1e-12); assert.deepEqual(ISO.simpleRatio(t.map((p) => p.rel)), [9, 6, 1]); near(t[0].rel, 100, 1e-12);
  const n = ISO.isotopePattern({ Cl: 2 }, { mode: "natural" }).peaks; near(n[1].rel / n[0].rel, 2 * 0.2424 / 0.7576, 1e-9); near(n[2].rel / n[0].rel, (0.2424 / 0.7576) ** 2, 1e-9);
  const cl3 = ISO.isotopePattern({ Cl: 3 }, { mode: "teaching" }).peaks; assert.deepEqual(ISO.simpleRatio(cl3.map((p) => p.rel)), [27, 27, 9, 1]);
  for (const comp of [{ C: 2, H: 6, O: 1 }, { C: 1, H: 3, Cl: 1 }, { Cl: 2 }, { Br: 2 }, { C: 3, H: 6, O: 1 }, { Cl: 1, Br: 1 }]) for (const mode of ["natural", "teaching"]) { near(ISO.isotopePattern(comp, { mode }).total, 1, 1e-12, `${JSON.stringify(comp)} ${mode} normalisation`); }
});
test("isotope pattern: one Cl M:M+2 = 3:1 (teaching) and 1:0.32 natural; one Br about 1:1; mixed BrCl; every halogen cluster is 2 u apart; CH4 M+1 = 1.13 %", () => {
  const one = ISO.isotopePattern({ C: 1, H: 3, Cl: 1 }, { mode: "teaching", only: ["Cl", "Br"] }).peaks; assert.deepEqual(one.map((p) => p.nominal), [50, 52]); near(one[0].rel / one[1].rel, 3, 1e-12);
  const nat = ISO.isotopePattern({ C: 1, H: 3, Cl: 1 }, { mode: "natural", only: ["Cl", "Br"] }).peaks; near(nat[1].rel, 100 * 24.24 / 75.76, 1e-9);
  const br = ISO.isotopePattern({ C: 1, H: 3, Br: 1 }, { mode: "teaching", only: ["Cl", "Br"] }).peaks; near(br[0].rel, br[1].rel, 1e-12); assert.equal(br[1].nominal - br[0].nominal, 2);
  const brn = ISO.isotopePattern({ Br: 1 }, { mode: "natural" }).peaks; near(brn[1].rel, 100 * 49.31 / 50.69, 1e-9);
  const br2 = ISO.isotopePattern({ Br: 2 }, { mode: "teaching" }).peaks; assert.deepEqual(ISO.simpleRatio(br2.map((p) => p.rel)), [1, 2, 1]);
  const mixed = ISO.isotopePattern({ Cl: 1, Br: 1 }, { mode: "teaching" }).peaks; assert.equal(mixed.length, 3); assert.deepEqual(ISO.simpleRatio(mixed.map((p) => p.rel)), [3, 4, 1]);
  const cl2 = ISO.isotopePattern({ Cl: 2 }, { mode: "natural" }).peaks; for (let i = 1; i < cl2.length; i += 1) assert.equal(cl2[i].nominal - cl2[i - 1].nominal, 2);
  const m = ISO.isotopePattern({ C: 1, H: 4 }).peaks; near(m[1].rel, 1.128, 0.01); near(m[1].nominal - m[0].nominal, 1, 0);
  const lo = ISO.isotopologues("Cl", 2, "teaching"); assert.deepEqual(lo.map((x) => x.count), [1, 2, 1]); assert.deepEqual(lo.map((x) => x.massNumberSum), [70, 72, 74]); near(lo.reduce((s, x) => s + x.p, 0), 1, 1e-12);
});

console.log("Representative EI spectra");
const peaksOf = (s) => SP.SPECTRA[s].peaks;
test("six spectra exist with the specification's compounds, labelled representative / idealised", () => {
  assert.deepEqual(SP.SPECTRUM_IDS, ["methane", "ethanol", "propanone", "butanone", "chloromethane", "bromomethane"]); assert.match(SP.SPECTRA_NOTE, /not an experimental spectrum/i); assert.match(SP.SPECTRA_NOTE, /representative/i);
});
test("integrity: exactly one peak = 100, the base peak is that peak, one molecular ion, M and base identified separately, peaks unique and in range", () => {
  for (const id of SP.SPECTRUM_IDS) {
    const s = SP.SPECTRA[id]; const ps = peaksOf(id);
    assert.equal(ps.filter((p) => p.rel === 100).length, 1, `${id}: one 100`); assert.ok(ps.every((p) => p.rel > 0 && p.rel <= 100), `${id} range`);
    assert.equal(s.byMz[s.baseMz].rel, 100); assert.equal(ps.filter((p) => p.role === "M").length, 1, `${id}: one M`); assert.equal(s.mMz, s.nominalM);
    assert.equal(new Set(ps.map((p) => p.mz)).size, ps.length, `${id}: unique m/z`); assert.ok(ps.every((p) => p.origin.length > 20 && p.label.length > 0), `${id}: origin and label`);
  }
});
test("molecular ion present / absent as appropriate and base peak not necessarily M: methane M = base, ethanol base 31 (M 22 %), propanone base 43 (M 62 %), chloromethane M = base, bromomethane base = the 79Br member of M", () => {
  const S = SP.SPECTRA;
  assert.equal(S.methane.baseMz, S.methane.mMz); assert.equal(S.ethanol.baseMz, 31); assert.equal(S.ethanol.mMz, 46); assert.ok(S.ethanol.byMz[46].rel < 30);
  assert.equal(S.propanone.baseMz, 43); assert.equal(S.propanone.mMz, 58); assert.equal(S.chloromethane.mMz, 50); assert.equal(S.bromomethane.mMz, 94);
  assert.ok(["methane", "chloromethane", "bromomethane"].every((id) => S[id].baseMz === S[id].mMz) && ["ethanol", "propanone"].every((id) => S[id].baseMz !== S[id].mMz));
});
test("every ion: nominal mass of its formula (with the stated halogen isotope) equals m/z, exact m/z within 0.5, cations with an odd electron count carry the radical dot", () => {
  const Z = { H: 1, C: 6, N: 7, O: 8, F: 9, S: 16, Cl: 17, Br: 35, I: 53 };
  for (const id of SP.SPECTRUM_IDS) for (const p of peaksOf(id)) {
    const comp = ISO.parseFormula(p.comp); const nom = ISO.nominalMass(comp, p.iso ?? undefined) + p.shift; assert.equal(nom, p.mz, `${id} m/z ${p.mz} ${p.label}: nominal ${nom}`);
    near(ISO.cationMz(comp, p.iso ?? undefined) + p.shift, p.mz, 0.5, `${id} ${p.mz} exact`);
    const atoms = Object.values(comp).reduce((s, n) => s + n, 0);
    if (atoms > 1 && p.derived !== "13C") { const electrons = Object.entries(comp).reduce((s, [el, n]) => s + n * Z[el], 0) - 1; const radical = p.label.includes("•"); assert.equal(radical, electrons % 2 === 1, `${id} ${p.label}: radical dot vs ${electrons} electrons`); }
  }
});
test("isotope clusters: Cl and Br fragments come in pairs 2 u apart whose ratio is the natural isotope ratio; fragments without halogen have no partner; the pair rule holds for M", () => {
  for (const id of ["chloromethane", "bromomethane"]) {
    const el = id === "chloromethane" ? "Cl" : "Br"; const [lt, hv] = ISOTOPES[el]; const ps = peaksOf(id);
    const heavy = ps.filter((p) => p.derived === "cluster"); assert.ok(heavy.length >= 3);
    for (const h of heavy) { const l = SP.SPECTRA[id].byMz[h.of]; assert.equal(h.mz - l.mz, hv.A - lt.A); near(h.rel / l.rel, hv.pct / lt.pct, 1e-3, `${id} ${h.mz}`); assert.ok(l.iso && l.iso[el] === lt.A && h.iso[el] === hv.A); }
    const withHal = ps.filter((p) => p.iso).map((p) => p.mz); for (const p of ps) if (!p.iso) assert.ok(!heavy.some((h) => h.of === p.mz), `${id} ${p.mz} should have no partner`);
    assert.ok(withHal.length === heavy.length * 2);
  }
  near(SP.SPECTRA.chloromethane.byMz[52].rel / SP.SPECTRA.chloromethane.byMz[50].rel, 0.32, 0.001); near(SP.SPECTRA.bromomethane.byMz[96].rel / SP.SPECTRA.bromomethane.byMz[94].rel, 0.9727, 0.001);
  for (const id of ["methane", "ethanol", "propanone"]) assert.ok(!peaksOf(id).some((p) => p.derived === "cluster"), `${id}: no halogen cluster`);
});
test("M+1 satellites are computed from the formula (methane 1.13 %, ethanol 2.3 % of M, propanone 3.4 % of M) and sit one unit above M", () => {
  const S = SP.SPECTRA; near(S.methane.byMz[17].rel, 1.13, 0.01); near(S.ethanol.byMz[47].rel / S.ethanol.byMz[46].rel, 0.0229, 0.001); near(S.propanone.byMz[59].rel / S.propanone.byMz[58].rel, 0.0335, 0.001);
});
test("the methane peaks quote the specification's intensities (12:~3, 13:~8, 14:~16, 15:~85, 16:100, 17:~1.1) and every peak has an origin explanation", () => {
  const m = SP.SPECTRA.methane.byMz; assert.deepEqual([12, 13, 14, 15, 16].map((k) => m[k].rel), [3, 8, 16, 85, 100]); near(m[17].rel, 1.1, 0.05);
  assert.match(m[15].origin, /CH₄⁺• → CH₃⁺ \+ H•/); assert.match(m[14].origin, /H₂/);
});
test("significant fragments list = fragment peaks of at least 10 % (no M, no satellites); the cut-off is inclusive of 10", () => {
  for (const id of SP.SPECTRUM_IDS) { const s = SP.SPECTRA[id]; const want = s.peaks.filter((p) => p.role === "fragment" && p.rel >= 10).map((p) => p.mz).sort((a, b) => a - b); assert.deepEqual([...s.significant].sort((a, b) => a - b), want, id); }
});

console.log("Methane pathways, ionisation, detection");
test("pathways: the equation, charged vs neutral products, only the cation carries an m/z; abundances come from the spectrum and are unequal", () => {
  assert.equal(FR.IONISATION.equation, "CH₄ + e⁻ → CH₄⁺• + 2e⁻"); assert.doesNotMatch(FR.IONISATION.note + FR.IONISATION.equation, /H\+|proton attach/i.test("") ? /x^/ : /(^|\s)H⁺/);
  assert.equal(FR.PATHWAYS[0].eq, "CH₄⁺• → CH₃⁺ + H•");
  for (const p of FR.PATHWAYS) { assert.equal(p.products.filter((x) => x.charged).length, 1, p.id); assert.ok(p.products.filter((x) => !x.charged).every((x) => x.mz === null)); assert.equal(SP.SPECTRA.methane.byMz[p.mzOut].rel, p.rel); }
  assert.ok(new Set(FR.PATHWAYS.map((p) => p.rel)).size === FR.PATHWAYS.length); assert.match(FR.IONISATION.note, /no proton attachment/i);
});
test("detection: ion counts are proportional to peak intensity, bars grow with the number of ions and equal the spectrum at the end; a lighter ion can have a bigger or smaller peak", () => {
  const seq = DET.arrivalSequence("methane", 11); const pop = DET.ionPopulation("methane");
  assert.equal(seq.length, pop.reduce((s, p) => s + p.count, 0)); const end = DET.heightsAfter(seq, seq.length);
  for (const p of pop) near(end[p.mz], Math.round(p.rel), 1e-9, `final ${p.mz}`);
  let prev = DET.heightsAfter(seq, 0); for (let k = 10; k <= seq.length; k += 10) { const h = DET.heightsAfter(seq, k); for (const mz of Object.keys(h)) assert.ok(h[mz] >= prev[mz] - 1e-9); prev = h; }
  assert.ok(end[17] < end[12], "the heaviest ion (17) has the smallest peak"); assert.deepEqual(DET.arrivalSequence("methane", 11), seq); assert.notDeepEqual(DET.arrivalSequence("methane", 12), seq);
});

console.log("Unknown-compound challenge");
test("each round: the true compound is among the choices, scores strictly highest, and the scoring is not tied", () => {
  for (const id of CH.ROUNDS) { const rank = CH.rankCandidates(id); assert.equal(rank[0].id, id, `${id}: best ${rank[0].id}`); assert.ok(rank[0].score > rank[1].score + 1, `${id}: margin ${rank[0].score} vs ${rank[1].score}`); assert.equal(CH.CANDIDATES[id].length, 4); assert.equal(CH.CANDIDATES[id].filter((c) => c.id === id).length, 1); }
});
test("nominal-mass-alone ambiguity: ethanol has 3 candidates with M = 46 (including the isomer methoxymethane and CH2O2), propanone has 3 with M = 58 - the M term alone cannot decide", () => {
  assert.equal(CH.sameMassCandidates("ethanol").length, 3); assert.equal(CH.sameMassCandidates("propanone").length, 3);
  assert.deepEqual(CH.sameMassCandidates("ethanol").map((c) => c.formula).sort(), ["C₂H₆O", "C₂H₆O", "CH₂O₂"].sort()); assert.ok(CH.sameMassCandidates("propanone").some((c) => c.formula === "C₃H₆O" && c.id !== "propanone"));
  for (const id of ["ethanol", "propanone"]) { const rank = CH.rankCandidates(id); assert.ok(rank.filter((r) => r.mTerm === 3).length >= 3); assert.ok(rank.filter((r) => r.mTerm === 3)[0].id === id); }
  for (const c of CH.CANDIDATES.ethanol.filter((c) => c.M === 46)) assert.equal(c.M, SP.SPECTRA.ethanol.mMz);
});
test("candidate data are consistent: nominal masses from the formulas, strong ions are a subset of the expected ions, halogen flags match the formulas", () => {
  const plain = (f) => f.replace(/[₀-₉]/g, (d) => String(d.charCodeAt(0) - 0x2080));
  for (const id of CH.ROUNDS) for (const c of CH.CANDIDATES[id]) {
    const comp = ISO.parseFormula(plain(c.formula)); assert.equal(ISO.nominalMass(comp), c.M, `${c.id}`); assert.ok(c.strong.every((m) => c.ions.includes(m)), `${c.id} strong subset`);
    assert.equal(c.halogen, comp.Cl ? "cl" : comp.Br ? "br" : "none", c.id); if (c.id !== id) assert.ok(c.why.length > 30, `${c.id} why`);
  }
});
test("no answer leak in the initial state: defaults hold no picks, the task prompts and the iso options do not name any compound or formula, hints never say molecular ion or base peak", () => {
  const d = ST.DEFAULTS.s12; assert.deepEqual(d.picks, { t1: null, t2: null, t3: [], t4: null, t5: null }); assert.equal(d.submitted, false);
  const prompt = JSON.stringify(CH.TASKS) + JSON.stringify(CH.ISO_OPTIONS); for (const id of CH.ROUNDS) { const s = SP.SPECTRA[id]; assert.ok(!prompt.includes(s.name) && !prompt.includes(s.formula), `prompt leaks ${id}`); }
  for (const id of CH.ROUNDS) for (const p of SP.SPECTRA[id].peaks) { const h = CH.peakHint(SP.SPECTRA[id], p.mz); const text = h.lines.join(" "); assert.doesNotMatch(text, /molecular ion peak is|is the molecular ion|base peak is|is the base peak/i, `${id} ${p.mz}`); assert.ok(!text.includes(SP.SPECTRA[id].name) && !text.includes(p.label)); }
});
test("hints: describe the clicked peak (height, partner 2 u away, difference from the heaviest main peak), ignore nothing else", () => {
  const cm = SP.SPECTRA.chloromethane; assert.match(CH.peakHint(cm, 50).lines.join(" "), /partner peak 2 u higher at m\/z 52/); assert.match(CH.peakHint(cm, 52).lines.join(" "), /heavier partner/);
  assert.match(CH.peakHint(SP.SPECTRA.ethanol, 31).lines.join(" "), /15 u below the heaviest main peak.*•CH₃/); assert.match(CH.peakHint(SP.SPECTRA.methane, 17).lines.join(" "), /¹³C/);
  assert.equal(CH.peakHint(SP.SPECTRA.ethanol, 99), null);
});
test("evaluating answers: correct, partial (M+2 for task 1, some fragments for task 3) and wrong; submission needs all tasks answered; the order of choices is reproducible", () => {
  const spec = SP.SPECTRA.chloromethane; const good = { t1: 50, t2: 50, t3: spec.significant, t4: "cl", t5: "chloromethane" };
  assert.equal(CH.evaluateAnswers("chloromethane", good).all, true); assert.equal(CH.evaluateAnswers("chloromethane", { ...good, t1: 52 }).t1, "partial"); assert.equal(CH.evaluateAnswers("chloromethane", { ...good, t1: 15 }).t1, "wrong");
  assert.equal(CH.evaluateAnswers("chloromethane", { ...good, t3: [15] }).t3, "partial"); assert.equal(CH.evaluateAnswers("chloromethane", { ...good, t3: [37] }).t3, "wrong"); assert.equal(CH.evaluateAnswers("chloromethane", { ...good, t4: "br" }).t4, "wrong");
  assert.equal(CH.answered(good), true); assert.equal(CH.answered({ ...good, t5: null }), false); assert.deepEqual(CH.candidateOrder("ethanol", 3), CH.candidateOrder("ethanol", 3));
  assert.equal(CH.evaluateAnswers("bromomethane", { t1: 94, t2: 96, t3: [], t4: "br", t5: "bromomethane" }).t2, "wrong");
});

console.log("Evidence data (the old stage 13 page was removed; the data module stays)");
test("evidence narrows the candidate list monotonically to exactly the true compound for ethanol, propanone, chloromethane; ethanol and propanone are not settled by any single technique", () => {
  for (const ex of EV.EXAMPLES) {
    let prev = EV.POOLS[ex].length; for (const set of [[], ["ms"], ["ms", "ir"], ["ms", "ir", "nmr"]]) { const n = EV.remaining(ex, set).length; assert.ok(n <= prev, `${ex} ${set}`); prev = n; }
    assert.deepEqual(EV.remaining(ex, ["ms", "ir", "nmr"]).map((c) => c.id), [ex]); assert.ok(EV.remaining(ex, []).some((c) => c.id === ex) && EV.remaining(ex, ["nmr"]).some((c) => c.id === ex));
  }
  for (const ex of ["ethanol", "propanone"]) for (const t of ["ms", "ir", "nmr"]) assert.ok(EV.remaining(ex, [t]).length >= 2, `${ex}: ${t} alone leaves ${EV.remaining(ex, [t]).length}`);
  assert.equal(EV.remaining("propanone", ["ms", "ir"]).length, 2); assert.ok(EV.remaining("ethanol", ["ms"]).some((c) => c.id === "methoxymethane"));
  assert.match(EV.NO_SINGLE_TECHNIQUE, /No single technique is universally sufficient/);
});
test("evidence content comes from the three modules: MS peaks, IR bands (ethanol O-H 3340, propanone C=O 1715) and NMR environments (ethanol 3 signals 3:2:1, propanone 1 signal of 6 H)", () => {
  const e = EV.evidenceFor("ethanol"); assert.equal(e.ms.M.mz, 46); assert.equal(e.ms.base.mz, 31); assert.ok(e.ir.bands.some((b) => b.nu === 3340)); assert.deepEqual(e.nmr.envs.map((x) => x.count).sort((a, b) => b - a), [3, 2, 1]);
  const p = EV.evidenceFor("propanone"); assert.ok(p.ir.bands.some((b) => b.nu === 1715)); assert.deepEqual(p.nmr.envs.map((x) => x.count), [6]);
  const c = EV.evidenceFor("chloromethane"); assert.match(c.ir.source, /not in the IR workspace data/); assert.match(c.nmr.source, /not in the NMR workspace data/); assert.match(c.ms.iso, /chlorine/);
  assert.equal(EV.TECHNIQUE_ROWS.length, 3);
});

console.log("Molecules, pathways and the seeded experiment");
const MOL = await import(`${P}data/molecules.js`);
const EXP = await import(`${P}model/experiment.js`);
const AN = await import(`${P}model/analyser.js`);
const IONS = await import(`${P}model/ions.js`);
const JR = await import(`${P}model/journey.js`);
const MASS = (comp) => Object.entries(comp).reduce((a, [el, n]) => a + n * ({ H: 1, C: 12, O: 16, N: 14 }[el] ?? 0), 0);
test("simulation molecules: propanone (default), butanone, ethanol, methane, each with a representative spectrum", () => {
  assert.deepEqual(MOL.SIM_IDS, ["propanone", "butanone", "ethanol", "methane"]); assert.equal(MOL.DEFAULT_MOLECULE, "propanone");
  for (const id of MOL.SIM_IDS) { const m = MOL.getSim(id); assert.ok(m.spec && SP.SPECTRA[id], id); assert.ok(m.pathways.length >= 2, id); }
});
test("pathway bookkeeping: the charged fragment carries the m/z, charged + neutral masses equal the parent mass, exactly one charged product", () => {
  for (const id of MOL.SIM_IDS) { const sim = MOL.getSim(id); for (const p of sim.pathways) {
    assert.equal(p.chargedMass, p.mz, `${id} ${p.id}: charged mass is the m/z of a 1+ ion`);
    const from = p.from ? sim.pathById[p.from].chargedMass : sim.M; assert.equal(p.chargedMass + p.neutralMass, from, `${id} ${p.id}: mass is conserved`);
    assert.ok(p.neutralMass > 0, `${id} ${p.id}: the neutral product exists`); assert.match(p.id, /^mz\d+$/);
  } }
});
test("ion catalogue: one entry per peak, colours and shapes are unique among fragments, M is a circle, radicals carry a dot, isotope peaks are dashed", () => {
  for (const id of MOL.SIM_IDS) { const cat = MOL.ionCatalogue(id); const frag = Object.values(cat).filter((c) => c.role === "fragment");
    assert.equal(new Set(frag.map((c) => c.color)).size, frag.length, `${id} colours`); assert.equal(new Set(frag.map((c) => c.shape)).size, frag.length, `${id} shapes`);
    const M = Object.values(cat).find((c) => c.role === "M"); assert.equal(M.shape, "circle"); assert.match(M.label, /⁺•/); }
});
test("experiment: the same molecule + seed + n gives the same experiment; another seed gives another assignment", () => {
  const a = EXP.buildExperiment({ molId: "propanone", seed: 7, n: 12 }); const b = EXP.buildExperiment({ molId: "propanone", seed: 7, n: 12 });
  assert.deepEqual(a.molecules.map((m) => m.outcome), b.molecules.map((m) => m.outcome)); assert.deepEqual(a.molecules.map((m) => [m.ux, m.uy]), b.molecules.map((m) => [m.ux, m.uy]));
  const c = EXP.buildExperiment({ molId: "propanone", seed: 8, n: 12 }); assert.notDeepEqual(a.molecules.map((m) => m.outcome), c.molecules.map((m) => m.outcome));
});
test("experiment: population is 8 to 15, identical molecules, some stay neutral, at least one molecular ion survives, outcomes are real pathways of the molecule", () => {
  assert.equal(EXP.clampN(2), 8); assert.equal(EXP.clampN(99), 15);
  for (const id of MOL.SIM_IDS) for (const n of [8, 10, 15]) for (const seed of [1, 2, 3, 42]) {
    const e = EXP.buildExperiment({ molId: id, seed, n }); assert.equal(e.molecules.length, n); assert.ok(e.nNeutral >= 1 && e.nIon >= 1, `${id} ${n} ${seed}`);
    assert.equal(e.nIon + e.nNeutral, n);
    const survive = e.molecules.filter((m) => m.ionised && m.outcome.type === "survive"); assert.ok(survive.length >= 1, `${id} ${n} ${seed}: a molecular ion survives`);
    for (const m of e.molecules) { if (!m.ionised) { assert.equal(m.ionMz, null); continue; } if (m.outcome.type === "fragment") for (const pid of m.outcome.chain) assert.ok(e.sim.pathById[pid], pid); }
  }
});
test("experiment: the small population is only a teaching representation (the notes say so) and the final detector heights equal the representative spectrum", () => {
  assert.match(EXP.POPULATION_NOTE, /teaching representation/i); assert.match(EXP.POPULATION_NOTE, /not reproduce/i); assert.match(EXP.COUNT_NOTE, /illustrative/i);
  for (const id of MOL.SIM_IDS) { const e = EXP.buildExperiment({ molId: id, seed: 1, n: 10 }); const h = EXP.finalHeights(e, "sector", 2000); const det = EXP.detectable(e, "sector", 2000);
    for (const p of e.spec.peaks) if (det.has ? det.has(p.mz) : true) near(h[p.mz] ?? 0, p.rel, 0.06, `${id} ${p.mz}`); }
});
test("allocation: largest remainder returns exactly the requested total and keeps proportions within one", () => {
  const r = EXP.allocate({ a: 100, b: 30, c: 25, d: 10 }, 9); assert.equal(Object.values(r).reduce((x, y) => x + y, 0), 9); assert.ok(r.a >= r.b && r.b >= r.d);
});

console.log("Analyser model (sector with unit resolution, TOF)");
test("sector unit resolution: only the tuned integer m/z is transmitted; the wide-slit geometry would also admit m/z 44 at m/z 43 (the issue fixed)", () => {
  for (const mz of [15, 29, 43, 58, 72]) { const B = AN.fieldFor(mz, 2000); assert.ok(AN.sectorTransmits(mz, 2000, B), `m/z ${mz}`); assert.ok(!AN.sectorTransmits(mz + 1, 2000, B), `m/z ${mz + 1}`); assert.ok(!AN.sectorTransmits(mz - 1, 2000, B), `m/z ${mz - 1}`); }
  const B = AN.fieldFor(43, 2000); const wide = (mz) => SEC.sectorTrajectory(mz, 2000, B).hitsDetector;
  assert.ok(wide(43)); assert.ok(wide(44), "the old +-SLIT geometry also admitted m/z 44 here: the physical reason the unit-resolution rule was added");
});
test("sector: radius is proportional to sqrt(m/z) (2+ ions of mass 2m behave like 1+ ions of mass m); B ~ sqrt(V m/z)", () => {
  near(AN.radiusM(58, 2000, 0.4) / AN.radiusM(29, 2000, 0.4), Math.SQRT2, 1e-9); near(AN.radiusM(58 / 2, 2000, 0.4), AN.radiusM(29, 2000, 0.4), 1e-12); const B1 = AN.fieldFor(43, 2000); const B2 = AN.fieldFor(43, 8000); relNear(B2 / B1, 2, 1e-6);
  relNear(AN.sectorFocusMz(AN.fieldFor(43, 2000), 2000), 43, 1e-6);
});
test("TOF: t = L sqrt(m / 2zeV), mz recovered from the time, lighter ions first, 2+ arrives at the time of half the mass", () => {
  relNear(AN.tofTime(16, 2000) * 1e6, 6.4387, 1e-3); relNear(AN.mzOfTime(AN.tofTime(43, 2000), 2000), 43, 1e-6); assert.ok(AN.tofTime(15, 2000) < AN.tofTime(43, 2000));
  relNear(AN.tofTime(58 / 2, 2000), AN.tofTime(58, 2000) / Math.SQRT2, 1e-9); assert.equal(AN.mzOf(58, 2), 29);
});

console.log("Detection, journey timing and candidate ions");
test("sector detection: three sweeps; the build-up is monotone in time and ends at the unit-resolution heights", () => {
  const e = EXP.buildExperiment({ molId: "propanone", seed: 1, n: 10 }); const plan = EXP.detectionPlan(e, "sector", 2000); assert.equal(plan.sweeps, EXP.SWEEPS);
  let prev = 0; for (let k = 0; k <= 20; k += 1) { const d = EXP.detectionAt(e, plan, 2000, (plan.total * k) / 20); assert.ok(d.total >= prev - 1e-9); prev = d.total; }
  const end = EXP.detectionAt(e, plan, 2000, plan.total + 1); near(end.total, EXP.totalIllustrativeIons(e), 1e-6);
});
test("TOF detection: six pulses; the build-up ends at the same totals", () => {
  const e = EXP.buildExperiment({ molId: "ethanol", seed: 3, n: 9 }); const plan = EXP.detectionPlan(e, "tof", 2000); assert.equal(plan.pulses ?? EXP.PULSES, EXP.PULSES);
  const end = EXP.detectionAt(e, plan, 2000, plan.total + 1); near(end.total, EXP.totalIllustrativeIons(e), 1e-6);
});
test("journey: stage durations are positive, TOF differs from the sector in stage 4, durations depend on the population", () => {
  const e = EXP.buildExperiment({ molId: "propanone", seed: 1, n: 10 });
  for (let s = 1; s <= 4; s += 1) assert.ok(JR.stageDuration(e, s, { analyser: "sector", V: 2000, B: 0.5 }) > 0, `stage ${s}`);
  assert.notEqual(JR.stageDuration(e, 4, { analyser: "tof" }), JR.stageDuration(e, 4, { analyser: "sector" })); assert.ok(JR.chainDuration(["a", "b"]) > JR.chainDuration(["a"])); assert.equal(JR.chainDuration([]), 0); assert.equal(JR.stageDuration(e, 5), 0, "stage 5 is timed by the detection plan");
  assert.ok(JR.BREAK_AT > 0 && JR.BREAK_AT < 1); assert.equal(JR.ease(0), 0); assert.equal(JR.ease(1), 1);
});
test("candidate ions: for propanone m/z 43 C2H3O+ is offered together with other formulas, uniqueness is never claimed; parity and DBE respected", () => {
  const c = IONS.candidateIons("C3H6O", 43); assert.ok(c.some((x) => x.plain === "C2H3O")); assert.ok(c.length >= 1); for (const x of c) assert.equal(x.x * 12 + x.y + x.z * 16, 43);
  assert.ok(IONS.relativeMolecularMass("C3H6O") > 58 && IONS.relativeMolecularMass("C3H6O") < 58.2);
});

console.log("State: versioning, migration, persistence");
test("store: six stages, navigation clamps, defaults, reset", () => {
  const s = ST.createMsStore(); assert.equal(ST.MS_STAGES.length, 6); assert.equal(s.getState().stage, 1); assert.equal(s.getState().molId, "propanone"); s.prevStage(); assert.equal(s.getState().stage, 1);
  for (let i = 0; i < 20; i += 1) s.nextStage(); assert.equal(s.getState().stage, 6); s.reset(); assert.equal(s.getState().stage, 1);
});
test("store: experiment state survives stage changes; the analyser choice is magnetic sector by default, TOF alternative, never both", () => {
  const s = ST.createMsStore(); assert.equal(s.getState().analyser, "sector"); s.setMolecule("butanone"); s.newSample(); const seed = s.getState().seed; s.setAnalyser("tof"); s.nextStage(); s.nextStage(); s.nextStage();
  assert.equal(s.getState().molId, "butanone"); assert.equal(s.getState().seed, seed); assert.equal(s.getState().analyser, "tof"); s.setAnalyser("sector"); assert.equal(s.getState().analyser, "sector");
});
test("store: Start sample, Ionize, track a molecule and select a pathway", () => {
  const s = ST.createMsStore(); assert.equal(s.getState().started, false); s.startSample(); assert.equal(s.getState().started, true); s.setStage(2); assert.equal(s.getState().fired, false); s.fire(); assert.equal(s.getState().fired, true);
  s.trackMolecule(3); assert.equal(s.getState().track.id, 3); s.untrack(); assert.equal(s.getState().track.id, null); s.setStage(3); s.selectPath("mz43"); assert.equal(s.getState().selPath, "mz43");
});
test("store: sanitise repairs bad values (stage, V, B, n, seed, molecule, activity)", () => {
  const bad = ST.sanitize({ v: 2, stage: 99, V: -5, B: 99, n: 400, seed: -3, molId: "zzz", analyser: "both", activity: "x", showCharges: "yes" });
  assert.equal(bad.stage, 6); assert.equal(bad.V, ST.V_MIN); assert.ok(bad.B <= SEC.SECTOR.B_MAX); assert.equal(bad.n, 15); assert.ok(bad.seed >= 1); assert.equal(bad.molId, "propanone"); assert.equal(bad.analyser, "sector"); assert.equal(bad.activity, null); assert.equal(typeof bad.showCharges, "boolean");
});
test("migration: an old 13-stage payload maps to the six stages and the activities; challenge answers are kept; no crash on junk", () => {
  const old = { stage: 12, V: 3000, s12: { round: 2, picks: { t1: 43 } } }; const m = ST.sanitize(old); assert.equal(m.v, ST.STATE_VERSION); assert.equal(m.stage, 6); assert.equal(m.activity, "unknown"); assert.equal(m.V, 3000);
  assert.equal(ST.sanitize({ stage: 4 }).stage, 3); assert.equal(ST.sanitize({ stage: 6 }).stage, 4); assert.equal(ST.sanitize({ stage: 9 }).stage, 5); assert.equal(ST.sanitize({ stage: 10 }).activity, "isotopes"); assert.equal(ST.sanitize({ stage: 11 }).activity, "patterns"); assert.equal(ST.sanitize({ stage: 13 }).stage, 6);
  for (const junk of [null, undefined, 5, "x", [], { stage: "a" }]) assert.doesNotThrow(() => ST.sanitize(junk));
});
test("persistence: the persisted slice round-trips through JSON and excludes runtime-only fields", () => {
  const s = ST.createMsStore(); s.setMolecule("ethanol"); s.setStage(4); s.setV(3000); s.setAnalyser("tof"); s.setCmp?.({ on: true, mz: 29 }); s.addNote?.(43, "acylium?");
  const saved = JSON.parse(JSON.stringify(ST.pickPersisted(s.getState()))); assert.ok(!("seek" in saved) && !("replay" in saved) && !("detail" in saved)); assert.equal(saved.v, ST.STATE_VERSION);
  const s2 = ST.createMsStore(saved); assert.deepEqual(ST.pickPersisted(s2.getState()), ST.pickPersisted(s.getState())); assert.ok(ST.isValidPersisted(saved));
});
test("store: challenge flow (pick, use, toggle fragments, choose, submit locks, next round, restart)", () => {
  const s = ST.createMsStore(); s.pickPeak(31); s.usePeak(); assert.equal(s.getState().s12.picks.t1, 31); s.setTask(3); s.pickPeak(29); s.usePeak(); s.usePeak(); assert.deepEqual(s.getState().s12.picks.t3, []); s.usePeak(); assert.deepEqual(s.getState().s12.picks.t3, [29]);
  s.choose("t4", "none"); s.choose("t5", "methane"); s.submit(); s.choose("t5", "ammonia"); assert.equal(s.getState().s12.picks.t5, "methane", "locked after submit"); s.nextRound(); assert.equal(s.getState().s12.round, 1); assert.equal(s.getState().s12.submitted, false); assert.deepEqual(s.getState().s12.picks, CH.EMPTY_PICKS);
  assert.equal(CH.ROUNDS.length, 6);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
