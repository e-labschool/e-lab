#!/usr/bin/env node
// Reducer tests for the Equilibrium Lab:  node scripts/test-equilibrium-store.mjs
// Spec cases 13 (reset, replay, pause/resume are deterministic and consistent) and 14 (mode switching keeps scenes consistent).
import assert from "node:assert/strict";
import { reduce, createInitialState, checkInvariants } from "../src/engines/equilibrium-lab/model/store.js";
import { normalizeConfig, configFromSearch } from "../src/engines/equilibrium-lab/model/config.js";
import { REACTION_IDS } from "../src/engines/equilibrium-lab/model/reactions.js";

let passed = 0; let failed = 0;
async function test(name, fn) { try { await fn(); console.log(`  ok   ${name}`); passed += 1; } catch (e) { console.log(`  FAIL ${name}\n       ${(e.stack || e.message).split("\n").slice(0, 5).join("\n       ")}`); failed += 1; } }
const go = (s, ...acts) => acts.reduce((st, a) => { const n = reduce(st, a); assert.deepEqual(checkInvariants(n), [], `invariants after ${a.type}`); return n; }, s);
const sc = (s) => s.scenes[s.mode];
const pop = (s) => [sc(s).ev.s.A, sc(s).ev.s.B];

await test("initial state: everyday mode, idle, 100 in A, 0 in B, seeds fixed, healthy invariants", () => {
  const s = createInitialState(); assert.equal(s.mode, "everyday"); assert.equal(sc(s).status, "idle"); assert.deepEqual(pop(s), [100, 0]); assert.deepEqual(checkInvariants(s), []);
  assert.equal(createInitialState({ mode: "chemical" }).mode, "chemical"); assert.equal(createInitialState({ mode: "bogus" }).mode, "everyday");
});
await test("disturbances are refused before Start (with a message) and accepted after", () => {
  let s = createInitialState(); s = reduce(s, { type: "ev/add", city: "A" }); assert.equal(s.last.ok, false); assert.deepEqual(pop(s), [100, 0]);
  s = go(s, { type: "run/start" }, { type: "run/advance", dT: 30 }, { type: "ev/add", city: "A" }); assert.equal(s.last.ok, true); assert.equal(pop(s)[0] + pop(s)[1], 120);
});
await test("case 13a: pause freezes everything; resume continues; ticks are ignored while paused", () => {
  let s = go(createInitialState(), { type: "run/start" }, { type: "run/tick", dt: 0.1 }, { type: "run/tick", dt: 0.1 }); const t = sc(s).t; assert.ok(t > 0);
  s = go(s, { type: "run/pause" }, { type: "run/tick", dt: 0.1 }); assert.equal(sc(s).t, t); assert.equal(sc(s).status, "paused");
  s = go(s, { type: "run/resume" }, { type: "run/tick", dt: 0.1 }); assert.ok(sc(s).t > t);
});
await test("case 13b: Reset returns to the initial populations at t = 0 with a new seed, keeps the setup and mode; Replay reproduces the earlier run exactly", () => {
  let s = go(createInitialState(), { type: "run/start" }, { type: "run/advance", dT: 20 }, { type: "ev/add", city: "A" }, { type: "run/advance", dT: 10 }, { type: "ev/remove", city: "B" }, { type: "run/advance", dT: 5 });
  const before = { pop: pop(s), t: sc(s).t, nF: sc(s).ev.s.nF, nR: sc(s).ev.s.nR }; const script = sc(s).script.length; assert.equal(script, 2);
  let r = go(s, { type: "run/replay" }); r = go(r, { type: "run/advance", dT: 20 }); r = go(r, { type: "run/advance", dT: 10 }); r = go(r, { type: "run/advance", dT: 5 });
  assert.deepEqual(pop(r), before.pop, "replay lands in the same state"); assert.equal(sc(r).ev.s.nF, before.nF); assert.equal(sc(r).ev.s.nR, before.nR);
  const z = go(s, { type: "run/reset" }); assert.equal(sc(z).t, 0); assert.deepEqual(pop(z), [100, 0]); assert.equal(sc(z).status, "idle"); assert.equal(sc(z).script.length, 0); assert.notEqual(sc(z).seed, sc(s).seed); assert.equal(z.mode, "everyday");
});
await test("case 14: switching modes keeps each scene's own state; a running scene is paused when you leave it; Compare keeps both tracks on one clock", () => {
  let s = go(createInitialState(), { type: "run/start" }, { type: "run/advance", dT: 10 }, { type: "mode/set", mode: "chemical" }); assert.equal(s.scenes.everyday.status, "paused"); assert.equal(sc(s).kind, "chemical"); assert.equal(sc(s).t, 0);
  s = go(s, { type: "mode/set", mode: "compare" }, { type: "run/start" }, { type: "run/advance", dT: 12 }); const c = sc(s); assert.ok(c.ev && c.ch); assert.equal(c.ev.t ?? c.t, c.t);
  s = go(s, { type: "mode/set", mode: "everyday" }); assert.ok(s.scenes.everyday.t >= 10); assert.deepEqual(reduce(s, { type: "mode/set", mode: "nope" }).mode, "everyday");
});
await test("compare: one person maps to 0.01 mol dm-3; disturbance on one side appears on the other", () => {
  let s = go(createInitialState({ mode: "compare" }), { type: "run/start" }, { type: "run/advance", dT: 30 }); const A0 = sc(s).ch.s.c.A; const p0 = sc(s).ev.s.A;
  s = go(s, { type: "ev/add", city: "A" }); assert.equal(sc(s).ev.s.A - p0 >= 19, true, "people added"); assert.ok(sc(s).ch.s.c.A > A0 + 0.15, "mol dm-3 added alongside");
});
await test("every action is total: unknown actions, bad presets/reactions/speeds do nothing harmful", () => {
  let s = createInitialState(); const same = reduce(s, { type: "nope" }); assert.equal(same, s);
  assert.equal(reduce(s, { type: "setup/preset", preset: "x" }).last.ok, false); assert.equal(reduce(s, { type: "ui/speed", speed: 3 }).last.ok, false); assert.equal(reduce(createInitialState({ mode: "chemical" }), { type: "setup/reaction", id: "x" }).last.ok, false);
  for (const sp of [0.5, 1, 2]) assert.equal(reduce(s, { type: "ui/speed", speed: sp }).ui.speed, sp);
});
await test("presets switch the everyday scene and mark it visited; Step Forward advances one second of playback and leaves the scene paused", () => {
  let s = go(createInitialState(), { type: "setup/preset", preset: "towardsB" }); assert.equal(sc(s).setup.preset, "towardsB"); assert.ok(sc(s).visited.includes("towardsB"));
  s = go(s, { type: "run/step" }); assert.equal(sc(s).status, "paused"); assert.ok(sc(s).t > 0);
});
await test("every chemical reaction can be selected, started, disturbed with each applicable control and run for a long time without breaking invariants", () => {
  for (const id of REACTION_IDS) {
    let s = go(createInitialState({ mode: "chemical" }), { type: "setup/reaction", id }, { type: "run/start" }, { type: "run/advance", dT: 5 });
    const species = Object.keys(sc(s).ch.s.c);
    s = go(s, { type: "ch/add", id: species[0] }, { type: "run/advance", dT: 5 }, { type: "ch/remove", id: species.at(-1) }, { type: "ch/temp", dir: 1 }, { type: "ch/vol", dir: -1 }, { type: "ch/cat", on: true }, { type: "run/advance", dT: 200 });
    assert.ok(sc(s).disturbances >= 2, `${id} disturbances applied: ${sc(s).disturbances}`);
    for (let i = 0; i < 100; i += 1) s = reduce(s, { type: "run/tick", dt: 0.2 }); assert.deepEqual(checkInvariants(s), [], id);
  }
});
await test("history stays bounded (decimated) during very long runs", () => {
  let s = go(createInitialState(), { type: "run/start" }); for (let i = 0; i < 400; i += 1) s = reduce(s, { type: "run/advance", dT: 5 });
  assert.ok(sc(s).ev.hist.t.length <= 1500); assert.deepEqual(checkInvariants(s), []);
});
await test("CHANGED: random fluctuations are OFF by default; ui/fluct toggles them; the toggle never changes the simulation itself", () => {
  let s = createInitialState(); assert.equal(s.ui.fluct, false);
  const a = go(s, { type: "run/start" }, { type: "run/advance", dT: 30 }); const b = go(s, { type: "ui/fluct", value: true }, { type: "run/start" }, { type: "run/advance", dT: 30 });
  assert.equal(b.ui.fluct, true); assert.deepEqual(pop(a), pop(b), "same seed, same random run either way"); assert.equal(go(b, { type: "ui/fluct" }).ui.fluct, false);
});
await test("config: teacher initial mode and URL parameter are validated", () => {
  assert.equal(normalizeConfig({ initialMode: "chemical" }).initialMode, "chemical"); assert.equal(normalizeConfig({ initialMode: "Compare-Both" }).initialMode, "compare");
  assert.equal(normalizeConfig({ initialMode: "zzz" }).initialMode, "everyday"); assert.equal(normalizeConfig(null).initialMode, "everyday");
  assert.equal(configFromSearch("?mode=chemical").initialMode, "chemical"); assert.equal(configFromSearch("?x=1"), null);
});

console.log(`\n${passed} passed, ${failed} failed`); if (failed) process.exit(1);
