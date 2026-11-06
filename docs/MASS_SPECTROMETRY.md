# Mass Spectrometry workspace (MS tab of the Spectroscopy Simulation Lab)

Implements `docs/MS_REDESIGN_SPEC.md`. SIX stages over ONE persistent workspace (the earlier version had thirteen separate pages). The instrument is never replaced between stages: only the camera, the emphasis, the clock and the panel change. A compact overview of the whole instrument is always visible; the active parts are highlighted and the part holding the tracked molecule is marked.

| Stage | Content | Main interaction |
|---|---|---|
| 1 Instrument and Sample | a population of 8 to 15 identical molecules (propanone by default; butan-2-one, ethanol, methane), each animated independently, in the reservoir and through the inlet | Start sample, New arrangement, number of molecules, click a molecule (inspect and Track This Molecule) |
| 2 Ionization | electron beam; M + e⁻ → M⁺• + 2e⁻; some molecules stay neutral and are never accelerated or deflected; optional 1+ / 2+ note; particle key | Ionize |
| 3 Fragmentation (the showpiece) | copies of the same molecular ion with different outcomes (survive, 1 or 2 step cleavage); animated bond cleavage; charged vs neutral products; selected pathway: highlighted atoms and bonds, formula, charge, m/z, position on the spectrum, slow-motion replay; why a molecular ion can be weak or absent | pathway chips, Replay fragmentation, click a molecule or a peak mark |
| 4 Acceleration and Separation | Eₖ = zeV; neutrals do not follow; m/z = mass / z with a 1+ vs 2+ comparison; magnetic sector (default) r = (1/B)√(2mV/ze) or TOF t = L√(m/(2zeV)); never both at once | analyser chips, V and B sliders, "Tune B to m/z", compare 1+ and 2+ |
| 5 Detection and Spectrum | the analyser feeds the detector; the spectrum grows: the sector scans 3 times, TOF adds 6 pulses; molecular ion vs base peak vs M+1; an illustrative ion counter | analyser chips, click a peak (formula candidates, pathway replay) |
| 6 Interpretation | interactive spectrum, deductions, hints and a worked interpretation; optional activities: Unknown challenge (6 rounds), halogen isotope patterns, Isotopes and Aᵣ (revision) | click peaks, record deductions, activity chips |

The earlier stage 13 (MS / IR / NMR comparison) was removed: the combined investigation belongs to the Structure Investigation tab and is not duplicated here (`data/evidence.js` and its tests are kept as data).

Transport (`MsWorkbench.jsx`, `MsPlayback`): Play, Pause, Step back, Step forward, Replay stage, Reset (whole experiment), Speed (0.25× labelled slow motion, 0.5×, 1×, 2×), Replay fragmentation (stage 3 only), Show / Hide charges and Show / Hide ion labels (from stage 2). Step moves between the beats of the stage (0, ¼, ½, ¾, end) and then into the next / previous stage, and pauses. Fullscreen and Open in New Tab come from the shared `InteractiveFrame`.

## Architecture (`src/engines/spectroscopy-studio/ms/`)

Pure modules (no React; tested by `scripts/test-ms-model.mjs`) are separate from rendering (`scripts/test-ms-ui.mjs` in jsdom, `scripts/verify-ms-spectrometry.mjs` in Chromium).

- `physics/*`: constants, kinematics, sector geometry, TOF, isotopes, detection (old methane build-up, kept), challenge (rounds = all six spectra). Unchanged apart from the additions below.
- `data/spectra.js`: SIX representative spectra: methane, ethanol, propanone, butan-2-one (new), chloromethane, bromomethane. `data/molecules.js`: the simulation molecules (geometry, pathway records with bond cleavage, charged and neutral formula and mass, colour and shape per ion).
- `model/experiment.js`: the deterministic experiment controller. `buildExperiment({molId, seed, n})` is a pure function (cached, mulberry32 seed): the same molecule + seed + n always gives the same experiment. Outcomes are allocated from the primary peaks of the representative spectrum with largest-remainder rounding, so the small population is consistent with the spectrum (about 75 % of molecules ionise; at least one molecular ion survives; fragments are ranked by intensity). Also the detection plan (3 sweeps / 6 pulses), the build-up and the illustrative counts (10 ions per 1 %).
- `model/analyser.js`: the sector with unit resolution and TOF. `model/journey.js`: the pure time model of the animation (molecule frames, bond cleavage, flight along the sector arc or the tube). `model/ions.js`: candidate formulas at a nominal m/z (never presented as unique).
- `state/msState.js` (versioned `STATE_VERSION = 2`, session key `studio-ms-v1`): stage, molecule, seed, n, started / fired, analyser, V, B, tracking, selection, comparison, show-charges / labels, activity, deductions and the unknown-challenge state. Runtime-only fields (seek, replay, live clock) are not persisted. An old 13-stage payload is migrated (`OLD_STAGE_MAP`: 1,2→1; 3→2; 4→3; 5,6,7→4; 8,9→5; 10..13→6 with the old stage 10 / 11 / 12 opening the matching activity); corrupt values fall back to defaults.
- `state/useJourneyClock.js`: one rAF clock per workspace, honouring the shared Play / Pause / speed / reset, reduced motion (jumps to the end state) and seek requests from Step.
- `scene/*`, `components/*`, `stages/*`, `activities/*`, `MsWorkbench.jsx`, `ms.css`: the world and camera (container-driven: a `ResizeObserver` measures the scene and a camera rectangle is fitted to it, no CSS scaling), the instrument, the molecule glyphs, the overview, the particle key, the pathway detail and the six stage modules (`Strip`, `Panel`, `TEACHER`).

Ion identity (formula, m/z, colour) is the same in the molecular view, the instrument and the spectrum (`ionCatalogue`). Colour is never the only cue: neutral molecule = grey "0" badge and no ring; molecular ion = solid ring and "+•"; charged fragment = ring with its own shape (square, hexagon, diamond, triangle, pentagon, cross; the same shape is drawn above its peak) and "+"; neutral fragment = dashed ring and "0".

## Formulas

| Quantity | Formula | Where |
|---|---|---|
| m/z | (mass of ion in u) / z, a number | 2, 4 |
| kinetic energy | Eₖ = zeV | 4 |
| speed | v = √(2zeV/m) | 4 |
| radius in B | r = mv/(zeB) = (1/B)√(2(m/z)V/e) | 4 |
| field for a given m/z | B = √(2(m/z)V/e)/r_det | 4 (Tune B) |
| flight time | t = L√(m/(2zeV)), L = 1 m | 4, 5 |
| Aᵣ | Σ(A·p)/Σp (mass numbers) and Σ(m·p)/Σp (isotopic masses) | 6 (revision activity) |
| isotope cluster | ∏ (Σ pᵢ x^Aᵢ)^n | 6 (patterns activity) |

Check values (hand-calculated, in `test-ms-model.mjs`): v(16, 2000 V) = 155 310 m/s; r(16, 2000 V, 0.258 T) = 0.09983 m; t(16) = 6.439 µs, t(31) = 8.962 µs, t(43) = 10.555 µs, t(58) = 12.259 µs.

## Physics issue found and fixed: sector resolution

The 180° sector accepts any ion whose path radius is within ±1.2 mm of 0.10 m (`SECTOR.SLIT`). Because r ∝ √(m/z), a radius window of ±1.2 % is a window of ±2.4 % in m/z: wider than ±0.5 above m/z about 21 and wider than ±1 above about m/z 42, so neighbouring integer m/z values would reach the detector together (the test `sector unit resolution` shows that at B tuned to m/z 43 the old slit also admitted m/z 44, i.e. two neighbouring peaks recorded at once). The simulation now uses a unit-resolution transmission (`UNIT_RESOLUTION_HALF_WIDTH = 0.5` m/z) for detection and the Stage 4 / 5 animations; the circular paths of the old geometry are unchanged. This models a magnet with a narrow slit (resolving power of about one mass unit), as in a teaching instrument. The magnet range (B 0.1 to 0.8 T) limits which m/z can be focused at a given V; where a peak is out of range, stage 5 says so instead of drawing it.

## Data provenance

The network was not available while building, so no table was downloaded or re-checked; everything is entered from the author's knowledge and labelled that way.

| Data | Value | Source / status |
|---|---|---|
| e, u, m_e | 1.602176634×10⁻¹⁹ C, 1.66053906892×10⁻²⁷ kg, 9.1093837139×10⁻³¹ kg | 2019 SI exact, CODATA 2022 |
| isotopic masses, natural abundances | e.g. ³⁵Cl 34.968852682, ³⁷Cl 36.965902602 u; Cl 75.76 / 24.24, Br 50.69 / 49.31 % | AME2020 / IUPAC 2016 as tabulated by NIST; entered from memory |
| teaching abundances | Cl 75 : 25, Br 50 : 50 | the lesson's simplified model; the toggles in the activities show both |
| relative intensities | methane 12:3, 13:8, 14:16, 15:85, 16:100; ethanol 27:23, 29:24, 31:100, 43:12, 45:51, 46:22; propanone 15:30, 43:100, 58:62; **butan-2-one 15:10, 27:10, 29:25, 43:100, 57:7, 72:25**; chloromethane 15:65, 35:7, 49:12, 50:100; bromomethane 15:78, 79:8, 93:25, 94:100 | REPRESENTATIVE / IDEALISED, rounded typical values, NOT experimental. The m/z values and fragment identities of butan-2-one (72, 57, 43, 29, 27, 15) are standard; its intensities, especially 57 (7), 29 (25), 72 (25), 27 and 15 (10), are the least certain |
| computed peaks | halogen partners, M+1 satellites | computed from the isotope data |
| illustrative counts | 10 ions per 1 % of the base peak, a population of 8 to 15 molecules, about 75 % ionised | teaching numbers; the screen says they do not reproduce experimental abundances |
| ±30 % | the stated tolerance on representative intensities | unchanged |
| instrument geometry | sector 0.40 × 0.20 m, detector radius 0.10 m, L = 1 m, V 500 to 5000 V, B 0.1 to 0.8 T | invented for clarity, labelled "illustrative instrument model" |

## Limits

- Sector: ideal slits and a uniform field, ions start from one point, no energy or angular spread, no fringe fields; real instruments use 60° / 90° sectors, double focusing, etc. TOF: ideal field-free flight, no turn-around time or reflectron; the tube is not to scale.
- The animated population is a teaching representation. Counts and bar heights in stage 5 are illustrative.
- Fragmentation pathways are chosen from the main peaks; bond lengths and positions in the animation are schematic (ball-and-stick geometry is idealised).
- Electron ionisation only; other methods are mentioned, not simulated. m/z values are nominal integers.
- Candidate formulas for a peak are possibilities at that nominal mass (parity and ring/double-bond count checked), never a unique answer.

## Verification levels

1. `node scripts/test-ms-model.mjs`: physics (kinematics, sector, TOF), isotopes, the six spectra, molecule / pathway bookkeeping (mass conservation), ion catalogue uniqueness, determinism of the experiment, outcome constraints, detection build-up, the unit-resolution rule, journey timing, candidate ions, state sanitising / migration / persistence round-trip, challenge flow (six rounds).
2. `node scripts/test-ms-ui.mjs` (jsdom, no layout or WebGL): six-stage stepper, persistent workspace element, stage controls, population limits, Ionize, pathway detail, analyser exclusivity, peak info, the three activities, reduced motion, no `console.error`.
3. `node scripts/verify-ms-spectrometry.mjs` (headless Chromium, SwiftShader): the five reference viewports in the new-tab and fullscreen modes (the in-page embedded route shows only the description for an in-development resource here, so it could not be exercised); overflow, clipped / covered controls, real interactions, Pause really freezing the clock, the spectrum growing, console errors. `scripts/check-plot-alignment.mjs` compares drawn bar heights with the numbers (`data-rel`).

NOT verified: a real GPU, real touch hardware, other browsers, assistive technology, the dark / light theme on real devices, and the intensities of the spectra against measured data.
