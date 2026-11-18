# Mole Lab status (phase 1)

Legend: **IT** implemented and tested; **I** implemented, not (or only partly) tested; **ND** not done.
Verification level: node unit tests, jsdom (no WebGL, so the 2D fallback path), headless Chromium with SwiftShader (software GL). NOT verified on a real GPU, real touch hardware, Safari, Firefox or a screen reader.

| Part | Requirement | Status | Evidence / note |
|---|---|---|---|
| A1-A2 | Definition, permanent counting-analogy panel | IT | engine test; jsdom UI test; always visible (collapsed on small screens to one line) |
| A3 | Molecular/ionic structures, formula composition | IT | engine tests (Part J composition cases) |
| A4 | Counting is not reacting | IT | `countingPackets` never gives H2/O2; tested |
| A5 | One molar-mass source, explicit policy | IT | engine tests; Mg = 24.0 labelled |
| A6 | Conservation and numerical integrity | IT | integer quanta; 500x40 random sequences in store test; Chromium probes |
| B1-B3 | Standard bag, fill by mole fraction, representative particles | IT (logic) / I (look) | scene tests for slots/bag/layout; look checked by screenshots only |
| B4-B5 | Manipulation and transfer state machine, button alternatives | IT (machine) / I (3D drag) | store test; Chromium hostile probes use mouse and the debug hook; touch not tested on a device |
| C | Shell: tabs, 3D workspace, guided/free, reference, calculations, fullscreen, responsive, light/dark | IT / I | jsdom + Chromium at 1366x768, 910x512, 390x844, both themes: no overflow, canvas present |
| D Stage 1 | Explore the Mole (inspect, count, separate, recombine) | IT / I | engine+store+Chromium |
| D Stage 2 | Mass <-> Moles (validation, slider, quick amounts, prediction, apply) | IT / I | engine+store+jsdom |
| D Stage 3 | Concentration Laboratory (Exp 1-5, volumetric flask, dilution, two-beaker comparison, same-scale ion viewer, NaOH + NaCl) | IT / I | `test:mole-lab-stage3` (engine incl. 2000-step random conservation property, scene, jsdom UI); `verify:mole-lab-stage3` (Chromium SwiftShader: 3 sizes x 2 themes, hostile probes with conservation, no-WebGL fallback). Not tested: real GPU, touch device, Safari, Firefox, screen reader. Compare mode (Exp 3, 5) uses flasks only (no hands-on dissolving there). |
| D Stage 4 | Gas Volume Laboratory: moving-particle chamber with free piston, RTP (24 dm3 mol-1, labelled "at RTP") and advanced PV = nRT, T/P inputs, six gases, compare table, predict + apply | IT (engine, jsdom) / I (3D, Chromium) | `test-mole-lab-stage456-engine.mjs`, `-ui.mjs`; `verify-mole-lab-stage456.mjs` (real mouse drags, conservation). Advanced mode states honestly that PV = nRT at 298 K and 1.00e5 Pa gives about 24.8 dm3 mol-1 |
| D Stage 5 | Chemical Equations: four reactions with state symbols, scaled repeats (x0.5, x1, x2), wrong ratio = partial reaction, atom-conserving rearrangement animation (replay, slow motion, skip), sodium + water with aqueous NaOH as ions and a labelled conceptual product packet | IT (engine, jsdom) / I (3D look) | same suites; 400 random hostile sequences per stage keep atoms and charge exact |
| D Stage 6 | Limiting Reagents: independent amounts in mol or g, predict-then-run, extent method, ties, zero, fractional, theoretical mass, optional percentage yield (needs a supplied actual yield) | IT (engine, jsdom) / I (3D look) | same suites |
| E | Shared engine (ten modules, store, invariants) | IT | 90 + 47 tests |
| F | Visual and interaction quality | I | screenshots reviewed; no real GPU |
| G | Educational design (predict, interact, observe, explain, apply) | I | Stages 1-2 |
| H | Performance and reliability | I | adaptive detail, WebGL-lost fallback, disposal; measured fps only under SwiftShader (about 3 fps, not representative) |
| I | Integration (catalogue, registry, free tier, S1.4/S1.5) | IT | `test-mole-lab-ui.mjs`, `test-simulation-library.mjs` |
| J | Mandatory test cases | IT for engine (packets, formula, mass, concentration, dilution, gas, limiting) and interaction machine; UI integration cases for Stages 3-6 ND |
| K | Definition of complete | **I** | Stages 4-6 built; no real GPU, touch hardware, Safari, Firefox or screen reader checks |

## Known issues
* Owner decisions applied: the DEFAULT (and only displayed) molar-mass policy is `booklet` (IB DP Chemistry data booklet 2 d.p.: H 1.01, C 12.01, N 14.01, O 16.00, Na 22.99, Mg 24.31, Cl 35.45; NaOH 40.00, H2O 18.02). The spec's Mg = 24.0 example is intentionally replaced by this decision; `teaching` (Mg 24.0) and `precise` remain only as explicit arguments used by tests. NOT verified against the printed booklet by me: web search returned no table text, so the values come from the repo's shared Ar table (`src/lib/atomic/abundance.js`) and the owner's list; please check once against the booklet.
* Stage 2 quick buttons are amount-based and show their mass (0.25 mol 6.08 g, 0.50 mol 12.16 g, 1.00 mol 24.31 g ...); the default start is 0.50 mol.
* The Mole Lab is ONE simulation with no syllabus codes (catalogue `syllabus: []`, no S1.x text in the UI).
* Stage 5/6 NaOH(aq) product PACKET is drawn as a regular particle lattice (labelled "conceptual mole summary"); a jittered aqueous drawing mode is not built.
* Stage 4-6 3D look was reviewed only on SwiftShader screenshots (about 4 fps); the animation timing on a real GPU is unknown. The six-tab strip scrolls horizontally at narrow widths and can overlap the title block (Phase 1 shell, not changed).
* At 910x512 the 3D viewport is about 230 px tall and the controls scroll; usable but tight.
* Under SwiftShader the sim runs at about 3 fps and drops to low detail automatically; real-GPU performance is unmeasured.
* The Chromium conservation probes call `ix.pour` through the debug hook; a pour is only accepted when the source is open, so some rapid-pour calls are rejected (by design), which means those probes check that nothing is lost rather than that every pour succeeds.
* oxlint shows warnings (no errors) in Mole Lab files, mainly react-compiler "refs during render" in the interaction hook and bench; not behaviour bugs, not yet refactored.
* THREE.Clock deprecation warning comes from the dependency.

## Unrelated failures (outside Mole Lab, not touched)
* `npm test` stops at `test:bonding` (test-bonding-ui.mjs, H2 and SF6 cases) so later suites in the chain, including `test:mole-lab`, are not reached by `npm test`; vsepr/hybridisation were not run. All suites after bonding (except vsepr and hybridisation) were run individually.
* `test:simulation-library` has one failing case, "premium OFF ... no 'Premium' text": the page text matches /plans?/ in the Mixture Separation Explorer description ("plan a multi-step separation"), unrelated to Mole Lab. The key-count assertion was updated 25 to 26 for the new registration.

## Decisions for the owner
1. DECIDED: IB data booklet values are the default (Mg 24.31); the 24.0 teaching policy is test-only.
2. The 500 mol cap (`MAX_AMOUNT_MOL`) and the Stage 1 cap of 10 mol.
3. Grouping more than 6 packets into a stack on the bench.
4. DECIDED: 24 dm3 mol-1 at RTP; advanced PV = nRT is labelled as slightly different.
5. Balance pan sizing (fixed for 1 mol bags; wider with more packets).

## Redesign status (latest)

Implemented: shared premium packet component, all six stages redesigned per the redesign spec, simplified UI (title, six tabs, one large experiment, compact controls, one explanation line plus Details), ten substances / solids / gases / reactions.

Verification levels:
- Automated: `npm run test:mole-lab` passes (engine 91, store 47, packets 12, UI 7, stage3 engine 33, stage456 engine 46); `npm test` and `npm run build` pass.
- Visual, headless Chromium with SwiftShader (software GL) only: all six stages at 1366x768 compared with ref-02..08; 910x512 and 390x844 spot-checked (Stage 5 at 910, Stage 4 at 390) after fixing a grid min-content overflow at 390 wide.
- Not verified: real GPU performance and frame rate, touch, Safari, Firefox, screen readers, dark theme at every size.

Known limits: auto quality is "low" under software GL, so bench reflections (medium/high only) were checked with the detail setting forced to medium; the lab background is a painted blurred canvas, not a photo; the volumetric flask in Stage 3 is a decorative prop; bag shape is still somewhat boxy compared with the references; hydrogen atoms look slightly blown out; reflections are noisy under software GL.

## Second polish pass (latest)

Done: Stage 4 piston with live volume readout; Stage 3 water-first pour, diffusion, dilution and side-panel worked calculation; ions drawn from engine templates (OH- = O + bonded H); empty product packets filled by the reaction (Stages 5/6); Stage 6 keeps reactants on the board and empties consumed packets, remaining packet marked; stacked board on narrow screens; camera clamp raised; Stage 3 flask removed; `STAGE6_EXAMPLES` covers all ten reactions.

Verification: `npm run test:mole-lab`, `npm test` and `npm run build` pass; the packet test now checks every substance's drawn atoms/ions against its formula and charge. Screenshots (software GL, SwiftShader only) were taken with the simulation clock stepped (`__ML_DT_MAX`) at several times for the Stage 3 pour/diffusion/dilution, the Stage 4 release and the Stage 6 run; the animations could not be watched at normal speed here (about 1 fps). Phone (390x844), small laptop (910x512) and 1366x768, light and dark, were screenshotted for Stages 3-6 final states. Not verified: real GPU performance, touch, Safari, Firefox, screen readers.

Known limits: Stage 3 diffusion is a visual random walk of representative ions (about 400 per species per mole), not a simulation of real diffusion rates; the Stage 6 packet amount labels switch when the reaction starts rather than counting down with the fill; the lab background is a painted canvas.
