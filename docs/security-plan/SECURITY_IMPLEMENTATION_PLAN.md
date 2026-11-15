# e-Lab.school — Security Implementation Plan: Protecting Original Content, Code and Simulations

**Status: PLAN ONLY. Nothing in this folder has been applied.** No existing repo file was modified, no migration was run, no live system (Supabase, Vercel, storage) was contacted, no bucket visibility was changed, nothing was deployed. Everything here is a draft for review; the owner approves phase by phase.

Inputs: `docs/SECURITY_IMPLEMENTATION_SPEC.md` (the brief), `docs/SECURITY_AUDIT_REPORT.md` and `docs/SECURITY_AUDIT_SPEC.md` (re-verified against the repo, not trusted blindly).

## 0. How to read this, and what was and was not verified

| Label | Meaning |
|---|---|
| **VERIFIED-REPO** | I read the file or ran the command in this repo (read-only, or in a scratch copy outside the repo). |
| **VERIFIED-LOCAL-PG** | Ran against a throwaway local PostgreSQL 16 with hand-written Supabase stubs (`auth.uid()`, roles, `storage.objects`…). This proves the SQL parses, applies twice, rolls back and that the logic tests pass. **It is not Supabase** — PostgREST, Storage, Auth hooks and real policy interplay are not exercised. |
| **NOT VERIFIED (live)** | Depends on the live Supabase project, which I did not and must not touch. Each such item is a staging test or a P0 query. |

**Verified in this repo (read-only / scratch copy)**
* `public/` contains only `branding/` (2 PNG), `simulations/separation/filtration/` (6 PNG) and two empty `resources/*/.gitkeep` folders. No SQL, backups, `.env`, source or documents. (VERIFIED-REPO)
* `dist/` of a build in the scratch copy: 92 files, **0 `.map` files**, no `sourceMappingURL`, no `service_role` JWT / `sb_secret_` / connection-string / private-key pattern (new `scripts/check-build-security.mjs`, run). `vite.config.js` does not say `sourcemap: false`; it is off only because that is Vite's default. (VERIFIED-REPO)
* No `service_role` string anywhere in `src/`, `index.html`, `vite.config.js`; `.env.example` holds only the two public Supabase values (names only read). No `.env` in the repo folder. (VERIFIED-REPO)
* `vercel.json` has only the SPA rewrite: **no security headers, no CSP, no cache policy.** (VERIFIED-REPO)
* `npm audit` (run on a copy; results in scratch only): production deps — **1 critical, `dompurify <=3.4.16`, resolved 3.4.14 as a transitive dependency of `jspdf`, NOT declared in `package.json`**, although `src/lib/sanitizeHtml.js` imports it directly. All deps — adds `vite 8.2.0–8.2.2` (high, direct), `source-map-js` and `undici` (high, transitive/dev). After `npm i dompurify@^3.4.17 vite@^8.3.8` in the copy: **`npm audit --omit=dev` = 0 vulnerabilities**; `npm audit` = 1 high left (`undici`, dev-only via jsdom, "fix available"). (VERIFIED-REPO; registry versions looked up through the proxy.)
* The unmodified-except-drafts copy passes the full `npm test` (1176 assertions across the existing suites + the new security tests, exit 0) and builds. (VERIFIED-REPO, scratch copy.)
* Public routes: `/interactives`, `/interactives/:id`, `/simulation/:id` sit outside `ProtectedRoute` (`src/router.jsx` lines 115–116, 131) — every simulation engine is reachable anonymously. `/student/*`, `/teacher/*`, `/admin/*` are layout-gated in the UI only; real enforcement must be (and for Learn is today) in Supabase. (VERIFIED-REPO)
* New lesson/question images are uploaded to the **public** buckets and stored as permanent public URLs: `src/lib/learnContentService.js:177-188` (`getPublicUrl`) and `src/lib/questionBankService.js:156-158`. The Learn video block treats `…/storage/v1/object/public/learn-media/` as a direct file (`LearnBlockRenderer.jsx:65`). (VERIFIED-REPO)

**Not verifiable from the repo (needs P0 on the live project)**: the bodies of five SECURITY DEFINER functions that exist live but not in `supabase/` — `is_teacher_or_admin`, `maybe_create_question_version`, `admin_update_profile_role_status`, `submit_and_mark_challenge`, `get_review_content` (plus `handle_new_user`, `is_admin` should be re-read); all live grants/policies/ACLs; storage policies; bucket settings; role counts; what `anon` can actually read today; Supabase plan limits; Vercel project settings (source protection, deployment protection, env vars); GitHub repo privacy; Supabase backup/PITR state.

## 1. Phase overview (in order)

Each phase is separately tested and separately reversible. **Dependencies are strict**: do not start a phase before the previous one passed its staging tests. `EXPLICIT` = in the brief; `OPTIONAL` = my addition, can be dropped.

| # | Phase | Label | Risk | Scope | Summary |
|---|---|---|---|---|---|
| P0 | Backups + read-only inventory | DATABASE (read-only) | none (read-only) | EXPLICIT | Restore-tested backups; run `sql/00_preflight_readonly.sql` to capture live reality; read the 5 unseen functions. |
| P1 | Low-risk local app changes | LOCAL-APP | low | EXPLICIT (a–d), OPTIONAL (e–g) | (a) `sourcemap:false`, (b) declare + upgrade dompurify/vite, (c) harden sanitiser, (d) video-embed host allow-list, (e) catalogue cache/pagination friendliness, (f) export-control UI (needs P2 `025` first), (g) static guards. |
| P1H | Security headers + CSP (Report-Only) | DEPLOYMENT | low→medium | EXPLICIT | Proposed `vercel.json`; CSP only reports until a soak passes (finished in P9). |
| P2 | DB hardening: grants, RLS, definer functions | DATABASE | **medium** | EXPLICIT | Revoke anon/PUBLIC EXECUTE on definer functions, lock profile role/status, capture unseen functions, question-media listing, export switches. |
| P3 | Entitlement model | DATABASE | medium | EXPLICIT | One server-side tier model (public / free / premium / school), audit log, org membership. No payments. |
| P4 | Lesson delivery + lesson-table lockdown + rate limiting | DATABASE + LOCAL-APP | **high** | EXPLICIT | Narrow RPCs per lesson; then drop broad SELECT. Per-account limits, access log, events. |
| P5 | Private media | STORAGE + DATABASE + LOCAL-APP | **high** | EXPLICIT | Private buckets, copy-not-move, dual read, signed URLs, per-lesson cut-over. Public copies deleted only after verification **and** your approval. |
| P6 | Simulations | LOCAL-APP + DATABASE | medium/high | EXPLICIT | Per-engine inventory; server-side datasets/grading only where they pay; honest statement of what stays public. |
| P7 | Admin hardening | DATABASE + LOCAL-APP | medium | EXPLICIT | MFA (AAL2) via a flag, audit trail on privileged changes, encrypted backups, tested restore. |
| P8 | Teacher registration + role audit | DATABASE + LOCAL-APP | low/medium | EXPLICIT | Audit every `role='teacher'` path; store the (unspecified) teacher form fields as validated profile metadata. |
| P9 | Verification + CSP enforcement | DEPLOYMENT | medium | EXPLICIT | Soak → enforce CSP; dependency audit; full regression; bundle checks; SQL verification; lesson/image regression. |

Draft SQL numbering mirrors this: `019`/`020`/`021`/`022`/`025` → P2, `030`/`032` → P3, `040`/`041` → P4, `050` → P5, `060` → P6, `070` → P7, `080` → P8. P4 and P5 are the only phases that can break student-visible behaviour; they have per-lesson switches.

## 2. Draft files in this folder (none applied)

```
docs/security-plan/
  SECURITY_IMPLEMENTATION_PLAN.md          this file
  DECISIONS_AND_OPEN_QUESTIONS.md          one page
  sql/                                     idempotent drafts; each has header (purpose, preconditions, risk, rollback) + *_rollback.sql
    00_preflight_readonly.sql              Q01–Q33, read-only
    010_baseline_live_functions.TEMPLATE.sql   NOT runnable: how to capture the 5 unseen functions
    019 020 021 022 025 030 032 040 041 050 060 070 080 (+ _rollback)
    tests/staging_acceptance_tests.sql     self-cleaning (BEGIN…ROLLBACK), sections P2–P8
  draft-config/   vercel.proposed.json, vite.build-block.proposed.js, README.md (CSP origin derivation)
  draft-code/     patches per phase (applies cleanly to the pristine repo: `git apply --check` run), ALL_local_app_changes_except_lockfile.patch,
                  package/ (package.json + lockfile patches, new test file), README.md
```

---

## 3. Files to modify (requested item 1) — exact files, current line references

Line numbers refer to the **current** repo; they will drift once other patches land.

| Phase | File (current lines) | Change | Draft |
|---|---|---|---|
| P1a | `vite.config.js` (whole file, 8 lines) | add `build: { sourcemap: false }` | `draft-code/P1/P1a…patch` |
| P1b | `package.json` `dependencies` / `devDependencies` (`vite` at line 74) | add `"dompurify": "^3.4.17"`; `vite` → `^8.3.8`; regenerate lockfile (`npm install`) | `draft-code/package/*` |
| P1c | `src/lib/sanitizeHtml.js` (whole file) | own DOMPurify instance; forbid form/svg/math/media/frame tags; filter risky `style` declarations; optional image-host allow-list | P1a patch; test `scripts/test-sanitize-html.mjs` (30 cases, pass) |
| P1d | `src/components/learn/LearnBlockRenderer.jsx` video case (lines 63–~90) and `toEmbedVideoUrl` (452) | replace substring host checks (`hostname.includes(...)` would accept `evilyoutube.com`) with exact-host classifier; framed iframe gets `sandbox`/`referrerPolicy`; non-allow-listed https URLs become plain links | new `src/lib/embedUrl.js`; P1a patch |
| P1e | `src/lib/learnContentService.js` `listPublishedLessonMeta` (288) | 60 s cache + in-flight de-dup (sidebar `LearnCmsSidebar.jsx:46`, `LearnLessonPage.jsx:97`, `SiteSearch.jsx:36`, `LearnCmsHome.jsx:12` each fetch the same catalogue); cleared on admin edits | new `src/lib/asyncCache.js`; `P1/P1b…patch` |
| P1f | `src/pages/student/resources/components/ResourceCard.jsx` (line 14 `isLocked`, line 61 `download=`), `src/pages/teacher/qbuilder/components/ExportControls.jsx` (lines 3, 21 PDF, 36 `window.print()`), `src/lib/backup/constants.js` (line 608), `scripts/test-disaster-recovery.mjs` (line 458) | UI honours `platform_export_policy`; new view must be registered in the disaster-recovery table accounting (the existing test fails otherwise — found and fixed in the scratch copy) | `draft-code/P1-export/…` **apply only after DB `025`** |
| P1g | new `scripts/check-learn-export-controls.mjs`, `scripts/check-build-security.mjs` | static guards for CI | P1a patch |
| P1H | `vercel.json` (whole file) | headers, caching | `draft-config/vercel.proposed.json` |
| P4 | `src/lib/learnContentService.js`: `listPublishedLessonMeta` 288, `findPublishedLessonBySyllabusCode` 305, `getPublishedLesson` 330, `listVisibleBlocks` 342; callers `LearnLessonPage.jsx:97`, `LearnBlockRenderer.jsx:211`, `SiteSearch.jsx:36`, `LearnCmsSidebar.jsx:46`, `LearnCmsHome.jsx:12` | route through RPC client (same return shapes); legacy table read only as counted fallback until `041` | new `src/lib/lessonDeliveryClient.js` (tested with mocks) |
| P5 | `src/lib/learnContentService.js:177-188` (`uploadLearnMedia` → `getPublicUrl`), `src/lib/questionBankService.js:145-158`, `LearnBlockRenderer.jsx:65`, image blocks / `ZoomableImage`, `src/components/image-viewer/imageViewerCore.js:96` (comment: "external URLs, data:, blob: returned unchanged"), `get_learn_check_items` consumers | new uploads → private bucket with `storage://` ref; renderer resolves refs to signed URLs and refreshes before expiry; **legacy public URLs inside private-mode lessons are rewritten server-side** | new `src/lib/resolveStorageRefs.js` (tested); wiring into the renderer/upload functions is **not drafted** — needs Student-facing visual verification on staging first |
| P6 | per-engine, see §9 | none now; decisions first | — |
| P7 | `src/lib/backup/exportContent.js:184`, `src/lib/backup/disasterExport.js:641` (download sinks), `src/pages/admin/backup/AdminBackupRestore.jsx`, `src/pages/admin/AdminLayout.jsx`, `src/components/auth/ProtectedRoute.jsx`, `src/pages/admin/settings` | optional encrypted export; admin MFA enrolment/step-up UI | new `src/lib/backupCrypto.js` (AES-256-GCM, PBKDF2-600k; tested); MFA UI not drafted |
| P8 | auth/sign-up page (`AuthPage.jsx`), `StudentProfilePage.jsx`, `TeacherProfilePage` | teacher fields UI | **not drafted: field list is an OPEN QUESTION** |

Not modified, intentionally: `src/router.jsx` (an optional lazy-load of admin routes would shrink the public bundle but does **not** make admin code confidential; skipped), `supabase/` (the existing SQL in the repo stays as history; new drafts live only here).

---

## 4. SQL migrations required (requested item 2)

All files are in `docs/security-plan/sql/`. They are **idempotent** (applied twice on local PG16: no error), each has a `_rollback.sql`, and a complete apply → test → rollback chain was run on the local stub (27 assertions pass; the post-rollback ACL set equals the pre-state, order-insensitively). **Re-run everything on staging that is a restored copy of production before trusting it.**

| File | Phase | What it does | Depends on | Risk |
|---|---|---|---|---|
| `00_preflight_readonly.sql` | P0 | Q01–Q33 read-only: RLS, row counts, content md5 fingerprints, role distribution, buckets, 206+11 object inventory, MIME, storage policies, a **map of every media reference** (lesson blocks, questions, manual check-question stimulus/options), grants, policies, definer-function ACL/owner/search_path/bodies, triggers, default ACLs, anon exposure tests (each in a rolled-back transaction), admin MFA coverage, external `<img>` hosts (Q33) | – | none |
| `010_baseline_live_functions.TEMPLATE.sql` | P0 | Procedure to paste the 5 unseen live function bodies into version control before they are altered | P0 | none (not runnable) |
| `019_secplan_support` | P2 | `secplan` schema: ACL / policy / function-definition snapshots + restore functions → **data-driven rollback** | – | low |
| `020_grants_hardening` | P2 | Revoke EXECUTE on public SECURITY DEFINER functions from PUBLIC/anon (allow-list: `is_admin`, `is_teacher_or_admin`); re-grant `authenticated` only where it had it; trigger functions not API-callable; revoke table privileges from anon except `platform_settings_public` | 019, P0 outputs | **medium**: breaks any page that silently depended on an anon grant |
| `021_profiles_guard` | P2 | `BEFORE UPDATE` trigger: role/status can change only via admin; INSERT on `profiles` revoked from API roles | 019 | medium: `handle_new_user` path must still work (staging test T2.8 **[API]**) |
| `022_question_media_listing` | P2 | Drop anonymous LIST of `question-media`, admin-only listing, 5 MB + image-MIME bucket limits | 019 | low–medium. **Untested claim**: public URLs keep working after the SELECT policy is dropped (true for public buckets in Supabase's documented model; must be confirmed HTTP 200 before/after on staging, T2.9) |
| `025_export_controls_settings` | P2/P1f | `allow_resource_downloads`, `allow_teacher_exports` on `platform_settings` (default true = today); view `platform_export_policy`; `resource_downloads_enabled()` | – | low |
| `030_entitlements` | P3 | audit log; `learn_pages.access_tier` (`public/free/premium`, default `free`) and `audience_scope`; `entitlements`, `organizations`, members, org entitlements; `current_tier()`, `has_entitlement()`, `can_read_lesson()`; admin-only grant/revoke RPCs; bridge trigger from the existing `user_access` table | 019 | medium |
| `032_resources_entitlement_policies` | P3 | resources SELECT + storage policy use tiers/orgs; teacher role alone gets no premium and no school-specific file; respects the admin download switch | 025, 030 | medium |
| `040_lesson_delivery` | P4 | `security_limits`, `security_limit()`, `content_access_log` (user_id, page_id, kind, at only), `security_events`, `list_lesson_catalog`, `get_lesson_page` (paged), rate-limit check, pruning, admin summary; replaces the two `can_access_*` helper bodies (old bodies snapshotted) | 030 | **high** until clients use it; additive |
| `041_lesson_table_lockdown` | P4 | Drop non-admin SELECT policies on `learn_pages`, `learn_blocks`, `learn_check_questions`, `learn_manual_questions` (aborts if more than the expected one policy exists) | 040 + **client deployed + fallback counter = 0** | **high / the point of no easy return for old clients** |
| `050_private_media` | P5 | `media_mode`, private buckets `learn-media-private` / `question-media-private`, `can_read_media_path()`, storage policies, server-side `rewrite_media_refs()`, `admin_set_lesson_media_mode()` (refuses if copies are missing) | 030, 040 | **high** |
| `060_simulation_data_services` | P6 | empty `simulation_datasets` / `simulation_challenge_keys`, tier-checked + rate-limited `get_simulation_dataset`, `check_simulation_answer` | 030, 040 | medium (only when used) |
| `070_admin_hardening` | P7 | `is_admin()` with optional AAL2 via a flag row (`require_admin_mfa`), audit trigger on privileged profile changes, `admin_log_event` | 019, 030, 040 (`security_limits`) | **medium: can lock admins out → flag-row switch + rollback tested** |
| `080_teacher_profile_metadata` | P8 | tables/RPC to store the teacher fields once defined; **no field seeded** | – | low |

Known weak points of the drafts, stated plainly: `get_lesson_page` returns `jsonb` errors (`not_available`, `rate_limited`) instead of raising, so audit rows commit — the client draft handles this but the real UI messages need design; `rewrite_media_refs` is regex-based over JSON text and must be proven against all 206+11 real references (P0 Q-map + `compare-lesson-images`); `can_read_media_path` authorises a file by the lesson id embedded in its storage path (`lessons/<page_id>/…`), **not** through a reference map; an image stored under lesson A but displayed in lesson B would be refused to B's readers if A is more restricted — the P0 reference map must count these and they are handled by copying under the displaying lesson's path or adding a reference table (DECISIONS #6). Non-lesson-path objects in `learn-media` (if any) are denied by the draft until classified.

---

## 5. Phase detail

Every phase lists: goal · changes · production risks · backups · staging tests · rollback · dependencies · what stays unprotected.

### P0 — Backups and read-only verification (DATABASE, read-only)
* **Goal:** be able to return to today's state and know the live truth before any change.
* **Do (you, not me):** (1) confirm plan/PITR in Supabase dashboard; (2) logical dump (`supabase db dump` for schema + data, roles) stored encrypted outside the project; (3) export storage: all 206 `learn-media` + 11 `question-media` objects with SHA-256 manifest (use `copy-media-to-private.mjs` in dry-run to produce the list, or `supabase` CLI); (4) **restore drill into a separate Supabase project** — a backup that was never restored is not a backup; (5) run `00_preflight_readonly.sql` Q01–Q33 and save the outputs (they become the "before" evidence); (6) paste the 5 unseen function bodies into `010_baseline…`; (7) take an app-level backup with the existing Admin → Backup export (this is the one the repo's own restore RPC understands).
* **Tests:** restore drill passes; row counts + md5 fingerprints (Q03/Q04) equal between production and the restored copy; the 217-object inventory equals the manifest.
* **Rollback:** n/a (read-only).
* **What stays unprotected:** n/a.

### P1 — Low-risk local application changes (LOCAL-APP) — *can be applied after your explicit approval, separately from any DB change*
* **Changes:** §3 rows P1a–P1g.
* **Evidence (scratch copy, VERIFIED-REPO):** build succeeds, 0 `.map`; `npm audit --omit=dev` 0; new sanitiser blocks 21 hostile payloads (script, event handlers, svg/math/mXSS shapes, `javascript:` incl. entity-obfuscated, `data:` hrefs, iframe/srcdoc/object/embed, forms/buttons with `formaction`, `<style>`, `expression()`, full-page fixed overlay via style, remote `background-image`, meta refresh, `<base>`) **and** round-trips the Rich Text editor's output (font-size/family, colour, background, text-align, margin-left, lists, tables, links, images) — 30/30; existing `test-rich-text-selection`, `test-rich-text-ops`, `test-scientific-rendering` still pass; full `npm test` passes.
* **Production risks:** (1) a lesson that relied on a now-forbidden tag/style (e.g. author pasted `position:absolute` in a style) would render differently — mitigate by diffing sanitised vs stored HTML for every lesson block on staging (script idea: run `sanitizeHtml` over the exported backup JSON and list blocks whose output differs); (2) `dompurify` and `vite` minor bumps; (3) the video allow-list turns an unrecognised host into a link instead of an iframe; scan existing video blocks first (Q-map of `block_type='video'`).
* **Backups:** git tag/copy of the repo and a production build artefact before deploying.
* **Staging test plan:** `npm test`; `npm run build`; `node scripts/check-build-security.mjs dist`; open 10 representative lessons (text-heavy, equations, tables, video, images, check questions) before/after and compare screenshots; open Rich Text editor, apply every toolbar format, save, reload.
* **Rollback:** revert the patch (each is self-contained; `git apply -R`), redeploy previous build; Vercel instant rollback to the previous deployment.
* **Depends on:** nothing (except P1f needing DB `025` first).
* **What stays unprotected:** everything in the bundle. Source maps off ≠ confidential: minified JS, data tables, and engine logic remain downloadable by any visitor. The sanitiser is defence-in-depth for admin-authored HTML, not copy protection.

### P1H — Security headers and CSP (DEPLOYMENT)
* **Proposed:** `draft-config/vercel.proposed.json` — HSTS (decision on `includeSubDomains`), `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera/mic/geolocation/payment off), `X-Frame-Options: DENY`, COOP `same-origin`, immutable cache on hashed `/assets`, `no-cache` on `index.html`, and **`Content-Security-Policy-Report-Only`** (origins derived from the code — see its README).
* **Risks:** the CSP is Report-Only so it cannot break pages; the *other* headers can (a framed embed of e-Lab elsewhere would break under `X-Frame-Options`; `Permissions-Policy` could disable a feature if any page uses the mic/camera — grep found none, but verify). `style-src 'unsafe-inline'` is required by React inline styles and lesson rich text: that is a real weakness of this CSP.
* **Tests (staging/preview deployment):** `curl -sI` each header; click through all route types with the console open and record CSP violations; test YouTube/Vimeo embeds, 3D (three/troika) pages (the bundle references `cdn.jsdelivr.net` for troika font data and uses blob workers), Google Fonts, Supabase REST/realtime.
* **Rollback:** restore previous `vercel.json`, redeploy (or Vercel instant rollback).
* **Unprotected:** headers do not protect content from authorised or anonymous copying.

### P2 — Database hardening (DATABASE; risk medium)
* **Order:** 019 → run P0 Q11/Q14 review → 020 → 021 → 022 → 025.
* **Production risks:** (1) revoking anon EXECUTE or table grants breaks any feature that used them — mitigate by the Q29/Q11 evidence and an **anon route sweep** on staging; (2) trigger-function revocation: on Supabase, `handle_new_user` fires as the table trigger — I believe EXECUTE is not re-checked at fire time but **this is a staging test, not an assumption** (T2.8); (3) the `profiles` guard could block an existing legitimate path (registration, admin role change via `admin_update_profile_role_status` whose body is unseen) — hence the capture in P0; (4) `022` bucket limits could reject a legitimate upload.
* **Backups:** P0 set + `secplan` snapshots (automatic inside 019/020/021/022).
* **Staging tests:** `tests/staging_acceptance_tests.sql` §P2 (T2.1–T2.7, local-stub pass) + **[API]** T2.8 signup, T2.9 a question-media public URL returns 200 before and after, anon `rest/v1/rpc/*` calls to each former-public function return 401/403, existing admin flows (role change, publish, backup export) work.
* **Rollback:** `022…`, `021…`, `020…` rollback files in reverse order (restore from snapshots); local chain verified.
* **Depends on:** P0.
* **Unprotected:** published lesson tables still readable by every signed-in user until P4/`041`.

### P3 — Entitlement model (DATABASE; risk medium)
* **Design (one server-enforced approach):** `current_tier()` ∈ `anon | inactive | free | premium | school | admin`, computed **per call** from `entitlements` rows (`starts_at`, `expires_at`, `revoked_at`, `status`) and organisation membership; never from JWT `user_metadata` (tested T3.12), never from a frontend variable. Expiry/revocation therefore take effect on the next request, including storage (T3.9, T3.10). Free = registered, active. An expired premium falls back to `free` (T3.2). Scheduled-future premium is not active (T3.3 — **the existing, unapplied `supabase/resources-premium-enforcement-migration.sql` would treat a future-dated plan as active; flagged, not copied**). Suspended = `inactive` = reads nothing. Teachers: `free` unless an entitlement or organisation membership grants more (T3.5, T3.14). Payment collection is not built; `admin_grant_entitlement` is the only writer (admin-only, audited).
* **Bridge:** a trigger mirrors the existing `user_access` rows into `entitlements` so current admin screens keep working; backfill is included.
* **Risks:** wrong default for `learn_pages.access_tier` — default `free` preserves today's "any signed-in user can read published lessons"; the *content decision* of which lessons are public/premium is yours (DECISIONS). Organisation model is minimal (no billing, no seat counts).
* **Tests:** T3.1–T3.20 (local pass); **[API]** a real test user whose `user_metadata.plan='premium'` stays `free`.
* **Rollback:** `032…`, `030…` (CASCADE drops new objects; the audit log is kept).
* **Unprotected:** a Premium subscriber can still save what they view.

### P4 — Lesson delivery, lockdown and rate limiting (DATABASE + LOCAL-APP; risk high)
* **What the server checks on every `get_lesson_page` call, in order:** valid session (anon only for `public` tier) → active account → published → tier/expiry → audience (teacher-only lessons) → SL/HL rule (same meaning as today: `role<>'student' or level='HL' or lesson.level<>'HL'`) → per-account rate limit → block-level HL filter. Returns one lesson's visible blocks (max 400 per call, paged with `has_more/next_offset`), never created_by, drafts or admin-only rows.
* **Closing the direct path (the part the brief insists on):** `041` removes the broad SELECT policies on the four lesson tables, leaving admin-only policies. Rollout: deploy 040 → deploy the new client (fallback counter instrumented) → watch the counter for N days → apply 041. **An RPC without 041 is not protection.**
* **Pagination / rate limiting (privacy-minimal):** `content_access_log` holds only `(user_id, page_id, kind, at)` — no IP, user-agent, e-mail or content; pruned at 30 days. Thresholds are rows in `security_limits`, **proposals not measurements**: 20 lesson calls/min, soft audit event at 40 distinct lessons/hour, hard refusal at 80/hour or 200/day. A student reading a lesson per few minutes never gets near these; an extraction script pulling hundreds does. Over-limit returns `{ok:false,error:"rate_limited"}` (so the event row commits). The UI already works with the cached catalogue (P1e), so normal navigation adds few calls. **Calibrate against `content_access_log` after two weeks in "soft only" mode before enabling hard limits.**
* **Anonymous reads cannot be limited per account**; so keep the `public` tier small (demo lessons only) and rate-limit at the edge if needed (Vercel/Supabase plan limits: OPEN QUESTION).
* **Account suspension** is enforced server-side (`is_active_account()` inside the RPC and the helper policies), not by the UI.
* **Production risks:** (1) old cached clients keep calling the tables → after 041 they get empty lists (fail closed); mitigate with the fallback counter and a short grace period; (2) `can_access_learn_*` replacement must preserve the exact SL/HL semantics (tests T4.x pass locally; compare on staging with real SL and HL accounts across every lesson); (3) Supabase RPC cold-start/latency for a 400-block page — measure; (4) manual check-question images in `learn_manual_questions.stimulus/options` need the same rewriting inside `get_learn_check_items` (P5); (5) rate-limit false positives for a whole class behind one school (limits are per account, not per IP, deliberately); (6) JSON-returned errors (not exceptions) hide failures from naïve monitoring — watch `security_events`.
* **Backups:** P0 + `secplan` policy snapshot before 041.
* **Staging tests:** `tests/…` §P4 (local pass) + **[API]** T4.15 PostgREST call of `get_lesson_page` as a free user for a premium id → 200 body `ok:false`; direct `GET /rest/v1/learn_blocks` as a free user → 0 rows / 401 after 041; **full lesson regression**: every one of the lessons loads via the new path, block count and order identical to the pre-change dump (use Q03/Q04 md5 and a per-lesson block count comparison); SL account vs HL account matrices; teacher account; suspended account; a scripted 100-lesson crawl as a premium test user trips the soft event then the hard limit; admin editor (create/edit/reorder/publish) unaffected.
* **Rollback:** `041_…_rollback` restores policies from the snapshot (instant); `040_…_rollback` drops the new functions and restores the old helper bodies. App rollback via Vercel; fallback code path means the previous client still works until 041.
* **Depends on:** P3.
* **Unprotected:** a legitimate Premium user sees every block of lessons they open, so can screenshot/copy; a slow human-speed scraper staying under limits is constrained but not stopped.

### P5 — Private media (STORAGE + DATABASE + LOCAL-APP; risk high)
* **Inventory first (P0 Q-map):** 206 `learn-media` + 11 `question-media` objects, plus every external reference. **Classification** (your decision, DECISIONS): each object is `demo/public` (stay in the public bucket, URL unchanged) or `protected` (goes private). Default for ambiguity is *protected*.
* **Mechanics:** (1) create private buckets (`050`); (2) `copy-media-to-private.mjs` copies — **never moves** — every protected object with identical path, verifying SHA-256 of the copy against the source (dry-run default; secrets only via env at run time; I did not run it); (3) `media_mode` per lesson: `public` (today) → `private`; (4) when a lesson is switched, the server rewrites public URLs in the *returned* JSON to `storage://learn-media-private/<path>`; stored block JSON is untouched (so rollback is a switch flip); (5) the client resolves refs with `createSignedUrls` for a short TTL (default 600 s, refreshed 60 s before expiry); the storage SELECT policy calls `can_read_media_path`, which re-checks lesson access **and** expiry on every sign — so an expired Premium user cannot sign new URLs; (6) listing is impossible for non-admins; (7) new admin uploads go to the private bucket (code change in `uploadLearnMedia` / question upload — not drafted).
* **Before/after proof:** `compare-lesson-images.mjs` takes pairs (public URL before, resolved URL after) for every image, compares HTTP status, content type and SHA-256; plus screenshot diff of sample lessons. Zero differences required.
* **Public copies:** deleted **only** after (a) all lessons are in private mode and verified, (b) a soak period with no 404s in logs, (c) your explicit written approval. Until then the old public URLs still work — which means **until deletion, the media is still publicly retrievable by anyone who has the old URL**; the old URLs remain in already-exported backups, browser caches, and any copies people made.
* **Production risks:** (1) signed-URL generation latency for pages with many images (batch via `createSignedUrls`; pre-sign above the fold); (2) browser/Service-worker caching: a signed URL cached beyond TTL is fine, but a missing refresh would show broken images in long reading sessions; (3) image viewer / zoom / PDF-print paths that read `src` directly; (4) any place (emails, exports, question papers) that embeds the old public URL; the Q-map must find them; (5) Supabase Storage rate limits for signing; (6) the claim "`createSignedUrl` needs SELECT permission for the caller on the object" is from Supabase's documented behaviour but **not verified here** — T5.8 [API] is the proof; (7) media shared across lessons (see §4 note and DECISIONS #6).
* **Backups:** the P0 object manifest and copies; DB snapshot of `learn_pages.media_mode`.
* **Rollback:** `admin_set_lesson_media_mode(page,'public')` per lesson (instant), `050_…_rollback` drops policies/functions and buckets only if empty; public originals are still there.
* **Depends on:** P3, P4 (the server rewrite hooks into the lesson RPC).
* **Unprotected:** an entitled user can still right-click/save or screenshot any displayed image; short-lived URLs only stop unauthenticated, expired or bulk-listing access.

### P6 — Simulations (LOCAL-APP + DATABASE; decision-heavy)
See §9. Nothing is moved until you decide which engines are free demos and which datasets are proprietary. The honest result: **engine logic and static datasets ship in JS bundles that anyone who can load the page can download**; only data that is *not needed to render* can be withheld, and only server-side grading/solutions can stay secret.

### P7 — Admin hardening (DATABASE + LOCAL-APP; risk medium)
* **Admin authorisation independent of JavaScript visibility:** every admin write already goes through RLS/`is_admin()` or RPC; P7 verifies this exhaustively (P0 Q-grants + a script that, as a non-admin test user, calls every `rpc` and table write the admin screens use, and expects denial) and fixes `admin_update_profile_role_status` etc. once their bodies are captured.
* **MFA:** `is_admin()` gains `aal2` requirement behind a flag row `require_admin_mfa` in `security_limits` (row **absent = off**, which is today's behaviour); sequence: enrol TOTP for every admin (Q-MFA coverage query), test, insert the row to enforce; deleting the row reverts. Risk: an admin without a factor is locked out of all admin features — keep a second admin enrolled and tested, plus dashboard/SQL access as break-glass.
* **Audit:** triggers log role/status changes and entitlement grants (`admin_audit_log`), `admin_log_event` for client-reported actions (labelled client-reported: not tamper-proof).
* **Backups/exports:** keep Admin Backup & Restore; add optional passphrase-encrypted exports (draft `backupCrypto.js`), restrict restore to admin+AAL2, and test the restore path on staging. Unauthorised modification/deletion of lessons is bounded by `is_admin()`; recovery relies on tested backups (P0) and the content md5 fingerprints.
* **Tests:** T7.x (local pass) + **[API]** MFA flows on staging (not exercised locally: stub has no `auth.mfa_factors`).
* **Rollback:** `delete from public.security_limits where key='require_admin_mfa'` (instant), then `070…_rollback`.
* **Unprotected:** a compromised admin with a valid AAL2 session can still do anything admins can; backups are only as safe as where they are stored.

### P8 — Teacher registration and role audit (DATABASE + LOCAL-APP)
Registration stays open for Student and Teacher, no manual approval for ordinary teacher features, school or personal e-mail allowed, multiple concurrent sessions allowed (nothing built for sessions/devices).
**Audit of every `role='teacher'` privilege found in the repo (VERIFIED-REPO) — live-only objects are flagged for P0:**

| Where | Current effect for `teacher` | Verdict / action |
|---|---|---|
| `supabase/resources-migration.sql:119-126` policy "Teachers can read published teacher resources" | reads published resources with audience `teacher`/`both` | keep for **free** teacher resources; `032` makes premium or school-specific resources require an entitlement/org (T3.18, T3.19) |
| `supabase/migrations/learn_sl_hl_access_and_flow_incremental.sql` lines ~40-48, 70, 103, 157 (`p.role <> 'student' or …`) | teachers see **HL** lessons and HL check items (a *level* rule, not a tier) | keep (existing SL/HL rule preserved, T3.14) — but a teacher must not read `premium` lessons unless entitled |
| `supabase/migrations/learn_content_cms.sql` header (line 38) and live `is_teacher_or_admin()` | body not in repo | **P0:** read the live body and every policy/function that calls it (Q-function bodies, Q-policies) |
| `questions` read policies (live), Question Bank → Question Paper Builder | teachers can build papers/exports from question data | **P0:** list live policies; the QBuilder export is a *legitimate approved export*, controlled by the `allow_teacher_exports` UI switch (UI only: the PDF/Word are generated in the browser from data the teacher is allowed to read) |
| `supabase/resources-premium-enforcement-migration.sql` (unapplied) | uses `user_access.effective_plan`, not role | consistent with the entitlement model; fix the future-dated-plan bug when folded into `030/032` |
| Frontend `ProtectedRoute role="teacher"`, `router.jsx` 177–194 | UI gating only | acceptable only because server-side enforcement exists; verify P0 |
| `registration-enforcement-migration.sql:44` | teacher registration toggle `allow_teacher_registration` | unchanged (registration open) |

**Rule enforced by design:** `role='teacher'` is a *label*, never an entitlement. Tests T3.5, T3.14, T3.18 prove a teacher without an entitlement/organisation reads no premium lesson and no school-specific resource.
**OPEN QUESTION (not invented):** the "previously agreed required school name and dropdown professional fields" are **not in the repo, the spec or the audit** (`profiles` has `school`; no dropdown definitions found). `080` therefore creates empty `teacher_field_definitions/options`, a `teacher_profiles` table with `school_name` required, and a validating RPC; once you supply the fields they are data rows, not a redesign. Free-text fields are length-limited and rendered as text, never HTML.
**Risk of the optional `auth.users` trigger** (commented in `080`): a failing trigger blocks all sign-ups — the safe default is to save teacher metadata from the app after sign-up via the RPC.
**Rollback:** `080…_rollback` (drops new tables; `profiles` untouched).

### P9 — Final verification and CSP enforcement (DEPLOYMENT)
Checklist and commands (all drafted, none run against live):
1. `npm ci && npm audit --omit=dev` → 0 (verified in scratch copy); `npm audit` → only dev-only items, justified.
2. `npm test` (existing 25 suites + `test:security`); `npm run build`; `node scripts/check-build-security.mjs dist` → no maps, no `sourceMappingURL`, no secrets/non-frontend files; list non-asset files in `dist` for review (currently branding/simulation PNGs and two `.gitkeep`).
3. CSP: Report-Only for ≥ 1–2 weeks of real traffic, fix legitimate violations, then rename the header to `Content-Security-Policy` and add `frame-ancestors 'none'`; keep a one-line revert.
4. SQL verification: re-run `00_preflight_readonly.sql` and diff against P0 outputs; confirm anon exposure queries (Q29) return 0 / denied; `tests/staging_acceptance_tests.sql` on staging; Q-grants diff equals the intended diff only.
5. Lesson regression: every lesson via `get_lesson_page` equals the pre-change snapshot; every image pair identical (`compare-lesson-images`); SL/HL/teacher/premium/free/expired/suspended/anon matrix.
6. Dashboard checklist (NOT VERIFIED): GitHub repo private + least-privilege collaborators + branch protection; Vercel "source protection"/deployment protection settings, env vars hold only `VITE_SUPABASE_URL` and the publishable key; Supabase: service-role key never in Vercel client env, JWT secret rotation not required unless exposure is suspected, Auth settings (leaked-password protection, email confirmation), MFA enabled in Auth settings.

---

## 6. Production risks (requested item 3) — consolidated, ranked

1. **Locking out students by dropping the direct SELECT path (041) before every client uses the RPC.** Mitigation: fallback counter, staged rollout, instant policy restore from snapshot.
2. **Breaking images/media in lessons during private-storage cut-over** (rewrite regex misses a reference form; signed-URL refresh bug; external consumers of old URLs). Mitigation: per-lesson `media_mode`, copy-not-move, before/after byte comparison, no deletion without approval.
3. **Admin lock-out from MFA enforcement or from `is_admin()` change.** Mitigation: flag row default off, second enrolled admin, break-glass SQL access, tested rollback.
4. **Revoking grants breaks a hidden dependency** (anon RPC, trigger function, unseen live function). Mitigation: P0 capture of live ACLs and function bodies, snapshot/restore, anon sweep, sign-up test.
5. **Rate-limit false positives / mis-set thresholds** blocking real students (classes, exam revision). Mitigation: soft-mode first, thresholds as rows, per-account (not per-IP), calibrate on logs.
6. Sanitiser/CSP changes altering existing lesson rendering (mitigated by block-level diff and report-only).
7. Dependency bumps (Vite minor, DOMPurify patch).
8. Wrong tier defaults exposing premium content by mistake or hiding free content (content decision — `access_tier` set per lesson by you).
9. Supabase plan limits (Edge Functions, RPC throughput, storage egress) unknown — OPEN QUESTION.

## 7. Backups required (requested item 4)

| Before | Required backup | How verified |
|---|---|---|
| anything | Supabase backup/PITR status recorded; **logical dump** (schema+data) stored off-platform and encrypted | restore drill into a separate project; counts + md5 fingerprints match |
| P2 | `secplan` ACL/policy/function snapshots (created by 019/020/021/022) | snapshot row counts, restore function dry-run on staging |
| P3 | table dump of `user_access`, `profiles`, `platform_settings`, `resources` | restore drill |
| P4 | `secplan` policy snapshot for the four lesson tables; exported lesson/block/question JSON (Admin → Backup) + md5 fingerprints | compare after |
| P5 | full object backup of both buckets with SHA-256 manifest, stored outside Supabase; DB copy of media-reference map | manifest equals live listing (217 objects) |
| P7 | admin backup file(s) kept encrypted; documented restore procedure | test restore on staging |
| Deploy | previous Vercel deployment retained; git tag of current repo | one-click revert tested |

Note: Supabase database backups **do not include storage object contents** (only metadata) — the media backup is separate and mandatory. (From Supabase documentation as I know it; confirm for your plan.)

## 8. Staging test plan (requested item 5)

Staging = a **restored copy of production** (separate Supabase project + Vercel preview), never production. Order of execution mirrors the phases; each phase has an exit gate. Local-stub results below are not Supabase results.

| Gate | Evidence required |
|---|---|
| Each SQL file | applies twice without error; rollback applies; post-rollback ACL/policy set equals pre-state (done locally for the chain) |
| `tests/staging_acceptance_tests.sql` | all sections PASS on staging (27 pass locally); the `[API]` steps executed by hand with real PostgREST/Storage/Auth and results recorded |
| Role/tier matrix | anon, free student SL, free student HL, premium, expired premium, scheduled premium, school-org teacher, plain teacher, suspended, admin: each tries lesson list, lesson, image, resource, dataset, direct `/rest/v1` table read, direct storage URL/list, RPCs |
| Direct-path attacks | `GET /rest/v1/learn_blocks?select=*` with a student JWT; storage `list` on each bucket; `POST /rest/v1/rpc/<each definer fn>` as anon; `PATCH /rest/v1/profiles?id=eq.<me>` `{role:'admin'}`; user-metadata plan claim |
| Scraper simulation | script requesting 100+ lessons as a premium test account: soft events logged, then refusals, then the account can read normally after the window |
| Regression | `npm test`, build, lesson-by-lesson block count/order equality, image byte equality, screenshot comparison, Question Paper Builder export, Class planner, Solve challenges, student progress retained (row counts of progress tables unchanged) |
| Performance | lesson open time and catalogue calls per navigation before/after (target: no regression; P1e reduces calls) |

## 9. Simulations — inventory and protection model (P6)

Public routes (no auth) for every engine: `/interactives/:id`, `/simulation/:id` (VERIFIED-REPO). Engines (25 under `src/engines/`, sizes are source KB): spectroscopy-studio 177 files/1.5 MB (NMR, IR, MS, Structure Investigation); hybridisation-explorer 312; intermolecular-forces 300; bonding-visualizer 260; vsepr-explorer-3d 236; mixture-separation 216; build-an-atom 168; explore-matter 160; atomic-spectra 136; gas-laws 136; ideal-gas 132; orbital-explorer 120; others 36–92.

| Item | Where it lives | Can it stay server-side? | Recommendation |
|---|---|---|---|
| Rendering, WebGL, animation loops, physics/maths engines (all engines) | browser JS bundles / lazy chunks | **No** — needed at run time, needs 60 fps and offline responsiveness | stays public/downloadable; protection = route entitlement only for UX, not security |
| Spectroscopy Studio static datasets: `ms/data/spectra.js` (14.7 KB), `molecules.js` (17.7 KB), `evidence.js`, `fragmentation.js`; `ir/data/organics.js`, `compounds.js`; `structure/data/compounds.js` (18.9 KB), `structures.js` (6.6 KB); NMR molecule models | imported as ES modules; present in chunks | **Technically yes** for datasets not needed to render the free demo, via `get_simulation_dataset` (tier-checked, rate-limited, cached in memory per session) | only if you consider them proprietary: the file headers state the values are *simulated / representative, typical literature-style numbers, not measured* — they are small and reconstructible by a competent chemist; protection value is **low**, latency/offline cost is **real**. Defer; decide per dataset (DECISIONS). |
| Structure Investigation: the unknown's identity, correct answer and marking (`structure/model/evaluate.js`, `data/compounds.js` with the 8 unknowns) | client | **Yes, for grading**: `check_simulation_answer` (exact match, reveals the answer only after an attempt) | worth doing **only if** this tab becomes graded Premium content; today everything needed to read the answer is in the bundle. Moving it means the tab needs a network round-trip per check and an offline-failure UX. |
| Solve/Challenge marking (`submit_and_mark_challenge`) | already server-side RPC (live body unseen) | already | P0: read the body; verify it does not return solutions to non-attempters |
| Learn "Check your understanding" answers | already via `get_learn_check_items` / `mark_learn_check_answers` | already | keep; ensure `041` does not break; verify correct answers are never returned before marking (live body to be read) |
| Free demo designation | n/a | n/a | **needs your list** (which engines/tabs are free demos). Default proposal: everything remains publicly runnable until you decide; no engine is gated by this plan without your list |

**Trade-offs of stronger delivery** (stated so nobody over-claims): (1) *Server-side dataset delivery* adds latency, breaks offline/poor-network classroom use, and protects only what is genuinely never sent to the browser; (2) *lazy loading / code-splitting / minification / obfuscation* make reading harder, **not impossible and not confidential**; (3) *gating the route with auth* does not stop anyone fetching the hashed chunk URLs directly if the chunk is served from the public CDN origin — to make chunks require a session you would need an authenticated asset proxy (Edge Function/serverless) which sacrifices CDN caching and costs egress; not recommended without a concrete threat; (4) *WebAssembly or a server-side compute service* would hide logic but costs real engineering and latency. **Explicitly still publicly retrievable after every phase:** all JS/CSS bundles including every engine's physics/rendering code and any dataset imported by it, the public PNGs in `public/`, any media in a public bucket you classify as demo.

## 10. Rollback plan (requested item 6)

| Layer | Mechanism | Time to revert |
|---|---|---|
| App code | each patch independent; `git apply -R`; Vercel promote previous deployment | minutes |
| Headers/CSP | revert `vercel.json`; CSP is Report-Only until P9 | minutes |
| Grants/policies | `secplan.restore_acls()` / `restore_policies()` via the `_rollback.sql` files | minutes |
| Tier model | `030/032` rollbacks (new objects only; old `user_access` untouched) | minutes |
| Lesson lockdown | `041_rollback` re-creates the dropped policies from snapshot | seconds |
| Media | `admin_set_lesson_media_mode(…,'public')`; public originals never deleted without approval | seconds per lesson |
| MFA | delete the flag row | seconds |
| Anything else | restore from P0 backup into a *new* project (never overwrite production blindly) | hours |

Rollback files were exercised on the local stub only; a Supabase rollback drill on staging is a gate before production.

## 11. Remaining limitations for browser-visible code and content (requested item 7)

* Everything the browser renders can be copied: text (select/copy, "view source" after render, DevTools), screenshots of any image/diagram/animation, screen recording, saved responses from the network panel, saved signed URLs within their TTL.
* JavaScript bundles — all simulation engines, scientific data, UI logic — are downloadable by anyone who can load a page; minification, lazy loading, obfuscation, removing source maps and CSP **do not make them confidential**.
* Signed URLs limit *who and for how long* can fetch a media file, not what an authorised viewer saves.
* Rate limits and anomaly detection constrain and reveal bulk extraction by an account; they do not stop a patient human or a determined attacker with several paid accounts.
* Watermarking (OPTIONAL, not built): an unobtrusive user attribution on premium pages/authorised exports helps trace a leak; it **does not prevent copying** and must not be described as protection.
* The public tier cannot be rate-limited per account.
* Teacher/question-paper exports generated in the browser are, by design, files in the teacher's hands.
* The CSP with `style-src 'unsafe-inline'` is weaker than a nonce-based policy (would need refactoring).
* Copyright/licensing terms and takedown processes are the legal layer for redistribution; no technical measure replaces them.

## 12. Optional / out-of-brief items (clearly separated)

OPTIONAL (can be dropped without affecting the explicit scope): user-attribution watermark; encrypted backups; static CI guards; router lazy-loading of admin; HSTS `includeSubDomains`; catalogue cache (helps rate-limit headroom); Edge-function based rate limiting (needs plan check — SQL-level limits are used instead).
