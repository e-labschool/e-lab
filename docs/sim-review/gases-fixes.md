# Gases and states of matter: fixes (rounds 1 and 2)

Companion to `gases-states.md` (findings GS-01..GS-49). Everything below was run in this repository; "verified" names the check.

# Round 2 (supersedes the round-1 status below where they differ)

## What was verified in round 2, and how
| Level | What ran |
| --- | --- |
| Unit and jsdom | ideal-gas 71, gas-laws UI 19, IMF model 106, IMF UI 25, heating curve 31: all pass. Full `npm test` ran every suite in the chain and passed except one: `scripts/test-bonding-ui.mjs` check 9 ("Form molecule ... far-apart atoms", expects a state other than "setup"). It fails when run alone, bonding was not touched and shares no import with these sims, so it is another workstream's in-progress change. Not fixed here. |
| Chromium, headless SwiftShader | `node scripts/verify-gases.mjs`: 222/222 (sections gl, ig, pm, em, hc plus new `r2`; `ONLY=r2` runs only the round-2 checks). `SIMS=imf node scripts/verify-bonding-group.mjs`: 75 checks, 0 problems, including the WebGL-off flat cube. Sizes 1366x768, 910x512, 390x844, light and dark, console errors. |
| Build | `npm run build` succeeded (only the existing chunk-size warning). |
| NOT covered | Real GPU, touch, Safari, Firefox, screen readers, real browser zoom. Persistence (GS-18) is verified in jsdom inside a Learn session provider only, not in the standalone browser route. |

## One gas constant
`R_IB = 8.31` in `src/lib/gas/gasUnits.js` is the only constant. The ideal-gas model uses `R_GAS = R_IB / 101.325` (atm L), so PV/nT reads 8.31 kPa dm3 mol-1 K-1 in both engines (browser check on a recorded reading). The round-1 "known issue" is closed. The van der Waals a and b values are unchanged.

## Round-2 status
| ID | Status | Note |
| --- | --- | --- |
| GS-05 | Fixed | In Real mode the pressure slider ends at the pressure the model can reach (`pReachMax`); badge and live strip agree at the end (browser check, NH3 at 250 K). |
| GS-06 | Partly | CO2 condensation message quotes a literature vapour pressure, not only the vdW value. The table is a secondary source and its unit label was not confirmed; treat as indicative. Other gases keep the generic wording. |
| GS-07 | Fixed | "Outside the ideal-gas regime" banner (for example 0.01 dm3 at 700 K in Ideal mode). |
| GS-08 | Fixed | Four gases (He, N2, CO2, NH3) with a picker; "Compare gases at this temperature" overlay with an explanation by intermolecular forces. |
| GS-10 | Fixed | The Z graph opens automatically the first time Real is chosen. |
| GS-12 | Partly | The 390x844 live strip is not cut by the footer (measured, no footer element found to compare, so only the strip position was checked). |
| GS-16 | Partly | The reachable range is stated on the slider; the track is not greyed. |
| GS-17 | Fixed | Tab switches say which values were carried over. |
| GS-18 | Partly | Session persistence added in a Learn session scope only (see above). |
| GS-19 | Partly | Two-gas Avogadro view with a predict step; it is static, not animated. |
| GS-20 | Fixed | Range inputs expose a label and a value text (browser check). |
| GS-27 | Fixed | Solid macro scene asks for a prediction before revealing; right and wrong predictions are handled; a tally is kept. |
| GS-28 | Fixed | Toolbar buttons at least 34 px tall (measured 36). |
| GS-38 | Not done | No verified second-substance data, so no substance selector. |
| GS-40, GS-41, GS-42 | Fixed | Heating curve: optional "Hide the curve" (predict), even y ticks, optional zoomed energy bar, screen-reader summary. All additive; the default front-page view is unchanged (checked). |
| GS-35 | Not done | Particle Model clock warning, outside the five sims listed for this round. |
| IMF BS-27 | Fixed | Volatility and solubility ranking tasks added alongside boiling point. Solubility values are approximate (secondary source, no temperature stated). |
| IMF BS-30 | Fixed | Flat cube fallback when WebGL is unavailable (checked with WebGL off). |
| IMF BS-28 | Partly | Cluster still fills a small part of the cube (a larger spacing broke an existing spacing test, so it was reverted). |
| IMF BS-33 | Not done | Owner decision. |
| Explore Matter IB tags | Not done | S1.1.x syllabus codes were not added because the syllabus text was not verified. |

## Test assertions changed in round 2, and why
- Ideal gas: independent test constants use R = 8.31/101.325 (one constant); expected Tc about 308.2 K and T_Boyle about 1040.1 K follow; default V is 12.465 dm3 for 0.50 mol, 300 K, 100 kPa; the old "70 %" condensation wording assertion now checks the literature text.
- IMF model: rank sets 9, with distinctness of the displayed rank values.
- `verify-gases.mjs`: accepts "100" or "100.0 kPa"; GS-10 check expects the graph already open.

## Decisions for the owner (round 2)
1. Second substance for the heating curve and a substance selector: needs a verified data source.
2. The CO2 literature vapour-pressure table: confirm source and unit before relying on it.
3. IB S1.1.x tags in Explore Matter: supply the approved syllabus wording.
4. BS-33 as in the bonding notes.

# Round 1 (kept for history; see round 2 above for later status)

## What was verified, and how

| Level | What ran |
| --- | --- |
| Unit tests (Node, jsdom) | `npm test` exit 0 (final run, all suites chained). New/extended: `test:readings` (14), `test:particle-core` (21), `test:ideal-gas` (updated), `test:gas-laws` (56), `test:explore-matter` (5, data), `test:heating-cooling` (31, +3 energy tests). |
| Chromium, headless SwiftShader | `npm run verify:gases` (`scripts/verify-gases.mjs`, temp build + `vite preview` on a free port): 142/142 checks. Sections `gl,ig,pm,em,hc` (`ONLY=gl,ig` filters). Covers 1366x768, 910x512 and 390x844 in light and dark, console errors, reduced motion, focus rings, CSV and PNG download, hostile probes. |
| Build | `npm run build` succeeded. (Earlier in the round, builds failed twice because of other agents' unfinished edits in the buffer and chocolate-wrapping engines; they cleared on retry. One `test:structure` UI timeout in the full chain passed on rerun and was not caused by these changes.) |
| NOT covered | Real GPU, Safari/Firefox, real touch, screen readers, real browser zoom (910x512 is a viewport size), the 3D scene on a device that really loses WebGL context. |

IB facts used (checked on a secondary host, ibchem.com's copy of the 2025 data booklet, the ib.org PDF itself was not opened): R = 8.31 J K-1 mol-1; STP = 273.15 K and 100 kPa, molar volume 22.7 dm3 mol-1; SATP = 298.15 K and 100 kPa. Guidance on changes of state: names including sublimation and deposition "should be covered"; the term "latent heat" is not required (the UI says "energy per gram to change state").

## Finding status

Fixed = done and covered by a test or verify check. Partly = some of it. Not done = not attempted or not changed.

### Ideal Gas Simulation
| ID | Status | Note |
| --- | --- | --- |
| GS-01 | Fixed | kPa/dm3 by default, atm/L switch (Settings > Units), typed values, R shown as 8.31. The model keeps atm/L internally (vdW constants), so R is 8.3145 inside the engine and 8.31 in the Gas Laws engine: a known, tiny inconsistency. |
| GS-02 | Fixed | Opens at 0.50 mol, 300 K, 100 kPa (near ideal, Z about 0.996). |
| GS-03 | Fixed | Linear piston scale with labelled ticks (0-25 / 0-100 dm3), log kept as an option. The piston has a 14 % bottom stop; below it the picture says "piston at its stop". |
| GS-04 | Fixed | "Pressure from collisions" gauge (piston hits per s; momentum handed over compared with the kinetic value). Noisy by roughly 10 %, 2D, about 50 particles; the tooltip says so. The slider pressure still comes from the model. |
| GS-05 | Not done | Not specifically re-examined. |
| GS-06 | Partly | The vdW saturation limit is labelled qualitative (with the CO2 error quoted); not re-based on real vapour pressure data. |
| GS-07 | Not done | Extreme V/T combinations are unchanged. |
| GS-08 | Not done | Still CO2 only. |
| GS-09 | Fixed | Readings table, plot of the student's points against theory, best fit, CSV and transparent PNG export. |
| GS-10 | Not done | The Z-vs-P graph is still off by default. |
| GS-11 | Partly | Comments in the touched files were updated; not audited line by line. |
| GS-12 | Partly | No horizontal overflow or clipping at 390x844 (checked, light and dark). The specific strip/footer overlap was not measured separately. |

### Gas Laws Explorer
| ID | Status | Note |
| --- | --- | --- |
| GS-13 | Fixed | The limit note now appears only at a real end and names the calculated variable and its bound. A slider whose real end is not on a step shows the note at its last notch. Probe: at the end of the V-T temperature slider the note reads "...the volume would go above 50.0 dm3". |
| GS-14 | Fixed | 1 K steps plus typed input; 273, 298 and 273.15 K set exactly (probe passes). Out-of-range typed values give an explicit message, never a silent clamp. |
| GS-15 | Fixed | Record reading, table with units, student's points plotted against theory (Boyle, Charles, Gay-Lussac, Avogadro, combined). Probe: P against 1/V is straight, gradient equals nRT, R-squared = 1.0000. |
| GS-16 | Partly | Ranges unchanged; limits are now explained where they bite. |
| GS-17 | Not done | Tabs still carry state across modes. |
| GS-18 | Not done | No persistence across reload. |
| GS-19 | Partly | Combined PV = nRT mode with a "Calculate" picker added. No two-gas Avogadro comparison. |
| GS-20 | Partly | Typed fields have labels; the range input's accessible name was not re-measured. |

### Explore Matter and States
| ID | Status | Note |
| --- | --- | --- |
| GS-21 | Fixed | Solid and liquid are drawn close-packed (touching hard spheres). The liquid on a small particle count spreads along the floor with a few gaps: acceptable, but not a perfect film. |
| GS-22 | Fixed | Canvas sized by ResizeObserver and drawn at the device pixel ratio (checked at DPR 2: backing/css width above 1.9). |
| GS-23 | Fixed | The mass and volume tests offer "Pick a sample for me" / "Choose from the tray"; a non-matter sample gets an explanation. "Reveal next" is now "Next". |
| GS-24 | Fixed | Masses are density x volume (typical room-temperature densities), tested. Salt became a rock-salt block (ruler method) because salt dissolves. Gas masses are tiny and ordered CO2 > O2 > air. Sample "Salt" is now labelled "Rock salt". |
| GS-25 | Fixed | The cylinder is a labelled 100 mL scale and the level is the volume in mL; the gas syringe reads in mL. |
| GS-26 | Fixed | Temperature readout; speed is proportional to the square root of T; a note says the scale is relative. |
| GS-27 | Not done | Still mostly click-to-reveal (no predict step). |
| GS-28 | Partly | Reduced motion implemented (discrete snapshots) and the canvases have descriptive names. Toolbar button size unchanged. |
| GS-29 | Fixed | One shared core (`src/lib/particles/particleCore.js`) drives the Particle Model (3D) and Explore Matter (2D). |

### Particle Model Visualizer
| ID | Status | Note |
| --- | --- | --- |
| GS-30 | Fixed | Temperature slider (K and degrees C) with a kinetic-energy readout; probe: mean KE rises about 4x from 120 K to 480 K in solid, liquid and gas. |
| GS-31 | Fixed | The same 96 particles in every state (checked). |
| GS-32 | Fixed | Gas particles collide with each other and the walls (counted); Maxwell-Boltzmann speeds from Gaussian velocity components. |
| GS-33 | Fixed | The solid block sits on the floor (checked). |
| GS-34 | Fixed | Canvas has a role and a changing description, rotate/tilt/zoom buttons, reduced motion; the existing non-WebGL fallback description is kept (a lost context was not simulated). |
| GS-35 | Not done | The THREE.Clock deprecation warning was not looked at. |
| GS-36 | Fixed | Property wording corrected. |

### Phase Change and Heating Curve
| ID | Status | Note |
| --- | --- | --- |
| GS-37 | Fixed | The layout no longer uses a fixed height: at 910x512 the canvas and graph stay inside their panels with no horizontal scroll (checked in light and dark). In the standalone frame at that height the content scrolls inside the card. |
| GS-38 | Partly | Optional real-energy mode (tick "Time axis to scale"): mass and power inputs, worked Q = m c dT or energy-per-gram line, t = Q/P. Water only, no substance choice. |
| GS-39 | Partly | The square-root schematic stays the default but the axis now says "schematic: plateau lengths shortened, not to scale" and the text says why; the to-scale axis shows real seconds. |
| GS-40 | Partly | Numeric time ticks in the to-scale mode only. Uneven y ticks unchanged. |
| GS-41, GS-42 | Not done | |
| Sublimation | Done as names only | IB asks that sublimation and deposition be named. A "Names of the changes of state" note lists all six. No sublimation curve: water at 1 atm does not sublime. |

### Mixture Separation Explorer (hidden, not rebuilt)
GS-43..GS-49: not done by design. The only change is that it is now a "planned" entry (see below).

Rebuild plan (short): (1) replace the placeholder PNGs with SVG apparatus; (2) derive the info panel and result from the mixture and method (fixes GS-44) and show a wrong-method outcome; (3) fix the negative `rx` console flood (GS-45); (4) cover the six IB methods named in S1.1 (GS-46); (5) make it student-driven with step and speed control, one Reset (GS-47/48); (6) alt text for end states (GS-49). Then set it live in the catalogue again.

## Changes outside the six engines (shared files)
- `src/data/simulationCatalogue.js`: removed the live `mixture-separation-explorer` entry and its name from `COVERED_BY_LIVE`. It is now a planned/coming-soon entry derived from `resources-registry.js`. `simulationEngineComponents.js` is untouched, so lessons that embed it still render (its frame has no New Tab target).
- `package.json`: added `test:readings`, `test:particle-core`, `test:explore-matter`, `verify:gases`; the first three are chained into `npm test`.
- New shared code: `src/lib/gas/gasUnits.js`, `src/lib/particles/particleCore.js`, `src/components/interactive-shell/readings/*` (Readings table/plot/export), `src/components/interactive-shell/NumberField.jsx`, `scripts/harness/preview.mjs`.

## Test assertions changed, and why
- Gas laws: PV = nRT residual is now relative (kPa magnitudes); UI test counts five tabs, kPa defaults and the new temperature sweep maximum. Real behaviour changes.
- Ideal gas: tests that assumed the 30 atm opening state or the log piston now use an explicit old-default constant or set the log scale; the default-state test asserts the new near-ideal 100 kPa opening. Real behaviour changes (GS-02, GS-03).
- `test-dashboard-layout.mjs`: the source-contract pattern now expects `formatValue(k, state[k], units)` (the function gained a units argument).
- `test-simulation-library.mjs`, `test-simulation-shell.mjs`, `test-curricula-and-locks.mjs`: catalogue 25 to 24 live entries; Mixture Separation allowed in the component map but not the student registry, and no New Tab target asserted for it; live count minimum 25 to 24. All follow from hiding Mixture Separation.

## Known issues
- Ideal gas engine R is 8.3145 internally (shown as 8.31); the Gas Laws engine uses exactly 8.31.
- Collision-pressure gauge flickers about 10 % (2D, few particles).
- The 14 % piston stop means very small volumes are not drawn in proportion (labelled on screen).
- The Explore Matter liquid shows a few gaps; the particle count is 24 per state.
- Heating-curve standalone view at 910x512 scrolls inside its card.
- Not covered: real GPU, other browsers, screen readers, a real WebGL context loss.

## Decisions for the owner
1. Default units kPa and dm3 (IB), with atm/L one click away. Keep?
2. Sublimation: names only, or a second substance curve (for example iodine or carbon dioxide) in a later round?
3. Heating curve: keep the schematic axis as default (clear shape) or default to the to-scale axis with real seconds?
4. Rebuild Mixture Separation next round, or leave it planned?
5. STP: the sim uses the IB value (100 kPa, 22.7 dm3); older papers use 1 atm and 22.4 dm3. The older value is not offered.
