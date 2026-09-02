# e-Lab

Explore. Interact. Understand.

An interactive science learning platform for teachers and students, built around a
curriculum-independent chemistry concept architecture. The first release covers DP
Chemistry (first assessment 2025) and ships one fully working interactive, the
**Electron Configuration Explorer**, alongside the complete data architecture for
e-Lab's full planned chemistry roadmap.

## What's actually working right now

- Full site: homepage, Explore (curriculum roadmap), Topics (concept index), Interactives
  gallery, individual concept/interactive pages, For Teachers, About.
- **Electron Configuration Explorer** — ground-state configuration for all 118 elements,
  correctly handling known Aufbau exceptions (Cr, Cu, Nb, Mo, Ru, Rh, Pd, Ag, La, Ce, Gd,
  Pt, Au, Ac, Th, Pa, U, Np, Cm, Lr), with a periodic-table selector, shell diagram,
  Hund's-rule-correct orbital-box notation, a Predict -> Construct -> Check student flow
  with progressive hints, and a step-by-step reveal Teacher Mode.
- Student Mode / Teacher Mode toggle and light/dark theme, both persisted in
  `localStorage`.
- 102 granular chemistry concepts, a 25-tool resource roadmap (1 live, the rest
  in-development/planned), and a concept<->resource coverage map with **zero uncovered
  concepts**.

## What's intentionally not built yet

Per the agreed first-build scope: the other 24 interactives are placeholder "Coming
soon" / "Planned" cards only (Periodic Trends Explorer, Molecular Geometry Explorer,
Collision Theory Lab, Equilibrium Simulator and Titration Lab are marked
"in-development" as the next tools in line). No accounts, backend, database, or
progress tracking -- this is a static frontend by design.

---

## 1. Getting the project onto your computer

You'll have received this project as a folder (or a `.zip` -- if so, unzip it first).
Save/move that `e-lab` folder somewhere convenient, e.g. `Documents/e-lab`.

## 2. Install prerequisites (one-time)

You need **Node.js** (which includes `npm`). If you don't already have it:

1. Go to nodejs.org
2. Download and install the **LTS** version for your operating system
3. Confirm it installed by opening a terminal (Terminal on Mac, Command Prompt/PowerShell
   on Windows) and running:
   ```
   node -v
   npm -v
   ```
   Both should print a version number.

## 3. Install the project's dependencies

In your terminal, navigate into the project folder and install:

```
cd path/to/e-lab
npm install
```

This downloads React, Tailwind, and the other packages listed in `package.json` into a
new `node_modules` folder. It can take a minute or two -- this is normal.

## 4. Run it locally

```
npm run dev
```

Vite will print something like:

```
  Local:   http://localhost:5173/
```

Open that address in your browser (Chrome, Firefox, Safari, or Edge all work). The site
will hot-reload automatically if you edit any source file.

To stop the server, go back to the terminal and press `Ctrl+C`.

## 5. Verifying it works

Once `npm run dev` is running and you have the site open, check:

- The homepage loads with the hero, featured interactives, and the DP Chemistry section
  cards at the bottom.
- Click **Explore -> DP Chemistry -- 2025** and confirm the Structure/Reactivity roadmap
  renders with clickable concept chips.
- Click through to **Electron Configuration Explorer** (from the homepage card, from
  Interactives, or from a concept page) -- click a few elements on the periodic table
  (try Fe, Cu, and Ce, which are electron-configuration exceptions) and confirm the
  configuration updates.
- Toggle **Student** <-> **Teacher** in the header (or on the interactive itself) and
  confirm the interactive's controls change accordingly.
- Toggle light/dark mode (moon/sun icon in the header).
- Refresh the browser while on a nested page like `/explore/dp-chemistry` or
  `/topics/electron-configuration` -- it should reload correctly, not 404.
- Resize your browser window down to a phone-ish width and confirm the layout adapts
  (hamburger menu appears, grids stack).

If all of that behaves as expected, the build is solid.

## 6. Building for production (optional, for later)

When you're ready to deploy:

```
npm run build
```

This creates an optimized `dist/` folder. `npm run preview` will serve that build
locally so you can sanity-check it before deploying anywhere (we are **not** deploying
to Vercel yet, per your instruction -- this is just for local verification).

---

## Project structure (short version)

```
src/
  data/
    concepts/        Layer 1 -- curriculum-independent chemistry concepts (102, by domain)
    curricula/        Layer 3 -- curriculum maps (DP Chemistry 2025 today)
    chemistry/         Static element dataset + curated Aufbau-exception table
    resources-registry.js   Every planned/in-development/live interactive
    coverage-map.js          Concept <-> resource join, derived from the registry
  engines/
    electron-configuration/   The one live interactive (pure logic in logic/, UI split
                                by student/ vs teacher/ mode)
  lib/
    curriculum-resolver.js   The only file that joins curricula and concepts
    coverage.js               getUncoveredConcepts() / getCoverageStats() dev utilities
  components/    Reusable UI (ui/, layout/, homepage/, curriculum/, concept/, interactive-shell/)
  pages/          One file per route
  context/        Mode (student/teacher) and Theme (light/dark), both localStorage-persisted
```

To add a **new curriculum** later (a new DP Chemistry version, IGCSE, MYP): add one file
under `src/data/curricula/`, register it in `src/data/curricula/index.js`. Nothing under
`src/engines/` needs to change.

To add a **new interactive** later: add a folder under `src/engines/`, register it in
`src/data/resources-registry.js` with its `conceptIds`. The coverage map picks it up
automatically.

---

e-Lab is an independent educational platform and is not affiliated with or endorsed by
the International Baccalaureate Organization, Cambridge Assessment International
Education, or any curriculum publisher.
