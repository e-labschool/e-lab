# Bonding Visualizer, round 2 (covalent recognition and formation)

Finishing pass on work another agent left half done. Reports only what was run.

## 1. Found already built (src/lib/lewis, bonding-visualizer)
Recognition engine (`src/lib/lewis`: library of 111 hand-written species, resolver, geometry, polarity, search), `scripts/test-lewis-engine.mjs` (33 tests), the new covalent UI (`CovalentMode`, `FormationStage`, `scene/formation.js`, `RecognitionCard`, `MoleculePicker`, `MoleculeView`), outer-shell checkbox, charge control, HL switch, drag/keyboard, slider, 3D tab. `test-lewis-engine` was NOT chained into `npm test`.

## 2. The 3 failing UI checks: test problems or bugs?
| Check | Verdict | Change |
| --- | --- | --- |
| H2 label `/H₂\s*H–H/` | Test problem: the label renders real `<sub>`, so text is `H2H–H` | regex now `/H2\s*H–H/` |
| SF6 `needs-beyond` got `pending` | Test problem: sets of more than 4 atoms are recognised after a 160 ms debounce (intended) | tests wait for status != pending (`settled`) |
| SF6 octet text expected `12` | Real weakness: card said "S has more than 8 electrons" | `octetText` now says "S has 12 electrons around it (expanded octet, more than 8)"; same for incomplete octets (B has 6) |
| O + Cl expected none/needs-charge | Test assumption wrong: ClO is a 13-electron radical, correctly `needs-beyond` (and cascaded from the SF6 failure leaving HL on) | asserts `needs-beyond` |
Also reworded the summary "(2 × C=O (double))" to "(2 × C=O, double)" (nested brackets); `test-lewis-engine` regex updated.

## 3. Real bugs found only in Chromium (jsdom cannot see CSS / WebGL)
1. **3D tab was blank**: `.bv-structure{opacity:0}` was never overridden after the old cross-fade was removed. Fixed (`data-on="1"` gives opacity 1).
2. **Central atom had no symbol in 3D** (C in CO2/CH4, S in SF6): drei `Html` at exactly the origin is never positioned. Tiny offset; label colour now from the shared element style (white on dark C).
3. 3D stage was 48 px tall on 910x512 (fixed 34/88 px margins): now full height on small canvases; polarity detail panel folds behind a "Bond details" button (it covered the molecule); camera fit tightened.
4. Phones: the recognition card sat between the picture and Form molecule (600 px of scrolling). Order is now canvas, controls, card (card max 300 px).
5. Molecules drawn small on short canvases: scale cap 3.0 to 4.2, height fraction 0.66 to 0.72; at max-height 560 px the duplicate toolbar Reset is hidden so the toolbar fits one row.
6. `scripts/verify-bonding-group/bonding.mjs` still drove the deleted example tabs; trimmed. New `bonding2.mjs` (registered in `verify-bonding-group.mjs`).

## 4. What was run
- `npm run test:bonding` (now chains test-lewis-engine, then model 52, then UI 31): all pass.
- `SIMS=bonding,bonding2 node scripts/verify-bonding-group.mjs` (Chromium + SwiftShader, 1366x768, 910x512, 390x844, light and dark via the app theme): **955 checks, 0 problems**. Per config: owner case (C + O + O: recognised at once, Form molecule enabled while apart, real animation far apart to forming to bonded, two double bonds, 8 shared + 8 lone electrons, overlap lens drawn), outer-shell box (ON: no inner rings/electrons, three valence shells + labelled cores; OFF: inner shells appear; survives reload), slider scrub, 21 compositions (H2, HCl, H2O, NH3, CH4, CO2, N2, O2, HCN, C2H4, C2H2, CO, NH4+, CO3 2-, SO2, O3, BF3, CH3OH, SF6 with HL, NO3-, SO4 2-) compared with the engine (formula, pair counts), shells inside canvas, refusals (C + 3 O carbonate, SF6 without HL), keyboard, drag-to-approach (1366 and 910), 3D view non-blank (pixel test), simulated context loss/restore, picker (80+, search), ionic still works, reduced motion. I looked at about 25 screenshots with Read.
- `npm run build` succeeded. `npm test`: everything before `test:simulation-library` passed; that suite fails (see 6).

## 5. Chemistry: verified vs reasoned
Online verification failed (WebFetch blocked, search returned titles only), so nothing here is online-verified this session. Electronegativities (IB booklet, 1 d.p.: H 2.2, C 2.6, N 3.0, O 3.4, F 4.0, Cl 3.2, Br 3.0, I 2.7, S 2.6, P 2.2, Si 1.9, B 2.0, Be 1.6, Al 1.6) match my recollection of the Pauling values; reasoned, not checked against the booklet. Library structures are validated by tests for electron balance, formal charges and rediscovery by the resolver, and I skimmed the list for errors (none found); hand-written SMILES are still the same author's work, so an independent teacher read is advisable.

## 6. Not done / not verified
- No real GPU, touch hardware, Safari, Firefox or screen reader. Drag was tested with a mouse.
- 910x512: the stage is only about 170 px tall; legible but small, electrons tiny.
- Phone: element library is below the card (adding an atom needs a scroll back up); the picker at the top avoids that.
- Random multiset test is 100 sets (up to 7 atoms) plus a large-input test.
- Failing outside my area: `test:simulation-library` (premium OFF regex `plans?\b` matches "plan a multi-step separation" in the Mixture Separation catalogue description) and `test:curricula-locks` (every live simulation is ib-dp): both look caused by the new Mixture Separation catalogue entry, not by Bonding. Not re-run after a delay beyond one retry.

## 7. Decisions for the owner
1. Outer-shell box defaults to ON (the spec's checkbox); say if teachers want OFF.
2. HL species (SF6, PCl5, NO2 radical) stay behind "Beyond the course (HL)"; picking one switches it on.
3. Polarity detail panel in 3D is folded by default.
4. Should the element library move above the card on phones?
