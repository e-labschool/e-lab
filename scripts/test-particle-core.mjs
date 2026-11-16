#!/usr/bin/env node
// Unit tests for the shared particle core (src/lib/particles/particleCore.js).
import assert from "node:assert/strict";
import * as P from "../src/lib/particles/particleCore.js";

let passed = 0; let failed = 0;
function test(name, fn) { try { fn(); passed += 1; console.log("  ok  ", name); } catch (e) { failed += 1; console.log("  FAIL", name, "\n      ", e.message); } }
const run = (s, sec) => { for (let i = 0; i < sec * 60; i++) s.step(1 / 60); };
const inside = (s) => s.particles.every((p) => [p.x, p.y, p.z, p.vx, p.vy, p.vz].every(Number.isFinite) && p.x >= 0.5 - 1e-6 && p.x <= s.box.w - 0.5 + 1e-6 && p.y >= 0.5 - 1e-6 && p.y <= s.box.h - 0.5 + 1e-6 && (s.dim === 2 || (p.z >= 0.5 - 1e-6 && p.z <= s.box.d - 0.5 + 1e-6)));

for (const dim of [2, 3]) {
  console.log(`dim ${dim}`);
  test("particle COUNT is conserved through every state change (GS-31)", () => {
    const s = P.createParticleSystem({ dim, seed: 5 }); const n0 = s.particles.length;
    for (const st of ["solid", "liquid", "gas", "solid", "gas", "liquid"]) { s.setState(st); run(s, 1.5); assert.equal(s.particles.length, n0, st); assert.equal(s.getStats().n, n0); }
    for (const st of P.STATES) { s.reset(st); assert.equal(s.particles.length, n0); }
  });
  test("every particle stays inside the box, no NaN, across states, temperatures and rapid changes", () => {
    const s = P.createParticleSystem({ dim, seed: 9 });
    for (let k = 0; k < 40; k++) { s.setState(P.STATES[k % 3]); s.setTemperature(P.T_MIN + ((k * 97) % 400)); run(s, 0.4); assert.ok(inside(s), `step ${k}`); }
  });
  test("mean kinetic energy is proportional to T in EVERY state (S1.1.3)", () => {
    for (const st of P.STATES) {
      const lo = P.createParticleSystem({ dim, state: st, seed: 2, T: 150 }); lo.setTemperature(150); run(lo, 4);
      const hi = P.createParticleSystem({ dim, state: st, seed: 2, T: 450 }); hi.setTemperature(450); run(hi, 4);
      const r = hi.getStats().meanKE / lo.getStats().meanKE;
      assert.ok(r > 2.55 && r < 3.45, `${st}: KE ratio ${r.toFixed(2)} (expected 3)`);
    }
  });
  test("temperature change is visible: raising T then lowering it moves mean KE up then down", () => {
    const s = P.createParticleSystem({ dim, state: "gas", seed: 4 }); run(s, 2); const a = s.getStats().meanKE;
    s.setTemperature(480); run(s, 3); const b = s.getStats().meanKE; s.setTemperature(120); run(s, 3); const c = s.getStats().meanKE;
    assert.ok(b > a * 1.4 && c < a * 0.7, `${a.toFixed(2)} -> ${b.toFixed(2)} -> ${c.toFixed(2)}`);
  });
  test("solid: close-packed (nearest neighbour about one diameter) and seated ON the floor, not floating (GS-33)", () => {
    const s = P.createParticleSystem({ dim, state: "solid", seed: 3 }); run(s, 2);
    const g = s.getStats(); assert.ok(g.meanNearestNeighbour > 0.98 && g.meanNearestNeighbour < 1.1, `NN ${g.meanNearestNeighbour}`);
    const minY = Math.min(...s.particles.map((p) => p.y)); assert.ok(minY < 0.5 + 0.2, `lowest particle at ${minY}`);
    assert.ok(Math.max(...s.particles.map((p) => p.y)) < s.box.h * 0.75, "block does not fill the box");
  });
  test("liquid: touching (close-packed) but pooled on the floor; gas: widely spaced and fills the box", () => {
    const l = P.createParticleSystem({ dim, state: "liquid", seed: 3 }); run(l, 3);
    assert.ok(l.getStats().meanNearestNeighbour < 1.2, `liquid NN ${l.getStats().meanNearestNeighbour}`);
    const ys = l.particles.map((p) => p.y).sort((a, b) => a - b); assert.ok(ys[Math.floor(ys.length * 0.9)] < l.box.h * 0.6, "liquid is pooled");
    const g = P.createParticleSystem({ dim, state: "gas", seed: 3 }); run(g, 3);
    assert.ok(g.getStats().meanNearestNeighbour > 1.4, `gas NN ${g.getStats().meanNearestNeighbour}`);
    assert.ok(Math.max(...g.particles.map((p) => p.y)) > g.box.h * 0.7, "gas reaches the top");
  });
  test("gas particles collide with EACH OTHER and with the walls (GS-32)", () => {
    const g = P.createParticleSystem({ dim, state: "gas", seed: 8 }); run(g, 5);
    const st = g.getStats(); assert.ok(st.pairCollisions > 20, `pair collisions ${st.pairCollisions}`); assert.ok(st.wallHits > 20, `wall hits ${st.wallHits}`);
  });
  test("speeds follow a spread (Maxwell-Boltzmann shape), not one common speed", () => {
    const g = P.createParticleSystem({ dim, state: "gas", seed: 6 }); run(g, 3);
    const sp = g.particles.map((p) => Math.hypot(p.vx, p.vy, p.vz)); const mean = sp.reduce((a, b) => a + b, 0) / sp.length;
    const sd = Math.sqrt(sp.reduce((a, b) => a + (b - mean) ** 2, 0) / sp.length);
    assert.ok(sd / mean > 0.25, `relative spread ${(sd / mean).toFixed(2)}`);
  });
  test("deterministic for a seed; different seeds differ", () => {
    const a = P.createParticleSystem({ dim, seed: 11, state: "gas" }); const b = P.createParticleSystem({ dim, seed: 11, state: "gas" }); const c = P.createParticleSystem({ dim, seed: 12, state: "gas" });
    run(a, 1); run(b, 1); assert.equal(JSON.stringify(a.particles), JSON.stringify(b.particles)); assert.notEqual(JSON.stringify(a.particles[0]), JSON.stringify(c.particles[0]));
  });
}
console.log("helpers");
test("latticeSites returns exactly n sites with no overlaps (touching spacing >= 1 d)", () => {
  for (const dim of [2, 3]) for (const n of [1, 7, 64, 96, 150]) {
    const s = P.latticeSites(n, dim); assert.equal(s.length, n);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) assert.ok(Math.hypot(s[i][0] - s[j][0], s[i][1] - s[j][1], s[i][2] - s[j][2]) >= 0.999, `${dim}D n=${n} pair ${i},${j}`);
  }
});
test("autoState: solid below 273 K, liquid to 373 K, gas above (illustrative water-like)", () => {
  assert.equal(P.autoState(200), "solid"); assert.equal(P.autoState(273), "liquid"); assert.equal(P.autoState(330), "liquid"); assert.equal(P.autoState(373), "gas"); assert.equal(P.autoState(500), "gas");
});
test("sigma scales with sqrt(T); setTemperature clamps to the supported range", () => {
  assert.ok(Math.abs(P.sigmaFor(1200) / P.sigmaFor(300) - 2) < 1e-12);
  const s = P.createParticleSystem({ dim: 2 }); s.setTemperature(5); assert.equal(s.T, P.T_MIN); s.setTemperature(9999); assert.equal(s.T, P.T_MAX); s.setTemperature("x"); assert.equal(s.T, P.T_REF);
});
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
