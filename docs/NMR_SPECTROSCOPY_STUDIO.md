# Spectroscopy Simulation Lab: single NMR workspace

Spec: `docs/NMR_SIMPLIFY_SPEC.md`. Code: `src/engines/spectroscopy-studio/`.

## What it is now

One persistent NMR workspace inside `SimulationDashboard` (header, technique tabs, Reset, fullscreen; its controls/graph columns are hidden and everything lives in the chamber). Technique tabs: Mass Spec, IR, NMR, Structure Investigation (all but NMR are honest placeholders). The Splitting Patterns tab and the old five-stage stepper were removed.

A compact six-step stepper (Previous / Next / direct selection) drives `nmr/steps/`:

1. Nucleus: large H-1 with a magnetic-moment arrow; "Show Proton Sample" morphs it into a conceptual ensemble drawn with non-arrow glyphs and labelled conceptual.
2. Field: zero-field degenerate levels, Apply B0, one B0 slider (1-14 T), real Boltzmann excess with an optional labelled exaggeration; dE, alpha, beta, B0 labelled.
3. Radiofrequency: one RF slider centred on resonance, live Lorentzian response. Labelled "Simplified continuous-wave model (introductory)", with a note that modern spectrometers use pulses and Fourier transform.
4. Instrument: one large animated instrument ("illustrative instrument model"), "Next Stage": sample, field, pulse, detect, FID, FT.
5. Spectrum: one graph; FID of the current molecule (3-singlet fallback), "Transform to Spectrum" with an animated real FFT, and a way back.
6. Molecules: all 9 molecules, prominent 3D model, click an H to highlight equivalent H and the resonance. Sub-stages: environments, chemical shift and shielding, integration, coupling (Apply Coupling, Pascal ratios, area preserved, first-order assumptions, optional spin-state counting card).

Molecule, B0, mode and playback carry across steps. Each step has a short explanation and a "Teacher: deeper explanation" disclosure.

## Architecture

* `state/studioState.js`: pure external store (`useSyncExternalStore`), session key `studio-v2`; `state/stepMachine.js`: steps, sub-stages, navigation, transport rules.
* `components/useAnim.js`: `usePhase` (ambient), `useTransition` (progress in non-persisted `timeRefs`; honours pause, speed 0.25/0.5/1/2, reduced motion). Header Reset = `resetExperiment`; "Replay" = `resetPlayback`.
* Layout is container-driven (`.ss-wb`, container queries); stacked layout follows the dashboard's `data-layout="stacked"` (internal scroll). Buttons use shared `.sim-btn` tokens.

## Models and labels

* `nmr/physics/fieldModel.js`, `populations.js`: Larmor frequency, dE = h nu, real Boltzmann excess (about 32 ppm at 9.4 T) and a labelled exaggeration.
* `nmr/physics/cwResponse.js`: steady-state Bloch Lorentzian. The 20 Hz FWHM, 0.05 saturation and +-100 Hz slider are illustrative teaching values, not instrument data.
* `nmr/molecular/model/moleculeFid.js`: one damped exponential per multiplet line, carrier 5 ppm, 32768 points, zero-fill x2. The FFT is real but computed up front; the animation only reveals it.
* `nmr/molecular/model/spinStates.js`: enumerates the 2^n spin combinations behind n+1 lines.
* Kept but no longer learner-facing: `model/challenges.js` (only the splitting prediction is used); unknown-structure identification and challenges were removed from the UI.

## Tests and verification

* Pure: `npm run test:nmr-physics`, `test:nmr-steps` (step machine, carry-over, CW vs RK4 Bloch, spin states, FID FFT peaks), `test:nmr-molecular`. jsdom: `test:nmr-ui` (registration, 4 tabs, six steps, carry-over, labels, placeholders). All chained in `npm test`.
* Browser: `node scripts/verify-spectroscopy-studio.mjs <baseUrl> <outDir>` builds nothing itself; serve a built copy with `vite preview` and run it against all six steps at 1366x768, 1440x900, 1920x1080, 820x1180, 390x844 (headless Chromium, SwiftShader), plus reduced motion, persistence, keyboard and accessible names. `SIMS=spectroscopy-studio node scripts/verify-simulation-button-contrast.mjs <baseUrl>` is the button contrast audit.
* Not verified: real GPU rendering, real touch hardware, browsers other than Chromium, screen readers / assistive technology.
