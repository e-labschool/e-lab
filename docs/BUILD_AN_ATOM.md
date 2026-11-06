# Build an Atom (engine `build-an-atom`, route `/simulation/build-an-atom`)

Independent proton / neutron / electron controls, an optional **Auto-balance particles** checkbox, live derived
quantities, and a container-driven layout that works embedded, fullscreen and in a new tab.

## Rules (pure code: `src/engines/build-an-atom/lib/atomControls.js`)

| Situation | Behaviour |
| --- | --- |
| **Auto-balance OFF (default, unchecked)** | + / − on protons, neutrons or electrons changes **only that count, by exactly 1** (clamped to 0 and to the limits below). Nothing else changes: adding a proton does **not** add a neutron, an electron, or "snap" to another isotope. Neutral atoms, ions and isotopes are all built by hand. |
| **Auto-balance ON** | Electrons = protons (neutral atom). Neutrons = the **reference isotope** of the current element, but **only** where reliable data exists (Z = 1-36). For an element without data (Z = 0 or > 36) the neutron count is never changed and the panel says "No reference isotope data for this element". The electron controls are locked (set by the protons); the neutron controls are locked where a reference exists and free where it does not. The proton +/− stays active and re-balances after each press. |
| Ticking the checkbox | Applies the balance once to the current atom (so it can change electrons / neutrons - that is what the student asked for). |
| Unticking | Changes nothing; the controls unlock and the student can change neutrons manually again. |
| Periodic-table click | Sets the proton count only, then follows the same rule as a proton press (balanced if Auto-balance is on). |
| Start From Empty / Reset to Carbon-12 | Set 0/0/0 and 6/6/6; the checkbox state is kept. |

**Limits** (practical, for drawing): protons 0-36, neutrons 0-60, electrons 0-40. The old cap was 30 per particle
and the periodic table could set any Z up to 118 (which the drawing could not show); elements above Z = 36 are now
disabled in the table with a tooltip. This was changed to match the data range - flagged as a behaviour change.

The previous hidden behaviour (in `BuildAtomSimulation.handleChange`, "Changing protons ... snap neutrons to its
default nuclide", and the same in `handleSelectElement`) was removed. `applyChange()` is the only entry point.

## Readouts (all derived from the three counts, nothing stored)

- Atomic number Z = protons; mass number A = protons + neutrons; net charge = protons - electrons
  (+n / -n; classification neutral / cation / anion).
- Element from the proton count (`src/data/chemistry/elements.js`).
- Isotope from protons + neutrons: `carbon-13`, `¹³C`, `Carbon-13` in the identity panel.
- **Reference isotope** line: "Reference isotope: ¹²C (carbon-12)" with the sentence "Neutrons follow the most
  abundant isotope of carbon" (on) or "Most abundant isotope of carbon. Neutrons are yours to set." (off), and in
  manual mode "Your isotope: ¹³C (carbon-13)".
- **Informative, never blocking** nuclide status (`nuclideStatus`):
  - "Stable nuclide" (+ "Most abundant isotope of this element (reference isotope)" or "A stable isotope, but not the most abundant one"),
  - "Radioactive nuclide" (a real, named radioactive isotope in the data, e.g. C-14, H-3, K-40),
  - "Not a stable nuclide" (element has data, this Z/N is not one of its stable isotopes),
  - "No isotope data" (Z = 0 or Z > 36).
  The nucleus still wobbles briefly (reduced motion: a glow) for the last two, as before.

## Data provenance (`data/nuclides.js`)

- **Which isotopes occur naturally and which is most abundant** (the reference isotope, `defaultMassNumber`):
  IUPAC / CIAAW *Isotopic Abundances of the Elements* (2024 table, fetched during this work; same values as NIST
  Atomic Weights and Isotopic Compositions). Reference isotopes: H-1, He-4, Li-7, Be-9, B-11, C-12, N-14, O-16, F-19,
  Ne-20, Na-23, Mg-24, Al-27, Si-28, P-31, S-32, Cl-35, Ar-40, K-39, Ca-40, Sc-45, Ti-48, V-51, Cr-52, Mn-55, Fe-56,
  Co-59, Ni-58, Cu-63, Zn-64, Ga-69, Ge-74, As-75, Se-80, Br-79, Kr-84. **Not N = Z.**
- **Stable vs radioactive**: NUBASE2020 (Kondev et al., Chin. Phys. C 45 (2021)). "Stable" = no decay ever observed
  ("observationally stable": includes Ca-46, Cr-50, Fe-54, Ni-58, Zn-70, whose decay is theoretically possible).
  Radioactive isotopes that occur naturally and have a very long half-life are labelled radioactive (K-40, Ca-48,
  V-50, Ge-76, Se-82, Kr-78). Z = 1-20 rows predate this work (NUBASE2020 via Wikipedia "List of nuclides"); Z = 21-36
  were added from the CIAAW list. The **stable list per element is complete**, which is what makes "not a stable
  nuclide" a statement of fact; the radioactive list is a teaching set, not every known nuclide.
- Electron shells (display only, `lib/electronShells.js`): 1-20 unchanged; 21-36 show the neutral-atom pattern
  for that many electrons (2,8,9,2 ... 2,8,18,8; Cr and Cu use 4s¹). It is by electron *count*, so it is right for
  neutral atoms but not for transition-metal cations (Fe²⁺ really keeps 14 in the third shell). 37-40 electrons
  pile into the fourth shell. Not a filling rule.
- Nucleus drawing (`lib/nucleusScaling.js`): unchanged up to calcium-40; heavier nuclei are packed tighter with
  smaller spheres so the nucleus (up to 96 nucleons) never touches the first shell.

## Layout (container-driven, `BuildAtomSimulation.jsx`)

The workspace measures its **own box** with a ResizeObserver (`lib/useSize.js`) and never branches on the window.

- **Wide (container >= 860 px)**: two columns `66fr | 34fr` (min 300 px for the side panel). The atom stage fills its
  grid cell (~65 % of the width; 861 of 1316 px at 1366x768). The side panel scrolls **inside itself**; the
  particle controls, checkbox and reference line are `sticky` at its top so they stay visible while the rest
  (identity, Compare Isotopes, challenge, periodic table, What Changed, concepts) scrolls.
- **Stacked (narrower)**: stage on top (40 % of the height in fullscreen / new tab, a square-ish block when embedded),
  panels below (scroll inside their own region in fullscreen / new tab, flow in the page when embedded).
- The stage is a positioned box; `AtomVisualizer` is `absolute inset-0` and its SVG uses `viewBox` + `meet`, so the
  atom scales uniformly to the smaller of the stage's width and height and **cannot grow onto the controls**. The old
  bug (a `w-auto h-full aspect-square` box in a 3-column grid that ignored the column width) is gone. No CSS transform
  scaling is used.
- Embedded wide height: `clamp(560px, 100dvh - 8rem, 800px)`; fullscreen / new tab fill the shell's content row.

## Not changed

Labels, orbital rings, spin rings, Challenge mode (Check / New Challenge), Compare Isotopes, What Changed, the
periodic table, concept strip, flying-particle animation, colours and the e-Lab frame (title, mode toggle,
Open in New Tab / Fullscreen buttons come from the shared shell). The simulation keeps **no saved state** (it was not
wired to `useSimulationSessionState` before and was not wired now), so a reload starts at carbon-12 with
Auto-balance off.

## Tests and verification

- `npm run test:build-atom` (`scripts/test-build-atom-controls.mjs`): pure tests (independence of every +/- from many
  starting atoms incl. lower and upper bounds, "no negative counts", auto-balance off never touches the other two
  counts, auto-balance on gives electrons = protons and neutrons = reference isotope for **every** Z = 1-36, locked
  controls, reference isotopes vs the IUPAC table, stable-isotope counts per element, derived quantities, isotope
  names/notation, charge sign, shells, nucleus scaling) + 7 jsdom tests that drive the real component.
- `npm run verify:build-atom-heating` (`scripts/verify-build-atom-heating.mjs`): builds to a temp dir, `vite preview`,
  headless Chromium at 1366x768, 1920x1080, 1024x768, 820x1180, 390x844, new-tab view and real fullscreen via the shell
  button: counts after each +/- (protons only -> only protons ...), checkbox behaviour, every control visible and
  uncovered (`elementFromPoint`), stage ~65 % wide, no overlap with the controls, atom drawing inside its stage,
  stage re-measured after entering / leaving fullscreen, Kr-84 at Z = 36, no console errors.
- Not verified: embedded-in-a-Learn-lesson for this engine (no `/interactives/` page exists for it; the same
  workspace code runs, with the embedded height rule above), real GPU, touch hardware, Firefox / Safari, a headed
  browser's fullscreen on a real monitor.
