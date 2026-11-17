#!/usr/bin/env node
// Tests for the Mole Lab experiment store, packet operations, interaction state machine and conservation invariants
// (including seeded property-based random operation sequences):  node scripts/test-mole-lab-store.mjs
import assert from "node:assert/strict";
import * as E from "../src/engines/mole-lab/engine/index.js";

let passed = 0; let failed = 0;
function test(name, fn) { try { fn(); console.log(`  ok   ${name}`); passed += 1; } catch (e) { console.log(`  FAIL ${name}\n       ${(e.stack || e.message).split("\n").slice(0, 6).join("\n       ")}`); failed += 1; } }
const Q = E.toQuanta;
const T0 = (o = {}) => E.createInitialState({ policy: "teaching", ...o }); // tests written for Mg = 24.0 pass the policy EXPLICITLY (the default is the IB data booklet, Mg = 24.31)
function deepFreeze(o) { if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); } return o; }
const run = (s, ...actions) => actions.reduce((st, a) => E.reduce(st, a), s);
const sc = (s, stage) => s.scenes[stage ?? s.stage];
const total = (scene, id) => scene.packets.filter((p) => !id || p.substanceId === id).reduce((a, p) => a + p.q, 0);
const clean0 = (s) => { assert.deepEqual(E.checkInvariants(s), []); return s; };
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

console.log("Initial state");
test("initial state is consistent, deterministic and starts with H2O (Stage 1) / Mg (Stage 2)", () => {
  const a = E.createInitialState(); const b = E.createInitialState(); assert.deepEqual(a, b); clean0(a);
  assert.equal(a.stage, 1); assert.equal(a.mode, "guided"); assert.equal(a.policy, "booklet");
  assert.equal(sc(a, 1).data.substanceId, "H2O"); assert.equal(total(sc(a, 1)), Q(1)); assert.equal(sc(a, 2).data.substanceId, "Mg");
  assert.equal(sc(a, 1).packets.length, 1); assert.equal(sc(a, 1).packets[0].q, Q(1));
});
test("Stages that are not built yet are placeholders and say so; Stage 3 is built", () => { const s = T0(); assert.equal(E.isStageBuilt(3), true, "Stage 3 is built"); for (const k of [3, 4, 5, 6]) { if (!E.isStageBuilt(k)) assert.equal(sc(s, k).data.pending, true); } assert.ok(E.isStageBuilt(1) && E.isStageBuilt(2)); });
test("reducer never mutates its input (deep-frozen state survives a long action list)", () => {
  let s = deepFreeze(T0());
  const acts = [{ type: "s1/setAmount", value: 1.5 }, { type: "s1/separate" }, { type: "s1/recombine" }, { type: "stage/set", stage: 2 }, { type: "s2/setMass", value: 36 }, { type: "packet/split", id: "p1" }, { type: "packet/open", id: "p1" }, { type: "packet/combine", aId: "p1", bId: "p3" }, { type: "mode/set", mode: "free" }, { type: "policy/set", policy: "precise" }, { type: "reset" }, { type: "reset", stage: "all" }];
  for (const a of acts) { s = E.reduce(s, a); deepFreeze(s); }
  clean0(s);
});
test("unknown actions / stages are rejected harmlessly", () => { const s = T0(); const t = E.reduce(s, { type: "nope" }); assert.equal(t.last.ok, false); assert.equal(t.scenes, s.scenes); assert.equal(E.reduce(s, { type: "stage/set", stage: 9 }).stage, 1); assert.equal(E.reduce(s, { type: "mode/set", mode: "x" }).mode, "guided"); });

console.log("Stage 2: Mass <-> Moles");
const s2 = (...a) => run(T0({ stage: 2 }), ...a);
const mass = (g) => ({ type: "s2/setMass", value: g });
test("spec examples: 6 g -> 0.25, 12 -> 0.50, 24 -> 1.00, 36 -> 1.50, 60 -> 2.50 mol (Mg 24.0)", () => {
  for (const [g, n] of [[6, 0.25], [12, 0.5], [24, 1], [36, 1.5], [60, 2.5]]) { const s = clean0(s2(mass(g))); const v = E.stage2View(s); assert.equal(v.exact.n, n); assert.equal(v.exact.totalQ, Q(n)); assert.equal(v.text.amount, E.fmtMol(n) + " mol"); assert.equal(v.exact.massG, g); }
});
test("packets follow the amount: 36 g -> full + half; 60 g -> two full + half; 0 g -> one empty reference packet", () => {
  assert.deepEqual(sc(s2(mass(36))).packets.map((p) => p.q), [Q(1), Q(0.5)]); assert.deepEqual(sc(s2(mass(60))).packets.map((p) => p.q), [Q(1), Q(1), Q(0.5)]);
  const z = clean0(s2(mass(0))); assert.deepEqual(sc(z).packets.map((p) => p.q), [0]); assert.equal(E.stage2View(z).exact.n, 0);
});
test("fills progressively and empties the LAST packet first; ids of untouched packets are stable", () => {
  let s = s2(mass(60)); const ids = sc(s).packets.map((p) => p.id); s = E.reduce(s, mass(36)); assert.deepEqual(sc(s).packets.map((p) => p.id), ids.slice(0, 2)); assert.deepEqual(sc(s).packets.map((p) => p.q), [Q(1), Q(0.5)]);
  s = E.reduce(s, mass(30)); assert.deepEqual(sc(s).packets.map((p) => p.q), [Q(1), Q(0.25)]); s = E.reduce(s, mass(48)); assert.deepEqual(sc(s).packets.map((p) => p.q), [Q(1), Q(1)]);
});
test("validation: negative, text, empty, NaN leave the amount unchanged and report an error; zero and decimals work", () => {
  const base = clean0(s2(mass(36)));
  for (const bad of ["-5", "abc", "", "NaN", "12 g", "1e999"]) { const s = E.reduce(base, mass(bad)); assert.equal(s.last.ok, false, bad); assert.ok(sc(s).data.error, bad); assert.equal(total(sc(s)), Q(1.5), `amount unchanged after "${bad}"`); }
  assert.equal(sc(E.reduce(base, mass(bad0()))).data.error, null);
  function bad0() { return "7.5"; }
  const d = E.stage2View(clean0(s2(mass("7.5")))); assert.equal(d.exact.n, 0.3125); assert.equal(d.text.amount, "0.313 mol");
  assert.equal(E.stage2View(s2(mass("0"))).exact.n, 0);
  const err = E.reduce(base, mass("-5")); const ok = E.reduce(err, mass("24")); assert.equal(sc(ok).data.error, null, "a valid input clears the error");
});
test("out-of-range input (more than 500 mol) is refused and does not create hundreds of packets", () => { const s = E.reduce(s2(mass(24)), mass(1e6)); assert.equal(s.last.ok, false); assert.equal(total(sc(s)), Q(1)); const big = clean0(s2(mass(24 * 480))); assert.equal(sc(big).packets.length, 480); assert.equal(E.stage2View(big).grouped.grouped, true); assert.ok(E.stage2View(big).grouped.drawn <= 8); });
test("+/- mass buttons never go below zero; reverse conversion (moles -> mass) is exact", () => {
  let s = s2(mass(6)); s = E.reduce(s, { type: "s2/addMass", delta: -10 }); assert.equal(E.stage2View(s).exact.massG, 0); assert.equal(s.last.ok, true); assert.equal(sc(s).packets.length, 1);
  s = E.reduce(s, { type: "s2/addMass", delta: 12 }); assert.equal(E.stage2View(s).exact.n, 0.5);
  s = E.reduce(s, { type: "s2/setMoles", value: 2.5 }); assert.equal(E.stage2View(s).exact.massG, 60); assert.equal(E.stage2View(s).text.mass, "60.00 g");
  assert.equal(E.reduce(s, { type: "s2/setMoles", value: -1 }).last.ok, false); assert.equal(E.reduce(s, { type: "s2/setMoles", value: "x" }).last.ok, false);
  s = E.reduce(s, { type: "s2/setDirection", direction: "moles-to-mass" }); assert.match(E.stage2View(s).text.working[0], /m = n × M/);
  assert.equal(E.reduce(s, { type: "s2/setDirection", direction: "bogus" }).last.ok, false);
});
test("substance change keeps the typed input and rebuilds packets; molar mass comes from the table", () => {
  let s = clean0(s2(mass(40), { type: "s2/select", substanceId: "NaOH" })); assert.equal(E.stage2View(s).exact.n, 1); assert.equal(E.stage2View(s).text.molarMass, "40.00 g mol⁻¹");
  s = clean0(E.reduce(s, { type: "s2/select", substanceId: "Fe" })); assert.equal(E.stage2View(s).exact.n, E.fromQuanta(Q(40 / 55.85))); assert.equal(E.reduce(s, { type: "s2/select", substanceId: "NaOH_aq" }).last.ok, false); assert.equal(E.reduce(s, { type: "s2/select", substanceId: "zzz" }).last.ok, false);
  assert.ok(sc(s).packets.every((p) => p.substanceId === "Fe"));
});
test("molar-mass policy is switched EXPLICITLY and re-applies the last typed input", () => {
  let s = s2(mass(12)); assert.equal(E.stage2View(s).exact.n, 0.5); s = E.reduce(s, { type: "policy/set", policy: "precise" }); clean0(s);
  assert.equal(E.stage2View(s).exact.molarMass, 24.305); near(E.stage2View(s).exact.n, 12 / 24.305); assert.match(s.last.message, /precise values/); assert.equal(E.stage2View(s).text.molarMassNote.includes("simplified"), false);
  s = E.reduce(s, { type: "policy/set", policy: "teaching" }); assert.equal(E.stage2View(s).exact.n, 0.5); assert.equal(E.reduce(s, { type: "policy/set", policy: "weird" }).last.ok, false);
  function near(a, b) { assert.ok(Math.abs(a - b) < 1e-8, `${a} ${b}`); }
});

console.log("Stage 1: Explore the Mole");
const s1 = (...a) => run(T0(), ...a);
const kinds = (s) => sc(s, 1).packets.filter((p) => p.role === "counting").map((p) => [p.substanceId, p.q]);
test("1 mol H2O: count -> 2 mol H + 1 mol O; separate -> two full H packets + one full O packet", () => {
  const s = clean0(s1({ type: "s1/count" }, { type: "s1/separate" })); const v = E.stage1View(s);
  assert.deepEqual(v.exact.atoms.map((a) => [a.element, a.mol]), [["H", 2], ["O", 1]]); assert.deepEqual(kinds(s), [["atoms:H", Q(1)], ["atoms:H", Q(1)], ["atoms:O", Q(1)]]);
  assert.equal(v.text.total, "3.00 mol of atoms in total"); assert.equal(v.flags.separated, true);
  assert.ok(sc(s, 1).packets.every((p) => p.substanceId !== "H2" && p.substanceId !== "O2"), "A4: never H2 / O2");
});
test("0.5 mol -> 1 mol H + 0.5 mol O packets; 1.5 mol -> 3 mol H + 1.5 mol O", () => {
  let s = clean0(s1({ type: "s1/setAmount", value: 0.5 }, { type: "s1/separate" })); assert.deepEqual(kinds(s), [["atoms:H", Q(1)], ["atoms:O", Q(0.5)]]);
  s = clean0(s1({ type: "s1/setAmount", value: 1.5 }, { type: "s1/separate" })); assert.deepEqual(kinds(s), [["atoms:H", Q(1)], ["atoms:H", Q(1)], ["atoms:H", Q(1)], ["atoms:O", Q(1)], ["atoms:O", Q(0.5)]]);
});
test("changing the amount resets the counting view (repeat the calculation) and keeps the packet structure right", () => {
  let s = s1({ type: "s1/separate" }, { type: "s1/setAmount", value: 1.5 }); assert.equal(E.stage1View(s).flags.separated, false); assert.deepEqual(kinds(s), []); assert.deepEqual(sc(s, 1).packets.map((p) => p.q), [Q(1), Q(0.5)]); clean0(s);
  s = E.reduce(s, { type: "s1/setAmount", value: 0 }); clean0(s); assert.equal(total(sc(s, 1)), 0); assert.equal(E.reduce(s, { type: "s1/separate" }).last.ok, false, "nothing to count at 0 mol");
  for (const bad of ["-1", "abc", "11", ""]) assert.equal(E.reduce(s1(), { type: "s1/setAmount", value: bad }).last.ok, false, bad);
});
test("recombine restores the original counting model; repeated separate does not duplicate packets", () => {
  let s = s1({ type: "s1/separate" }); const n = sc(s, 1).packets.length; for (let i = 0; i < 5; i += 1) s = E.reduce(s, { type: "s1/separate" }); assert.equal(sc(s, 1).packets.length, n); clean0(s);
  s = E.reduce(s, { type: "s1/recombine" }); assert.equal(sc(s, 1).packets.length, 1); assert.equal(E.stage1View(s).flags.separated, false); clean0(s);
});
test("every selectable substance separates correctly at awkward amounts; ionic -> ions; metal -> refused with an explanation", () => {
  for (const id of E.SELECTABLE_IDS) for (const n of [0.25, 1, 2.5, 3.333]) {
    let s = s1({ type: "s1/select", substanceId: id }, { type: "s1/setAmount", value: n }); s = E.reduce(s, { type: "s1/separate" }); clean0(s);
    const c = E.composition(id, Q(n)); const kind = E.getSubstance(id).kind;
    if (kind === "metallic") { assert.equal(s.last.ok, false); continue; }
    const sums = {}; for (const [sid, q] of kinds(s)) sums[sid] = (sums[sid] || 0) + q;
    if (kind === "molecular") for (const a of c.atoms) assert.equal(sums[`atoms:${a.element}`], a.q, `${id} ${n}`); else for (const i of c.ions) assert.equal(sums[i.entityId], i.q, `${id} ${n}`);
  }
});
test("select resets the stage-1 scene for the new substance and rejects unavailable ones", () => { let s = s1({ type: "s1/separate" }, { type: "s1/select", substanceId: "CO2" }); assert.equal(E.stage1View(s).flags.separated, false); assert.equal(sc(s, 1).data.substanceId, "CO2"); assert.equal(E.reduce(s, { type: "s1/select", substanceId: "NaOH_aq" }).last.ok, false); assert.equal(E.reduce(s, { type: "s1/select", substanceId: "atoms:H" }).last.ok, false); clean0(s); });
test("inspect / select-entity flow; entity selection needs Inspect", () => { let s = E.reduce(s1(), { type: "s1/selectEntity", index: 3 }); assert.equal(s.last.ok, false); s = run(s, { type: "s1/inspect", on: true }, { type: "s1/selectEntity", index: 3 }); assert.equal(E.stage1View(s).flags.selectedEntity, 3); s = E.reduce(s, { type: "s1/inspect", on: false }); assert.equal(E.stage1View(s).flags.selectedEntity, null); });
test("exact numbers are separate from display strings (selectors)", () => { const v = E.stage1View(s1({ type: "s1/setAmount", value: 0.1 + 0.2 })); assert.equal(typeof v.exact.n, "number"); assert.equal(v.exact.n, 0.3); assert.equal(v.text.amount, "0.30 mol"); assert.equal(typeof v.text.amount, "string"); });
test("predictions are generated from the chemistry (always one correct choice, matching the composition)", () => {
  for (const id of E.SELECTABLE_IDS) for (const n of [0.5, 1, 1.5]) { const p = E.stage1Prediction(id, Q(n)); if (E.getSubstance(id).kind === "metallic") { assert.equal(p, null); continue; } assert.equal(p.choices.filter((c) => c.correct).length, 1); assert.ok(p.choices.length >= 3); assert.equal(new Set(p.choices.map((c) => c.label)).size, p.choices.length); assert.ok(p.explainRight.length > 20); }
  const w = E.stage1Prediction("H2O", Q(1)); assert.equal(w.choices.find((c) => c.correct).label, "2.00 mol"); assert.match(w.prompt, /H atoms/);
  const m = E.stage2Prediction("Mg", 12, "teaching"); assert.equal(m.choices.find((c) => c.correct).label, "0.500 mol"); assert.equal(E.stage2Prediction("Mg", 12).choices.find((c) => c.correct).label, "0.494 mol"); assert.equal(E.stage2Prediction("Mg", 0), null); assert.equal(new Set(m.choices.map((c) => c.label)).size, m.choices.length);
  const a = E.orderChoices(w.choices, "x"); const b = E.orderChoices(w.choices, "x"); assert.deepEqual(a, b);
});

console.log("Packet operations and conservation");
const bench = (stage = 2) => { let s = T0({ stage }); s = E.reduce(s, { type: "s2/setMass", value: 36 }); return s; }; // [1.0, 0.5] Mg
test("closed bags cannot pour (scene object unchanged); open bags can", () => {
  const s = bench(); const [a, b] = sc(s).packets; const t = E.reduce(s, { type: "packet/pour", sourceId: b.id, destId: a.id }); assert.equal(t.last.ok, false); assert.equal(t.last.code, "closed"); assert.equal(t.scenes, s.scenes);
});
test("pour: source opened, destination opened with room -> amounts move together; overflow stays in the source", () => {
  let s = bench(); const [a, b] = sc(s).packets;
  s = run(s, { type: "packet/open", id: b.id }, { type: "packet/open", id: a.id }); let t = E.reduce(s, { type: "packet/pour", sourceId: b.id, destId: a.id }); assert.equal(t.last.code, "full"); assert.equal(t.scenes, s.scenes, "a is full: nothing moves");
  s = run(s, { type: "packet/split", id: a.id }); const [a1, , ] = sc(s).packets; // a -> 0.5 + new 0.5 (closed)
  const before = total(sc(s)); const [x, y, z] = sc(s).packets.map((p) => p.id); s = run(s, { type: "packet/open", id: y }); t = E.reduce(s, { type: "packet/pour", sourceId: b.id, destId: y }); assert.equal(t.last.ok, true); assert.equal(total(sc(t)), before); clean0(t); void x; void z; void a1;
});
test("pour moves min(source, room): 0.5 into a 0.75 packet leaves 0.25 behind in the source", () => {
  let s = E.reduce(T0({ stage: 2 }), { type: "s2/setMass", value: 30 }); // 1.25 -> [1, 0.25]
  s = run(s, { type: "packet/split", id: sc(s).packets[0].id, q: Q(0.5) }); // [0.5, 0.25, 0.5]? order: p1 0.5, new 0.5, p2 0.25
  const [p, n1, p2] = sc(s).packets; assert.deepEqual([p.q, n1.q, p2.q], [Q(0.5), Q(0.5), Q(0.25)]);
  s = run(s, { type: "packet/open", id: n1.id }, { type: "packet/open", id: p2.id }); const t = E.reduce(s, { type: "packet/pour", sourceId: n1.id, destId: p2.id }); assert.equal(t.last.movedQ, Q(0.5)); assert.equal(sc(t).packets.find((x) => x.id === p2.id).q, Q(0.75)); clean0(t);
});
test("split conserves, makes a closed packet, rejects bad amounts; combine conserves and overflow stays", () => {
  let s = bench(); const before = total(sc(s)); const [a] = sc(s).packets;
  const sp = E.reduce(s, { type: "packet/split", id: a.id }); assert.equal(total(sc(sp)), before); assert.equal(sc(sp).packets.length, 3); assert.equal(sc(sp).packets.find((p) => p.id === sp.last.newId).open, false); clean0(sp);
  for (const q of [0, -5, a.q, a.q + 1, 0.5]) assert.equal(E.reduce(s, { type: "packet/split", id: a.id, q }).last.ok, false, String(q));
  const [x, y] = sc(sp).packets; const cb = E.reduce(sp, { type: "packet/combine", aId: x.id, bId: y.id }); assert.equal(total(sc(cb)), before); clean0(cb);
  const full = E.reduce(s, { type: "packet/combine", aId: a.id, bId: sc(s).packets[1].id }); assert.equal(full.last.ok, false); assert.equal(full.last.code, "full");
  assert.equal(E.reduce(s, { type: "packet/combine", aId: a.id, bId: a.id }).last.ok, false); assert.equal(E.reduce(s, { type: "packet/combine", aId: a.id, bId: "zz" }).last.ok, false);
});
test("incompatible substances never combine or pour into each other", () => {
  const s0 = E.reduce(T0({ stage: 1 }), { type: "s1/separate" }); const s = E.reduce(s0, { type: "stage/set", stage: 1 }); const [main] = sc(s).packets; const h = sc(s).packets.find((p) => p.substanceId === "atoms:H");
  assert.equal(E.reduce(s, { type: "packet/combine", aId: main.id, bId: h.id }).last.code, "incompatible"); const o = run(s, { type: "packet/open", id: main.id }, { type: "packet/open", id: h.id }); assert.equal(E.reduce(o, { type: "packet/pour", sourceId: main.id, destId: h.id }).last.code, "incompatible");
});
test("compact merges the same substance into canonical packets and conserves", () => {
  let s = bench(); for (let i = 0; i < 3; i += 1) s = E.reduce(s, { type: "packet/split", id: sc(s).packets[0].id }); const before = total(sc(s)); assert.ok(sc(s).packets.length >= 4);
  s = E.reduce(s, { type: "packet/compact", substanceId: "Mg" }); assert.equal(total(sc(s)), before); assert.deepEqual(sc(s).packets.map((p) => p.q), [Q(1), Q(0.5)]); clean0(s);
});
test("repeated / rapid identical actions never duplicate material", () => {
  let s = bench(); const before = total(sc(s)); const [a, b] = sc(s).packets;
  for (let i = 0; i < 25; i += 1) s = run(s, { type: "packet/open", id: b.id }, { type: "packet/pour", sourceId: b.id, destId: a.id }, { type: "packet/split", id: "ghost" }, { type: "packet/combine", aId: "ghost", bId: a.id });
  assert.equal(total(sc(s)), before); clean0(s);
  let t = run(bench(), { type: "packet/open", id: b.id }); t = E.reduce(t, { type: "packet/split", id: b.id }); const n1 = sc(t).packets.length; for (let i = 0; i < 6; i += 1) t = E.reduce(t, { type: "packet/pour", sourceId: b.id, destId: a.id }); assert.equal(total(sc(t)), before); assert.ok(sc(t).packets.length <= n1);
  const one = run(t, { type: "packet/open", id: a.id }); void one;
});
test("pouring the whole source into a roomy destination empties and removes the source (never the last packet)", () => {
  let s = bench(); const [a, b] = sc(s).packets; s = run(s, { type: "packet/split", id: a.id }); const [a1, a2] = sc(s).packets; s = run(s, { type: "packet/open", id: a2.id }, { type: "packet/open", id: b.id }); s = E.reduce(s, { type: "packet/pour", sourceId: a2.id, destId: b.id });
  assert.equal(s.last.movedQ, Q(0.5)); assert.ok(!sc(s).packets.find((p) => p.id === a2.id)); assert.equal(total(sc(s)), Q(1.5)); void a1; clean0(s);
  let lone = E.reduce(T0({ stage: 2 }), { type: "s2/setMass", value: 0 }); assert.equal(sc(lone).packets.length, 1);
});
test("open / close are idempotent and unknown packets rejected", () => { let s = bench(); const [a] = sc(s).packets; s = run(s, { type: "packet/open", id: a.id }, { type: "packet/open", id: a.id }); assert.equal(sc(s).packets[0].open, true); s = run(s, { type: "packet/close", id: a.id }, { type: "packet/close", id: a.id }); assert.equal(sc(s).packets[0].open, false); assert.equal(E.reduce(s, { type: "packet/open", id: "zz" }).last.ok, false); });
test("reset restores the exact initial state (per stage and all), after any mix of actions", () => {
  const init = T0({ stage: 2 }); let s = init;
  s = run(s, mass(60), { type: "packet/split", id: "p1" }, { type: "packet/open", id: "p1" }, { type: "s2/select", substanceId: "Fe" }, { type: "s2/setDirection", direction: "moles-to-mass" });
  s = E.reduce(s, { type: "reset" }); assert.deepEqual(s.scenes[2], init.scenes[2]); assert.deepEqual(E.checkInvariants(s), []);
  s = run(s, { type: "stage/set", stage: 1 }, { type: "s1/separate" }, { type: "s1/setAmount", value: 2 }); s = E.reduce(s, { type: "reset", stage: 1 }); assert.deepEqual(s.scenes[1], init.scenes[1]);
  s = run(s, { type: "s1/select", substanceId: "NaCl" }, { type: "stage/set", stage: 2 }, mass(5), { type: "reset", stage: "all" }); assert.deepEqual(s.scenes, init.scenes); assert.equal(s.stage, 2);
});
test("switching stages never carries material or corrupts either scene; each scene is kept as it was", () => {
  let s = run(T0(), { type: "s1/setAmount", value: 1.5 }, { type: "s1/separate" }, { type: "stage/set", stage: 2 }, mass(36), { type: "packet/split", id: "p1" });
  const a1 = s.scenes[1]; const a2 = s.scenes[2]; for (const k of [3, 4, 5, 6, 1, 2, 1, 2]) s = E.reduce(s, { type: "stage/set", stage: k }); assert.equal(s.scenes[1], a1); assert.equal(s.scenes[2], a2); clean0(s);
  assert.ok(sc(s, 1).packets.every((p) => p.substanceId !== "Mg")); assert.ok(sc(s, 2).packets.every((p) => p.substanceId === "Mg"));
  const t = E.reduce(s, { type: "packet/split", id: "p1", stage: 1 }); assert.equal(t.scenes[2], a2, "an action addressed to stage 1 cannot touch stage 2");
});

console.log("Vessels, reactions and conservation of atoms / charge");
function reactionBench(a, b) {
  const base = T0({ stage: 2 }); let scene = { stage: 5, packets: [], vessels: [{ id: "v1", kind: "reaction", label: "Reaction zone", accepts: ["H2", "O2", "H2O", "N2", "NH3", "Mg", "MgO", "Na", "NaOH_aq"], capacityQ: null, contents: {} }], nextId: 1, data: {} };
  void base; let n = 1; const mk = (sid, q) => { scene = { ...scene, packets: [...scene.packets, { id: `p${n++}`, substanceId: sid, q, open: true, role: "main" }], nextId: n }; };
  for (const [sid, q] of [a, b]) { let left = q; while (left > 0) { const x = Math.min(left, Q(1)); mk(sid, x); left -= x; } }
  return { ...T0(), stage: 5, scenes: { ...T0().scenes, 5: scene } };
}
test("vessel pour validates acceptance; reaction conserves atoms and charge exactly; leftovers non-negative", () => {
  let s = reactionBench(["H2", Q(3)], ["O2", Q(1)]); const before = E.atomLedger(E.sceneLedger(sc(s))); const after0 = E.sceneLedger(sc(s));
  for (const p of sc(s).packets.slice()) s = E.reduce(s, { type: "packet/pour", sourceId: p.id, destId: "v1" }); clean0(s);
  assert.deepEqual(sc(s).vessels[0].contents, { H2: Q(3), O2: Q(1) }); assert.deepEqual(E.atomLedger(E.sceneLedger(sc(s))), before); void after0;
  s = E.reduce(s, { type: "vessel/react", vesselId: "v1", reactionId: "water-synthesis" }); assert.equal(s.last.ok, true);
  assert.deepEqual(sc(s).vessels[0].contents, { H2: Q(1), O2: 0, H2O: Q(2) }); assert.deepEqual(E.atomLedger(E.sceneLedger(sc(s))), before);
  assert.equal(E.reduce(s, { type: "vessel/react", vesselId: "v1", reactionId: "water-synthesis" }).last.code, "no-reaction", "O2 is used up");
  assert.equal(E.reduce(s, { type: "vessel/react", vesselId: "v1", reactionId: "nope" }).last.ok, false);
  const bad = reactionBench(["H2", Q(2)], ["O2", Q(1)]); const b2 = E.reduce(bad, { type: "packet/pour", sourceId: "p1", destId: "nowhere" }); assert.equal(b2.last.code, "no-target");
});
test("a vessel refuses substances it does not accept (no implicit mixing)", () => { const s = reactionBench(["Fe", Q(1)], ["O2", Q(1)]); assert.equal(E.reduce(s, { type: "packet/pour", sourceId: "p1", destId: "v1" }).last.code, "incompatible"); });
test("explicit smaller extent is allowed, larger refused", () => {
  let s = reactionBench(["N2", Q(2)], ["H2", Q(6)]); for (const p of sc(s).packets.slice()) s = E.reduce(s, { type: "packet/pour", sourceId: p.id, destId: "v1" });
  const ok = E.reduce(s, { type: "vessel/react", vesselId: "v1", reactionId: "ammonia-synthesis", extentQ: Q(0.5) }); assert.deepEqual(sc(ok).vessels[0].contents, { N2: Q(1.5), H2: Q(4.5), NH3: Q(1) });
  assert.equal(E.reduce(s, { type: "vessel/react", vesselId: "v1", reactionId: "ammonia-synthesis", extentQ: Q(3) }).last.ok, false); assert.equal(E.reduce(s, { type: "vessel/react", vesselId: "v1", reactionId: "ammonia-synthesis", extentQ: 1.5 }).last.ok, false);
});
test("applyExtent is exact for every reaction at random extents: atoms + charge conserved (property)", () => {
  const rnd = mulberry32(7);
  for (const r of E.REACTION_LIST) for (let i = 0; i < 300; i += 1) {
    const amounts = {}; for (const sp of E.reactants(r)) amounts[sp.id] = Math.floor(rnd() * 5e9) + 1e9 * 3;
    const lim = E.limitingReagent(r, amounts); const xi = Math.floor(rnd() * (lim.extentQ + 1)); const next = E.applyExtent(r, amounts, xi);
    assert.deepEqual(E.atomLedger(next), E.atomLedger(amounts)); assert.equal(E.chargeLedger(next), E.chargeLedger(amounts)); assert.ok(Object.values(next).every((v) => v >= 0));
    const full = E.applyExtent(r, amounts, lim.extentQ); for (const p of lim.perReactant) { assert.ok(full[p.id] >= 0); assert.equal(full[p.id], p.remainingQ); }
    assert.ok(lim.perReactant.some((p) => p.limiting), "someone is always limiting");
    assert.throws(() => E.applyExtent(r, amounts, lim.extentQ + 2 * 1e9), /not enough/);
  }
});

console.log("Property-based random operation sequences");
test("500 random sequences of stage-1/2 and packet operations: invariants hold after EVERY action and totals are conserved", () => {
  const rnd = mulberry32(20240607); let actions = 0;
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  for (let seq = 0; seq < 500; seq += 1) {
    let s = T0({ stage: rnd() < 0.5 ? 1 : 2 });
    for (let step = 0; step < 40; step += 1) {
      const scene = sc(s); const ids = scene.packets.map((p) => p.id).concat(["ghost"]);
      const choice = Math.floor(rnd() * 16); let a;
      if (s.stage === 1) {
        a = [{ type: "s1/select", substanceId: pick(E.SELECTABLE_IDS) }, { type: "s1/setAmount", value: pick([0, 0.25, 0.333, 0.5, 1, 1.5, 2.675, 5, 9.999, -1, "x", 11]) }, { type: "s1/separate" }, { type: "s1/recombine" }, { type: "s1/count" }, { type: "s1/inspect", on: rnd() < 0.5 }][choice % 6];
        if (choice >= 12) a = { type: "stage/set", stage: 2 };
        else if (choice >= 9) a = { type: ["packet/open", "packet/split", "packet/close"][choice - 9], id: pick(ids) };
        else if (choice >= 6) a = { type: "packet/pour", sourceId: pick(ids), destId: pick(ids) };
      } else {
        a = [{ type: "s2/setMass", value: pick([0, 6, 12, 36, 60, 7.5, 1234.5, -3, "q", ""]) }, { type: "s2/setMoles", value: pick([0, 0.25, 1, 2.5, 33.3, -1]) }, { type: "s2/addMass", delta: pick([-5, 5, 24, -100]) }, { type: "s2/select", substanceId: pick(E.SELECTABLE_IDS) }, { type: "policy/set", policy: pick(["teaching", "precise"]) }][choice % 5];
        if (choice >= 13) a = { type: "stage/set", stage: 1 };
        else if (choice >= 10) a = { type: "packet/combine", aId: pick(ids), bId: pick(ids) };
        else if (choice >= 8) a = { type: "packet/compact", substanceId: scene.data.substanceId };
        else if (choice >= 5) a = { type: ["packet/open", "packet/split", "packet/pour"][choice - 5], id: pick(ids), sourceId: pick(ids), destId: pick(ids) };
      }
      const before = E.sceneLedger(sc(s, s.stage)); const stage = s.stage; const prev = s;
      s = E.reduce(s, a); actions += 1;
      assert.deepEqual(E.checkInvariants(s), [], `seq ${seq} step ${step} ${JSON.stringify(a)}`);
      if (/^packet\//.test(a.type)) { assert.deepEqual(E.sceneLedger(sc(s, stage)), before, `ledger changed by ${a.type}`) }
      if (!s.last.ok) { for (const k of Object.keys(prev.scenes)) { assert.deepEqual(s.scenes[k].packets, prev.scenes[k].packets, `rejected action changed packets: ${JSON.stringify(a)}`); assert.deepEqual(s.scenes[k].vessels, prev.scenes[k].vessels); } }
      for (const p of sc(s, stage).packets) assert.ok(Number.isInteger(p.q) && p.q >= 0 && p.q <= E.PACKET_CAPACITY_Q);
    }
  }
  assert.ok(actions === 20000);
});
test("random sequences are reproducible (same seed -> identical final state)", () => {
  const go = () => { const rnd = mulberry32(99); let s = T0({ stage: 2 }); for (let i = 0; i < 60; i += 1) { const ids = sc(s).packets.map((p) => p.id); s = E.reduce(s, [{ type: "s2/setMass", value: Math.floor(rnd() * 100) }, { type: "packet/split", id: ids[Math.floor(rnd() * ids.length)] }, { type: "packet/compact", substanceId: "Mg" }][i % 3]); } return JSON.stringify(s); };
  assert.equal(go(), go());
});
test("random pours/combines between vessel and packets conserve every substance exactly", () => {
  const rnd = mulberry32(5);
  for (let seq = 0; seq < 100; seq += 1) {
    let s = reactionBench(["H2", Q(2 + Math.floor(rnd() * 3) + rnd())], ["O2", Q(1 + rnd() * 2)]); const ledger0 = E.sceneLedger(sc(s)); const atoms0 = E.atomLedger(ledger0);
    for (let k = 0; k < 40; k += 1) {
      const ids = sc(s).packets.map((p) => p.id); const r = rnd();
      s = E.reduce(s, r < 0.4 ? { type: "packet/pour", sourceId: ids[Math.floor(rnd() * ids.length)], destId: rnd() < 0.5 ? "v1" : ids[Math.floor(rnd() * ids.length)] } : r < 0.6 ? { type: "packet/split", id: ids[Math.floor(rnd() * ids.length)], q: Math.floor(rnd() * 1e9) } : r < 0.8 ? { type: "packet/combine", aId: ids[Math.floor(rnd() * ids.length)], bId: ids[Math.floor(rnd() * ids.length)] } : { type: "vessel/react", vesselId: "v1", reactionId: "water-synthesis", extentQ: Math.floor(rnd() * 5e8) + 1 });
      assert.deepEqual(E.checkInvariants(s), []); assert.deepEqual(E.atomLedger(E.sceneLedger(sc(s))), atoms0, `atoms conserved (seq ${seq} step ${k})`);
    }
  }
});

console.log("Interaction state machine (B5)");
const IR = E.interactionReducer; const I0 = E.initialInteraction();
const ev = (s, ...es) => es.reduce((st, e) => IR(st, e), s);
test("happy path: idle > selected > dragging > targetDetected > open > tilting > pouring > transferComplete > idle", () => {
  let s = I0; const seen = [s.phase];
  for (const e of [{ type: "select", id: "p1" }, { type: "dragStart" }, { type: "dragOver", targetId: "p2", valid: true }, { type: "drop", isOpen: true }, { type: "tilt" }, { type: "commit" }, { type: "commitDone" }, { type: "settle" }]) { s = IR(s, e); seen.push(s.phase); }
  assert.deepEqual(seen, ["idle", "selected", "dragging", "targetDetected", "open", "tilting", "pouring", "transferComplete", "idle"]); assert.equal(s.committedTx, 1);
});
test("failed drop returns the packet (returnHome) and changes no target; dragging over an invalid target keeps dragging", () => {
  let s = ev(I0, { type: "select", id: "p1" }, { type: "dragStart" }, { type: "dragOver", targetId: "p9", valid: false }); assert.equal(s.phase, "dragging"); assert.match(s.hint, /cannot/);
  s = IR(s, { type: "drop" }); assert.equal(s.phase, "selected"); assert.equal(s.returnHome, true); assert.equal(s.targetId, null);
});
test("a closed bag at a valid target waits for the zipper: no tilt until opened; closing again blocks", () => {
  let s = ev(I0, { type: "select", id: "p1" }, { type: "dragStart" }, { type: "dragOver", targetId: "p2", valid: true }, { type: "drop", isOpen: false }); assert.equal(s.phase, "targetDetected"); assert.equal(s.needsOpen, true);
  assert.equal(IR(s, { type: "tilt" }), s, "closed bag cannot tilt"); assert.equal(IR(s, { type: "commit" }), s, "closed bag cannot pour");
  s = IR(s, { type: "opened" }); assert.equal(s.phase, "open"); s = IR(s, { type: "closed" }); assert.equal(s.phase, "targetDetected"); assert.equal(IR(s, { type: "commit" }).phase, "targetDetected");
});
test("commit only from tilting and only once per tilt: double commit does not repeat the transfer", () => {
  let s = ev(I0, { type: "select", id: "p1" }, { type: "target", id: "p2", valid: true, isOpen: true }, { type: "tilt" }); assert.equal(s.phase, "tilting"); const c1 = IR(s, { type: "commit" }); const c2 = IR(c1, { type: "commit" }); assert.equal(c1.txId, 1); assert.equal(c2, c1);
  assert.equal(IR(I0, { type: "commit" }), I0); assert.equal(IR(ev(I0, { type: "select", id: "p1" }), { type: "commit" }).phase, "selected");
});
test("keyboard / button path (target without dragging) reaches the same states; invalid target is refused", () => {
  assert.equal(ev(I0, { type: "select", id: "p1" }, { type: "target", id: "p2", valid: true, isOpen: true }).phase, "open"); assert.equal(ev(I0, { type: "select", id: "p1" }, { type: "target", id: "p2", valid: false }).phase, "selected"); assert.equal(IR(I0, { type: "target", id: "p2", valid: true }), I0);
});
test("selection cannot change mid-pour; cancel anywhere returns to idle; unknown events are ignored", () => {
  let s = ev(I0, { type: "select", id: "p1" }, { type: "target", id: "p2", valid: true, isOpen: true }, { type: "tilt" }); assert.equal(IR(s, { type: "select", id: "p5" }), s); s = IR(s, { type: "commit" }); assert.equal(IR(s, { type: "select", id: "p5" }), s);
  for (const phase of ["selected", "dragging", "targetDetected", "open", "tilting", "pouring", "transferComplete"]) { const st = { ...I0, phase, packetId: "p1" }; assert.equal(IR(st, { type: "cancel" }).phase, "idle", phase); }
  assert.equal(IR(I0, { type: "cancel" }), I0); assert.equal(IR(I0, { type: "weird" }), I0);
});
test("repeated select / dragStart / deselect are idempotent", () => { const a = IR(I0, { type: "select", id: "p1" }); assert.equal(IR(a, { type: "select", id: "p1" }), a); const d = IR(a, { type: "dragStart" }); assert.equal(IR(d, { type: "dragStart" }), d); assert.equal(IR(IR(a, { type: "deselect" }), { type: "deselect" }).phase, "idle"); });
test("machine + store: only a committed pour changes chemistry, and double commits cannot repeat it", () => {
  let st = bench(); let m = I0; const [a, b] = sc(st).packets; st = run(st, { type: "packet/split", id: a.id }); const [x, y] = sc(st).packets; st = run(st, { type: "packet/open", id: x.id }, { type: "packet/open", id: b.id });
  const before = total(sc(st)); m = ev(m, { type: "select", id: b.id }, { type: "target", id: x.id, valid: true, isOpen: true }, { type: "tilt" });
  let commits = 0; for (let i = 0; i < 5; i += 1) { const nm = IR(m, { type: "commit" }); if (nm !== m) { st = E.reduce(st, { type: "packet/pour", sourceId: b.id, destId: x.id }); commits += 1; } m = nm; }
  assert.equal(commits, 1); assert.equal(total(sc(st)), before); void y; clean0(st);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
