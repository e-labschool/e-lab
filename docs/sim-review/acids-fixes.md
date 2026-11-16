# Acid-base simulations: fixes (AK-01..AK-52)

Scope: titration-ph-curve, equivalence-point, buffer-action-visualizer, ph-calculator-visualizer, h-oh-balance, neutralization-particle-visualizer.
Kinetics findings (AK-53 onward) are out of scope. Source review: docs/sim-review/acids-kinetics.md.

## Shared module and tests

- `src/lib/acidbase/` (pure, no React): `constants.js`, `solver.js` (exact charge-balance solver, bisection in log10[H+]), `titration.js`, `format.js`, `labels.js`, `indicators.js`, `addition.js`, `acidbase-ui.css`.
- `scripts/test-acidbase.mjs`: 12 model tests. It compares the exact solver with an independent solver (Kb/[OH-] formulation, regula falsi) on 8 acid/base pairs x 9 concentration pairs x 14 volumes, and prints the numbers.
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

Legend: Fixed / Partly / Not done.

### pH Calculator
- AK-01 Fixed. AK-02 Fixed. AK-03 Fixed (out-of-range input is explained, never silently clamped). AK-04 Fixed. AK-06 Fixed (keyboard slider, marker no longer strikes through numbers).
- AK-05 Partly: the scientific-notation column is hidden below 800 px.
- AK-07 Not done: challenge strip (scope).

### H+ / OH- Balance
- AK-10, 11, 12, 13, 14, 16 Fixed: rebuilt on real moles and volumes (100 cm3 water, 0.05 cm3 drops, 0.01/0.1/1.0 mol dm-3), equal-mole drops, labelled log axis, caption updates, limit message.
- AK-15 Partly: Kw, pOH and [H+][OH-] are shown; no temperature slider (298 K only).
- AK-17 Partly.

### Neutralization
- AK-18, 19, 20, 21, 23, 25 Fixed: particles stay inside the liquid, variable amounts, limiting reagent table, full and net ionic equations.
- AK-22 Partly: pairing is still an illustrative schedule (labelled as such).
- AK-24 Partly: reduced motion ends instantly; the loop stops when finished.

### Equivalence Point
- AK-26, 27, 28, 29 Fixed: "approaching" no longer shown after equivalence, concentrations shown, controls fit 1366x768 without scrolling, Ca(OH)2 validity check.
- AK-30, 31, 32 Partly: pH mini trace, 0.5 cm3 step and aria-live added; no 0.1 cm3 drop; artwork unchanged apart from scaling.

### Titration
- AK-33, 34, 35, 36, 37, 39, 40, 42, 43 Fixed.
- AK-38 Partly: a "Predict first" hint only; no unknown-concentration challenge and no CSV/PNG export.
- AK-41 Partly: +0.1 cm3 button always available; no continuous slider; no polyprotic acids.

### Buffer Action
- AK-44, 45, 46, 47, 49, 50, 52 Fixed: no stray H+, unbuffered beaker explicit, full-solver pH after depletion, live [A-]/[HA] with pKa +/- 1 bar, additions capped at 20, particle count capped.
- AK-48 Partly: pH-vs-additions chart only.
- AK-51 Partly: no sticky controls.

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

## Verification levels

- Run: `node scripts/test-acidbase.mjs` (12/12), `node scripts/test-acidbase-ui.mjs` (19/19), `node scripts/verify-acidbase-sims.mjs` against a real temp build (131 checks, 0 problems), `npm run build` (passes).
- `npm test`: stopped at the gases suite `test:gas-laws-ui` (another agent's area, not touched). The acid-base and collision suites were run separately and passed. Rerun `npm test` once the gases work settles.
- Headless Chromium only: no real GPU, touch hardware, Firefox/Safari or screen reader.
- Not done: no lint-clean guarantee; oxlint warnings remain for the intentional ref-during-render pattern in Buffer and Neutralization.
