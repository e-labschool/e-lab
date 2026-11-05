# Spectroscopy Simulation Lab: single NMR workspace

Spec: `docs/NMR_SIMPLIFY_SPEC.md`. Code: `src/engines/spectroscopy-studio/`.

## What it is now

One persistent NMR workspace inside `SimulationDashboard` (header, technique tabs, Reset, fullscreen; its controls/graph columns are hidden and everything lives in the chamber). Technique tabs: Mass Spec, IR, NMR, Structure Investigation (all but NMR are honest placeholders). The Splitting Patterns tab and the old five-stage stepper were removed.

A compact six-step stepper (Previous / Next / direct selection) drives `nmr/steps/`:

1. Nucleus: one large proton model (sphere with a turning surface stripe, magnetic-moment arrow with a cone head); "Show Proton Sample" morphs it into an ensemble of 48 small proton models with randomly oriented moment arrows (see "Steps 1-3 (corrections)" below).
2. Field: zero-field degenerate levels, Apply B0, one B0 slider (1-14 T), real Boltzmann excess with an optional labelled exaggeration; the same proton models go onto the alpha / beta cones and precess about B0 while the energy diagram splits in sync; dE = h nu0, alpha, beta, B0 labelled.
3. Radiofrequency: ONE incoming RF wave travelling to a proton model, the alpha / beta level diagram beside it, a five-link chain, ONE RF slider (nu0 +-100 Hz) and the simplified continuous-wave response graph (see below).
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
* `nmr/physics/cwResponse.js`: steady-state Bloch Lorentzian. The 20 Hz FWHM, saturation s = 1 and +-100 Hz slider are illustrative teaching values, not instrument data.
* `nmr/molecular/model/moleculeFid.js`: one damped exponential per multiplet line, carrier 5 ppm, 32768 points, zero-fill x2. The FFT is real but computed up front; the animation only reveals it.
* `nmr/molecular/model/spinStates.js`: enumerates the 2^n spin combinations behind n+1 lines.
* Kept but no longer learner-facing: `model/challenges.js` (only the splitting prediction is used); unknown-structure identification and challenges were removed from the UI.

## Tests and verification

* Pure: `npm run test:nmr-physics`, `test:nmr-steps` (step machine, carry-over, CW vs RK4 Bloch, Lorentzian / offset mapping / on-near-off classification, absorbed-population model, precession cone, alpha > beta, chain, fixed texts, spin states, FID FFT peaks), `test:nmr-molecular`. jsdom: `test:nmr-ui` (registration, 4 tabs, six steps, carry-over, labels, placeholders, steps 1-3 texts, resonance states switching with the slider, reduced motion). All chained in `npm test`.
* Browser: `node scripts/verify-spectroscopy-studio.mjs <baseUrl> <outDir>` builds nothing itself; serve a built copy with `vite preview` and run it against all six steps at 1366x768, 1440x900, 1920x1080, 820x1180, 390x844 (headless Chromium, SwiftShader), plus reduced motion, persistence, keyboard and accessible names. For steps 1-3 it also checks pixel statistics of the WebGL canvas (spheres, amber / teal / violet arrows), scene state published as `data-*` attributes (spin / precession angles, alpha / beta counts, cone angle), Pause, WebGL canvas count after repeated step changes, SVG label clipping / overlap, and the RF slider sweep (graph indicator position, transition-arrow opacity, MHz vs offset). `SIMS=spectroscopy-studio node scripts/verify-simulation-button-contrast.mjs <baseUrl>` is the button contrast audit.
* Not verified: real GPU rendering, real touch hardware, browsers other than Chromium, screen readers / assistive technology.


## Steps 1-3 (corrections), models and labels

Spec: `docs/NMR_CORRECTIONS_SPEC.md`. Single tab, Next / Back and layout unchanged; steps 4-6 untouched.

* **Proton model (steps 1, 2).** `nmr/scene/ProtonInstances.jsx`: INSTANCED spheres (vertex-colour surface cues: equator band, pole cap, amber meridian stripe that travels round when the sphere turns), INSTANCED moment arrows (shaft + cone head, tail at the sphere centre) and INSTANCED precession rings; four draw calls for any number of nuclei. Spin runs at 0.85 rev/s, precession at 0.4 rev/s (`spinEnsemble.js`), both in the frame loop (`sceneClock.js`: honours Pause, speed, reduced motion). The sphere is a labelled teaching analogy: the exact text "Proton spin is a quantum property. The rotating sphere is a simplified conceptual representation, not a proton literally rotating like a planet." appears in steps 1 and 2 (`nmr/steps/texts.js`), and the teacher text says the rotation is only an analogy.
* **Step 2 states.** Before B0 the moments wander randomly (no preferred direction). After Apply B0 each moves onto its quantum cone, alpha at arccos(1/sqrt 3) = 54.74 deg from B0 and beta at 125.26 deg (cos theta = mu_z / |mu| = (1/2) / (sqrt 3 / 2) for I = 1/2), and precesses clockwise about B0 (gamma > 0). This is the conceptual vector picture: quantum mechanics fixes |mu| and mu_z, not the azimuth. Drawn alpha / beta counts follow the real polarisation (32 per million at 9.4 T, so 20 : 20 of 40: stated in the UI) or the labelled exaggeration (about 6 000x). The energy diagram (`LevelsDiagram.jsx`) splits in sync with the same progress value; dE = h nu0, the Larmor frequency (nu0) label and nu0 = gamma B0 / 2 pi follow the B0 slider.
* **Step 3.** One wave (`RfWave.jsx`) travels to the proton glyph; its thickness, glow, absorption near the proton and halo scale with the continuous response, so off / near / on resonance is a gradation. Region labels come from the line width (`cwRegion`): on = |offset| <= FWHM/2, near <= FWHM, otherwise off ("Off resonance" / "Near resonance" / "Resonance achieved"). The levels never move with the RF; the transition arrow (alpha to beta, labelled "one nucleus (teaching model)") has opacity = response, the gap highlight likewise. Chain `Applied field -> Energy splitting -> Matching RF energy -> Resonance -> Absorption` (`chain.js`) shows the current link.
* **Graph.** Title "Simplified continuous-wave NMR resonance response" with the caveat that it is an introductory frequency-sweep model, not the output of a pulsed FT-NMR experiment; x "RF frequency offset from resonance (Hz)", y "Relative excitation / absorption response"; Lorentzian of FWHM 20 Hz (marked), 0 Hz marked, a vertical indicator that follows the slider, state chip. The slider spans +-100 Hz (5 linewidths); `rfFromOffset` is not rounded, so the MHz value shown (7 decimals) always agrees with the offset.
* **Absorbed-population model** (`nmr/physics/rfPopulation.js`). From the same Bloch parameters: D = (N alpha - N beta) / equilibrium = Mz / M0, D_ss = 1 - s/(1+s) L(offset) (L = the plotted response), approached as D(t) = D_ss + (1 - D_ss) exp(-t/tau), tau = T1 (1 + s - sL)/(1 + s). With s = 1: D never falls below 1/2 (the beta population moves towards equal populations, never beyond, and only a fraction of the tiny equilibrium excess is removed) and far off resonance D stays 1. The animation shows a finite 4.5 s window that restarts from equilibrium whenever the RF frequency changes; one animation second stands for about 12.5 ms of model time (T1 = T2 = 22.5 ms). Steady state is exact; the single-exponential time course is the rate-equation approximation (the full Bloch transient lags it early on resonance and undershoots slightly; tested). The bars use the labelled exaggeration, and the percentage of excess left is scale independent. s = 1 is stronger than a real CW experiment so that the saturation is visible.
* **Reduced motion / Pause.** No spin, precession, wave motion or irradiation clock; arrows, rings, labels, the wave at a fixed phase and the settled population state remain.
* **Limitations.** Steps 1-2 draw 48 / 40 nuclei, not 10^20; the line width (20 Hz), s = 1 and the +-100 Hz slider are illustrative; the sphere, the cone and the single-nucleus transition arrow are teaching analogies; the response graph is a CW model, not a pulsed experiment (steps 4 and 5 treat RF pulse, FID and Fourier transform).
