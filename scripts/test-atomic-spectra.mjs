// Pure-logic tests for the Atomic Spectra Lab (cold/hot hydrogen absorption, nearest-gap matching, tolerance, relaxation).
import assert from "node:assert/strict";
import { matchAbsorptionByEnergy, relaxCascade, ABSORPTION_TOLERANCE_PERCENT, availableUpwardTransitions, ionizationEnergyEv } from "../src/engines/atomic-spectra/lib/transitionMatching.js";
import { absorptionFor, SPECTRA } from "../src/engines/atomic-spectra/data/spectra.js";
import { hydrogenEnergyEv } from "../src/engines/atomic-spectra/lib/hydrogenEnergy.js";
import { RYDBERG_EV } from "../src/lib/atomic/constants.js";
import * as sc from "../src/engines/atomic-spectra/lib/scientificConstants.js";

let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok -", name); };

t("one shared Rydberg energy", () => { assert.equal(sc.RYDBERG_EV, RYDBERG_EV); assert.ok(Math.abs(hydrogenEnergyEv(1) + 13.5984) < 1e-3); });
t("cold hydrogen: no visible absorption lines, only Lyman in the UV (AS-01)", () => {
  const a = absorptionFor("H", "cold");
  assert.equal(a.visibleLines.length, 0);
  assert.ok(a.lines.length >= 3 && a.lines.every((l) => l.wavelengthNm < 125 && l.transition.from === 1));
  assert.ok(Math.abs(a.lines[0].wavelengthNm - 121.57) < 0.1);
});
t("hot hydrogen: Balmer dark lines, same wavelengths as emission", () => {
  const a = absorptionFor("H", "hot");
  assert.equal(a.lines, SPECTRA.H.lines);
  assert.ok(Math.abs(a.visibleLines[0].wavelengthNm - 656.47) < 0.1);
});
t("sodium absorption lines correspond to emission", () => assert.equal(absorptionFor("Na").lines, SPECTRA.Na.lines));
t("tolerance is 1 % and exposed", () => assert.equal(ABSORPTION_TOLERANCE_PERCENT, 1));
t("exact photon absorbed, 3 % off is not (AS-03)", () => {
  const d = availableUpwardTransitions(1).find((x) => x.toLevel === 2).deltaEv;
  assert.equal(matchAbsorptionByEnergy(1, d).toLevel, 2);
  assert.equal(matchAbsorptionByEnergy(1, d * 1.03), null);
  assert.equal(matchAbsorptionByEnergy(1, d * 0.97), null);
});
t("match reports offset", () => {
  const d = availableUpwardTransitions(1).find((x) => x.toLevel === 2).deltaEv;
  const m = matchAbsorptionByEnergy(1, d * 1.005);
  assert.ok(Math.abs(m.offsetPercent - 0.5) < 1e-6);
});
t("photon above ionisation energy ionises with kinetic energy", () => {
  const m = matchAbsorptionByEnergy(1, ionizationEnergyEv(1) + 1);
  assert.equal(m.kind, "ionization");
  assert.ok(Math.abs(m.excessKeEv - 1) < 1e-9);
});
t("relaxation cascade ends at n=1 and sums to the level energy", () => {
  const c = relaxCascade(4);
  assert.deepEqual(c.map((s) => s.from), [4, 3, 2]);
  assert.equal(c.at(-1).to, 1);
  const sum = c.reduce((a, s) => a + s.deltaEv, 0);
  assert.ok(Math.abs(sum - (hydrogenEnergyEv(4) - hydrogenEnergyEv(1))) < 1e-9);
  assert.deepEqual(relaxCascade(1), []);
});
console.log(`${n} passed`);
