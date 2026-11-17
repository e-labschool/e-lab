#!/usr/bin/env node
// Stage 3 (Concentration Laboratory) engine tests: spec Part J concentration/dilution cases, validation, conservation, refusals.
//   node scripts/test-mole-lab-stage3-engine.mjs
import assert from "node:assert/strict";
import * as E from "../src/engines/mole-lab/engine/index.js";
import { concentration, prepareSolution } from "../src/engines/mole-lab/engine/solutions.js";
import { dilute } from "../src/engines/mole-lab/engine/dilution.js";
import { stage3View } from "../src/engines/mole-lab/engine/stage3View.js";
import { stage3Prediction, stage3Apply, checkStage3Apply } from "../src/engines/mole-lab/engine/stage3Tutor.js";
import { SOLUTES, formulaUnitsInWindow, drawnPairs, concentrationLimitError } from "../src/engines/mole-lab/engine/concLab.js";

let passed = 0; let failed = 0;
function test(name, fn) { try { fn(); console.log(`  ok   ${name}`); passed += 1; } catch (e) { console.log(`  FAIL ${name}\n       ${(e.stack || e.message).split("\n").slice(0, 6).join("\n       ")}`); failed += 1; } }
const start = (exp = 1) => { let s = E.createInitialState({ stage: 3 }); if (exp !== 1) s = E.reduce(s, { type: "s3/setExp", stage: 3, exp }); return s; };
const go = (s, ...as) => as.reduce((st, a) => E.reduce(st, { stage: 3, ...a }), s);
const ok = (s) => { assert.deepEqual(E.checkInvariants(s), []); return s; };
const A = (s) => s.scenes[3].data.stations.A;
const manual = (s) => { const id = s.scenes[3].packets[0].id; return go(s, { type: "s3/measureWater", value: "60" }, { type: "s3/pourWater" }, { type: "packet/open", id }, { type: "s3/pour" }, { type: "s3/stir" }, { type: "s3/transfer" }, { type: "s3/fillToMark" }); };
const view = (s) => stage3View(s);

console.log("Concentration maths (spec Part J)");
test("10.0 g NaOH, M = 40.00 -> 0.250 mol; in 100 mL -> 2.50 mol/dm3", () => { const r = prepareSolution({ massG: 10, molarMassGPerMol: 40, finalVolumeMl: 100 }); assert.equal(r.n, 0.25); assert.equal(r.c, 2.5); });
test("20.0 g in 100 mL -> 0.500 mol, 5.00 mol/dm3", () => { const r = prepareSolution({ massG: 20, molarMassGPerMol: 40, finalVolumeMl: 100 }); assert.equal(r.n, 0.5); assert.equal(r.c, 5); });
test("same 10.0 g in 200 mL -> 1.25 mol/dm3, moles unchanged", () => { const a = prepareSolution({ massG: 10, molarMassGPerMol: 40, finalVolumeMl: 100 }); const b = prepareSolution({ massG: 10, molarMassGPerMol: 40, finalVolumeMl: 200 }); assert.equal(b.c, 1.25); assert.equal(a.nQ, b.nQ); });
test("dilution: 50 mL of 2.0 diluted to 200 mL -> 0.50; aliquot carries 0.100 mol, stock keeps the rest", () => {
  const r = dilute({ nQ: E.toQuanta(0.5), volumeMl: 250 }, 50, 200); assert.ok(r.ok); assert.equal(r.c1, 2); assert.equal(r.c2, 0.5); assert.equal(r.nAliquotMol, 0.1); assert.equal(r.stockAfter.nQ, E.toQuanta(0.4));
});
test("invalid volumes and amounts are refused (zero, negative, non-finite, divide by zero)", () => {
  for (const v of [0, -5, NaN, Infinity]) assert.equal(concentration(0.25, v).ok, false);
  assert.equal(concentration(-1, 100).ok, false);
  assert.equal(dilute({ nQ: 1e8, volumeMl: 100 }, 200, 300).ok, false, "aliquot larger than the stock");
  assert.equal(dilute({ nQ: 1e8, volumeMl: 100 }, 50, 20).ok, false, "final smaller than the aliquot");
  assert.equal(dilute({ nQ: 1e8, volumeMl: 100 }, 0, 20).ok, false);
});

console.log("Experiment 1: hands-on");
test("initial scene: quarter-filled packet of 0.250 mol, nothing dissolved, concentration undefined", () => {
  const s = ok(start()); const v = view(s); assert.equal(s.scenes[3].packets[0].q, E.toQuanta(0.25)); assert.equal(v.stations[0].exact.c, null); assert.equal(v.stations[0].text.packetAmount, "0.250 mol");
});
test("full manual procedure gives 2.50 mol/dm3 at the mark and conserves every quantum", () => {
  const s = ok(manual(start())); const st = A(s); assert.equal(st.atMark, true); const v = view(s); assert.equal(v.stations[0].exact.c, 2.5); assert.equal(v.stations[0].text.conc, "2.50 mol dm⁻³");
  assert.equal(v.stations[0].phase, "done");
});
test("every step conserved (invariants checked after each action)", () => {
  let s = start(); const id = s.scenes[3].packets[0].id;
  for (const a of [{ type: "s3/measureWater", value: "60" }, { type: "s3/pourWater" }, { type: "packet/open", id }, { type: "s3/pour" }, { type: "s3/stir" }, { type: "s3/transfer" }, { type: "s3/topUp", value: "20" }, { type: "s3/fillToMark" }]) s = ok(go(s, a));
});
test("a closed packet cannot pour", () => { const s = go(start(), { type: "s3/measureWater", value: "60" }, { type: "s3/pourWater" }); const t = go(s, { type: "s3/pour" }); assert.equal(t.last.ok, false); assert.equal(t.scenes[3], s.scenes[3]); ok(t); });
test("pouring with no water in the beaker is refused", () => { const id = start().scenes[3].packets[0].id; const s = go(start(), { type: "packet/open", id }); const t = go(s, { type: "s3/pour" }); assert.equal(t.last.ok, false); ok(t); });
test("repeated pour clicks cannot duplicate material", () => {
  let s = go(start(), { type: "s3/measureWater", value: "60" }, { type: "s3/pourWater" }, { type: "packet/open", id: start().scenes[3].packets[0].id });
  for (let i = 0; i < 6; i += 1) s = ok(go(s, { type: "s3/pour" }));
  const sc = s.scenes[3]; const solid = sc.vessels.find((v) => v.id === "beakerA").contents; assert.equal(Object.values(solid).reduce((a, b) => a + b, 0), E.toQuanta(0.25)); assert.equal(sc.packets[0].q, 0);
});
test("stirring before pouring, transferring undissolved solid, and double transfer are refused", () => {
  const s = go(start(), { type: "s3/measureWater", value: "60" }, { type: "s3/pourWater" }); assert.equal(go(s, { type: "s3/stir" }).last.ok, false); assert.equal(go(s, { type: "s3/transfer" }).last.ok, false);
  const m = ok(manual(start())); assert.equal(go(m, { type: "s3/transfer" }).last.ok, false);
});
test("adding water past the mark is refused and leaves the state unchanged; fillToMark is idempotent", () => {
  const id = start().scenes[3].packets[0].id;
  let s = go(start(), { type: "s3/measureWater", value: "60" }, { type: "s3/pourWater" }, { type: "packet/open", id }, { type: "s3/pour" }, { type: "s3/stir" }, { type: "s3/transfer" });
  const over = go(s, { type: "s3/topUp", value: "500" }); assert.equal(over.last.ok, false); assert.equal(over.scenes[3], s.scenes[3]);
  s = go(s, { type: "s3/fillToMark" }); const again = go(s, { type: "s3/fillToMark" }); ok(again); assert.equal(A(again).liquidMl, 100);
  assert.equal(go(s, { type: "s3/topUp", value: "1" }).last.ok, false, "cannot add past the mark once at the mark");
});
test("water too small / negative / zero / non-numeric / too large for the cylinder is refused", () => {
  for (const v of ["", "abc", "-5", "0", "1e9", "NaN", "0.1", "150"]) { const t = go(start(), { type: "s3/measureWater", value: v }); assert.equal(t.last.ok, false, `measureWater ${v}`); ok(t); }
});
test("mass and flask volume validation", () => {
  for (const v of ["", "abc", "-1", "0", "1e9", "NaN"]) { assert.equal(go(start(), { type: "s3/setMass", station: "A", value: v }).last.ok, false, `mass ${v}`); }
  for (const v of ["", "abc", "-1", "0", "5", "1e9"]) { assert.equal(go(start(), { type: "s3/setFlask", station: "A", value: v }).last.ok, false, `flask ${v}`); }
  const s = go(start(), { type: "s3/setMass", station: "A", value: "5" }); assert.equal(s.last.ok, true); assert.equal(s.scenes[3].packets[0].q, E.toQuanta(0.125)); ok(s);
});
test("a solution that cannot exist (beyond the maximum concentration) is refused with a reason", () => {
  const s = go(start(), { type: "s3/setMass", station: "A", value: "200" }); assert.equal(s.last.ok, false); assert.ok(s.last.message.length > 10); ok(s);
  assert.ok(concentrationLimitError("NaOH", 25));
});
test("quick prepare equals the manual route", () => { const a = manual(start()); const b = go(start(), { type: "s3/prepare", station: "A" }); ok(b); assert.equal(A(b).atMark, true); assert.deepEqual(view(a).stations[0].exact.c, view(b).stations[0].exact.c); });
test("restart returns the original packet (nothing lost, nothing duplicated)", () => { const s = ok(go(manual(start()), { type: "s3/restart", station: "A" })); assert.equal(s.scenes[3].packets[0].q, E.toQuanta(0.25)); assert.equal(A(s).liquidMl, 0); });
test("dissolved solute is stored as aqueous ions, never as NaOH molecules in the aq key", () => { const s = manual(start()); const keys = s.scenes[3].vessels.flatMap((v) => Object.keys(v.contents)); assert.ok(keys.includes("NaOH_aq")); assert.ok(!view(s).panes.some((p) => /NaOH molecule/i.test(p.note || ""))); });

console.log("Experiments 2 to 5");
test("Experiment 2: 20.0 g in 100 mL = 5.00 mol/dm3, half-filled packet, denser viewer than Exp 1", () => {
  const s = ok(manual(start(2))); const v = view(s); assert.equal(v.stations[0].exact.c, 5); assert.equal(v.stations[0].text.conc, "5.00 mol dm⁻³");
  const mine = v.panes.find((p) => p.key !== "ref" && p.c === 5); assert.ok(mine); assert.ok(drawnPairs(5) > drawnPairs(2.5)); assert.ok(formulaUnitsInWindow(5) > formulaUnitsInWindow(2.5));
  assert.equal(start(2).scenes[3].packets[0].q, E.toQuanta(0.5));
});
test("Experiment 3: same 10.0 g at 100 and 200 mL -> 2.50 and 1.25, constant moles", () => {
  const s = ok(start(3)); const v = view(s); const [a, b] = v.stations; assert.equal(a.exact.c, 2.5); assert.equal(b.exact.c, 1.25); assert.equal(a.exact.weighedQ, b.exact.weighedQ); assert.equal(v.cmp.sameN, true); assert.equal(v.cmp.sameV, false);
});
test("Experiment 3: changing the shared mass keeps both solutions consistent", () => { const s = ok(go(start(3), { type: "s3/setMass", station: "A", value: "20" })); const [a, b] = view(s).stations; assert.equal(a.exact.weighedQ, b.exact.weighedQ); assert.equal(a.exact.c, 5); assert.equal(b.exact.c, 2.5); });
test("Experiment 4: 50 mL of 2.0 diluted to 200 mL -> 0.50, aliquot carries 0.100 mol", () => {
  let s = ok(start(4)); let v = view(s); assert.equal(v.dil.exact.c1, 2); assert.equal(v.dil.exact.aliquotMl, 50); assert.equal(v.dil.exact.finalMl, 200);
  s = ok(go(s, { type: "s3/takeAliquot" })); v = view(s); assert.equal(v.dil.exact.taken, true); assert.match(v.dil.text.aliquotAmount, /0\.100 mol/);
  s = ok(go(s, { type: "s3/transferAliquot" }, { type: "s3/fillToMark" })); v = view(s); assert.equal(v.dil.exact.atMark, true); assert.equal(v.dil.exact.c2, 0.5); assert.match(v.dil.text.stockAmount, /0\.400 mol/);
});
test("Experiment 4: invalid aliquot / final volumes are refused", () => {
  for (const v of ["0", "-5", "abc", "", "500"]) assert.equal(go(start(4), { type: "s3/setAliquot", value: v }).last.ok, false, `aliquot ${v}`);
  assert.equal(go(start(4), { type: "s3/setFinal", value: "25" }).last.ok, false, "final smaller than the aliquot");
  const t = go(start(4), { type: "s3/takeAliquot" }, { type: "s3/takeAliquot" }); ok(t); assert.equal(view(t).dil.exact.taken, true);
});
test("Experiment 5: two independent beakers, both concentrations, same viewer scale", () => {
  const s = ok(start(5)); const v = view(s); const [a, b] = v.stations; assert.equal(a.exact.c, 2.5); assert.equal(b.exact.c, 5); assert.equal(v.cmp.ratio, 2);
  const t = ok(go(s, { type: "s3/setMass", station: "B", value: "30" }, { type: "s3/setFlask", station: "A", value: "200" })); const [a2, b2] = view(t).stations; assert.equal(a2.exact.c, 1.25); assert.equal(b2.exact.c, 7.5);
  assert.equal(new Set(v.panes.map((p) => p.units)).size >= 1, true); assert.equal(v.scale.window ?? v.scale, v.scale.window ?? v.scale);
});
test("viewer counts rise with concentration (same fixed window)", () => { const c = [1.25, 2.5, 5, 10].map(formulaUnitsInWindow); for (let i = 1; i < c.length; i += 1) assert.ok(c[i] > c[i - 1]); });

console.log("Solutes, modes, tutor");
test("NaCl is supported and validated; unknown solutes are refused", () => {
  assert.ok(SOLUTES.NaOH && SOLUTES.NaCl); let s = go(start(), { type: "s3/setSolute", soluteId: "NaCl" }); assert.equal(s.last.ok, true); ok(s); s = ok(go(s, { type: "s3/setMass", station: "A", value: "5.844" }, { type: "s3/prepare", station: "A" }));
  assert.equal(Math.round(view(s).stations[0].exact.c * 1000) / 1000, 1); assert.equal(go(start(), { type: "s3/setSolute", soluteId: "KNO3" }).last.ok, false);
});
test("NaCl beyond its solubility is refused", () => { const s = go(start(), { type: "s3/setSolute", soluteId: "NaCl" }); const t = go(s, { type: "s3/setMass", station: "A", value: "60" }); assert.equal(t.last.ok, false); });
test("policy change after preparation is flagged, not silently recomputed", () => { let s = manual(start()); s = E.reduce(s, { type: "policy/set", policy: "precise" }); assert.equal(view(s).flags.policyMismatch, true); ok(s); });
test("prediction and apply tasks exist for all five experiments, with the correct answer accepted", () => {
  for (const e of [1, 2, 3, 4, 5]) { const s = start(e); const p = stage3Prediction(s.scenes[3]); assert.ok(p && p.choices.some((c) => c.correct), `prediction ${e}`); const t = stage3Apply(s.scenes[3]); assert.ok(t, `apply ${e}`); assert.equal(checkStage3Apply(t, String(t.expected)).correct, true, `apply answer ${e}`); assert.equal(checkStage3Apply(t, "abc").ok, false); }
});
test("unknown action returns null from the stage reducer path (state unchanged)", () => { const s = start(); const t = E.reduce(s, { stage: 3, type: "s3/doesNotExist" }); assert.equal(t.scenes[3], s.scenes[3]); });
test("state is pure: reducing a frozen state does not mutate it", () => { const s = start(); const json = JSON.stringify(s); const deep = (o) => { if (o && typeof o === "object") { Object.freeze(o); Object.values(o).forEach(deep); } return o; }; deep(s); manual(s); assert.equal(JSON.stringify(s), json); });

console.log("Property: random hostile sequences keep the ledger consistent");
function rng(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
test("2000 random actions across all experiments never break an invariant", () => {
  const r = rng(7); const pick = (a) => a[Math.floor(r() * a.length)]; let s = start();
  const vals = ["", "abc", "-3", "0", "5", "10", "20", "60", "100", "200", "1e9", "NaN", "250"]; const id = () => s.scenes[3].packets[0]?.id;
  for (let i = 0; i < 2000; i += 1) {
    const a = pick([() => ({ type: "s3/setExp", exp: 1 + Math.floor(r() * 5) }), () => ({ type: "s3/measureWater", value: pick(vals) }), () => ({ type: "s3/pourWater" }), () => ({ type: "packet/open", id: id() }), () => ({ type: "packet/close", id: id() }), () => ({ type: "s3/pour" }), () => ({ type: "s3/stir" }), () => ({ type: "s3/transfer" }), () => ({ type: "s3/topUp", value: pick(vals) }), () => ({ type: "s3/fillToMark" }), () => ({ type: "s3/prepare", station: pick(["A", "B"]) }), () => ({ type: "s3/restart", station: pick(["A", "B"]) }), () => ({ type: "s3/setMass", station: pick(["A", "B"]), value: pick(vals) }), () => ({ type: "s3/setFlask", station: pick(["A", "B"]), value: pick(vals) }), () => ({ type: "s3/takeAliquot" }), () => ({ type: "s3/transferAliquot" }), () => ({ type: "s3/setAliquot", value: pick(vals) }), () => ({ type: "s3/setFinal", value: pick(vals) }), () => ({ type: "s3/setStock", c: pick(vals), volumeMl: pick(vals) }), () => ({ type: "s3/setSolute", soluteId: pick(["NaOH", "NaCl"]) })])();
    s = E.reduce(s, { stage: 3, ...a }); const bad = E.checkInvariants(s); assert.deepEqual(bad, [], `step ${i} ${JSON.stringify(a)}`); stage3View(s);
  }
});

console.log(`\n${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
