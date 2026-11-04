# VSEPR Explorer (3D) — IB DP Chemistry S2.2 The Covalent Model

Simulation id: `vsepr-explorer-3d` (unchanged, so every existing lesson / registry entry still embeds it).
Route: `/simulation/vsepr-explorer-3d`. Three tabs: **Build | Molecules | Challenge**.
This replaces the previous single-file explorer (geometry chips + bottom example text). It is an original e-Lab
implementation; it uses no PhET code or design.

> It is an **educational VSEPR model**. It does not compute real electron forces or molecular energies, and the
> UI says so wherever angles are shown ("idealised" / "≈ approximate experimental").

## Files

```
src/engines/vsepr-explorer-3d/
  VSEPRExplorer3D.jsx          entry (InteractiveFrame + SimulationDashboard); owns the three tabs and the Build history
  VSEPRExplorer.css            all styles; colours are CSS variables (dark default, light variant)
  meta.js
  model/                       PURE (no React, no three) -- unit tested
    geometry.js                domain counting, names, AXE, slot sets, assignment, relaxation, angles
    presets.js                 VALIDATED molecule dataset + validator + library grouping + search + preset matching
    builder.js                 builder state, undo/redo history, classification, angle text, "Why this shape?" text
    lewis.js                   Lewis derivation (octet rule for terminal atoms, exceptions, warnings)
    challenge.js               Predict/Build/Observe/Explain answer checking
    elements.js                the 14 toolbox atoms
  components/
    ViewerStage.jsx            canvas wrapper: simulation owner + ALL pointer interaction + DOM overlays
    Scene.jsx / sceneMath.js   r3f content (pooled meshes, InstancedMesh strands/arcs/arrows) and framing maths
    Toolbox.jsx                atoms / bonds / lone pair / Undo Redo Clear Reset, pointer drag with ghost
    ViewerPanel.jsx            viewer + Electron-Domain | Molecular Geometry segmented control
    StructureCard.jsx          "Current structure": 3D mini model | Lewis structure, facts, "Why this shape?"
    LewisDiagram.jsx, ViewOptions.jsx, SelectionBar.jsx, ChallengePanel.jsx, webgl.js, format.js
    useBuilderWorkspace.jsx    toolbox + viewer wiring shared by Build and Challenge
    useMoleculesTab.jsx, useChallengeTab.jsx
scripts/test-vsepr-model.mjs   pure model tests          (npm run test:vsepr, part of npm test)
scripts/test-vsepr-ui.mjs      jsdom UI tests            (npm run test:vsepr, part of npm test)
scripts/verify-vsepr-explorer.mjs   headless Chromium verification (npm run verify:vsepr, needs a dev server)
```

## The model

* A molecule is **one fixed central atom** plus domains. A domain is a bond (order 1, 2 or 3, **one domain whatever
  the order**; the order only changes the drawing: one, two or three parallel strands) or a lone pair on the central
  atom. Lone pairs on terminal atoms are never domains of the central atom; the Lewis view derives and draws them.
* Counting: `b` bonding + `l` lone-pair domains = `n`. `n` gives the electron-domain (ED) geometry, `(b, l)` the molecular
  geometry (MG) and the AXE notation. Up to 6 domains, up to `{2:1, 3:2, 4:3, 5:3, 6:2}` lone pairs; other
  combinations give a warning, never a wrong shape.
* Free builds are labelled **idealised VSEPR model** unless connectivity + bond orders + lone pairs match a validated
  preset (central symbol + sorted ligands + lone pairs). Free builds with lone pairs show only `< ideal°`
  (no invented exact angle); validated presets show their listed values, marked `≈` when approximate.

### Relaxation (how the 3D motion works, and its limits)

1. Each domain is a unit direction from the central atom. The reference arrangement is a **slot set** for `(b, l)`:
   ideal sets for 2 linear, 3 trigonal planar, 4 tetrahedral, 5 trigonal bipyramidal, 6 octahedral; lone pairs take the
   VSEPR positions (equatorial in a bipyramid, trans in an octahedron, so AX₃E₂ is T-shaped, AX₂E₃ linear, AX₄E₂
   square planar); the bonding slots are then **bent away from the lone pairs** using illustrative reference angles
   (≈107, 104.5, 118, seesaw 173/102, T-shape 87.5, square pyramid 85) so the picture agrees with the listed values.
2. A rigid frame `R` (3×3 rotation) orients the slot set. When domains are added/removed the frame is re-fitted
   (Horn's method with a weak prior to the previous frame so linear/planar sets do not spin), and domains are assigned
   to slots by **brute-force minimum total displacement** (bonding domains only to bonding slots, lone pairs only to
   lone-pair slots; deterministic lexicographic tie-break).
3. Every free domain is a **critically damped spring** toward its slot (ω = 9 rad/s, fixed 1/120 s substeps, speed
   limit, positions re-normalised on the sphere), so there is no overshoot, jitter or snapping.
4. **Dragging**: the dragged domain is pinned to the pointer direction (the pointer ray is intersected with a sphere
   around the fixed central atom; on a near/far ambiguity the side nearest to the previous direction is used, so a rear
   domain stays at the back). Every other domain additionally receives a push away from each neighbour equal to the
   **increase** of a pair repulsion over its resting value (zero at rest, never attractive), multiplied by weights
   **LP–LP 1.7 > LP–BP 1.3 > BP–BP 1.0**. That is where the qualitative hierarchy lives; the other half is the compressed
   reference angles.
5. A **minimum angular separation** (55 % of the smallest reference angle) is enforced after every substep, so two
   domains can never overlap, even if one is dragged onto another.
6. **Release**: the assignment is re-evaluated once (a swap is only accepted if it saves more than a fixed threshold, so
   it cannot flip back and forth) and all domains relax to their slots. A release "pulse" strengthens the repulsion arrows.

Limits: the weights and gains are tuned for a pleasant, stable demonstration, not derived from physics; the slot angles
for lone-pair shapes are fixed typical values (e.g. H₂S really has ≈92°, which is why it is not in the library);
the model is one central atom (no chains / rings / multi-centre molecules); free-built arrangements with an unusual
lone-pair count may be refused; relaxation convergence is tested from random perturbations up to 55° for every
preset, but a pathological multi-domain drag can still pick a different (equally valid) assignment of identical
domains to slots.

## Interaction

* **Toolbox** (14 atoms H C N O F Cl B Be S P Si Br I Xe, three bond tools, lone pair). Click to add, or **drag**
  (pointer events: mouse, pen and touch) into the viewer. First atom = central atom. Dragging an atom over the model shows a
  highlighted attachment point on the central atom and a bond/atom preview; dropping places the domain there and it
  relaxes into the arrangement. Dropping an atom on an existing bond atom or free bond end replaces/sets that atom.
  A bond dragged from the toolbox creates a bond with a free end (wire-frame sphere) that an atom can be dropped onto.
  The lone pair is accepted anywhere over the viewer (it can only belong to the central atom).
* **Selecting** (click, no drag): shows a small bar to change bond order (— = ≡), change the element, or remove.
  `Delete`/`Backspace` removes the selected domain, `Esc` deselects. Selecting the central atom allows changing its element.
* **Domain drag**: pointer down on a surrounding atom, bond or lone pair is captured in the **capture phase** of the
  viewer container and `stopPropagation()`-ed, so the orbit controls never see it (the camera cannot rotate). A press on
  empty space orbits; scroll/pinch zooms; the floating buttons toggle auto-rotate, zoom, reset view.
* **ED | MG** segmented control directly under the viewer: ED shows translucent teardrop lobes for all domains (lone
  pairs with two electron dots); MG fades the bond lobes, shows atoms and an outline of the shape, and lone pairs only
  if *Show lone pairs* is on. Animated blends, no rebuild.
* **View options**: electron domains (ED view), lone pairs (MG view), repulsion arrows (LP–LP, LP–BP, BP–BP colours +
  legend, strongest on release; nothing drawn when off), bond angles (curved arcs, de-overlapped labels: live while dragging,
  idealised / `≈` approximate / `<` less-than values at rest).
* **Undo / Redo** record *edits* (add, remove, change order/element, load, clear); a drag is a transient perturbation and is
  not recorded. **Clear** empties the workspace and is undoable. **Reset** empties, forgets the history and restores the
  default view options. The header Reset resets the **active tab** only.

## Tabs and state

All three tabs stay alive as hooks of the explorer, so switching tabs never loses work: Build keeps its model and undo
history for the session; Molecules remembers its molecule and search; Challenge keeps its molecule, answers and its own
build. The tabs never share a model; only the explicit **Open in Build tab** button copies a molecule into Build (one
undo step). Each tab has its own view options. Open/closed UI such as “Why this shape?” resets per tab.

## Dataset (validated)

`model/presets.js`: BeCl₂, CO₂, HCN, BF₃, SO₃, CH₂O, SO₂, CH₄, NH₃, H₂O, PCl₅, SF₄, ClF₃, XeF₂, SF₆, BrF₅, XeF₄ (17).
SO₂ = 2 bonding domains + 1 lone pair on S with S=O double bonds; CO₂ = two C=O; HCN has a triple bond. Each entry has
central atom, ligands with bond orders, central lone pairs, AXE, ED/MG names, angles (`ideal` vs `approx`, with
labels) and a short explanation. `validatePreset` checks internal consistency against the engine; the test suite checks
every entry against a separate hand-written oracle table and the rendered reference geometry against the listed angles.

## Lewis structure

`model/lewis.js`. Terminal lone pairs follow the octet rule (H none). Expanded octets (period 3+) and incomplete
octets (Be, B) are reported as **exceptions**, not errors. Warnings are given for: period-2 atoms beyond an octet, a net
formal charge (e.g. NH₄⁺-like builds), H with more than one bond, unusual terminal bond orders, bonds with no atom,
incomplete octets of other atoms. It never claims that every free build is a valid Lewis structure.

## Challenge

Predict (6 selects: domains, lone pairs, ED geometry, MG geometry, AXE, approximate angle) → Build (optional, own
workspace) → Observe (✓/✗ per answer, the real molecule loaded, “Real molecule | My build” switch, drag/angles still
available) → Explain (constructive per-answer explanations + “Why this shape?”). One molecule at a time, 17 in a fixed order.

## Layout, theme, accessibility

Uses `SimulationDashboard` (see `SIMULATION_DASHBOARD_LAYOUT.md`): toolbox ~15 %, viewer the rest (≈ 62 % of the
workspace at 1366 px, ≈ 72 % at 1920), info panel ≈ 21 %; container-driven stacking below 800 px. Theme: the default
follows the supplied dark-navy reference image; **set `VSEPR_THEME = "light"` in `VSEPRExplorer3D.jsx` for the soft
pastel variant** (same layout, different CSS variables). Controls have tooltips and ARIA roles; the viewer is
keyboard-focusable (Delete/Esc). Without WebGL the viewer shows a clear fallback message and the toolbox, info panel and
Lewis view still work.

## Performance and cleanup

Per frame the scene writes into pooled meshes and three `InstancedMesh` pools (bond strands, angle-arc segments,
arrow shafts/heads) with preallocated temporaries; shared materials/geometries are created once and disposed on unmount,
label textures are cached and disposed, the ResizeObserver is disconnected, and r3f owns the render loop (cancelled with
the canvas). When *Show bond angles* is on, a few small arrays per frame are still allocated (arc selection). The
"Current structure" mini model is a **second small canvas** with `frameloop="demand"` (renders only when the model/view
changes), so it costs essentially nothing while idle.

## Verification

* `npm run test:vsepr` — model (oracle, relaxation, history, Lewis, challenge) + jsdom UI.
* `npm run verify:vsepr` (dev server on :5199) — headless Chromium at 1366×768, 1440×900, 1920×1080, 820×1180, 390×844;
  drives real mouse (and CDP touch at 820) events; saves screenshots. See the final report for what was and was not covered.

Stacked layout (< 800 px container): the dashboard scrolls inside its own box; toolbox, viewer and info panel are stacked and the atom palette is a compact two-row grid. The last full headless run passed at 1366x768, 1440x900, 1920x1080, 820x1180 and 390x844 (software WebGL; synthetic mouse and CDP touch only).
