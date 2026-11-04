# Spectroscopy Simulation Lab: shell, physics and instrument stages

Registered as `spectroscopy-studio`. Code: `src/engines/spectroscopy-studio/`. The molecular side (stages 3-5 and the Splitting Patterns tab) is documented in `NMR_MOLECULAR_MODEL.md`. Persistence follows `STATE_PERSISTENCE.md` (key `studio-v1`).

## Architecture

- `SpectroscopyStudio.jsx` is one `SimulationDashboard` (controls | chamber | graph | live | explain). Stages render into the dashboard slots through React portals (`components/Slot.jsx`), so changing stage never remounts the dashboard.
- Technique tabs: Mass Spectrometry, IR Spectroscopy, 1H NMR, Splitting Patterns, Structure Investigation. Only 1H NMR and Splitting Patterns are real; the rest are labelled "in development" placeholders (Structure Investigation links to the NMR-only interpretation, stage 5).
- NMR stepper: 1 Principle, 2 The Instrument, 3 Molecular Process, 4 The Spectrum, 5 Interpretation. Free movement; the experiment lives in the store, so leaving a stage loses nothing.
- `state/studioState.js` is a pure-JS store read with `useSyncExternalStore` selectors (`state/StudioContext.jsx`). The persisted slice (technique, stage, activities, mode, split view, speed, B0, RF, field, instrument and FID settings, molecule and selection) is mirrored to sessionStorage, debounced 250 ms. Playback state and timeline positions (`store.timeRefs`) are deliberately not persisted. 3D camera orientation is not persisted.
- Timelines (`components/useTimeline.js`) run in display seconds, pause at events in Teacher mode, and with reduced motion Play jumps to the next event. The frame loop is visibility-aware (`src/lib/frameTime.js`; frame delta clamped to 0.05 s).
- Theme: dark navy with teal, cyan and violet accents (`--ss-*` tokens). The approved mockup was NOT supplied; the visual design follows the brief's description only.

## Contract with the molecular stages

`molecularBridge.js` re-exports `MolecularProcessStage`, `SpectrumStage`, `InterpretationStage`, `SplittingLab` from `nmr/molecular/index.js`. Each takes one prop, `studio`:

`moleculeId, setMoleculeId, selectedEnvId, setSelectedEnvId, selectedMultipletId, setSelectedMultipletId, operatingFrequencyMHz, setOperatingFrequencyMHz, b0Tesla, mode ('teacher'|'student'), splitView, speed, playing, setPlaying, stepRequest {n,dir}, resetToken, reducedMotion, containerSize {width,height}`.

`operatingFrequencyMHz = gamma*B0/2pi` and is kept in sync with `b0Tesla` in both directions.

## Physics models (`nmr/physics/`)

| Model | Equations / method | Validity |
|---|---|---|
| Larmor frequency | nu0 = gamma B0 / 2pi, gamma(1H) = 2.675222e8 rad s-1 T-1 | B0 1-14 T (slider range) |
| Energy gap | DeltaE = h nu0 | any B0 |
| Boltzmann polarisation | P = tanh(DeltaE / 2kT), T = 298 K (about 3.2e-5 at 9.4 T, computed) | spin-1/2, thermal equilibrium |
| Bloch equations | rotating frame, dM/dt = M x Omega - relaxation, Omega = (omega1, 0, Delta); RK4 for pulses, closed form for free precession, exact Rodrigues rotation for very large detuning; step-back recomputes from t = 0 | isolated spin ensemble, no J-coupling, uniform B1 |
| FID | sum of damped complex exponentials, seeded Gaussian noise (mulberry32) | 20 ppm window, carrier at 5 ppm, N = 32768 |
| FFT | radix-2, first point halved, scaled by the dwell time (line area = A/2, height = A T2*), zero-fill x2, FWHM = 1/(pi T2*) | Lorentzian lines only |
| Spin ensemble drawing | 160 arrows; scientific view on cones at 54.74 and 125.26 degrees with stratified azimuths (zero net transverse magnetisation) | illustrative |

## Approximations that are labelled in the UI

- Populations: real scale (difference of about 3e-5) versus an exaggerated teaching scale (constant factor about 6206, 0.2 at 9.4 T), always labelled.
- Pedagogical time: pulses last 3 display seconds and free precession 5 display seconds. Real pulses last microseconds; an FID lasts about a second.
- The instrument drawing is an "illustrative instrument model". It omits the cryostat, shim coils, lock channel, tuning and matching and quadrature detection, and states that the spectrometer records the FID and the spectrum is computed from it.
- The proton is not drawn as a literally spinning ball; a teacher note explains that spin is intrinsic and quantum.
- RF excitation is shown as tilting the net magnetisation, not as every proton flipping.
- Lab-frame display uses a reduced display rate (`LAB_DISPLAY_RATE`) for the precession, not the real frequency.
- The FID demos (1-3 resonances) use illustrative amplitudes and T2*; they are not predicted from a particular molecule.

## Tests and verification

- `npm run test:nmr-physics` (`scripts/test-nmr-physics.mjs`, 41 tests): constants, populations, Bloch (flip angle, 90/180, off-resonance against the analytic result, relaxation, norm, determinism), trajectory against stateAt, FFT against a direct DFT, FID peak, FWHM, area, noise, instrument model, excitation, ensemble, FID model.
- `npm run test:nmr-ui` (`scripts/test-nmr-ui.mjs`, jsdom, no layout, no WebGL): registration, tabs, stepper and state kept across stages, instrument components, guided steps, placeholders, Splitting tab, Teacher/Student, split view, playback controls.
- `node scripts/verify-spectroscopy-studio.mjs [baseUrl] [outDir]` (headless Chromium with SwiftShader, 1366x768, 1440x900, 1920x1080, 820x1180, 390x844): every stage, B0 state across stage switches, the six guided steps, FID view, Splitting tab, placeholder, overflow / clipping / vertical scroll, console errors, hide/show. Screenshots are written to the output directory.
- `SIMS=spectroscopy-studio node scripts/verify-simulation-button-contrast.mjs <baseUrl>`: button contrast audit (WCAG text 4.5, boundary 3).

Not verified: real GPU rendering, real touch hardware, browsers other than Chromium, assistive technology, and long-session performance.
