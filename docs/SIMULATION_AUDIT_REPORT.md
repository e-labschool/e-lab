# Simulation audit report (Agent A: Tasks 1, 2, 5, 6, 7)

Date: 2026-11-06. Scope: all 25 registered simulations, in Learn-embedded, standalone (`/simulation/:id`, the "Open in New Tab" target) and fullscreen modes. Machine-readable results: `docs/simulation-audit-results.json`. Tool: `scripts/audit-simulations.mjs` (`npm run audit:simulations`). Shell tests: `scripts/test-simulation-shell.mjs`.

## 1. What was wrong before (baseline, 300 views: 116 pass, 15 warn, 169 fail)

| Gap | Simulations |
|---|---|
| No Fullscreen or New Tab control in any mode | equivalence-point, titration-ph-curve, buffer-action-visualizer |
| Controls missing in Learn embedding (frame skipped when `compact`) | electron-configuration, explore-matter-and-states, ph-calculator-visualizer, h-oh-balance, particle-model-visualizer, phase-change-heating-curve |
| Fullscreen but no New Tab (title did not resolve to a registry id) | chocolate-wrapping-rate, particle-model-visualizer |
| Fullscreen button hidden where the browser has no Fullscreen API (iPhone Safari) | all |
| Compliant | the other 14 |

Baseline used an older script version (no CSS fallback), so its fail count includes some artifacts.

## 2. Fixes

Shared (fix once, applies to all):
- `useFullscreen`: native API, with automatic CSS fallback (`data-elab-fullscreen="css"`, page scroll lock, single Escape listener) when the API is missing or rejected. The control is never hidden.
- `SimulationActions`: consistent names/tooltips ("Open in New Tab", "Fullscreen", "Exit fullscreen"), test ids.
- `InteractiveFrame`: optional `simulationId` override; shell context exposes `frameRef`/`simulationId`.
- CSS for the fallback in `simulation-controls.css` and `SimulationDashboard.css`; standalone page sets the document title.
- Regression guard in `test-simulation-shell.mjs`: every engine entry has exactly one `InteractiveFrame`, passes `compact`/`standalone`, and its title resolves to its id.

Engine-specific:
- equivalence-point, titration-ph-curve, buffer-action-visualizer: wrapped in `InteractiveFrame`, viewport layout; equivalence-point artwork scale now measured by ResizeObserver.
- electron-configuration, explore-matter-and-states, ph-calculator-visualizer, h-oh-balance, particle-model-visualizer: stopped bypassing the frame when compact.
- Literal `—`, `⁺` etc. text shown on screen: chocolate-wrapping-rate, buffer-action-visualizer, explore-matter-and-states, collision-theory-visualizer.
- electron-configuration: periodic table scrolled the whole page sideways; now scrolls inside its own wrapper.
- chocolate-wrapping-rate: work row cut off at 390 px; now wraps.
- h-oh-balance: overflow at 820 px; container-query grid.
- ionization-energy-explorer: collapsed at 390 px and controls covered at 125%/150% zoom; layout now measured per container (fit/scroll/stack).
- vsepr-explorer-3d: toggle clipped at 820 px.
- spectroscopy-studio: second "Full screen" control in the NMR spectrum plot relabelled "Present spectrum" so there is one Fullscreen control.
- collision-theory-visualizer: React dev error "Cannot update a component while rendering" (side effects inside state updaters in `ReactionVessel` and the parent); fixed, verified clean in a dev-mode run.

## 3. Results after fixes

Merged run: 600 views (25 sims x modes x 7 viewports; CSS fallback at 3 viewports): **566 pass, 30 warn, 4 fail**. Every simulation shows exactly one Fullscreen and one Open-in-New-Tab control in every mode. Sizes: 1366x768, 1920x1080, 1024x768, 820x1180, 390x844, 1092x614 (125% zoom emulation), 910x512 (150%).

Cell = view counts pass/warn/fail.

| Simulation | standalone | embedded (Learn) | fullscreen (native) | fullscreen (CSS) | controls (new tab / fullscreen) |
|---|---|---|---|---|---|
| electron-configuration | warn 6/1/0 | warn 5/2/0 | pass 7/0/0 | pass 3/0/0 | 1 / 1 |
| vsepr-explorer-3d | pass 7/0/0 | warn 6/1/0 | pass 7/0/0 | pass 3/0/0 | 1 / 1 |
| explore-matter-and-states | pass 7/0/0 | warn 4/3/0 | warn 6/1/0 | warn 2/1/0 | 1 / 1 |
| particle-model-visualizer | pass 7/0/0 | pass 7/0/0 | pass 7/0/0 | pass 3/0/0 | 1 / 1 |
| phase-change-heating-curve | FAIL 6/0/1 | pass 7/0/0 | FAIL 6/0/1 | pass 3/0/0 | 1 / 1 |
| ph-calculator-visualizer | pass 7/0/0 | pass 7/0/0 | pass 7/0/0 | pass 3/0/0 | 1 / 1 |
| h-oh-balance | pass 7/0/0 | warn 6/1/0 | pass 7/0/0 | pass 3/0/0 | 1 / 1 |
| neutralization-particle-visualizer | pass 7/0/0 | pass 7/0/0 | pass 7/0/0 | pass 3/0/0 | 1 / 1 |
| equivalence-point | pass 7/0/0 | pass 7/0/0 | pass 7/0/0 | pass 3/0/0 | 1 / 1 |
| titration-ph-curve | pass 7/0/0 | pass 7/0/0 | pass 7/0/0 | pass 3/0/0 | 1 / 1 |
| buffer-action-visualizer | pass 7/0/0 | warn 6/1/0 | pass 7/0/0 | pass 3/0/0 | 1 / 1 |
| chocolate-wrapping-rate | pass 7/0/0 | warn 6/1/0 | pass 7/0/0 | pass 3/0/0 | 1 / 1 |
| collision-theory-visualizer | pass 7/0/0 | pass 7/0/0 | pass 7/0/0 | pass 3/0/0 | 1 / 1 |
| mixture-separation-explorer | pass 7/0/0 | warn 6/1/0 | pass 7/0/0 | pass 3/0/0 | 1 / 1 |
| build-an-atom | FAIL 6/0/1 | pass 7/0/0 | FAIL 4/2/1 | pass 3/0/0 | 1 / 1 |
| wave-explorer | pass 7/0/0 | pass 7/0/0 | pass 7/0/0 | pass 3/0/0 | 1 / 1 |
| orbital-explorer | pass 7/0/0 | pass 7/0/0 | pass 7/0/0 | pass 3/0/0 | 1 / 1 |
| atomic-spectra-lab | pass 7/0/0 | pass 7/0/0 | pass 7/0/0 | pass 3/0/0 | 1 / 1 |
| ionization-energy-explorer | pass 7/0/0 | pass 7/0/0 | warn 0/7/0 | warn 0/3/0 | 1 / 1 |
| ideal-gas-simulation | pass 7/0/0 | pass 7/0/0 | pass 7/0/0 | pass 3/0/0 | 1 / 1 |
| gas-laws-explorer | pass 7/0/0 | pass 7/0/0 | pass 7/0/0 | pass 3/0/0 | 1 / 1 |
| bonding-visualizer | warn 6/1/0 | pass 7/0/0 | warn 6/1/0 | warn 2/1/0 | 1 / 1 |
| hybridisation-explorer | pass 7/0/0 | warn 6/1/0 | pass 7/0/0 | pass 3/0/0 | 1 / 1 |
| intermolecular-forces-visualiser | pass 7/0/0 | warn 6/1/0 | pass 7/0/0 | pass 3/0/0 | 1 / 1 |
| spectroscopy-studio | pass 7/0/0 | pass 7/0/0 | pass 7/0/0 | pass 3/0/0 | 1 / 1 |

Cell format: status pass/warn/fail view counts.

Totals: 600 views: 566 pass, 30 warn, 4 fail

## 4. Open items

Failures (all in Agent B's engines, not edited by me):
- build-an-atom, 150% zoom (910x512), standalone and fullscreen: Compare Isotopes, Check, New Challenge, Explore Periodic Table covered by other elements; B's tall sticky block leaves little scroll room. Not reproduced at larger sizes.
- phase-change-heating-curve, 150% zoom (910x512), standalone and fullscreen: the particle canvas covers Heating, Cooling, Play, Reset.

Warnings (30), by kind:
- Controls touching the viewport edge on phones/zoom (electron-configuration, explore-matter-and-states, bonding-visualizer, etc.): reachable, no clipping.
- ionization-energy-explorer and build-an-atom re-create a DOM subtree when entering fullscreen; slider values survive.

Known limitations, not fixed:
- Legacy fixed-width simulations are not full width in fullscreen.
- The dashboard "Expand" hint is a second contextual button, not a duplicate of the shell Fullscreen control.
- Window-based `lg:` breakpoints remain in some legacy engines (wave, orbital, atomic-spectra, explore-matter, mixture-separation, particle-model).
- equivalence-point artwork is scaled down on phones (floor 0.42).
- ionization-energy-explorer: the configuration panel scrolls internally in fit mode (original design).
- State persistence (`docs/STATE_PERSISTENCE.md`): only ideal-gas persists across reload; not changed.
- mixture-separation-explorer logs SVG `<ellipse>` negative `rx` errors in the contrast run (pre-existing, not fixed).
- Contrast audit lists explore-matter-and-states "Previous" disabled label 1.78:1 (disabled, WCAG-exempt).

## 5. Checks run

- `npm test`: all suites pass, including the new 40-test shell suite and Agent B's suites.
- `npm run build`: passes. Lint: 0 errors (pre-existing warnings).
- Button-contrast audit (reduced: standalone, light theme, 1366x768, default state, 25 sims, 393 controls): 0 violations, 4 warnings (listed above).
- Dev-mode (React development build) pass, standalone and embedded at 1366x768: one real error found (collision-theory), fixed and re-verified clean.
- Screenshots were opened and inspected for the layout fixes.

## 6. Not tested (be honest)

- Real native fullscreen in real browsers (headless Chromium does not deliver browser-level Escape from native fullscreen; Escape was tested via the CSS fallback and by button).
- Real touch devices, real browser zoom (emulated by viewport size), iOS Safari, Firefox, WebKit, GPU rendering (SwiftShader only).
- Live Supabase-backed lesson context: the embedded mode used a mocked database harness page with a seeded lesson.
- Scientific content was not re-verified; it was preserved, not changed.
- The simulations not re-run after their fixes were measured with a slightly earlier version of the audit script. The contrast audit was run only on the reduced matrix above, not dark theme, phones, hover/focus states, fullscreen or embedded.
- Agent B's work was audited as it stood when merged; later changes are not covered.
