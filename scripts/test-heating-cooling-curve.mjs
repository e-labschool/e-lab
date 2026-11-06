#!/usr/bin/env node
// Tests for the synchronised Heating / Cooling curve (water): pure model + particle model + the REAL component in jsdom.
//   node scripts/test-heating-cooling-curve.mjs
// Honest limits: jsdom has no layout or real canvas. getBoundingClientRect is stubbed to a fixed box and the 2D context
// is a recording stub, so geometry (overlap, clipping, real pixels) is covered by scripts/verify-build-atom-heating.mjs
// in headless Chromium, not here.
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { register } from "node:module";

const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
for (const k of ["window", "document", "HTMLElement", "HTMLInputElement", "Node", "MouseEvent", "KeyboardEvent", "Event", "XMLSerializer", "MutationObserver", "getComputedStyle"]) {
  try { globalThis[k] = dom.window[k]; } catch { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true }); }
}
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.IS_REACT_ACT_ENVIRONMENT = false;
globalThis.localStorage = dom.window.localStorage;
// fixed layout box for every element + a recording 2D context
dom.window.HTMLElement.prototype.getBoundingClientRect = () => ({ width: 400, height: 300, top: 0, left: 0, right: 400, bottom: 300, x: 0, y: 0, toJSON() {} });
const noop = () => {};
dom.window.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: (_, k) => (k === "createLinearGradient" ? () => ({ addColorStop: noop }) : noop), set: () => true });
register("./jsx-loader-hooks.mjs", import.meta.url);
register("./image-viewer-loader-hooks.mjs", import.meta.url);

const M = await import("../src/engines/phase-change-heating-curve/data/curveModel.js");
const P = await import("../src/engines/phase-change-heating-curve/lib/particles.js");
const { SUBSTANCE } = await import("../src/engines/phase-change-heating-curve/data/substance.js");
const { clampFrameDelta } = await import("../src/lib/frameTime.js");

let passed = 0; let failed = 0;
const pending = [];
function test(name, fn) { pending.push({ name, fn }); }
const close = (a, b, eps = 1e-9, msg = "") => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} vs ${b}`);
const grid = (n) => Array.from({ length: n + 1 }, (_, i) => i / n);
const C = M.DEFAULT_CURVE;

// ----------------------------------------------------------------------------------------- curve model
test("substance: water with its own sourced mp / bp (0 and 100 degC) and capacities / latent heats", () => {
  assert.equal(SUBSTANCE.name, "Water");
  assert.equal(SUBSTANCE.tMelt, 0); assert.equal(SUBSTANCE.tBoil, 100);
  assert.ok(SUBSTANCE.cLiquid > SUBSTANCE.cSolid && SUBSTANCE.cLiquid > SUBSTANCE.cGas);
  assert.ok(SUBSTANCE.latentVaporisation > SUBSTANCE.latentFusion);
});
test("segment ordering: heating = solid, melt, liquid, boil, gas; cooling = gas, condense, liquid, freeze, solid", () => {
  assert.deepEqual(C.heating.map((s) => s.key), ["solidHeat", "melt", "liquidHeat", "boil", "gasHeat"]);
  assert.deepEqual(C.cooling.map((s) => s.key), ["gasCool", "condense", "liquidCool", "freeze", "solidCool"]);
  assert.deepEqual(C.heating.map((s) => s.kind), ["sensible", "latent", "sensible", "latent", "sensible"]);
  assert.deepEqual(C.cooling.map((s) => s.kind), ["sensible", "latent", "sensible", "latent", "sensible"]);
});
test("segments tile [0, 1] without gaps, in both modes, for both time scales", () => {
  for (const scale of ["schematic", "true"]) {
    const c = M.buildCurve(scale);
    for (const segs of [c.heating, c.cooling]) {
      close(segs[0].t0, 0); close(segs[4].t1, 1);
      for (let i = 1; i < 5; i += 1) close(segs[i].t0, segs[i - 1].t1);
      for (const s of segs) assert.ok(s.t1 > s.t0, `${scale} ${s.key} has positive duration`);
    }
  }
});
test("durations: 'true' scale is proportional to energy (c*dT or L); schematic keeps the same ranking", () => {
  const t = M.buildCurve("true");
  const en = t.heating.map((s) => s.energy);
  const du = t.heating.map((s) => s.t1 - s.t0);
  for (let i = 1; i < 5; i += 1) close(du[i] / du[0], en[i] / en[0], 1e-9, `true ratio ${i}`);
  close(en[0], SUBSTANCE.cSolid * 20); close(en[1], SUBSTANCE.latentFusion); close(en[2], SUBSTANCE.cLiquid * 100);
  close(en[3], SUBSTANCE.latentVaporisation); close(en[4], SUBSTANCE.cGas * 30);
  const rank = (arr) => arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]).map((x) => x[1]).join();
  const sch = C.heating.map((s) => s.t1 - s.t0);
  assert.equal(rank(sch), rank(du));
  assert.ok(sch[3] < du[3], "schematic shortens the boiling plateau");
});
test("endpoints: heating -20 -> 130 degC, cooling 130 -> -20 degC", () => {
  close(M.curveState(C, "heating", 0).temp, -20); close(M.curveState(C, "heating", 1).temp, 130);
  close(M.curveState(C, "cooling", 0).temp, 130); close(M.curveState(C, "cooling", 1).temp, -20);
});
test("plateau temperature is exactly constant; sensible segments strictly change", () => {
  for (const mode of ["heating", "cooling"]) {
    for (const seg of M.segmentsFor(C, mode)) {
      const temps = grid(40).map((u) => M.curveState(C, mode, seg.t0 + (seg.t1 - seg.t0) * Math.min(u, 0.999999)).temp);
      if (seg.kind === "latent") { for (const t of temps) close(t, seg.from, 1e-9, `${mode} ${seg.key}`); assert.ok(seg.from === SUBSTANCE.tMelt || seg.from === SUBSTANCE.tBoil); }
      else assert.ok(Math.abs(temps[temps.length - 1] - temps[0]) > 10, `${mode} ${seg.key} changes temperature`);
    }
  }
});
test("heating is monotone non-decreasing, cooling monotone non-increasing", () => {
  let prevH = -Infinity; let prevC = Infinity;
  for (const p of grid(2000)) {
    const h = M.curveState(C, "heating", p).temp; const c = M.curveState(C, "cooling", p).temp;
    assert.ok(h >= prevH - 1e-9, `heating decreased at ${p}`); assert.ok(c <= prevC + 1e-9, `cooling increased at ${p}`);
    prevH = h; prevC = c;
  }
});
test("cooling is the exact reverse of heating at the same physical point (same temperature, phases, energies)", () => {
  for (const scale of ["schematic", "true"]) {
    const c = M.buildCurve(scale);
    for (const p of grid(400)) {
      const cool = M.curveState(c, "cooling", p); const heat = M.curveState(c, "heating", 1 - p);
      close(cool.temp, heat.temp, 1e-9, `temp@${p}`);
      close(cool.meltFrac, heat.meltFrac); close(cool.boilFrac, heat.boilFrac);
      close(cool.phaseFractions.solid, heat.phaseFractions.solid); close(cool.phaseFractions.gas, heat.phaseFractions.gas);
      close(cool.peRelative, heat.peRelative); close(cool.keRelative, heat.keRelative);
      assert.equal(cool.energyFlow, "released"); assert.equal(heat.energyFlow, "absorbed");
    }
  }
});
test("segment names are the reverse in cooling and labelled correctly", () => {
  assert.equal(M.curveState(C, "cooling", 0).segmentKey, "gasCool");
  assert.equal(M.curveState(C, "cooling", 1 - 1e-6).segmentKey, "solidCool");
  const mid = (s) => (s.t0 + s.t1) / 2;
  assert.deepEqual(C.cooling.map((s) => M.curveState(C, "cooling", mid(s)).segmentKey), ["gasCool", "condense", "liquidCool", "freeze", "solidCool"]);
  assert.deepEqual(C.heating.map((s) => M.curveState(C, "heating", mid(s)).segmentKey), ["solidHeat", "melt", "liquidHeat", "boil", "gasHeat"]);
});
test("phase fractions in [0, 1], sum to 1, and agree with the segment (both modes)", () => {
  for (const mode of ["heating", "cooling"]) {
    for (const p of grid(500)) {
      const s = M.curveState(C, mode, p); const f = s.phaseFractions;
      for (const v of [f.solid, f.liquid, f.gas, s.meltFrac, s.boilFrac, s.keRelative, s.peRelative, s.segmentFraction]) assert.ok(v >= -1e-12 && v <= 1 + 1e-12, `${mode}@${p} out of range ${v}`);
      close(f.solid + f.liquid + f.gas, 1, 1e-9);
      const k = s.segmentKey;
      if (k === "solidHeat" || k === "solidCool") { close(f.solid, 1); }
      if (k === "liquidHeat" || k === "liquidCool") { close(f.liquid, 1); }
      if (k === "gasHeat" || k === "gasCool") { close(f.gas, 1); }
      if (k === "melt" || k === "freeze") { close(f.gas, 0); assert.ok(s.isPlateau); }
      if (k === "boil" || k === "condense") { close(f.solid, 0); assert.ok(s.isPlateau); }
    }
  }
  // gradual: melting goes from 0 to 1 across the plateau, boiling too, heating direction
  const melt = C.heating[1]; const boil = C.heating[3];
  close(M.curveState(C, "heating", melt.t0 + 1e-9).phaseFractions.liquid, 0, 1e-6);
  close(M.curveState(C, "heating", (melt.t0 + melt.t1) / 2).phaseFractions.liquid, 0.5, 1e-9);
  close(M.curveState(C, "heating", (boil.t0 + boil.t1) / 2).phaseFractions.gas, 0.5, 1e-9);
  // cooling: condensation starts all-gas and ends all-liquid
  const cond = C.cooling[1];
  close(M.curveState(C, "cooling", cond.t0 + 1e-9).phaseFractions.gas, 1, 1e-6);
  close(M.curveState(C, "cooling", cond.t1 - 1e-9).phaseFractions.liquid, 1, 1e-6);
});
test("kinetic energy is constant on plateaus and ordered with temperature; potential energy changes only on plateaus", () => {
  for (const seg of [C.heating[1], C.heating[3]]) {
    const a = M.curveState(C, "heating", seg.t0 + 0.01 * (seg.t1 - seg.t0)); const b = M.curveState(C, "heating", seg.t0 + 0.99 * (seg.t1 - seg.t0));
    close(a.keRelative, b.keRelative); assert.ok(b.peRelative > a.peRelative + 0.05, "PE rises through a heating plateau");
  }
  for (const seg of [C.heating[0], C.heating[2], C.heating[4]]) {
    const a = M.curveState(C, "heating", seg.t0 + 0.01 * (seg.t1 - seg.t0)); const b = M.curveState(C, "heating", seg.t0 + 0.99 * (seg.t1 - seg.t0));
    close(a.peRelative, b.peRelative); assert.ok(b.keRelative > a.keRelative, "KE rises while heating a single phase");
  }
  close(M.curveState(C, "heating", 1).peRelative, 1); close(M.curveState(C, "heating", 0).peRelative, 0);
  // cooling: PE falls on condensation / freezing
  const c0 = M.curveState(C, "cooling", C.cooling[1].t0 + 0.01); const c1 = M.curveState(C, "cooling", C.cooling[1].t1 - 0.01);
  assert.ok(c1.peRelative < c0.peRelative);
});
test("one progress value drives everything: identical progress gives identical state, whatever the path", () => {
  const a = M.curveState(C, "heating", 0.37);
  M.curveState(C, "cooling", 0.9); M.curveState(C, "heating", 0.01);
  assert.deepEqual(M.curveState(C, "heating", 0.37), a);
  assert.equal(M.curveState(C, "heating", NaN).progress, 0);
  assert.equal(M.curveState(C, "heating", 7).progress, 1);
  assert.equal(M.curveState(C, "heating", -3).progress, 0);
});

// ----------------------------------------------------------------------------------------- particle model
const W = 560; const H = 400;
const set = P.createParticleSet();
const lay = P.layoutFor(W, H, set);
const stAt = (mode, p) => M.curveState(C, mode, p);
test("particle count is fixed and the radius depends only on the container, never on the state", () => {
  assert.equal(set.n, P.PARTICLE_COUNT);
  const clock = P.newClock();
  const radii = new Set();
  for (const mode of ["heating", "cooling"]) for (const p of grid(30)) { const s = P.particleSnapshot(set, lay, stAt(mode, p), clock); radii.add(s.r); assert.equal(s.x.length, P.PARTICLE_COUNT); }
  assert.equal(radii.size, 1);
  assert.notEqual(P.layoutFor(300, 300, set).r, lay.r);
});
test("arrangement follows the phase fractions: counts in each phase match the analytic fractions (gradual, both modes)", () => {
  const clock = P.newClock();
  for (const mode of ["heating", "cooling"]) {
    for (const p of grid(200)) {
      const st = stAt(mode, p); const snap = P.particleSnapshot(set, lay, st, clock);
      const tol = (0.18 + 2 / P.PARTICLE_COUNT) + 0.02;
      close(snap.counts.solid / set.n, st.phaseFractions.solid, tol, `${mode}@${p} solid`);
      close(snap.counts.gas / set.n, st.phaseFractions.gas, tol, `${mode}@${p} gas`);
      assert.equal(snap.counts.solid + snap.counts.liquid + snap.counts.gas, set.n);
    }
  }
  const mid = (seg) => (seg.t0 + seg.t1) / 2;
  const half = P.particleSnapshot(set, lay, stAt("heating", mid(C.heating[1])), P.newClock()).counts;
  assert.ok(half.solid > 20 && half.liquid > 20 && half.gas === 0, `melting midpoint is a mixture ${JSON.stringify(half)}`);
  const halfB = P.particleSnapshot(set, lay, stAt("heating", mid(C.heating[3])), P.newClock()).counts;
  assert.ok(halfB.liquid > 20 && halfB.gas > 20 && halfB.solid === 0, `boiling midpoint is a mixture ${JSON.stringify(halfB)}`);
  const halfC = P.particleSnapshot(set, lay, stAt("cooling", mid(C.cooling[1])), P.newClock()).counts;
  assert.ok(halfC.liquid > 20 && halfC.gas > 20, "condensation midpoint is a mixture");
  const halfF = P.particleSnapshot(set, lay, stAt("cooling", mid(C.cooling[3])), P.newClock()).counts;
  assert.ok(halfF.solid > 20 && halfF.liquid > 20, "freezing midpoint is a mixture");
});
test("phase counts are monotone through melting and boiling (gradual, no flicker)", () => {
  const clock = P.newClock(); let prevSolid = 81; let prevGas = -1;
  for (const p of grid(1000)) {
    const c = P.particleSnapshot(set, lay, stAt("heating", p), clock).counts;
    assert.ok(c.solid <= prevSolid, `solid count rose at ${p}`); assert.ok(c.gas >= prevGas, `gas count fell at ${p}`);
    prevSolid = c.solid; prevGas = c.gas;
  }
});
test("kinetic model: amplitude / speed follow sqrt(T); identical on a plateau; larger when hotter", () => {
  const clock = P.newClock();
  for (const seg of [C.heating[1], C.heating[3]]) {
    const a = P.particleSnapshot(set, lay, stAt("heating", seg.t0 + 0.1 * (seg.t1 - seg.t0)), clock);
    const b = P.particleSnapshot(set, lay, stAt("heating", seg.t0 + 0.9 * (seg.t1 - seg.t0)), clock);
    close(a.amplitude, b.amplitude, 1e-9); close(a.speed, b.speed, 1e-9);
  }
  const cold = P.particleSnapshot(set, lay, stAt("heating", 0), clock); const hot = P.particleSnapshot(set, lay, stAt("heating", 1), clock);
  assert.ok(hot.amplitude > cold.amplitude && hot.speed > cold.speed);
  close(hot.speed / cold.speed, Math.sqrt((130 + 273.15) / (-20 + 273.15)), 1e-9);
});
test("motion clock: tau advances as dt*sqrt(T/T0), so a plateau gives constant speed; dt is clamped", () => {
  const c = P.newClock(); P.advanceClock(c, 1, 373.15); close(c.tau, Math.sqrt(373.15 / 273.15)); close(c.tw, 1);
  assert.equal(clampFrameDelta(5), 0.05); assert.equal(clampFrameDelta(-1), 0); assert.equal(clampFrameDelta(NaN), 0);
});
test("positions stay inside the container for every state and clock, in both modes", () => {
  const clock = P.newClock();
  for (const mode of ["heating", "cooling"]) {
    for (const p of grid(60)) {
      for (let k = 0; k < 4; k += 1) {
        P.advanceClock(clock, 0.7, 253.15 + 150 * p);
        const s = P.particleSnapshot(set, lay, stAt(mode, p), clock);
        for (let i = 0; i < set.n; i += 1) {
          assert.ok(s.x[i] >= 0 && s.x[i] <= W && s.y[i] >= 0 && s.y[i] <= H, `${mode}@${p}: particle ${i} at ${s.x[i]},${s.y[i]}`);
        }
      }
    }
  }
});
test("arrangement is a pure function of the state: scrubbing back and forth gives the same snapshot", () => {
  const a = P.particleSnapshot(set, lay, stAt("heating", 0.2), { tw: 3, tau: 4 });
  P.particleSnapshot(set, lay, stAt("heating", 0.9), { tw: 8, tau: 9 });
  const b = P.particleSnapshot(set, lay, stAt("heating", 0.2), { tw: 3, tau: 4 });
  assert.deepEqual(a, b);
});
test("solid lattice: no overlap at the start; start state is a compact block resting on the floor", () => {
  const s = P.particleSnapshot(set, lay, stAt("heating", 0), { tw: 0, tau: 0 });
  let minD = Infinity;
  for (let i = 0; i < set.n; i += 1) for (let j = i + 1; j < set.n; j += 1) minD = Math.min(minD, Math.hypot(s.x[i] - s.x[j], s.y[i] - s.y[j]));
  assert.ok(minD > 1.6 * lay.r, `closest pair ${minD} vs r ${lay.r}`);
  assert.equal(s.counts.solid, set.n);
});

// ----------------------------------------------------------------------------------------- jsdom UI
const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const { ModeProvider } = await import("../src/context/ModeContext.jsx");
const { default: Sim } = await import("../src/engines/phase-change-heating-curve/PhaseChangeHeatingCurve.jsx");
const wait = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const $ = (sel) => document.querySelector(sel);
const attr = (name) => $('[data-testid="hc-root"]').getAttribute(name);
const click = async (sel) => { $(sel).dispatchEvent(new MouseEvent("click", { bubbles: true })); await wait(); };
async function scrub(v) {
  const el = $('[data-testid="hc-slider"]');
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(el, String(v));
  el.dispatchEvent(new Event("input", { bubbles: true }));
  await wait(60);
}
const root = createRoot(document.getElementById("root"));
root.render(React.createElement(ModeProvider, null, React.createElement(Sim, { standalone: true })));
for (let i = 0; i < 100 && !$('[data-testid="hc-y-label"]'); i += 1) await wait(20); // wait for the first measured render
await wait(100);

test("UI: starts in Heating at -20 degC, paused, with both axes labelled and the assumption stated", () => {
  assert.equal(attr("data-mode"), "heating"); assert.equal(attr("data-playing"), "0"); assert.equal(Number(attr("data-progress")), 0);
  assert.match($('[data-testid="hc-temp"]').textContent, /−20 °C/);
  assert.match($('[data-testid="hc-y-label"]').textContent, /Temperature \(°C\)/);
  assert.match($('[data-testid="hc-x-label"]').textContent, /^Time/);
  assert.match($('[data-testid="hc-assumption"]').textContent, /constant heating power/);
  assert.equal($('[data-testid="hc-mode-heating"]').getAttribute("aria-checked"), "true");
  assert.ok($('[data-testid="hc-play"]') && $('[data-testid="hc-reset"]') && $('[data-testid="hc-slider"]'));
});
test("UI: slider scrub updates the graph marker, temperature, segment and particle model together", async () => {
  const read = () => ({ cx: Number($('[data-testid="hc-marker"]').getAttribute("data-cx")), cy: Number($('[data-testid="hc-marker"]').getAttribute("data-cy")), seg: attr("data-segment"), temp: Number(attr("data-temp")), pc: { ...$('[data-testid="hc-particles"]').dataset } });
  await scrub(0); const a = read();
  await scrub(155); const b = read(); // melting plateau midpoint
  await scrub(165); const c = read();
  assert.equal(b.seg, "melt"); assert.equal(b.temp, 0);
  close(b.cy, c.cy, 1e-6, "marker height constant on the plateau"); assert.ok(c.cx > b.cx, "marker moves right in time");
  assert.ok(b.cy < a.cy, "marker rose from -20 to 0 degC");
  assert.equal(b.pc.progress, "0.1550"); // particles drew the SAME progress as the graph
  assert.ok(Number(b.pc.solid) > 15 && Number(b.pc.liquid) > 15, `mixture at the melting midpoint: ${b.pc.solid}/${b.pc.liquid}/${b.pc.gas}`);
  await scrub(690); const d = read();
  assert.equal(d.seg, "boil"); assert.equal(d.temp, 100);
  assert.ok(Number(d.pc.gas) > 15 && Number(d.pc.liquid) > 15);
  await scrub(1000); assert.equal(read().seg, "gasHeat"); assert.equal(read().temp, 130); assert.equal(Number(read().pc.gas), 80);
  await scrub(500); await scrub(100); await scrub(500); // back and forth: same state again
  assert.equal(read().seg, "boil");
});
test("UI: marker x follows progress linearly (box 400 px: plot starts at 58, 326 px wide)", async () => {
  await scrub(0); close(Number($('[data-testid="hc-marker"]').getAttribute("data-cx")), 58, 0.2);
  await scrub(1000); close(Number($('[data-testid="hc-marker"]').getAttribute("data-cx")), 58 + 326, 0.2);
  await scrub(500); close(Number($('[data-testid="hc-marker"]').getAttribute("data-cx")), 58 + 163, 0.2);
});
test("UI: switching to Cooling resets to the start of cooling (gas, 130 degC) and says energy is released", async () => {
  await scrub(400);
  await click('[data-testid="hc-mode-cooling"]');
  assert.equal(attr("data-mode"), "cooling"); assert.equal(Number(attr("data-progress")), 0); assert.equal(attr("data-segment"), "gasCool");
  assert.match($('[data-testid="hc-temp"]').textContent, /130 °C/);
  assert.match($('[data-testid="hc-energy-flow"]').textContent, /released/);
  assert.match($('[data-testid="hc-assumption"]').textContent, /constant cooling power/);
  assert.match($('[data-testid="hc-assumption"]').textContent, /reversed/);
  assert.equal($('[data-testid="hc-mode-cooling"]').getAttribute("aria-checked"), "true");
});
test("UI: cooling scrub goes gas -> condensation -> liquid -> freezing -> solid with falling temperature", async () => {
  const seen = []; const temps = [];
  for (const v of [0, 250, 500, 700, 850, 1000]) { await scrub(v); seen.push(attr("data-segment")); temps.push(Number(attr("data-temp"))); }
  assert.deepEqual([...new Set(seen)], ["gasCool", "condense", "liquidCool", "freeze", "solidCool"].filter((k) => seen.includes(k)));
  assert.ok(seen.includes("condense") && seen.includes("freeze") && seen.includes("solidCool"));
  for (let i = 1; i < temps.length; i += 1) assert.ok(temps[i] <= temps[i - 1] + 1e-9);
  await scrub(1000); assert.equal(Number($('[data-testid="hc-particles"]').dataset.solid), 80);
});
test("UI: Play advances progress, Pause stops it, Reset returns to the start of the active mode and pauses", async () => {
  await click('[data-testid="hc-reset"]');
  assert.equal(Number(attr("data-progress")), 0);
  const speed = $('[data-testid="hc-speed"]');
  Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, "value").set.call(speed, "4");
  speed.dispatchEvent(new Event("change", { bubbles: true })); await wait();
  await click('[data-testid="hc-play"]'); assert.equal(attr("data-playing"), "1");
  await wait(500);
  const p1 = Number(attr("data-progress")); assert.ok(p1 > 0.02 && p1 < 0.2, `progress after 0.5 s at 4x: ${p1}`);
  await click('[data-testid="hc-play"]'); assert.equal(attr("data-playing"), "0");
  const p2 = Number(attr("data-progress")); await wait(200); assert.equal(Number(attr("data-progress")), p2);
  await click('[data-testid="hc-reset"]'); assert.equal(Number(attr("data-progress")), 0); assert.equal(attr("data-mode"), "cooling");
});
test("UI: scrubbing while playing pauses; Play at the end restarts from the start", async () => {
  await click('[data-testid="hc-play"]'); await scrub(1000);
  assert.equal(attr("data-playing"), "0"); assert.match($('[data-testid="hc-play"]').textContent, /Replay/);
  await click('[data-testid="hc-play"]'); assert.ok(Number(attr("data-progress")) < 0.2); assert.equal(attr("data-playing"), "1");
  await click('[data-testid="hc-play"]');
});
test("UI: 'Time axis to scale' switches the model (boiling plateau gets longer) without changing the endpoints", async () => {
  await click('[data-testid="hc-mode-heating"]');
  const segs = () => [...document.querySelectorAll("g[data-segment]")].map((g) => g.querySelector("rect").getAttribute("width"));
  const before = segs();
  await click('[data-testid="hc-to-scale"]');
  const after = segs();
  assert.notDeepEqual(before, after);
  assert.ok(Number(after[3]) > Number(before[3]));
  assert.match($('[data-testid="hc-assumption"]').textContent, /to scale/);
  await click('[data-testid="hc-to-scale"]');
});

for (const { name, fn } of pending) {
  try { await fn(); passed += 1; console.log(`  ok   ${name}`); } catch (e) { failed += 1; console.log(`  FAIL ${name}\n       ${e.message}`); }
}
console.log(`\nheating-cooling-curve: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
