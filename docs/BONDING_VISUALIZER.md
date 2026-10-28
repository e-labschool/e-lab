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
* Metallic: Na, Li, K (BCC), Ca, Al (FCC), Mg (HCP, ideal c/a). One metal at a time, up to 12 atoms.

## Lesson integration

`content.simulationConfig = { initialMode: "ionic" | "covalent" | "metallic", allowedModes: [...] }`
(S2.1 ionic only, S2.2 covalent, S2.3 metallic). The Learn editor shows the options when the simulation is `bonding-visualizer`;
`LearnBlockRenderer` passes the config. Standalone previews accept `?mode=covalent&modes=ionic,covalent`.
At least one mode is always allowed and the initial mode always lies inside the allowed set.

## Tests

* `npm run test:bonding` runs `scripts/test-bonding-model.mjs` (pure model and scenes) then `scripts/test-bonding-ui.mjs` (jsdom).
* `scripts/verify-bonding-visualizer.mjs` is the headless-Chromium run (needs a dev server and Playwright):
  `node scripts/verify-bonding-visualizer.mjs http://127.0.0.1:5199 /tmp/out`. `SIZES=1366,390` limits viewports.

## Known limits

* The electron sea is a simplified, illustrative motion, not real trajectories.
* Touch devices add atoms by tap (drag from the library is pointer-only); atoms on the canvas drag by touch.
* Lewis diagrams show electrons only, not molecular shape.
