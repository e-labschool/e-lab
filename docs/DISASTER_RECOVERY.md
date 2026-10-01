# e-Lab: Complete Disaster Recovery

This document extends [`BACKUP_AND_DISASTER_RECOVERY.md`](./BACKUP_AND_DISASTER_RECOVERY.md)
(the existing **Content Backup** feature — pages, blocks, questions,
media references). Read that document first; it is not repeated here.
This document covers **Admin → Backup & Restore → Complete Disaster
Recovery**: an extension, not a replacement, that adds actual media
files, application user/progress/assessment data, and a staged restore
architecture with ID remapping.

If you are reading this years from now because e-Lab's Supabase project
is gone: start at §5 ("How to recreate a fresh Supabase environment").

### To completely recover e-Lab, you need all four of:

1. **The e-Lab application source / Git repository** — restores the
   application itself, *including every simulation engine* (§3.6/§3.7).
2. **Compatible environment variables/secrets, recreated securely** —
   `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` for the target
   project (§1, §5).
3. **A fresh, compatible Supabase environment** — schema applied from
   this repo's migrations, in order (§5).
4. **The Complete Disaster Recovery `.zip`** — restores content, user/
   progress/assessment/planning/settings data, and media.

Then, concretely: source code restores the application **and every
simulation**; the database restore (this `.zip`'s `data/*.json` via
`restore_elab_disaster_data`/`restore_elab_content`) restores content,
user, progress and assessment data; the Storage restore (this `.zip`'s
`media/`) restores media files; and the simulation **references** inside
the restored Learn content (`learn_blocks.content.simulationId`)
automatically reconnect to the simulation **engines** once (1) has been
deployed — no separate "relink simulations" step is needed, because the
reference is just a string id the restored React app already knows how
to resolve via `SIMULATION_COMPONENTS`.

---

## 1. What e-Lab stores, and where

| Store | Contents | Covered by |
|---|---|---|
| **Git repository** (this repo) | Application code, the static curriculum tree, every `supabase/*.sql` / `supabase/migrations/*.sql` migration (the authoritative schema source), this documentation | Your own version control — not a backup file at all. If the repo is lost, nothing below can be applied. |
| **Supabase Postgres database** | Every table row: Learn content, Question Bank, profiles, progress, assessments, settings | Content Backup (content tables only) + Complete Disaster Recovery (adds user/progress/assessment/planning/settings tables) |
| **Supabase Storage** | `learn-media`, `resources`, `question-media` bucket objects | Content Backup: references (bucket+path) only. Complete Disaster Recovery: the **actual file bytes**. |
| **Supabase Auth** (`auth.users`) | Sign-in identities, password hashes, sessions | **Neither backup touches this.** See §4. |
| **`.env` / environment variables** | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Never backed up (not secrets, but not application data either — recreated manually, see §5). |

## 2. What Content Backup protects (unchanged)

See `BACKUP_AND_DISASTER_RECOVERY.md`. Unmodified by this feature:
`learn_pages`, `learn_blocks`, `learn_check_questions`,
`learn_manual_questions`, `learn_manual_question_secrets`, plus a media
*reference* manifest. `restore_elab_content` (the SQL RPC) and
`src/lib/backup/{exportContent,validateBackup,restoreContent,mediaScan}.js`
are all reused verbatim by Complete Disaster Recovery — not duplicated.

## 3. What Complete Disaster Recovery adds

A single `.zip` package (`elab-disaster-backup-YYYY-MM-DD.zip`), built by
`src/lib/backup/disasterExport.js`:

```
manifest.json               format/version/counts/what's required to restore
data/content.json           the EXISTING content-backup JSON, byte-identical shape
data/users.json             profiles, user_access, user_preferences
data/progress.json          learning_progress, concept_attempts,
                             prediction_cycles, prediction_snapshots, student_streaks
data/assessments.json       student_challenges, challenge_questions
data/planning.json          class_plans, lesson_blocks (teacher Class Planner)
data/settings.json          platform_settings (singleton)
media/<bucket>/<path...>    ACTUAL downloaded file bytes (not just URLs)
integrity/checksums.json    sha256 per media file + per-data-file checksum + row counts
schema/schema-manifest.json pointer to the repo's migrations as schema source of truth
```

### 3.1 Table classification (full audit)

Audited directly from every `supabase/*.sql` and `supabase/migrations/*.sql`
file in this repo (not assumed). See `src/lib/backup/constants.js` for the
machine-readable version of this table, including the `required` flag
every table now carries (2026-09 fix — see the note below the table).

| Category (spec) | Tables | Required? | In package? |
|---|---|---|---|
| A/B. Curriculum & educational content | `learn_pages`, `learn_blocks`, `learn_check_questions`, `learn_manual_questions`, `learn_manual_question_secrets` | Required | Yes — via `data/content.json` |
| C. Media | `learn-media`, `resources`, `question-media` Storage buckets | Required | Yes — actual files referenced from Learn content, under `media/` |
| D. User profile data | `profiles` | Required | Yes — `data/users.json` |
| E. Access/subscription | `user_access` | Required | Yes — `data/users.json` |
| F. Student learning progress | `learning_progress`, `concept_attempts`, `prediction_cycles`, `prediction_snapshots`, `student_streaks`, `class_plans`, `lesson_blocks` | Required | Yes — `data/progress.json`, `data/planning.json` |
| G. Assessment data | `student_challenges`, `challenge_questions` | Required | Yes — `data/assessments.json` |
| H. Application settings | `platform_settings` | Required | Yes — `data/settings.json` |
| H. Application settings (per-user) | `user_preferences` | **Optional** | Yes, if present — `data/users.json`. Skipped (recorded in `manifest.tablesSkipped`, not silently) if this Supabase project's schema cache reports the table missing. |
| I. Authentication data | `auth.users` (Supabase-managed) | — | **No** — see §4 |
| J. Ephemeral UI state | `sessionStorage` drafts, open/closed UI panels, in-progress unsaved editor state, browser cache | — | **No**, by design (spec §34) — never was, never will be |
| K. Secrets | Service-role key, JWT secret, DB password, API keys, sessions/tokens | — | **No**, never captured anywhere in this codebase (see `src/lib/supabaseClient.js`) |

**REQUIRED vs OPTIONAL, and the 2026-09 `user_preferences` fix.** A live
"Create Disaster Backup" run failed with `Failed reading
user_preferences: Could not find the table 'public.user_preferences' in
the schema cache` — the exporter was treating every table, including
this one, as required, so one missing optional table aborted the entire
backup. The re-audit found `user_preferences` is the **only** table in
the disaster inventory that has no dedicated `*_incremental.sql` /
`*-migration.sql` file of its own (it is defined solely inside
`supabase/schema.sql`, the single "run this once" bootstrap file whose
own header says re-running an already-applied section is unnecessary),
and that the application itself
(`src/context/PreferencesContext.jsx`) already treats a failed/missing
read of it as non-critical (falls back to `{}`, never throws). Every
other table above has its own dedicated migration and the application
code that reads it always surfaces a Supabase error rather than
swallowing it — so every other table stays REQUIRED: if a required
table's read fails for **any** reason, the backup aborts loudly, exactly
as before. `user_preferences` alone is classified OPTIONAL: if (and
only if) its specific read fails because the table itself does not
exist, the exporter skips it, records the skip (table name + reason) in
`manifest.tablesSkipped`, and continues — it never silently drops it,
and any *other* kind of error on it (RLS, network, …) still aborts the
backup exactly like a required table would. This same REQUIRED/OPTIONAL
mechanism (`src/lib/backup/constants.js`'s `required` flag +
`disasterExport.js`'s `isMissingTableError` check) now covers every
table, so a future missing table fails the same intentional way instead
of crashing on the next one.

**Deliberately still excluded**, same boundary the existing Content
Backup already draws, now carried into the disaster manifest's
`tablesExcluded` field verbatim:
- `questions` / `question_versions` / `question_version_secrets` / `question_secrets`
  — the separate Question Bank system. Learn pages reference it
  (`question_id` + pinned `question_version_id`); restoring the bank
  itself is a future extension, not this feature's scope.
- `auth.users` and any Supabase Auth session/token data — see §4.

### 3.2 Ordering (spec §4)

Every ordering field already audited by Content Backup
(`display_order`, `display_order_sl`, `display_order_hl`, block
`position`, check-question `position`, manual-question `position`, MCQ
`options` array order) is preserved exactly by reusing
`exportElabContent`/`restore_elab_content` unmodified — **no new
ordering logic was introduced**, because none was needed: the existing
system already restores original ordering values, never re-infers them.

### 3.3 Restore dependency order (spec §22)

`src/lib/backup/dependencyOrder.js` declares the actual foreign-key
edges audited from the migrations (e.g. `learn_blocks.page_id →
learn_pages.id`, `user_access.user_id → profiles.id`, `challenge_questions.challenge_id
→ student_challenges.id`) and computes a topological sort over them
(Kahn's algorithm) rather than hard-coding a literal sequence. The
computed order is:

`schema → storage_buckets → auth_users → learn_pages → learn_blocks /
learn_check_questions / learn_manual_questions → learn_manual_question_secrets
→ media_files → profiles → user_access / user_preferences /
learning_progress / concept_attempts / prediction_cycles / student_streaks
/ student_challenges / class_plans → prediction_snapshots /
challenge_questions / lesson_blocks → platform_settings`

The actual restore code (`disasterRestore.js`) follows this shape:
content first (its own atomic RPC), then user/progress/assessment data
(its own atomic RPC, internally ordered profiles → dependents → their
dependents), then media last (Storage, necessarily outside both
transactions — see §3.5).

### 3.4 ID preservation / remapping (spec §23)

- **Content** (`learn_pages` and everything under it): unchanged from
  the existing system — pages are matched by natural key
  (`parent_topic`, `lesson_code`), never by their original database id;
  a restored page always gets a fresh id, and every child row
  (`learn_blocks.page_id`, `learn_check_questions.page_id`,
  `learn_manual_questions.page_id`, `learn_manual_question_secrets.manual_question_id`)
  is rewritten to point at it. This is `restore_elab_content`, reused.
- **Users**: `public.profiles.id` **is** `auth.users.id` — there is no
  surrogate id to remap independently of the auth identity itself. The
  new `restore_elab_disaster_data(payload, id_map)` RPC therefore takes
  an explicit **identity map** — `{ "<old user id>": "<target user id
  already present in auth.users on this database>" }` — built by the
  admin (see §4), and uses it to resolve every `user_id` foreign key
  across every table listed in §3.1. An old id absent from the map is
  **skipped, reported by count, and never silently attached to a
  different account** (spec §11's explicit requirement — verified by the
  RPC's per-table `skippedNoIdentity` counters, visible in the Restore UI).
- **Secondary ids that DO get freshly generated and remapped** within
  the disaster-data RPC (same pattern as pages): `prediction_cycles.id`
  (for `prediction_snapshots.prediction_cycle_id`),
  `student_challenges.id` (for `challenge_questions.challenge_id`),
  `class_plans.id` (for `lesson_blocks.class_plan_id`).

### 3.5 Media — actual files, portable references (spec §6/§7)

`src/lib/backup/mediaPackage.js` calls
`supabase.storage.from(bucket).download(path)` for every path in the
existing content export's media manifest, computes a SHA-256 of the
downloaded bytes (`src/lib/backup/checksums.js`, Web Crypto
`crypto.subtle.digest`), and adds the file to the zip under
`media/<bucket>/<path>`. `integrity/checksums.json` records every
file's hash, size and content type.

On restore, each packaged file is re-uploaded to the **same bucket and
path** it came from (`upload(path, bytes, { upsert: true })`), then
**re-downloaded and re-hashed** to confirm what actually landed in
Storage matches the package — this is the "compensating verification"
the spec asks for in place of true cross-system atomicity (Storage
writes cannot share a transaction with the Postgres RPC calls). A file
that fails to upload or re-verify is reported by bucket+path+error in
the Restore UI, never silently treated as succeeded; content and
user-data restore are **not** rolled back because of a media failure —
they already committed atomically in their own RPC calls, independent
of Storage.

Because paths are preserved exactly (not rewritten to a new hostname),
existing `learn_blocks.content` HTML/JSONB that embeds a full
`.../storage/v1/object/public/learn-media/<path>` URL continues to
resolve correctly **once the target project's bucket is public** (the
migrations already set `learn-media` public) **and** the restored
object exists at that same path — which media restore guarantees. If a
restore targets a *different* Supabase project (a different hostname),
existing absolute URLs embedded in content would need a one-time
find/replace of the hostname portion after restore; this is
**documented, not automated**, since content is deliberately restored
byte-for-byte rather than rewritten by a heuristic URL parser (spec
§5's "do not flatten / do not silently drop fields" bar cuts against
inventing a URL-rewriting pass that could corrupt unrelated text).

### 3.6 Simulations — references vs. implementation vs. datasets (spec §3-8)

A Learn content block with `block_type: "simulation"` only ever stores a
**reference/placement** — `content.simulationId` (see
`src/data/learnBlockRegistry.jsx`'s `simulation` entry and
`src/components/learn/LearnBlockRenderer.jsx`'s `"simulation"` case).
The actual simulation code is **application source**, not database
content, split three ways:

| Layer | Where it lives | Protected by |
|---|---|---|
| A. Simulation **reference/placement** | `learn_blocks.content.simulationId` (Supabase) | This backup's `data/content.json` (it's an ordinary Learn block) |
| B. Simulation **implementation** (the React component) | `src/engines/<name>/` (e.g. `src/engines/build-an-atom/`), wired to its registry id in `src/data/simulationEngineComponents.js` (`SIMULATION_COMPONENTS`) and labeled in `src/data/simulationRegistry.js` (`SIMULATION_REGISTRY`) | The **Git repository** — never duplicated into the disaster `.zip` |
| C. Simulation **datasets/assets** | Plain source-controlled `.js` files under each engine's own `src/engines/<name>/data/` directory (and `src/data/chemistry/`) — e.g. `ionization-energy-explorer/lib/ionizationData.js`, `atomic-spectra/data/spectra.js`, `build-an-atom/data/nuclides.js` | The **Git repository** (SOURCE-CONTROLLED DEPENDENCY) — audited directly, none found in Supabase tables or Storage, so none are duplicated into the `.zip` either (spec §8) |

As of this audit, e-Lab has **19 simulations** registered in
`SIMULATION_COMPONENTS`/`SIMULATION_REGISTRY` (discovered from
`src/engines/`, not assumed from any example list): Electron
Configuration Explorer, VSEPR Explorer (3D), Explore Matter & States,
Particle Model Visualizer, Phase Change & Heating Curve, pH Calculator &
Visualizer, H⁺–OH⁻ Balance in Water, Neutralization Particle Visualizer,
Equivalence Point, pH Curve & Titration Visualizer, Buffer Action
Visualizer, Chocolate Wrapping (Understanding Rate), Collision Theory
Visualizer, Mixture Separation Explorer, Build an Atom, Wave Explorer,
Orbital Explorer, Atomic Spectra Lab, Ionization Energy Explorer.

**Every "Create Disaster Backup" run now verifies simulations
automatically** (`src/lib/backup/simulationAudit.js`, wired into
`disasterExport.js`): it reads the just-exported `learn_blocks`, collects
every unique `content.simulationId` actually referenced, and cross-checks
each one against `SIMULATION_COMPONENTS`. The result is written into
`manifest.simulations`:

```json
"simulations": {
  "referencedBlocks": 16,
  "uniqueSimulations": 12,
  "verifiedImplementations": 12,
  "missingImplementations": 0,
  "items": [
    { "simulationId": "build-an-atom", "pages": ["..."], "pageTitles": ["..."],
      "referencedBlocks": 3, "implementationLocation": "src/engines/…",
      "datasets": "…", "status": "verified" }
  ]
}
```

If a Learn page references a `simulationId` with **no** matching
implementation, that item's `status` is `"missing"`, the backup's
`verification.simulationsVerified` is `false`, and the Admin UI shows an
explicit warning listing which `simulationId`(s) are missing — the
backup is **not** silently reported as a complete success in that case
(spec §7), though it is not treated as a hard failure either (the
content itself, unlike the app source, was still captured faithfully).

### 3.7 Application source/version (spec §6/§13)

Simulation code (and all other application source) is protected by the
**Git repository**, not duplicated into every disaster `.zip`. To know
which source version a given backup is compatible with,
`manifest.applicationSource` records a real, non-invented identifier
(`src/lib/backup/appVersion.js`):

1. A git commit hash, **only if** one is exposed at build time via a
   `VITE_GIT_COMMIT` (or `VITE_VERCEL_GIT_COMMIT_SHA`) build environment
   variable — not set by this repository as shipped (there is no `.git`
   directory in this project, so there is no commit hash to record).
2. Otherwise, `package.json`'s `"version"` field — the safest identifier
   actually available — with the manifest explicitly noting this is
   **not** a git commit and recommending you add a build-time
   `VITE_GIT_COMMIT` env var (e.g. `VITE_GIT_COMMIT=$(git rev-parse
   HEAD) vite build`) to your deploy pipeline if you want true commit
   traceability going forward. Nothing is ever fabricated.

## 4. Authentication — the part that CANNOT be fully automated from this app

`public.profiles.id` is a foreign key into `auth.users.id`. Creating an
`auth.users` row (with a real, safely-hashed credential) requires
Supabase's **Admin API**, which requires a **service-role secret** —
and a service-role secret must never run in this React frontend (see
the header comment in `src/lib/supabaseClient.js`, and spec §12's
explicit prohibition). This project does not, and will not, implement a
custom password-migration system (spec §12's explicit prohibition).

**This is a real, audited security boundary, not a missing feature.**
Two supported recovery scenarios:

**(a) The Supabase Auth users still exist** (e.g. only tables/Storage
were lost, or you're restoring into the *same* project after a bad
migration). The identity map is the default one
(`buildIdentityMap()` in `disasterRestore.js`): every old user id maps
to itself. This is what the Restore UI pre-fills automatically.

**(b) A genuinely fresh Supabase project** (the original project itself
is gone). You must, using Supabase's own tooling (dashboard or Admin
API from a trusted server context — never this app):
1. Re-invite or recreate each user (Supabase Auth → Users → Invite, or
   a bulk CSV invite if your Supabase plan supports it), ideally by the
   same email addresses recorded in `data/users.json`'s `profiles[].email`.
2. Record the **new** `auth.users.id` Supabase assigns each one.
3. Build the identity map: `{ "<old id from data/users.json>": "<new
   auth.users.id>" }`, either as JSON or as `old_id,new_id` CSV lines
   (both accepted by `parseIdentityMapText()`), and paste it into the
   Restore UI's identity-map field before confirming.
4. Every old id you do **not** map is skipped for every user-owned
   table — their content-authoring/admin work is unaffected (it has no
   `user_id`), but their personal progress/assessment history is not
   restored until you do map them. This is deliberate: silently
   attaching one student's history to a different, unrelated new
   account would be a serious privacy failure the spec explicitly forbids.

Students/teachers will need to **reset their password** (or use
whatever sign-in method Supabase Auth offers, e.g. magic link) on first
sign-in to a recreated project either way — no password can be
carried over, by design.

## 5. How to recreate a fresh Supabase environment (from nothing)

1. Create a new Supabase project.
2. Set `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) —
   the anon/publishable key only, from the new project's API settings.
3. In the Supabase SQL Editor, run every migration in this repo, **in
   this order** (schema-first is the actual schema source — see spec
   §16): `supabase/schema.sql`, then each `supabase/*-migration.sql` and
   `supabase/migrations/*.sql` file present in the repo at the time your
   backup was created (check `manifest.json`'s `createdAt` against this
   repo's git history to know which migrations existed yet). Most files
   carry their own "safe to run once" / "NOT run automatically" header —
   follow those notes.
4. Confirm the three Storage buckets exist (`learn-media`, `resources`,
   `question-media`) — the relevant migrations create them via `insert
   into storage.buckets`.
5. Promote your own account to `admin` (see
   `supabase/admin-role-migration.sql`).
6. Open **Admin → Backup & Restore → 3. Restore → Restore Disaster
   Backup**, select your `.zip`, follow §4 above for the identity map,
   and restore.

## 6. How integrity verification works (spec §18)

- **At backup time**: every media file's bytes are hashed the moment
  they're downloaded; every data JSON file is hashed after being
  written into the zip; the whole zip is then **re-opened and every
  media file re-hashed** (`verifyZippedMediaChecksums`) before the
  backup is offered for download. If anything fails to verify, the
  manifest is flagged `verificationFailed: true` and the Admin UI shows
  a failure state, **not** "backup complete" (spec §18's explicit
  requirement — see `disasterExport.js`).
- **At restore time** (`disasterValidate.js`): the zip is re-opened,
  every `integrity/checksums.json` entry is re-verified against the
  actual zip contents before any restore button is enabled, and the
  existing `validateBackup()` content validator is reused verbatim
  against `data/content.json`.
- **During media restore**: each file is re-downloaded from Storage
  immediately after upload and re-hashed against the package's
  recorded checksum (see §3.5).

## 7. How to test recovery

Run `npm run test:disaster-recovery` — see §"Tests performed" in the
final implementation report for exactly what this harness does and does
not prove. It exercises dependency-order derivation, checksum
computation, zip assembly/round-trip, identity-map parsing, a
synthetic export→restore structural deep-equal, table REQUIRED/OPTIONAL
classification + missing-table detection (including a mock of the
"required table missing aborts / optional table missing skips" decision
rule against the exact error message the live failure reported), and
the simulation-reference-vs-implementation audit — all without a live
database. **A genuine round-trip test against a real Supabase project
(create backup → wipe a test project → restore → compare) has not been
run in this session** (no live Supabase credentials in this sandbox —
see the final report's honesty breakdown) and should be your first
action before relying on this feature for a real disaster.

## 8. Remaining limitations (read before you need this for real)

- `auth.users` identities are **not portable** by this package — see §4.
- Restoring into a **different** Supabase project hostname may require
  a manual find/replace of embedded media URLs in rich-text content if
  you want the OLD absolute URLs (rather than the newly-restored paths
  at the same bucket/path) to resolve — see §3.5.
- Media restore is **not** transactional with the database writes —
  see §3.5's "compensating verification" design. A media upload failure
  is reported, not retried automatically; re-run the restore (idempotent
  — `upsert: true`) or re-upload the specific failed files manually via
  the Supabase Storage dashboard using the paths shown in the failure list.
- The Question Bank (`questions`/`question_versions`/`question_secrets`)
  is out of scope, same boundary the existing Content Backup already draws.
- This feature has been **code-reviewed and structurally tested against
  synthetic data**, not run against a live Supabase project, in this
  session — see the implementation report's honesty breakdown (spec §40).
