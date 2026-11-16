# Bonding and Spectroscopy: fixes made

Companion to `docs/sim-review/bonding-spectroscopy.md` (findings BS-01 to BS-38). This file says what was changed, how it was checked, what was not done and what the owner should decide. It reports only what was actually run.

## 1. What changed, by area

### A. Front page (featured set)
- `src/data/simulationCatalogue.js`: new documented constant `FEATURE_WHEN_READY = false`. An entry flagged `featureWhenReady` is featured only when the constant is `true`.
- Featured now: **VSEPR (3D), Heating / cooling curve, Hybridisation (3D)**. Electron Configuration is no longer featured. Build an Atom, Collision Theory, Buffer Action and Bonding are flagged `featureWhenReady` (switch the constant to `true` to bring them back).
- Hero demo (`LiveDemo.jsx`): the first featured simulation is VSEPR, which loads lazily (nothing 3D is mounted, and no WebGL context is created, until the visitor presses Run or "Try a simulation"). If WebGL is unavailable the hero keeps the static thumbnail and shows "This 3D demo needs WebGL ..." with no dead Run button. WebGL is probed only after the visitor asks.
- Thumbnails were **not** re-captured.

### B. VSEPR (`src/engines/vsepr-explorer-3d`)
Phone molecule list; label clipping (`depthTest` off on labels); non-overlapping angle labels (SF4, BrF5); honest "impossible / unlikely / model" labelling (XeF6, HO3, ...); trans-lone-pair wording; ion presets (NH4+, H3O+, CO3 2-, NO3-, SO4 2- and more, with `charge` in the model); `h2s` dangling-preset fixed; a scored challenge mode (seeded rounds of 8 by level, hints, streak, summary; results are session only).

### C. Bonding (`src/engines/bonding-visualizer`)
Covalent library broadened (CO2, N2, O2, HCN, C2H4, C2H2, CO, NH4+, H3O+, ...); coordinate (dative) bonds with donor bookkeeping and an orange arrow; polarity at IB level (data-booklet Pauling electronegativities, dipole arrow, delta labels, category text); phone layout (stage first, wrapped group tabs, legend moved); metallic mode with no WebGL: every control disabled with a visible reason; one shared element colour/radius table.
Also fixed during browser verification: with 2 or 4 ligands the starting positions pushed the top and bottom atoms out of the canvas (CO2, NH4+); an even number of ligands now starts half a step round.

### D. Hybridisation (`src/engines/hybridisation-explorer`)
sp / sp2 / sp3 only by default. A "Beyond the IB course (d-orbital hybrids)" switch (off by default) unlocks sp3d / sp3d2, the d row of the energy panel, the d promotions and Xe. Turning it off while the workspace uses d orbitals resets the workspace with a note. Ground-state carbon (and Be, B, Si) gets an explanation of why promotion is needed. New molecules: BeCl2, BF3, HCN, ethanol (all compile with zero overlap-engine problems). Benzene and BF3 open from above the ring to reduce clutter.

### E. Intermolecular forces (`src/engines/intermolecular-forces-visualiser`)
- New third tab **Boiling points**: seven predict-first sets (halogens, noble gases, alkanes, C5H12 isomers, hydrogen halides, period-2 hydrides, similar-mass propane / ethanal / ethanol). The student orders them with up / down buttons (keyboard friendly), then "Check my order" reveals the boiling points, the force types and one reason per substance, plus the score.
- **Alkane homologous series** (shown with the alkane set): slider for 1 to 8 carbons, electron count, boiling point, an SVG chart and a sentence on London dispersion.
- First view: `START_GAP` 6 A to 1.0 A, so two newly added molecules already show an interaction.
- Heating view: atoms drawn 1.9x instead of 1.4x, camera closer, region labels on the heating graph no longer collide with the axis ticks or each other.
- No WebGL: Explore now shows a flat side view of the placed molecules (the Boiling points tab never needed WebGL).

### F. Cross-cutting (`src/engines/shared-3d`)
One shared module used by all four 3D engines and the hero: `elementStyle.js` (one colour table), `useStageGuard.js` (`webglcontextlost` / `restored` in the capture phase; canvas remount on restore), `CameraKeyApi.jsx` + `stageKeys.js` + `StageShell.jsx` (arrow keys orbit, +/- zoom, 0 resets, focus ring, visible key help), `GuardedFrame.jsx` (frame for the simple stages), `useReducedMotion.js`. The three simple stages (bonding metallic / lattice / molecule) use `GuardedFrame`; VSEPR, Hybridisation, IMF stage and IMF cube use the hook directly. Phone layout: each of the four workspaces puts the 3D stage first through scoped CSS (`order: -1` on the chamber column); the shared `SimulationDashboard` was not edited. Colour change worth knowing: for label contrast (WCAG 4.5:1) O is now `#d93a30` and the label text on F, Cl, Na, Ca is dark instead of white.

### G. Spectroscopy (trivial fixes only)
MS stage 6: the instrument overview is hidden (it shrank to an unreadable strip); the spectrum's y-axis title shortens to "Rel. intensity (%)" when the panel is short; "A subscript r" glyphs replaced by "Ar".

## 2. Verification actually run

| Level | What |
| --- | --- |
| Pure-logic tests | `test-vsepr-model` 40, `test-bonding-model` 52, `test-hybridisation-model` 50, `test-imf-model` 104, `test-shared-3d` 7 (colour table, keyboard maths, GuardedFrame incl. simulated context lost / restored), `test-simulation-library` featured-set test |
| jsdom UI tests | `test-vsepr-ui` 20, `test-bonding-ui` 27, `test-hybridisation-ui` 18, `test-imf-ui` 21, `test-ms-ui` 23 |
| Chromium (headless SwiftShader) | `scripts/verify-bonding-group.mjs` (modules in `scripts/verify-bonding-group/`: vsepr, bonding, hyb, imf, landing) at 1366x768, 910x512 and 390x844, light and dark: no console errors, no page overflow, no clipped controls, stage before controls on phones, keyboard orbit / zoom, simulated context loss and restore, no-WebGL fallbacks, ranking tab. `scripts/verify-ms-spectrometry.mjs` re-run at 1366x768 and 390x844: 256 checks, 0 problems. |
| Build | `npm run build` succeeded; `npm test` passed (exit 0) |

Not covered: a real GPU, real touch hardware, Safari, Firefox, screen readers. Context loss is simulated with `WEBGL_lose_context`, not a real driver reset.

Assertions changed because behaviour was genuinely wrong or intentionally changed: Hybridisation element list is 11 (Xe only with the switch), molecule count 15; `bent3` default angle 118 to 119.5; bonding example sets and crowding list (library broadened); electron conservation now subtracts the charge; the bonding no-WebGL metallic test now expects disabled controls; MS stage 6 verify expects the overview hidden. Some timing assertions (hybridisation "<100 ms", bonding SF6 animation, structure session restore) failed once or twice under heavy machine load and passed alone and on the final full run; they are load-sensitive.

## 3. Chemistry values: what was verified

- Verified online this session: hydronium H-O-H about 113 degrees (Wikipedia, citing Tang and Oka); alkane boiling points and pentane isomers (Potsdam alkane data table: methane -161.6, ethane -88.7, propane -42.1, butane 0, pentane 36.1, isopentane 27.9, neopentane 9.4, hexane 68.8, heptane 98.3, octane 125.5; stored rounded to whole degrees); school-level SO3 2- about 109, NO2- about 120, NO2+ 180 (docbrown).
- **Not verified online** (textbook values, flagged here): H2S 92.1, O3 116.8, SO3 2- 106, NO2- 115, SF4 / BrF5 model angles, data-booklet electronegativities used by the polarity panel, boiling points of the halogens, noble gases, hydrogen halides, period-2 hydrides, propane / ethanal / ethanol. WebFetch was blocked for most sites and search returned no snippets.

## 4. Status of every finding

Fixed = the described problem no longer occurs and was checked at the level in section 2. Partly = improved, something in the finding remains.

| ID | Status | Note |
| --- | --- | --- |
| BS-01 | Fixed | Molecule list visible on phones (Chromium check at 390x844, both themes). |
| BS-02 | Fixed (not visually confirmed) | Label depth test off; no pixel comparison was made. |
| BS-03 | Fixed | SF4 / BrF5 labels do not overlap (measured in Chromium). |
| BS-04 | Fixed | Trans lone pairs give exact angles in the wording. |
| BS-05 | Fixed | Impossible and unlikely species are labelled honestly. |
| BS-06 | Partly | Ions and polyatomic species added; molecules with more than one central atom not added. |
| BS-07 | Fixed | Scored, seeded, hinted rounds. Lewis-structure step not added; results are not saved. |
| BS-08 | Partly | Keyboard orbit / zoom added; no keyboard dragging of domains. |
| BS-09 | Partly | Context-lost recovery added; no 2D depiction of the shape without WebGL. |
| BS-10 | Not done | Continuous rendering and double probe unchanged (probe contexts are released at once). |
| BS-11 | Not done | Three "Reset" controls unchanged. |
| BS-12 | Partly | bent3, SF4 and BrF5 model angles fixed; other species not re-audited. |
| BS-13 | Fixed | Stage first in VSEPR, Bonding, Hybridisation and IMF (Chromium, 390x844). Sticky stage not needed. |
| BS-14 | Fixed | CO2, N2, O2, HCN, C2H4, C2H2, CO, NH4+, H3O+ and more; coordinate bonds; polarity. |
| BS-15 | Not done | No predict-observe layer in the Bonding modes. |
| BS-16 | Partly | Stage first, wrapped tabs, legend moved; ionic atom size on a phone not changed. |
| BS-17 | Fixed | Metallic: controls disabled with a reason. Ionic lattice already showed a notice. |
| BS-18 | Fixed | One colour table (tested across VSEPR, Bonding, IMF); Hybridisation uses its own orbital palette, not element colours. |
| BS-19 | Not done | First screen still blank; reasons are visible in the explanation line. |
| BS-20 | Not done | Idle re-render loop unchanged. |
| BS-21 | Fixed | d hybrids behind a switch, off by default. |
| BS-22 | Partly | Explanation added; mixing ground-state carbon to sp2 is still allowed. |
| BS-23 | Partly | BF3, BeCl2, HCN, ethanol added; N2, O2, NH4+ not. |
| BS-24 | Partly | Benzene and BF3 camera from above; lobe clutter and floating labels otherwise unchanged. |
| BS-25 | Partly | Keyboard camera; no keyboard way to bring atoms into overlap. |
| BS-26 | Fixed | Stage first on phone. |
| BS-27 | Partly | Boiling-point ranking and alkane series done; solubility and volatility tasks not. |
| BS-28 | Partly | Bigger atoms, closer camera, graph labels fixed; the cluster still fills a small part of the cube. |
| BS-29 | Fixed | Start gap 1.0 A; first view shows an interaction. |
| BS-30 | Partly | Explore has a flat side view; Heat and Learn still show only the notice. |
| BS-31 | Partly | Stage first; the 6/6 cap is still announced only by the counter and a short notice. |
| BS-32 | Partly | Keyboard orbit added; the heating cube does not freeze under reduced motion and the graph has no live description. |
| BS-33 | Not done | Owner decision (see below). |
| BS-34 | Fixed (y-title not visually confirmed) | Overview hidden at stage 6; title shortened on short panels. |
| BS-35 | Fixed | Replaced by "Ar". |
| BS-36 | Not done | Library breadth in NMR / MS / IR / Structure. |
| BS-37 | Not done | Empty bar in Structure Investigation. |
| BS-38 | Not done | Clipped technique tabs on a phone. |

## 5. Known issues

- BS-02, the MS y-axis title and the heating view were checked by screenshot or by script only where stated above; there was no side-by-side pixel comparison.
- In the NH4+ Bonding structure the delta-minus label on N can sit behind an H sphere.
- The Bonding no-WebGL test uses a test hook (`globalThis.__ELAB_ASSUME_GL`) because jsdom has no WebGL.
- Context-lost handling is untested on a real GPU driver reset.

## 6. Decisions for the owner

1. **FEATURE_WHEN_READY**: set to `true` when Build an Atom, Collision Theory, Buffer Action and Bonding are ready to join the front page (then the grid shows seven cards).
2. **"Dipole-induced dipole"** (BS-33): keep it as a separate force, label it "beyond the course", or fold it into London / dipole-dipole.
3. **Beyond the IB course** switch: confirm that PCl5 / SF6 / XeF4 stay available behind it rather than being removed.
4. **Ground-state carbon sp2** (BS-22): block mixing ground-state carbon to sp2, or keep it with the explanation.
5. **Element colours**: O and the label colours of F, Cl, Na, Ca changed for contrast; say if you prefer the old look with outlined labels.
6. **Boiling-point sets**: add or remove sets (alcohols, solubility) and decide whether to show scores to teachers (currently session only).
