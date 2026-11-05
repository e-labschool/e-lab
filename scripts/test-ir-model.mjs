#!/usr/bin/env node
// Pure tests of the IR spectroscopy model:  node scripts/test-ir-model.mjs
// Normal modes (orthogonality, no translation / rotation, wavenumbers), IR activity (dipole-derivative rule), absorption response, spectrum builder,
// data consistency (ranges, sources), unknown-challenge uniqueness and the FTIR interferogram <-> spectrum transform. No DOM.
import assert from "node:assert/strict";
import { register } from "node:module";
register("./jsx-loader-hooks.mjs", import.meta.url);

const P = "../src/engines/spectroscopy-studio/ir/";
const { getModeCatalog, getMode, EXPLORER_MOLECULES } = await import(`${P}physics/modeCatalog.js`);
const { ALL_DEFS } = await import(`${P}physics/molecules.js`);
const { computeNormalModes, diagnostics, modeGroups } = await import(`${P}physics/normalModes.js`);
const { dipoleDerivative, netCharge, ACTIVE_THRESHOLD } = await import(`${P}physics/dipole.js`);
const { absorption, frequencyMatch, absorptionState, TEACHING_HWHM, lorentz } = await import(`${P}physics/absorption.js`);
const SP = await import(`${P}physics/spectrum.js`);
const { SPEC_GROUPS, INTERPRET_GROUPS, GROUP_BY_ID } = await import(`${P}physics/functionalGroups.js`);
const { COMPOUNDS, INTERPRET_SET } = await import(`${P}data/compounds.js`);
const CH = await import(`${P}physics/challenge.js`);
const GS = await import(`${P}physics/gasSpectrum.js`);
const { groupsAt } = await import(`${P}physics/functionalGroups.js`);
const FT = await import(`${P}physics/interferometer.js`);
const { ORGANICS, groupStretchMode, groupAtoms, hasGroup } = await import(`${P}data/organics.js`);
const { eckartVectors } = await import(`${P}physics/normalModes.js`);
const { energyJ, energyKJmol, populationRatio, wavelengthUm } = await import(`${P}physics/constants.js`);

let passed = 0; let failed = 0;
function test(name, fn) { try { fn(); console.log(`  ok   ${name}`); passed += 1; } catch (e) { console.log(`  FAIL ${name}\n       ${(e.stack || e.message).split("\n").slice(0, 5).join("\n       ")}`); failed += 1; } }
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} ${a} vs ${b} (tol ${tol})`);
const dotv = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);

console.log("Normal modes");
const EXPECT_N = { hcl: 1, n2: 1, h2o: 3, co2: 4, ch4: 9, ethanol: 21 };
for (const id of Object.keys(ALL_DEFS)) {
  const def = ALL_DEFS[id]; const set = computeNormalModes(def);
  test(`${id}: ${EXPECT_N[id]} vibrations (3N-6 or 3N-5), all real and positive, ascending`, () => {
    assert.equal(set.modes.length, EXPECT_N[id]);
    for (let i = 0; i < set.modes.length; i += 1) { assert.ok(set.modes[i].lambda > 0, `lambda ${i}`); if (i) assert.ok(set.modes[i].wavenumber >= set.modes[i - 1].wavenumber - 1e-9, "ascending"); }
  });
  test(`${id}: modes orthonormal in mass-weighted coordinates, orthogonal to translations / rotations`, () => {
    const d = diagnostics(set, def); assert.ok(d.maxOrtho < 1e-9, `ortho ${d.maxOrtho}`); assert.ok(d.maxTR < 1e-9, `TR ${d.maxTR}`);
  });
  test(`${id}: zero linear momentum (centre of mass fixed) and zero angular momentum (no net rotation) for every mode`, () => {
    for (const m of set.modes) {
      let scale = 0; def.atoms.forEach((a, i) => { scale += set.masses[i] * Math.hypot(m.dispRaw[3 * i], m.dispRaw[3 * i + 1], m.dispRaw[3 * i + 2]); });
      const p = [0, 0, 0]; const L = [0, 0, 0]; const M = set.masses.reduce((s, x) => s + x, 0);
      const com = [0, 1, 2].map((k) => def.atoms.reduce((s, a, i) => s + set.masses[i] * a.pos[k], 0) / M);
      def.atoms.forEach((a, i) => { const dv = [m.dispRaw[3 * i], m.dispRaw[3 * i + 1], m.dispRaw[3 * i + 2]]; const r = a.pos.map((v, k) => v - com[k]);
        for (let k = 0; k < 3; k += 1) p[k] += set.masses[i] * dv[k]; L[0] += set.masses[i] * (r[1] * dv[2] - r[2] * dv[1]); L[1] += set.masses[i] * (r[2] * dv[0] - r[0] * dv[2]); L[2] += set.masses[i] * (r[0] * dv[1] - r[1] * dv[0]); });
      assert.ok(Math.hypot(...p) < 1e-9 * scale, `momentum ${Math.hypot(...p)}`); assert.ok(Math.hypot(...L) < 1e-9 * scale * 3, `angular momentum ${Math.hypot(...L)}`);
    }
  });
}
test("neutral molecules: partial charges sum to zero (so the dipole does not depend on the origin)", () => { for (const d of Object.values(ALL_DEFS)) near(netCharge(d.atoms), 0, 1e-9, d.id); });

console.log("Wavenumbers (gas phase, representative literature fundamentals)");
const LIT = { hcl: [2886], n2: [2330], h2o: [1595, 3657, 3756], co2: [667, 1388, 2349], ch4: [1306, 1534, 2917, 3019] };
for (const [id, wns] of Object.entries(LIT)) {
  test(`${id}: harmonic model reproduces the fundamentals ${wns.join(", ")} cm-1 within 0.5 %`, () => {
    const g = modeGroups(computeNormalModes(ALL_DEFS[id])); assert.equal(g.length, wns.length);
    g.forEach((m, i) => near(m.wavenumber, wns[i], 0.005 * wns[i], `${id} #${i}`));
  });
}
test("shown wavenumbers are the literature values", () => {
  const w = (m, k) => getMode(m, k).wn; assert.equal(w("hcl", "stretch"), 2886); assert.deepEqual(["bend", "sym", "asym"].map((k) => w("h2o", k)), [1595, 3657, 3756]);
  assert.deepEqual(["bend", "sym", "asym"].map((k) => w("co2", k)), [667, 1388, 2349]); assert.deepEqual(["t2bend", "ebend", "sym", "t2stretch"].map((k) => w("ch4", k)), [1306, 1534, 2917, 3019]);
});
test("expected degeneracies: CO2 bend x2, CH4 T2 x3, E x2; HCl, H2O non-degenerate", () => {
  assert.equal(getMode("co2", "bend").degeneracy, 2); assert.equal(getMode("ch4", "t2bend").degeneracy, 3); assert.equal(getMode("ch4", "t2stretch").degeneracy, 3); assert.equal(getMode("ch4", "ebend").degeneracy, 2); assert.equal(getMode("ch4", "sym").degeneracy, 1);
  assert.ok(getModeCatalog("h2o").modes.every((m) => m.degeneracy === 1));
});
test("ethanol: representative modes only, within 3 % of the representative group frequencies, flagged simplified", () => {
  const c = getModeCatalog("ethanol"); assert.equal(c.modes.length, 7); assert.ok(c.modes.every((m) => m.simplified));
  for (const m of c.modes) near(m.modelWn, m.wn, 0.03 * m.wn, m.id);
  assert.deepEqual(c.modes.map((m) => m.id), ["oh", "ch3-asym", "ch3-sym", "hch", "co", "cc", "cco"]);
});

console.log("Displacement patterns have the right character");
const dd = (m, i) => m.disp[i];
test("HCl: the light H moves ~35x more than Cl (centre of mass fixed), along the bond", () => {
  const m = getMode("hcl", "stretch"); const r = Math.abs(dd(m, 0)[2]) / Math.abs(dd(m, 1)[2]); near(r, 34.9688527 / 1.00782503, 0.01, "mass ratio"); assert.ok(dd(m, 0)[2] * dd(m, 1)[2] < 0, "opposite directions"); near(Math.hypot(dd(m, 0)[0], dd(m, 0)[1]), 0, 1e-9);
});
test("H2O: symmetric stretch = the two H move mirror-symmetrically, asymmetric = mirror-antisymmetric, bend lies in the molecular plane", () => {
  const R = (v) => [-v[0], v[1], v[2]];
  const sym = getMode("h2o", "sym"); const asym = getMode("h2o", "asym"); const bend = getMode("h2o", "bend");
  assert.ok(dotv(dd(sym, 2), R(dd(sym, 1))) / dotv(dd(sym, 1), dd(sym, 1)) > 0.99, "sym"); assert.ok(dotv(dd(asym, 2), R(dd(asym, 1))) / dotv(dd(asym, 1), dd(asym, 1)) < -0.99, "asym");
  // stretching: each H moves mostly along its own O-H bond
  for (const m of [sym, asym]) { const u = ALL_DEFS.h2o.atoms[1].pos.map((v, k) => v - ALL_DEFS.h2o.atoms[0].pos[k]); const n = Math.hypot(...u); const d = dd(m, 1); assert.ok(Math.abs(dotv(d, u)) / (n * Math.hypot(...d)) > 0.9, "along the bond"); }
  // bending: H motion mostly perpendicular to its bond
  { const u = ALL_DEFS.h2o.atoms[1].pos; const n = Math.hypot(...u); const d = dd(bend, 1); assert.ok(Math.abs(dotv(d, u)) / (n * Math.hypot(...d)) < 0.5, "bend perpendicular to the bond"); }
  for (const m of [sym, asym, bend]) for (let i = 0; i < 3; i += 1) near(dd(m, i)[1], 0, 1e-9, "stays in the xz plane");
});
test("CO2: sym stretch (O move apart, C fixed), asym stretch (O together, C opposite), bend (transverse; O together, C opposite)", () => {
  const sym = getMode("co2", "sym"); const asym = getMode("co2", "asym"); const bend = getMode("co2", "bend");
  near(Math.hypot(...dd(sym, 1)), 0, 1e-9, "C fixed"); assert.ok(dd(sym, 0)[2] * dd(sym, 2)[2] < 0, "O move in opposite directions"); near(Math.abs(dd(sym, 0)[2]), Math.abs(dd(sym, 2)[2]), 1e-9);
  assert.ok(dd(asym, 0)[2] * dd(asym, 2)[2] > 0, "both O same direction"); assert.ok(dd(asym, 1)[2] * dd(asym, 0)[2] < 0, "C opposite"); near(dd(asym, 1)[2] / dd(asym, 0)[2], -2 * 15.9949146 / 12, 1e-6, "momentum balance 2 m_O d_O + m_C d_C = 0");
  const t = (m, i) => Math.hypot(dd(m, i)[0], dd(m, i)[1]); assert.ok(t(bend, 0) > 0.3 && t(bend, 1) > 0.9, "transverse (C moves most: lightest-weighted balance)"); near(Math.abs(dd(bend, 0)[2]) + Math.abs(dd(bend, 2)[2]), 0, 1e-6, "no motion along the axis (first order)");
  assert.ok(dotv(dd(bend, 0), dd(bend, 2)) > 0 && dotv(dd(bend, 0), dd(bend, 1)) < 0, "O together, C opposite");
});
test("CH4: A1 stretch = all four H radially outward in phase with C fixed; T2 stretch and E bend are not totally symmetric", () => {
  const def = ALL_DEFS.ch4; const radial = (m) => [1, 2, 3, 4].map((i) => dotv(dd(m, i), def.atoms[i].pos.map((v) => v / Math.hypot(...def.atoms[i].pos))));
  const a1 = getMode("ch4", "sym"); const r = radial(a1); near(Math.hypot(...dd(a1, 0)), 0, 1e-9, "C fixed"); r.forEach((v) => near(v, r[0], 1e-9)); assert.ok(Math.abs(r[0]) > 0.99, "purely radial");
  const t2 = getMode("ch4", "t2stretch"); near(radial(t2).reduce((s, v) => s + v, 0), 0, 1e-9, "radial sum zero for T2"); assert.ok(Math.hypot(...dd(t2, 0)) > 0.05, "C moves in T2");
  const e = getMode("ch4", "ebend"); near(Math.hypot(...dd(e, 0)), 0, 1e-9, "C fixed in the E bend");
});
test("ethanol: O-H stretch is localised (H moves along the O-H bond, almost nothing else)", () => {
  const def = ALL_DEFS.ethanol; const m = getMode("ethanol", "oh"); const mol = def.molecule; const o = mol.atoms.findIndex((a) => a.el === "O"); const h = mol.atoms.findIndex((a) => a.isHydrogen && mol.atoms[a.parent].el === "O");
  const u = def.atoms[h].pos.map((v, k) => v - def.atoms[o].pos[k]); const n = Math.hypot(...u); assert.ok(Math.abs(dotv(m.disp[h], u)) / (n * Math.hypot(...m.disp[h])) > 0.99, "along the bond"); near(Math.hypot(...m.disp[h]), 1, 1e-9, "H has the largest displacement");
  m.disp.forEach((d, i) => { if (i !== h && i !== o) assert.ok(Math.hypot(...d) < 0.12, `atom ${i} nearly still`); });
});

console.log("IR activity: the dipole-moment-derivative rule");
const act = (m, k) => getMode(m, k).active;
test("CO2: symmetric stretch inactive (d mu/dQ = 0); asymmetric stretch and bend active", () => { assert.equal(act("co2", "sym"), false); assert.equal(act("co2", "asym"), true); assert.equal(act("co2", "bend"), true); assert.ok(getMode("co2", "sym").dmu < ACTIVE_THRESHOLD); assert.ok(getMode("co2", "asym").dmu > 0.01); });
test("CH4: A1 stretch and E bend inactive, both T2 modes active", () => { assert.equal(act("ch4", "sym"), false); assert.equal(act("ch4", "ebend"), false); assert.equal(act("ch4", "t2stretch"), true); assert.equal(act("ch4", "t2bend"), true); });
test("H2O: all three modes active; HCl active; N2 (homonuclear) inactive", () => { for (const k of ["bend", "sym", "asym"]) assert.equal(act("h2o", k), true); assert.equal(act("hcl", "stretch"), true); assert.equal(act("n2", "stretch"), false); });
test("every ethanol representative mode changes the dipole", () => { for (const m of getModeCatalog("ethanol").modes) assert.equal(m.active, true, m.id); });
test("the outcome is a symmetry result: it does not depend on the size of the partial charges", () => {
  for (const [mol, k, expected] of [["co2", "sym", false], ["co2", "asym", true], ["ch4", "sym", false], ["ch4", "t2stretch", true], ["ch4", "ebend", false]]) {
    const def = ALL_DEFS[mol]; const m = getMode(mol, k);
    for (const f of [0.1, 3]) { const atoms = def.atoms.map((a) => ({ ...a, q: a.q * f })); assert.equal(Math.hypot(...dipoleDerivative(atoms, m.dispRaw)) > ACTIVE_THRESHOLD, expected, `${mol} ${k} x${f}`); }
  }
});
test("d mu/dQ is independent of the origin of the coordinate system (neutral molecule)", () => {
  const def = ALL_DEFS.h2o; const m = getMode("h2o", "asym"); const moved = def.atoms.map((a) => ({ ...a, pos: a.pos.map((v, k) => v + [3, -2, 5][k]) }));
  const a = dipoleDerivative(def.atoms, m.dispRaw); const b = dipoleDerivative(moved, m.dispRaw); a.forEach((v, i) => near(v, b[i], 1e-9));
});
test("every mode states the reason (dipole change) and the rule", () => { for (const id of EXPLORER_MOLECULES) for (const m of getModeCatalog(id).modes) { assert.ok(m.reason.length > 20, `${id}/${m.id} reason`); assert.ok(/dμ\/dQ/.test(m.rule)); } assert.ok(/cancel|zero/i.test(getMode("co2", "sym").reason)); });
test("relative intensities lie in 0..1, zero exactly for inactive modes", () => { for (const id of EXPLORER_MOLECULES) for (const m of getModeCatalog(id).modes) { assert.ok(m.relIntensity >= 0 && m.relIntensity <= 1 + 1e-12); if (!m.active) assert.equal(m.relIntensity, 0); } });

console.log("Absorption response (Lorentzian)");
test("peak at the mode wavenumber, half height at +/- the half-width, weak far off resonance", () => {
  const nu0 = 2349; near(absorption(nu0, nu0, true), 1, 1e-12); near(absorption(nu0 + TEACHING_HWHM, nu0, true), 0.5, 1e-12); near(absorption(nu0 - TEACHING_HWHM, nu0, true), 0.5, 1e-12);
  assert.ok(absorption(nu0 + 500, nu0, true) < 0.01); assert.ok(absorption(nu0 + 5 * TEACHING_HWHM, nu0, true) < 0.04);
  let best = 0; let arg = 0; for (let v = 400; v <= 4000; v += 1) { const a = absorption(v, nu0, true); if (a > best) { best = a; arg = v; } } assert.equal(arg, nu0);
});
test("an IR-inactive mode is not absorbed even at exact frequency match", () => { assert.equal(absorption(1388, 1388, false), 0); assert.equal(frequencyMatch(1388, 1388), 1); assert.equal(absorptionState(1388, 1388, false), "match-inactive"); assert.equal(absorptionState(1388, 1388, true), "absorbed"); assert.equal(absorptionState(3000, 1388, true), "off"); });
test("photon energy dE = hcν: 2886 cm-1 -> 5.73e-20 J, 34.5 kJ/mol, 3.46 µm; population of v=1 at 298 K is ~1e-6", () => {
  near(energyJ(2886) / 1e-20, 5.733, 0.01); near(energyKJmol(2886), 34.52, 0.05); near(wavelengthUm(2886), 3.465, 0.001); assert.ok(populationRatio(2886) < 1e-5 && populationRatio(2886) > 1e-7);
});

console.log("Spectrum builder");
test("axis: 4000 on the left, 400 on the right, 100 % at the top", () => {
  const g = SP.wavenumberGrid(2); assert.equal(g[0], 4000); assert.equal(g[g.length - 1], 400); assert.ok(g.every((v, i) => i === 0 || v < g[i - 1]));
  near(SP.axisFraction(4000), 0, 1e-12); near(SP.axisFraction(400), 1, 1e-12); assert.ok(SP.axisFraction(3000) < SP.axisFraction(1000)); near(SP.transmittanceFraction(100), 0, 1e-12); near(SP.transmittanceFraction(0), 1, 1e-12);
});
test("transmittance stays in 0..100 and is 100 away from bands; band minimum sits at the data position", () => {
  for (const id of Object.keys(COMPOUNDS)) {
    const bands = COMPOUNDS[id].bands; const s = SP.buildSpectrum(bands); for (const t of s.T) assert.ok(t > 0 && t <= 100 + 1e-9, `${id} T=${t}`);
    for (const b of bands) if (b.fwhm < 60 && b.A > 0.4 && !bands.some((o) => o !== b && Math.abs(o.nu - b.nu) < 150)) { // isolated sharp strong bands: the local minimum is at the data position
      let lo = Infinity; let at = 0; s.grid.forEach((v, i) => { if (Math.abs(v - b.nu) <= 12 && s.T[i] < lo) { lo = s.T[i]; at = v; } }); near(at, b.nu, 6, `${id} ${b.nu}`);
    }
  }
  const empty = SP.buildSpectrum([]); assert.ok([...empty.T].every((t) => t === 100));
});
test("Beer-Lambert: two overlapping bands add in absorbance", () => { const a = { nu: 2000, fwhm: 100, A: 0.3, eta: 0.5 }; const b2 = { ...a, nu: 2050 }; near(SP.absorbanceAt([a, b2], 2025), SP.absorbanceAt([a], 2025) + SP.absorbanceAt([b2], 2025), 1e-12); });
test("peak analysis finds the bands and measures broad vs sharp", () => {
  const f = SP.analyseSpectrum(SP.buildSpectrum(COMPOUNDS.ethanol.bands)); const oh = f.find((p) => Math.abs(p.nu - 3340) < 30); assert.ok(oh && oh.broad && !oh.veryBroad, "ethanol O-H is broad");
  const acid = SP.analyseSpectrum(SP.buildSpectrum(COMPOUNDS["ethanoic-acid"].bands)); assert.ok(acid.some((p) => p.veryBroad), "acid O-H very broad"); assert.ok(f.some((p) => Math.abs(p.nu - 1050) < 15), "C-O");
});
test("functional-group table matches the specification exactly", () => {
  const spec = [["oh-alc", "O–H (alcohol)", 3200, 3600], ["oh-acid", "O–H (carboxylic acid)", 2500, 3300], ["nh", "N–H", 3300, 3500], ["ch", "C–H (sp³)", 2850, 3000], ["cn", "C≡N", 2210, 2260], ["cdo", "C=O", 1650, 1750], ["cdc", "C=C", 1620, 1680]];
  assert.equal(SPEC_GROUPS.length, 7); spec.forEach(([id, label, lo, hi], i) => { assert.equal(SPEC_GROUPS[i].id, id); assert.equal(SPEC_GROUPS[i].label, label); assert.deepEqual(SPEC_GROUPS[i].range, [lo, hi]); });
  assert.equal(GROUP_BY_ID["oh-alc"].note, "broad"); assert.equal(GROUP_BY_ID["oh-acid"].note, "very broad");
});
test("the representative bands of every group lie inside its table range", () => { for (const g of SPEC_GROUPS) for (const b of g.bands) assert.ok(b.nu >= g.range[0] && b.nu <= g.range[1], `${g.id} ${b.nu}`); });

console.log("Compound data");
test("every group-assigned band lies inside its group's range (and the booklet range where it cites the booklet)", () => {
  const BK = { "oh-alc": [3200, 3600], "oh-acid": [2500, 3000], ch: [2850, 3090], cdo: [1700, 1750], co: [1050, 1410] };
  for (const c of Object.values(COMPOUNDS)) for (const b of c.bands) {
    if (b.group) { const g = INTERPRET_GROUPS.find((x) => x.id === b.group); assert.ok(g, b.group); assert.ok(b.nu >= g.range[0] && b.nu <= g.range[1], `${c.id} ${b.nu} ${b.group}`); }
    if (b.src.includes("IB")) { const r = BK[b.group]; assert.ok(r && b.nu >= r[0] && b.nu <= r[1], `${c.id} ${b.nu} IB`); }
    assert.ok(b.src.length >= 1 && b.assign && b.fwhm > 0 && b.A > 0);
    if (b.fingerprint) assert.ok(b.nu < 1500, `${c.id} fingerprint ${b.nu}`);
  }
});
test("distinguishing features are present in the right compounds", () => {
  const has = (id, g) => COMPOUNDS[id].bands.some((b) => b.group === g); assert.ok(has("ethanol", "oh-alc") && !has("ethanol", "cdo")); assert.ok(has("ethanal", "aldch") && has("ethanal", "cdo") && !has("propanone", "aldch"));
  assert.ok(has("ethanoic-acid", "oh-acid") && has("ethanoic-acid", "cdo")); assert.ok(has("ethyl-ethanoate", "cdo") && !has("ethyl-ethanoate", "oh-acid") && !has("ethyl-ethanoate", "oh-alc"));
  assert.ok(COMPOUNDS["ethyl-ethanoate"].bands.find((b) => b.group === "cdo").nu > COMPOUNDS.propanone.bands.find((b) => b.group === "cdo").nu, "ester C=O above ketone C=O");
});

console.log("Unknown-compound challenge");
test("every challenge has 3-4 candidates and the unknown is among them", () => { for (const c of CH.CHALLENGES) { assert.ok(c.others.length >= 2 && c.others.length <= 3, c.id); assert.ok(!c.others.includes(c.unknown)); } });
test("each unknown spectrum is best matched by exactly one candidate (the unknown), for 60 seeds x 12 rounds", () => {
  for (let seed = 1; seed <= 60; seed += 1) for (let r = 0; r < 12; r += 1) {
    const round = CH.makeRound(seed, r); const ev = CH.evaluateRound(round);
    assert.ok(ev.unique, `seed ${seed} round ${r} ${round.unknown}: ${JSON.stringify(ev.scores.map((s) => [s.id, s.score]))}`); assert.equal(ev.best, round.unknown, `seed ${seed} round ${r}`);
    assert.ok(round.candidates.includes(round.unknown) && new Set(round.candidates).size === round.candidates.length);
  }
});
test("rounds are reproducible, vary with the seed, and cover every challenge before repeating one", () => {
  assert.deepEqual(CH.makeRound(5, 3), CH.makeRound(5, 3)); const ids = Array.from({ length: CH.CHALLENGES.length }, (_, r) => CH.makeRound(5, r).challengeId); assert.equal(new Set(ids).size, CH.CHALLENGES.length);
  assert.notDeepEqual(Array.from({ length: 6 }, (_, r) => CH.makeRound(1, r).challengeId), Array.from({ length: 6 }, (_, r) => CH.makeRound(2, r).challengeId));
});
test("ethanal vs propanone is discriminated by the aldehyde C-H bands; ethanoic acid vs ester by the very broad O-H", () => {
  const obs = (id) => CH.observedGroups(CH.featuresOf(CH.compoundSpectrum(id, 0, 0)));
  assert.equal(obs("ethanal").aldch, true); assert.equal(obs("propanone").aldch, false); assert.equal(obs("ethanoic-acid")["oh-acid"], true); assert.equal(obs("ethyl-ethanoate")["oh-acid"], false); assert.equal(obs("ethanol")["oh-alc"], true); assert.equal(obs("ethanoic-acid")["oh-alc"], false);
});

console.log("FTIR: interferogram and Fourier transform");
test("a few monochromatic lines are recovered from their interferogram within 2 cm-1", () => {
  const lines = [{ nu: 1715, I: 1 }, { nu: 2950, I: 0.6 }, { nu: 1050, I: 0.8 }, { nu: 3340, I: 0.4 }];
  const ig = FT.apodise(FT.interferogramFromLines(lines)); const spec = FT.transform(ig, { zeroFillFactor: 4 }); const found = FT.findLines(spec, 0.15);
  for (const l of lines) { const f = found.find((x) => Math.abs(x.nu - l.nu) < 6); assert.ok(f, `line ${l.nu}`); near(f.nu, l.nu, 2, `line ${l.nu}`); }
  assert.equal(found.length, lines.length, `found ${found.map((x) => x.nu.toFixed(0))}`);
});
test("the interferogram is symmetric with its burst at zero retardation, and holds all wavenumbers at once", () => {
  const ig = FT.interferogramFromLines([{ nu: 1000, I: 1 }, { nu: 2000, I: 1 }, { nu: 3000, I: 1 }]); const mid = ig.N / 2;
  near(ig.y[mid], 3, 1e-9); near(ig.y[mid + 17], ig.y[mid - 17], 1e-9);
  const bb = FT.interferogramFromSpectrum((v) => FT.sourceSpectrum(v)); const mx = Math.max(...bb.y.map(Math.abs)); near(Math.abs(bb.y[mid]), mx, 1e-9, "centre burst is the maximum");
  assert.ok(Math.abs(bb.y[mid + 120]) < 0.2 * mx, "a broadband source gives a burst that dies away");
});
test("sample spectrum -> interferogram -> transform returns the single-beam spectrum; dividing by the background gives the transmittance", () => {
  const bands = COMPOUNDS.propanone.bands.filter((b) => b.nu > 1000); const T = (v) => (v > 400 && v < 4000 ? SP.transmittanceAt(bands, v) / 100 : 1);
  const bg = FT.transform(FT.apodise(FT.interferogramFromSpectrum((v) => FT.sourceSpectrum(v))));
  const sb = FT.transform(FT.apodise(FT.interferogramFromSpectrum((v) => FT.sourceSpectrum(v) * T(v))));
  for (const v of [1715, 2965, 1430]) { const j = Math.round(v / (bg.nu[1] - bg.nu[0])); const ratio = sb.S[j] / bg.S[j]; near(ratio, T(bg.nu[j]), 0.12, `T at ${v}`); }
  const j1715 = Math.round(1715 / (bg.nu[1] - bg.nu[0])); assert.ok(sb.S[j1715] / bg.S[j1715] < 0.5, "deep C=O dip"); const jq = Math.round(2400 / (bg.nu[1] - bg.nu[0])); near(sb.S[jq] / bg.S[jq], 1, 0.08, "empty region");
});

console.log("Localised group vibrations (stages 7 and 8)");
test("every group stretch of every organic molecule has zero linear and angular momentum and moves the right atoms", () => {
  let n = 0;
  for (const mol of Object.values(ORGANICS)) for (const g of INTERPRET_GROUPS) {
    if (!groupAtoms(mol, g.id)) continue; const m = groupStretchMode(mol, g.id); assert.ok(m, `${mol.id} ${g.id}`); n += 1;
    const M = mol.masses; const com = [0, 1, 2].map((k) => mol.atoms.reduce((s, a, i) => s + M[i] * a.pos[k], 0) / M.reduce((x, y) => x + y, 0)); const p = [0, 0, 0]; const L = [0, 0, 0]; let scale = 0;
    mol.atoms.forEach((a, i) => { const d = [m.dispRaw[3 * i], m.dispRaw[3 * i + 1], m.dispRaw[3 * i + 2]]; const r = a.pos.map((v, k) => v - com[k]); scale += M[i] * Math.hypot(...d);
      for (let k = 0; k < 3; k += 1) p[k] += M[i] * d[k]; L[0] += M[i] * (r[1] * d[2] - r[2] * d[1]); L[1] += M[i] * (r[2] * d[0] - r[0] * d[2]); L[2] += M[i] * (r[0] * d[1] - r[1] * d[0]); });
    assert.ok(Math.hypot(...p) < 1e-9 * scale && Math.hypot(...L) < 1e-9 * scale * 3, `${mol.id} ${g.id} momentum`);
    const gr = m.group; const along = gr.terminals[0]; const u = mol.atoms[along].pos.map((v, k) => v - mol.atoms[gr.centre].pos[k]); assert.ok(Math.hypot(...m.disp[along]) > 0.3, "terminal moves"); void u;
  }
  assert.ok(n >= 20, `${n} group modes`);
});
test("every stage 7 group has a demonstration molecule that contains it", () => { for (const g of SPEC_GROUPS) { assert.ok(ORGANICS[g.demo], g.demo); assert.ok(hasGroup(ORGANICS[g.demo], g.id), `${g.demo} has ${g.id}`); } });
test("the interpretation molecules have the groups their spectra say (no O-H in ethanal, C=O in the acid, ...)", () => {
  assert.ok(hasGroup(ORGANICS.ethanol, "oh-alc") && !hasGroup(ORGANICS.ethanol, "cdo")); assert.ok(hasGroup(ORGANICS.ethanal, "aldch") && hasGroup(ORGANICS.ethanal, "cdo")); assert.ok(!hasGroup(ORGANICS.propanone, "aldch") && hasGroup(ORGANICS.propanone, "cdo"));
  assert.ok(hasGroup(ORGANICS["ethanoic-acid"], "oh-acid") && !hasGroup(ORGANICS["ethanoic-acid"], "oh-alc")); assert.ok(hasGroup(ORGANICS["ethyl-ethanoate"], "co") && !hasGroup(ORGANICS["ethyl-ethanoate"], "oh-alc"));
});

console.log("Gas-phase spectrum (stage 6) and stage 8 band-to-group choices");
test("gas spectrum: one band per IR-ACTIVE mode only (no band for CO2 symmetric stretch, CH4 A1 / E), at the literature wavenumber, building from high to low wavenumber", () => {
  for (const id of ["h2o", "co2", "hcl", "ch4"]) {
    const modes = getModeCatalog(id).modes; const bands = GS.gasBands(modes);
    assert.equal(bands.length, modes.filter((m) => m.active).length, id);
    for (const b of bands) assert.ok(modes.find((m) => m.id === b.modeId).active, `${id} ${b.modeId} must be active`);
    assert.deepEqual(GS.buildOrder(modes).map((m) => m.wn), [...modes].map((m) => m.wn).sort((a, c) => c - a));
  }
  assert.ok(!GS.gasBands(getModeCatalog("co2").modes).some((b) => b.modeId === "sym"));
  assert.ok(!GS.gasBands(getModeCatalog("ch4").modes).some((b) => b.modeId === "sym" || b.modeId === "ebend"));
});
test("every characteristic band of every compound can be picked: its own group is among the ranges that contain its position", () => {
  for (const id of INTERPRET_SET) for (const b of COMPOUNDS[id].bands) if (b.group) assert.ok(groupsAt(b.nu).some((g) => g.id === b.group), `${id} ${b.nu} ${b.group}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
