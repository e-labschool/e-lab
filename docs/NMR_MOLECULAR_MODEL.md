# NMR molecular model (Spectroscopy Studio, molecular side)

Location: `src/engines/spectroscopy-studio/nmr/molecular/`. Exports (`index.js`), each taking one prop `studio`:
`MolecularProcessStage`, `SpectrumStage`, `InterpretationStage` (challenges 3 to 6), `SplittingLab` (the "Splitting Patterns" tab), plus `MOLECULES` / `getMolecule`.

Every spectrum shown is **predicted / idealised, built from representative values. It is not an experimental spectrum.** The text
"Predicted/idealised spectrum — representative values; not an experimental spectrum." is shown with every plot.

## Layout of the code

| Folder | Content |
| --- | --- |
| `model/molecules.js` | Molecule data (9 molecules), atoms, bonds, environments, couplings, provenance. |
| `model/geometry.js` | 3D coordinates generated from the bonded graph (booklet bond lengths, ideal angles, staggered conformers). |
| `model/topology.js` | Colour-refinement equivalence classes and H-C-C-H neighbour derivation, used to cross-check the declared data. |
| `model/spectrum.js` | First-order splitting, Pascal intensities, Lorentzian line shape, integration, and the zoom/pan view model. |
| `model/linking.js` | Selection model shared by the 3D view and the spectrum (both directions). |
| `model/shielding.js` | Qualitative electron-density colouring and the chemical-shift relationships. |
| `model/challenges.js` | Question generation / checking for challenges 3 to 6. |
| `components/` | React components (r3f molecule viewer with SVG fallback, spectrum plot, stages, `molecular.css`, all classes prefixed `nm-`). |

All of `model/` is pure JavaScript with no React or DOM, and is covered by `scripts/test-nmr-molecular.mjs`.

## Data model

A molecule is declared with its heavy atoms and bonds. Hydrogens are **derived** from standard valences (H, C = 4, O = 2) so a
molecule cannot be declared with an impossible hydrogen count. Each declared environment lists the heavy atoms that carry it and then receives its
hydrogens, count, colour, letter, dash pattern and marker shape (non-colour cues).

An environment carries: `delta` (representative, ppm), `range` (the typical range quoted by the source), `basis`
(`booklet` = inside a row of the IB Chemistry data booklet 2025 section 21, `reference` = from a literature compilation or a specification value
just outside or without a booklet row), `bookletRow` (the row, quoted), `note`, `descriptor`, `exchangeable`, `linewidthHz`, `exchangeNote`, `verified`
(the source it was checked against, when it was) and `specValue` (value fixed by the project specification).

Couplings are declared as pairs of environments with `J` in Hz. Environments are ordered by delta descending (a is the leftmost signal).

**Consistency checks (tested).** The test suite recomputes the equivalence classes of the hydrogens from the bond graph (colour refinement) and
requires them to equal the declared environments. It also derives the H-C-C-H neighbour counts from the graph and requires them to equal the
declared couplings (exchangeable O-H and equivalent hydrogens excluded). Geometry is checked against bond lengths and angles.

## Molecules and values

All shifts are in ppm and are **representative**, not measurements. J is in Hz.

| Molecule | Environment (letter, H) | delta | Source / basis |
| --- | --- | --- | --- |
| Methane | CH4 (a, 4) | 0.2 | Specification value; reference-type (no booklet row). |
| Ethane | CH3 (a, 6) | 0.9 | Booklet "CH3 0.9-1.0"; specification value. |
| Propane | CH2 (a, 2) | 1.3 | Booklet "CH2-R 1.3-1.4". |
| | CH3 (b, 6) | 0.9 | Booklet "CH3 0.9-1.0". |
| Propanone | CH3 (a, 6) | 2.1 | Specification value, just below the booklet row "R-C(=O)-CH2- 2.2-2.7"; acetone is 2.17 in CDCl3 (Gottlieb et al. 1997). |
| Ethanol | CH2 (a, 2) | 3.7 | Booklet "R-O-CH2- 3.3-3.7"; 3.72 (q) in CDCl3, Gottlieb et al. 1997. |
| | OH (b, 1) | 2.6 | Booklet "R-O-H 1.0-6.0"; placeholder in a variable range (specification value). |
| | CH3 (c, 3) | 1.2 | Booklet "CH3 0.9-1.0" is just below; 1.25 (t) in CDCl3, Gottlieb et al. 1997. |
| Ethyl ethanoate | OCH2 (a, 2) | 4.1 | Booklet "R-C(=O)-O-CH2- 3.7-4.8"; 4.12 (q), Gottlieb et al. 1997. |
| | CH3CO (b, 3) | 2.0 | Booklet "RO-C(=O)-CH2- 2.0-2.5"; 2.05 (s), Gottlieb et al. 1997. |
| | CH3 (c, 3) | 1.2 | 1.26 (t), Gottlieb et al. 1997. |
| Propan-1-ol | OCH2 (a, 2) | 3.6 | Booklet "R-O-CH2- 3.3-3.7". |
| | OH (b, 1) | 2.6 | Booklet "R-O-H 1.0-6.0"; placeholder. |
| | CH2 (c, 2) | 1.6 | Typical value for a CH2 beta to oxygen; recalled, not checked against a supplied source. |
| | CH3 (d, 3) | 0.9 | Booklet "CH3 0.9-1.0". |
| Propan-2-ol | CH (a, 1) | 4.0 | 4.04 (septet, J = 6 Hz), Gottlieb et al. 1997. |
| | OH (b, 1) | 2.6 | Booklet "R-O-H 1.0-6.0"; placeholder. |
| | CH3 (c, 6) | 1.2 | 1.22 (d, J = 6 Hz), Gottlieb et al. 1997. |
| Ethanal | CHO (a, 1) | 9.8 | Booklet "R-C(=O)-H 9.4-10.0"; specification value. |
| | CH3 (b, 3) | 2.2 | Booklet "R-C(=O)-CH2- 2.2-2.7"; specification value. |

**Coupling constants.** 7 Hz for a freely rotating alkyl H-C-C-H pair (typical 6 to 8 Hz); 6 Hz for propan-2-ol (matches the
quoted Gottlieb value); 2.9 Hz for ethanal CHO to CH3 (recalled literature value, **not verified against a supplied source**; the pattern is a quartet/doublet with a small J).

**Verification status.** The values marked "Gottlieb" were checked against J. Org. Chem. 1997, 62, 7512 during development. Booklet rows were read from the rendered
booklet (2025, section 21). The following were **not** checked against a supplied source: propane, propan-1-ol (all), the methane/ethane/ethanal values beyond
the specification and booklet rows, ethanal J, and the propan-1-ol CH2 at 1.6. They are typical values, flagged in the UI as representative. Nothing was omitted.

Bond lengths used for the 3D geometry come from the booklet's covalent bond length table: C-H 1.08, C-C 1.54, C-O 1.43, O-H 0.97, C=O 1.22 angstrom.
Angles: 109.47 degrees at sp3, 120 degrees at sp2 carbon, C-O-H 108.5 degrees, ester C-O-C 116 degrees (idealised). The ester is in the Z conformation; chains are staggered.

## Spectrum model

* Position: nu = delta x nu0 relative to TMS. Hz = ppm x MHz. delta is independent of spectrometer frequency; J in Hz is independent of delta.
* First-order splitting: each neighbouring hydrogen divides every line into two separated by J. n equivalent neighbours give n + 1 lines with Pascal
  intensities. Several different neighbour sets are applied by successive splitting (convolution); with equal J the lines coincide into an apparent multiplet.
* Line shape: Lorentzian, FWHM 1.2 Hz by default, 12 Hz for exchangeable O-H. Peak height of the integrated signal falls as it splits; **area is conserved** (area of a multiplet = H count, tested).
* Sampling: a uniform grid plus extra equal-area points around each line so narrow lines are not missed at any zoom.
* Integration: cumulative integral of the intensity; steps are proportional to the number of H. Challenge 4 shows the integral in arbitrary units per molecule, not proton counts.
* Axis: higher delta on the left; TMS labelled at 0; limits -2 to 14 ppm; minimum span 0.02 ppm.
* Larmor: nu0 = 42.577478 MHz per tesla x B0.
* Exchangeable O-H: shown as a broadened singlet that does not split, and does not split its neighbours, with the stated reason and the caveat that this is not general.

## Linking and state

Environment ids and multiplet ids (`m-<envId>`) always change together. Selecting a hydrogen, a peak, a chip, an integral or a shift
marker selects the whole environment in the 3D view and the spectrum. Coupled neighbours are drawn with a dashed outline and a hatched band (not colour alone).
Per-molecule progress (which environments are built, coupling on, ...) is held in a module-level store and keyed on the studio `resetToken`, so it survives switching stages.
Student mode requires prediction before reveal (number of signals, area ratio, multiplicity); teacher mode adds annotations and limitations.

## Qualitative shielding colouring

Heavy atoms are coloured from the summed Pauling electronegativity differences to their neighbours (C 2.55, O 3.44, H 2.20); hydrogens are coloured from the delta of their environment.
This is explicitly labelled **qualitative** in the UI. It is not a computed electron density or electrostatic potential. Relationships shown: B_eff = B0 (1 - sigma); delta = (nu - nu_ref) / nu_ref x 10^6; offset in Hz = delta x nu0 (MHz); field difference = B0 x delta x 10^-6 (a few tens of microtesla at 9.4 T).

## Approximations and limits

* Strictly first order. Real multiplets with different J, or a small chemical-shift difference compared with J, show second-order effects (roofing, extra lines) that are not modelled. Propan-1-ol CH2 is shown as an apparent sextet with an explicit caveat; its true pattern is more complex.
* Only 1H, only the nine library molecules (C, H, O). No long-range coupling, no diastereotopic H, no conformational averaging beyond fast rotation.
* Exchangeable OH is modelled as a singlet. Real behaviour depends on solvent, concentration, temperature and water.
* No solvent effects; shifts are single representative numbers, not the full booklet ranges (ranges are quoted).
* The 3D geometry is idealised (generated, not optimised); it is for topology and relationships, not for accurate structure.
* At 400 MHz and a full-range view the multiplets are narrow; use the zoom inset, scroll/pinch zoom or "Zoom to selected".

## Testing

* `npm run test:nmr-molecular`: model tests (derivation, Pascal, Lorentzian area, units, linking, challenges) and jsdom UI tests of the four components in their SVG-fallback mode.
* `node scripts/verify-spectroscopy-studio.mjs`: headless Chromium (Playwright, SwiftShader software WebGL) at 1366x768, 1440x900, 1920x1080, 820x1180 and 390x844 against the real workspace. This is not a real GPU, not real touch hardware and Chromium only.

## Update: single-workspace refactor

* Removed: `MolecularProcessStage`, `SpectrumStage`, `InterpretationStage`, `SplittingLab`, `SplitDiagram`, `ShieldingExplorer`, `useStageState`, `molecularBridge`, and the Splitting Patterns tab. The stand-alone harness and `verify-nmr-molecular.mjs` were retired; `verify-spectroscopy-studio.mjs` covers the molecules in Step 6.
* Added: `model/spinStates.js` (2^n spin-state enumeration, line counts n+1), `model/moleculeFid.js` (FID synthesised from the multiplet lines; used by Step 5), `components/ShieldingDiagram.jsx`.
* `nmr/molecular/index.js` now exports `MoleculeViewer`, `SpectrumPlot`, `MoleculePicker`, `ShieldingDiagram`, `MOLECULES`, `getMolecule`. `MoleculePicker` accepts a null value. `useSelection.js` exports only `useLinkedSelection`.
* Molecule state (`identified`, `coupled`, `spinStates`, `integrated`) lives in the studio store and is reset on molecule change.
