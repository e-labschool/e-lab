# Heating & Cooling Curve (engine `phase-change-heating-curve`, route `/simulation/phase-change-heating-curve`)

A synchronised **temperature-time graph** and **particle container** for **water at 1 atm**, in two modes:
**Heating** (solid -> melting plateau -> liquid -> boiling plateau -> gas) and **Cooling** (gas -> condensation
plateau -> liquid -> freezing plateau -> solid). It replaces the earlier non-interactive, heating-only animation
(3-D chamber from the Particle Model Visualizer + a graph of "energy input"). The Particle Model Visualizer itself
is untouched; this engine no longer imports its chamber.

## One state drives everything

`progress` in [0, 1] of the active mode is the only state (plus the mode). `curveState(curve, mode, progress)`
(`data/curveModel.js`, pure) returns temperature, segment, phase fractions, melt/boil fraction, kinetic and
potential energy (relative) and the energy direction. The graph marker, the temperature readout, the caption, the
energy bars **and** the particle arrangement (`lib/particles.js`) are computed from that one object each render, so
they cannot disagree. Play changes `progress` with the clamped frame time (`src/lib/frameTime.js`,
`createFrameClock`); the slider and Reset set it directly; switching mode resets it. The canvas reads the same state
through a ref and writes what it drew into `data-*` attributes (`data-progress`, `data-solid/liquid/gas`, ...) so tests
can check graph and particles against each other.

## The physical model and its assumptions (also shown on screen)

- **Constant heating power** (heating) / **constant cooling power** (cooling): time is proportional to energy transferred.
- Pure substance, constant pressure: temperature is constant during a phase change; within a phase the curve is a
  straight line (constant specific heat capacity).
- **The cooling curve is the heating curve reversed** under the same constant-power idealisation: the energy absorbed
  on melting / boiling is released on freezing / condensing (no supercooling or superheating). Mathematically
  `curveState(cooling, p) == curveState(heating, 1 - p)` for temperature, phase fractions and energies (tested).
- **Switching modes** resets progress to the start of the new mode (gas at 130 °C for Cooling, ice at -20 °C for Heating)
  and pauses. Mapping by physical state was considered and rejected as more confusing than a clean restart.
- **Reset** returns to the start of the **active** mode and pauses. **Play** at the end replays from the start;
  moving the slider pauses.

### Substance and data (`data/substance.js`) - water only

The simulation was already a water curve, so water is kept; its numbers are never applied to another substance (there is
no substance selector). Melting point 0 °C, boiling point 100 °C (1 atm). Specific heat capacities (J g⁻¹ K⁻¹): ice 2.09,
liquid 4.18, steam 2.01. Specific latent heats (J g⁻¹): fusion 334, vaporisation 2257. Typical textbook / data-book values (CRC
Handbook, NIST WebBook); one worked-example page lists 2.06 / 4.19 / 2.03 / 334 / 2257, i.e. books differ in the third
digit - no conclusion depends on it. Window: -20 °C to 130 °C (a choice of display range).

### Segment lengths

Energy per gram per segment (water): solid heating 41.8, melting 334, liquid heating 418, boiling 2257, gas heating
60.3 J/g (total 3111). With a *true* time axis boiling alone is **72.5 %** of the graph and heating the solid 1.3 %, so:

- **Default, "schematic"**: segment duration is proportional to the **square root** of its energy. The order and
  ranking are the real ones (boiling > liquid heating > melting > gas heating ~ solid heating) but the plateaus are
  shortened (heating: 6.4 / 18.2 / 20.3 / 47.3 / 7.7 % of the time). The graph note says so.
- **"Time axis to scale"** checkbox: durations exactly proportional to energy. Both use the same model; the endpoints
  and temperatures do not change. The x-axis is labelled "Time (arbitrary units)" (the power is not specified).

## Particle model (`lib/particles.js`, pure)

80 particles, fixed for the whole run; the **radius depends only on the container size**, never on the state or the
temperature (no particle expands or shrinks).

- **Arrangement from the state only**: every particle has a melt threshold and a boil threshold. Its progress
  through each transition is a smoothstep of the plateau fraction, so a plateau changes the arrangement
  **gradually** (about half the particles are in the new state at the plateau midpoint; counts are monotone), and
  scrubbing backwards shows exactly the right arrangement. Melting starts at the top of the lattice and works
  down, the pool fills from the outside in; on cooling the order reverses (crystal grows from the floor up).
- **Solid**: regular lattice on the floor, particles vibrate about their sites. **Liquid**: close-packed irregular
  pool, particles jiggle and slide about home positions. **Gas**: free flight with elastic wall reflections.
- **Temperature -> kinetic energy**: mean KE is proportional to T (kelvin). Vibration / jiggle amplitude and gas speed are
  proportional to sqrt(T/273.15 K): the motion clock advances at dt*sqrt(T/T0), so a plateau (constant T) has constant
  speed and amplitude; the hot end is 26 % faster than the cold end - that is the real ratio, not exaggerated (the kinetic
  energy bar makes it visible). Liquid and gas have the same mean KE at the same temperature; only confinement differs.
- **Potential energy**: the "Potential energy (arrangement)" bar is the latent heat taken in so far, normalised
  (rises on melting and boiling, falls on freezing and condensing, constant while only the temperature changes).
- Thermal motion keeps running while paused (matter at 100 °C does not stop); `prefers-reduced-motion` freezes the jiggle
  but not the change of arrangement.

## UI and layout

Left: particle container (canvas sized by a ResizeObserver; DPR-aware), temperature and segment readout, KE / PE bars,
phase fractions. Right: graph (SVG sized by a ResizeObserver, text at real pixel size): Y "Temperature (°C)", X
"Time (arbitrary units)", segment bands, melting / boiling point lines, the whole curve faint and the travelled part bright,
and a moving marker with guide lines. Below: Heating | Cooling, Play / Pause, Reset, Progress slider, Speed (0.5-4x), "Time axis
to scale". Container-driven: >= 760 px wide -> split screen 46 % | 54 %; narrower -> stacked (particles above graph),
never overlapping; fullscreen / new tab fill the viewport (the root scrolls only if a very small viewport cannot fit both
panels), embedded height `clamp(540px, 100dvh - 8rem, 760px)` when wide. The engine now always renders inside the
shared `InteractiveFrame`, so the Fullscreen / Open in New Tab buttons also exist when it is embedded in a Learn
lesson (the old `compact` early return skipped the frame).

State is **not persisted** (the old engine did not use `useSimulationSessionState`; neither does this one).

## Tests and verification

- `npm run test:heating-cooling` (`scripts/test-heating-cooling-curve.mjs`): segment order (both modes), tiling of [0,1],
  true-scale durations proportional to energy, endpoints, plateau temperature exactly constant, monotone heating /
  cooling, cooling == reversed heating (temperature, phase fractions, energies; both time scales), phase fractions
  in [0,1] and consistent with the segment, KE constant on plateaus / PE changes only on plateaus, particle counts match
  the fractions and are monotone, constant radius, sqrt(T) motion, positions inside the container, scrub-back gives an identical
  snapshot, + jsdom UI tests (marker position vs progress, graph and canvas agree, mode switch, Play / Pause / Reset, scale option).
- `npm run verify:build-atom-heating`: headless Chromium (build + `vite preview`) at the five sizes, new tab / embedded /
  real fullscreen: no overlap, no overflow, controls usable, full **Play** runs of both modes at 4x (segment order,
  monotone temperature, exact plateaus, marker moves, canvas progress = graph progress, constant radius), slider scrubbing
  incl. a real mouse click on the track, particle counts and **real canvas pixel colours** at the plateau midpoints, canvas
  resize after fullscreen, no console errors.
- Not verified: real GPU, touch, Firefox / Safari, a headed browser's fullscreen, long hidden-tab behaviour (the frame clamp is
  unit-tested only).
