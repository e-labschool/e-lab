// Round-2 pure-logic tests for the atomic simulations: isotope abundance (BA-08), rule-based challenges (BA-07), series limits
// (AS-06), air/vacuum wavelengths (AS-08), identify-unknown (AS-05), spectrum tick and label placement (AS-07).
import assert from "node:assert/strict";
import { ABUNDANCE, MIXER_ELEMENTS, averageMass, setAbundance } from "../src/lib/atomic/abundance.js";
import { generateChallenge, KINDS } from "../src/engines/build-an-atom/lib/generator.js";
import { stableIsotopes } from "../src/lib/atomic/nuclides.js";
import { getElement } from "../src/data/chemistry/elements.js";
import { SERIES, seriesLineNm, seriesLimitNm, seriesLines, ionisationFromLevelKJ, checkLimit } from "../src/engines/atomic-spectra/lib/series.js";
import { airRefractiveIndex, vacuumToAirNm, airToVacuumNm } from "../src/engines/atomic-spectra/lib/airVacuum.js";
import { IDENTIFY_ELEMENTS, makeUnknownSample, checkGuess } from "../src/engines/atomic-spectra/lib/identify.js";
import { SPECTRA } from "../src/engines/atomic-spectra/data/spectra.js";
import { tickStep, placeLineLabels } from "../src/engines/atomic-spectra/lib/spectrumLayout.js";
import { flightEndpoints } from "../src/engines/build-an-atom/lib/flightPath.js";
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok -", name); };
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (tol ${tol})`);

t("abundances sum to 100 and give the accepted Ar from mass numbers within 0.1", () => {
  for (const z of MIXER_ELEMENTS) { const e = ABUNDANCE[z]; close(e.isotopes.reduce((s, [, p]) => s + p, 0), 100, 0.01, `${e.symbol} sum`); close(averageMass(e.isotopes), e.ar, 0.1, `${e.symbol} Ar`); }
});
t("worked IB examples: chlorine 35.5, 50:50 C-12/C-13 = 12.5", () => { close(averageMass([[35, 75], [37, 25]]), 35.5, 1e-9, "Cl 75:25"); close(averageMass([[12, 50], [13, 50]]), 12.5, 1e-12, "C 50:50"); assert.ok(Number.isNaN(averageMass([[12, 0], [13, 0]]))); });
t("abundance slider keeps the total at 100 and the others in proportion", () => {
  const out = setAbundance([75.76, 24.24], 0, 50); close(out[0] + out[1], 100, 1e-9, "sum"); close(out[1], 50, 1e-9, "other");
  const three = setAbundance([90, 5, 5], 0, 70); close(three.reduce((s, x) => s + x, 0), 100, 1e-9, "3-way sum"); close(three[1], three[2], 1e-9, "equal shares stay equal");
  assert.deepEqual(setAbundance([50, 50], 0, 150).map((x) => Math.round(x)), [100, 0]); assert.deepEqual(setAbundance([50, 50], 0, -5).map((x) => Math.round(x)), [0, 100]);
});
t("challenge generator: deterministic, every target is a real stable nuclide, counts recomputed from the answer (BA-07)", () => {
  for (const kind of KINDS) for (let s = 1; s <= 120; s++) {
    const c = generateChallenge(s, kind); assert.deepEqual(c, generateChallenge(s, kind));
    const el = getElement(c.protons); assert.equal(el.symbol, c.symbol, `${kind}/${s} symbol`);
    assert.equal(c.electrons, c.protons - c.charge, `${kind}/${s} electrons = Z - charge`);
    assert.ok(stableIsotopes(c.protons).some((i) => i.neutrons === c.neutrons), `${kind}/${s}: ${c.symbol}-${c.protons + c.neutrons} is a stable nuclide`);
    assert.match(c.worked, new RegExp(String(c.neutrons)), `${kind}/${s} worked answer shows the neutron count`);
    if (kind === "name") assert.ok(c.prompt.includes(`${el.name}-${c.protons + c.neutrons}`), `${kind}/${s} prompt names the mass number`);
  }
  assert.ok(new Set(Array.from({ length: 60 }, (_, i) => generateChallenge(i + 1).kind)).size === KINDS.length, "all kinds appear");
});
t("hydrogen series: Lyman, Balmer, Paschen limits and first lines (AS-06)", () => {
  // finite-mass Rydberg (R_H = 109 677.6 cm-1): limits are n^2 / R_H
  close(seriesLimitNm(1), 91.176, 0.01, "Lyman limit"); close(seriesLimitNm(2), 364.705, 0.02, "Balmer limit"); close(seriesLimitNm(3), 820.58, 0.05, "Paschen limit");
  close(seriesLineNm(1, 2), 121.5, 0.1, "Lyman alpha (vacuum)"); close(seriesLineNm(2, 3), 656.47, 0.05, "H alpha (vacuum)");
  const l = seriesLines(2, 6); assert.equal(l.length, 6); for (let i = 1; i < l.length; i++) assert.ok(l[i].nm < l[i - 1].nm, "lines converge to shorter wavelength"); assert.ok(l[5].nm > seriesLimitNm(2), "every line lies above the limit wavelength");
  close(ionisationFromLevelKJ(1), 1312, 1.5, "ionisation energy of H from n=1, kJ/mol");
  assert.equal(checkLimit(2, 364.7).ok, true); assert.equal(checkLimit(2, 400).ok, false); assert.ok(SERIES.length >= 3);
});
t("air/vacuum: n(air) ~ 1.000277 at 656 nm; H-alpha vacuum 656.47 -> air 656.28; round trip (AS-08)", () => {
  close(airRefractiveIndex(656.47), 1.000277, 5e-6, "n"); close(vacuumToAirNm(656.47), 656.28, 0.02, "H alpha air");
  for (const nm of [250, 486.27, 589, 1000]) close(airToVacuumNm(vacuumToAirNm(nm)), nm, 1e-4, `round trip ${nm}`);
  assert.equal(vacuumToAirNm(121.6), 121.6, "UV below 200 nm is left in vacuum");
});
t("identify-unknown: seeded, covers every lamp, guess checked against the real spectrum (AS-05)", () => {
  const seen = new Set(); for (let s = 1; s <= 300; s++) { const e = makeUnknownSample(s); assert.ok(IDENTIFY_ELEMENTS.includes(e)); assert.equal(makeUnknownSample(s), e); seen.add(e); }
  assert.equal(seen.size, IDENTIFY_ELEMENTS.length);
  assert.equal(checkGuess("Ne", "Ne").ok, true); assert.equal(checkGuess("Ne", "He").ok, false); assert.equal(checkGuess("Hg", "Hg").name, SPECTRA.Hg.name);
  for (const e of IDENTIFY_ELEMENTS) assert.ok(SPECTRA[e].lines.length >= 2, `${e} has lines`);
});
t("spectrum helpers: tick step grows with the span; labels never closer than the gap on a row", () => {
  const spans = [2, 5, 15, 50, 120, 400]; const steps = spans.map(tickStep); for (let i = 1; i < steps.length; i++) assert.ok(steps[i] >= steps[i - 1]);
  const xs = [10, 14, 18, 60, 61, 62, 200].map((x, i) => ({ x, i })); const placed = placeLineLabels(xs, 30);
  for (const row of [0, 1]) { const rx = placed.filter((p) => p.row === row).map((p) => p.x); for (let i = 1; i < rx.length; i++) assert.ok(rx[i] - rx[i - 1] >= 30, `row ${row} spacing`); }
  assert.ok(placed.length < xs.length && placed.length >= 3, "crowded labels are dropped, not stacked");
});
t("BA-12: flights start at the real control row (clamped into the stage) and end at the nucleus / outer ring", () => {
  const stage = { left: 100, top: 50, width: 600, height: 400 };
  const row = { left: 760, top: 150, width: 200, height: 40 }; // side panel, right of the stage
  const ring = { left: 300, top: 100, width: 300, height: 300 };
  const p = flightEndpoints("proton", { stage, row, nucleus: null, ring });
  assert.deepEqual(p.start, { x: 600, y: 120 }, "row centre is 860,170 -> x clamped to the stage width"); assert.deepEqual(p.target, { x: 300, y: 200 }, "nucleus at the stage centre");
  const inside = flightEndpoints("neutron", { stage, row: { left: 150, top: 100, width: 100, height: 40 }, nucleus: null, ring });
  assert.deepEqual(inside.start, { x: 100, y: 70 }, "a row inside the stage is used as it is");
  const e = flightEndpoints("electron", { stage, row, nucleus: null, ring }); assert.deepEqual(e.target, { x: 300, y: 50 }, "electron lands on the top of the outer ring (centre y 200 - radius 150)");
  assert.equal(flightEndpoints("proton", { stage, row: null, nucleus: null, ring }), null, "no control found -> caller falls back"); assert.equal(flightEndpoints("proton", { stage: { left: 0, top: 0, width: 0, height: 0 }, row, nucleus: null, ring }), null);
  assert.deepEqual(flightEndpoints("proton", { stage, row, nucleus: { left: 350, top: 150, width: 20, height: 20 }, ring }).target, { x: 260, y: 110 }, "an explicit nucleus rectangle is honoured");
});
console.log(`${n} passed`);
