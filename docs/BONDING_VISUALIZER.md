# Bonding Visualizer

Simulation id `bonding-visualizer`. Three models only: **Ionic | Covalent | Metallic**. No VSEPR, geometry, angles,
polarity, electronegativity, hybridisation, sigma/pi, or conductivity/malleability simulations.

## Layout of the code (`src/engines/bonding-visualizer/`)

| Folder | Contents |
| --- | --- |
| `model/` | Pure chemistry, no React: `elements`, `ionic`, `covalent`, `lattice`, `metallic`, `config`. |
| `scene/` | Pure geometry and animation timelines per mode (`atomGeometry`, `ionicScene`, `covalentScene`, `metallicScene`). |
| `components/` | SVG and react-three-fiber rendering, element library, mode shells. |
| `teacher/` | `BondingBlockOptions`, the lesson-editor options. |

Registered by one line in `src/data/simulationRegistry.js` and one in `src/data/simulationEngineComponents.js`.
Layout is the shared `SimulationDashboard` (container-driven: stacked only when narrow).

## Data sources

* Shell arrangements come from the shared electron-configuration engine in `src/data/chemistry`
  (`buildConfiguration`, `buildIonConfiguration`), i.e. IUPAC ground-state configurations. `2n^2` is never used as a filling rule.
* Ion charges are derived from outer-shell electron counts (metals lose them, non-metals gain up to 8).
* Ionic radii for the lattice view are IB data booklet values (pm), drawn at 0.5 scale for clarity.
* Tests cross-check the engine against an independent oracle table.

## Supported content

* Ionic library: Li, Na, K, Mg, Ca, Al with N, O, F, S, Cl, Br. One formula unit at a time (max 8 atoms).
  Charge-balanced ratios (LiCl, NaCl, MgO, MgCl2, Na2O, Al2O3, ...). "Add missing atoms" completes a formula.
  Al with Cl, Br or N is refused as largely covalent.
* Lattice view (only these, validated by computed coordination): rock salt for Li|Na|K with F|Cl|Br, Mg|O, Mg|S, Ca|O, Ca|S;
  fluorite for CaF2; antifluorite for Li|Na|K with O|S. Others show an explanation instead.
* Covalent: H2, Cl2, HCl, O2 (double), N2 (triple), H2O, NH3, CH4; BF3 (6e) and BeCl2 (4e) incomplete octet;
  PCl5 (10e) and SF6 (12e) expanded octet (AHL). Each molecule is validated (valence = 2*lone pairs + bond orders).
* Metallic: Na, Li, K (BCC), Ca, Al (FCC), Mg (HCP, ideal c/a). One metal at a time, up to **200 atoms** (see "Metallic details").

## Metallic details

* **Adding atoms**: the library chip adds one atom of that metal (and selects it); the **+1 / +5 / +20 / +50** buttons add that many
  atoms of the selected metal (default Na; locked to the metal already on the canvas). Requests are clamped at 200
  (`addCount`): at 190 atoms, +20 adds 10 and says so; at 200 all four buttons are disabled and "Limit reached" is shown.
  Adding is only possible before the electrons are released (Reset clears to 0 atoms).
* **Counters** (simplified model: every outer-shell electron is delocalised): atoms = ions = n; delocalised electrons = n x valence
  (Na/Li/K 1, Mg/Ca 2, Al 3, i.e. at most 600).
* **Cube**: a transparent cube (12 thin edge lines, softly tinted floor, very faint walls and top; all `transparent`, `depthWrite=false`,
  drawn after the opaque ions/electrons) centred on the origin. Its half-size depends only on the atom count (`cubeHalf`: 2.4 up to 27 atoms,
  4.0 up to 125, 5.5 up to 200), animates smoothly, and the camera re-fits to it (user rotation and zoom are kept otherwise).
  Cube, ions and electrons rotate together because the orbit camera moves around them.
* **Arrange atoms** (`placeNewAtoms`): new atoms take the first free slot of a loose 1.5-unit grid, centre outward, with a small jitter, so the
  free arrangement is clearly not a lattice and always lies inside the cube. Dragged atoms are clamped to the cube.
* **Form Metallic Lattice** (`latticeBlock`, `latticeLayout`): n atoms become exactly n sites of the real lattice (BCC for Na/Li/K, FCC for Ca/Al,
  HCP for Mg, nearest-neighbour distance 1, scaled to fit the cube, spacing capped). **Counts that do not fill whole unit cells**: the crystal grows
  outward from one atom in cubic shells (sorted by largest coordinate, then distance) and the first n sites are kept, so the block is always a
  cube-shaped fragment of the true lattice with an incomplete outer shell. No atom is ever invented (the previous 35-site fill was removed).
  9 BCC atoms are exactly one body-centred cell; a block with a fully surrounded ion shows the bulk coordination (8 or 12), a very small block
  says it has no fully surrounded ion yet.
* **Electrons** never leave the cube: positions are clamped to it every frame, in every stage (orbiting their atom, releasing, forming, lattice).
* **Rendering** (`MetallicStage`, `metallicScene.createEngine/stepEngine`): ions = one `InstancedMesh` (capacity 200), electrons = one `InstancedMesh`
  (capacity 600), selection = one halo mesh; no per-atom React components or labels. Per-frame work writes into preallocated typed arrays and the
  instance matrices directly (no objects created per frame), uses the delta time (capped at 50 ms), and the canvas switches to on-demand rendering
  while paused. The unit-cell outlines and floor grid of the old floor-only view were replaced by the cube.

## Covalent display

* **During bond formation** the electron-sharing animation is unchanged for molecules whose shells fit. Crowding is decided by geometry
  (`isCrowded`): with the normal lens overlap between bonded atoms, do the full outer shells of two atoms that are not bonded to each other
  overlap? (Today that is PCl5 and SF6; nothing is looked up by name.) Those molecules switch to a **valence-electron-dot drawing**: the shell
  rings and overlap tints fade out, inner-shell electrons gather on a compact kernel ring, valence electrons sit on a dot ring, and then move to
  the shared pairs (one electron from each atom) and lone pairs exactly as before. Every electron is kept, colours stay by atom of origin.
* **After bond formation** the picture holds for about 1.3 s, then cross-fades into the final **sphere-and-bond structure**
  (`scene/moleculeStructure.js`, `components/MoleculeView.jsx`, loaded lazily): a rotatable react-three-fiber model (orbit controls, zoom,
  centred and scaled to the canvas) with labelled atoms and single/double/triple bonds drawn as 1/2/3 parallel cylinders. Without WebGL a flat SVG
  of the same structure is shown. SF6: S at the centre, F on +-x, +-y, +-z, six single bonds. Other molecules use one fixed display arrangement
  (diatomics linear, H2O and NH3 bent/pyramidal, CH4 tetrahedral, BF3 planar, BeCl2 linear, PCl5 trigonal bipyramid). The structure is a final
  picture only: no angles, geometry names, polarity or hybridisation are shown. Lone pairs are not drawn on the spheres; the Lewis counts
  (shared pairs, lone pairs, electrons around the central atom, the "S has 12 electrons" pill) stay in the strip above and below.
* Replay returns to the electron-sharing picture; Reset returns to two hydrogen atoms; Pause also pauses the hand-over and the slow spin.

## Lesson integration

`content.simulationConfig = { initialMode: "ionic" | "covalent" | "metallic", allowedModes: [...] }`
(S2.1 ionic only, S2.2 covalent, S2.3 metallic). The Learn editor shows the options when the simulation is `bonding-visualizer`;
`LearnBlockRenderer` passes the config. Standalone previews accept `?mode=covalent&modes=ionic,covalent`.
At least one mode is always allowed and the initial mode always lies inside the allowed set.

## Tests

* `npm run test:bonding` runs `scripts/test-bonding-model.mjs` (pure model and scenes: 200-atom cap and clamping, counters, lattice positions inside the
  cube for every metal at several counts, BCC coordination 8, engine bounds and no per-step allocation, crowding detection, SF6 structure,
  every molecule's final structure against the molecule table, no overlapping spheres) then `scripts/test-bonding-ui.mjs` (jsdom: add buttons,
  clamping, disabled limit state, hand-over to the structure view for every molecule; jsdom has no WebGL so the SVG fallback is what is inspected).
* `scripts/verify-bonding-visualizer.mjs` is the headless-Chromium run (needs a dev server and Playwright):
  `node scripts/verify-bonding-visualizer.mjs http://127.0.0.1:5199 /tmp/out`. `SIZES=1366,390` limits viewports. It runs metallic to 200 atoms
  (buttons, release, lattice, rotate, zoom, Al and Mg) and every covalent molecule through Form Bond to the final structure at 1366x768,
  1440x900, 1920x1080, 820x1180 and 390x844, takes screenshots, checks layout/overflow/console errors and prints measured frame times (software GL).

## Known limits

* The electron sea is a simplified, illustrative motion, not real trajectories.
* Touch devices add atoms by tap (drag from the library is pointer-only); atoms on the canvas drag by touch.
* Lewis diagrams show electrons only, not molecular shape; the final structure is a display arrangement, not a geometry lesson.
* Metallic atoms cannot be added after the electrons are released (Reset first). The lattice assignment of atoms to sites is greedy-nearest, so a few
  atoms may cross paths while moving. Per-atom text labels were dropped in the metallic view (the legend names the atoms and ions).
