# Intermolecular Forces Visualiser

Route `/simulation/intermolecular-forces-visualiser` (id `intermolecular-forces-visualiser`), IB DP Chemistry S2.2.
Registered in `src/data/simulationRegistry.js`, `src/data/simulationEngineComponents.js`, `src/data/resources-registry.js`.

## Structure (`src/engines/intermolecular-forces-visualiser/`)
* `model/` pure data and physics, no React or three: `vec.js`, `molecules.js` (14 tray molecules + Ne and F2 for Compare, geometry, partial charges, polarizability alpha', lone pairs), `imf.js` (induced dipoles, London correlation, dipole-dipole, hydrogen-bond detection, whole-scene `computeInteractions`), `phase.js` (heating-curve energy model), `particles.js` (rigid-body particle dynamics for the cube), `lessons.js`, `workspace.js`, `narration.js`.
* `scene/` three/r3f: `cloudGeometry.js` (cached Gaussian iso-surface clouds, cheap vertex polarisation, ESP colours), `ImfScene.jsx` + `ImfStage.jsx` (Explore/Learn stage, picking, drag/rotate/drop), `CubeScene.jsx` + `CubeStage.jsx` (InstancedMesh heating cube).
* `components/` tray, icons, Intra vs Inter popover, heating graph, `useHeatSim` clock.
* Tests: `scripts/test-imf-model.mjs` (pure model, 71 tests), `scripts/test-imf-ui.mjs` (jsdom, WebGL-less path), `npm run test:imf`, chained into `npm test`. Headless browser: `scripts/verify-intermolecular-forces.mjs`.

## Scientific modelling decisions (all labelled qualitative in the UI)
* **Electron cloud**: a translucent iso-surface of a sum of Gaussians centred on the atoms (radius ~ van der Waals), built once per molecule and cached. It is a teaching picture of an electron-density envelope, not a quantum calculation. Colour is *electrostatic potential colouring (qualitative)*: red electron-rich, blue electron-poor, from model partial charges fitted to experimental dipole moments.
* **Polarisation**: p = alpha' E, drawn by displacing the cached vertices (no regeneration). The exaggeration slider only scales the visual displacement.
* **London dispersion**: a fluctuating instantaneous dipole in one molecule of each nearest pair induces a correlated dipole in the other. The attraction indicator scales with alpha' and ionisation energy (London estimate). Always on between all particles. Freeze Moment pauses the fluctuation. Compare (Ne/Ar, F2/Cl2, Cl2/I2) shows polarizability, noting that size alone does not set strength.
* **Dipole-induced dipole**: field of the permanent dipole (point charges) polarises the neighbour; reversing HCl flips the induced dipole.
* **Dipole-dipole**: point-charge Coulomb sum, shown as a relative, unitless indicator that depends on orientation and distance.
* **Hydrogen bond**: geometric criterion, donor = H on N/O/F (so HCl is never a donor), acceptor = lone pairs on N/O/F molecules (H2O, NH3, HF). Strength fades continuously with H...A distance (window 1.3-2.6 A, full 1.6-2.1 A), X-H...A angle (115-150 deg smoothstep) and lone-pair alignment. Presented as a strong directional dipole-dipole subtype.
* **Heat & Phase Change**: temperature is a function of added energy only (piecewise: heat capacities with latent-heat plateaus at the 1 atm points H2O 273.15/373.15 K, NH3 195.4/239.8, HCl 158.9/188.1, CH4 90.7/111.7, I2 386.9/457.6, Ar 83.8/87.3; NaCl 1074/1686 K). Heat capacities and latent heats are approximate values for a simplified model. Playback is paced (a few seconds per stage), so the graph x axis is energy, not time. Particles are 48 rigid molecules with Langevin dynamics, a soft pair potential and site springs released as temperature passes the melt threshold; covalent bond lengths never change (tested). Liquids keep cohesion until boiling. Water solid is a proton-disordered ice Ic-type network (ordinary ice is Ih), labelled simplified. CO2 is omitted with a note: it sublimes at 1 atm.
* **NaCl**: ionic lattice drawn with bonding-visualizer style ions; never called a molecule.

## Verification levels
* Unit (node): `node scripts/test-imf-model.mjs` 71 passed.
* jsdom: `node scripts/test-imf-ui.mjs` 15 passed (no WebGL; registration, tray, force selector, narration, toggles, popover, lessons, Play path builds no geometry, heat readouts, graph, Compare).
* Headless Chromium + SwiftShader: `node scripts/verify-intermolecular-forces.mjs` (layout at 1366x768, 1440x900, 1920x1080, 820x1180, 390x844 for Explore/Learn/Heat/Compare; HTML5 drop, pointer drag, rotate, orbit separation, Closer/Apart, Reset; the four force scenarios; four lessons to the end with Play latency measured in page (about 9-11 ms); Try in Explore; popover; tab hide/show; each molecular substance solid to gas and back with plateaus compared to the model; NaCl compare; console errors).
* Button contrast: `SIMS=intermolecular-forces-visualiser node scripts/verify-simulation-button-contrast.mjs`.

## Not verified / limits
Real GPU, real touch hardware, Safari and Firefox, screen readers. Clouds are smooth envelopes, not orbitals. All indicators are relative and qualitative; values are not interaction energies. In the heating cube the cluster is small relative to the cube so the gas has room. Pair interaction in Explore is evaluated for nearest-neighbour pairs only.
