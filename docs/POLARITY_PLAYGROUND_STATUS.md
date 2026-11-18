# Polarity Playground: status against the spec

Legend: DONE = implemented and covered by the stated check; PARTIAL = implemented with a stated limit; NOT TESTED = implemented, not verifiable here.
"Model test" = `scripts/test-polarity-model.mjs`; "UI test" = `scripts/test-polarity-ui.mjs` (jsdom, no WebGL); "Verify" = `scripts/verify-polarity-playground.mjs`
(headless Chromium, software WebGL, screenshots reviewed by eye). The design reference is `docs/polarity-reference.png`.

## Structure and integration

| Requirement | Status | Evidence / note |
|---|---|---|
| Four tabs: Game, Inside a Covalent Bond, Molecular Polarity, Polarity Challenge | DONE | UI test (tab names, tablist pattern, roving tabindex); Verify screenshots |
| Registered: catalogue (live, Bonding, S2.2, not featured), simulation registry, resources registry, engine components | DONE | UI test "registered..."; `test:simulation-library`; `test:curricula-locks` |
| Syllabus tag | PARTIAL | tagged `S2.2`: the platform's tag list has no S2.2.5 / S2.2.6 codes (the catalogue test requires real topic codes). Live count 26 → 27; the S2.2 search finds 6 |
| Thumbnail | DONE | `public/sim-thumbs/polarity-playground.webp` (19 KB) |
| Superseded "Molecular Polarity Explorer" placeholder | DONE | added to the covered-by-live set so no duplicate "coming soon" card is shown |

## Tab 1: Electron Tug-of-War

| Requirement | Status | Evidence / note |
|---|---|---|
| Free Play sliders for fictional atoms, equal values share equally, EN labels, δ badges, result panel | DONE | UI test (free play flow); Verify tug screenshots |
| Equal EN: no δ charges, shared density centred | DONE | UI test; Model test (`tugState`); Verify `sci-tug-equal.png` |
| Real Atom Mode: fixed Pauling values, predict first, feedback with reasoning | DONE | UI test (value hidden until the prediction); Model test (`judgePrediction`) |
| Playful 3D characters, rope, glossy lighting | DONE | looked at in screenshots against the reference; characters are simple (faces, hands, rope), not the reference's detailed illustration |
| Real-atom set | PARTIAL | eight atoms (H, C, N, O, F, Cl, S, Br) |

## Tab 2: Inside a Covalent Bond

| Requirement | Status | Evidence / note |
|---|---|---|
| Bond View, Electron Cloud, Bond Polarity | DONE | UI test (three views); Verify screenshots `sci-bond-*` |
| H₂: two overlapping translucent spherical regions, symmetric, no δ, no arrow | DONE | Model test (mirror symmetry, lens at midpoint, density centroid); screenshot |
| HCl: redistributed, not a rigid shift, continuous overlap | DONE | Model test (lens 0.536; far side of H region untouched; Cl denser / compacted); screenshot |
| Label "Simplified electron-density model - not to scale" | DONE | UI test; present on every cloud stage |
| Play Animation (equal → final), Reset, Compare with H₂ | DONE | UI test (controls exist); animation posed with `__PP_SET_PROGRESS` in Verify |
| Colour convention explained, ESP not confused with density | DONE | UI test (colour key text) |
| Electron markers | PARTIAL | two conceptual markers wander inside the lens (not trajectories); labelled as conceptual |

## Tab 3: Molecular Polarity

| Requirement | Status | Evidence / note |
|---|---|---|
| H₂, HCl, CO₂, H₂O, BF₃, NH₃, CH₄, CH₃Cl, CCl₄, SO₂ | DONE | Model test (ids); UI test (chips) |
| Modes: Molecular Model, Bond Dipoles, Resultant Dipole | DONE | UI test; screenshots for CO₂, H₂O, BF₃, NH₃ in all three modes |
| True 3D vector sums, symmetric molecules cancel within tolerance | DONE | Model test (|net| < 1e-9 for CO₂, BF₃, CCl₄; rotation invariance) |
| Animated vector addition; "Net dipole moment = 0" when cancelling | DONE | Model test (timeline); UI test (banner after the result stage; never for polar molecules) |
| Geometry and angles | DONE | Model test (180°, 120°, 109.5°, bent / pyramidal ranges) from the VSEPR slot generator |
| Crossed-tail arrows, δ+/δ− badges | DONE | Model test (`ChemDipoleArrow`); screenshots checked (crossed tail on the δ+ atom) |
| No invented dipole moments | DONE | Model + UI tests (no debye values; relative ΔEN lengths, labelled qualitative) |
| Rotate molecule | DONE (pointer) / NOT TESTED (touch) | OrbitControls; keyboard alternative from `shared-3d` |

## Tab 4: Polarity Challenge

| Requirement | Status | Evidence / note |
|---|---|---|
| Short question types, immediate feedback with reasoning, stars / score, no timers | DONE | Model test (round structure, scoring); UI test (a full five-question round) |
| Answers cannot disagree with the Molecular Polarity tab | DONE | same model (`getMolecule`, `elementBond`) generates and checks |

## Intermolecular Forces Visualiser corrections

| Requirement | Status | Evidence / note |
|---|---|---|
| H₂ / homonuclear clouds symmetric, no permanent δ ends | DONE | `cloudInfo()` check in Verify (two identical regions); screenshots |
| HCl asymmetric with δ+ on H, δ− on Cl | DONE | Verify (Cl region larger and denser); Learn screenshots |
| Dipole–dipole: opposite charges attract, like charges repel, never δ−···δ− attraction | DONE | existing model tests kept; Learn steps 4 (attract, green) and 5 (repel, red) viewed |
| Hydrogen bonds: δ+ H on N/O/F to a lone pair on N/O/F, valid geometry | DONE (unchanged, found correct) | existing geometry tests pass; Learn H-bond step viewed |
| London dispersion: symmetric start, fluctuating instantaneous dipole, induced dipole, opposite facing charges, changes over time, no permanent label | DONE | Model test (sign flips ≥ 6 times in 40 s, zero-mean, induced dipole parallel to the source); screenshots show single instants only |
| One shared reusable electron-cloud component | DONE | `src/engines/shared-3d/electronCloud` used by both simulations |
| Existing features, ranking tasks, tests, flat-cube fallback intact | DONE | `test:imf` (106 + 25 checks) passes; two tests were updated because they pinned the erroneous behaviour (see `INTERMOLECULAR_FORCES.md`) |

## Design and robustness

| Requirement | Status | Evidence / note |
|---|---|---|
| Bright, playful-but-premium, large central visual, minimal controls | DONE | compared with the reference by eye; light-first with a dark variant |
| 1366×768, 910×512, 390×844; light and dark | DONE (software GL) | Verify: no horizontal overflow, stage size, theme per tab. A narrow-screen overflow (header sized the root) was found and fixed |
| Reduced motion | DONE | Verify: the result is shown at once; CSS animations off |
| WebGL unavailable / context lost | DONE (simulated) | Verify: canvas `getContext` forced to null; `webglcontextlost` dispatched by hand. A real GPU loss was not exercised |
| Keyboard operation | DONE | UI test (roving tabindex, buttons); Verify (Tab / Enter / arrow keys) |
| Scoped CSS | DONE | every selector is under `.pp-root` or uses the unique `pp-` class prefix; no global rules |

## Not tested

Real GPU (performance and anti-aliasing quality), real touch devices, Safari, Firefox, a screen reader. Frame rates under software GL (about 1 fps) say nothing about a GPU.
