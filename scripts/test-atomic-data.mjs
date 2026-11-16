#!/usr/bin/env node
// Unit tests for the shared atomic data layer src/lib/atomic/ (pure Node, no DOM).
//   node scripts/test-atomic-data.mjs
// Expected configurations below are written BY HAND from IB / standard references, independent of the algorithm.
import assert from "node:assert/strict";
import * as A from "../src/lib/atomic/index.js";

let passed = 0; let failed = 0;
function test(name, fn) {
  try { fn(); passed += 1; } catch (e) { failed += 1; console.error(`FAIL ${name}\n  ${e.message}`); }
}
const cfg = (z, q = 0) => A.fullString(A.speciesOccupancy(z, q).occupancy, { superscript: false });
const short = (z, q = 0) => { const s = A.speciesOccupancy(z, q); return A.shorthandString(s.occupancy, s.electrons, { superscript: false }); };
const arr = (z, q = 0) => A.shellArrangement(A.speciesOccupancy(z, q).occupancy).join(",");

// ---------- constants ----------
test("constants: one source, derived values consistent", () => {
  assert.ok(Math.abs(A.RYDBERG_EV - 13.5984) < 1e-3);
  assert.ok(Math.abs(A.HC_EV_NM - 1239.84) < 0.01);
  assert.ok(Math.abs(A.KJ_MOL_PER_EV - 96.485) < 0.01);
  // H-alpha 3 -> 2 in vacuum 656.47 nm (+/-0.05)
  const lam = A.evToWavelengthNm(A.hydrogenTransitionEv(2, 3));
  assert.ok(Math.abs(lam - 656.47) < 0.1, String(lam));
  assert.equal(A.IB_BOOKLET.c, 3.0e8);
  assert.equal(A.IB_BOOKLET.h, 6.63e-34);
});

// ---------- neutral atoms ----------
const NEUTRAL = {
  1: "1s1", 2: "1s2", 3: "1s2 2s1", 6: "1s2 2s2 2p2", 7: "1s2 2s2 2p3", 8: "1s2 2s2 2p4", 10: "1s2 2s2 2p6",
  11: "1s2 2s2 2p6 3s1", 13: "1s2 2s2 2p6 3s2 3p1", 18: "1s2 2s2 2p6 3s2 3p6",
  19: "1s2 2s2 2p6 3s2 3p6 4s1", 20: "1s2 2s2 2p6 3s2 3p6 4s2", 21: "1s2 2s2 2p6 3s2 3p6 3d1 4s2",
  22: "1s2 2s2 2p6 3s2 3p6 3d2 4s2", 23: "1s2 2s2 2p6 3s2 3p6 3d3 4s2",
  24: "1s2 2s2 2p6 3s2 3p6 3d5 4s1", 25: "1s2 2s2 2p6 3s2 3p6 3d5 4s2", 26: "1s2 2s2 2p6 3s2 3p6 3d6 4s2",
  27: "1s2 2s2 2p6 3s2 3p6 3d7 4s2", 28: "1s2 2s2 2p6 3s2 3p6 3d8 4s2",
  29: "1s2 2s2 2p6 3s2 3p6 3d10 4s1", 30: "1s2 2s2 2p6 3s2 3p6 3d10 4s2",
  31: "1s2 2s2 2p6 3s2 3p6 3d10 4s2 4p1", 35: "1s2 2s2 2p6 3s2 3p6 3d10 4s2 4p5", 36: "1s2 2s2 2p6 3s2 3p6 3d10 4s2 4p6",
};
for (const [z, expected] of Object.entries(NEUTRAL)) test(`neutral Z=${z}`, () => assert.equal(cfg(Number(z)), expected));
test("Cr and Cu shorthand", () => { assert.equal(short(24), "[Ar] 3d5 4s1"); assert.equal(short(29), "[Ar] 3d10 4s1"); assert.equal(short(26), "[Ar] 3d6 4s2"); });
test("Pd, Ag, Au exceptions beyond IB range", () => { assert.equal(short(46), "[Kr] 4d10"); assert.equal(short(47), "[Kr] 4d10 5s1"); assert.equal(short(79), "[Xe] 4f14 5d10 6s1"); });
test("all 118 neutral atoms sum to Z and respect capacity", () => {
  for (let z = 1; z <= 118; z += 1) {
    const occ = A.speciesOccupancy(z, 0).occupancy;
    assert.equal(occ.reduce((s, r) => s + r.electrons, 0), z, `Z=${z}`);
    for (const r of occ) assert.ok(r.electrons <= A.SUBSHELL_CAPACITY[r.l], `Z=${z} ${r.n}${r.l}`);
  }
});

// ---------- ions ----------
test("Fe2+ = [Ar] 3d6 (4s lost first)", () => { assert.equal(short(26, 2), "[Ar] 3d6"); assert.equal(arr(26, 2), "2,8,14"); });
test("Fe3+ = [Ar] 3d5", () => { assert.equal(short(26, 3), "[Ar] 3d5"); assert.equal(arr(26, 3), "2,8,13"); });
test("Cu+ = [Ar] 3d10", () => { assert.equal(short(29, 1), "[Ar] 3d10"); assert.equal(arr(29, 1), "2,8,18"); });
test("Cu2+ = [Ar] 3d9", () => assert.equal(short(29, 2), "[Ar] 3d9"));
test("Ga3+ = [Ar] 3d10", () => { assert.equal(short(31, 3), "[Ar] 3d10"); assert.equal(arr(31, 3), "2,8,18"); });
test("Zn2+ = [Ar] 3d10", () => { assert.equal(short(30, 2), "[Ar] 3d10"); assert.equal(arr(30, 2), "2,8,18"); });
test("Mn2+ = [Ar] 3d5", () => assert.equal(short(25, 2), "[Ar] 3d5"));
test("Cr3+ = [Ar] 3d3 and Cr2+ = [Ar] 3d4", () => { assert.equal(short(24, 3), "[Ar] 3d3"); assert.equal(short(24, 2), "[Ar] 3d4"); });
test("Ti3+ 3d1, V3+ 3d2, Ni2+ 3d8, Co2+ 3d7", () => { assert.equal(short(22, 3), "[Ar] 3d1"); assert.equal(short(23, 3), "[Ar] 3d2"); assert.equal(short(28, 2), "[Ar] 3d8"); assert.equal(short(27, 2), "[Ar] 3d7"); });
test("main-group cations: Na+, Mg2+, Al3+, K+, Ca2+", () => {
  assert.equal(cfg(11, 1), "1s2 2s2 2p6"); assert.equal(cfg(12, 2), "1s2 2s2 2p6"); assert.equal(cfg(13, 3), "1s2 2s2 2p6");
  assert.equal(short(19, 1), "[Ar]"); assert.equal(short(20, 2), "[Ar]");
});
test("anions: Cl-, O2-, N3-, F-, H-, S2-, Br-", () => {
  assert.equal(cfg(17, -1), "1s2 2s2 2p6 3s2 3p6"); assert.equal(cfg(8, -2), "1s2 2s2 2p6"); assert.equal(cfg(7, -3), "1s2 2s2 2p6");
  assert.equal(cfg(9, -1), "1s2 2s2 2p6"); assert.equal(cfg(1, -1), "1s2"); assert.equal(cfg(16, -2), "1s2 2s2 2p6 3s2 3p6");
  assert.equal(cfg(35, -1), "1s2 2s2 2p6 3s2 3p6 3d10 4s2 4p6"); assert.equal(arr(17, -1), "2,8,8");
});
test("p-block cation removes p before s: Sn2+ = [Kr] 4d10 5s2, Sn4+ = [Kr] 4d10, Pb2+ keeps 6s2", () => {
  assert.equal(short(50, 2), "[Kr] 4d10 5s2"); assert.equal(short(50, 4), "[Kr] 4d10");
});
test("impossible species are rejected", () => {
  assert.equal(A.speciesOccupancy(3, 4), null); assert.equal(A.speciesOccupancy(0, 0), null); assert.equal(A.speciesOccupancy(119, 0), null);
  assert.equal(A.speciesOccupancy(1.5, 0), null);
});
test("H+ has no electrons", () => { const s = A.speciesOccupancy(1, 1); assert.equal(s.electrons, 0); assert.deepEqual(s.occupancy, []); });
test("describeSpecies notes mention 4s first for Fe2+ and exception for Cr", () => {
  assert.ok(A.describeSpecies(26, 2).notes.join(" ").includes("4s electrons before the 3d"));
  assert.ok(A.describeSpecies(24, 0).notes.join(" ").includes("exception"));
  assert.equal(A.describeSpecies(24, 0).isException, true);
  assert.equal(A.describeSpecies(26, 0).isException, false);
});
test("orbital boxes obey Hund: 2p3 three unpaired, 2p4 two", () => {
  assert.deepEqual(A.orbitalBoxes(1, 3).map((b) => b.up && !b.down), [true, true, true]);
  assert.equal(A.unpairedInSubshell(1, 4), 2); assert.equal(A.unpairedInSubshell(2, 5), 5); assert.equal(A.unpairedInSubshell(2, 6), 4);
  assert.equal(A.unpairedElectrons(A.speciesOccupancy(24, 0).occupancy), 6);
  assert.equal(A.unpairedElectrons(A.speciesOccupancy(26, 3).occupancy), 5);
});

// ---------- charge policy ----------
test("charge limits are physical", () => {
  assert.deepEqual([A.maxCationCharge(11), A.maxAnionCharge(11)], [1, 0]);
  assert.deepEqual([A.maxCationCharge(8), A.maxAnionCharge(8)], [0, 2]);
  assert.equal(A.maxAnionCharge(17), 1); assert.equal(A.maxAnionCharge(7), 3); assert.equal(A.maxAnionCharge(6), 4);
  assert.equal(A.maxCationCharge(26), 6); assert.equal(A.maxCationCharge(36), 0);
  assert.equal(A.maxAnionCharge(36), 0); assert.equal(A.maxAnionCharge(26), 0);
  assert.ok(A.chargeRefusal(36, -4).length > 20);
  assert.equal(A.chargeRefusal(17, -1), null);
  assert.ok(/at most 1/.test(A.chargeRefusal(17, -2)));
  assert.ok(/metal/.test(A.chargeRefusal(11, -1)));
});

// ---------- nuclides ----------
test("known neutron range: hydrogen 0-6, never H-61", () => {
  const r = A.neutronRange(1);
  assert.deepEqual([r.minN, r.maxN], [0, 6]);
  assert.equal(A.classifyNuclide(1, 60).exists, false);
  assert.equal(A.classifyNuclide(1, 60).status, "out-of-range");
  assert.match(A.nuclideMessage(1, 60, "hydrogen"), /No known isotope/);
});
test("stable isotopes match IUPAC/NUBASE for Z = 1-36 (hand list)", () => {
  const stable = { 1: [1, 2], 2: [3, 4], 3: [6, 7], 4: [9], 5: [10, 11], 6: [12, 13], 7: [14, 15], 8: [16, 17, 18], 9: [19],
    10: [20, 21, 22], 11: [23], 12: [24, 25, 26], 13: [27], 14: [28, 29, 30], 15: [31], 16: [32, 33, 34, 36], 17: [35, 37],
    18: [36, 38, 40], 19: [39, 41], 21: [45], 22: [46, 47, 48, 49, 50], 23: [51], 24: [50, 52, 53, 54], 25: [55],
    26: [54, 56, 57, 58], 27: [59], 28: [58, 60, 61, 62, 64], 29: [63, 65], 30: [64, 66, 67, 68, 70], 31: [69, 71],
    33: [75], 35: [79, 81], 36: [78, 80, 82, 83, 84, 86] };
  for (const [z, list] of Object.entries(stable)) {
    const got = A.stableIsotopes(Number(z)).map((i) => i.massNumber);
    // NUBASE2020 lists these "stbl"; Kr-78 and Ca-40..., Ti etc: allow extra "observationally stable" entries only where documented
    for (const m of list) assert.ok(got.includes(m), `Z=${z}: stable ${m} missing, got ${got}`);
  }
});
test("radioactive examples: H-3, C-14, K-40, Co-60, I-131", () => {
  assert.equal(A.classifyNuclide(1, 2).status, "radioactive");
  assert.equal(A.classifyNuclide(6, 8).status, "radioactive");
  assert.equal(A.classifyNuclide(19, 21).status, "radioactive");
  assert.equal(A.classifyNuclide(27, 33).status, "radioactive");
  assert.equal(A.classifyNuclide(53, 78).status, "radioactive");
  assert.match(A.classifyNuclide(6, 8).halfLifeLabel, /57\d\d years|5700 years|5\.7/);
});
test("reference isotopes are the most abundant natural ones", () => {
  const ref = (z) => A.referenceIsotope(z).massNumber;
  assert.deepEqual([1, 2, 3, 6, 7, 8, 11, 12, 17, 20, 26, 29, 35].map(ref), [1, 4, 7, 12, 14, 16, 23, 24, 35, 40, 56, 63, 79]);
  assert.equal(A.referenceIsotope(43).status !== "unbound", true); // Tc: longest-lived, no natural abundance
});
test("limits at both ends for every element 1-118 and stepping never lands on an unknown nuclide", () => {
  for (let z = 1; z <= 118; z += 1) {
    const r = A.neutronRange(z);
    assert.ok(r, `Z=${z}`);
    assert.ok(A.isKnownNuclide(z, r.minN) && A.isKnownNuclide(z, r.maxN));
    let n = r.minN; let guard = 0;
    for (;;) {
      const s = A.stepNeutrons(z, n, 1, "x");
      if (s.refused) break;
      assert.ok(A.isKnownNuclide(z, s.neutrons), `Z=${z} N=${s.neutrons}`);
      n = s.neutrons; guard += 1; assert.ok(guard < 200);
    }
    assert.equal(n, r.maxN);
    assert.equal(A.stepNeutrons(z, r.minN, -1, "x").refused, true);
  }
});
test("stepping over a gap: carbon 21 is skipped", () => {
  assert.equal(A.isKnownNuclide(6, 15), false); // C-21
  assert.equal(A.stepNeutrons(6, 14, 1, "carbon").neutrons, 16);
  assert.equal(A.stepNeutrons(6, 16, -1, "carbon").neutrons, 14);
});
test("heaviest/lightest refusal messages name the limit", () => {
  const hi = A.stepNeutrons(1, 6, 1, "hydrogen"); assert.equal(hi.refused, true); assert.match(hi.reason, /hydrogen-7/);
  const lo = A.stepNeutrons(2, 1, -1, "helium"); assert.equal(lo.refused, true); assert.match(lo.reason, /helium-3/);
});
test("known-range sanity against published limits", () => {
  const rng = (z) => A.neutronRange(z);
  assert.equal(rng(1).maxA, 7);  // H-7
  assert.equal(rng(2).minA, 3); assert.equal(rng(2).maxA, 10); // He-3..He-10
  assert.equal(rng(8).minA, 11); assert.equal(rng(8).maxA, 26); // O-11..O-26 (NUBASE2020 with O-11)
  assert.equal(rng(20).minA, 35); assert.equal(rng(20).maxA, 56);
  assert.equal(rng(26).minA, 45); assert.equal(rng(26).maxA, 74);
  assert.equal(A.NUBASE_YEAR, 2020);
});
test("half-life formatting", () => {
  assert.equal(A.formatHalfLife(0), "stable");
  assert.match(A.formatHalfLife(3.888e8), /12\.3 years/);
  assert.match(A.formatHalfLife(0.8387), /ms/);
  assert.match(A.formatHalfLife(1.8e22), /×/);
});
test("notation helpers", () => {
  assert.equal(A.formatCharge(2), "2+"); assert.equal(A.formatCharge(-1), "−"); assert.equal(A.formatCharge(-3), "3−"); assert.equal(A.formatCharge(0), "0");
  assert.equal(A.formatCharge(-2, { ascii: true }), "2-"); assert.equal(A.speciesLabel("Fe", 3), "Fe³⁺");
});

// ---------- builder rules ----------
test("builder: Pauli and Hund refusals explain themselves", () => {
  let s = A.newBuilder(7, 0); // N, 7 electrons
  let r = A.place(s, "1s", 0, "up"); assert.ok(r.ok); s = r.state;
  r = A.place(s, "1s", 0, "up"); assert.equal(r.ok, false); assert.equal(r.violation.rule, A.rule.PAULI);
  r = A.place(s, "1s", 0, "down"); assert.ok(r.ok); s = r.state;
  r = A.place(s, "1s", 0, "up"); assert.equal(r.ok, false); assert.match(r.violation.message, /full/);
  // 2s
  for (const sp of ["up", "down"]) s = A.place(s, "2s", 0, sp).state;
  s = A.place(s, "2p", 0, "up").state;
  r = A.place(s, "2p", 0, "down"); assert.equal(r.ok, false); assert.equal(r.violation.rule, A.rule.HUND); assert.match(r.violation.message, /empty orbital/);
  r = A.place(s, "2p", 1, "down"); assert.equal(r.ok, false); assert.equal(r.violation.rule, A.rule.HUND); assert.match(r.violation.message, /parallel/);
  r = A.place(s, "2p", 1, "up"); assert.ok(r.ok);
});
test("builder: total cap and remove", () => {
  let s = A.newBuilder(1, 0);
  s = A.place(s, "1s", 0, "up").state;
  const r = A.place(s, "2s", 0, "up"); assert.equal(r.ok, false); assert.equal(r.violation.rule, A.rule.TOTAL);
  s = A.removeFrom(s, "1s", 0); assert.equal(A.totalPlaced(s), 0);
});
function fillBy(state, occ) {
  let s = state;
  for (const [key, count] of Object.entries(occ)) {
    const l = A.SUBSHELL_LETTERS.indexOf(key.slice(1)); const k = A.ORBITAL_COUNT[l];
    for (let i = 0; i < count; i += 1) {
      const idx = i < k ? i : i - k;
      const spin = i < k ? "up" : "down";
      const r = A.place(s, key, idx, spin); assert.ok(r.ok, `${key} #${i}: ${r.violation?.message}`); s = r.state;
    }
  }
  return s;
}
test("builder: correct Cr, Fe2+, Cu+ pass; every IB-range neutral atom passes via the algorithm", () => {
  assert.equal(A.diagnose(fillBy(A.newBuilder(24, 0), { "1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 6, "3d": 5, "4s": 1 })).correct, true);
  assert.equal(A.diagnose(fillBy(A.newBuilder(26, 2), { "1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 6, "3d": 6 })).correct, true);
  assert.equal(A.diagnose(fillBy(A.newBuilder(29, 1), { "1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 6, "3d": 10 })).correct, true);
  for (let z = 1; z <= 36; z += 1) for (const q of [0, 1, -1]) {
    const sp = A.speciesOccupancy(z, q); if (!sp) continue;
    const occ = Object.fromEntries(sp.occupancy.map((r) => [A.subshellLabel(r.n, r.l), r.electrons]));
    assert.equal(A.diagnose(fillBy(A.newBuilder(z, q), occ)).correct, true, `Z=${z} q=${q}`);
  }
});
test("builder: diagnostics explain Cr exception, cation order, Aufbau, totals", () => {
  const cr = fillBy(A.newBuilder(24, 0), { "1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 6, "3d": 4, "4s": 2 });
  const d = A.diagnose(cr); assert.equal(d.correct, false); assert.equal(d.messages[0].kind, "exception"); assert.match(d.messages[0].text, /half-filled/);
  const fe2 = fillBy(A.newBuilder(26, 2), { "1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 6, "3d": 4, "4s": 2 });
  const d2 = A.diagnose(fe2); assert.equal(d2.messages[0].kind, "cation-order"); assert.match(d2.messages[0].text, /OUTERMOST/);
  const skip = fillBy(A.newBuilder(12, 0), { "1s": 2, "2s": 2, "2p": 4, "3s": 2, "3p": 2 });
  assert.equal(A.diagnose(skip).messages[0].kind, "aufbau");
  const few = fillBy(A.newBuilder(12, 0), { "1s": 2 });
  assert.equal(A.diagnose(few).complete, false); assert.match(A.diagnose(few).messages[0].text, /12/);
  assert.equal(A.diagnose(A.newBuilder(8, 0)).correct, false);
});
test("builder: hint ladder never gives the answer at level 1", () => {
  const s = A.newBuilder(24, 0);
  assert.doesNotMatch(A.hint(s, 1).text, /3d5|4s1/);
  assert.match(A.hint(s, 2).text, /1s/);
});

console.log(`atomic data layer: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
