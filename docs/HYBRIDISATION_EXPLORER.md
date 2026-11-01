# 3D Hybridisation Explorer (IB DP Chemistry S2.2 The Covalent Model)

Route: `/simulation/hybridisation-explorer` (label "Hybridisation Explorer (3D)"). Code: `src/engines/hybridisation-explorer/`.
Exactly two tabs: **Orbital Lab** and **Molecule Explorer**. Same default dark theme as the VSEPR Explorer; all colours are CSS variables in `HybridisationExplorer.css`.

## Architecture
- `model/` is pure (no React, no three): `orbitals.js` (angular functions, labels), `elements.js` (ground states from the shared electron-configuration engine, validated illustrative promotions), `hybrids.js` (selection analysis, hybrid coefficients, directions, electron distribution), `overlap.js` (sigma/pi detection), `snap.js` (snap planning), `workspace.js` (reducer with undo), `moleculeData.js` (data only) and `moleculeLayout.js` (geometry compiled from the data and cross-checked with the overlap engine).
- `scene/` and `components/` render it: react-three-fiber in demand mode, OrbitControls, a shared cache of procedural geometries, GPU disposal on unmount, and a message plus working controls when WebGL is unavailable. Layout uses `SimulationDashboard` (container-driven, stacks when narrow).

## How orbitals are generated
Surfaces are polar plots of the **angular part only** of real spherical harmonics, `r = R * sign(f) * (|f|/max)^1.5`. The sign of `f` gives the lobe phase (blue positive, red negative). Hybrids are the textbook orthonormal combinations (sp, sp2, sp3, sp3d with equatorial sp2 plus axial (pz +/- dz2)/sqrt2, sp3d2, dsp2). Hybrid directions are computed from the numerical peak of each hybrid, not hard-coded. The shapes are educational representations, not a quantum-mechanical calculation (no radial nodes, no real sizes).

## Overlap logic (and its limits)
For every pair of orbitals on different atoms the engine checks: type compatibility, alignment of lobe axes, a distance window derived from lobe reach, matching phase of the facing lobes, exactly one unpaired electron in each orbital, and that no other atom occludes the line between them. sigma = end-on along the bond axis; pi = parallel p orbitals perpendicular to the bond axis. The same engine verifies every molecule layout and every snap result. Limits: a geometric/educational criterion with tolerances, not an overlap integral; it does not model bond order energetics, resonance or MO theory.

## Orbital Lab
Element dropdown (H, Be, B, C, N, O, F, Si, P, S, Cl, Xe), collapsible Energy Levels panel (clickable boxes synchronised both ways with the 3D view, Hund's rule, spin arrows), Excited State limited to the promotions in `elements.js` (carbon 2s1 2p3 is labelled a conventional teaching illustration; H, N, O, F are disabled with an explanation). Mix Selected Orbitals accepts only sp, sp2, sp3, sp3d, sp3d2 and dsp2 sets; n orbitals in gives n hybrids out, with a 1-2 s animation, and unhybridised p orbitals stay visible. Manual bonding: Add Atom / Duplicate Prepared Atom, drag, per-atom rotation, scene orbit, sigma/pi toggles, Snap to Overlap, bond identification, Undo (one step per drag or snap) and Reset.
The dsp2 set exists in the model and tests; the UI offers it only where a validated promotion exists (none of the 12 selectable elements has one), so it is not reachable from the element dropdown.

## Molecule Explorer
11 molecules, defined as data. Ethene (6 steps, 5 sigma + 1 pi), ethyne (3 sigma + 2 pi), ethane (7 sigma) and benzene (12 sigma plus a delocalised pi region, not counted as localised bonds). Play/Pause, Previous, Next, Reset; one sentence per step; optional energy-level diagram.

## Tests
- `npm run test:hybridisation` = `scripts/test-hybridisation-model.mjs` (pure model) + `scripts/test-hybridisation-ui.mjs` (jsdom, WebGL-less fallback path). Chained into `npm test`.
- `node scripts/verify-hybridisation-explorer.mjs [baseUrl] [outDir]` needs a running dev server and Playwright/Chromium (SwiftShader). Checks five viewports (1366x768, 1440x900, 1920x1080, 820x1180, 390x844), no console errors, no page scroll at the desktop sizes, mixing, snap, undo/reset and every molecule's final step.

## Not verified
Real GPU rendering, real touch hardware, Firefox/Safari, screen readers. 3D drag is tested with synthetic mouse events only.
