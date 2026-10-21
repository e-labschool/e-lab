# Simulation Dashboard Layout (contract for every e-Lab simulation)

Every simulation is a compact, landscape-first dashboard: students change one variable and see the
particles, the numbers and (optionally) the graph move **without scrolling**. The shared implementation
lives in `src/components/simulation/`:

| File | Purpose |
| --- | --- |
| `SimulationDashboard.jsx` | Shell `<SimulationDashboard>` plus parts: `DashPanel`, `SliderRow`, `ReadOnlyRow`, `StepButton`, `MiniSwitch`, `DashboardTabs`, `ChamberToolbar` / `ToolButton`, `LiveStrip`, `ConstantsRow`, `ExplainLine`, `PredictPopover`, `HeaderPopover`, `PopoverSection`, `SettingToggle` |
| `SimulationDashboard.css` | All layout rules, slider style and popovers (`sd-*` classes) |
| `dashboardLayout.js` | Pure thresholds (`classifyDashboard(width, height)`), unit-tested |

Reference implementations: `src/engines/ideal-gas-simulation/` and `src/engines/gas-laws-explorer/`.
(`ControlLegend` and `LiveTiles` from the old contract were removed.)

## Structure

```
Header   [ Title + subtitle | Mode selector | Show/Hide Graph | Reset | Settings | (frame) New Tab, Full Screen ]
Main     [ Controls | Chamber | Graph (optional, animated, beside the chamber) ]
Bottom   [ Live-value strip (P V T n ...) | Predict ]  +  one-line explanation (+ info icon)
```

```jsx
<SimulationDashboard
  title subtitle tabs={<DashboardTabs .../> | <MiniSwitch .../>}
  onReset graphShown onGraphToggle graphWide
  settings={<>{/* PopoverSection + SettingToggle ... */}</>}
  controls={<DashPanel title="Controls">{/* SliderRow, ConstantsRow, ReadOnlyRow */}</DashPanel>}
  chamber={...} graph={...}
  live={<LiveStrip items={[...]} />}
  predict={<PredictPopover .../>}
  explain={<ExplainLine text details />}
/>
```

## Rules

1. **Graph is optional and beside the chamber.** Hidden: controls ~23% | chamber takes the rest (about 65-75%
   of the width). Shown: the graph column animates in (flex-basis, about 40%; 42% in `md`, 58% when the
   graph asks for `graphWide`). It is never placed below the chamber on a wide container.
2. **Container-driven, not window-driven.** The dashboard measures its own box with a `ResizeObserver` and
   sets `data-layout` (`wide` >= 800 px, else `stacked`), `data-header` (one row >= 820 px), `data-w`,
   `data-density` and the scale `--sd-s`. Never branch on `window.innerWidth`.
3. **Never grows with its content.** Embedded in Learn: `clamp(560px, 100dvh - 4.5rem, 840px)`; fullscreen and
   `/simulation/:id` fill the viewport box. Anything holding text, SVG or canvas has `min-width:0; min-height:0`.
4. **Same layout everywhere** (Learn with sidebar, fullscreen, new tab). Only containers narrower than 800 px
   stack (controls, chamber, graph, bottom; chips and explanation wrap).
5. **Switching modes or graph options does not change the dashboard height.**
6. **Slider rows are 45-65 px.** Only the independent variable is a slider. Controlled variables sit in ONE
   compact read-only `ConstantsRow` ("Temperature: 300 K lock | Amount: 1.00 mol lock"); the calculated variable
   is a read-only `ReadOnlyRow`. No banners, no duplicate values, no large formula panels.
7. **Secondary options live in Settings** (initial conditions, trails, flashes, mol/molecules, units), not on
   the main screen. Predict is a small optional button; the explanation is a single dynamic line.
8. **Legibility**: nothing below 11 px; if it cannot fit, stack rather than shrink.
9. **No physics in the layout.** `model.js` / `physics.js` stay pure.

## Verification

- Unit: `npm run test:dashboard-layout`.
- Visual (headless Chromium via Playwright, needs the dev server): `npm run verify:simulations` runs
  1366x768, 1440x900 and 1920x1080 on `/simulation/:id`, every mode with the graph shown and hidden,
  Ideal/Real, both control modes, Settings, Reset, a Learn-width (viewport minus 260 px sidebar) embed and a
  390 px stacked view; it fails on document scroll, horizontal overflow or console errors and saves screenshots.
  Fullscreen and Learn-with-real-sidebar are not covered by this script.
