# Polarity Playground (IB DP Chemistry S2.2.5 – S2.2.6)

A four-tab simulation (`/simulation/polarity-playground`) on electronegativity, bond polarity and molecular polarity, plus the shared
electron-density component that the corrected Intermolecular Forces Visualiser now also uses. The binding spec is
`docs/POLARITY_PLAYGROUND_SPEC.md`; the design reference is `docs/polarity-reference.png` (composition, playfulness and the four-panel
layout were followed; where the image is only illustrative the spec wins, see "Decisions where the spec and the image differ").
Per-requirement status: `docs/POLARITY_PLAYGROUND_STATUS.md`.

## Tabs

1. **Game: Electron Tug-of-War.** Two 3D characters pull a rope; the shared density between them shifts towards the more electronegative one.
   *Free Play*: two sliders (fictional atoms A and B, 0.7 to 4.0, step 0.1). *Real Atoms*: pick two real atoms; their EN values are fixed (Pauling)
   and hidden until the student predicts which atom pulls harder; feedback gives the reason. Result panel: more electronegative atom, ΔEN, bond type, partial charges.
2. **Inside a Covalent Bond.** *Bond View* (atoms + bond + two conceptual electron markers), *Electron Cloud* (the density picture), *Bond Polarity*
   (δ+/δ− and the crossed-tail dipole arrow). Pairs: H–H, Cl–Cl, H–Cl, H–F, H–Br, O–H, N–H, C–O, C–H. "Play Animation" runs equal → redistributed;
   "Compare with H₂" shows both side by side.
3. **Molecular Polarity.** H₂, HCl, CO₂, H₂O, BF₃, NH₃, CH₄, CH₃Cl, CCl₄, SO₂. Display: *Molecular Model*, *Bond Dipoles*, *Resultant Dipole*.
   The resultant mode animates: bond dipoles appear → are moved head to tail (below the molecule) → the resultant is drawn, or "Net dipole moment = 0" is
   shown when they cancel. The molecule can be dragged to rotate (and rotated with the arrow keys).
4. **Polarity Challenge.** Five short questions per round from six types (which atom is more electronegative, which is δ+, which dipole arrow is
   right, polar or non-polar, do the bond dipoles cancel, which description matches). Immediate feedback with one or two sentences of reasoning,
   progress dots, a score and 0 to 3 stars. No timers.

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

## Test and verification hooks (software GL runs at about 1 fps)

`globalThis.__PP_DT_MAX` (cap of the per-frame step), `globalThis.__PP_SEEK` (jump the animation clock once), `globalThis.__PP_SET_PROGRESS(v)` (pose a
0..1 animation exactly). They are inert in normal use.

## Tests

* `npm run test:polarity`: `scripts/test-polarity-model.mjs` (30 pure checks: data, redistribution, arrow convention, ten molecules' vector sums, timeline,
  fluctuation signal, Tug and Challenge models) and `scripts/test-polarity-ui.mjs` (14 jsdom checks: registration, four tabs, free play and real-atom flows,
  bond tab, molecule tab modes and the zero banner, a full Challenge round, keyboard / roving tabindex).
* `npm run verify:polarity`: builds, serves and drives headless Chromium: every tab at 1366×768, 910×512 and 390×844 in light and dark (overflow, theme,
  canvas, stage size), the scientific pictures (H₂, HCl, CO₂, H₂O, BF₃, NH₃ and the other molecules; the corrected IMF pictures), the no-WebGL fallback,
  context loss, reduced motion and keyboard use. Screenshots are written to the output folder for visual review.

## Limitations

* Verified with software WebGL (SwiftShader) only. Not tested: a real GPU (performance, anti-aliasing quality), touch gestures on real devices,
  Safari, Firefox, screen readers. The fallback text for the 3D stages is written to be useful to a screen reader but was not read with one.
* The simplified density model is a teaching picture: region radii are teaching radii, the size of the redistribution is a qualitative dial, and the
  two electron markers in Bond View are conceptual, not trajectories.
* Real-atom mode offers eight atoms (H, C, N, O, F, Cl, S, Br) and the molecule set is the ten required ones; extending either is a data change in
  `model/tug.js` / `model/molecules.js`.
* Orbit dragging is mouse / pointer based through drei's OrbitControls; the keyboard alternative (arrow keys rotate, +/- zoom, 0 resets) is provided by the shared stage API.
