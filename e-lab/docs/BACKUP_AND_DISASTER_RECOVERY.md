# e-Lab: Backup, Export & Restore — Disaster Recovery Guide

This document explains what the Admin → **Backup & Restore** feature
protects, what it deliberately does NOT cover, and how to recover e-Lab's
authored Learn content — even years from now, by someone who has never
seen this codebase before.

## 1. Where e-Lab actually lives

- **GitHub / project files** (this repo): the application code, the
  static curriculum tree (`src/data/curricula/...`, resolved through
  `src/data/learnCmsCurriculum.js`), all `supabase/*.sql` migration files
  (schema source of truth), and this documentation. If the repo is lost,
  the app cannot be rebuilt — treat version control itself as part of
  disaster recovery.
- **Supabase** (a separate project, referenced only by URL + anon key in
  `.env` / `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`): every
  database row and every uploaded media file. This is the data a Supabase
  project loss, accidental deletion, or bad migration would destroy —
  and what this feature backs up.

## 2. What this backup contains

A content backup is a single portable JSON file containing every row of
the following tables, which together constitute all authored Learn
content:

| Table | What it is |
|---|---|
| `learn_pages` | Lesson pages: topic/lesson identity, title, level, ordering, draft/published status |
| `learn_blocks` | The rich content blocks on each page (text, Worked Examples, Think/Reveal, tables, media, simulation references, etc.) — full JSONB `content`, byte-for-byte |
| `learn_check_questions` | Which canonical Question Bank items (by `question_id` + pinned `question_version_id`) are assigned to which page, and in what order |
| `learn_manual_questions` | Learn-only MCQ/short-answer questions authored directly on a page (question text, options, stimulus) |
| `learn_manual_question_secrets` | The correct answers/explanations for those manual questions, read through the same admin-only RPC the editor itself uses |

Plus a **media manifest**: every `learn-media` Storage path referenced
from inside the exported blocks/questions, with which row(s) reference it.

The file also carries `format`, `backupVersion`, `exportedAt`,
`scope` (full vs. one topic), and `statistics` — everything needed to
recognize, validate, and preview it before any restore.

## 3. What it deliberately does NOT contain

- **Credentials/secrets**: no Supabase keys, service-role credentials,
  auth tokens, or sessions. The app only ever uses the public anon key
  (see `src/lib/supabaseClient.js`) — a service-role key never reaches
  the browser.
- **Student/user data**: `profiles`, `learning_progress`,
  `concept_attempts`, `student_challenges`, `challenge_questions`,
  `student_streaks`, `user_preferences`, `user_access` are never included
  in a content backup. This is a deliberate architectural boundary
  (per the spec's §18) — content backup and user-data backup are kept
  separate so a content export can be shared/stored more freely. A
  separate, more carefully access-controlled administrative data backup
  is a natural future extension; nothing here blocks adding it.
- **The Question Bank itself** (`questions`, `question_versions`,
  `question_version_secrets`): see §5 below — this is a deliberate,
  documented scope limit, not an oversight.
- **Media binary files**: media is referenced (bucket + path), not
  embedded as base64/binary inside the JSON (see §6). Media files
  themselves must be recovered from Supabase Storage's own
  backups/replication, or (future work) a separate media-packaging step.
- **Teacher Class Planner content** (`class_plans`, `lesson_blocks`):
  this is a teacher-authored planning tool, not part of the Learn
  content library, and was excluded after auditing `.from(...)` calls
  across the codebase.

## 4. Tables audited and excluded on purpose

The full list of tables found via `.from("...")` calls across `src/`:
`challenge_questions`, `class_plans`, `concept_attempts`, `learn_blocks`,
`learn_check_questions`, `learn_manual_questions`, `learn_pages`,
`learning_progress`, `lesson_blocks`, `platform_settings`,
`platform_settings_public`, `prediction_cycles`, `prediction_snapshots`,
`profiles`, `question-media` (a Storage bucket, not a table),
`question_paper_items`, `question_papers`, `question_versions`,
`questions`, `resources`, `student_challenges`, `student_streaks`,
`user_access`, `user_access_overview`, `user_preferences`.

Only the five tables in §2 are Learn **content**. Everything else is
either user/progress data, unrelated platform tooling (prediction
cycles, resources library, class planner, settings), or — the one
deliberate compromise below — the separate Question Bank system.

## 5. Why the Question Bank (`questions`/`question_versions`) is out of scope

`learn_check_questions` links a Learn page to a **canonical** question in
a separate, pre-existing Question Bank system (its own Admin section,
`AdminQuestionBank.jsx`/`QuestionEditor.jsx`). That system's tables have
no `CREATE TABLE`/RLS policy anywhere in this repo's `supabase/`
directory — they were provisioned directly against the live Supabase
project outside version control, so this feature cannot safely assume
what columns/RLS exist, and direct `SELECT` access from the client was
never confirmed. Per the explicit "do not overengineer" instruction and
the priority order (safety first), **a content backup exports only the
reference** — `question_id` + `question_version_id` — not a copy of the
Question Bank item's content/answer itself.

**Consequence**: restoring a Learn content backup reconnects a page to
its canonical questions correctly *as long as the Question Bank still
has that question/version*. If a canonical question was deleted from the
Question Bank after the backup was taken, `restore_elab_content` skips
that one assignment (reported back as `checkQuestionsSkipped`) rather
than failing the whole restore. **The Question Bank needs its own,
separate backup** — a natural, clearly-scoped future addition, not
something this feature silently assumes.

> **2026-10 update**: that separate backup now exists — see
> `docs/DISASTER_RECOVERY.md` §9. It lives entirely in the *Complete
> Disaster Recovery* package (`data/question-bank.json` /
> `data/question-papers.json`), not in this document's plain Content
> Backup (`data/content.json`), which still exports only the
> `question_id`/`question_version_id` reference described above — that
> design is unchanged.

## 6. How media is handled

Learn media is uploaded to the public `learn-media` Supabase Storage
bucket (`src/lib/learnContentService.js`), and blocks store the
**full public URL** inline in their JSONB `content`
(`https://<project>.supabase.co/storage/v1/object/public/learn-media/...`)
— confirmed via `LearnBlockRenderer.jsx`. Because it's a full URL, not a
relative path, **a restore never needs to rewrite media URLs** as long
as it runs against the same Supabase project the backup came from.

The export scans every exported block's `content` and every manual
question's `stimulus`/`options` for that URL pattern and lists each
distinct path once in `mediaManifest`, with the ids of every row that
references it. The binary files themselves are **not** downloaded or
embedded — this keeps backup files small JSON, not multi-gigabyte
blobs, per the explicit instruction not to put large binaries directly
in JSON.

**Future extension (not built, intentionally)**: a "package media"
option that walks `mediaManifest` and downloads each Storage object into
a zip alongside the JSON, for a true offline disaster-recovery bundle.
The manifest is already the exact input such a feature would need.

## 7. Backup format

```json
{
  "format": "elab-content-backup",
  "backupVersion": 1,
  "exportedAt": "2026-09-30T12:00:00.000Z",
  "application": "e-Lab",
  "scope": { "type": "full" },
  "statistics": { "pages": 0, "blocks": 0, "checkQuestions": 0, "manualQuestions": 0, "media": 0 },
  "data": {
    "learn_pages": [],
    "learn_blocks": [],
    "learn_check_questions": [],
    "learn_manual_questions": [],
    "learn_manual_question_secrets": []
  },
  "mediaManifest": [{ "bucket": "learn-media", "path": "...", "referencedBy": ["learn_blocks:<id>"] }]
}
```

`scope.type` is `"full"`, `"topic"` (with `parentTopic`), or the
internal `"pageIds"` shape used only for the automatic pre-restore
safety snapshot. `backupVersion` is bumped whenever this shape changes
in a way an older `validateBackup.js`/`restore_elab_content` could not
safely interpret — **never silently reinterpreted**.

## 8. How to export

Admin → Backup & Restore → choose **Full** or **Single topic** → **Prepare
backup** (shows live progress: reading pages, blocks, questions, media,
then a summary) → **Download backup**. The download never touches the
database — it's a read-only operation end to end.

## 9. How to validate

Selecting a file under **Restore & Import** validates it immediately and
automatically, before anything else: JSON parses; `format` and
`backupVersion` are recognized; every table section is present and
shaped correctly; every block/question/answer references a page that is
actually in the file; no duplicate page identities; no orphaned
manual-question answers. Every check is listed with a pass/fail mark. **A
failed validation never reaches the database** — the Restore controls
stay disabled until the file is fixed or a different file is chosen.

## 10. How to restore

Select file → (automatic) parse → validate → preview (backup date,
version, scope, counts, and a diff against the live database: which
pages are new vs. already exist) → choose a mode → for a destructive
choice, download the forced pre-restore snapshot → confirm → restore →
the app reports exactly what happened (rows inserted/updated/skipped).

**Modes** (only these two — no vague "Import"):

- **Merge**: imports whole pages (with all their blocks and questions)
  that do not already exist, matched by the same natural key the
  database itself enforces — `(parent_topic, lesson_code)`. An existing
  page is never touched in Merge mode, so it can never partially
  duplicate a page's blocks.
- **Restore / Replace selected content**: for every page in the backup
  that already exists (same natural key), its metadata is updated and
  **all** of its current blocks/check-questions/manual-questions are
  deleted and replaced with the backup's versions. Pages not yet
  present are inserted fresh, exactly as in Merge. This is why it forces
  a pre-restore snapshot download first.

Restored pages and their dependent rows **never reuse their original
database id** — a fresh id is always generated (or, in Replace mode, the
existing row's current id is kept and only its children are
replaced/recreated). `restore_elab_content` maintains an in-function
old-id → new-id map and repairs every block/question/manual-question
reference accordingly before inserting it.

## 11. Transaction / rollback strategy — and its real guarantee

The entire write path is a **single call** to the Postgres function
`public.restore_elab_content(payload jsonb, mode text)`
(`supabase/migrations/backup_restore_rpc_incremental.sql`), invoked once
via `supabase.rpc(...)`. A PL/pgSQL function body executes as one
transaction automatically — if any statement inside it raises an
exception, every change that call made is rolled back as a whole, with
no explicit `BEGIN`/`COMMIT` needed. This is real, database-level
atomicity, not a best-effort client-side "track what succeeded and
reverse it" approach.

**What this does NOT cover** (the honest residual risk):

- **Two admins restoring at the same time**: Postgres will still
  serialize the two function calls, but the second one's "does this page
  already exist" check reflects whatever the first one already
  committed — there is no advisory lock preventing two concurrent
  restores from interleaving in a surprising way. In practice this
  system has a small number of admins and restores are rare, deliberate
  actions, so this is an accepted, documented risk rather than
  something engineered around.
- **A payload too large for a single request**: extremely large full
  backups could in principle exceed practical request-size limits for
  one `rpc()` call. Scoped (per-topic) restores keep well within normal
  limits; a full-library restore that large is also the rarer,
  higher-stakes case an admin would likely want to do per-topic anyway.
- **Missing Question Bank references**: as documented in §5, a
  `learn_check_questions` row whose Question Bank item no longer exists
  is skipped, not fatal — this is a deliberate design choice (a restore
  should not fail entirely over one stale reference), reported back as
  `checkQuestionsSkipped` in the result.

## 12. Conflict handling

A page "conflicts" only in the sense of already existing by natural key
— there is no per-block conflict resolution, because Merge never touches
an existing page's children, and Replace always fully replaces them (no
partial/ambiguous merge of individual blocks). This avoids ever
silently duplicating content, per the explicit instruction.

## 13. Authorization / security

- The **Admin → Backup & Restore** route is gated the same way every
  other Admin route is: `ProtectedRoute role="admin"` checks
  `profile.role === "admin"` (`src/components/auth/ProtectedRoute.jsx`),
  reusing the app's existing, single auth pattern — no new gating
  mechanism was introduced.
- That client-side check is a **UX convenience, not the real security
  boundary** — exactly as already true for the rest of this app's Admin
  area. The real boundary is Postgres RLS + `public.is_admin()`:
  - `learn_pages`, `learn_blocks`, `learn_check_questions`,
    `learn_manual_questions` all already have `"Admins can write ..."`
    policies (`using (public.is_admin()) with check (public.is_admin())`)
    from `learn_content_cms.sql` — confirmed present, not assumed.
  - `learn_manual_question_secrets` has **all** direct table access
    revoked from `anon`/`authenticated` — reachable only through
    `SECURITY DEFINER` RPCs that check `is_admin()` internally
    (`admin_save_learn_manual_question`,
    `get_admin_learn_manual_question_secret`). The export code reuses
    the existing read RPC rather than adding new table access.
  - The new `restore_elab_content` RPC follows the identical,
    already-established pattern in this codebase
    (`publish_learn_page`, `mark_learn_check_answers`): `SECURITY
    DEFINER`, `set search_path = public`, an explicit `if not
    public.is_admin() then raise exception` at the top, `revoke all ...
    from public, anon`, then `grant execute ... to authenticated`. A
    student modifying frontend JavaScript to call this RPC directly
    still gets `raise exception 'Not authorized'` — it is not a
    client-side-only guard.
- **No pre-existing RLS gap was found** on the tables this feature
  touches. No RLS rewrite was made or needed.
- The service-role key is never used anywhere in this feature — every
  read and write goes through the same anon-key client
  (`src/lib/supabaseClient.js`) every other Admin page already uses.

## 14. Backward compatibility

`backupVersion` starts at `1`. `validateBackup` explicitly rejects any
`backupVersion` greater than the version this build of the app
understands (never silently attempts to interpret a newer, unknown
shape), and accepts `1..BACKUP_VERSION` — so an older backup file taken
before a future schema addition keeps validating as long as the newer
fields it's missing are read with safe defaults. Bump
`BACKUP_VERSION` in `src/lib/backup/constants.js` and extend
`validateBackup`/`restore_elab_content` together, in the same change,
whenever the exported shape changes.

## 15. Migrating e-Lab to a new Supabase project

1. Run every file in `supabase/migrations/` (plus the standalone
   `*-migration.sql` files this project already uses) against the new
   project, in the order described in each file's own comments, to
   recreate the schema, RLS policies, and the `learn-media` bucket.
2. Run `supabase/migrations/backup_restore_rpc_incremental.sql` to add
   `restore_elab_content`.
3. Point `.env` at the new project (`VITE_SUPABASE_URL` /
   `VITE_SUPABASE_PUBLISHABLE_KEY`).
4. Re-upload the `learn-media` Storage objects listed in a full export's
   `mediaManifest` (media itself is not inside the JSON — see §6).
5. Sign in as an admin on the new project, open **Admin → Backup &
   Restore**, and **Merge** a full content backup taken from the old
   project — since the new project's `learn_pages` is empty, every page
   matches "new" and is inserted with fresh ids.
6. The Question Bank (§5) must be migrated/recreated separately — it is
   outside this feature's scope.

## 16. Known limitations (stated plainly)

- The full Question Bank (`questions`/`question_versions`/secrets) is
  not backed up by this feature — only the pinned reference from each
  Learn page (§5). `question_papers`/`question_paper_items` (the teacher
  QBuilder feature) are grouped with the same exclusion — see
  `docs/DISASTER_RECOVERY.md` §4/§3.1 for the 2026-10 audit confirming
  neither has a `create table` migration anywhere in this repo.
- `resources` (teacher/student library metadata) is NOT part of this
  Content Backup (§2 above is Learn content only) but IS covered by
  **Complete Disaster Recovery** (`data/library.json`) — see
  `docs/DISASTER_RECOVERY.md` §3.1. Its Storage bucket's file BYTES are
  still not packaged by either feature (row metadata only).
- Media binaries are not packaged into the backup file — only their
  paths (§6).
- Restore atomicity is real (Postgres function-level), but concurrent
  restores and single-request payload-size limits on an extremely large
  full-library restore are accepted, documented risks rather than
  engineered around (§11).
- This sandbox had no live Supabase credentials, so the export/restore
  path was never exercised against a real database — see
  the implementation report for exactly what was and wasn't testable
  here.
