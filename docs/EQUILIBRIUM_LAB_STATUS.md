# Equilibrium Lab - status against docs/EQUILIBRIUM_LAB_SPEC.md

Legend: Done = implemented and covered by an automated check; Visual = checked by looking at headless-Chromium screenshots; Partial = works with a stated gap.

Verification levels: automated model, reducer and jsdom tests (`npm run test:equilibrium`); headless Chromium with SwiftShader (`npm run verify:equilibrium`). NOT tested: real GPU, real touch devices, Safari, Firefox, screen readers, high-DPI hardware.

| Requirement | Status |
|---|---|
| One block, mode selector (Everyday Analogy, Chemical Model, Compare Both), teacher initial mode (block option and `?mode=`) | Done (UI test, verify) |
| Reducer store, pure engine separate from rendering, no hard-coded curves (graphs are produced from engine samples) | Done |
| A <=> B exact deterministic solution and seeded SSA / tau-leaping passenger model; chunk-invariant; conservation | Done |
| Generic mass-action engine, adaptive RK45, non-negative, atom conservation, Q vs K | Done |
| van 't Hoff K(T), Arrhenius kf with kr = kf/K, catalyst lowers Ea both ways, ideal-gas volume | Done |
| Everyday: two cities, two buses, presets 0.25/1.00, 1/1, 1.00/0.25, transfer-rate graph, indicator, optional population graph, four add/remove buttons with messages, buses follow events | Done (Visual for all three presets) |
| CHANGED: smooth counters and figures by default (constant at equilibrium, exactly 80/20, 50/50, 20/80); optional "Show random fluctuations" (off by default, labelled, with typical spread); stable bus loads fixed per trip; molecule counts constant at equilibrium in Chemical and Compare Both | Done (model, reducer and UI tests; Visual and real-time sampling in verify: 0 counter changes, one stable label per bus) |
| Chemical: five reactions with correct structures, vessel, concentration and rate graphs, K/Q panel, applicable Le Chatelier controls, non-locking learning stages | Done (Visual for all five) |
| Compare Both and analogy-limits statement | Done (Visual) |
| Start / Pause / Resume / Reset / Replay / Step Forward, speeds 0.5x 1x 2x, Show/Hide Graph, Show/Hide Explanation, Simple Wording | Done (UI test) |
| Catalogue entry, component map, resource entry, Learn block options, placeholder `equilibrium-simulator` covered, thumbnail (24 KB), no premium wording, library and lock tests pass with live count 28 | Done |
| Responsive at 1366x768, 910x512, 390x844 in light and dark; no horizontal overflow; buttons at least 24 px | Done for the checks in `verify:equilibrium`; Visual for the screens viewed |
| Keyboard operable (tablist arrows, buttons, graph cursor with arrow keys, Enter pins) | Done for tabs and tab order (verify); graph keyboard reading exercised only by hand-written handlers, not by a test |
| Reduced motion: no infinite CSS animations, static vessel | Done (verify) for CSS; the drawn particles are static by design |
| Screen reader behaviour | Not tested (roles, aria-live status and labels are provided) |

## Known gaps and approximations

- Absolute reaction speeds and Ea values are teaching values; only K and dH are sourced (docs/EQUILIBRIUM_LAB.md).
- Bus loads follow the average rate, not individual random events, even when random fluctuations are on.
- The random mode uses the same 100 people as the smooth mode, so its spread is about +/-4 people at 80/20; it is not reduced by a larger representative population.
- At the smallest phone and 910x512 sizes the "Forward rate = Reverse rate" badge in the road area can touch the lane label and bus tag.
- Graphs drawn after a very large virtual jump look stepped because few samples exist; real-time playback samples continuously.
- Real GPU, touch hardware, Safari, Firefox and screen readers are untested.
