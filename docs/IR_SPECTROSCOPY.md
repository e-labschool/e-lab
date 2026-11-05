# IR Spectroscopy workspace (IR tab of the Spectroscopy Simulation Lab)

Nine sequential stages in ONE tab (same pattern as the corrected NMR module): compact stepper with Previous / Next and direct jump, one primary animation area per stage, only the controls the stage needs, short text, optional "Teacher: deeper explanation", Play / Pause / Replay / speed, dark-blue theme, container-driven layout (one screen at 1366x768, 1440x900, 1920x1080; stacked at 820x1180 and 390x844). Specification: `docs/IR_SPEC.md`.

| Stage | Content |
|---|---|
| 1 Vibrations | HCl, H2O, CO2 as 3D ball-and-stick models vibrating in their real normal modes; quantised levels inset |
| 2 Types | symmetric stretch, asymmetric stretch, bending (H2O, CO2) with displacement arrows |
| 3 Absorption | IR wave, ΔE = hν, level ladder v = 0, 1, 2 with a transition, one wavenumber slider, Lorentzian response; mode selector including CO2 symmetric stretch ("frequency matches, no dipole change, not absorbed") |
| 4 Explorer | H2O, CO2, HCl, CH4, ethanol; every mode animated with its real displacements and an IR active / inactive pill with the reason |
| 5 FTIR | source, interferometer, sample, detector, computer, spectrum; real FFT of an interferogram |
| 6 Building a spectrum | 4000 to 400 axis, 100 % T on top; molecule vibration, absorbed wavenumber and band linked |
| 7 Functional groups | the specification's table (exact ranges); clicking a row or a band highlights and animates the group |
| 8 Interpretation | five compounds, clickable bands, group choice with feedback, fingerprint region |
| 9 Unknown | randomised unknown, 3 to 4 candidates, three progressive clues |

## Architecture (`src/engines/spectroscopy-studio/ir/`)

Pure physics and data (no React, tested by `scripts/test-ir-model.mjs`) are separate from rendering.

- `physics/linalg.js`, `constants.js`: small Jacobi eigen-solver, Gram-Schmidt, physical constants.
- `physics/normalModes.js`: valence force field. Internal coordinates (stretch, angle bend, linear bend, dihedral) with a numerically differentiated Wilson B matrix; Cartesian Hessian H = BᵀFB; mass weighting; translations and rotations (Eckart vectors) projected out; Jacobi diagonalisation; wavenumber = √λ / (2πc). Displacements are mass-weighted eigenvectors, so the centre of mass stays fixed and there is no net rotation (tested: zero linear and angular momentum for every mode). Degenerate sets (CO2 bend, CH4 T2/E) are canonicalised so the shown member is reproducible.
- `physics/molecules.js`: geometries and force fields. HCl, N2, H2O, CO2, CH4 force constants are FITTED (`scripts/fit-ir-force-field.mjs`, Gauss-Newton) so the harmonic model reproduces the literature fundamentals below. Ethanol uses the NMR module's generated geometry and typical group force constants (see Ethanol).
- `physics/dipole.js`: IR activity. Partial point charges give μ = Σ qᵢrᵢ; dμ/dQ is computed by central difference along each normal coordinate. A mode is active if |dμ/dQ| exceeds 1e-6 e/√u. The yes / no outcome follows from symmetry and does not depend on the charge scale.
- `physics/modeCatalog.js`: cached per-molecule catalogue (literature wavenumber, model wavenumber, displacements, degeneracy, dμ/dQ, activity, reason).
- `physics/absorption.js`: Lorentzian response (teaching half-width 40 cm⁻¹); an IR-inactive mode absorbs 0 even at exact match.
- `physics/spectrum.js`, `gasSpectrum.js`: pseudo-Voigt bands, absorbance additive, T = 100·10^(−A); peak analysis (width, broad, very broad).
- `physics/interferometer.js`, `ftirDemo.js`: Michelson model. Interferogram from the line list, Hann apodisation, real FFT (reuses `nmr/physics/fft.js`), parabolic peak interpolation; sample single beam ÷ background single beam gives T.
- `physics/functionalGroups.js`, `data/compounds.js`, `data/organics.js`, `physics/challenge.js`: group ranges, representative compound spectra, localised group-stretch modes, the stage 9 rounds and scoring.
- `state/irState.js`, `IrContext.jsx`: external store (pure JS) + context + `useSyncExternalStore`, persisted under session key `studio-ir-v1`. Play / Pause, speed, replay and Teacher / Student mode are shared with the studio store.
- `scene/` and `components/MolStage.jsx`: instanced three.js rendering (about 6 draw calls), vibration clock inside the frame loop (no React state per frame), SVG fallback when WebGL is unavailable. Display time is slowed by about 10^14 for every mode, keeping the true frequency ratios (3000 cm⁻¹ shows as 1 Hz).
- `stages/`, `IrWorkbench.jsx`, `ir.css`: the nine stage views and the workbench.

Shared files touched (minimal, NMR defaults unchanged): `components/StepNav.jsx`, `StepFrame.jsx`, `PlaybackBar.jsx` (optional props), `SpectroscopyStudio.jsx` (IR branch, provider, subtitle, Reset), `state/studioState.js` (`ir.developed: true`), `meta.js`, `components/DevelopmentPlaceholder.jsx` text, `data/resources-registry.js` description.

## Data sources

| Number | Value | Source |
|---|---|---|
| HCl stretch | 2886 cm⁻¹ | NIST WebBook diatomic constants (Huber and Herzberg), fundamental ωe − 2ωexe |
| H2O | 3657 (ν1), 1595 (ν2), 3756 (ν3) | Shimanouchi, NSRDS-NBS 39 (as tabulated in NIST WebBook) |
| CO2 | 1388 (ν1, Raman only), 2349 (ν3), 667 (ν2) | Herzberg, Molecular Spectra II; 1388 is the upper level of the Fermi dyad |
| CH4 | 2917, 3019, 1534, 1306 | Shimanouchi |
| N2 | 2330 cm⁻¹ | NIST diatomic constants |
| HCl, H2O dipoles | 1.08 D, 1.85 D | used to set the illustrative partial charges |
| Stage 7 ranges | the seven rows of the specification | `docs/IR_SPEC.md` |
| Extra ranges (C–O 1050–1410, C=O 1700–1750, acid O–H 2500–3000, C–H 2850–3090) | | IB Chemistry Data Booklet 2025, section 20 (read from the supplied PDF) |
| Aldehyde C–H 2700–2850 and the liquid-film band positions of the five compounds | | typical values from Pavia, Lampman, Kriz and Vyvyan, Introduction to Spectroscopy; Silverstein et al. |

Each band in `data/compounds.js` carries its source key (`IB` = range checked against the booklet, `TXT` = textbook value). The booklet has no nitrile row (its 2100–2260 row is C≡C); the table keeps the specification's 2210–2260 and says so in the data. The NIST WebBook pages could not be fetched in this build, so the literature wavenumbers are the standard published values entered from the cited tables and were not re-checked against NIST online. Wavenumbers in the UI are labelled "gas phase, representative".

## Approximations and limits

- Harmonic, valence force field. The fitted constants are "effective" (they absorb anharmonicity); the model wavenumbers match the literature to within the tolerance tested in `test-ir-model.mjs`, and the UI shows the literature value.
- Relative band intensities come from a point-charge dμ/dQ model and are illustrative only. Band widths are chosen for teaching. Gas-phase rotational fine structure is not modelled.
- Ethanol (21 vibrations that mix strongly) is a SIMPLIFIED normal-mode representation: typical group force constants, seven group-dominated modes chosen by the character of their potential energy (O–H stretch, CH3 asymmetric and symmetric stretch, CH2/CH3 bend, C–O, C–C, C–C–O bend) with representative wavenumbers. It is labelled as such in the UI.
- Stages 7 and 8 animate a localised group stretch (terminal atoms move along their bonds, the centre recoils mass-weighted, translations and rotations projected out), not a true normal mode of the larger molecule.
- Compound spectra (stages 8, 9) are representative and idealised, built from documented band positions; they are not experimental spectra and say so on screen. The stage 9 scoring is a teaching heuristic over a handful of diagnostic groups, not structure elucidation; the tests only guarantee one best candidate per round.
- The FTIR picture is illustrative; the interferogram and FFT are real computations on a synthetic line list.
- Teaching speed is not real time.

## Verification

- `node scripts/test-ir-model.mjs`: physics and data (pure).
- `node scripts/test-ir-ui.mjs`: jsdom (navigation, controls, texts, CO2 symmetric stretch message, stage 8 and 9 flows, no answer leak). No layout, no WebGL.
- `node scripts/verify-ir-spectroscopy.mjs`: headless Chromium with software GL (SwiftShader) at the five viewports, real clicks, pixel-difference checks, overflow, WebGL context leaks, reduced motion, console errors; screenshots are written to the output directory. Not covered: real GPU, real touch hardware, other browsers, assistive technology.
- `npm test` chains the model and UI tests (`test:ir`) after the NMR suites.
