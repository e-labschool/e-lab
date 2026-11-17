# Mole Lab: architecture and extension guide

Spec: `docs/MOLE_LAB_SPEC.md` (binding). Status per requirement: `docs/MOLE_LAB_STATUS.md`.
Phase 1 (this build) = engine (Part E), 3D packet system (Part B), shell (Part C), Stages 1 and 2 (Stages 3 to 6 were added later, see below; the next sentence is historical):
they show a labelled "coming in the next build" placeholder, but their calculation engines (solutions, dilution, gas, reactions, limiting) exist and are unit-tested.

## Layout

```
src/engines/mole-lab/
  engine/   pure JS, no React/three. Deterministic and unit-tested.        index.js re-exports everything
  scene/    three.js / react-three-fiber (bag, particles, bench, balance)
  ui/       React: store hook, interaction hook, stage panels, shared parts
  MoleLab.jsx (shell, tabs, guided/free, settings), MoleLab.css (scoped under .ml-root), meta.js, stages.js
```
Registration: `src/data/simulationCatalogue.js` (id `mole-lab`, tier `free`, NO syllabus codes: one single simulation), `src/data/simulationEngineComponents.js` (lazy import).

## Core engine rules

* **Amounts are integer quanta**: 1 quantum = 1e-9 mol (`QUANTA_PER_MOL`), cap `MAX_AMOUNT_MOL` = 500. split / combine / pour / react move whole quanta, so totals are exactly conserved; `fromQuanta` is a single division (no 0.30000000000000004). `clean(x)` snaps derived reals to 12 significant digits.
* **One molar-mass source** (`elements.js`, Part A5). The DEFAULT policy is `booklet` (IB data booklet 2 d.p. values: Mg 24.31, H2O 18.02, NaOH 40.00; owner decision, replacing the spec's Mg = 24.0 example). `teaching` (Mg 24.0) and `precise` (IUPAC, Mg 24.305) exist only as explicit arguments (tests); the UI shows no policy switch. The policy is part of the state and shown in the UI; there is no silent switching. Changing it re-applies the last typed input visibly.
* **Counting vs reacting (A4)**: `countingPackets` yields atoms (`atoms:H`) for molecular substances and ions (`ion:Na+`) for ionic ones, metals give none; it never yields H2/O2 from H2O. Reactions are a separate module with an explicit atom/charge ledger.
* **Display vs exact**: selectors return `{ exact, text }`; text is formatted once, UI never re-derives chemistry.

## Store (engine/store.js)

`reduce(state, action)` is pure. `state = { version, stage, mode, policy, scenes: {1..6}, last }`; each stage owns a scene `{ stage, packets[{id, substanceId, q, open, role}], vessels[], nextId, data }`. A rejected action returns the same packet array and a `last` notice `{ ok:false, code, message }`.
Actions: `stage/set`, `mode/set`, `policy/set`, `reset`, `packet/open|close|split|combine|compact|pour`, `s1/*`, `s2/*`, `guide/answer`.
Checks for tests and debugging: `checkInvariants(state)`, `sceneLedger`, `atomLedger`, `chargeLedger`.
`useMoleStore` applies the reducer synchronously on a ref so rapid events see each other's results.

## Interaction state machine (engine/interaction.js)

idle, selected, dragging, targetDetected, open, tilting, pouring, transferComplete. Idempotent events. The only chemistry commit is one `packet/pour`, issued at the tilting to pouring transition and guarded by a `txId`; animations only read the store, so interrupted animations cannot change amounts. `usePacketInteraction` wires it to buttons, keyboard, pointer and touch; every drag has a button alternative.

## 3D system

* Standard bag: fixed geometry in `scene/bagSpec.js` (never rescaled). Fill is driven only by the mole fraction (`fillFraction`).
* Particles: deterministic slot layout (`slots.js`), bottom-up reveal, one instanced mesh per element plus bonds. Detail low/medium/high = 40/84/140 entities per full packet; `FpsMonitor` steps detail down when fps is poor.
* Environment light is three's `RoomEnvironment` generated on the GPU (no network). Blob shadows and canvas textures (no troika text).
* Camera: `benchLayout.fitDistance` frames N packets; more packets means more bench, never a bigger or smaller bag. More than 6 packets of one substance are grouped (`ui/benchEntries.js`).
* Fallbacks: no WebGL or context loss gives `FallbackBench.jsx` (2D). `prefers-reduced-motion` skips tweens.
* Debug hook (tests): `document.querySelector('[data-testid="mole-lab"]').__moleLab = { getState, dispatch, ix, detail }`.

## Engine API for phase 2 (Stages 3 to 6)

All exported from `engine/index.js`:
* `solutions.js`, `dilution.js`: concentration, volume, mass of solute, dilution c1V1 = c2V2, solution-only `NaOH_aq`.
* `gas.js`: RTP convention (24.0 dm3 per mol, labelled) and PV = nRT (R = 8.314462618).
* `reactions.js`: four balanced reactions, `checkBalance`, `equationString`, `ionicNote`, `atomLedger`, `applyExtent`.
* `limiting.js`: `limitingReagent` (by extent, ties flagged), `limitingFromMasses`, `theoreticalYieldMass`, `percentYield`.
* `packetOps.js`: `reactVessel` for converting packets in a vessel via a reaction.
* `tutor.js`: prediction/choice generation pattern (add `stageNPrediction`).

### How to add a stage
1. Write `engine/stageN.js` exporting `createStageNScene(ctx)`, `reduceStageN(scene, action, ctx)` returning `{ scene, notice }` or `null`, and `invariantsStageN(scene, ctx)` returning `string[]`.
2. In `engine/store.js` add `registerStage({ stage: N, create, reduce, invariants })` (remove the placeholder behaviour: `isStageBuilt(N)` becomes true).
3. Add selectors in `engine/selectors.js` (`exact` and `text` separately).
4. Create `ui/StageN.jsx` using `StageFrame` (it passes `aspect` to a function-valued `workspace`), `PacketBench` for packets and `CalcPanel`/`ValueField`/`PredictCard` from `ui/parts.jsx`; reuse `usePacketInteraction`.
5. Mark the stage `built` in `stages.js` and render it in `MoleLab.jsx` in place of `PendingStage`.
6. Add tests to `scripts/test-mole-lab-store.mjs` (the random-sequence property test and `checkInvariants` should cover the new stage) and a probe to `scripts/verify-mole-lab.mjs`.

### How to add a substance
Add an entry to `SUBSTANCES` in `engine/substances.js` (formula, name, state, bonding mode molecular/ionic/metallic, geometry builder, colour data). Elements must exist in `elements.js` (add masses there, nowhere else). Add the id to `SELECTABLE_IDS` to offer it in Stage 1/2. Run `test-mole-lab-engine.mjs`: it checks composition and molar-mass tables.

### How to add a reaction
Add to `engine/reactions.js` with integer coefficients; `checkBalance` must pass (atom and charge ledgers), then add a test case with the expected limiting reagent and yield.

## Stages 4, 5 and 6 (Gas Volume, Chemical Equations, Limiting Reagents)

Engine (pure, in `engine/`): `gasLab.js` (RTP convention vs PV = nRT, density, v_rms, condensation guard), `stage4.js` (gas chamber scene), `reactionBench.js` (ONE reaction bench behind Stages 5 and 6, action prefixes `s5/` and `s6/`),
`rearrange.js` (the atom-conserving animation PLAN: drawn molecule counts derived from amounts, per-atom tracks, an independent `planLedger` recount), `tutor456.js` (predict / apply questions), `views456.js` (exact numbers kept apart from display text).
UI: `ui/stages/` (`Stage4.jsx`, `ReactionStage.jsx` shared by `Stage5.jsx` / `Stage6.jsx`, `useZoneInteraction.js`, `StageParts456.jsx`, `stages456.css` scoped under `.ml-root`). Scene: `scene/ZoneBench.jsx`, `GasChamber.jsx`, `ReactionZone.jsx`, `molBatch.js`.

Rules that matter when you change anything here:
* **The picture never decides chemistry.** Stage 4 reads `gasLabState`; Stages 5/6 read `data.lastRun` (before / extent / after). A `run` is ONE atomic reduction that empties the zone into product and leftover packets; the 3D animation replays it from `planReaction`, so skipping or interrupting it changes no amount.
* Releasing a packet into the chamber or zone is the generic `packet/pour` into a vessel, committed once at the tilting -> pouring transition (same guard as Stage 1/2). `useZoneInteraction` is a fork of `usePacketInteraction` that adds the apparatus as a destination (drop anchors `zone#0..n` give a wide drop area, the funnel is a pseudo-node under the vessel id). If Stage 3's `useLabInteraction` and this hook are ever merged, keep the one-commit guard.
* Drawn molecule counts are representative (gas: 12 per mol for EVERY gas so the number density of the picture is constant at constant T and P; reactions: about 3 per mol, at most 6 events). They are never used for a calculation.
* Aqueous products: NaOH(aq) is drawn as Na+ and OH- ions during the run; the product PACKET is a labelled "conceptual mole summary", not a dry solid.
* Stage 4 limits: 220-500 K, 50-300 kPa, up to 4 mol; conditions where the gas would condense are refused with an explanation.

## Stage 3 (Concentration Laboratory)

Engine (pure, `engine/`): `concLab.js` (solute table NaOH/NaCl with solubility and maximum concentration, glassware limits, viewer-window maths), `stage3.js` (scene + reducer; actions `s3/*`; all-or-nothing operations), `stage3View.js` (selectors: stations, dilution, ion-viewer panes), `stage3Tutor.js` (predict and apply questions, answers computed by the engine modules). Scene: `scene/glassware.js` (lathe profiles; volume and height come from the same profile, the flask mark is exactly the nominal volume), `glassObject.js`, `labLayout.js`, `ConcBench.jsx`, `ionScene.js` + `IonViewer.jsx`. UI: `ui/Stage3.jsx`, `ui/stage3/` (`useLabInteraction.js`, `Stage3Parts.jsx`, `Stage3.css` scoped under `.ml-root`).

Rules that matter when you change anything here:
* Concentration exists only when the flask is at the calibration mark (c = n / V_flask via `solutions.js`); the beaker volume is never assumed to be water plus solid. Dilution uses `dilute()`: the aliquot carries c1V1, the stock keeps the rest.
* Dissolved solute moves from the solid key to the `*_aq` key on stirring; the viewer draws hydrated ions only. Liquid colour never encodes concentration.
* Each apparatus action is ONE dispatch; animations only read the store. Conservation: packet + beaker solid + beaker aq + flask == weighed amount (dilution: stock + aliquot + flask).
* The viewer shows a fixed 2 nm window in every pane (c x 4.8 formula units); a denser pane only adds ions to a sparser one (prefix-stable sampling).
* Molar mass comes from the engine's single source for the active policy, never hard-coded; a policy change after preparation is flagged (`flags.policyMismatch`), not silently recomputed.

## Data sources and simplifications
* N_A exact 6.02214076e23 imported from `src/lib/atomic/constants.js` (asserted).
* Atomic masses: `src/lib/atomic/abundance.js` where available, IB-booklet 2 d.p. otherwise; Mg = 24.31 (booklet).
* RTP molar volume 24 dm3 mol-1 (always labelled "at RTP") is the convention; PV = nRT gives about 24.8 dm3 mol-1 at 298 K and 1.00e5 Pa and 24.47 at 298.15 K and 101.325 kPa. Both are labelled, never mixed.
* The bag is a counting analogy, not a volume or packing model; particles drawn are representative. This statement is always visible in the reference panel.

## Commands
`npm run test:mole-lab` (engine, store, scene, UI, Stage 3, Stages 4-6; `npm run test:mole-lab-stage456` alone), `npm run verify:mole-lab-stage456` (Chromium: screenshots, real mouse drags, conservation), `npm run verify:mole-lab` (builds to a temp dir, vite preview on a free port, headless Chromium with SwiftShader; hostile interactions and screenshots).
