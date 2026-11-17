# Atomic structure simulations: fix status

Scope: Build an Atom, Electron Configuration, Ionization Energy, Atomic Spectra Lab, Orbital Explorer, Wave Explorer. Findings are from `docs/sim-review/atomic.md`.

## Verification levels (what was actually run)
Last updated 2026-11-17 (round 3). Each claim below says how far it was checked.
- L1 Node unit tests (pure logic): `test:atomic-data` (61), `test:ie-explorer` (8), `test:atomic-spectra` (9), `test:wave-explorer` (18), `test:orbital-explorer` (11), `test:atomic-round2` (9), `test:build-atom` (23), `test:electron-config` (13 + 8), `test:shared-3d` (7). All pass. `npm test` (the whole chain) exits 0; `npm run build` succeeds.
- L2 jsdom component tests: Electron Configuration, Ionization Energy, Build an Atom controls.
- L3 Chromium (headless, SwiftShader software GL; 1366x768, 910x512, 390x844; light and dark), against a temp production build served by `vite preview`:
  - `scripts/verify-atomic-sims.mjs`: 231 checks, 0 problems (EC, IE, Spectra, Orbital, Wave).
  - `scripts/verify-round2-atoms-acids.mjs`: 367 checks, 1 problem. The one failure is `AK-51` (Buffer Action quick-controls bar), outside this scope and not touched.
  - `scripts/verify-atomic-round3.mjs` (new): 212 checks, 0 problems (Orbital Atom View to Z = 36, 4p, radial comparison, energy-order strip, nucleus note, canvas on the first screen, keyboard orbit, Build an Atom challenge UI, flight positions, particle markup).
  - Round-3 note: an older check in `verify-atomic-sims.mjs` used a selector (`line[role=button]`) that stopped matching after the AS-07 rewrite, so the hot/cold hydrogen dark-line checks counted 0 and one of them failed while the other passed vacuously. The selector is fixed; both checks now count real lines.
- NOT verified: real GPU (all timings below are software rendering), touch devices, Safari, Firefox, screen readers (ARIA roles and names were checked structurally only; nothing was heard in NVDA/JAWS/VoiceOver), 3D visual quality on real hardware, WebGL context loss in the Orbital Explorer (the shared guard exists but the Orbital Explorer's `ThreeCanvas` does not use it), the Learn-embedded mode against live Supabase.

## Data sources
- Nuclides: NUBASE2020 (Kondev et al., Chin. Phys. C 45, 030001, 2021), read through the `nucleardatapy` PyPI wheel; generator `scripts/gen-nuclide-data.mjs`. Known range = lightest to heaviest observed isotope (measured mass or half-life; extrapolated-only "#" entries excluded). Approximation: ground states only; half-lives are for the ground state.
- Ionisation energies: patched from the Wikipedia ionisation-energies data page (retrieved 2026-11-16); H and He added. Check against the IB data booklet.
- Constants: CODATA 2018 in `src/lib/atomic/constants.js` (one source for all six sims); hydrogen uses the finite-mass Rydberg energy 13.598 eV (H-alpha 656.47 nm vacuum).

## Status by finding
Fixed (code, and the level shown):
- X-01, X-02, BA-01 to BA-06, BA-09, BA-11, BA-13, EC-01 to EC-09, IE-01 to IE-09, AS-01 to AS-04, AS-09, OE-01 (disclosure), OE-03, OE-04, OE-05, OE-07, WE-01, WE-02, WE-05 to WE-08 (previous rounds; L1 to L3).
- BA-07 (L1 + L3): challenges are generated from rules (notation to particles, particles to notation, isotope and ion cases); a wrong attempt offers a worked answer; a session score and streak are kept. Chromium checks the score, that new challenges differ, and the worked answer.
- BA-08 (L1 + L3): Isotope mixer with abundance sliders and the working for Ar (carbon 12.01, 50:50 C-12/C-13 = 12.5), with a link to the Spectroscopy simulation for a real mass spectrum. Elements covered: the list in `src/lib/atomic/abundance.js` only.
- BA-10 (L3, software GL only): particles are plain SVG circles sharing one gradient set; no nested `<svg>` or `<foreignObject>` (checked). Click cost on a 26-proton / 48-neutron nucleus measured 56 to 69 ms per click in SwiftShader, against about 500 ms reported for the old build (the two measurements used different click sequences, so treat the ratio as indicative). Each electron still has its own CSS counter-rotation. Not measured on Safari/iPad, which was the review's concern.
- BA-12 (L1 + L3): Undo (30 steps, including Start From Empty and element changes) and flying particles that start at the real +/- row of their type (clamped to the stage when the controls are in the side panel) and end at the nucleus or the outer electron ring, measured from the DOM. Falls back to the old fixed positions if an element cannot be found.
- EC-10 (L3): a session strip keeps the species the student has checked (correct or not) when another element is chosen; "Clear history" empties it. No streak counter.
- IE-10 (L3): "Compare with" draws a second element's bars beside the chosen one (Na vs Mg). The prediction gate still applies only to the chosen element.
- AS-06 (L1 + L3): Lyman, Balmer and Paschen chips, convergence plot, and a "find the limit" activity.
- AS-08 (L1): wavelengths are labelled "in air" or "in vacuum"; conversion by the Birch and Downs (1994) update of the Edlen refractive-index formula in `airVacuum.js` (H-alpha 656.47 vacuum, 656.28 air).
- OE-08 (L1 + L3): both 3D views (Explore and Atom View) go through `ThreeCanvas` with `keyboard`, which uses `src/engines/shared-3d` (arrow keys orbit, + and - zoom, 0 or Home resets, Shift for fine steps). The view is a focusable, named region with a visible key hint. Chromium checks the canvas pixels change after ArrowRight. Not done for these views: the shared context-loss guard and the no-WebGL notice from `GuardedFrame` (ThreeCanvas has its own plain WebGL-absent message).
- OE-09 (L3): the nucleus is a small dot in both views, with a visible "Not to scale ... about 10^-5 of an orbital radius" line under each 3D view (also kept in the help list). It is still far larger than real.
- OE-11 (L1): the 4s bounding radius is 48 a0 (about 99 % of the density); legend labels read "2px (2 e-)".
- WE-03 (L1 + L3): a "mechanical wave" mode in sound units (343 m/s, 20 Hz to 20 kHz, wavelength in m or cm), displacement limited below spacing/pi, no nanometres in that mode.
- WE-04 (L1 + L3): two-wave comparison (A vs B) with a predict question whose answer is recomputed, and a "wave to photon" strip (E = hf, link to a hydrogen transition). On-screen speed in the visible zoom follows the real frequency.

Partly:
- AS-05 (L1 + L3): helium, neon and mercury lamps added (sources named in `data/spectra.js`), a hydrogen pink glow, and an "Identify unknown" task. Still missing: Li, K and Ca flame colours; sodium is still the D doublet only; lamp glow colours are set by hand, not computed from the lines; neon and mercury intensities are qualitative.
- AS-07 (L3): wavelength ticks, collision-checked line labels, and keyboard-operable lines (tabindex, Enter and Space) are in. The large empty areas and small apparatus drawings the review noted were not redesigned.
- OE-02 (L3): "Only shell n = k" isolation, a canvas height that keeps the status line on the first screen at 1366x768, and on short or narrow screens the element picker starts collapsed so the 3D view is on the first screen. Not done: an "exploded" shell-by-shell view and a slice plane; the default Atom View for a heavy atom is still a dense overlapping cloud.
- OE-06 (L1 + L3): Atom View now covers Z = 1 to 36 from the shared layer (Cr and Cu exceptions, Hund's rule on the 3d and 4p boxes), 4p is available in Explore, "Show all three p / five d" exists, a radial probability plot with nodes and peaks, a "Compare with" second radial curve on the same axes, and an energy-order strip (1s < 2s < 2p < 3s < 3p < 4s < 3d < 4p) with the electrons in each. Not done: a 3D side-by-side compare, orbitals beyond 4p (4d, 5s), and a 3d-versus-4s energy plot with numbers.
- OE-10 (L1 + L3): clouds are sampled one orbital per task with a visible "Sampling electron clouds: k of N" status, cached per orbital and point count, and heavier atoms use fewer points each (floor 2,500). It is still on the main thread (no worker). Software-GL settle time for Kr (18 orbitals) from a cold start was 1.1 to 10.3 s depending on load and viewport; on a real GPU it was not measured.
- X-03 to X-05 (L2 + L3): fixed for the atomic simulations (named mode switch, shared refusal messages); the shared "predict / observe / explain" strip was not built as one component.

Not done:
- The Medium and Low items of the Spectra, Orbital and Wave reviews that are not listed above.
- Real-GPU, touch, Safari, Firefox and screen-reader testing (see above).
Caveat: the status of individual IE/EC sub-points inherited from earlier rounds was not re-reproduced one by one in this round; the round-2 Chromium script covers most of them.

## Behaviour changes worth knowing
- Old tests encoded behaviour that was wrong and were updated, each marked "CHANGED": Hydrogen-7 neutron cap, no Kr4-, IB charge notation "1+", Fe2+ shell arrangement 2,8,14, Kr-78 stable per NUBASE2020.
- Spectra: cold hydrogen absorption now shows the Lyman series (UV strip) and no Balmer lines; a "hot excited gas (n = 2)" toggle shows Balmer. Absorption tolerance is 1% (was 3%) and the nearest gap wins; the photon's offset is shown; ionisation threshold is marked on the slider; ionisation leaves an H+ state with "New hydrogen atom"; excited atoms can relax with an emission cascade.
- Wave: amplitude 0 is a flat line; a "Whole EM spectrum" log-scale mode (1 pm to 1 km) with region bar and J, eV, kJ/mol energies; Reset restores everything.
- Orbital: "Build an Atom" mode renamed "Atom View"; default detections 2,500 (s), 5,000 (p), 8,000 (d). Atom View now runs to Z = 36 and its configurations come from the shared layer (so Cr and Cu are 4s1 3d5 and 4s1 3d10). Orbital sizes are still hydrogen-scale (disclosed on screen).
- Build an Atom: flying particles follow the real controls; the Undo button is in the toolbar.

## Verify against the IB guide (owner)
- Highest-common-oxidation-state limits for Z up to 36 (approximate by design).
- Cr/Cu exception list and ion removal order (4s before 3d).
- Ionisation-energy values used in the trend view, and the EM region boundaries in Wave Explorer.
- Wording of refusal messages.

## Decisions for the owner
- Wave Explorer opens in "Visible light" mode (old behaviour, so existing lessons are unchanged); the full-spectrum mode is opt-in.
- Whether to keep the strict anion/cation limits or allow hypothetical ions with a warning.
