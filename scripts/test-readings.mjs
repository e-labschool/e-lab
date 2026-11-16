#!/usr/bin/env node
// Unit tests for pure logic shared by the gas simulations: IB units / conversions and the Readings table model + CSV.
import assert from "node:assert/strict";
import * as U from "../src/lib/gas/gasUnits.js";
import * as R from "../src/components/interactive-shell/readings/readingsModel.js";

let passed = 0; let failed = 0;
function test(name, fn) { try { fn(); passed += 1; console.log("  ok  ", name); } catch (e) { failed += 1; console.log("  FAIL", name, "\n      ", e.message); } }
const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} vs ${b}`);

console.log("IB units");
test("IB constants (data booklet 2025): R 8.31, STP 273.15 K / 100 kPa / 22.7 dm3, SATP 298.15 K / 100 kPa", () => {
  assert.equal(U.R_IB, 8.31); assert.equal(U.STP.T, 273.15); assert.equal(U.STP.P_kPa, 100); assert.equal(U.STP.molarVolume, 22.7); assert.equal(U.SATP.T, 298.15);
});
test("molar volume at STP from PV = nRT with R = 8.31 rounds to 22.7 dm3 (self-consistency with the booklet)", () => {
  assert.equal(Number(U.volumeFrom(1, U.STP.T, U.STP.P_kPa).toFixed(1)), 22.7);
  assert.equal(Number(U.volumeFrom(1, U.SATP.T, U.SATP.P_kPa).toFixed(1)), 24.8);
});
test("pressure conversions round-trip and match 1 atm = 101.325 kPa = 760 mmHg", () => {
  close(U.fromKPa(101.325, "atm"), 1); close(U.fromKPa(101.325, "mmHg"), 760); close(U.toKPa(1, "atm"), 101.325);
  for (const u of ["kPa", "atm", "mmHg"]) close(U.toKPa(U.fromKPa(123.4, u), u), 123.4);
});
test("volume and temperature conversions", () => {
  close(U.fromDm3(1, "cm3"), 1000); close(U.fromDm3(2.5, "L"), 2.5); close(U.kelvinToCelsius(273.15), 0); close(U.celsiusToKelvin(25), 298.15);
});
test("PV = nRT helpers are mutually consistent", () => {
  const n = 0.75; const T = 310; const V = 18;
  const P = U.pressureFrom(n, T, V); close(U.molesFrom(P, V, T), n); close(U.temperatureFrom(P, V, n), T); close(U.volumeFrom(n, T, P), V);
});
test("formatting: true minus, no -0, unit labels, kelvin with Celsius beside it", () => {
  assert.equal(U.fixed(-0.0001, 2), "0.00"); assert.equal(U.fixed(-1.5, 1), "−1.5");
  assert.equal(U.formatTemperatureBoth(298.15, 2), "298.15 K (25.00 °C)");
  assert.equal(U.formatPressure(100, "atm"), "0.987 atm"); assert.equal(U.formatVolume(22.7, "dm3"), "22.7 dm³");
});
test("parseNumber accepts typed input and rejects junk", () => {
  assert.equal(U.parseNumber("273.15"), 273.15); assert.equal(U.parseNumber("273,15"), 273.15); assert.equal(U.parseNumber(" 1 0 1 "), 101);
  for (const bad of ["", "abc", "1.2.3", "NaN", "Infinity", null, undefined]) assert.equal(U.parseNumber(bad), null, String(bad));
});

console.log("Readings model");
const cols = [{ key: "P", label: "P", unit: "kPa", decimals: 1 }, { key: "V", label: "V", unit: "dm³", decimals: 2 }];
test("add / duplicate refused / invalid refused / full refused", () => {
  let s = R.createReadings();
  let r = R.addReading(s, { P: 100, V: 25 }, cols); assert.ok(r.ok); s = r.state;
  r = R.addReading(s, { P: 100, V: 25 }, cols); assert.equal(r.reason, "duplicate"); assert.equal(r.state.rows.length, 1);
  r = R.addReading(s, { P: NaN, V: 25 }, cols); assert.equal(r.reason, "invalid");
  r = R.addReading(s, { P: 100 }, cols); assert.equal(r.reason, "invalid");
  for (let i = 0; s.rows.length < R.MAX_READINGS; i += 1) s = R.addReading(s, { P: 1 + i, V: 2 }, cols).state;
  assert.equal(R.addReading(s, { P: 9999, V: 1 }, cols).reason, "full");
});
test("delete and clear never mutate and ids stay unique", () => {
  let s = R.createReadings();
  for (let i = 1; i <= 3; i += 1) s = R.addReading(s, { P: i, V: i }, cols).state;
  const before = JSON.stringify(s);
  const d = R.removeReading(s, 2); assert.deepEqual(d.rows.map((r) => r.id), [1, 3]); assert.equal(JSON.stringify(s), before);
  const a = R.addReading(d, { P: 9, V: 9 }, cols).state; assert.deepEqual(a.rows.map((r) => r.id), [1, 3, 4]);
  assert.equal(R.clearReadings(a).rows.length, 0);
});
test("CSV: header with units, CRLF, escaping, display precision, scale applied, meta comment lines", () => {
  let s = R.createReadings();
  s = R.addReading(s, { P: 101.325, V: 24.8 }, cols).state;
  const c2 = [{ ...cols[0], unit: "atm", decimals: 3, scale: 1 / 101.325 }, { key: "V", label: 'V, "vol"', unit: "dm³", decimals: 2 }];
  const csv = R.toCSV(c2, s.rows, ["Gas Laws, test"]);
  assert.equal(csv, '"# Gas Laws, test"\r\nReading,P (atm),"V, ""vol"" (dm³)"\r\n1,1.000,24.80\r\n');
});
test("linearFit recovers y = 8.31 x exactly and refuses degenerate data", () => {
  const pts = [1, 2, 3, 4].map((x) => ({ x, y: 8.31 * x }));
  const f = R.linearFit(pts); close(f.slope, 8.31); close(f.intercept, 0, 1e-9); close(f.r2, 1);
  assert.equal(R.linearFit([{ x: 1, y: 1 }]), null); assert.equal(R.linearFit([{ x: 2, y: 1 }, { x: 2, y: 5 }]), null);
});
test("buildPlot scales columns, includes origin, nice ticks bracket the data", () => {
  let s = R.createReadings();
  s = R.addReading(s, { P: 50.6625, V: 10 }, cols).state; s = R.addReading(s, { P: 101.325, V: 20 }, cols).state;
  const c2 = [{ ...cols[0], scale: 1 / 101.325 }, cols[1]];
  const p = R.buildPlot(s.rows, "V", "P", { includeOrigin: true, columns: c2, fit: true });
  close(p.points[1].y, 1); close(p.points[0].y, 0.5); assert.equal(p.xRange[0], 0); assert.ok(p.xRange[1] >= 20 && p.yRange[1] >= 1);
  close(p.fit.slope, 0.05);
});
test("niceScale handles zero-width and non-finite ranges", () => {
  const a = R.niceScale(5, 5); assert.ok(a.max > a.min); const b = R.niceScale(NaN, 3); assert.ok(b.max > b.min);
});
test("fileStem is a safe file name", () => { assert.equal(R.fileStem("Gas Laws", "P-V!", "readings"), "gas-laws-p-v-readings"); assert.equal(R.fileStem(""), "readings"); });

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
