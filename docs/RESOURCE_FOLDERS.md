# Resource folders

Replaces the hard-coded resource categories (`STUDENT_CATEGORIES` / `TEACHER_CATEGORIES`) with a folder tree the admin manages at **Admin -> Folders**, mapped to the **Folder** dropdown when adding a resource and browsable by students and teachers. Decisions: `docs/PLATFORM_RESTRUCTURE_SPEC.md` (everything is free for now; Premium-ready; SQL is draft only). Mockups: `docs/mockups/03`, `04`, `08`.

**Status:** app code is finished and works with or without the database change. The SQL (`docs/platform-sql/010_*.sql`) is a DRAFT and has **not** been applied to any real project.

## 1. Data model

`public.resource_folders` (draft in `docs/platform-sql/010_resource_folders.sql`):

| column | notes |
|---|---|
| `id` uuid pk | |
| `parent_id` | self FK, nullable (top level), `ON DELETE RESTRICT` |
| `audience` | `student` / `teacher` / `both` (same vocabulary as `resources.audience`) |
| `name` | 1-80 chars, no `/` or `\` |
| `slug` | stable key; for the 4 seeded folders it equals the legacy category id (`ib-documents`, ...). Never rewritten on rename |
| `sort_order` | integer; admin Up/Down renumbers siblings 10, 20, 30... |
| `access_tier` | `free` / `premium` (same convention as `resources.access_tier`) |
| `created_by`, `created_at`, `updated_at` | `updated_at` via the existing `touch_updated_at()` trigger |

Rules enforced in the database (trigger `resource_folders_guard`) **and** in the app (`src/lib/resourceFolders.js`, so users get clear messages): max depth 3, no cycles, a child's audience may not be wider than its parent's, unique `(parent, audience, lower(name))`, same for slug.

`resources.folder_id` (new, nullable FK, `ON DELETE RESTRICT`, indexed). A folder that still holds sub-folders or resources cannot be deleted. The legacy `resources.category` column is **kept and still written**.

RLS on `resource_folders` mirrors the `resources` policies: admin via `public.is_admin()` for all operations; students read folders with audience `student`/`both`, teachers `teacher`/`both` (same `exists (select 1 from profiles ... role = ...)` checks).

**Storage is untouched.** Uploads still go to `<audience>/<category>/<uuid>.<ext>`; the storage read policy matches on `file_path`, not on category or folder. Moving a resource between folders never moves a file. The `category` written for a resource saved into a folder is derived from the top-level folder (a seeded folder gives its own category id; a custom top-level folder gives the audience default `study-materials` / `worksheets-other`; a `both` resource always gets the student-scheme id).

## 2. Code map

| file | role |
|---|---|
| `src/lib/resourceFolders.js` | pure: tree, paths, descendants, depth/cycle/audience validation, ordering, audience filtering, tier inheritance, legacy fallback + mapping, form options, search/sort |
| `src/lib/folderService.js` | all `resource_folders` DB calls (list, create, rename, move, reorder, audience, tier, delete-if-empty, seed); `FolderError` with codes |
| `src/lib/useResourceFolders.js` | hook: loads rows with fallback, filters by role |
| `src/components/resources/FolderTree.jsx` | accessible tree (`tree`/`treeitem`/`group`, arrow keys, roving tabindex) |
| `src/components/resources/ResourceBrowser.jsx`, `ResourceRow.jsx` | shared student/teacher browser (tree, breadcrumb, search, sort, folder picker on narrow screens) |
| `src/pages/admin/folders/AdminFolders.jsx` | `/admin/folders` (nav item "Folders") |
| `src/pages/admin/resources/ResourceForm.jsx`, `AdminResources.jsx` | Folder dropdown; Folder filter |
| `src/lib/resourceService.js` | `createResource`/`updateResource` retry without `folder_id` if the column does not exist yet |
| `src/lib/useVisibleResources.js` | additionally carries `folderId`, `createdAt`, `accessTier` into the normalised resource |

## 3. Fallback behaviour (before the SQL is applied)

* `loadFolders()` never throws. If the table is missing (`PGRST205` / `42P01`), empty, errors, or Supabase is not configured, the app **synthesises the four historical top-level folders** (`legacy:<category id>`): student *IB Documents*, *Study Materials*; teacher *IB Resources*, *Worksheets & Other Resources*. The student/teacher pages then look as they did.
* A resource is placed by `folder_id` when that folder is visible to the reader; otherwise by its legacy `category` (translated across the student/teacher schemes exactly like `getCategoryForAudience`, so `both` resources keep appearing for both roles); otherwise it is shown only under **All resources** and in search.
* Deep links keep working: `/student/resources/ib-documents` (or `study-materials`, a teacher-scheme id, a top-level folder slug, or a folder id) opens the browser with that folder selected. Unknown ids redirect to `/student/resources`. Selection is also kept in `?folder=<id>`.
* Admin -> Folders shows a clear notice and disables every write control when the table is missing. If the table exists but is empty it offers "Create the four standard folders".
* The Add-resource form never sends `folder_id` before the migration (and retries without it if the column turns out to be missing).

## 4. Tiers and Premium later

Everything is free now. `access_tier` on folders is stored metadata only; the UI shows lock chips/badges **only** through `accessPolicy.tierBadge()` / `checkAccess()` (invisible while `premiumEnabled` is false), and never compares tiers in components.

**Inheritance rule (decision):** a folder's tier is inherited by its sub-folders and resources; the effective tier is the **most restrictive on the chain** (`effectiveTier`): Premium anywhere above or on the item makes it Premium. A child cannot be made more open than a Premium ancestor, because `resources.access_tier` is `NOT NULL default 'free'` and cannot express "inherit" - treating a stored `free` as an explicit open override would silently expose whole Premium folders. A Premium resource inside a free folder stays Premium. A future nullable override column can relax this.

Turning Premium on later = admin setting (`premiumEnabled`) + setting folder/resource tiers + the **database** enforcement phases in `docs/security-plan/` (030/032). This work is UI/metadata only; it is **not** security. In particular the 032 draft decides resource access from `resources.access_tier` / `organization_id`; it would need a follow-up to evaluate the folder chain (e.g. a view or function resolving `effective_tier(folder_id)`), otherwise a Premium folder would not protect a resource row whose own tier is `free`. Until then, mark the individual resources Premium too.

## 5. Applying the draft SQL safely (owner only)

1. **Do not run anything on production first.** Use a staging copy (restore a recent backup into a scratch project).
2. **Back up**: Supabase backup/PITR status, a logical dump of `resources` (and `profiles`), the Admin -> Backup export, and a storage inventory. Note: the SQL moves no files.
3. Run `docs/platform-sql/010_preflight_readonly.sql` (read-only). Check: P01 all true, P02 both false, P05 (categories the backfill will not map; those resources keep `folder_id` null and show under "All resources" until filed), P07/P08 (policies and the `set_updated_at` trigger exist), P09 (you are the table owner - the backfill briefly disables that trigger so `updated_at` is not bumped). Save P10 (fingerprint) and P11.
4. Apply `010_resource_folders.sql` (one transaction, idempotent). If your project hardened grants (security-plan 020), also grant `select, insert, update, delete` on `resource_folders` to `authenticated` as for `resources`.
5. **Verify**: re-run P10 - `resources` count and fingerprint must be identical; the script's last query shows folders = 4 (+ yours), resources_with_folder = resources minus unmapped. As each role, open Resources; as admin open Admin -> Folders (no "not created yet" notice) and add a test resource into a sub-folder, then delete it.
6. **Rollback**: `010_resource_folders_rollback.sql` (drops `folder_id`, the table, the guard function; keeps `category` and every file). It refuses to run if custom folders exist unless you export them and `set app.rollback_confirm = 'yes';` first. The app falls back to the four categories automatically.
7. Other places that list tables will need `resource_folders` added when the migration is applied: the app's backup/disaster-recovery table registry (`src/lib/backup/constants.js`, with the disaster-recovery test), and the security-plan grants/policy inventory. This work did not touch them.

### What was actually run against the SQL

The drafts were executed **only** against a throwaway local PostgreSQL 16 with hand-written Supabase stubs (`docs/platform-sql/tests/010_scratch_stubs.sql`) after loading the repo's `supabase/resources-migration.sql`. Applied twice (idempotent), depth/cycle/audience/duplicate/check constraints, RESTRICT deletes, RLS for admin/student/teacher/anonymous, rollback (with and without confirmation, twice) and re-apply were exercised (`docs/platform-sql/tests/010_scratch_behaviour_tests.sql`), and the `resources` fingerprint and `updated_at` were identical before and after. This is **not Supabase**: PostgREST, the real `is_admin()` body, Auth, Storage, existing live policy drift and grants were not exercised.

## 6. Tests

* `npm run test:resource-folders` (also chained into `npm test`): `scripts/test-resource-folders.mjs` (pure module, service against an in-memory fake, resourceService compatibility) and `scripts/test-resource-folders-ui.mjs` (jsdom, real pages, before/after migration).
* `npm run verify:resource-folders`: `scripts/verify-resource-folders.mjs` - headless Chromium against a built preview with mocked Supabase, 1366x768 and 390x844, light and dark, before/after migration; writes screenshots.
