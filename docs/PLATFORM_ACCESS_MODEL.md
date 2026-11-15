# Platform access model (Premium-ready, everything free for now)

Decisions: `docs/PLATFORM_RESTRUCTURE_SPEC.md`. This note explains how the pieces fit and what "turning Premium on later" involves.

## The pieces

| Piece | File | Role |
| --- | --- | --- |
| Policy | `src/lib/access/accessPolicy.js` | Pure functions: `checkAccess`, `canAccess`, `showPremiumUi`, `tierBadge`, `showLockChip`, `showTierFilters`, `matchesTierFilter`, `lockedCopy`. The ONLY place tiers and config flags are interpreted. |
| Config service | `src/lib/access/accessConfigService.js` | Reads/writes the two site switches and the per-simulation overrides. Every read falls back to "everything free" on any error. |
| Provider | `src/lib/access/AccessConfigContext.jsx` | `useAccessConfig()` (config, overrides, merged `catalogue`) and `useAccessContext()` (the `ctx` for `checkAccess`). Mounted in `App.jsx`. |
| Catalogue | `src/data/simulationCatalogue.js` | One entry per simulation: label, description, topic, IB syllabus codes, status, default tier (`free` for all), featured flag, thumbnail. `simulationRegistry.js` (id -> label) is derived from it; `resources-registry.js` still feeds `/interactives`. |
| Library / viewer | `src/components/simulation-library/*`, `src/pages/shared/SimulationPages.jsx` | `/student/simulations`, `/teacher/simulations` and `/:simulationId` inside the role layout. Also `LockedContent`. |
| Admin | `src/pages/admin/simulations/AdminSimulations.jsx` | `/admin/simulations`: the two switches, per-simulation Access level (Demo / Free / Premium) and Featured star. |
| Draft SQL | `docs/platform-sql/001_*`, `002_*` (+ `_rollback`) | Two extra columns on `platform_settings` (+ the public view) and the `simulation_access` table. **Drafts: never executed, do not run without approval.** |

## Tiers and switches

* Item tiers: `demo` (open to everyone), `free`, `premium`. Default for every simulation: `free`.
* Switches (site-wide, admin only): `premiumEnabled` (default false), `requireLoginForSimulations` (default false) and `downloadRequiresPremium` (default false; only matters while Premium is on; see `docs/RESOURCE_VIEW_DOWNLOAD.md`, `checkAction(item, 'view'|'download', ctx)`, draft SQL `011_*`).
* `premiumEnabled = false` -> `checkAccess` allows everything (unless login is required) and every Premium surface is hidden: tier badges, lock chips, Free/Premium filter chips, the landing Plans section, the profile plan card, the locked screen.
* `requireLoginForSimulations = true` -> non-demo simulations ask signed-out visitors to log in (reason `login-required`).
* A teacher (or admin) role never grants Premium. Premium needs an `entitlement` ({ plan: premium | school, expiresAt }) that must come from the server; today `useAccessContext()` passes `null` because no entitlement source exists yet.

## Works before and after the SQL exists

* No settings columns / no `simulation_access` table / no Supabase: reads return defaults, so the site behaves exactly as today. The browser console shows one 400 (public settings view) and one 404 (table) per full page load until the SQL is applied; that is the database saying the objects do not exist, and the app ignores it.
* `/admin/simulations` shows a notice for each missing object and disables the controls that need it.

## Turning Premium on later (step by step)

1. Decide plans, wording, what is Premium. Review the landing `FaqSection` answers ("Is e-Lab free?" ...) and `PlansSection` copy (it has no prices and no "Notify me" box), and `lockedCopy()`.
2. Approve and run `001_site_access_config.sql`, then `002_simulation_access.sql` (rollbacks provided).
3. In `/admin/simulations` set each simulation's Access level (levels can be set while Premium is off; they have no effect until the switch is on) and the Featured stars.
4. **Before** flipping the switch, do the database phases in `docs/security-plan/` for any content that must really be protected (see "UI-only vs real security"). Add a server-side entitlement source (plan + expiry per user, readable only for the signed-in user) and feed it to `useAccessContext()` as `entitlement`.
5. Turn on `premiumEnabled` in `/admin/simulations` (it asks for confirmation). Badges, chips, locked screens, the Plans section and the profile plan card appear immediately; nothing else needs a deploy.
6. Optionally turn on `requireLoginForSimulations`.
7. To go back: switch it off; everything is free again.

## UI-only versus real security

* Everything in `accessPolicy.js`, the library, the locked screen and the admin page is **UI behaviour**. The simulation engines are static front-end code in the public bundle: anyone can read the JavaScript or call `/simulation/:id`. Hiding or locking them in the UI does not protect them.
* The standalone route `/simulation/:id` and the landing demo go through the same policy, but that is still only presentation.
* Real protection for Premium content (resources, lessons, question bank, any server-held data) must be enforced in the database: RLS and entitlement functions per `docs/security-plan/`. The `simulation_access` table is display metadata and is world-readable by design; admin writes are protected by `is_admin()` RLS.
* Never derive entitlement from editable profile or user metadata or from frontend state.

## Tests and tools

`npm run test:access-policy`, `npm run test:simulation-library` (both in `npm test`); `npm run verify:platform` (headless Chromium, mocked Supabase, not part of `npm test`); `npm run capture:thumbs` regenerates `public/sim-thumbs/*.webp` (`-- --app-shots` for `public/landing/*.webp`).
