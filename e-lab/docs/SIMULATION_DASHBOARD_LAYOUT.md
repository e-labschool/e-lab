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
- Control contrast (every simulation, every control, every state): `npm run verify:button-contrast`, see below.

## Shared button style contract

Every control inside a simulation (buttons, tabs, segmented options, selects, the shell's Full Screen / Open in New
Tab) must be **visible on the surface it sits on**, in light mode, dark mode, inside a dark panel and over a canvas.
The decorative tokens (`--color-line` #DCE1F0, white or pale tints) are for dividers, **not** for control outlines:
they give ~1.2:1 against the page, which is how Full Screen and the toolbar buttons turned white-on-white.

**Thresholds** (WCAG 2.2, audited numerically):

| Part | Minimum |
| --- | --- |
| Label text vs the control's effective fill | 4.5:1 (3:1 for large / 18.66 px bold) |
| Icon (svg stroke/fill) vs the fill | 3:1 |
| Control boundary: max(fill, border) vs the surrounding surface, for any control that has a fill or a border | 3:1 |
| Focus-visible ring (outline or ring shadow) vs the surface | 3:1, at least 2 px wide |
| Hover and active | must visibly differ from default and keep the text/boundary thresholds |
| Selected / pressed | must differ from an unselected sibling (use a solid accent fill + white label, not a pale tint) |
| Disabled | stays >= 3:1 and reads as inert (dashed outline, no shadow); WCAG exempts it, so it is only a warning |

**Where the style lives**

- `src/components/interactive-shell/simulation-controls.css` (imported by `InteractiveFrame`, `SimulationActions`,
  `SimulationDashboard`). It defines the tokens, `.sim-toolbar-btn` (used by `SimulationActions`) and `.sim-btn`
  (use it for any new engine-owned toolbar button: `<button className="sim-btn">`, `sim-btn--primary` for the solid one).
- Tokens (all `--sim-btn-*`): `fill`, `fill-hover`, `fill-active`, `ink`, `border`, `border-hover`, `accent`,
  `accent-hover`, `accent-ink`, `focus`, `focus-halo`, `hover-tint`, `active-tint`, `shadow`, plus `--sim-fill-<hue>`
  solid fills that hold a white label at >= 4.5:1.
- Light surfaces use the `:root` values, the app's dark mode uses `.dark`, the dashboard panel (`.sd-root`) always
  paints its own surface so it picks values with `light-dark()` from its own `color-scheme` (the navy VSEPR and
  Hybridisation themes declare `color-scheme: dark` and therefore get the navy set automatically).
- A **permanently dark panel** inside a light page (Buffer, Titration, Equivalence Point, the Ionization graph) gets
  `className="sim-surface-dark"` on its root, which swaps in the dark token set in both app themes.
- `.elab-sim` (added to `InteractiveFrame` and to the dashboard root) is a safety net for engines still styled with
  Tailwind utilities: it lifts `border-[var(--color-line)]` button/select/option-group borders to `--sim-btn-border`,
  adds a hover/active tint and a visible focus ring, and swaps `bg-[var(--color-indigo|teal|amber|violet|green|coral)]`
  white-label buttons and `-soft` pressed tints for the >= 4.5:1 solid fills. It matches whole class tokens
  (`[class~=...]`), so `hover:bg-...` variants are untouched.
- Engine CSS may only set tokens/borders to fit its own surface (see `VSEPRExplorer.css`); it must not restyle the
  shell buttons. Data-driven fills (orbital family colours, element colours) pick their label with
  `readableInk(fill)` from `interactive-shell/contrastInk.js`.
- Focus ring = 2 px outline + 2 px gap filled by `--sim-btn-focus-halo` (a contrasting halo), so it reads on light,
  dark and canvas backgrounds. Segmented tabs draw it inside the tab.

**Rules for a new simulation**

1. Use the dashboard classes (`sd-btn`, `sd-tool`, `sd-tab`, `sd-switch`) or `.sim-btn`; never hand-write `border-color: #d5deef`
   / white-on-pale controls.
2. A selected / pressed state is a solid accent fill with a white label; a pale tint alone is never enough.
3. Do not set `outline: none` on a control; the shared focus ring is the keyboard indicator.
4. Put dark panels under `sim-surface-dark`, and set the `--sim-btn-*` tokens (not new hard-coded colours) when an engine
   has its own themed surface.
5. Run `npm run verify:button-contrast` (dev server on :5199) and fix every listed control before shipping.

### Contrast audit

`scripts/verify-simulation-button-contrast.mjs` (`npm run verify:button-contrast`, needs `npm run dev -- --port 5199`
and Playwright + Chromium, same setup as `verify:vsepr`). It opens `/simulation/<id>` for every id in
`src/data/simulationRegistry.js` at 1366x768 and 390x844 in light and dark theme, plus the real Full Screen variant and
the embedded-frame variant (`/interactives/<id>`, engines that have one), clicks through every tab / segmented option,
and for each distinct control computes the ratios above in default, hover, focus-visible and active states (forced
through CDP `CSS.forcePseudoState`, transitions disabled). Surroundings painted by a canvas, gradient or translucent
layer are sampled from real screenshot pixels. It lists every violation with the measured ratio, writes
`button-contrast-rows.json` (all controls with ratios) and exits 1 when there are violations. Env: `SIMS=`, `SIZES=`,
`THEMES=`, `VARIANTS=`, `STATES=0`, `SHOTS=1`. Limits: headless Chromium + SwiftShader only (no real GPU, no screen
reader, no real touch), one level of tabs, at most 70 distinct controls per page view.
