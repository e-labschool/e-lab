# Structure Investigation (Spectroscopy Studio, fourth tab)

Implements `docs/STRUCTURE_INVESTIGATION_SPEC.md`. Code: `src/engines/spectroscopy-studio/structure/`. The MS, IR and 1H NMR tabs are unchanged; the new tab only
reads their data and physics (see "Reuse"). The resource stays `in-development` in `src/data/resources-registry.js`.

## What the student sees

One workspace with a compact five-step navigation: **Sample, Mass Spectrum, IR Spectrum, 1H NMR, Identify Structure** (Previous / Next / direct jump).
The Evidence Notebook is a docked column on wide containers (container width >= 1240 px) and replaces the side panel on medium widths; it can be collapsed.

* **Sample**: sample card ("Unknown A01", level badge, the question "Can you identify the unknown molecule using spectroscopic evidence?", the formula only at
  Foundation), level selector, previous / next unknown, progress.
* **Mass spectrum**: bars only, no answer labels; optional markers (M+ / base peak), optional prompts, an M-estimate box (guided check at Foundation), peak
  inspector, "add to notebook" (writes an observation, never an answer), zoom / pan.
* **IR**: transmittance, 4000 to 400 cm-1, no group labels, a Reference Table button, inspector, evidence-for/against table, zoom / pan.
* **1H NMR**: ppm decreasing, TMS at 0, integration curve toggle, expandable multiplets (stick lines), fill-in table, D2O toggle (removes O-H signals),
  overlapping signals shown as one region, zoom / pan. 300 MHz, CDCl3, first-order.
* **Identify**: four skeletal SVG structures, Submit, feedback naming the conflicting evidence (never the compound), return buttons to each spectrum, hints,
  Show solution, and, after a correct answer or Show solution, the full MS + IR + 1H NMR explanation plus why each other choice fails.

Levels: Foundation (formula given, 3 hints, count integration, guided prompts), Intermediate (no formula, isomeric choices, 2 hints, relative integration),
Advanced (no formula, overlapping signals, 1 hint, a written justification of at least 12 words before Submit).

## Compounds (8 unknowns, 20 structures)

Foundation: ethanol, propanone, ethanoic acid. Intermediate: propan-2-ol, propanal, butanone. Advanced: propan-1-ol, ethyl ethanoate.
Distractors (examples): methoxymethane, ethanal, methyl methanoate, prop-2-en-1-ol, methyloxirane, butanal, 2-methylpropanal, but-3-en-2-ol,
methoxyethane, methyl propanoate, propyl methanoate, butanoic acid. Each unknown has four choices.

## One identity per compound

`data/structures.js` holds only a molecular graph (heavy atoms C/O with 2D coordinates, bonds) per structure. `model/graph.js` DERIVES the formula, molar mass,
degree of unsaturation (2C+2-H)/2, 1H environments (topological equivalence classes), integration, n+1 multiplicity, typical shift ranges and IR groups from
that graph. `data/compounds.js` adds the spectra (MS peaks, IR bands, NMR shifts) per unknown. The drawn structure, the formula and every spectrum therefore
come from one record.

## Feedback without giving the answer

`model/evaluate.js` compares what the CHOSEN structure would give (nominal mass or formula, optional base peak, diagnostic IR groups with their ranges,
predicted 1H signals with shift range and multiplicity) with the unknown's spectra and lists the conflicts (at most four, mixed techniques). Hints and prompts
are generic method hints. `scripts/test-structure-model.mjs` checks every wrong choice yields at least one conflict and that no feedback / hint contains
the answer's name, alias or condensed formula (hints also exclude class words).

Deterministic: no `Math.random`. The order of the four choices is an FNV-hash seeded shuffle of the compound id.

## State and persistence (docs/STATE_PERSISTENCE.md)

`state/structureState.js`: external store (`useSyncExternalStore`). Persisted through `useSimulationSessionState` under its own versioned key
`studio-structure-v1` (`STATE_VERSION = 1`, `sanitize()` repairs unknown / stale shapes); the existing `studio-v2` session of the studio is untouched.
Persisted: stage, level, position per level, notebook open state, and per unknown: notebook text, evidence tables, M estimate, toggles, hints used,
attempts, wrong choices, solved / shown, justification. Persistence only exists inside a lesson scope (`SimulationSessionProvider`), like the other tabs.
Switching tab keeps the live state (the provider stays mounted).

## Reuse (read-only) and the minimal changes outside the new folder

Reused: `ms/data/spectra.js` (ethanol, propanone, butanone peaks), `ms/components/MsSpectrum.jsx`, `ms/physics/isotopes.js`, `ir/data/compounds.js` (ethanol,
ethanoic acid, propanone, ethyl ethanoate, propan-1-ol bands), `ir/physics/*`, `nmr/molecular/model/spectrum.js` (splitting), shell components.
Changed outside `structure/`: `SpectroscopyStudio.jsx` (renders the workbench, provider, subtitle, reset), `state/studioState.js` (`developed: true` for the
tab), `resources-registry.js` description and `meta.js` subtitle (text only), `package.json` scripts, and three existing test assertions that expected the
placeholder (`test-ir-ui.mjs`, `test-nmr-ui.mjs`, `test-nmr-steps.mjs`). One one-line change in the new `MsView.jsx` gives the plot a fallback size before layout.

## Layout

Container-driven (`.ss-wb` is a container; no viewport media queries, no CSS scaling). Wide: plot column + side panel (+ notebook column at >= 1240 px).
Narrow (stacked): single column. Fullscreen / Open in new tab come from the shared frame only. Button styling uses the shared `sim-btn` conventions.

## Tests

* `npm run test:structure` = `scripts/test-structure-model.mjs` (independent re-derivation of every compound: formula <-> molar mass, M+ peak = molar mass,
  fragment nominal mass = m/z, radical-dot convention, IR groups present / absent and band ranges, number of 1H environments, integration = H count, n+1,
  exchangeable O-H as broad singlet, DoU, identity with the MS / IR / NMR workspaces, feedback / hint safety) and `scripts/test-structure-ui.mjs` (jsdom flows).
* `npm run verify:structure` (headless Chromium, builds and serves its own preview): 5 viewports, newtab and fullscreen, light and dark, no overflow / clipped /
  covered controls, plot alignment (MS bar heights, IR minima, NMR trace centres, TMS), one complete investigation at each level, the three other tabs still open.
* `DEEP=structure SIMS=spectroscopy-studio node scripts/verify-simulation-button-contrast.mjs <baseUrl>`: button contrast for the new tab.

## Data provenance and uncertainty

All spectra are SIMULATED / REPRESENTATIVE and labelled so on screen. No table could be downloaded while building: MS intensities, IR band widths / heights
and 1H shifts were entered from the author's knowledge of typical literature values (NIST WebBook / SDBS / Gottlieb 1997 style) and not re-checked online.
Least certain: MS relative intensities of the five entered spectra (propan-2-ol, propan-1-ol, ethanoic acid, propanal, ethyl ethanoate; about +-30 %), the weak
M+ values for alcohols and esters, the IR band heights and widths for propan-2-ol, propanal and butanone, the 1H shifts of ethanoic acid (COOH 11.4), propanal
and butanone, all O-H shifts (placeholders; propan-1-ol's O-H is deliberately placed at 1.7 ppm to overlap the CH2 in the Advanced task), and the 7 Hz /
6 Hz couplings. The optional `msBase` values used for feedback are given only for structures where the textbook base peak is well known.

## Not verified

Real GPU, real touch hardware, other browsers (Firefox / Safari), assistive technology, the embedded lesson page (the `/interactives/...` page only shows
the description while the resource is in development), and live Supabase persistence.
