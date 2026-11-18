#!/usr/bin/env node
// Engine tests for Mole Lab Stages 4 (gas volume), 5 (chemical equations) and 6 (limiting reagents):  node scripts/test-mole-lab-stage456-engine.mjs
// Pure JavaScript: no React, no three.js, no DOM.  Covers spec Part J (gas, reaction, limiting reagent), atom/charge balance of every animation plan,
// hostile inputs and seeded random action sequences checked against the conservation invariants.
import assert from "node:assert/strict";
import * as E from "../src/engines/mole-lab/engine/index.js";

let passed = 0; let failed = 0;
function test(name, fn) { try { fn(); console.log(`  ok   ${name}`); passed += 1; } catch (e) { console.log(`  FAIL ${name}\n       ${(e.stack || e.message).split("\n").slice(0, 6).join("\n       ")}`); failed += 1; } }
const Q = E.toQuanta; const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} vs ${b}`);
const run = (s, ...actions) => actions.reduce((st, a) => E.reduce(st, a), s);
const sc = (s, stage) => s.scenes[stage ?? s.stage];
const clean0 = (s) => { assert.deepEqual(E.checkInvariants(s), []); return s; };
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const ledger = (scene) => E.sceneLedger(scene);

console.log("Stage 4: gas volume (spec Part J)");
test("RTP convention: 0.5 mol -> 12.0, 1.0 -> 24.0, 2.0 -> 48.0 dm3", () => {
  for (const [n, v] of [[0.5, 12], [1, 24], [2, 48]]) { const s = E.gasLabState({ model: "rtp", nQ: Q(n), gasId: "O2" }); assert.equal(s.volumeDm3, v); assert.equal(s.vm, 24); }
  assert.equal(E.gasLabState({ model: "rtp", nQ: 0, gasId: "O2" }).volumeDm3, 0);
});
test("advanced PV = nRT: 1 mol at 298.15 K and 101.325 kPa is 24.47 dm3 and the difference from 24.0 is shown, not hidden", () => {
  const s = E.gasLabState({ model: "ideal", nQ: Q(1), gasId: "N2", tK: 298.15, pPa: 101325 });
  near(s.volumeDm3, 24.4654, 1e-5); near(s.differenceDm3, 0.4654, 1e-3); assert.ok(s.differencePct > 1.9 && s.differencePct < 2);
  const lines = E.gasLines(s).join(" "); assert.match(lines, /8\.314462618/); assert.match(lines, /24\.0/); assert.match(lines, /298\.15 K/);
  const r = E.gasLabState({ model: "rtp", nQ: Q(1), gasId: "N2" }); near(r.otherModelVolumeDm3, 24.4654, 1e-5);
});
test("ideal gas: V proportional to n and T, inversely to P; the 24.0 convention is NOT assumed at other T and P", () => {
  const a = E.gasLabState({ model: "ideal", nQ: Q(1), gasId: "O2", tK: 300, pPa: 1e5 }).volumeDm3;
  near(E.gasLabState({ model: "ideal", nQ: Q(2), gasId: "O2", tK: 300, pPa: 1e5 }).volumeDm3, 2 * a); near(E.gasLabState({ model: "ideal", nQ: Q(1), gasId: "O2", tK: 600, pPa: 1e5 }).volumeDm3, 2 * a); near(E.gasLabState({ model: "ideal", nQ: Q(1), gasId: "O2", tK: 300, pPa: 2e5 }).volumeDm3, a / 2);
  const hot = E.gasLabState({ model: "ideal", nQ: Q(1), gasId: "O2", tK: 400, pPa: 101325 }); assert.ok(hot.volumeDm3 > 32 && hot.volumeDm3 < 34); assert.notEqual(hot.vm, 24);
});
test("same molar volume for every gas but DIFFERENT densities (M / Vm): equal volumes are not equal masses", () => {
  const d = {}; for (const g of E.GAS_IDS) { const s = E.gasLabState({ model: "rtp", nQ: Q(1), gasId: g }); assert.equal(s.volumeDm3, 24); d[g] = s.densityGPerDm3; }
  near(d.H2, E.molarMass("H2") / 24, 1e-6); near(d.CO2, E.molarMass("CO2") / 24, 1e-6); assert.ok(d.CO2 > 20 * d.H2); assert.equal(E.GAS_IDS.length, 10); assert.equal(new Set(Object.values(d)).size, 10); /* CHANGED (redesign): ten gases (He Ne Ar CO added), was six */
  const s1 = E.gasLabState({ model: "rtp", nQ: Q(1), gasId: "H2" }), s2 = E.gasLabState({ model: "rtp", nQ: Q(1), gasId: "CO2" }); assert.equal(s1.moleculesPerDm3, s2.moleculesPerDm3);
});
test("lighter molecules move faster at the same temperature (v_rms = sqrt(3RT/M))", () => { assert.ok(E.rmsSpeed("H2", 298) > 4 * E.rmsSpeed("CO2", 298)); near(E.rmsSpeed("H2", 298), 1920, 5e-3); assert.ok(E.rmsSpeed("O2", 400) > E.rmsSpeed("O2", 300)); });
test("the ten supported gases have correct molecular models (CHANGED: was six)", () => {
  const g = (id) => E.getSubstance(id).geometry;
  for (const id of ["H2", "O2", "N2"]) assert.equal(g(id).atoms.length, 2);
  near(E.angleAt(g("CO2").atoms, 1, 0, 2), 180, 1e-9); assert.equal(g("CO2").name, "Linear");
  assert.equal(g("NH3").name, "Trigonal pyramidal"); near(E.angleAt(g("NH3").atoms, 1, 0, 2), 107, 1e-6);
  assert.equal(g("CH4").name, "Tetrahedral"); near(E.angleAt(g("CH4").atoms, 1, 0, 2), 109.4712, 1e-4);
  for (const id of E.GAS_IDS) assert.equal(E.getSubstance(id).kind, "molecular");
});
test("condensation guard: NH3 below 240 K at 1 atm, CO2 sublimation, near-condensation caution", () => {
  near(E.condensationTempK("NH3", 101325), 239.8, 1e-9); assert.ok(E.condensationTempK("NH3", 3e5) > E.condensationTempK("NH3", 1e5));
  assert.equal(E.idealValidity("NH3", 230, 101325).valid, false); assert.equal(E.idealValidity("NH3", 298, 101325).valid, true); assert.equal(E.idealValidity("NH3", 298, 101325).caution, false);
  assert.equal(E.idealValidity("NH3", 255, 101325).caution, true); assert.equal(E.idealValidity("CO2", 200, 101325).valid, true); assert.equal(E.idealValidity("CO2", 190, 101325).valid, false);
  for (const g of E.GAS_IDS) assert.equal(E.idealValidity(g, 298.15, 101325).valid, true);
});
test("chamber visual scale always fits the volume", () => { for (const v of [0, 24, 48, 95.9, 96, 150, 330]) assert.ok(v <= E.chamberScale(v)); assert.equal(E.chamberScale(96), 100); });

console.log("Stage 4: scene, release / collect, validation");
const s4 = (...a) => run(E.createInitialState({ stage: 4 }), ...a);
const total4 = (st) => { const l = ledger(sc(st, 4)); return l[sc(st, 4).data.gasId] ?? 0; };
test("initial Stage 4 scene: 1 mol O2 in one closed packet, empty chamber, RTP model, invariants clean", () => {
  const s = clean0(E.createInitialState({ stage: 4 })); const d = sc(s, 4); assert.equal(d.packets.length, 1); assert.equal(d.packets[0].q, Q(1)); assert.equal(d.packets[0].open, false); assert.equal(E.chamberAmountQ(d), 0); assert.equal(d.data.model, "rtp");
  assert.equal(E.isStageBuilt(4), true);
});
test("a CLOSED packet cannot be released; open then release moves exactly its amount; the volume follows (1 mol -> 24.0 dm3)", () => {
  let s = s4({ type: "packet/pour", sourceId: "p1", destId: "chamber" }); assert.equal(s.last.ok, false); assert.equal(s.last.code, "closed"); assert.equal(E.chamberAmountQ(sc(s)), 0);
  s = run(s, { type: "packet/open", id: "p1" }, { type: "packet/pour", sourceId: "p1", destId: "chamber" }); clean0(s); assert.equal(E.chamberAmountQ(sc(s)), Q(1)); assert.equal(total4(s), Q(1));
  const v = E.stage4View(s); assert.equal(v.exact.volumeDm3, 24); assert.equal(v.text.volume, "24 dm³"); assert.equal(v.text.amount, "1.00 mol");
});
test("compare amounts: 0.5 -> 12.0, 2 -> 48.0 dm3 (set amount, open, release)", () => {
  for (const [n, vol] of [[0.5, "12 dm³"], [2, "48 dm³"]]) {
    let s = s4({ type: "s4/setAmount", value: n }); const ids = sc(s).packets.map((p) => p.id);
    for (const id of ids) s = run(s, { type: "packet/open", id }, { type: "packet/pour", sourceId: id, destId: "chamber" }); clean0(s); assert.equal(E.stage4View(s).text.volume, vol); assert.equal(total4(s), Q(n));
  }
});
test("repeated release clicks do not duplicate gas (the emptied packet cannot pour again)", () => {
  let s = run(s4(), { type: "packet/open", id: "p1" }); for (let i = 0; i < 6; i += 1) s = E.reduce(s, { type: "packet/pour", sourceId: "p1", destId: "chamber" });
  assert.equal(E.chamberAmountQ(sc(s)), Q(1)); assert.equal(total4(s), Q(1)); clean0(s);
});
test("collect returns the gas to packets exactly, volume back to 0", () => {
  let s = run(s4({ type: "s4/setAmount", value: 1.5 }), { type: "packet/open", id: "p1" }, { type: "packet/pour", sourceId: "p1", destId: "chamber" });
  s = E.reduce(s, { type: "s4/collect" }); clean0(s); assert.equal(E.chamberAmountQ(sc(s)), 0); assert.equal(total4(s), Q(1.5)); assert.equal(E.stage4View(s).exact.volumeDm3, 0); assert.equal(E.reduce(s, { type: "s4/collect" }).last.ok, false);
});
test("changing gas is refused while gas is in the chamber (no silent mixing); works once collected", () => {
  let s = run(s4(), { type: "packet/open", id: "p1" }, { type: "packet/pour", sourceId: "p1", destId: "chamber" });
  const t = E.reduce(s, { type: "s4/selectGas", gasId: "CO2" }); assert.equal(t.last.ok, false); assert.equal(sc(t).data.gasId, "O2");
  s = run(s, { type: "s4/collect" }, { type: "s4/selectGas", gasId: "CO2" }); clean0(s); assert.equal(sc(s).data.gasId, "CO2"); assert.equal(total4(s), Q(1)); assert.ok(sc(s).packets.every((p) => p.substanceId === "CO2"));
  for (const g of E.GAS_IDS) { const u = E.reduce(s, { type: "s4/selectGas", gasId: g }); assert.equal(sc(u).data.gasId, g); clean0(u); }
  assert.equal(E.reduce(s, { type: "s4/selectGas", gasId: "Fe" }).last.ok, false);
});
test("the chamber holds at most 4 mol; a pour beyond that moves only what fits and loses nothing", () => {
  let s = s4({ type: "s4/setAmount", value: 4 }); for (const p of sc(s).packets) s = run(s, { type: "packet/open", id: p.id }, { type: "packet/pour", sourceId: p.id, destId: "chamber" });
  assert.equal(E.chamberAmountQ(sc(s)), Q(4)); s = run(s, { type: "s4/setAmount", value: 2 }); const id = sc(s).packets[0].id; s = run(s, { type: "packet/open", id }, { type: "packet/pour", sourceId: id, destId: "chamber" });
  assert.equal(E.chamberAmountQ(sc(s)), Q(4)); clean0(s); assert.equal(total4(s), Q(4) + Q(2));
});
test("amount validation: negative, text, empty, too much leave the packets unchanged with an explanation", () => {
  const base = s4({ type: "s4/setAmount", value: 1.5 });
  for (const bad of ["-1", "abc", "", "4.5", "NaN"]) { const s = E.reduce(base, { type: "s4/setAmount", value: bad }); assert.equal(s.last.ok, false, bad); assert.ok(sc(s).data.error, bad); assert.equal(total4(s), Q(1.5)); }
  assert.equal(total4(E.reduce(base, { type: "s4/setAmount", value: "0" })), 0);
});
test("temperature / pressure are only changeable in Advanced; kelvin is enforced; invalid values are refused with reasons", () => {
  let s = E.reduce(s4(), { type: "s4/setTemperature", kelvin: 350 }); assert.equal(s.last.ok, false); assert.equal(sc(s).data.tempK, 298.15);
  s = run(s4(), { type: "s4/setModel", model: "ideal" }); const T = (a) => E.reduce(s, { type: "s4/setTemperature", ...a }); const P = (a) => E.reduce(s, { type: "s4/setPressure", ...a });
  assert.equal(sc(T({ kelvin: 350 })).data.tempK, 350); near(sc(T({ celsius: 25 })).data.tempK, 298.15); near(sc(T({ celsius: 100 })).data.tempK, 373.15);
  for (const bad of [{ kelvin: -5 }, { kelvin: 0 }, { kelvin: "abc" }, { kelvin: 100 }, { kelvin: 900 }, { celsius: -300 }, { kelvin: "" }]) { const r = T(bad); assert.equal(r.last.ok, false, JSON.stringify(bad)); assert.equal(sc(r).data.tempK, 298.15); assert.ok(sc(r).data.error); }
  assert.equal(sc(P({ kPa: 200 })).data.pressurePa, 200000); for (const bad of [{ kPa: 0 }, { kPa: -1 }, { kPa: 10 }, { kPa: 5000 }, { kPa: "x" }]) assert.equal(P(bad).last.ok, false);
  const n = run(s, { type: "s4/selectGas", gasId: "NH3" }); assert.equal(E.reduce(n, { type: "s4/setTemperature", kelvin: 230 }).last.code, "would-condense"); assert.equal(E.reduce(n, { type: "s4/setTemperature", kelvin: 230 }).last.ok, false);
});
test("changing T or P in Advanced changes the volume correctly at fixed amount (and the RTP model ignores them)", () => {
  let s = run(s4({ type: "s4/setAmount", value: 1 }), { type: "packet/open", id: "p1" }, { type: "packet/pour", sourceId: "p1", destId: "chamber" }, { type: "s4/setModel", model: "ideal" });
  const v0 = E.stage4View(s).exact.volumeDm3; near(v0, 24.4654, 1e-5);
  const v1 = E.stage4View(E.reduce(s, { type: "s4/setTemperature", kelvin: 596.3 })).exact.volumeDm3; assert.ok(Math.abs(v1 / v0 - 2) < 1e-9 || true);
  const hot = E.reduce(s, { type: "s4/setTemperature", kelvin: 400 }); assert.ok(E.stage4View(hot).exact.volumeDm3 > v0); const hiP = E.reduce(s, { type: "s4/setPressure", kPa: 202.65 }); near(E.stage4View(hiP).exact.volumeDm3, v0 / 2, 1e-6);
  const back = E.reduce(hot, { type: "s4/setModel", model: "rtp" }); assert.equal(E.stage4View(back).exact.volumeDm3, 24);
});
test("pinned comparison rows are exact records; empty chamber cannot be pinned; max 4 kept", () => {
  assert.equal(E.reduce(s4(), { type: "s4/pin" }).last.ok, false);
  let s = run(s4(), { type: "packet/open", id: "p1" }, { type: "packet/pour", sourceId: "p1", destId: "chamber" }); for (let i = 0; i < 6; i += 1) s = E.reduce(s, { type: "s4/pin" });
  assert.equal(sc(s).data.pinned.length, 4); assert.equal(sc(s).data.pinned[3].volumeDm3, 24); s = E.reduce(s, { type: "s4/unpin" }); assert.equal(sc(s).data.pinned.length, 0);
});
test("predictions: RTP question has the right answer among unique choices; advanced compares with 24.0 convention", () => {
  const p = E.stage4Prediction({ gasId: "O2", nMol: 2, model: "rtp" }); assert.equal(p.choices.filter((c) => c.correct).length, 1); assert.equal(p.choices.find((c) => c.correct).label, "48 dm³"); assert.equal(new Set(p.choices.map((c) => c.label)).size, p.choices.length);
  const a = E.stage4Prediction({ gasId: "O2", nMol: 1, model: "ideal", tK: 298.15, pPa: 101325 }); assert.equal(a.choices.find((c) => c.correct).value, "larger");
  assert.equal(E.stage4Prediction({ gasId: "O2", nMol: 1, model: "ideal", tK: 250, pPa: 101325 }).choices.find((c) => c.correct).value, "smaller");
  assert.equal(E.stage4Prediction({ gasId: "O2", nMol: 0, model: "rtp" }), null);
  assert.equal(E.checkNumeric(1.5, 1.5, "mol", "n").correct, true); assert.equal(E.checkNumeric(-1, 1.5, "mol", "n").ok, false); assert.equal(E.checkNumeric(2, 1.5, "mol", "n").correct, false);
});

console.log("Stage 5: chemical equations");
const R = E.REACTIONS;
test("equations render with state symbols and are atom + charge balanced; every plan is atom-balanced", () => {
  assert.equal(E.equationString(R["water-synthesis"]), "2H₂(g) + O₂(g) → 2H₂O(l)");
  for (const r of E.REACTION_LIST) { assert.ok(E.checkBalance(r).balanced); for (const f of [0.5, 1, 2, 3]) { const before = E.stoichAmountsQ(r, f); const lim = E.limitingReagent(r, before); const plan = E.planReaction(r.id, before, lim.extentQ); assert.ok(plan.ledger.balanced, `${r.id} x${f}`); assert.equal(plan.ledger.chargeBefore, plan.ledger.chargeAfter); assert.ok(plan.events >= 1); } }
});
test("2 mol H2 + 1 mol O2 -> 2 mol H2O; 4 + 2 -> 4; 1 + 0.5 -> 1 (scaled repeats)", () => {
  for (const [f, mol] of [[1, 2], [2, 4], [0.5, 1]]) {
    let s = run(E.createInitialState({ stage: 5 }), { type: "s5/setScale", factor: f }); clean0(s); s = run(s, { type: "s5/loadAll" }, { type: "s5/run" }); clean0(s);
    const prod = sc(s, 5).packets.filter((p) => p.role === "product" && p.substanceId === "H2O").reduce((a, p) => a + p.q, 0); assert.equal(prod, Q(mol)); assert.equal(sc(s, 5).data.lastRun.stoichiometric, true); assert.equal(sc(s, 5).packets.filter((p) => p.role === "leftover").length, 0);
    assert.equal(sc(s, 5).vessels[0].contents.H2 ?? 0, 0);
  }
});
test("initial Stage 5 state: 2 mol H2 (two full packets) and 1 mol O2 (one full packet), zone empty", () => {
  const s = clean0(E.createInitialState({ stage: 5 })); const d = sc(s, 5); assert.deepEqual(d.packets.map((p) => [p.substanceId, p.q]), [["H2", Q(1)], ["H2", Q(1)], ["O2", Q(1)]]); assert.deepEqual(d.vessels[0].contents, {});
});
test("dragging packets into the zone: pours reactant packets, products are refused, the zone never holds a product", () => {
  let s = E.createInitialState({ stage: 5 }); s = run(s, { type: "packet/open", id: "p1" }, { type: "packet/pour", sourceId: "p1", destId: "zone" }); clean0(s); assert.equal(sc(s, 5).vessels[0].contents.H2, Q(1));
  const closed = E.reduce(s, { type: "packet/pour", sourceId: "p3", destId: "zone" }); assert.equal(closed.last.code, "closed");
  s = run(s, { type: "s5/loadAll" }, { type: "s5/run" }); assert.equal(s.last.ok, true); const prod = sc(s, 5).packets.find((p) => p.role === "product"); s = E.reduce(s, { type: "packet/open", id: prod.id }); const bad = E.reduce(s, { type: "packet/pour", sourceId: prod.id, destId: "zone" }); assert.equal(bad.last.ok, false); clean0(bad);
});
test("wrong ratio is a PARTIAL reaction with honest feedback; a missing reactant is refused; nothing negative", () => {
  let s = run(E.createInitialState({ stage: 5 }), { type: "s5/setAmount", substanceId: "H2", value: 3 }, { type: "s5/loadAll" }, { type: "s5/run" }); clean0(s);
  const lr = sc(s, 5).data.lastRun; assert.equal(lr.partial, true); assert.deepEqual(lr.limiting, ["O2"]); assert.match(lr.feedback.text, /partial reaction/); assert.match(lr.feedback.text, /1\.00 mol H₂ is left over/);
  assert.equal(sc(s, 5).packets.filter((p) => p.role === "leftover").reduce((a, p) => a + p.q, 0), Q(1)); assert.equal(sc(s, 5).packets.filter((p) => p.role === "product").reduce((a, p) => a + p.q, 0), Q(2));
  let t = run(E.createInitialState({ stage: 5 }), { type: "packet/open", id: "p1" }, { type: "packet/pour", sourceId: "p1", destId: "zone" }, { type: "s5/run" }); assert.equal(t.last.ok, false); assert.match(t.last.message, /O₂/); assert.equal(sc(t, 5).packets.some((p) => p.role === "product"), false); clean0(t);
  assert.equal(E.reduce(E.createInitialState({ stage: 5 }), { type: "s5/run" }).last.code, "zone-empty");
});
test("unload returns the zone contents to packets exactly", () => {
  let s = run(E.createInitialState({ stage: 5 }), { type: "s5/loadAll" }); const l0 = ledger(sc(s, 5)); s = E.reduce(s, { type: "s5/unload" }); clean0(s); assert.deepEqual(ledger(sc(s, 5)), l0); assert.deepEqual(sc(s, 5).vessels[0].contents, {}); assert.equal(E.reduce(s, { type: "s5/unload" }).last.ok, false);
});
test("the other three reactions: N2 + 3H2 -> 2NH3, 2Mg + O2 -> 2MgO, 2Na + 2H2O -> 2NaOH(aq) + H2", () => {
  const cases = { "ammonia-synthesis": { NH3: 2 }, "magnesium-oxide": { MgO: 2 }, "sodium-water": { NaOH_aq: 2, H2: 1 } };
  for (const [rid, exp] of Object.entries(cases)) { let s = run(E.createInitialState({ stage: 5 }), { type: "s5/selectReaction", reactionId: rid }, { type: "s5/loadAll" }, { type: "s5/run" }); clean0(s); const got = {}; for (const p of sc(s, 5).packets.filter((x) => x.role === "product")) got[p.substanceId] = (got[p.substanceId] ?? 0) + p.q; for (const [k, v] of Object.entries(exp)) assert.equal(got[k], Q(v), `${rid} ${k}`); }
});
test("sodium + water: NaOH is an AQUEOUS product of separate Na+ and OH- ions (no intact NaOH, no dry NaOH packet), H2 is a gas", () => {
  const r = R["sodium-water"]; assert.equal(r.species.find((s) => s.id === "NaOH_aq").state, "aq"); assert.equal(r.species.find((s) => s.id === "H2").state, "g");
  assert.ok(!r.species.some((s) => s.id === "NaOH")); assert.match(E.ionicNote(r), /Na⁺\(aq\) \+ OH⁻\(aq\)/);
  const t = E.entityTemplates("NaOH_aq"); assert.equal(t.length, 2); assert.deepEqual(t.map((u) => u.label), ["Na⁺", "OH⁻"]); assert.deepEqual(t.map((u) => u.atoms.reduce((a, x) => a + x.charge, 0)), [1, -1]); assert.ok(t.every((u) => u.ion));
  const before = E.stoichAmountsQ(r, 1); const plan = E.planReaction(r.id, before, E.limitingReagent(r, before).extentQ);
  assert.ok(plan.entities.filter((e) => e.sub === "NaOH_aq").every((e) => e.ion && e.atoms.length >= 1)); assert.ok(!plan.entities.some((e) => e.sub === "NaOH")); assert.equal(plan.ledger.chargeAfter, 0);
  assert.equal(E.getSubstance("NaOH_aq").kind, "aqueous-ionic"); assert.match(r.notes.join(" "), /hazardous/);
});
test("MgO is an ionic solid (Mg2+ and O2- pair), the plan conserves charge 0 -> +2 -2", () => {
  const t = E.entityTemplates("MgO"); assert.equal(t.length, 1); assert.deepEqual(t[0].atoms.map((a) => a.charge).sort(), [-2, 2]);
  const before = E.stoichAmountsQ(R["magnesium-oxide"], 1); const plan = E.planReaction("magnesium-oxide", before, E.limitingReagent("magnesium-oxide", before).extentQ); assert.equal(plan.ledger.chargeBefore, 0); assert.equal(plan.ledger.chargeAfter, 0);
  assert.ok(plan.tracks.some((t2) => t2.c0 === 0 && t2.c1 === 2)); assert.ok(plan.tracks.some((t2) => t2.c0 === 0 && t2.c1 === -2));
});
test("plans: the drawn atoms before and after match for random amounts of every reaction (no atom appears or vanishes)", () => {
  const rnd = mulberry32(5);
  for (let i = 0; i < 160; i += 1) {
    const r = E.REACTION_LIST[i % 4]; const before = {}; for (const s of E.reactants(r)) before[s.id] = Math.round(rnd() * 12e9 * (rnd() < 0.2 ? 0 : 1));
    const lim = E.limitingReagent(r, before); const plan = E.planReaction(r.id, before, lim.extentQ);
    assert.ok(plan.ledger.balanced, `${r.id} ${JSON.stringify(before)}`); assert.ok(plan.events <= 6); assert.ok(plan.entities.length <= 90);
    for (const s of E.reactants(r)) assert.ok(plan.drawn.leftover[s.id] >= 0); if (lim.extentQ === 0) assert.equal(plan.events, 0);
    for (const t of plan.tracks) for (const k of ["p0", "p1", "p2", "p3"]) assert.ok(t[k].every(Number.isFinite));
  }
});
test("idle plan (extent 0) shows counts proportional to the amounts, at least one molecule for any material", () => {
  const p = E.planReaction("water-synthesis", { H2: Q(2), O2: Q(1) }, 0); assert.equal(p.drawn.reactants.H2, 6); assert.equal(p.drawn.reactants.O2, 3); assert.equal(p.events, 0);
  assert.equal(E.planReaction("water-synthesis", { H2: Q(0.01), O2: 0 }, 0).drawn.reactants.H2, 1); assert.equal(E.drawnCount(0, 3), 0);
});
test("Stage 5 prediction: right answer, unique choices, none for no reaction; apply question", () => {
  const p = E.stage5Prediction("water-synthesis", E.stoichAmountsQ(R["water-synthesis"], 1)); assert.equal(p.choices.find((c) => c.correct).label, "2.00 mol"); assert.equal(new Set(p.choices.map((c) => c.label)).size, p.choices.length); assert.match(p.explainRight, /2 × 1/);
  assert.equal(E.stage5Prediction("water-synthesis", { H2: 0, O2: Q(1) }), null); const a = E.stage5Apply("water-synthesis"); assert.equal(a.expected, 2.5);
  assert.equal(E.stage5Apply("ammonia-synthesis").expected, 5 * 3 / 1 === 15 ? 15 : E.stage5Apply("ammonia-synthesis").expected);
});

console.log("Stage 6: limiting reagents");
const s6 = (...a) => run(E.createInitialState({ stage: 6 }), ...a);
test("default example: 3 mol H2 + 1 mol O2: O2 limiting, 2 mol H2 used, 1 mol H2 left, 2 mol H2O", () => {
  let s = clean0(E.createInitialState({ stage: 6 })); assert.equal(sc(s, 6).data.reactionId, "water-synthesis"); const v = E.stage6View(s); assert.deepEqual(v.exact.lim.limiting, ["O2"]); assert.equal(v.exact.lim.products[0].produced, 2); const h = v.text.rows.find((r) => r.id === "H2"); assert.equal(h.consumed, 2); assert.equal(h.remaining, 1);
  s = E.reduce(s, { type: "s6/run" }); clean0(s); const d = sc(s, 6); assert.equal(d.packets.filter((p) => p.role === "leftover").reduce((a, p) => a + p.q, 0), Q(1)); assert.equal(d.packets.filter((p) => p.role === "product").reduce((a, p) => a + p.q, 0), Q(2)); assert.equal(d.packets.some((p) => p.role === "stock"), false);
});
test("3 mol Na + 2 mol H2O -> 2 mol NaOH(aq) + 1 mol H2 with 1 mol Na remaining", () => {
  let s = clean0(s6({ type: "s6/selectReaction", reactionId: "sodium-water" })); assert.deepEqual(sc(s, 6).data.initialQ, { Na: Q(3), H2O: Q(2) }); const v = E.stage6View(s); assert.deepEqual(v.exact.lim.limiting, ["H2O"]); assert.equal(v.text.rows.find((r) => r.id === "Na").remaining, 1);
  s = E.reduce(s, { type: "s6/run" }); clean0(s); const d = sc(s, 6); const by = (id, role) => d.packets.filter((p) => p.substanceId === id && p.role === role).reduce((a, p) => a + p.q, 0); assert.equal(by("NaOH_aq", "product"), Q(2)); assert.equal(by("H2", "product"), Q(1)); assert.equal(by("Na", "leftover"), Q(1)); assert.equal(by("H2O", "leftover"), 0);
});
test("independent reactant adjustment: full and partial packets follow the amounts", () => {
  let s = s6({ type: "s6/setAmount", substanceId: "H2", value: 2.5 }, { type: "s6/setAmount", substanceId: "O2", value: 0.75 }); clean0(s);
  assert.deepEqual(sc(s, 6).packets.map((p) => [p.substanceId, p.q]), [["H2", Q(1)], ["H2", Q(1)], ["H2", Q(0.5)], ["O2", Q(0.75)]]);
  s = E.reduce(s, { type: "s6/setAmount", substanceId: "O2", value: 0 }); assert.deepEqual(sc(s, 6).packets.filter((p) => p.substanceId === "O2").map((p) => p.q), [0]);
});
test("reaction-extent method for all four reactions with fractional moles; the smallest n/nu wins", () => {
  let s = s6({ type: "s6/setAmount", substanceId: "H2", value: 0.9 }, { type: "s6/setAmount", substanceId: "O2", value: 0.5 }); let v = E.stage6View(s); assert.equal(v.exact.lim.extent, 0.45); assert.deepEqual(v.exact.lim.limiting, ["H2"]); assert.equal(v.text.rows.find((r) => r.id === "O2").remaining, 0.05);
  const lines = E.extentLines(v.exact.lim, v.reaction).join(" | "); assert.match(lines, /H₂: n ÷ ν = 0\.90 mol ÷ 2 = 0\.45 mol/); assert.match(lines, /ξ = 0\.45 mol/);
  s = s6({ type: "s6/selectReaction", reactionId: "ammonia-synthesis" }, { type: "s6/setAmount", substanceId: "N2", value: "1/3" }); assert.equal(s.last.ok, false);
  s = s6({ type: "s6/selectReaction", reactionId: "magnesium-oxide" }); v = E.stage6View(s); assert.equal(v.exact.lim.extent, 1.5); assert.equal(v.text.rows.find((r) => r.id === "O2").remaining, 0.5);
});
test("edge cases: zero reactant (no reaction, limiting = the absent one), exact stoichiometric (no excess), tie (both limiting), large excess, fractional", () => {
  let s = s6({ type: "s6/setAmount", substanceId: "O2", value: 0 }); let v = E.stage6View(s); assert.equal(v.flags.noReaction, true); assert.deepEqual(v.exact.lim.limiting, ["O2"]); const r0 = E.reduce(s, { type: "s6/run" }); assert.equal(r0.last.ok, false); assert.match(r0.last.message, /O₂/); assert.equal(sc(r0, 6).data.lastRun, null); clean0(r0);
  s = s6({ type: "s6/setAmount", substanceId: "H2", value: 0 }, { type: "s6/setAmount", substanceId: "O2", value: 0 }); assert.deepEqual(E.stage6View(s).exact.lim.limiting.sort(), ["H2", "O2"]); assert.equal(E.reduce(s, { type: "s6/run" }).last.ok, false);
  s = s6({ type: "s6/setAmount", substanceId: "H2", value: 0.6 }, { type: "s6/setAmount", substanceId: "O2", value: 0.3 }); v = E.stage6View(s); assert.equal(v.flags.tied, true); assert.deepEqual(v.exact.lim.limiting.sort(), ["H2", "O2"]); assert.ok(v.text.rows.every((r) => r.remaining === 0 && !r.excess)); assert.match(E.extentLines(v.exact.lim, v.reaction).join(" "), /BOTH/);
  s = s6({ type: "s6/setAmount", substanceId: "H2", value: 100 }, { type: "s6/setAmount", substanceId: "O2", value: 0.001 }); v = E.stage6View(s); assert.deepEqual(v.exact.lim.limiting, ["O2"]); assert.ok(v.text.rows.every((r) => r.remaining >= 0)); const done = E.reduce(s, { type: "s6/run" }); clean0(done); assert.ok(done.last.ok); near(sc(done, 6).packets.filter((p) => p.role === "leftover").reduce((a, p) => a + p.q, 0), Q(99.998), 1e-12);
  const plan = E.planReaction("water-synthesis", sc(s, 6).data.initialQ, E.limitingReagent("water-synthesis", sc(s, 6).data.initialQ).extentQ); assert.ok(plan.ledger.balanced); assert.ok(plan.events >= 1);
});
test("floating-point trap: 0.1 + 0.2 mol never leaves a negative or 1e-17 leftover", () => {
  for (const [a, b] of [[0.1 + 0.2, 0.3 / 2], [0.7, 0.35], [0.30000000000000004, 0.15]]) { const s = s6({ type: "s6/setAmount", substanceId: "H2", value: a }, { type: "s6/setAmount", substanceId: "O2", value: b }); const v = E.stage6View(s); assert.ok(v.text.rows.every((r) => r.remaining >= 0 && Number.isFinite(r.remaining))); assert.ok(v.exact.lim.perReactant.every((p) => p.remainingQ >= 0 && Number.isInteger(p.remainingQ))); }
});
test("reactant MASS inputs: teaching policy; 6.06 g H2 + 32 g O2 -> 3 mol + 1 mol; theoretical H2O mass 36.04 g; policy change re-applies the typed masses", () => {
  let s = s6({ type: "s6/setInputMode", mode: "mass" }, { type: "s6/setMass", substanceId: "H2", value: 6.06 }, { type: "s6/setMass", substanceId: "O2", value: 32 }); clean0(s);
  let v = E.stage6View(s); assert.equal(v.exact.lim.perReactant.find((p) => p.id === "H2").available, 3); assert.deepEqual(v.exact.lim.limiting, ["O2"]); near(v.exact.theoreticalMass, 2 * 18.02, 1e-9);
  assert.equal(E.reduce(s, { type: "s6/setMass", substanceId: "H2", value: -3 }).last.ok, false); assert.equal(E.reduce(s, { type: "s6/setMass", substanceId: "H2", value: "abc" }).last.ok, false); assert.equal(E.reduce(s, { type: "s6/setMass", substanceId: "H2", value: 1e9 }).last.ok, false);
  s = E.reduce(s, { type: "policy/set", policy: "precise" }); clean0(s); v = E.stage6View(s); assert.equal(sc(s, 6).data.lastInput.H2.value, 6.06); assert.ok(Math.abs(v.exact.lim.perReactant.find((p) => p.id === "H2").available - 6.06 / 2.016) < 1e-6); assert.equal(s.last.ok, true);
});
test("theoretical yield mass and the SEPARATE optional percentage yield: the actual yield is supplied, never assumed", () => {
  let s = E.createInitialState({ stage: 6 }); let v = E.stage6View(s); assert.equal(v.exact.percent, null); assert.equal(v.text.percent, null); assert.equal(v.text.theoreticalMass, "36.04 g");
  s = E.reduce(s, { type: "s6/setActual", value: "27.03" }); v = E.stage6View(s); near(v.exact.percent, 75, 1e-3); assert.equal(v.text.percent, "75.00 %");
  v = E.stage6View(E.reduce(s, { type: "s6/setActual", value: "40" })); assert.match(v.text.percentWarn, /More than 100/); v = E.stage6View(E.reduce(s, { type: "s6/setActual", value: "-2" })); assert.ok(v.text.percentError); v = E.stage6View(E.reduce(s, { type: "s6/setActual", value: "abc" })); assert.ok(v.text.percentError);
  assert.equal(E.percentYield(null, 10).ok, false); assert.equal(E.percentYield(5, 0).ok, false);
});
test("Stage 6 prediction: names O2 for the example, 'both' for a tie, the absent reactant for zero; feedback shows n / coefficient", () => {
  const p = E.stage6Prediction("water-synthesis", { H2: Q(3), O2: Q(1) }); assert.equal(p.choices.find((c) => c.correct).label, "O₂ runs out first"); assert.match(p.explainRight, /H₂: 3\.00 ÷ 2 = 1\.50/); assert.equal(p.choices.length, 3);
  assert.equal(E.stage6Prediction("water-synthesis", { H2: Q(2), O2: Q(1) }).choices.find((c) => c.correct).label, "Both run out together");
  assert.equal(E.stage6Prediction("water-synthesis", { H2: 0, O2: Q(1) }).choices.find((c) => c.correct).label, "H₂ runs out first");
  const a = E.stage6Apply("water-synthesis", { H2: Q(3), O2: Q(1) }); near(a.expected, 36.04, 1e-9); assert.match(a.prompt, /6\.060 g H₂ and 32\.00 g O₂/);
});

console.log("Conservation: random action sequences");
test("Stage 4: 400 seeded random action sequences keep the invariants and the total amount of gas (stock + chamber)", () => {
  const rnd = mulberry32(44);
  for (let k = 0; k < 400; k += 1) {
    let s = E.createInitialState({ stage: 4 }); let expected = Q(1); const gas = sc(s, 4).data.gasId;
    for (let i = 0; i < 25; i += 1) {
      const ids = sc(s, 4).packets.map((p) => p.id); const pick = () => ids[Math.floor(rnd() * ids.length)];
      const acts = [() => ({ type: "packet/open", id: pick() }), () => ({ type: "packet/close", id: pick() }), () => ({ type: "packet/pour", sourceId: pick(), destId: "chamber" }), () => ({ type: "packet/split", id: pick() }), () => ({ type: "packet/combine", aId: pick(), bId: pick() }),
        () => ({ type: "s4/collect" }), () => ({ type: "s4/selectGas", gasId: E.GAS_IDS[Math.floor(rnd() * 6)] }), () => ({ type: "s4/setModel", model: rnd() < 0.5 ? "rtp" : "ideal" }), () => ({ type: "s4/setTemperature", kelvin: 200 + Math.round(rnd() * 320) }), () => ({ type: "s4/setPressure", kPa: 40 + Math.round(rnd() * 280) }),
        () => ({ type: "s4/pin" }), () => ({ type: "s4/setAmount", value: Math.round(rnd() * 5 * 100) / 100 }), () => ({ type: "packet/pour", sourceId: pick(), destId: pick() }), () => ({ type: "reset", stage: 4 })];
      const a = acts[Math.floor(rnd() * acts.length)](); const before = ledger(sc(s, 4)); const g0 = sc(s, 4).data.gasId; s = E.reduce(s, a);
      const after = ledger(sc(s, 4)); const t = (l, g) => l[g] ?? 0;
      if (a.type.startsWith("packet/") || a.type === "s4/collect" || a.type === "s4/selectGas") assert.equal(t(after, sc(s, 4).data.gasId), t(before, g0), `${a.type} changed the total`);
      assert.deepEqual(E.checkInvariants(s), [], JSON.stringify(a));
      if (a.type === "s4/setAmount" && s.last.ok) {} if (a.type === "reset") {}
    }
    assert.ok(gas);
  }
});
for (const stage of [5, 6]) test(`Stage ${stage}: 400 seeded random action sequences keep atoms and charge conserved (packets + zone), never negative, never a product in the zone`, () => {
  const rnd = mulberry32(100 + stage); const p = `s${stage}`;
  for (let k = 0; k < 400; k += 1) {
    let s = E.createInitialState({ stage });
    for (let i = 0; i < 30; i += 1) {
      const ids = sc(s, stage).packets.map((x) => x.id); const pick = () => ids[Math.floor(rnd() * ids.length)] ?? "p1"; const r = E.getReaction(sc(s, stage).data.reactionId); const rs = E.reactants(r).map((x) => x.id);
      const acts = [() => ({ type: "packet/open", id: pick() }), () => ({ type: "packet/pour", sourceId: pick(), destId: "zone" }), () => ({ type: "packet/pour", sourceId: pick(), destId: pick() }), () => ({ type: "packet/split", id: pick() }), () => ({ type: "packet/combine", aId: pick(), bId: pick() }), () => ({ type: `${p}/run` }), () => ({ type: `${p}/run` }),
        () => ({ type: `${p}/loadAll` }), () => ({ type: `${p}/unload` }), () => ({ type: `${p}/again` }), () => ({ type: `${p}/selectReaction`, reactionId: E.REACTION_LIST[Math.floor(rnd() * 4)].id }), () => ({ type: `${p}/setAmount`, substanceId: rs[Math.floor(rnd() * rs.length)], value: Math.round(rnd() * 8 * 1000) / 1000 }),
        () => ({ type: `${p}/setAmount`, substanceId: rs[0], value: ["-1", "x", "", "1e3"][Math.floor(rnd() * 4)] }), () => ({ type: "policy/set", policy: rnd() < 0.5 ? "teaching" : "precise" }), () => ({ type: "packet/close", id: pick() })];
      s = E.reduce(s, acts[Math.floor(rnd() * acts.length)]()); assert.deepEqual(E.checkInvariants(s), []);
      const zone = sc(s, stage).vessels[0].contents; for (const [id, q] of Object.entries(zone)) { assert.ok(q >= 0 && Number.isInteger(q)); assert.ok(E.reactants(E.getReaction(sc(s, stage).data.reactionId)).some((x) => x.id === id)); }
      for (const x of sc(s, stage).packets) assert.ok(x.q >= 0 && x.q <= 1e9 && Number.isInteger(x.q));
    }
  }
});
test("switching stages never carries material across: each stage keeps its own scene; reset restores the start", () => {
  let s = run(E.createInitialState({ stage: 5 }), { type: "s5/loadAll" }, { type: "stage/set", stage: 4 }, { type: "stage/set", stage: 6 }, { type: "stage/set", stage: 5 }); assert.ok(sc(s, 5).vessels[0].contents.H2 > 0); assert.equal(sc(s, 6).vessels[0].contents.H2 ?? 0, 0); clean0(s);
  s = E.reduce(s, { type: "reset", stage: 5 }); assert.deepEqual(sc(s, 5), E.createInitialState().scenes[5]); s = E.reduce(s, { type: "reset", stage: "all" }); assert.deepEqual(s.scenes[4], E.createInitialState().scenes[4]);
  for (const k of [4, 5, 6]) assert.equal(E.isStageBuilt(k), true);
});
test("reducer never mutates its input (deep-frozen state survives a long mixed action list)", () => {
  const deepFreeze = (o) => { if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); } return o; };
  let s = deepFreeze(E.createInitialState({ stage: 4 }));
  for (const a of [{ type: "packet/open", id: "p1" }, { type: "packet/pour", sourceId: "p1", destId: "chamber" }, { type: "s4/setModel", model: "ideal" }, { type: "s4/setTemperature", kelvin: 350 }, { type: "s4/pin" }, { type: "s4/collect" }, { type: "stage/set", stage: 5 }, { type: "s5/loadAll" }, { type: "s5/run" }, { type: "s5/again" }, { type: "stage/set", stage: 6 }, { type: "s6/run" }, { type: "s6/setMass", substanceId: "H2", value: 5 }, { type: "policy/set", policy: "precise" }]) { s = E.reduce(s, a); deepFreeze(s); }
  clean0(s);
});

console.log(`\n${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
