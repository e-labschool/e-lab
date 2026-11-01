# 3D Hybridisation Explorer (IB DP Chemistry S2.2 The Covalent Model)

Route: `/simulation/hybridisation-explorer` (label "Hybridisation Explorer (3D)"). Code: `src/engines/hybridisation-explorer/`.
Exactly two tabs: **Orbital Lab** and **Molecule Explorer**. Same default dark theme as the VSEPR Explorer; all colours are CSS variables in `HybridisationExplorer.css`.

## Architecture
- `model/` is pure (no React, no three): `orbitals.js` (angular functions, labels), `elements.js` (ground states from the shared electron-configuration engine, validated illustrative promotions), `hybrids.js` (selection analysis, hybrid coefficients, directions, electron distribution), `overlap.js` (sigma/pi detection), `snap.js` (snap planning), `workspace.js` (reducer with undo), `moleculeData.js` (data only) and `moleculeLayout.js` (geometry compiled from the data and cross-checked with the overlap engine).
- `scene/` and `components/` render it: react-three-fiber in demand mode, OrbitControls, a shared cache of procedural geometries, GPU disposal on unmount, and a message plus working controls when WebGL is unavailable. Layout uses `SimulationDashboard` (container-driven, stacks when narrow).

## How orbitals are generated
Surfaces are polar plots of the **angular part only** of real spherical harmonics, `r(dir) = R * sign(f) * (|f|/max|f|)^K` (`model/surface.js`). K per class (`SURFACE_K`): s 1 (sphere), p 2.3, hybrid 2.0, d 2.3. The sign of `f` is the **wavefunction phase** of the lobe (never "charge"). Consequences, all covered by tests:
- p: two equal, opposite-phase lobes, pinched at the nucleus (r = 0 at 90 degrees off axis).
- sp / sp2 / sp3: one big and one small opposite-phase lobe; the small:big amplitude ratios of f are 0.268 / 0.420 / 0.5 from the real coefficients, the big lobe points along the hybrid axis (computed from the numerical peak, not hard-coded).
- d: the true shapes (dxy, dxz, dyz, dx2-y2: four lobes; dz2: two lobes plus a ring), labelled with n (3dxy ...).
Hybrids are the textbook orthonormal combinations (sp, sp2, sp3, sp3d with equatorial sp2 plus axial (pz +/- dz2)/sqrt2, sp3d2, dsp2). For drawing only, the mesh is also narrowed towards the nucleus (`TAPER_U0`, `TAPER_EXP` in `scene/orbitalField.js`) and hybrids are drawn at `DRAW_WIDTH.hybrid` = 0.68, so lobes run into the nucleus as slim cones instead of balloons; the analytic surface used by the overlap measure is not tapered. The shapes are educational representations, not a quantum-mechanical calculation (no radial nodes, no real sizes).
Geometries are built once (single 48 x 88 grid), cached by terms/R/K/palette/axis/width, shared by both tabs, warmed in idle slices and disposed (deferred retain/release) when the simulation unmounts.

## Colours (same in both tabs; CSS variables in `HybridisationExplorer.css`, read by `scene/theme.js`)
s red/orange, px blue, py green, pz purple, d gold, hybrids h0..h5 magenta, cyan, coral, lime, amber, slate. Every orbital has two shades, one per wavefunction phase (`-pos` lighter-saturated, `-neg` darker). The "+/- wavefunction phase" chip under the viewer toggles +/- marks on the lobes and a legend; the energy-level chips use the same colour as the 3D lobe.

## Mixing animation (Orbital Lab, `MIX_MS` = 1800 ms)
The selected atomic orbitals are highlighted first (about 14 % of the time), then the **angular function itself is interpolated** (`blendTerms`: `(1-e) * source + e * hybrid`, with R, K, palette and taper blended too) in a preallocated geometry that is rewritten in place each frame, so the four sp3 lobes visibly grow out of s + px + py + pz, and it ends exactly on the cached hybrid mesh (tested: blend at 0 and 1 equals the static fields). Source i morphs to hybrid i. It ends tetrahedral (109.47 degrees; 120 / 180 for sp2 / sp), each lobe labelled, unhybridised p orbitals shown separately (sp: 2py, 2pz; sp2: 2pz). The panel states that this visualises the model and is not a literal physical event.

## Overlap logic (and its limits)
Two layers. (1) The discrete rules in `model/overlap.js`: type compatibility, alignment of lobe axes, phase of the facing lobes, exactly one unpaired electron per orbital, no occluding atom. The **distance window is derived numerically** from the continuous measure of a canonical aligned pair (cached): `max` = overlap just visible (3 % of peak), `ideal` = 40 %, `min` = nuclei so close that overlap has fallen to 60 % of its peak; d orbitals keep the legacy reach-based window. A valid bond therefore means a visible overlap. (2) The continuous measure in `model/overlapVolume.js`: soft-membership lattice intersection of the two drawn surfaces, signed by phase (same phase adds, opposite subtracts), normalised by the larger lobe volume of the smaller orbital. It is monotonic in distance, 0 for a misaligned (90 degrees) p-s pair and negative out of phase. Highlight regions are moment-fitted ellipsoids (an approximation of the true intersection): one lens for sigma, two lenses (above/below the bond axis) for pi; their strength = `highlightStrength(measure)` (smoothstep from 2 % to 18 %), so the highlight fades smoothly with distance. sigma = end-on, pi = sideways. Limits: a qualitative geometric measure of educational surfaces, not an overlap integral; no bond-order energetics, resonance or MO theory.

## Orbital Lab
Element dropdown (H, Be, B, C, N, O, F, Si, P, S, Cl, Xe), collapsible Energy Levels panel (clickable boxes synchronised both ways with the 3D view, Hund's rule, spin arrows), Excited State limited to the promotions in `elements.js` (carbon 2s1 2p3 is labelled a conventional teaching illustration; H, N, O, F are disabled with an explanation). Mix accepts only sp, sp2, sp3, sp3d, sp3d2 and dsp2 sets; n orbitals in gives n hybrids out.
Manual bonding: Add Atom / Duplicate Prepared Atom; each atom is independently selectable and draggable (Move) and its whole orbital set rotates (Rotate, or the gizmo rings); Snap to Overlap aligns the active atom's orbitals along the internuclear axis at the ideal distance; overlap regions are highlighted in proportion to the measured overlap; a **Focus** switch fades the orbitals that do not take part. When the overlap check passes, a **Form bond** button appears (it is absent otherwise); a formed bond stays visible (chip with a check mark) until the atoms are moved apart, which prunes it. Undo (one step per drag or snap) and Reset. The dsp2 set exists in the model and tests; the UI offers it only where a validated promotion exists (none of the 12 selectable elements has one).

## Molecule Explorer
11 molecules, defined as data; one sentence per step; Play/Pause, Previous, Next, Reset; optional energy-level diagram and a "sigma/pi labels" switch.
- Ethene (5 steps, final 5 sigma + 1 pi): 1) two separated C, each 3 sp2 + a perpendicular 2pz; 2) the C-C sigma pair highlighted, the rest faded; 3) 2pz-2pz sideways overlap, pi regions above and below the plane; 4) H atoms and four C-H sigma; 5) complete.
- Ethyne (6 steps, final 3 sigma + 2 pi): sp + 2py/2pz; sp-sp sigma; py-py pi; pz-pz pi (perpendicular to the first); two C-H sigma; complete.
- Ethane 7 sigma; benzene 12 sigma plus a delocalised pi region (not counted as localised bonds). A pi-bonded pair sits at an intermediate distance until its pi step and then closes.
- Readability: each orbital keeps its own colour; orbitals in newly formed bonds glow, earlier bonds are dimmed (x0.62), others faded (x0.3); lobes are slim; depthWrite and render order keep overlapping surfaces distinguishable.

## Play latency
Measured with `profile` runs in headless Chromium (SwiftShader), molecule tab, ethene. Before: Play only set a flag and waited for the 4200 ms step timer, so nothing moved for about 4.2 s; each frame also rebuilt React state and geometry was built lazily on first use. Now Play immediately starts the next step (or restarts from step 1 at the end), animation (opacity damping, atom glide, lens swell, morph) runs inside the frame loop on refs, geometries are pre-built in idle slices and shaders pre-compiled (`gl.compile`). Measured after: step change 12-30 ms and first draw 18-44 ms after the click for Play/Next/Previous/Reset. Under software GL individual frames take 100-400 ms, so the "long tasks" seen there are the SwiftShader rasteriser, not application code.

## Tests
- `npm run test:hybridisation` = `scripts/test-hybridisation-model.mjs` (pure model: surfaces, lobe counts, hybrid ratios and directions, mixing conservation and exact angles, colour mapping, morph endpoints, overlap monotonicity, step lists) + `scripts/test-hybridisation-ui.mjs` (jsdom, WebGL-less fallback path, including the Play/Pause/Next/Previous/Reset latency test). Chained into `npm test`.
- `node scripts/verify-hybridisation-explorer.mjs [baseUrl] [outDir]` needs Playwright/Chromium (SwiftShader) and starts its own dev server on a free port when no baseUrl is given. Five viewports (1366x768, 1440x900, 1920x1080, 820x1180, 390x844): layout, frozen mid-morph screenshots of sp/sp2/sp3, ethene and ethyne from step 1 to the last step, a manual overlap build with Form bond / Focus / phase, p and d screenshots, Play latency, no console errors.

## Not verified
Real GPU rendering and frame rate, real touch hardware, Firefox/Safari, screen readers. 3D drag is tested with synthetic mouse events only. The jsdom Play test has no WebGL, so "no geometry built on the Play path" there is trivially true; the browser run (warm-up + SwiftShader timings) is the meaningful evidence.

## Tests
- `npm run test:hybridisation` = `scripts/test-hybridisation-model.mjs` (pure model) + `scripts/test-hybridisation-ui.mjs` (jsdom, WebGL-less fallback path). Chained into `npm test`.
- `node scripts/verify-hybridisation-explorer.mjs [baseUrl] [outDir]` needs a running dev server and Playwright/Chromium (SwiftShader). Checks five viewports (1366x768, 1440x900, 1920x1080, 820x1180, 390x844), no console errors, no page scroll at the desktop sizes, mixing, snap, undo/reset and every molecule's final step.

## Not verified
Real GPU rendering, real touch hardware, Firefox/Safari, screen readers. 3D drag is tested with synthetic mouse events only.
