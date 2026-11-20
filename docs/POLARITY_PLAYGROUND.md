# Polarity Playground (IB DP Chemistry S2.2.5 – S2.2.6)

A four-tab simulation (`/simulation/polarity-playground`) on electronegativity, bond polarity and molecular polarity, plus the shared
electron-density component that the corrected Intermolecular Forces Visualiser now also uses. The binding spec is
`docs/POLARITY_PLAYGROUND_SPEC.md`; the design reference is `docs/polarity-reference.png` (composition, playfulness and the four-panel
layout were followed; where the image is only illustrative the spec wins, see "Decisions where the spec and the image differ").
Per-requirement status: `docs/POLARITY_PLAYGROUND_STATUS.md`.

## Tabs

1. **Game: Electron Tug-of-War.** Two 3D characters pull a twisted two-strand rope (slack when the pull is even, taut and tightly twisted with the red
   band slid towards the stronger atom when it is not). One glowing electron cloud stretches towards the stronger atom; two clearly separate pink dots
   are the conceptual shared pair (no full electron transfer, whatever ΔEN is). *Free Play*: two sliders (fictional atoms A and B, 0.7 to 4.0, step 0.1).
   *Real Atoms*: pick two real atoms (H, C, N, O, F, Cl, S, Br, I, P, Li, Na, Mg); their EN values are fixed (Pauling) and hidden until the student
   predicts which atom pulls harder; feedback gives the reason. Result panel: more electronegative atom, ΔEN, bond type, partial charges, and the ΔEN guide.
2. **Inside a Covalent Bond.** *Bond View* (atoms + bond + two conceptual electron markers), *Electron Cloud* (the density picture, with δ+/δ− labels on
   the atoms whenever ΔEN is not 0, none for H–H), *Bond Polarity* (δ+/δ− and the crossed-tail dipole arrow). Pairs: H–H, Cl–Cl, H–Cl, H–F, H–Br, O–H, N–H,
   C–O, C–H. "Play Animation" runs equal → redistributed; "Compare with H₂" shows both side by side; "Show the shared pair (simplified)" adds two dots
   labelled as a simplification. The ΔEN guide (below) sits in the Bond Polarity card.
3. **Molecular Polarity.** The original ten (H₂, HCl, CO₂, H₂O, BF₃, NH₃, CH₄, CH₃Cl, CCl₄, SO₂) come first, then a clearly separated **More molecules**
   group (HF, HBr, CH₂Cl₂, CHCl₃, PCl₃, BeCl₂, SF₆, XeF₄ (marked HL / A level), O₃, cis- and trans-1,2-dichloroethene). Display: *Molecular Model*,
   *Bond Dipoles*, *Resultant Dipole*. The molecule fills the stage; each polar bond dipole is drawn **alongside its bond** (crossed tail on the δ+ atom,
   head towards the more electronegative atom, clear of both atoms and of the δ tags). The resultant mode animates: bond dipoles appear → slide into a
   separate "Vector sum" picture (beside the molecule on a wide stage, below it on a tall one) and are laid tip to tail → a thin separate net arrow, or for
   CO₂, BF₃, CCl₄, CH₄, H₂, BeCl₂, SF₆, XeF₄, trans-dichloroethene the chain closes on itself ("Net = 0") with the banner "Net dipole moment = 0".
   **Compare** shows two molecules side by side (default partners: CO₂ with SO₂, BF₃ with NH₃, cis with trans, ...) with a caption that geometry decides.
   Polar molecules have a button to the (corrected) Intermolecular Forces Visualiser. The molecule can be dragged to rotate (and rotated with the arrow keys).
4. **Polarity Challenge.** Five questions per round from nine types: which atom is more electronegative, which is δ+, which dipole arrow is right,
   polar or non-polar, do the bond dipoles cancel, which description matches, **rank three bonds by polarity, which of three molecules is polar /
   non-polar, which way the net dipole points**. A large picture (with δ labels where they do not give the answer away), big lettered answer buttons (none
   highlighted before answering), a green / red feedback box with the reasoning, progress dots, a final score with 0 to 3 stars, a review list and
   **Retry the ones I missed**. The pool is a few hundred distinct questions (bond pairs x molecules x types). No timers.

### Simple wording and the ΔEN guide

* **Simple wording** (header toggle "Simple wording" / "Aa") swaps labels only: "Is the bond polar?", "Is the molecule polar?", "Polar bond", "Polar molecule" and a
  one-sentence plain explanation. The chemistry is identical. Intended for IGCSE-style learners.
* **ΔEN guide**: a bar from non-polar through polar to ionic with a marker at |ΔEN| (axis 0 to 3.4), in the Tug result card and the Bond tab. It is labelled
  "rough guide only: the change is gradual, not a sharp line (IB uses the bonding triangle)". The zone edges at 0.4 and 1.8 are the platform's existing
  thresholds (`src/lib/lewis/polarity.js`); no further precision is implied.

## Architecture

```
src/engines/shared-3d/electronCloud/     SHARED (three only for the renderers; the model files are pure)
  electronegativity.js   Pauling table (2 d.p.), bond-type thresholds (imported from lib/lewis/polarity.js), visualPolarity(), tugState(), elementBond()
  densityModel.js        buildRegions(), regionRadiusAt(), bondingLens(), densityAt(), vertexDensity(), electronMarkers()  (no three)
  fluctuation.js         fluctuationSignal(t): zero-mean, bounded, sign-flipping signal for London dispersion
  icosphere.js           subdivision-3 icosphere (642 vertices, shared directions)
  ElectronCloud.js       the reusable renderer: one translucent deformable mesh per atom region, teal shader, per-vertex density
  dipoleArrow.js / ChemDipoleArrow.js   chemistry-convention dipole arrow (pure geometry + three object)
  chargeBadge.js         δ+ / δ− badges (always carry the sign, never colour alone)
src/engines/shared-3d/StudioLighting.jsx          soft studio light + environment reflections for glossy atoms
src/engines/polarity-playground/
  PolarityPlayground.jsx (+ .css)   shell, four tabs, light/dark, responsive layout classes, reduced motion
  model/  molecules.js (geometry via the VSEPR slots, bond dipoles, 3D net dipole), vectorAddition.js (timeline), tug.js, bondPairs.js, challenge.js
  scene/  Stage.jsx (canvas, camera fit, orbit, keyboard alternative, sim clock), parts.jsx, TugScene.jsx, BondScene.jsx, MoleculeScene.jsx
  ui/     one file per tab, useProgress.js, parts.jsx, Sketch.jsx (SVG sketches of the Challenge)
```

Reused (not copied): VSEPR `buildSlots` (geometry), `bondLength3D` (bond lengths), `lib/lewis/polarity.js` (bond-type thresholds), `shared-3d/GuardedFrame`
(WebGL fallback, context loss, keyboard camera API), `shared-3d/elementStyle` (element colours), `components/interactive-shell/InteractiveFrame`.

## Scientific decisions

* **Electron density, not orbitals.** Every atom contributes one smooth translucent region of electron density around its nucleus (a Venn picture in
  3D). Where two regions overlap, both atoms' density is present: that overlap is the shared bonding density. The scene always says
  "Simplified electron-density model: not to scale". No orbital shapes, no nuclear charge, no quantum calculation.
* **H₂ / any equal-EN bond.** Two identical regions, mirror-symmetric about the bond midpoint; the lens centre is exactly the midpoint; no δ charges, no dipole arrow.
* **Polar bond = redistribution, not a rigid shift.** For ΔEN ≥ the bond threshold: the *less* electronegative atom's region is drawn out towards its
  partner (a one-sided bump; its far side is untouched) and made thinner; the *more* electronegative region is slightly compacted and denser. The
  overlap therefore moves towards the more electronegative atom and stays continuous. `progress` (0..1) animates equal → final.
  Measured lens centre (as a fraction of the way from the less to the more electronegative atom): H₂ 0.500, HCl 0.536, HF 0.627. The size of the
  effect is a qualitative dial (`visualPolarity(ΔEN) = min(1, ΔEN/1.6)^0.8`), not a calculated charge distribution.
* **Colour convention (shown in the UI as "Colour key").** Teal = electron density (deeper = more concentrated); it never means charge.
  δ+ is blue (#2563eb), δ− is red (#e11d48), always together with the + or − sign. Atom colours (CPK-style) identify elements only.
  Electrostatic potential (ESP) is a different quantity: it exists only as the separate "Potential (ESP)" view of the Intermolecular Forces Visualiser,
  labelled as such.
* **Dipole arrow.** Chemistry convention: a crossed tail on the δ+ atom, the head towards the δ− atom (the opposite sense to the physics vector). The
  tail bar is kept perpendicular to the shaft and to the line of sight so it always reads as "+→".
* **Bond polarity threshold.** A bond is drawn with a dipole when ΔEN ≥ 0.4 (the IB convention already used in `lib/lewis/polarity.js`), so C–H is treated as
  non-polar and CH₄ shows no bond dipoles. The Pauling table is held to two decimals; it agrees with the IB 1-decimal table after rounding (tested).
* **No invented dipole moments.** Bond-dipole arrow lengths are proportional to ΔEN (relative, qualitative). The UI says so ("Arrow lengths show relative ΔEN
  only"), shows "μ = 0" / "μ ≠ 0" only, and quotes no debye values anywhere (tested).
* **True 3D vector sums.** The net dipole is the vector sum of the bond-dipole vectors in 3D; symmetric molecules cancel within 1e-9 (tested, also under
  rotation). Geometry comes from the VSEPR slot generator, so angles are the model angles (CO₂ 180°, BF₃ 120°, CH₄ 109.5°, H₂O 104.5°, NH₃ ≈ 107°).
  Lone pairs are shown in the Molecular Model view as translucent lobes and never get a dipole arrow.
* **Challenge.** Questions are generated from the same model (so the answers cannot disagree with the Molecular Polarity tab) and are deterministic per seed.

## Decisions where the spec and the image differ

* The image draws two touching spheres for H₂ and a rigidly displaced sphere for HCl. The spec requires overlapping translucent regions with
  redistribution, so that is what is built.
* The image's dipole arrows have no crossed tail; the spec's crossed-tail convention is used.
* The image is dark and glowing; the spec asks for a bright theme. The default is light with purple/blue accents; a tasteful dark variant follows
  the platform theme.
* "μ ≠ 0" labels from the image are kept; no numeric moments are shown.

## Intermolecular Forces Visualiser: what was corrected

See the section "Polarity Playground update" in `docs/INTERMOLECULAR_FORCES.md`.

## Vector-addition construction (audit of 2026-11-19)

Six steps: geometry and partial charges, bond arrows on the bonds, copies move, parallelogram / sequential sum completes, resultant or cancellation, classification. The
copies have exactly the length and direction of the arrow on the bond (one display scale per molecule, `arrowScale`). Two non-collinear dipoles are drawn from a common
origin with the dashed parallelogram; three or more tip to tail. Colour-matched tags d1, d2 ... mark each bond arrow and its copy, and the "Vector sum" title says
"copies moved to a common origin; directions unchanged". Zero sum: no pink arrow, "Net dipole moment, μ = 0". Non-zero: pink arrow and "Net dipole moment, μ ≠ 0 (towards X)".
Ozone's arrows are a qualitative formal-charge picture, not ΔEN (its measured dipole is small, about 0.53 D). Bond-dipole addition is a teaching model: real molecular dipoles
depend on the whole electron density, including lone pairs.

## Test and verification hooks (software GL runs at about 1 fps)

`globalThis.__PP_DT_MAX` (cap of the per-frame step), `globalThis.__PP_SEEK` (jump the animation clock once), `globalThis.__PP_SET_PROGRESS(v)` (pose a
0..1 animation exactly). They are inert in normal use.

## Tests

* `npm run test:polarity`: `scripts/test-polarity-model.mjs` (45 pure checks: data, redistribution, arrow convention, the vector sums of all 21 molecules
  including geometry (VSEPR angles, planar XeF₄ and dichloroethenes), cancellation and direction, ozone as a qualitative special case, timeline,
  fluctuation signal, Tug and Challenge models) and `scripts/test-polarity-ui.mjs` (23 jsdom checks: registration, four tabs, free play and real-atom
  flows with the new atoms and the ΔEN marker, bond tab incl. the shared-pair toggle, molecule tab modes, More molecules, Compare, the IMF link, Simple
  wording, the zero banner, Challenge rounds incl. no pre-selection, green / red feedback, retry, new question types, keyboard / roving tabindex).
* `npm run verify:polarity`: builds, serves and drives headless Chromium: every tab at 1366×768, 910×512 and 390×844 in light and dark (overflow, theme,
  canvas, stage size), the scientific pictures (H₂, HCl, CO₂, H₂O, BF₃, NH₃ and the other molecules; the corrected IMF pictures), the no-WebGL fallback,
  context loss, reduced motion and keyboard use. Screenshots are written to the output folder for visual review.

## Limitations

* Verified with software WebGL (SwiftShader) only. Not tested: a real GPU (performance, anti-aliasing quality), touch gestures on real devices,
  Safari, Firefox, screen readers. The fallback text for the 3D stages is written to be useful to a screen reader but was not read with one.
* The simplified density model is a teaching picture: region radii are teaching radii, the size of the redistribution is a qualitative dial, and the
  two electron markers in Bond View are conceptual, not trajectories.
* Real-atom mode offers thirteen atoms and the molecule set is 21; extending either is a data change in `model/tug.js` / `electronegativity.js` and `model/molecules.js`.
* Orbit dragging is mouse / pointer based through drei's OrbitControls; the keyboard alternative (arrow keys rotate, +/- zoom, 0 resets) is provided by the shared stage API.

## Extra content for other curricula (IGCSE, A level) and what is tagged

IB DP stays the primary target and the IB-specific parts are marked. The extras are additions, not replacements.

* **More molecules** (all geometry from the shared VSEPR slot generator, every verdict a true 3D vector sum of bond dipoles; no stored dipole moments):
  HF and HBr (diatomic, one polar bond), CH₂Cl₂ and CHCl₃ (tetrahedral, C–H treated as non-polar by the 0.4 cut-off, net dipole towards the Cl side),
  PCl₃ (trigonal pyramidal, polar), BeCl₂ (linear, gas phase, cancels), SF₆ (octahedral, cancels), XeF₄ (square planar, cancels; marked "HL / A level"),
  cis-1,2-dichloroethene (planar, polar) and trans-1,2-dichloroethene (planar, cancels): the same bonds, different geometry, different polarity.
* **Ozone (O₃)** is an explicit special case. Every bond is O–O so ΔEN is 0 and there are **no** electronegativity bond dipoles; ozone is slightly polar because
  of the bent shape and unequal formal charges. The arrows drawn for it (from the central O, δ+, to each terminal O) are labelled qualitative and are
  not derived from ΔEN. The bond angle shown is the measured one, 116.8° (SO₂ 119.3°, PCl₃ 100.3° are set the same way; the other shapes use the VSEPR slot angles).
* **Pauling values used for Real Atoms** (fixed, two decimals, checked against two independent published tables on the day of the change: the Sydney
  University first-year chemistry "Pauling Electronegativities" sheet, https://scilearn.sydney.edu.au/fychemistry/Pauling%20Electronegativities.pdf, and the
  New World Encyclopedia "Pauling scale" table, https://www.newworldencyclopedia.org/entry/Pauling_scale; the same values are the usual CRC Handbook / WebElements
  ones): Li 0.98, Na 0.93, Mg 1.31, P 2.19, S 2.58, Br 2.96, I 2.66 (and Xe 2.60 for XeF₄). The existing values for H, C, N, O, F, Cl, B, Be, Al, Si
  are unchanged and still agree with the IB data-booklet table to one decimal (tested). Note the IB data booklet lists one-decimal values; the 2-decimal
  Pauling values are shown, so e.g. C–Cl ΔEN is 0.61 here, 0.6 from the booklet.
* **Syllabus tags.** `src/data/curricula/dp-chemistry/syllabus-points-2025.js` does contain S2.2.5 (bond polarity) and S2.2.6 (molecular polarity) and
  `2025.js` already lists the concepts `electronegativity`, `bond-polarity` and `molecular-polarity` under *structure-2.2*. The simulation catalogue, however, only
  accepts topic-level codes (`/^[SR]\d\.\d+$/`, enforced by `test:simulation-library`), so the entry stays **`S2.2`**. The simulation's own header names S2.2.5 – S2.2.6.
  Nothing is tagged for IGCSE or A level: no curriculum map for them exists on the platform.
* **Which parts fit which curriculum (a note, not a tag):** IGCSE: electronegativity idea (Tug game), polar and non-polar molecules with the Simple wording
  toggle, HF / HCl / HBr, water, ammonia, CO₂, CH₄. A level: bond polarity, dipole cancellation by geometry (SF₆, BeCl₂, BF₃, cis / trans), PCl₃, CH₂Cl₂,
  CHCl₃, XeF₄. IB HL: XeF₄ and expanded octets; the bonding triangle is mentioned in the ΔEN guide but not drawn.
