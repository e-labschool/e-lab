# Kinetics fixes: Collision Theory Visualizer and Chocolate Wrapping

Scope: `src/engines/collision-theory-visualizer/` (rebuilt) and `src/engines/chocolate-wrapping-rate/` (reworked). Findings are the IDs from `acids-kinetics.md` (AK-53 to AK-70). Nothing outside these two engines was changed except two lines in `package.json` (new `test:collision`, `verify:kinetics`, and `test:collision` appended to `npm test`).

## IB wording: verified vs reasoned
Verified by WebSearch/WebFetch against ibchem.com (IB25 pages R2.2.x, a third-party transcription of the 2025 guide, not the official PDF):
- R2.2.1 rate = change in concentration of a reactant/product per unit time (guidance: rates from tangents of graphs).
- R2.2.2 "Species react as a result of collisions of sufficient energy and proper orientation."
- R2.2.3 factors: pressure, concentration, surface area, temperature (and catalyst).
- R2.2.4 "Activation energy, Ea, is the minimum energy that colliding particles need for a successful collision leading to a reaction."
- R2.2.5 "Catalysts increase the rate of reaction by providing an alternative reaction pathway with lower Ea."
- Maxwell-Boltzmann guidance: "Construct Maxwell-Boltzmann energy distribution curves to explain the effect of temperature on the probability of successful collisions"; raising T flattens the curve and moves the peak right.
Reasoned, not verified against a source: the exact numbering of the Maxwell-Boltzmann statement, the in-sim wording of captions, the 40 % catalyst Ea reduction (a demo choice), and the Ea range 5-60 kJ/mol (a demo scale, stated in the UI; real Ea of 50-100 kJ/mol would give fractions of 10^-8 or less at room temperature and nothing would be watchable).

## Collision Theory (AK-61 to AK-70)
| ID | Status | What was done |
|---|---|---|
| AK-61 Blocker, wrong % E >= Ea | Fixed | Energies are real units (kJ/mol, kT = RT). The curve is the exact density; the fraction is the exact regularised incomplete gamma Q(3/2, Ea/kT). Tests compare it with independent numerical integration (u = sqrt(E) substitution, 40 000 Simpson points) for 5 temperatures x 8 Ea values to 1e-9, check area = 1 at 7 temperatures, and the Chromium script reads the on-screen figure for 4 (T, Ea) pairs and compares with the exact value. Shaded area, readout, catalyst case (Ea moves left, "without catalyst" fraction shown) and a live measured fraction from the vessel all agree. Tiny fractions are shown in scientific form, never as 0 %. Note: the review's "exact 67.7 %" used a different energy scale; in real units 80 kJ/mol at 700 K is 4.6x10^-6 %. |
| AK-62 No controls | Fixed | Temperature, concentration (particles of each reactant, 5-50), surface area (solid pieces 1/4/9/16/36 for the same mass, shows exposed sites), catalyst (Ea x 0.6), Ea, reactive-site width (orientation), live measured rate, collisions/s, % successful. Typed values for T, n, Ea with explained limits. |
| AK-63 No collision physics | Fixed | Elastic disc collisions and walls, fixed step 1/240 s, uniform grid. Reaction only if energy along the line of centres >= Ea and both reactive sites face each other. Energy and momentum conservation tested (including through reactions and in the solid system). Measured fraction of energetic collisions follows exp(-Ea/RT) within 20 % in a dilute vessel; steric fraction matches (width/360)^2. Magnified view replays the real recorded event. |
| AK-64 Blank magnifier | Fixed | Geometry is clamped to the viewBox (3000 random events including extreme directions tested; Chromium samples the live view ~70 times per size). It ends on a held final frame (the magnifier follows each event for 5.2 s, 3.2 s for a reaction, so the last frame is held about 2.5 s) with paths, outcome, energy bar and orientation flags. |
| AK-65 Cases flip with Ea slider | Fixed | The curated "cases" are gone. Each shown collision carries its own measured E and the Ea in force, with a numeric bar; chips show the latest of each outcome (reaction, too little energy, wrong orientation, both). |
| AK-66 y-label clipped, no ticks/units | Fixed | Numeric ticks on both axes, real units, rotated label sized to the available height, plus Ea (and Ea catalyst) markers and a "Zoom tail" option. |
| AK-67 T1<T2<T3 reordering | Fixed (by removal) | One temperature drives vessel and graph. "Pin curve" keeps a dashed reference curve instead. |
| AK-68 Accessibility | Fixed | Native sliders with labels and value text, keyboard Play/Pause/Step/"Next reaction", collision-type buttons replace click-to-inspect, reduced motion (starts paused at quarter speed, magnifier shows the final frame at once), text alternatives for canvas and graphs, outcome never conveyed by colour only. |
| AK-69 Performance | Fixed | Canvas drawing, typed arrays, no allocation in `step()`, particle cap (200), at most 40 steps per frame, history ring buffer bounded. Software-rendered Chromium: about 19 frames/s at the worst case (100 particles, 2x speed); 10 simulated seconds of 100 particles run in well under a second in Node. |
| AK-70 Content | Fixed | IB-aligned captions (energy AND orientation, frequency vs fraction), Arrhenius factor shown in the detail panel, rate defined, predict-first scenarios. |
Also delivered: predict-first panel with six experiments (temperature, concentration, surface area, catalyst, Ea, orientation); the reveal runs the same engine before and after the change (seeded) and reports measured rates. Seeded option: `?seed=N` in the URL, `seed` prop, and a "Repeatable runs" setting.

## Chocolate Wrapping (AK-53 to AK-60)
| ID | Status | What was done |
|---|---|---|
| AK-53 Input rejects 15/10/100 | Fixed | Any whole number 1-200 is accepted as typed (Enter or leaving the box applies it); 0, negatives, >200, decimals, text and empty are refused with an explanation. Fields lock during a run with a stated reason. Start is blocked with a reason when no pack can be made. |
| AK-54 Dead pulse code | Fixed | `advanceTick` returns `lastEvents`; the station pulse fires (observed in Chromium and jsdom); no pulse movement under reduced motion. |
| AK-55 Rate readout vs graph | Fixed | Two defined rates, both from the same per-second counts: "rate in the last second" (gradient of the last graph segment, drawn in teal) and "average rate so far" (gradient from the origin, dashed amber). Readout at the end no longer contradicts the last bar. A rate-per-second bar graph was added. Tested against the graph data for six supply combinations. |
| AK-56 Model not [A][B] | Partly | Kept as a stated qualitative analogy (35 % of the packs that could still be made each second); wording says so. Not changed to a stochastic bimolecular model. |
| AK-57 Axes | Fixed | Numeric ticks, y label with units, correct y scaling per series, fixed time axis (no rescaling during the run), "FINISHED" button and message. |
| AK-58 Pedagogy | Fixed (round 2) | "Think about it" questions with the reactant-concentration bridge, previous run overlay for comparison, and a predict-first strip whose reveal is computed from the model. |
| AK-59 Accessibility | Fixed | `aria-live` announcement each second, focus rings, speed control (slow default under reduced motion). |
| AK-60 Side effects in updater | Fixed | State is computed outside updaters (ref plus pure setters). |

## Tests added
- `scripts/test-collision-model.mjs` (54 checks, pure logic): MB area and fractions vs numerical integration, energy/momentum conservation, reaction rules, link to MB, Arrhenius and steric checks, determinism, caps, rate metrics, predict scenarios, geometry bounds, Chocolate model. The geometry test found a real overflow in an early version (fixed).
- `scripts/test-collision-ui.mjs` (23 checks, jsdom).
- `scripts/verify-kinetics.mjs` (Chromium, SwiftShader): last runs: 1366x768 light 123 checks, 910x512 and 390x844 light 205 checks, all three sizes dark 283 checks, 0 problems (headless Chromium, software rendering; worst case 100 particles at 2x about 56 frames/s).
- Chained: `npm run test:collision` is the last step of `npm test`.

## Round 2 additions (2026-11-17)
- Reaction (energy) profile, in the "More detail" popover of Collision Theory (`components/ReactionProfile.jsx`): reactants, peak at Ea, products, Ea from the slider, a second green path at the catalysed Ea with the same dH, and a note that a catalyst lowers Ea, not dH. dH is an illustration only: the vessel does not model heat, so Exothermic / Endothermic is a picture toggle, labelled as such, with |dH| capped at Ea/2 so an endothermic profile never has its peak below the products. Ea values are the demonstration scale (5-60 kJ/mol), not real values.
- Chocolate Wrapping AK-58 now Fixed: a "Predict first" strip with two questions (more starting material; later seconds), a three-way prediction, and a reveal computed from the same model (`runToEnd`, `PREDICT_TASKS`), including the verdict and the numbers. The earlier "Think about it" text stays.
- Tests: `scripts/test-collision-model.mjs` 55 checks (new predict-first check), `scripts/test-collision-ui.mjs` 25 checks (two new: profile, predict-first), `scripts/verify-kinetics.mjs` 551 checks, 0 problems in Chromium at 1366x768, 910x512 and 390x844, light and dark (adds: profile in the popover inside the viewport with every label inside its drawing; chocolate reveal and no overflow).
- One jsdom run of `test-collision-ui.mjs` failed a chocolate input check once while the machine was loaded and passed on the next five runs; treat the jsdom UI suites as timing sensitive under load.

## Not done / limits
AK-56 stays a stated qualitative analogy (not a stochastic bimolecular model). The reverse reaction, real heat of reaction, 3-D positions and a real-scale Ea (50-100 kJ/mol) are not modelled; the profile's dH is a picture. Time is simulated time. Real GPU, touch, Safari, Firefox and screen readers were not tested.
Typed number fields are hidden when the controls column is narrow (the slider remains, and is what the verify script uses there). `npm test` end to end was not shown green in round 2 (load-dependent failures in the auth sign-up and resource-folders suites, see acids-fixes.md); `npm run test:collision` passes alone.
