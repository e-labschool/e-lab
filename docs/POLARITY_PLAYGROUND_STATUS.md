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
| Real-atom set | DONE | thirteen atoms (adds I, P, Li, Na, Mg); fixed Pauling values, sources in POLARITY_PLAYGROUND.md; UI test |
| Twisted rope that tightens and slides towards the stronger atom; rounder arms and hands; two separate dots; ONE glowing cloud stretching towards the stronger atom | DONE (by eye) | looked at in screenshots; still simpler than the reference's illustration; the cloud reads as a flat egg rather than a glowing teardrop |
| ΔEN guide (non-polar → polar → ionic) with a moving marker, labelled rough | DONE | UI test (marker moves; text says rough guide) |

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
| δ+ / δ− labels on the atoms in the Electron Cloud view when ΔEN ≠ 0, none for H₂ | DONE | screenshots; UI test (H–H has none) |
| Optional "Show the shared pair" (two dots, labelled a simplification) | DONE | UI test; screenshot |

## Tab 3: Molecular Polarity

| Requirement | Status | Evidence / note |
|---|---|---|
| H₂, HCl, CO₂, H₂O, BF₃, NH₃, CH₄, CH₃Cl, CCl₄, SO₂ | DONE | Model test (ids); UI test (chips) |
| Extras: HF, HBr, CH₂Cl₂, CHCl₃, PCl₃, BeCl₂, SF₆, XeF₄ (HL), O₃, cis / trans-C₂H₂Cl₂ in a separate "More molecules" group | DONE | Model test (geometry, cancellation, direction, cis vs trans); UI test; screenshots. O₃ is a labelled qualitative special case |
| Bond arrows alongside the bonds (clear of atoms and tags); thin separate net arrow; cancelling cases tip to tail ending at zero; molecule about 2x larger and fitted | DONE (by eye) | Model test (chain end = vector sum, closes for cancelling); screenshots at three sizes. Atoms in 3D can still overlap each other from some viewing angles (CCl₄, CHCl₃) until rotated |
| Compare two molecules (e.g. CO₂ vs SO₂), caption that geometry decides | DONE | UI test; screenshot |
| Button from polar molecules to the IMF simulation | DONE | UI test (href, rel) |
| Simple wording toggle | DONE | UI test |
| Modes: Molecular Model, Bond Dipoles, Resultant Dipole | DONE | UI test; screenshots for CO₂, H₂O, BF₃, NH₃ in all three modes |
| True 3D vector sums, symmetric molecules cancel within tolerance | DONE | Model test (|net| < 1e-9 for CO₂, BF₃, CCl₄; rotation invariance) |
| Animated vector addition; "Net dipole moment = 0" when cancelling | DONE | Model test (timeline); UI test (banner after the result stage; never for polar molecules) |
| Geometry and angles | DONE | Model test (180°, 120°, 109.5°, bent / pyramidal ranges) from the VSEPR slot generator |
| Crossed-tail arrows, δ+/δ− badges | DONE | Model test (`ChemDipoleArrow`); screenshots checked (crossed tail on the δ+ atom) |
| No invented dipole moments | DONE | Model + UI tests (no debye values; relative ΔEN lengths, labelled qualitative) |
| Rotate molecule | DONE (pointer) / NOT TESTED (touch) | OrbitControls; keyboard alternative from `shared-3d` |

### Molecular Polarity: audit against `docs/POLARITY_MOLECULAR_AUDIT_SPEC.md` (2026-11-19)

Checked with the new "Audit of every molecule" block of `scripts/test-polarity-model.mjs` (all 21 molecules: classification, geometry, angles, bond-dipole directions, delta labels, 3D sum with tolerance, rotation invariance, direction towards the expected atoms, no pink arrow when the sum is zero, six-step order, tag plan) and by looking at screenshots (`verify:polarity` output and a dedicated run, 1366x768 and 390x844).

| Item | Status | Note |
|---|---|---|
| Classification, bond-dipole directions, delta+/delta- labels, 3D sums, resultant directions of all 21 molecules | DONE (already correct) | no change needed; now pinned by tests (HCl/HF/HBr to the halogen, H2O to O, NH3 to N, CH3Cl to Cl, SO2 along the bisector, O3 to the end O atoms) |
| Bond angles | CORRECTED | the VSEPR slot generator only gives the ideal / generic angles. PCl3 was 107 (measured 100.3), O3 119.5 (measured 116.8), SO2 119.5 (measured 119.3): now built with those angles (`angle` in `MOLECULE_SPECS`). H2O 104.5 and NH3 107 unchanged. CH3Cl, CH2Cl2, CHCl3 and the dichloroethenes still show the ideal 109.5 / 120 (measured values differ by about 1 to 3 degrees); labelled "about" |
| Copies keep magnitude and direction | CORRECTED | the arrow ON the bond was shorter than its copy in the vector-sum picture (e.g. H2O 0.86 vs 1.40), so the arrow stretched while it moved. One display scale per molecule (the largest at which every bond arrow fits along its bond) is now used for the bond arrow, its copy and the resultant; tested for all molecules |
| Match each copy to its bond | ADDED | small colour-matched tags d1, d2, ... on every bond arrow and on its copy (only when two or more arrows are drawn); caption in the "Vector sum" title: "copies moved to a common origin; directions unchanged" (parallelogram) / "copies placed tip to tail; directions unchanged" (three or more). The two-vector parallelogram from a common origin and the tip-to-tail chain are kept |
| Single bond dipole (HCl, HF, HBr, CH3Cl) | CORRECTED | the pink resultant was hidden behind the identical yellow arrow; it is now drawn beside it (display-only sideways nudge) |
| Labels | CORRECTED | "Net dipole moment, μ ≠ 0 (towards X)" banner for polar molecules (with the explanation in the caption) and "Net dipole moment, μ = 0" for cancelling ones; before, only the zero case had a banner and the polar label said "Net dipole, μ ≠ 0" |
| Six-step animation | CORRECTED | before, steps 4 and 5 ran together and there was no step 1 or 6. Now 1 geometry + partial charges (0 to 10 %), 2 bond arrows on the bonds, 3 copies move (tip-to-tail copies one after another), 4 parallelogram completed / sum finished, 5 resultant or cancellation, 6 classification + explanation (from 90 %). Step label "Step n of 6: ..." under the stage. Replay and Reset unchanged |
| Ozone | PARTLY VERIFIED | all O-O bonds, so no ΔEN dipoles; arrows follow the resonance / formal-charge picture (central O delta+, end O delta-) and are flagged qualitative. Measured dipole is small (0.53 D, LibreTexts / WebQC; bond angle 116.8 degrees). I could not confirm the SIGN of the real dipole or the atomic charges from a primary source (one source lists the opposite charge assignment; computed atomic charges depend on the method), so the direction is the textbook formal-charge picture, stated as such on the tab |
| Camera / layout | ADJUSTED | the initial camera elevation of this tab is a little higher (tilt 0.35 instead of 0.08) so pyramids and tetrahedra open up; the vector-sum title sits clear of the delta tags on narrow screens; the diagram is at least 4.2 units wide so the title is not clipped |
| Rotating the molecule | NOT VISUALLY TESTED | the model test rotates every molecule and checks that verdict, magnitude and vector rotate together (no mirroring or reversal). The panel arrows and tags are objects in the same 3D scene (the same vectors, one camera), so they cannot be mirrored relative to the molecule. In software GL a synthetic drag or arrow keys did not move the camera in my screenshots, so interactive rotation was not seen |

## Tab 4: Polarity Challenge

| Requirement | Status | Evidence / note |
|---|---|---|
| Short question types, immediate feedback with reasoning, stars / score, no timers | DONE | Model test (round structure, scoring); UI test (a full five-question round) |
| Answers cannot disagree with the Molecular Polarity tab | DONE | same model (`getMolecule`, `elementBond`) generates and checks |
| Uses the whole panel: large molecule picture with δ labels, big lettered answer buttons, nothing pre-highlighted | DONE (by eye) | UI test (no option highlighted before answering); screenshots at three sizes |
| Green / red feedback box with reasoning; end-of-round score, stars, review, retry of wrong answers | DONE | UI test (full wrong round → retry the same five → 5/5, 3 stars) |
| More types (rank bonds, pick the polar / non-polar molecule, dipole direction) and a bigger pool | DONE | Model test (all nine types appear; pool of 40+ distinct prompts over 30 seeds) |

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

## Curriculum extras

| Item | Status | Note |
|---|---|---|
| Syllabus tag S2.2.5 / S2.2.6 | NOT DONE (deliberately) | the points exist, but the catalogue only accepts topic-level codes; the entry stays `S2.2` |
| IGCSE / A level tags | NOT DONE (deliberately) | no curriculum map exists on the platform; the docs say which parts fit |

## Still short of the reference image

* The Tug characters are simpler than the reference's illustration, and the cloud is an egg-shaped translucent blob with a halo rather than a soft glowing teardrop.
* The reference CO₂ is drawn as a clean flat picture; here the molecule is a real 3D model with the arrows beside the bonds, so from some angles atoms overlap.
* Dark theme is a restrained variant, not a second full illustration.

## Not tested

Real GPU (performance and anti-aliasing quality), real touch devices, Safari, Firefox, a screen reader. Frame rates under software GL (about 1 fps) say nothing about a GPU.
