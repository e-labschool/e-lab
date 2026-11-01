# State persistence (tab switches, reload, back/forward, admin drafts)

## The reported bug and its root cause

"Switch browser tab, come back: the simulation closes/resets and the page scrolls to
the top."

Reproduced in headless Chromium (mock Supabase with 40-150 ms latency, then
`SIGNED_IN`/`TOKEN_REFRESHED` fired like supabase-js does when a tab becomes visible):

1. `AuthContext` handled **every** `onAuthStateChange` event by `setSession(newObject)`
   and `fetchProfile()`, and `fetchProfile` set `loadingProfile = true`.
2. `ProtectedRoute` showed `<ELabLoader/>` whenever `user && loadingProfile`, which
   **replaced the whole signed-in tree** (layout, Learn page, open simulation, admin
   editor) for the length of the request -> everything unmounted, state lost, the new
   short page lost the scroll offset (0), and `LearnLessonPage` re-ran its
   `scrollTo(top)`.
3. A fresh `user` object per event also re-ran every effect keyed on `user`
   (progress, preferences, display settings).

No `visibilitychange`/`focus` handler, react-query focus refetch, service worker, key
change or StrictMode issue was involved (`grep` of `src`: only `ChallengeSession` listens
to visibility, for the exam timer).

## Fix (root)

* `AuthContext`: events for the **same user** (`SIGNED_IN`, `TOKEN_REFRESHED`,
  `INITIAL_SESSION`) only refresh tokens and keep the previous `user` object
  (`authSessionMerge.js`); no profile fetch. `USER_UPDATED` revalidates **silently**.
  `fetchProfile` is silent whenever a profile for that user is loaded: no
  `loadingProfile`, no error banner, `setProfile` only if the row changed.
* `ProtectedRoute`: the loader is only for the first resolution
  (`user && loadingProfile && !profile`).

## What is restored and where

| State | Live tab switch | Reload / back-forward |
|---|---|---|
| Learn page scroll | kept (nothing remounts) | restored (`scrollRestore.js`, sessionStorage; only for reload/back, new navigations start at top) |
| Simulation mounted / settings | kept | see below |
| Admin lesson editor, open block, unsaved typing, selection | kept | open block + settings form (already existed, now versioned) + **Rich Text draft** |
| Admin scroll (`<main>`) | kept | restored after reload |
| Admin preview / design-defaults panel / sidebar collapse | kept | restored (`useSessionState`) |

### Simulations
Shared pieces: `src/lib/sessionState.js` (`useSessionState`, `sessionKey`),
`src/components/interactive-shell/simulationSession.js`
(`SimulationSessionProvider`, `useSimulationSessionState`). The Learn simulation block
and `/simulation/:id` provide a scope (`lessonId:blockId` / `standalone:id`).
An engine opts in by replacing `useState` with `useSimulationSessionState(name, initial, validate)`.

* **Engines wired:** `ideal-gas-simulation` (controls incl. Ideal/Real mode and sliders,
  display toggles, graph shown).
* **Not wired (restore NOT claimed after a reload; they do keep live state on tab switch):**
  all other engines, including camera orientation/zoom of every 3D engine
  (`vsepr-explorer-3d`, `bonding-visualizer`, `particle-model-visualizer`, ...) and animation
  progress/step. Fullscreen cannot be re-entered without a user gesture. `hybridisation-explorer`
  is being edited separately and was not touched. `intermolecular-forces-visualiser` persists mode, force,
  Ball/Cloud, delta toggle, exaggeration, workspace molecules (validated), lesson, heat view, substance, Compare and heat speed
  through `useSimulationSessionState`; lesson step and heating energy are not restored.
* **Tab hidden / time jumps:** browsers stop `requestAnimationFrame` in hidden tabs, so loops
  pause on their own. On return the first timestamp is far ahead; `src/lib/frameTime.js`
  (`clampFrameDelta`, `createFrameClock`) caps dt. Already clamped inline (0.05 s) before this
  change: ideal-gas, gas-laws, bonding (`useFrameLoop`), particle-model, phase-change,
  neutralization, buffer, collision-theory. Newly clamped with the helper:
  `mixture-separation-explorer` (`simulationTimeline.js`, previously a hidden tab could finish
  the timeline in one frame) and `wave-explorer` (`useWavePhase.js`). Not time-based:
  explore-matter ParticleField (frame counter). Wall-clock tweens (`h-oh-balance`) and
  `setInterval` ticks (`chocolate-wrapping-rate`, throttled to >=1 s by the browser in a hidden
  tab) were left as they are and are the follow-up candidates, along with r3f `useFrame` engines
  that rely on r3f's own clamping (`vsepr-explorer-3d` Scene, `bonding` MetallicStage/Lattice,
  `ParticleBox3D`): they were not changed or verified for a long hidden period.

### Admin drafts (Rich Text)
`src/lib/draftStore.js`. Each Rich Text block autosaves a draft (debounced 300 ms, and
immediately when the tab hides / page unloads) to `localStorage` key
`e-lab:draft:<lessonId>:<blockId>:html` = `{html, baseHash, sel, savedAt}`; `baseHash` is a hash
of the **saved** html the edit started from. On reopen:

* saved html unchanged -> draft restored into the editor, notice "Unsaved draft restored" +
  **Discard**; **nothing is written to the server** until the admin edits/blur-commits;
* saved html changed since -> draft **not applied**, notice offers **Restore draft** / **Discard**;
* draft equal to saved -> deleted.

The lesson **settings form** draft (`learnAdminDraft.js`, sessionStorage) now also stores a hash
of the saved settings and is ignored (with a notice) if the lesson was saved since.
`beforeunload` warnings: Rich Text editors with typed-but-uncommitted edits, and the lesson settings
form when it differs from the saved lesson. Commit to the server still happens on blur, as before.
Drafts are local to the browser profile (not per user account; shared computers should clear site data).

## Verification

* `npm run test:state-persistence` (jsdom): hook, storage failure modes, frame clamp, same-user
  session merge, scroll restore timing.
* `npm run verify:state` (headless Chromium, real app + mock Supabase): student Learn page with a
  simulation at the bottom - tab-switch simulation (2 real pages, `bringToFront`, visibility/focus
  events, `SIGNED_IN`/`TOKEN_REFRESHED`/`USER_UPDATED`) asserts same DOM node, scroll, selected
  mode, slider, no profile refetch, no unmount; reload and Back restore scroll + ideal-gas settings;
  admin editor keeps unsaved text + selection + scroll, reload restores the draft and preview state.
  With the AuthContext/ProtectedRoute fix temporarily disabled the same script fails 10 of 23 checks.
* Not verified: real Supabase refresh timing/events, a truly hidden tab (headless Chromium keeps
  pages visible), Firefox/Safari.
