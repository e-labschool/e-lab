# Equilibrium Lab - Dynamic Balance

One integrated simulation (catalogue id `equilibrium-lab`, topic Equilibrium, syllabus R2.3) with three modes: Everyday Analogy, Chemical Model and Compare Both. The teacher block option `simulationConfig.initialMode` (or `?mode=` on the standalone route) chooses the opening mode; students can always switch. The binding specification is `docs/EQUILIBRIUM_LAB_SPEC.md`; per-requirement status is in `docs/EQUILIBRIUM_LAB_STATUS.md`.

## Architecture

Source: `src/engines/equilibrium-lab/`.

- `model/` is pure JavaScript with no React or DOM. Nothing in it draws.
  - `store.js` is a single reducer `(state, action) -> state` with three scenes (everyday, chemical, compare). Each scene has a status (idle, running, paused), a recorded disturbance script for Replay, stage progress, and a seed. `checkInvariants(state)` is run by the tests after every action.
  - `everyday.js` is the A <=> B passenger model. `chem.js`, `kinetics.js`, `thermo.js` and `reactions.js` are the generic mass-action engine and its data. `visual.js` turns engine amounts into integer molecule counts and reaction events for the picture.
  - `explain.js` holds all teaching text, including the Simple Wording variants.
- `ui/` renders: SVG graphs, the SVG city/bus scene, a 2D canvas vessel, controls and panels. `EquilibriumLab.jsx` is the shell and uses the shared `InteractiveFrame`.
- Test hooks: `globalThis.__EQ` (`getState`, `dispatch`) and `__EQ_DT_MAX`. The action `run/advance {dT}` advances virtual simulation time so tests and verification do not depend on machine speed.

## Everyday model

Two cities, 100 people start in A. Each person in A leaves at rate kf, each in B at rate kr, so the forward transfer rate is kf*A and the reverse rate is kr*B.

- Passenger model: exact Gillespie SSA, seeded (mulberry32), with a stored next-event time so results do not depend on how time is chunked. When more than 4000 events are expected in one tick it switches to binomial tau-leaping.
- Graph and indicator use the exact mean-field solution A(t) = Aeq + (A0 - Aeq) exp(-(kf+kr) t), Aeq = A0*kr/(kf+kr). The event rates drawn as "measured" are binned in 0.1-wide bins.
- Presets: Towards A kf 0.25, kr 1.00 (80/20); Center 1/1 (50/50); Towards B 1.00/0.25 (20/80). At equilibrium 0.25 x 80 = 1.00 x 20 = 20 people per time unit.
- Buses carry all pending departure events (label = true number, at most five figures drawn). Station figures stand for 1/2/5/10/20 people, with exact counters beside them.
- Add/remove 20 people in either city (cap 400 people in total). Controls are enabled only after Start.

## Chemical engine

- Rate laws use the stoichiometric coefficients as orders (an elementary-step teaching idealisation), rf = kf prod c^nu(reactants), rr = kr prod c^nu(products). With kr = kf/Kc this gives rf/rr = K/Q exactly.
- Integrator: Dormand-Prince RK45 with step control (rtol 1e-9, atol 1e-13) that rejects steps producing negative concentrations. `solveEquilibrium` is an independent bisection root-finder used to cross-check the ODE.
- K(T): van 't Hoff with constant dH, referenced to a literature K at a reference temperature. For gases Kc = K_standard (R T / p_standard)^(-dn) with R in dm3 bar mol-1 K-1, p_standard = 1 bar.
- Rate constants: Arrhenius kf(T) = kfRef exp(-Ea/R (1/T - 1/Tref)); kr = kf/Kc, so thermodynamic consistency holds at every temperature. A catalyst lowers Ea by the same amount in both directions (factor exp(dEa/RT)), so K is unchanged.
- Volume: ideal gas, concentrations scale as 1/V and pressure follows p = (sum c) R T. Allowed range 0.25x to 4x the starting volume.
- Atoms are tracked as a ledger (initial + added - removed) and compared with the atom totals implied by the concentrations; the tests require agreement to 1e-9.
- Indicator: equilibrium when |rf - rr| / max(rf, rr) < 1% ("attained"), 10% ("near"), never exact equality.

### Molecule picture

Integer counts M_i + nu_i xi (xi = drawn extent) keep every drawn atom conserved. Reaction events are drawn at no more than 14 per second, plus exchange events at no more than 3 per second with odds rf:rr so that equilibrium visibly continues. They are an illustration of the engine's amounts and rates, not a molecular dynamics calculation: "not every collision reacts" is stated on screen.

## Parameters and sources

| Reaction | Data | Source |
|---|---|---|
| N2O4 <=> 2NO2 | dfH 9.079 and 33.095 kJ/mol, dfG 97.787 and 51.258 kJ/mol at 298.15 K, giving dH = +57.11 kJ/mol, dG = 4.73 kJ/mol, K = 0.148 | NIST-JANAF tables (gas phase) |
| N2 + 3H2 <=> 2NH3 | dfH -51.374, dfG 15.879 kJ/mol NH3 at 600 K, giving dH = -102.7 kJ/mol, K(600 K) = 1.7e-3 (bar-2) | NIST-JANAF NH3(g) |
| H2 + I2 <=> 2HI | K(700.15 K) = 52.1, dH = -12.17 kJ/mol | Fit of Bodenstein (1899) data, 283-508 C |
| Fe3+ + SCN- <=> FeSCN2+ | K = 146 at 25 C and I = 0.40 M, kf = 127 dm3 mol-1 s-1, dH = -1600 cal/mol | Below, Connick and Coppel, J. Am. Chem. Soc. 80, 2961 (1958) |
| A <=> B | dH = +20 kJ/mol, Ea = 40 kJ/mol, kf/kr from the presets | Teaching values, not a real reaction |

Activation energies, reference rate constants and catalyst dEa values are teaching values chosen so that every reaction equilibrates within seconds to a minute of screen time; they are not measured (see Limitations). Playback factors (simulation time per real second): A <=> B 0.5, Fe3+/SCN- 0.25, others 1.

## Limitations and approximations

- Mass-action orders equal the stoichiometric coefficients, which is true only for elementary steps. The real Haber process and H2 + I2 mechanisms are not elementary; only the equilibrium positions are quantitative.
- Constant dH over each temperature range (van 't Hoff); ideal gases; Fe3+/SCN- uses an ionic-strength-specific K and ignores hydrolysis and higher complexes.
- Absolute rate constants and activation energies (except the Fe3+/SCN- kf) are teaching values; the speed of approach is illustrative. Temperature ranges are limited to those with sensible data.
- The vessel size, piston height (~V^(1/3)) and number of drawn molecules are schematic. One drawn molecule represents a fixed small amount (e.g. 0.005 mol for N2O4).
- The people in the Everyday mode are an analogy for amounts; the on-screen analogy-limits statement says people have no energy, no collision requirement and no equilibrium constant.
- Compare Both maps 100 people to 1.00 mol dm-3 of A at V = 1 dm3 (one person = 0.01 mol dm-3).
- Replay repeats the recorded disturbances at their recorded simulation times with the same seed; Reset starts a new seed.
- The simulation does not persist run history across reloads; the chosen mode and Simple Wording are remembered through the shared session-state hook.

## Tests and verification

- `npm run test:equilibrium` runs `scripts/test-equilibrium-model.mjs` (engine, all 15 spec cases that concern the model, atom conservation, stoichiometry, Q vs K, K invariance, seeds, presets), `test-equilibrium-store.mjs` (reducer, reset/replay/pause, mode switching, config) and `test-equilibrium-ui.mjs` (jsdom: registration, controls, modes, options component). `npm test` includes them.
- `npm run verify:equilibrium` builds to a temp directory, serves it with `vite preview` and drives headless Chromium through the required screenshot set at 1366x768, 910x512 and 390x844 in light and dark, reduced motion, keyboard and `?mode=`. Screenshots are written to `/tmp/equilibrium-verify` (or the path given as an argument). It uses software rendering only.
