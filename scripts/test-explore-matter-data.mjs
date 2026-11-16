// Explore Matter & States sample data: every mass/volume pair must follow from a real density (GS-27, GS-28).
import assert from "node:assert/strict";
import { MATTER_EXAMPLES } from "../src/engines/explore-matter-and-states/data/examples.js";

let pass = 0; let fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log(`  ok   ${name}`); } catch (e) { fail++; console.log(`  FAIL ${name}\n       ${e.message}`); } };
const num = (s) => Number(/([\d.]+) g/.exec(s)[1]);
const REAL = { rock: [2.5, 3.0], "iron-nail": [7.8, 7.9], ice: [0.9, 0.93], salt: [2.1, 2.2], copper: [8.9, 9.0], water: [0.99, 1.0], ethanol: [0.78, 0.8] };

test("ten matter samples, unique ids", () => { assert.equal(MATTER_EXAMPLES.length, 10); assert.equal(new Set(MATTER_EXAMPLES.map((e) => e.id)).size, 10); });
test("solid and liquid masses follow from real densities", () => {
  for (const e of MATTER_EXAMPLES.filter((x) => REAL[x.id])) {
    let V; let m;
    if (e.volumeMethod === "regular-solid") { V = e.volume.l * e.volume.w * e.volume.h; m = num(e.mass.after); }
    else if (e.volumeMethod === "irregular-solid") { V = e.volume.after - e.volume.before; m = num(e.mass.after); }
    else { V = e.volume.amount; m = num(e.mass.after) - num(e.mass.before); }
    const rho = m / V; const [lo, hi] = REAL[e.id];
    assert.ok(rho >= lo - 0.02 && rho <= hi + 0.02, `${e.id}: density ${rho.toFixed(3)} g/cm3 outside ${lo}-${hi}`);
  }
});
test("gas masses are tiny and follow gas densities (g per dm3)", () => {
  const rho = { air: 1.2, oxygen: 1.43, "carbon-dioxide": 1.98 };
  for (const e of MATTER_EXAMPLES.filter((x) => rho[x.id])) {
    const dm = num(e.mass.after) - num(e.mass.before); const expect = (rho[e.id] * e.volume.amount) / 1000;
    assert.ok(Math.abs(dm - expect) <= 0.006, `${e.id}: ${dm.toFixed(3)} g vs ${expect.toFixed(3)} g`);
  }
});
test("no dissolving sample is measured by displacement in water", () => {
  const salt = MATTER_EXAMPLES.find((e) => e.id === "salt");
  assert.notEqual(salt.volumeMethod, "irregular-solid");
});
test("the three gases differ in mass (CO2 > O2 > air) for the same volume", () => {
  const d = (id) => { const e = MATTER_EXAMPLES.find((x) => x.id === id); return num(e.mass.after) - num(e.mass.before); };
  assert.ok(d("carbon-dioxide") > d("oxygen") && d("oxygen") > d("air"));
});
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
