# Acid-base simulations: fixes (AK-01..AK-52)

Scope: titration-ph-curve, equivalence-point, buffer-action-visualizer, ph-calculator-visualizer, h-oh-balance, neutralization-particle-visualizer.
Kinetics findings (AK-53 onward) are out of scope. Source review: docs/sim-review/acids-kinetics.md.

## Shared module and tests

- `src/lib/acidbase/` (pure, no React): `constants.js`, `solver.js` (exact charge-balance solver, bisection in log10[H+]), `titration.js`, `format.js`, `labels.js`, `indicators.js`, `addition.js`, `acidbase-ui.css`; round 2: `polyprotic.js`, `challenges.js`, Kw(T) in `constants.js`.
- `scripts/test-acidbase.mjs`: 19 model tests (round 2 added Kw(T), polyprotic, pH and unknown-concentration challenges). Originally 12 model tests. It compares the exact solver with an independent solver (Kb/[OH-] formulation, regula falsi) on 8 acid/base pairs x 9 concentration pairs x 14 volumes, and prints the numbers.
- `scripts/test-acidbase-ui.mjs`: 19 jsdom UI/model tests for all six sims, including AA contrast of the dark-panel tokens (minimum 8.87:1).
- `scripts/verify-acidbase-sims.mjs` (`npm run verify:acidbase`): temp build plus `vite preview`, headless Chromium, 3 sizes x light/dark, repro scenarios.
- Wired as `test:acidbase` into `npm test`.

## Owner request: titration buffer region (done)

- Smooth, dense expected curve from the exact solver (toggle "Expected curve", on by default). Student points are drawn on top.
- Buffer band for weak acid/base titrated by a strong one only. Legend text: "Buffer region: [A-]/[HA] between 1:10 and 10:1".
- Half-equivalence marker with pH = pKa and its value. Equivalence and steep-region (Veq +/- 1%) markers.
- Compare mode: strong/strong, weak/strong and base-side equivalents, optional weak/weak. Table of initial pH, equivalence pH (7, >7, <7), buffer region, pH jump, plus indicator ranges.
- Explanations for "why strong/strong has no buffer" and "why weak/weak has no sharp equivalence".
- Leader-line label placement with no overlaps (checked in Chromium). The axis auto-scales for concentration pairs whose equivalence is far off the default axis.
- Note: pKa +/- 1 is 1/11 to 10/11 of Veq, i.e. 9.1% to 90.9%, not the rounded 10% to 91%.

## Status per finding

Legend: Fixed / Partly / Not done. "Round 2" marks work finished in the second pass (see the end of this file for how it was verified).

### pH Calculator
- AK-01, 02, 03, 04, 06 Fixed (round 1). AK-08 Fixed: 2 s.f. for 2 d.p. of pH.
- AK-05 Partly, by design: below 800 px the scientific-notation column in the ladder is hidden (the same value is in the readout card above it). Chromium at 390x844: no overflow.
- AK-07 Fixed (round 2): "Try it yourself" strip. Three seeded question types (pH from [H3O+], [H3O+] from pH, pH from [OH-] at 298 K), the answer is recomputed in code, a wrong answer gets a reason (pOH confusion, sign, significant figures), working can be shown, score kept, Reset restarts, "Show on scale" moves the marker. Bug found and fixed in round 2: "Show on scale" gave NaN for the "[H3O+] from pH" question (the pH was parsed out of the sentence with its trailing full stop).

### H+ / OH- Balance
- AK-10, 11, 12, 13, 14, 16 Fixed (round 1): real moles and volumes, equal-mole drops, labelled log axis (plus linear option), caption, limit message.
- AK-15 Fixed (round 2): temperature slider 0-100 degC. Kw, pKw, pOH and the neutral pH follow Kw(T); pure hot water stays neutral (pH 6.14 at 100 degC). Kw rows are from chemguide/CRC, not the IB booklet; 25 degC uses the IB value 1.00e-14. Between rows it interpolates pKw linearly in 1/T and says so (75 degC gives 12.74 against CRC about 12.72).
- AK-17 Partly: the acid-base group now shares one dark panel, tokens and contrast-tested colours (min 8.87:1); it is still a dark panel inside a light page, which is a design choice, not changed.

### Neutralization
- AK-18, 19, 20, 21, 23, 25 Fixed (round 1): particles stay inside the liquid, variable amounts, limiting reagent table, full and net ionic equations.
- AK-22 Partly, by design: the pairing is an illustrative schedule, labelled "Illustrative" on screen. Not changed in round 2.
- AK-24 Partly: with reduced motion the reaction completes at once and the loop stops when finished (checked in Chromium with reducedMotion). Not re-audited beyond that.

### Equivalence Point
- AK-26, 27, 28, 29 Fixed (round 1).
- AK-30 Fixed: mini pH trace, 0.5 cm3 step and a 0.1 cm3 "drop" button (verified: two presses = 0.2 cm3 added).
- AK-31 Partly: the artwork is unchanged apart from scaling.
- AK-32 Fixed: aria-live status.

### Titration
- AK-33, 34, 35, 36, 37, 39, 40, 42, 43 Fixed.
- AK-38 Fixed for the practical (round 2): "Unknown" mode. The flask holds one of HCl, CH3COOH, NaOH, NH3 at a hidden concentration (0.0500-0.1500 mol dm-3, seeded), the student adds titrant, records readings in the shared readings table (CSV and PNG export), finds V(eq), enters c, and is marked within 2 % (the model-recovered value is within 2 % for all four flasks). Hint, Reveal and New unknown are provided; the hidden value is not on screen until Reveal. Partly: no export in the normal Experiment mode.
- AK-41 Fixed (round 2): 0.05 cm3 slider plus +0.1, +0.5, +1.0, +5.0 buttons; diprotic H2CO3 and triprotic H3PO4 titrated with NaOH, with every half-equivalence and equivalence point marked.
- Owner request (buffer regions) extended to polyprotic acids in round 2: each reachable pKa gets its own orange band, where pH is within pKa +/- 1, found on the exact curve (H3PO4 has two bands, H2CO3 two; pKa3 12.32 is lost in the water and has none). The text for polyprotic acids used to say "no buffer region" (a leftover from the weak-titrant note); that is fixed.
- Round 2 also fixed: the "Record reading" button in the practical was white text on a transparent background (the shared button's blue token was not defined there), so it was invisible on the light table.
- Not done: no separate "rough then accurate" scoring; H3PO4 is probably outside the DP syllabus (see questions below).

### Buffer Action
- AK-44, 45, 46, 47, 49, 50, 52 Fixed (round 1).
- AK-48 Partly: pH-vs-net-acid chart (buffer solid, unbuffered dashed, pKa +/- 1 band) added. Still no choice of concentrations or ratio, and no "make a buffer of pH X" task.
- AK-51 Partly: a sticky quick-controls group exists; Chromium confirms it is in the page and the trace gains a point per addition at 390x844, but its appear/disappear on scroll was not exercised.

## Questions for the owner (round 2)
- Is H3PO4 (triprotic) and H2CO3 (diprotic) wanted for DP, or only for HL, or not at all? They are in the dropdown after the monoprotic acids.
- Should the temperature slider in H+/OH- stay (IB gives Kw at 298 K only; the other rows come from chemguide/CRC)?

## Behaviour changes to be aware of

- Titration default is now CH3COOH / NaOH; "Expected curve" and "Features" default on. Reset restores everything.
- A weak titrant added to a strong flask has no pre-equivalence buffer (shown explicitly).
- Buffer additions are 0.2 mmol (small) and 1.0 mmol (medium) of 1.00 mol dm-3 reagent; the old medium was 0.6 mmol.
- Equivalence Point gained concentration choices.
- Existing test assertions were not changed. Deleted modules (old buffer chemistry/particles, neutralization physics, H+/OH- math/components) had no other references (grep-checked).

## Data sources and values to verify against the IB Chemistry data booklet

- pKa(ethanoic acid) 4.76, pKb(ammonia) 4.75, pKa(NH4+) 9.25, Kw = 1.00e-14 at 298 K.
- Indicator ranges: methyl orange 3.1-4.4, bromothymol blue 6.0-7.6, phenolphthalein 8.2-10.0. Check phenolphthalein 8.2-10.0 vs 8.0-10.0 against the booklet.
- H2SO4: HSO4- pKa2 = 1.99, used as exact.
- Ca(OH)2 solubility: about 1.73 g dm-3 at 20 C (0.173 g/100 mL); saturated limewater pH about 12.4 (web sources, not primary). Ideal-Ksp estimate about 0.011 mol dm-3. The simulation allows at most 0.020 mol dm-3 (default 0.010); please confirm.
- CaSO4 Ksp about 4.9e-5 (ideal), used only for a precipitate warning; please confirm.
- Round 2, not verifiable here against the booklet: H2CO3 pKa1 6.35, pKa2 10.33; H3PO4 pKa1 2.16, pKa2 7.21, pKa3 12.32 (Saylor/General Chemistry appendix; CRC gives 2.15, 7.20, 12.35). Kw(T) rows 0-100 degC (chemguide/CRC: 1.14e-15, 2.93e-15, 6.81e-15, 1.47e-14, 2.92e-14, 5.48e-14, 5.13e-13). The unknown-concentration practical uses a 0.100 mol dm-3 titrant and a hidden flask value of 0.0500-0.1500 mol dm-3 (a teaching choice). pH of the ph-to-concentration questions: 1.00-13.00.
- Still unverified from round 1: phenolphthalein 8.2-10.0 (booklet extraction said 8.0-10.0), pKa 4.76 / pKb 4.75, H2SO4 pKa2 1.99, Ca(OH)2 solubility limit 0.020 mol dm-3.

## Verification levels (round 2, 2026-11-17)

- Found at the start of round 2: an earlier pass had already written the pH challenge, temperature slider, unknown practical, polyprotic titration and sticky buffer controls, with model tests but no UI test, no Chromium check and no documentation. All suites passed; the one Chromium check that failed was stale (it expected the pH on the y-axis, but that axis tag is dropped on purpose when it would touch a tick; the value is in the labelled marker). The check now says so.
- Run and passing: `node scripts/test-acidbase.mjs` (19/19), `node scripts/test-acidbase-ui.mjs` (19/19), new `node scripts/test-acidbase-round2-ui.mjs` (6/6, chained into `npm run test:acidbase`), `node scripts/verify-acidbase-sims.mjs` on a real temp build (156 checks, 0 problems: 3 sizes x light/dark plus repro and round-2 scenarios), `npm run build`.
- Bugs found by the new checks: NaN from "Show on scale", invisible Record button, polyprotic "no buffer region" text.
- `npm test` end to end could NOT be shown green in this session. It stopped in `test:auth-signup` (a different sub-test failed on each run, then the process was killed with exit 137) while the machine was loaded by other agents (load average about 8). `test:resource-folders` (jsdom UI part) also failed different sub-tests on different runs. Both are outside this work and look timing-dependent under load; every other suite from the start of the chain to `test:auth-signup`, and `test:access-policy`, `simulation-library`, `curricula-locks`, `resource-actions`, `flexible-editor`, `acidbase`, `collision`, `mole-lab`, passed when run on their own. Rerun `npm test` when the machine is quiet.
- Headless Chromium (SwiftShader) only. Not tested: a real GPU, touch hardware, Firefox, Safari, a screen reader. Downloaded CSV/PNG content was not opened here (the export buttons are enabled after a reading; the shared readings panel has its own tests).
- Not done: no lint-clean guarantee; oxlint warnings remain for the intentional ref-during-render pattern.
