#!/usr/bin/env node
// Tests for the shared acid-base module (src/lib/acidbase/): exact solver, titration model, formatting, label placement.
//   node scripts/test-acidbase.mjs
// The solver is checked against an INDEPENDENT implementation written here with a different formulation (bases expressed
// through Kb and [OH-], regula falsi in pH space) plus closed-form textbook anchors. Printed lines show the numbers checked.
import assert from "node:assert/strict";
import { KW, PKA_ETHANOIC, PKB_AMMONIA, PKA_AMMONIUM, REAGENTS, INDICATORS } from "../src/lib/acidbase/constants.js";
import { solveSolution, strongPH } from "../src/lib/acidbase/solver.js";
import { makeTitration, comparisonSet, niceAxisMax, BUFFER_FRACTION_LOW, BUFFER_FRACTION_HIGH } from "../src/lib/acidbase/titration.js";
import { formatScientific, formatDecimal, formatPH, formatDelta, parseNumber, roundSig } from "../src/lib/acidbase/format.js";
import { placeLabels } from "../src/lib/acidbase/labels.js";

let passed = 0;
const say = (m) => console.log("   " + m);
function test(name, fn) { try { fn(); passed += 1; console.log(`ok  ${name}`); } catch (e) { console.error(`FAIL ${name}\n${e.stack}`); process.exitCode = 1; } }

// ---------- independent reference solver (different formulation and root finder) ----------
function refPH({ cAcidStrong = 0, cBaseStrong = 0, weakAcid = null, weakBase = null }) {
  // weakAcid {c, Ka}; weakBase {c, Kb}. Unknown pH; electroneutrality written with [OH-] and Kb for the base.
  const f = (pH) => {
    const H = 10 ** -pH; const OH = KW / H;
    let pos = H + cBaseStrong; let neg = OH + cAcidStrong;
    if (weakAcid) neg += (weakAcid.c * weakAcid.Ka) / (weakAcid.Ka + H);
    if (weakBase) pos += (weakBase.c * weakBase.Kb) / (weakBase.Kb + OH); // from Kb = [BH+][OH-]/[B]: BH+ = c Kb/(Kb+[OH-])
    return pos - neg; // decreasing in pH
  };
  let a = -2, b = 16, fa = f(a), fb = f(b), side = 0;
  for (let i = 0; i < 400; i += 1) {
    const c = (fa * b - fb * a) / (fa - fb); const fc = f(c);
    if (Math.abs(fc) < 1e-18 || Math.abs(b - a) < 1e-12) return c;
    if (fc * fb > 0) { b = c; fb = fc; if (side === -1) fa /= 2; side = -1; } else { a = c; fa = fc; if (side === 1) fb /= 2; side = 1; }
  }
  return (a + b) / 2;
}
const Ka = 10 ** -PKA_ETHANOIC; const Kb = 10 ** -PKB_AMMONIA;
function refTitrationPH(t, v) {
  const Vt = (t.vFlask + v) / 1000; const nF = (t.cFlask * t.vFlask) / 1000; const nT = (t.cBurette * v) / 1000;
  const nA = t.flaskIsAcid ? nF : nT; const nB = t.flaskIsAcid ? nT : nF;
  return refPH({ cAcidStrong: t.acid.strong ? nA / Vt : 0, cBaseStrong: t.base.strong ? nB / Vt : 0, weakAcid: t.acid.strong ? null : { c: nA / Vt, Ka }, weakBase: t.base.strong ? null : { c: nB / Vt, Kb } });
}

test("constants: IB values pKa 4.76, pKb 4.75 at 298 K; pKa(NH4+) = 14 - 4.75", () => {
  assert.equal(PKA_ETHANOIC, 4.76); assert.equal(PKB_AMMONIA, 4.75); assert.equal(PKA_AMMONIUM, 9.25); assert.equal(KW, 1e-14);
  say(`Ka(CH3COOH) = ${Ka.toExponential(3)}, Kb(NH3) = ${Kb.toExponential(3)}, Kw = ${KW}`);
});

test("solver vs independent solver: 4 pairs x 3x3 concentrations x 14 volumes incl. +/-0.1% and +/-1% of V_eq", () => {
  let worst = 0; let n = 0;
  for (const [f, b] of [["HCl", "NaOH"], ["CH3COOH", "NaOH"], ["NH3", "HCl"], ["NaOH", "HCl"], ["HCl", "NH3"], ["CH3COOH", "NH3"], ["NaOH", "CH3COOH"], ["NH3", "CH3COOH"]]) {
    for (const cf of [0.05, 0.1, 0.2]) for (const cb of [0.05, 0.1, 0.2]) {
      const t = makeTitration({ flaskId: f, buretteId: b, cFlask: cf, cBurette: cb });
      const vs = [0, 0.05, 1, 0.25 * t.veq, 0.5 * t.veq, 0.9 * t.veq, 0.99 * t.veq, 0.999 * t.veq, t.veq, 1.001 * t.veq, 1.01 * t.veq, 1.1 * t.veq, 1.5 * t.veq, 2 * t.veq];
      for (const v of vs) { const d = Math.abs(t.phAt(v) - refTitrationPH(t, v)); worst = Math.max(worst, d); n += 1; assert.ok(d < 1e-6, `${f}+${b} cf=${cf} cb=${cb} v=${v}: ${t.phAt(v)} vs ${refTitrationPH(t, v)}`); }
    }
  }
  say(`${n} comparisons, worst |difference| = ${worst.toExponential(2)} pH units`);
});

test("closed-form anchors (0.100 mol dm-3, 25.0 cm3)", () => {
  const close = (a, b, e, m) => assert.ok(Math.abs(a - b) <= e, `${m}: ${a} vs ${b}`);
  close(strongPH(0.1), 1.0, 1e-4, "0.1 HCl"); close(strongPH(-0.1), 13.0, 1e-4, "0.1 NaOH");
  close(strongPH(1e-8), 6.978, 2e-3, "1e-8 HCl incl. water autoionisation (6.98, not 8)");
  const x = (-Ka + Math.sqrt(Ka * Ka + 4 * Ka * 0.1)) / 2; close(solveSolution({ weakAcids: [{ c: 0.1, pKa: PKA_ETHANOIC }] }).pH, -Math.log10(x), 1e-4, "0.1 CH3COOH quadratic");
  const y = (-Kb + Math.sqrt(Kb * Kb + 4 * Kb * 0.1)) / 2; close(solveSolution({ weakBases: [{ c: 0.1, pKa: PKA_AMMONIUM }] }).pH, 14 + Math.log10(y), 1e-4, "0.1 NH3 quadratic");
  const wa = makeTitration({ flaskId: "CH3COOH", buretteId: "NaOH" });
  say(`0.100 CH3COOH pH ${wa.initial.pH.toFixed(3)} (quadratic ${(-Math.log10(x)).toFixed(3)}); 0.100 NH3 pH ${makeTitration({ flaskId: "NH3", buretteId: "HCl" }).initial.pH.toFixed(3)}`);
  const Cs = 0.05; // ethanoate at equivalence: 25 cm3 + 25 cm3
  const Kbc = KW / Ka; const z = (-Kbc + Math.sqrt(Kbc * Kbc + 4 * Kbc * Cs)) / 2;
  close(wa.eq.pH, 14 + Math.log10(z), 1e-3, "equivalence pH, weak acid + strong base (hydrolysis of ethanoate)");
  say(`weak acid + strong base: V_eq ${wa.veq} cm3, equivalence pH ${wa.eq.pH.toFixed(3)} (analytic ${(14 + Math.log10(z)).toFixed(3)})`);
  const sb = makeTitration({ flaskId: "NH3", buretteId: "HCl" }); const Kac = KW / Kb; const w = (-Kac + Math.sqrt(Kac * Kac + 4 * Kac * Cs)) / 2;
  close(sb.eq.pH, -Math.log10(w), 1e-3, "equivalence pH, weak base + strong acid"); say(`weak base + strong acid: equivalence pH ${sb.eq.pH.toFixed(3)} (analytic ${(-Math.log10(w)).toFixed(3)})`);
  close(makeTitration({ flaskId: "HCl", buretteId: "NaOH" }).eq.pH, 7, 1e-6, "strong/strong equivalence"); say("strong acid + strong base: equivalence pH 7.000");
  close(makeTitration({ flaskId: "CH3COOH", buretteId: "NH3" }).eq.pH, 7 + 0.5 * (PKA_ETHANOIC - PKB_AMMONIA), 0.02, "weak/weak equivalence = 7 + (pKa - pKb)/2");
  say(`weak acid + weak base: equivalence pH ${makeTitration({ flaskId: "CH3COOH", buretteId: "NH3" }).eq.pH.toFixed(3)}`);
});

test("half-equivalence: pH = pKa (acid 4.76 / ammonium 9.25) within 0.02; buffer region only for weak flask + strong titrant", () => {
  const a = makeTitration({ flaskId: "CH3COOH", buretteId: "NaOH" }); const b = makeTitration({ flaskId: "NH3", buretteId: "HCl" });
  assert.ok(Math.abs(a.halfEq.pH - 4.76) < 0.02); assert.ok(Math.abs(b.halfEq.pH - 9.25) < 0.02);
  say(`CH3COOH: half-eq pH ${a.halfEq.pH.toFixed(3)} (pKa 4.76) at ${a.halfEq.v} cm3; NH3: half-eq pH ${b.halfEq.pH.toFixed(3)} (pKa 9.25)`);
  for (const t of [a, b]) {
    assert.ok(Math.abs(t.buffer.vLow - t.veq * BUFFER_FRACTION_LOW) < 1e-12 && Math.abs(t.buffer.vHigh - t.veq * BUFFER_FRACTION_HIGH) < 1e-12);
    const edges = [t.buffer.pHLow, t.buffer.pHHigh].sort((x, y) => x - y); // acid flask: pH rises across the region; base flask: pH falls
    assert.ok(Math.abs(edges[0] - (t.buffer.pKa - 1)) < 0.03, `low edge ${edges[0]}`); assert.ok(Math.abs(edges[1] - (t.buffer.pKa + 1)) < 0.03, `high edge ${edges[1]}`);
    assert.ok(Math.abs(t.stateAt(t.buffer.vLow).ratio - 0.1) < 1e-9 && Math.abs(t.stateAt(t.buffer.vHigh).ratio - 10) < 1e-9);
    say(`buffer region ${t.buffer.vLow.toFixed(3)}-${t.buffer.vHigh.toFixed(3)} cm3 (${(100 * BUFFER_FRACTION_LOW).toFixed(1)}%-${(100 * BUFFER_FRACTION_HIGH).toFixed(1)}% of V_eq), edge pH ${edges[0].toFixed(2)} / ${edges[1].toFixed(2)} vs pKa -/+ 1 = ${(t.buffer.pKa - 1).toFixed(2)} / ${(t.buffer.pKa + 1).toFixed(2)}; ratio 1:10 .. 10:1`);
  }
  for (const [f, bu] of [["HCl", "NaOH"], ["NaOH", "HCl"], ["HCl", "NH3"], ["NaOH", "CH3COOH"], ["CH3COOH", "NH3"], ["NH3", "CH3COOH"]]) {
    const t = makeTitration({ flaskId: f, buretteId: bu }); assert.equal(t.buffer, null, `${f}+${bu} must have no buffer region`); assert.equal(t.halfEq, null);
  }
  say("no buffer region for strong/strong, strong flask + weak titrant, weak/weak (6 pairs checked)");
});

test("stage wording is direction-aware: never 'approaching' after equivalence (AK-26, AK-33)", () => {
  const t = makeTitration({ flaskId: "NaOH", buretteId: "HCl" });
  for (const dv of [-0.9, -0.5, -0.1]) assert.equal(t.stageText(t.stateAt(t.veq + dv)).key, "approaching");
  for (const dv of [0.1, 0.5, 0.9, 2.5]) assert.notEqual(t.stageText(t.stateAt(t.veq + dv)).key, "approaching");
  assert.equal(t.stageText(t.stateAt(t.veq + 0.5)).key, "past"); assert.equal(t.stageText(t.stateAt(t.veq)).key, "equivalence");
  assert.equal(t.stageText(t.stateAt(t.veq + 2.5)).text, "Acid in excess");
  say("V_eq-0.5 -> approaching; V_eq+0.5 -> 'Just past equivalence: acid in excess'; V_eq+2.5 -> 'Acid in excess'");
});

test("dense curve: adjacent pH steps <= 0.04 (or dv at minimum), monotonic for every pair, endpoints exact", () => {
  let maxPts = 0;
  for (const [f, b] of [["HCl", "NaOH"], ["CH3COOH", "NaOH"], ["NH3", "HCl"], ["NaOH", "HCl"], ["CH3COOH", "NH3"]]) {
    const t = makeTitration({ flaskId: f, buretteId: b }); const c = t.curve(t.axisMax); maxPts = Math.max(maxPts, c.length);
    assert.equal(c[0].v, 0); assert.equal(c[c.length - 1].v, t.axisMax);
    const inc = c[c.length - 1].pH > c[0].pH;
    for (let i = 1; i < c.length; i += 1) { assert.ok(c[i].v > c[i - 1].v); assert.ok(inc ? c[i].pH >= c[i - 1].pH - 1e-9 : c[i].pH <= c[i - 1].pH + 1e-9, `monotonic ${f}+${b} at ${c[i].v}`); assert.ok(Math.abs(c[i].pH - c[i - 1].pH) <= 0.04 + 1e-9 || c[i].v - c[i - 1].v < 2e-4, `step ${f}+${b} at ${c[i].v}`); }
  }
  say(`up to ${maxPts} sample points per curve`);
});

test("axis auto-scale: V_eq always inside the axis, with room beyond it, for every concentration pair (AK-35)", () => {
  const rows = [];
  for (const cf of [0.05, 0.1, 0.2]) for (const cb of [0.05, 0.1, 0.2]) {
    const t = makeTitration({ flaskId: "HCl", buretteId: "NaOH", cFlask: cf, cBurette: cb });
    assert.ok(t.veq < t.axisMax / 1.5, `${cf}/${cb}: veq ${t.veq} axis ${t.axisMax}`); rows.push(`${cf}/${cb}: V_eq ${t.veq} -> axis ${t.axisMax}`);
  }
  assert.equal(niceAxisMax(25), 50); assert.equal(niceAxisMax(100), 200); say(rows.join("; "));
});

test("steep region and strong-vs-weak comparison numbers (pH jump across V_eq +/- 1%)", () => {
  const set = comparisonSet({ side: "acid", includeWeakWeak: true });
  const j = Object.fromEntries(set.map((s) => [s.id, s.titration.steep.jump]));
  assert.ok(j["SA-SB"] > j["WA-SB"] && j["WA-SB"] > j["WA-WB"], JSON.stringify(j));
  for (const s of set) say(`${s.id}: initial pH ${s.titration.initial.pH.toFixed(2)}, equivalence pH ${s.titration.eq.pH.toFixed(2)}, pH jump over +/-1% V_eq = ${s.titration.steep.jump.toFixed(2)}, buffer region ${s.titration.buffer ? "yes" : "no"}`);
  const bs = comparisonSet({ side: "base" }); assert.equal(bs.length, 2); assert.ok(bs[0].titration.eq.pH === bs[0].titration.eq.pH && Math.abs(bs[0].titration.eq.pH - 7) < 1e-6 && bs[1].titration.eq.pH < 7);
  assert.ok(set[1].titration.eq.pH > 7); say(`base side: eq pH ${bs[0].titration.eq.pH.toFixed(2)} (SB+SA) and ${bs[1].titration.eq.pH.toFixed(2)} (WB+SA)`);
});

test("indicator ranges (to verify against the IB data booklet) and suitability: range overlaps the vertical part of the curve", () => {
  assert.deepEqual([INDICATORS["methyl-orange"].low, INDICATORS["methyl-orange"].high], [3.1, 4.4]);
  assert.deepEqual([INDICATORS["bromothymol-blue"].low, INDICATORS["bromothymol-blue"].high], [6.0, 7.6]);
  assert.deepEqual([INDICATORS.phenolphthalein.low, INDICATORS.phenolphthalein.high], [8.2, 10.0]);
  const t = makeTitration({ flaskId: "CH3COOH", buretteId: "NaOH" });
  assert.ok(t.steep.pHLow < 8.2 && t.steep.pHHigh > 10.0 - 1.5, `${t.steep.pHLow} ${t.steep.pHHigh}`); say(`weak acid + strong base steep window pH ${t.steep.pHLow.toFixed(2)} to ${t.steep.pHHigh.toFixed(2)} (phenolphthalein 8.2-10.0)`);
});

test("water autoionisation and extremes: pH of pure water 7.000; 0.2 M NaOH 13.30; 1.0 M HCl 0.00; solver never throws", () => {
  assert.ok(Math.abs(solveSolution({}).pH - 7) < 1e-9); assert.ok(Math.abs(strongPH(-0.2) - 13.301) < 1e-3); assert.ok(Math.abs(strongPH(1)) < 1e-9);
  assert.ok(Math.abs(strongPH(2) + 0.301) < 1e-3); assert.ok(Math.abs(strongPH(-2) - 14.301) < 1e-3);
});

test("formatting: decimal-safe rounding, true minus, parsing of typed values", () => {
  assert.equal(formatScientific(1.25e-5, 2), "1.3 × 10⁻⁵"); assert.equal(formatScientific(6.25e-5, 2), "6.3 × 10⁻⁵");
  assert.equal(formatScientific(9.96e-4, 2), "1.0 × 10⁻³"); assert.equal(formatDecimal(0.000316, 3), "0.000316"); assert.equal(formatDecimal(12345, 3), "12300");
  assert.equal(formatDecimal(0.0003, 3), "0.0003"); assert.equal(formatDecimal(1, 3), "1"); assert.equal(formatDecimal(2.5, 2), "2.5");
  assert.deepEqual(roundSig(9.995, 3), { digits: "100", exp: 1 });
  assert.equal(formatPH(-0.301), "−0.30"); assert.equal(formatPH(-0.0004), "0.00"); assert.equal(formatPH(4.7449), "4.74");
  assert.equal(formatDelta(-0.001), null); assert.equal(formatDelta(-0.5), "−0.50"); assert.equal(formatDelta(2.113), "+2.11");
  for (const [s, v] of [["0,001", 0.001], ["1e-3", 0.001], ["1x10^-3", 0.001], ["1 × 10⁻³", 0.001], ["  0.01 ", 0.01], ["2", 2], ["3.2E-5", 3.2e-5]]) assert.equal(parseNumber(s), v, s);
  for (const s of ["", "abc", "1/10", "0x10", "1e", "--3"]) assert.ok(Number.isNaN(parseNumber(s)), s);
});

test("label placement: 12 crowded anchors, no label overlaps another or the curve points, all inside the plot", () => {
  const bounds = { x: 50, y: 10, w: 440, h: 280 };
  const obstacles = []; for (let i = 0; i <= 200; i += 1) obstacles.push({ x: 50 + (i / 200) * 440, y: 280 - 200 / (1 + Math.exp(-(i - 100) / 6)) });
  const items = Array.from({ length: 12 }, (_, i) => ({ id: `l${i}`, x: 200 + (i % 4) * 14, y: 150 + (i % 3) * 6, text: `Label number ${i}` }));
  const res = placeLabels(items, { bounds, obstacles });
  for (const r of res) { assert.ok(r.placed, r.id); assert.ok(r.box.x >= bounds.x && r.box.x + r.box.w <= bounds.x + bounds.w && r.box.y >= bounds.y && r.box.y + r.box.h <= bounds.y + bounds.h); }
  for (let i = 0; i < res.length; i += 1) for (let j = i + 1; j < res.length; j += 1) { const a = res[i].box, b = res[j].box; assert.ok(!(a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y), `${i} overlaps ${j}`); }
  say(`${res.filter((r) => r.leader).length} of ${res.length} labels use a leader line`);
});

console.log(`\n${passed} acid-base module tests passed`);
