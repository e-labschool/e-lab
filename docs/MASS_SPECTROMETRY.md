# Mass Spectrometry workspace (MS tab of the Spectroscopy Simulation Lab)

Thirteen sequential stages in ONE tab, following `docs/MS_SPEC.md`: compact stepper with Previous / Next and direct jump, one animation area per stage, only the controls the stage needs, short text, an optional "Teacher: deeper explanation", Replay, Play / Pause and speed. It re-uses the IR / NMR shell (stepper, frame, transport bar, `.sim-btn` tokens, dark-blue theme, container-driven layout, reduced motion) and does not change their behaviour.

| Stage | Content | Main interaction |
|---|---|---|
| 1 Introduction | rotating 3D methane (WebGL, SVG fallback), "How can we determine the masses of atoms and molecules?", m/z = mass of ion (in u) / charge number, the five-step chain | Begin |
| 2 Sample | labelled instrument ("illustrative instrument model"), methane flowing through the inlet into the ionisation chamber; EI needs a gas, other methods need not vaporise the sample | Introduce Sample |
| 3 Ionisation | electron beam, neutral CH₄, ejected electron(s), orange radical cation CH₄⁺•; CH₄ + e⁻ → CH₄⁺• + 2e⁻; no proton attachment | Ionize, Replay |
| 4 Fragments | CH₄⁺• → CH₃⁺ + H•, CH₄⁺• → CH₂⁺• + H₂, then CH₃⁺ → CH⁺ + H₂ and CH⁺ → C⁺ + H•; charged vs neutral products; only charged ions continue; unequal likelihood | pathway chips |
| 5 Acceleration | two electrodes, ions of m/z 16 / 31 / 58 gain the same kinetic energy zeV but different speeds; live bars | voltage slider |
| 6 Separation | 180° magnetic sector: circular arcs r = mv/(zeB), m/z = eB²r²/(2V); six reference paths, ions that miss strike the plate or the wall (✕) | m/z chips, B slider, V slider, Tune B |
| 7 Time of flight | four singly charged ions race along a field-free tube, t = L√(m/(2zeV)); arrival order and times; TOF vs magnetic sector | Start Flight, mass slider of ion X |
| 8 Detection | ions arrive one by one, each is a pulse in the signal trace and adds to its peak; peak height is the number of ions, not their mass | Detect ions |
| 9 Spectrum | representative methane EI spectrum; molecular ion, base peak, fragment peaks; click a peak for m/z, formula, origin | click / Enter on a peak |
| 10 Isotopes | ³⁵Cl and ³⁷Cl nucleus models, a 100-atom sample, spectrum at m/z 35 / 37, live Aᵣ from mass numbers and from isotopic masses | abundance slider, presets (75:25 teaching, 75.76:24.24 natural) |
| 11 Patterns | Cl₂, CH₃Cl, CH₂Cl₂, CHCl₃, CH₃Br, Br₂ molecular-ion clusters from the binomial / polynomial expansion; Cl₂ = 70 : 72 : 74 = 9 : 6 : 1 | compound chips, teaching / natural toggle, peak click |
| 12 Unknown | five unknown representative spectra (methane, ethanol, propanone, chloromethane, bromomethane), five tasks, guided hints, submit, reveal | peak clicks, choices |
| 13 Compare | MS / IR / ¹H NMR table; evidence for ethanol, propanone, chloromethane; candidates narrowed by the evidence shown | Show MS / IR / NMR |

## Architecture (`src/engines/spectroscopy-studio/ms/`)

Pure modules (no React, no three; tested by `scripts/test-ms-model.mjs`) are separate from rendering (tested by `scripts/test-ms-ui.mjs` and `scripts/verify-ms-spectrometry.mjs`).

- `physics/constants.js`: e (exact), u, m_e (CODATA 2022), unit helpers and number formatters.
- `physics/kinematics.js`: Eₖ = zeV, v = √(2zeV/m), r = mv/(zeB), r = (1/B)√(2(m/z)V/e), m/z = eB²r²/(2V), B for a chosen m/z, t = L√(m/(2zeV)), and the constant-force gap kinematics x = d(t/t_g)² used in stage 5. SI units throughout; m/z is a pure number, the mass is m = (m/z)·z·u.
- `physics/sector.js`: the 180° sector geometry (field 0.40 m × 0.20 m, detector path radius 0.10 m, landing window ±2.4 mm). `sectorTrajectory(mz, V, B)` returns the radius, whether the ion reaches the detector slit, hits the plate or the wall, the end point and the angle turned through. Circular arcs x = r(1 − cos θ), y = r sin θ.
- `physics/tof.js`: race table (speed, flight time, rank) and the display clock (a constant stretch of time, so arrival times keep their true ratios).
- `data/isotopes.js`, `physics/isotopes.js`: isotopes (H, C, Cl, Br, plus N, O, F, S, I for formula checks), teaching abundances, Aᵣ from mass numbers and from isotopic masses, formula parser, nominal and exact masses, isotope pattern by polynomial expansion (∏ P_E(x)^n_E, so Cl₂ with 3 : 1 gives 0.5625 x⁷⁰ + 0.375 x⁷² + 0.0625 x⁷⁴ = 9 : 6 : 1), isotopologue table with binomial multiplicities.
- `data/spectra.js`: the five representative spectra (peak m/z, formula, origin, role, derived flag), molecular-ion and base-peak identification, explanations.
- `data/fragmentation.js`: ionisation step and the four methane pathways.
- `physics/detection.js`: ion population (one ion per 1 % of the base peak), reproducible arrival shuffle, bar heights after k arrivals.
- `physics/challenge.js`: stage 12 rounds, candidates, non-leaking peak hints, scoring and evaluation.
- `data/evidence.js`: stage 13 pools, descriptors, narrowing filters, evidence pulled read-only from the IR (`ir/data/compounds.js`) and NMR (`nmr/molecular/model`) modules.
- `data/instrument.js`: the instrument parts and the EI / sample / vacuum notes.
- `state/msState.js`, `MsContext.jsx`: external store (pure JS) + context + `useSyncExternalStore`, persisted under session key `studio-ms-v1` when a session scope exists (as for IR). Play / Pause, speed, replay and Teacher / Student mode are shared with the other tabs (the studio store).
- `components/`, `scene/`, `stages/`, `MsWorkbench.jsx`, `ms.css`: SVG scenes (pixel sized by a measuring `Scene` box), the 3D methane (r3f + drei `OrbitControls` auto-rotate, SVG fallback without WebGL), the pixel-sized stick spectrum `MsSpectrum`, and the thirteen stage views.

Shared files touched (minimal): `SpectroscopyStudio.jsx` (MS branch, provider, subtitle, Reset, playback), `state/studioState.js` (`ms` `developed: true`), `meta.js`, `components/DevelopmentPlaceholder.jsx` (text), `src/data/resources-registry.js` (description; status stays `in-development` because Structure Investigation is still a placeholder), and the placeholder-expecting assertions in `scripts/test-nmr-steps.mjs`, `test-nmr-ui.mjs`, `test-ir-ui.mjs`, `verify-spectroscopy-studio.mjs`. `package.json` gains `test:ms` (chained into `npm test`) and `verify:ms`.

## Formulas

| Quantity | Formula | Where |
|---|---|---|
| m/z | (mass of ion in u) / z, a number | stage 1 |
| kinetic energy | Eₖ = zeV (ions start with negligible energy) | 5 |
| speed | v = √(2zeV/m) | 5, 7 |
| radius in B | r = mv/(zeB) = (1/B)√(2(m/z)V/e) | 6 |
| m/z from r | m/z = eB²r²/(2V) | 6 |
| field for a given m/z | B = √(2(m/z)V/e)/r_det | 6 (Tune B) |
| flight time | t = L√(m/(2zeV)), L = 1 m | 7 |
| Aᵣ | Σ(A·p)/Σp (mass numbers) and Σ(m·p)/Σp (isotopic masses) | 10 |
| isotope cluster | ∏ (Σ pᵢ x^Aᵢ)^n | 11 |

Check values (hand-calculated, in `test-ms-model.mjs`): v(16, 2000 V) = 155 310 m/s; r(16, 2000 V, 0.258 T) = 0.09983 m; B for r = 0.1 m is 0.2575 T; t(16) = 6.439 µs, t(31) = 8.962 µs, t(43) = 10.555 µs, t(58) = 12.259 µs.

## Data provenance

The network was blocked while building, so NO table could be downloaded or re-checked. Everything below was entered from the author's knowledge of the published tables and is labelled that way.

| Data | Value | Source / status |
|---|---|---|
| e | 1.602176634×10⁻¹⁹ C | exact, 2019 SI |
| u, m_e | 1.66053906892×10⁻²⁷ kg, 9.1093837139×10⁻³¹ kg | CODATA 2022 |
| isotopic masses H, C, Cl, Br, N, O, F, S, I | e.g. ³⁵Cl 34.968852682, ³⁷Cl 36.965902602, ⁷⁹Br 78.9183376, ⁸¹Br 80.9162897 u | AME2020 (Wang et al., Chin. Phys. C 45, 030003, 2021) as tabulated by NIST; entered from memory of the table |
| natural abundances | Cl 75.76 / 24.24, Br 50.69 / 49.31, C 98.93 / 1.07, H 99.9885 / 0.0115 % | IUPAC (Meija et al., Pure Appl. Chem. 88, 293, 2016) / NIST |
| teaching abundances | Cl 75 : 25, Br 50 : 50 | the lesson's simplified model; the toggles in stages 10 and 11 show both |
| CH₄ first ionisation energy | 12.61 eV | NIST WebBook (typical value) |
| EI electron energy | 70 eV | convention |
| relative intensities of the five spectra | methane 12:3, 13:8, 14:16, 15:85, 16:100; ethanol 27:23, 29:24, 31:100, 43:12, 45:51, 46:22; propanone 15:30, 43:100, 58:62; chloromethane 15:65, 35:7, 49:12, 50:100; bromomethane 15:78, 79:8, 93:25, 94:100 | REPRESENTATIVE / IDEALISED. Rounded, typical literature-style values (the kind found in NIST / SDBS spectra) typed from memory, accurate to roughly ±30 %. They are not measured here, not copied from a file and not re-checked. They are labelled "representative / idealised, not experimental" wherever they are shown. |
| computed peaks | the heavy halogen partners (³⁷Cl, ⁸¹Br: main peak × natural ratio), the M+1 satellite of methane (1.1 %), ethanol (0.5 %), propanone (2.1 %) | computed from the isotope data, not typed |
| IR bands, NMR environments (stage 13) | ethanol and propanone from the IR and NMR workspaces (themselves representative) | read-only reuse. Chloromethane is in neither workspace: 2966 and 732 cm⁻¹ and δ 3.05 ppm are textbook values, labelled so on screen |
| distractor candidates (stages 12, 13) | the ions and descriptors a textbook would expect | reasoning data, not measured spectra of the distractors |
| instrument geometry | field 0.40 × 0.20 m, detector radius 0.10 m, L = 1 m, V 500 to 5000 V, B 0.1 to 0.8 T | invented for clarity, labelled "illustrative instrument model" |

## Scoring in stage 12

Each candidate scores +3 if its nominal mass equals the molecular-ion peak, +4 × (share of the observed significant peaks its expected ions explain), −3 × (share of its strongest expected ions that are missing), and +2 / −3 if its halogen pattern (none / Cl / Br) agrees / disagrees. It is a teaching heuristic, not structure elucidation. `test-ms-model.mjs` guarantees that the true compound scores strictly highest in every round and that same-nominal-mass look-alikes exist (ethanol: three with M = 46; propanone: three with M = 58), so the molecular-ion mass alone never decides. Until Submit, the screen shows no compound name and the peak hints never say "this is the molecular ion / base peak".

## Approximations and limits

- Sector: 180° geometry with ideal slits and a uniform field; ions start from rest at one point; no energy or angular spread, no fringe fields. Real instruments often use 60° or 90° sectors, double focusing, etc.
- TOF: ideal field-free flight of length L after instant acceleration; no turn-around time, no reflectron, constant speed displayed with a constant stretch of time. The tube is not drawn to scale.
- Stage 5: constant-force gap, display clock repeated every few seconds, ions drawn in separate lanes.
- Stage 8: the detector is idealised (one pulse per ion, no gain or noise); the arrival order is a reproducible shuffle.
- Isotope patterns are at nominal mass, halogens only; ¹³C, ²H and fragmentation add small peaks. Fragmentation pathway sizes are the sizes of the peaks, not branching ratios.
- Ionisation is electron ionisation only; electrospray, MALDI and others are mentioned (stage 2, teacher notes) and not simulated.
- m/z is plotted as an integer nominal value (exact m/z would use the isotopic masses and subtract the electron mass: `cationMz()` does this and is tested).

## Verification levels

1. Unit tests (`node scripts/test-ms-model.mjs`): formulas against hand calculations, sector and TOF, isotopes and Aᵣ, patterns, spectra integrity (one 100 % peak, M and base identified separately, formula masses, radical dots, 2 u clusters), pathways, detection, challenge, evidence, store.
2. jsdom (`node scripts/test-ms-ui.mjs`): the real studio rendered without layout or WebGL: navigation, controls, texts, state wiring, the stage 12 flow without a leak, evidence narrowing, Reset, tab switching, reduced motion, no `console.error`.
3. Headless Chromium (`npm run verify:ms`, Playwright, SwiftShader software GL): all thirteen stages at 1366×768, 1440×900, 1920×1080, 820×1180 and 390×844 with real interactions; overflow and clipping; pixel-difference checks that animations move and that controls change the picture; WebGL canvas count and leak checks; reduced motion; IR and NMR tabs still reachable; console errors.

NOT verified: a real GPU, real touch hardware, other browsers (Firefox, Safari), assistive technology, and the intensities of the spectra against measured data.
