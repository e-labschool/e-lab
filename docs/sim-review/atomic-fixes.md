# Atomic structure simulations: fix status

Scope: Build an Atom, Electron Configuration, Ionization Energy, Atomic Spectra Lab, Orbital Explorer, Wave Explorer. Findings are from `docs/sim-review/atomic.md`.

## Verification levels (what was actually run)
- Node unit tests (pure logic): `test:atomic-data` (61), `test:ie-explorer` (8), `test:atomic-spectra` (9), `test:wave-explorer` (10), `test:build-atom`, `test:electron-config` (incl. 8 in `test-ec-explorer.mjs`). All pass.
- jsdom component tests for Electron Configuration and Ionization Energy.
- Chromium (headless, SwiftShader software GL) via `scripts/verify-build-atom-limits.mjs` (90 checks, 0 problems) and `scripts/verify-atomic-sims.mjs` (231 checks, 0 problems; 1366x768, 910x512, 390x844, light and dark; covers EC, IE, Spectra, Orbital, Wave).
- NOT verified: real GPU, touch devices, Safari, Firefox, screen readers (ARIA was checked structurally only), 3D visual quality on real hardware.
- `npm test` stops at `test:dashboard-layout` (gas-laws source assertion, another agent's area). The remaining suites were run individually: all atomic suites pass. Unrelated failures at the time of the run: bonding, imf, simulation-shell (mixture-separation), simulation-library, resource-folders, curricula-locks. None touch atomic files. Rerun after the other agents settle. `npm run build` succeeds.

## Data sources
- Nuclides: NUBASE2020 (Kondev et al., Chin. Phys. C 45, 030001, 2021), read through the `nucleardatapy` PyPI wheel; generator `scripts/gen-nuclide-data.mjs`. Known range = lightest to heaviest observed isotope (measured mass or half-life; extrapolated-only "#" entries excluded). Approximation: ground states only; half-lives are for the ground state.
- Ionisation energies: patched from the Wikipedia ionisation-energies data page (retrieved 2026-11-16); H and He added. Check against the IB data booklet.
- Constants: CODATA 2018 in `src/lib/atomic/constants.js` (one source for all six sims); hydrogen uses the finite-mass Rydberg energy 13.598 eV (H-alpha 656.47 nm vacuum).

## Status by finding
Fixed: X-01 (one shared layer in `src/lib/atomic`), X-02 (shared constants; Wave and Spectra re-export them), BA-01 to BA-06, BA-09, BA-11, BA-13, EC-01 to EC-09, IE-01 to IE-09 (see notes), AS-01, AS-02, AS-03, AS-04, AS-09, OE-01 (disclosure note), OE-03 (40,000 cap with message), OE-04, OE-05, OE-07, WE-01, WE-02, WE-05, WE-06, WE-07, WE-08.
Partly: OE-08 (canvas wrapped with an accessible description; no keyboard orbit keys), OE-09 (disclosed in help, nucleus still drawn large), WE-03 (displacement now limited below spacing/pi so particles cannot overtake; no frequency control or sound units, and the wavelength is still shown schematically), X-03 to X-05 (only where touched by the above).
Not done: BA-07, BA-08, BA-10, BA-12, EC-10, IE-10, AS-05, AS-06, AS-07, AS-08, OE-02, OE-06, OE-10, OE-11, WE-04, and the Medium/Low items of the Spectra, Orbital and Wave reviews not listed above. Reason: budget; listed honestly rather than rushed.
Caveat: the status of X-03 to X-05 and of individual IE/EC sub-points was set from my notes, not re-reproduced one by one in a browser. Re-check before sign-off.

## Behaviour changes worth knowing
- Old tests encoded behaviour that was wrong and were updated, each marked "CHANGED": Hydrogen-7 neutron cap, no Kr4-, IB charge notation "1+", Fe2+ shell arrangement 2,8,14, Kr-78 stable per NUBASE2020.
- Spectra: cold hydrogen absorption now shows the Lyman series (UV strip) and no Balmer lines; a "hot excited gas (n = 2)" toggle shows Balmer. Absorption tolerance is 1% (was 3%) and the nearest gap wins; the photon's offset is shown; ionisation threshold is marked on the slider; ionisation leaves an H+ state with "New hydrogen atom"; excited atoms can relax with an emission cascade.
- Wave: amplitude 0 is a flat line; a "Whole EM spectrum" log-scale mode (1 pm to 1 km) with region bar and J, eV, kJ/mol energies; Reset restores everything.
- Orbital: "Build an Atom" mode renamed "Atom View"; default detections 2,500 (s), 5,000 (p), 8,000 (d).

## Verify against the IB guide (owner)
- Highest-common-oxidation-state limits for Z up to 36 (approximate by design).
- Cr/Cu exception list and ion removal order (4s before 3d).
- Ionisation-energy values used in the trend view, and the EM region boundaries in Wave Explorer.
- Wording of refusal messages.

## Decisions for the owner
- Wave Explorer opens in "Visible light" mode (old behaviour, so existing lessons are unchanged); the full-spectrum mode is opt-in.
- Whether to keep the strict anion/cation limits or allow hypothetical ions with a warning.
