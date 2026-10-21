# Simulation Dashboard Layout (contract for every e-Lab simulation)

Every simulation should be a compact, landscape-first dashboard: students change a
variable and see the particles, the numbers and the graph move **without scrolling**.
The shared implementation lives in `src/components/simulation/`:

| File | Purpose |
| --- | --- |
| `SimulationDashboard.jsx` | The shell (`<SimulationDashboard>`) plus reusable parts: `DashPanel`, `ControlLegend`, `SliderRow`, `ReadOnlyRow`, `Stepper`, `MiniSwitch`, `DashboardTabs`, `ChamberToolbar` / `ToolButton`, `LiveTiles` |
| `SimulationDashboard.css` | All layout rules and the shared slider style (`sd-*` classes) |
| `dashboardLayout.js` | Pure thresholds (`classifyDashboard(width, height)`), unit-testable |

Reference implementations: `src/engines/ideal-gas-simulation/` and `src/engines/gas-laws-explorer/`.

## Using it

```jsx
<InteractiveFrame title="..." subtitle="..." compact={compact} standalone={standalone} dashboard>
  <Workspace />
</InteractiveFrame>

function Workspace() {
  return (
    <SimulationDashboard
      title="..." subtitle="short, one line"
      tabs={<DashboardTabs ... />}          // mode tabs (optional)
      onReset={handleReset}                 // renders the header Reset button
      controls={<DashPanel title="Controls" ...>{/* ControlLegend + SliderRow / ReadOnlyRow */}</DashPanel>}
      chamber={<>{/* DashPanel grow: .sd-chamber + ChamberToolbar */}</>}
      graph={<DashPanel grow noBody>{/* graph */}</DashPanel>}
      live={<LiveTiles items={[...]} />}    // four small coloured tiles
      predict={<DashPanel title="Predict & Reveal" ...>}
      explain={<DashPanel title="What Is Happening?" ...>}
    />
  );
}
```

`InteractiveFrame` gets the `dashboard` prop; it then adds no header or padding of its own
(the dashboard header carries the title, tabs, Reset and the frame's *Open in New Tab* /
*Full Screen* actions) and only provides the fullscreen / new-tab viewport box.

## The rules

1. **Structure**: header (title + short subtitle, mode tabs, Reset, frame actions) / main row
   **Controls | Chamber | Graph** / one bottom row **Live values | Predict & Reveal | What is happening?**.
   The graph is always beside the chamber on desktop, never below the simulation.
2. **Container-driven, not window-driven.** `SimulationDashboard` measures its own box with a
   `ResizeObserver` and sets `data-layout` (`wide` >= 800 px, else `stacked`), `data-header`
   (`one` row >= 1450 px, else two), `data-w`, `data-density` and a size scale `--sd-s`
   (1 to 1.28, only for big boxes). Never branch on `window.innerWidth`.
3. **The dashboard never grows with its content.** Embedded in Learn it is
   `clamp(560px, 100dvh - 4.5rem, 840px)` tall (one visible screen under the top nav); in fullscreen and on
   `/simulation/:id` it fills the viewport box. Rows are `auto / minmax(0,1fr) / fixed bottom height`;
   every grid/flex child that holds text, SVG or canvas has `min-width:0; min-height:0; overflow:hidden`.
   Charts and canvases are `position:absolute; inset:0` inside a sized wrapper, so they can never push a parent larger.
4. **Same layout everywhere.** Learn (with sidebar), fullscreen and the new-tab route all use the 3-column
   layout. Only a container narrower than 800 px (tablet/mobile) stacks, with an *Expand* hint
   (fullscreen) in Learn instead of clipping.
5. **Switching modes must not change the dashboard height.** Panels with variable content reserve their
   space (Predict shows the answer *in place of* the question; Ideal Gas keeps the deviation strip greyed in Ideal mode).
6. **Slider rows are 55-70 px**: name + symbol, lock icon, slider, min/max, coloured value badge. One legend line
   at the top (lock icon = Kept constant, plus the You change / Calculated colours) replaces per-slider helper
   text. Locked rows are grey and disabled, adjustable rows are tinted in the variable colour, calculated
   values are compact read-only rows (`ReadOnlyRow`). Small switches (Moles/Molecules, Volume/Pressure)
   sit beside the label or value (`MiniSwitch`).
7. **One toolbar under the chamber** (`ChamberToolbar`): Play/Pause plus visual toggles with short labels and
   tooltips; labels collapse to icons only when the toolbar is too narrow.
8. **Text stays legible**: nothing below 11 px (10.5 px only for the tiniest secondary captions), and the
   scale factor grows fonts on large screens. Do not shrink to fit; if it genuinely cannot fit, use the
   stacked layout plus *Expand*.
9. **No physics in the layout.** The dashboard only arranges parts; models (`model.js`, `physics.js`) stay pure.

## Checklist for a new simulation

- Renders inside `<InteractiveFrame dashboard>` with `<SimulationDashboard>`.
- No scrolling, no clipped controls, no horizontal overflow at 1366x768, 1440x900 and 1920x1080 in Learn
  (sidebar + top nav present), in fullscreen and on `/simulation/:id`.
- Chamber + graph visible together with the sliders; bottom row fully visible.
- Dashboard height identical across every mode / graph option.
- `data-testid="workspace"` on the root (the default) so the shared Playwright audit can find it.
