# e-Lab.school — Comprehensive Security Audit and Protection Strategy

| | |
|---|---|
| **Audit date** | 2026-11-11 |
| **Scope** | Repository `/home/claude/e-lab` (React 19 + Vite 8 + Supabase + Vercel), compared with the live-database facts supplied in `docs/SECURITY_AUDIT_SPEC.md` section 3 |
| **Mode** | **AUDIT ONLY.** No source, SQL, config, package or data file was modified. No migration was run. No request was made to the live site or to Supabase. Nothing below has been applied. |
| **Only file created in the repo** | this report. Throwaway scripts and build output are under the session scratchpad `.../scratchpad/security/` |

## How to read the labels

| Label | Meaning |
|---|---|
| **CONFIRMED (repo)** | Demonstrated from files in this repository, or from a check I ran locally (build, `npm audit`, jsdom, static SQL scan). |
| **CONFIRMED (supplied live fact)** | Follows from the live-database facts you supplied in the spec (public buckets, column grants, `handle_new_user` CASE, etc.). I treated them as given and did not re-verify them. |
| **CONDITIONAL — needs verification** | Depends on live state I could not see (grants, policies, functions, dashboard settings). A read-only query in section L is given for each. No conditional item is reported as a confirmed vulnerability. |
| **Not executed** | I did not attempt any exploit. "Exploit scenario" describes the path the evidence supports, not a result I observed. |

`profiles.role` direct modification is **not** reported as an exploit anywhere in this report, per your instruction. Alternate routes to it are investigated in D.

---

## Checks that were run, with real results

| Check | Command / method | Result |
|---|---|---|
| `npm audit` (production only) | `npm audit --omit=dev --json` (network worked) | **1 vulnerable package, rated critical: `dompurify` (transitive)**. Installed 3.4.14. Fixed in 3.4.17 (registry `latest`). 5 advisories: GHSA-cg2g-xh64-v4q7 (critical, `SAFE_FOR_TEMPLATES` bypass), GHSA-mrv2-3pqr-j5jr (high, `IN_PLACE` hook), GHSA-p98j-92pf-mc4p, GHSA-6688-9rhm-gjv2, GHSA-c6gr-qvv4-5v3f (low). |
| `npm audit` (all) | `npm audit --json` | 4 packages: `dompurify` (critical), `vite` 8.2.2 (high; direct dev dep; dev-server/`launch-editor` advisories), `undici` 8.0.0–8.12.1 (high; 8 advisories; transitive of a dev tool), `source-map-js` (high; DoS on crafted source maps; build-time). `package.json` / `package-lock.json` checksums unchanged after the run. `--fix` was not used. |
| Secret scan | `grep -rEI` for service-role, API-key, JWT, private-key, `sk_`, `AKIA`, `ghp_`, `sbp_`, `sb_secret_`, password-assignment patterns over the whole repo except `node_modules`, `dist`, lockfile | **No secret found.** Only matches are documentation/comments saying the service-role key must not be used, and test fixtures with fake passwords. No `.env` file exists in the repo (only `.env.example`, variable names `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, both empty). |
| Production build | `npx vite build --outDir <scratch>/dist` (and a second build with placeholder `VITE_*` values, because without them Rolldown dead-code-eliminates every `supabase.*` call and the bundle is unrepresentative) | Both builds succeeded (about 3 s). **0 `*.map` files. 0 `sourceMappingURL` comments** in 70 JS files. The repo's own pre-existing `dist/` also has 0 maps. Main chunk `index-*.js` 2.39 MB (placeholder-env build; 2.11 MB in the env-less build). No `eval` / `new Function` in the bundle (relevant to CSP). |
| Public-bundle content | grep of the placeholder-env build | **All admin code ships to every visitor in the main chunk** (the admin pages are eagerly imported in `router.jsx`): RPC names `admin_update_profile_role_status`, `restore_elab_content`, `restore_elab_disaster_data`, `get_admin_question_secrets`, `admin_export_question_secrets`, `bulk_import_questions`, `submit_and_mark_challenge`, `get_review_content`, `publish_learn_page` are all readable in `index-*.js`. The `SpectroscopyStudio` chunk contains the full MS / IR / NMR / structure-investigation data tables in plain text. |
| Static SQL permission analysis | `scratchpad/security/sqlscan.py` over 27 SQL files (output `sqlscan.out`) | 19 tables created in the repo, all with `enable row level security`. 21 functions, 19 of them SECURITY DEFINER. **4 tables used directly by the app (`questions`, `question_versions`, `question_papers`, `question_paper_items`), the 2 secrets tables behind them, and 3 RPCs called by the app have no DDL in the repo** (listed in C-AUTH-02). `is_teacher_or_admin` is referenced in a comment but never defined in the repo. 11 SECURITY DEFINER functions have no explicit `REVOKE ... FROM anon` in the repo. 16 of 19 definer functions use `search_path = public` (only 3 use `''`). The scan is regex-based; it cannot see drops or live state. |
| Rich-text / XSS tests | `scratchpad/security/xss-test.mjs`, jsdom, imports the real `sanitizeHtml.js`, `scientificContent.jsx`, `learnBlockRegistry.jsx` | 27 hostile payloads through 3 render sinks. **No script execution vector survived any sink** (script, `onerror`, `onload`, `javascript:` incl. entity-obfuscated, `data:` href, iframe/srcdoc, object/embed, math/noscript mXSS, meta refresh, `<base>`). **Residual after DOMPurify** (see C-APP-03): `<form action=https://...>` with inputs/button, `style="position:fixed;...z-index:99999"` full-screen overlay, `style="background-image:url(https://...)"`, remote `<img src>`, `<video src>`, inert `<svg>` / `<math>`. DOMPurify 3.4.14. The test did not include `resolveMathAnnotationsInHtml` (a pre-step in the production pipeline), and jsdom is not a browser. |
| Video embed test | `iframe-test.mjs` (real `toEmbedVideoUrl` source + React 19.2.8 in jsdom) | `toEmbedVideoUrl` passes any non-YouTube/Vimeo URL through unchanged, including `javascript:` and `data:`. React 19 rewrites a `javascript:` iframe `src` into a throwing stub (verified), so that specific vector is neutralised by the framework. An arbitrary `https:` page is still framed with `sandbox="allow-scripts allow-same-origin ..."`. |
| Open-redirect test | `redirect-test.mjs` (react-router 7.18.3 memory router) | `navigate("https://evil...")`, `navigate("//evil...")`, `navigate("javascript:...")` all throw "External navigation is not allowed". The `?next=` parameter on `/auth` is **not** an open redirect. |
| Route authorization inspection | manual review of `router.jsx`, `ProtectedRoute.jsx`, layouts | See section A.3. |
| `npm test`, `verify:*` scripts | **Not run.** They write screenshots / use headless Chromium in several cases and I did not want any risk of touching repo files. |
| Header, cookie, CORS, cache behaviour of the live site | **Not run.** No requests to production were permitted. Section L gives `curl -I` commands for you to run. |
| Tests for entitlement bypass / unauthorized resource access against Supabase | **Cannot be executed**: no Supabase project is reachable or configured, and no entitlement system exists yet. Read-only SQL that performs the equivalent checks as `anon` / `authenticated` inside a rolled-back transaction is provided in L. |

---

# A. Executive assessment

## A.1 Overall posture

e-Lab is **well built for a small, admin-curated teaching site, and visibly security-aware**: RLS is enabled on every table created in the repo, answer keys live in tables the client cannot read, marking of canonical questions is server-side, admin RPCs check `is_admin()` internally, the private `resources` bucket uses short signed URLs plus a storage policy, there are no secrets or source maps in the deliverable, and rich-text goes through DOMPurify. I found **no confirmed way for an anonymous or ordinary student to become admin**, and I did not report one.

It is **not yet ready for Premium/School plans or for protecting original content at scale.** Three structural gaps dominate:

1. **Teacher status is self-declared.** Signup metadata chooses `teacher`, the live trigger honours it, and teacher-gated policies key off `profiles.role = 'teacher'`. Anyone can become a "teacher" in one request.
2. **There is no content-entitlement layer.** The only enforcement of any kind on content is student SL/HL (keyed on a user-editable column) and `resources.is_locked`. `access_tier`, `user_access.plan` and `effective_plan` exist but gate nothing (the one policy that would is explicitly "DO NOT RUN" in the repo). All lessons, media and questions are readable in bulk by any free account; 217 media files are permanent public URLs.
3. **The repository no longer describes the database.** The live protections (column grants, the CASE in `handle_new_user`, `admin_update_profile_role_status`, `is_teacher_or_admin`, the whole question-bank schema) are not in the repo, while the repo's own `schema.sql` contains an insecure trigger and an unrestricted profile INSERT policy. A rebuild or accidental re-run of repo SQL would regress to self-service admin.

## A.2 Highest-priority risks (ordered)

| Rank | ID | Severity | Status | One-line summary |
|---|---|---|---|---|
| 1 | C-AUTH-01 | High | CONFIRMED (supplied live fact + repo) | Any signup can choose `teacher` and immediately receives teacher-gated resources, paper tables and `/teacher` UI. |
| 2 | C-AUTH-02 | High | CONFIRMED (repo drift) | Repo SQL would recreate self-registration as `admin` if used for rebuild/DR; live protections are undocumented in the repo. |
| 3 | C-AUTH-04 | High | CONFIRMED (no MFA code in repo); live MFA state unverified | Admin has no MFA / step-up; one stolen admin session can export every student's PII and every answer key (unencrypted ZIP) and overwrite roles. Admin UI code is also shipped to all visitors. |
| 4 | C-CNT-01 | High (for IP / premium) | CONFIRMED (repo SQL + code) | Any free account can bulk-extract all published lessons, the entire published question bank, and (via marking) correct answers + explanations. No rate limiting. |
| 5 | C-AUTH-03 | Medium–High | CONDITIONAL | Three RPCs called by the app (`admin_update_profile_role_status`, `submit_and_mark_challenge`, `get_review_content`) plus `is_teacher_or_admin` / `maybe_create_question_version` are SECURITY DEFINER code I cannot see. These are the most likely alternate routes to privilege change or answer leakage. |
| 6 | C-STO-01 / 02 | Medium (High once Premium exists) | CONFIRMED (supplied live fact + repo) | `question-media` bucket is enumerable by anyone with the publishable key; `learn-media` URLs are permanent, non-revocable bearer links. |
| 7 | C-AUTH-05 / 06 | Medium | CONFIRMED (repo + supplied grants) | Suspension is client-side only; SL/HL content gating depends on `profiles.level`, which every user may edit. |
| 8 | C-APP-01 / 02 | Medium | CONFIRMED (npm audit / vercel.json) | `dompurify` is used but undeclared (transitive via jsPDF) and currently flagged by `npm audit`; no security headers / CSP at all. |

## A.3 System / interaction map (as built)

```
 Browser (SPA, Vite bundle on Vercel, all JS public)
 │
 ├─ PUBLIC routes (no auth, client or server):  /, /explore*, /topics*, /interactives*, /teachers, /about,
 │     /auth, /forgot-password, /reset-password, /simulation/:id  (25 engines, all lazily-loaded static chunks)
 │
 ├─ /student/*   ── ProtectedRoute(role="student") ── UI gate only; data protected by RLS
 ├─ /teacher/*   ── ProtectedRoute(role="teacher") ── UI gate only; data protected by RLS (role='teacher' policies)
 ├─ /admin/*     ── ProtectedRoute(role="admin")   ── UI gate only; data protected by RLS + is_admin() in RPCs
 │
 └─ supabase-js (publishable key, session in localStorage, autoRefresh, detectSessionInUrl)
       │
       ├─ Auth: signUp(email,pw,options.data{role,...})  ──► trigger on_auth_user_created ──► handle_new_user() ──► public.profiles
       ├─ PostgREST tables (RLS):  profiles, learning_progress, concept_attempts, user_preferences,
       │     student_challenges, challenge_questions, student_streaks, prediction_*, class_plans, lesson_blocks,
       │     learn_pages, learn_blocks, learn_check_questions, learn_manual_questions, resources, user_access,
       │     platform_settings, questions, question_versions, question_papers, question_paper_items (last 4 + versions: DDL not in repo)
       ├─ Views: user_access_overview (security_invoker), platform_settings_public (owner-rights, anon+auth, curated)
       ├─ RPC (SECURITY DEFINER): get_learn_check_items, mark_learn_check_answers, submit_and_mark_challenge*, get_review_content*,
       │     publish_learn_page, admin_save_learn_manual_question, get_admin_*_secret*, save_question_with_secrets,
       │     bulk_import_questions, classify_question_import, restore_elab_*, admin_export_question_*secrets,
       │     admin_update_profile_role_status*          (* = definition not in repo)
       └─ Storage:  learn-media (public, 206 files, admin-write) · question-media (public, 11 files, admin-write, public SELECT policy)
                    resources (private, signed URL 10 min, storage policy on published/unlocked/audience)

 Static files on Vercel:  /assets/*.js (no source maps)  ·  /simulations/separation/filtration/*.png  ·  /branding/*  ·  /resources/**  (empty today, see C-STO-04)
```

## A.4 Which controls are real (backend) and which are interface-only

| Control | Where enforced | Verdict |
|---|---|---|
| Admin-only writes to Learn tables, resources, platform settings, user_access | RLS `is_admin()` + definer RPC checks | **Backend** |
| Admin-only access to answer keys (`question_secrets`, `learn_manual_question_secrets`) | table privileges revoked; definer RPCs | **Backend** |
| Per-user own-row access to progress, challenges, preferences, plans | RLS `auth.uid() = user_id` | **Backend** |
| Canonical question marking | `submit_and_mark_challenge` (definition not in repo) | **Backend** (CONDITIONAL on its body) |
| Learn check marking | `mark_learn_check_answers` | **Backend** (but see C-CNT-02) |
| Student SL/HL visibility of lessons / blocks / checks | RLS + definer RPC (`learn_sl_hl_access_and_flow_incremental.sql`) | **Backend**, but keyed to an editable column (C-AUTH-06) |
| Resource file access (published, unlocked, audience) | `storage.objects` policy | **Backend** |
| `profiles.role/status/email` immutability for users | live column grants (supplied fact) | **Backend** (not in repo) |
| Route guards `/student` `/teacher` `/admin` | `ProtectedRoute.jsx` | **Interface only** (they protect rendering; data safety rests on RLS) |
| Account suspension | `ProtectedRoute.jsx:25-28,73-79` calls `signOut()` | **Interface only** (C-AUTH-05) |
| Maintenance mode | `ProtectedRoute.jsx:100` | **Interface only** (acceptable; document it) |
| "Registration unavailable" | `AuthPage.jsx` UI; `registration-enforcement-migration.sql` trigger is **optional, not shown applied** | Interface only unless trigger applied |
| Teacher mode / Student mode toggle in simulations | `localStorage["e-lab:mode"]`, `ModeToggle` available to anyone | **Interface only**, not a security boundary (C-CNT-05) |
| Premium label / `access_tier` / lock icon | none | **Cosmetic** except `is_locked` file downloads |
| Challenge focus-violation counting | client | Interface only (integrity, not confidentiality) |

---

# B. Verified protections (preserve these)

| # | Protection | Evidence |
|---|---|---|
| B1 | No secrets in the repo; the client uses only the publishable key; `.env*` is git-ignored; the service-role key is never referenced by code. | secret scan; `src/lib/supabaseClient.js`; `.gitignore` |
| B2 | Production build has **no source maps** and no `sourceMappingURL`. Keep `build.sourcemap` unset/false. | build check, 0 `.map` |
| B3 | RLS enabled on all 19 tables created in the repo; user-owned tables use `auth.uid() = user_id` for select/insert/update with `with check`. | `sqlscan.out` |
| B4 | Answer keys are structurally separated: `question_secrets`, `question_version_secrets`, `learn_manual_question_secrets`; `REVOKE ALL ... FROM anon, authenticated` on the manual-secrets table; access only through admin definer RPCs. Student Solve and Q Builder read `questions` only and set `correctAnswer: null`. | `learn_content_cms.sql:~370`, `canonicalQuestions.js:45-52`, `supabaseQuestions.js:45-52` |
| B5 | Server-side marking for canonical challenges: the client explicitly never computes `is_correct` or the score for canonical questions. | `challengeService.js` `submitChallenge` |
| B6 | Every privileged RPC starts with `if not public.is_admin() then raise exception`. Newer RPCs also `REVOKE ... FROM public, anon`. `save_question_with_secrets`, `classify_question_import`, `bulk_import_questions` use `search_path = ''`. | SQL |
| B7 | `user_access_overview` is created `security_invoker = true`, so it cannot bypass RLS; `platform_settings_public` is a deliberate curated owner-rights view with an explicit column list. | `admin-access-migration.sql`, `admin-settings-migration.sql` |
| B8 | Level (SL/HL) filtering is enforced in RLS and again inside the definer RPCs, not only in the UI. | `learn_sl_hl_access_and_flow_incremental.sql` |
| B9 | `resources` bucket is private; files are opened with 10-minute signed URLs generated on demand; a storage-layer policy checks published / unlocked / audience; uploaded names are server-generated UUIDs; MIME and 25 MB limits are checked. | `resourceService.js`, `resources-migration.sql:154-170` |
| B10 | Learn media upload: MIME allow-list excludes SVG and HTML; 8 MB / 100 MB limits (also configured on the bucket); filename is a random UUID with a sanitised extension. | `learnContentService.js:168-188`, bucket `allowed_mime_types` |
| B11 | Rich text: DOMPurify is applied after math rendering, and the production Learn sink survived all 27 hostile payloads with no script execution (see checks table). Other `dangerouslySetInnerHTML` sinks escape `& < >` first (`renderChemMarkup`, `renderScientificText`); tested with the same payloads, zero residuals. Calculator uses a non-`eval` evaluator. No `eval`/`new Function` in the bundle. | xss-test, bundle grep |
| B12 | React 19 neutralises `javascript:` URLs in `href`/`src`; verified for an iframe `src`. | iframe-test |
| B13 | `?next=` on sign-in cannot redirect off-site (router rejects external navigation). | redirect-test |
| B14 | External windows open with `noopener,noreferrer`. | `useVisibleResources.js:59,63`, `SimulationActions.jsx` |
| B15 | Signup screen is enumeration-resistant by design (same "check your email" screen for existing addresses). | `signupFlow.js`, docs |
| B16 | Client profile edits are whitelisted to six fields and use `.update()` not `.upsert()`; the live column grants (supplied) enforce the same server-side. | `AuthContext.jsx:162-186` |
| B17 | Lockfile v3, all 259 `resolved` URLs from `registry.npmjs.org`; only 2 packages have install scripts (`core-js`, `fsevents`); no postinstall in `package.json`. | lockfile scan |
| B18 | Admin restore RPCs are atomic (single function transaction) and admin-gated; the backup UI never renders answer content. | `backup_restore_rpc_incremental.sql`, docs |
| B19 | `localStorage` use is limited to UI state, namespaced per user; sessions are standard Supabase tokens. | `userScopedStorage.js` |
| B20 | Third-party runtime origins are few and enumerable (Google Fonts, YouTube, Vimeo, plus the two CDN fetches in C-APP-10), which makes a tight CSP feasible. | bundle grep |

---

# C. Vulnerability register

Severity reflects impact on **this** site's assets (original lessons, answer keys, student PII, admin control), adjusted for exploitability. "Priority": P0 = do first, P1 = before any Premium launch, P2 = scheduled hardening, P3 = hygiene.

## Summary table

| ID | Title | Sev. | Status | Priority |
|---|---|---|---|---|
| C-AUTH-01 | Client-chosen teacher role accepted at signup | High | CONFIRMED (supplied fact + repo) | P0 |
| C-AUTH-02 | Repo SQL drift: repo can recreate admin self-registration; live protections not versioned | High | CONFIRMED (repo) | P0 |
| C-AUTH-03 | Unreviewed SECURITY DEFINER code (5 functions not in repo) | Medium–High | CONDITIONAL | P0 (verify) |
| C-AUTH-04 | Admin accounts lack MFA / step-up; admin code public; unencrypted full-PII backup | High | CONFIRMED (no code) / live MFA CONDITIONAL | P1 |
| C-AUTH-05 | Account suspension is client-side only | Medium | CONFIRMED (repo) | P1 |
| C-AUTH-06 | SL/HL content gate keyed to user-editable `profiles.level` | Medium | CONFIRMED (supplied grants + repo) | P1 |
| C-AUTH-07 | Password-change / policy settings unverified; `/reset-password` has no re-auth | Low–Medium | CONDITIONAL | P2 |
| C-AUTH-08 | Registration-closed and maintenance are UI-only; enforcement trigger optional | Low | CONFIRMED (repo) | P3 |
| C-AUTH-09 | Unrestricted profile INSERT policy and unvalidated signup metadata in repo | Low | CONFIRMED (repo) / live CONDITIONAL | P2 |
| C-STO-01 | `question-media` public SELECT policy enables bucket enumeration; guessable paths | Medium | CONFIRMED (supplied + repo) | P1 |
| C-STO-02 | `learn-media` public bearer URLs: permanent, cached, not entitlement-aware | Medium (High with Premium) | CONFIRMED (supplied + repo) | P1 |
| C-STO-03 | Upload validation gaps on `question-media` | Low | CONFIRMED (repo) | P2 |
| C-STO-04 | Resources: premium inert; metadata/paths of locked files visible; `/public/resources` convention bypasses private bucket | Medium | CONFIRMED (repo) | P1 |
| C-CNT-01 | Unthrottled bulk extraction of lessons and question bank by any free account | High | CONFIRMED (repo) | P1 |
| C-CNT-02 | `mark_learn_check_answers` returns the answer key and explanation to every caller | Medium | CONFIRMED (repo) | P1 |
| C-CNT-03 | Anonymous reachability of Learn tables depends on unverified `anon` grants | Medium | CONDITIONAL | P0 (verify) |
| C-CNT-04 | Whole published question bank sent to every browser incl. HL for SL | Low–Medium | CONFIRMED (repo) | P2 |
| C-CNT-05 | Simulations, datasets and in-sim answers are public static code; teacher mode is cosmetic | Medium (IP) | CONFIRMED (repo) | P2 |
| C-CNT-06 | No print / export controls or provenance marks on lesson content | Low | CONFIRMED (repo) | P2 |
| C-APP-01 | `dompurify` undeclared transitive dependency; `npm audit` critical | Medium | CONFIRMED | P0 |
| C-APP-02 | No security headers or CSP (`vercel.json` only rewrites) | Medium | CONFIRMED (repo) | P1 |
| C-APP-03 | Sanitiser permits forms, fixed-position styled overlays, remote images/CSS URLs | Low | CONFIRMED (test) | P2 |
| C-APP-04 | Video block frames any URL with `allow-scripts allow-same-origin`; `external_url` not scheme-validated | Low | CONFIRMED (repo/test) | P2 |
| C-APP-05 | Definer functions: `search_path = public`, EXECUTE left to `anon`, trigger functions callable | Low–Medium | CONFIRMED (repo) / live CONDITIONAL | P1 |
| C-APP-06 | Client-writable scores / completion / `is_correct` fields | Low–Medium | CONFIRMED (repo policies) | P2 |
| C-APP-07 | PostgREST filter strings built from typed search | Low | CONFIRMED (repo) | P3 |
| C-APP-08 | Raw backend error text shown to users (85 sites) | Low | CONFIRMED (repo) | P3 |
| C-APP-09 | Supply chain hygiene: no CI, no Dependabot, caret ranges | Low | CONFIRMED | P2 |
| C-APP-10 | Runtime third-party fetches (jsDelivr font data, cdnjs pdfobject) | Low | CONFIRMED (bundle) | P2 |
| C-APP-11 | No audit log for role changes, restores, exports | Medium | CONFIRMED (repo) | P1 |
| C-OPS-01 | Disaster-recovery ZIP is unencrypted and contains PII + answer keys | Medium | CONFIRMED (repo) | P1 |
| C-OPS-02 | Vercel deployment settings unverified (preview protection, env scoping) | Medium | CONDITIONAL | P1 |

---

## C-AUTH-01 — Client-chosen teacher role accepted at signup
- **Severity:** High. **Status:** CONFIRMED by supplied live facts + repo logic. Exploit not executed.
- **Files:** `src/pages/AuthPage.jsx:267-275` (sends `role` from the `?role=` query parameter), `src/context/AuthContext.jsx:104-118`, live `handle_new_user()` (supplied CASE), `supabase/resources-migration.sql:120-126` and `:154-170`, live `question_papers` / `question_paper_items` / `is_teacher_or_admin()` policies (supplied).
- **Code (repo):**
  ```js
  // AuthPage.jsx
  const metadata = { full_name: fields.fullName, role, school: ..., ... };
  await signUp({ email, password, metadata });
  ```
  ```sql
  -- live trigger (supplied)
  CASE WHEN new.raw_user_meta_data ->> 'role' IN ('student','teacher') THEN new.raw_user_meta_data ->> 'role' ELSE 'student' END
  -- resources-migration.sql
  create policy "Teachers can read published teacher resources" on public.resources for select
    using (status='published' and audience in ('teacher','both')
           and exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher'));
  ```
- **Exploit scenario:** a student (or anyone with an email address) calls `supabase.auth.signUp({email, password, options:{data:{role:'teacher'}}})` directly or uses `/auth?role=teacher`. After confirmation the profile has `role='teacher'`. They can read every published teacher-audience resource (and the signed URLs for those files via the storage policy `r.audience = p.role`), use teacher-gated paper tables, and open `/teacher/*`. `registration-enforcement-migration.sql` only toggles whether teacher registration is open; it does not vet who registers.
- **Impact:** confidentiality of teacher-only material (worksheets, answer keys, mark schemes if stored there); impersonation as a verified teacher; no basis for school licences; teacher-authored content attribution unreliable. Limited blast radius for the question bank itself, because students can already read all published `questions`.
- **Remediation:** section D (pending state, admin-only approval RPC, trigger change, backfill). Interim stop-gap before any code change: set `allow_teacher_registration = false` in Admin → Settings only if the optional enforcement trigger is confirmed applied (L-12); otherwise it is UI-only.
- **Regression risk:** Low–Medium. Existing teachers are backfilled as approved so nothing changes for them; the only user-visible change is that new teacher signups see a "pending approval" page.
- **Priority:** P0.

## C-AUTH-02 — Repo SQL drift can recreate admin self-registration
- **Severity:** High (disaster-recovery / rebuild / re-run risk, not a live exploit). **Status:** CONFIRMED (repo).
- **Files:** `supabase/schema.sql:59-85`, `:45-52`; `supabase/admin-role-migration.sql:28-30`; `supabase/registration-enforcement-migration.sql:33`; absent DDL (below).
- **Code:**
  ```sql
  -- schema.sql (repo) — differs from the live CASE
  coalesce(new.raw_user_meta_data ->> 'role', 'student'),
  ...
  create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
  create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
  -- admin-role-migration.sql widens the check constraint to include 'admin'
  ```
- **Exploit scenario:** on any database built from the repo (new Supabase project, staging, DR restore target — `docs/DISASTER_RECOVERY.md` explicitly plans one), signup with `data:{role:'admin'}` passes the trigger and the widened check constraint; the unrestricted UPDATE policy additionally lets any user set `role='admin'` on their own row because no column lockdown exists in the repo. `enforce_registration_open` does not reject `admin`.
- **Not in the repo at all (6 tables, 3 RPCs, 2 helper functions):** tables `questions`, `question_versions`, `question_papers`, `question_paper_items`, plus the `question_secrets` / `question_version_secrets` families; views as live; RPCs `admin_update_profile_role_status`, `submit_and_mark_challenge`, `get_review_content`; functions `is_teacher_or_admin`, `maybe_create_question_version`; the profiles column-grant lockdown; the live `handle_new_user` CASE; storage bucket settings for `resources`. `bulk-question-import-migration.sql` header confirms the question tables were created outside the repo.
- **Impact:** a rebuild reintroduces full privilege escalation and silently drops answer-key table protection.
- **Remediation:** capture live state with `pg_dump --schema-only` / Supabase `db dump` (read-only) into a new `supabase/baseline/` file and reconcile `schema.sql`; replace repo `handle_new_user` with the safe version (D.3); add the column grants to the repo; add a CI check that diffs live `pg_policies` / `pg_proc` against the repo (section I phase 0).
- **Regression risk:** None to production (repo documentation change), provided the baseline is not executed against live.
- **Priority:** P0.

## C-AUTH-03 — Unreviewed SECURITY DEFINER code
- **Severity:** Medium–High. **Status:** CONDITIONAL — needs verification (queries L-7, L-8, L-9).
- **Files (call sites):** `src/lib/userService.js:69`, `src/lib/challengeService.js:372`, `src/pages/student/solve/ChallengeReport.jsx` (`get_review_content`), `supabase/migrations/question_bank_disaster_recovery_rpc_incremental.sql` and `bulk-question-import-migration.sql` (`maybe_create_question_version`), `is_teacher_or_admin`.
- **What must be checked, and why it matters as an alternate route to `profiles.role` / answers:**
  | Function | Risk if wrong |
  |---|---|
  | `admin_update_profile_role_status(p_user_id, p_role, p_status)` | Must call `is_admin()`; must validate `p_role in ('student','teacher','admin')`; should refuse self-demotion of the last admin; must `REVOKE ... FROM anon`; `search_path` pinned. If the `is_admin()` check is missing, any user can promote themselves. |
  | `submit_and_mark_challenge(p_challenge_id, ...)` | Must verify `challenge.user_id = auth.uid()`; otherwise one user could submit / mark another's challenge. Must not return secrets. |
  | `get_review_content(...)` | Returns correct answers after submission. Must verify ownership **and** `status='submitted'`; otherwise a student can fetch answers for an in-progress challenge. |
  | `is_teacher_or_admin()` | Must read `profiles.role` (not `auth.jwt()->'user_metadata'`, which users can change with `auth.updateUser`). Must be `STABLE SECURITY DEFINER SET search_path`. |
  | `maybe_create_question_version(text)` | If executable by `authenticated` and not admin-checked, it creates version rows from a client-supplied id (data pollution). |
- **Other routes I specifically checked in the repo and found no problem:** no policy or function reads `user_metadata` / `app_metadata` (`grep` across `supabase/` and `src/`); `handle_new_user` fires only AFTER INSERT so a later `auth.updateUser({data:{role:'admin'}})` does not change `profiles`; no repo RPC updates `profiles` except the restore RPCs, which are admin-gated; the client's `upsertProfile` whitelist is backed by the live column grants. Whether **other live triggers** copy `raw_user_meta_data` into `profiles` on UPDATE of `auth.users` (for example an email-change sync) is unknown — query L-6.
- **Regression risk of fixing:** none for verification; fixing a function body is a normal migration.
- **Priority:** P0 (verify now; read-only).

## C-AUTH-04 — Admin accounts lack MFA / step-up; admin blast radius
- **Severity:** High. **Status:** CONFIRMED that the repo has no MFA / `aal2` code (a case-insensitive search for mfa/totp/aal2 returned only unrelated image-viewer matches); live Supabase MFA configuration is CONDITIONAL (L-16, D-2).
- **Files:** `src/context/AuthContext.jsx` (password-only `signInWithPassword`), `supabase/resources-migration.sql:16-24` (`is_admin()` checks role only, not authenticator level), `src/router.jsx:41-55,198-215` (admin pages eagerly imported, so bundled for everyone).
- **Exploit scenario:** an admin password is phished or reused → attacker signs in → `admin_export_question_secrets()` / `admin_export_question_version_secrets()` return every answer key; the Backup page exports every profile (emails, names, schools), progress and challenges; `restore_elab_disaster_data` can overwrite `profiles.role` for any user; Learn content can be replaced with phishing HTML (see C-APP-03).
- **Impact:** total compromise of content, answer keys and student data from a single credential. This is the highest-leverage account on the platform.
- **Remediation:** enable TOTP MFA for all admins; change `is_admin()` to `... and coalesce((auth.jwt() ->> 'aal'),'aal1') = 'aal2'`; keep a break-glass procedure (second admin without the requirement via dashboard). Make admin routes `React.lazy` so admin code and RPC names are not served to every visitor (reduces recon, not a security boundary). Add an `admin_audit_log` (C-APP-11) and alert on admin sign-in.
- **Regression risk:** Medium — enforcing `aal2` in `is_admin()` locks admins out until enrolled; stage as: enrol first, verify, then change function, with a tested rollback (section K).
- **Priority:** P1.

## C-AUTH-05 — Account suspension is client-side only
- **Severity:** Medium. **Status:** CONFIRMED (repo).
- **Files:** `src/components/auth/ProtectedRoute.jsx:25-28,73-79`; no policy in `supabase/` references `profiles.status`.
- **Code:** `useEffect(() => { if (isSuspended) signOut(); }, ...)` — the comment calls it "real enforcement".
- **Exploit scenario:** a suspended user keeps the access/refresh token they already hold (or signs in again with the publishable key from the console) and continues calling PostgREST/RPC directly; nothing on the server consults `status`.
- **Impact:** suspension does not stop scraping, answer retrieval or writing data. Matters for abuse handling and for school accounts.
- **Remediation:** (a) add `public.is_active_user()` (definer, `status='active'`) to the read policies of Learn / questions / resources and to the marking RPCs; (b) on suspend, call Auth Admin `ban_duration` through an Edge Function so tokens stop refreshing; (c) shorten JWT lifetime for suspected abuse.
- **Regression risk:** Medium (every policy touched); roll out per table behind a feature flag column.
- **Priority:** P1.

## C-AUTH-06 — SL/HL content gate keyed to user-editable `profiles.level`
- **Severity:** Medium. **Status:** CONFIRMED (supplied grants: `level` is user-updatable; repo policy reads `p.level`).
- **Files:** `supabase/migrations/learn_sl_hl_access_and_flow_incremental.sql:36-52, 58-82, 91-125`; `src/lib/learnLevelAccess.js`.
- **Exploit scenario:** an SL student runs `supabase.from('profiles').update({level:'HL'}).eq('id', myId)` (permitted) and then reads HL-only lessons, blocks and check items. The same pattern, applied to a paid-tier column, would be a Premium bypass.
- **Impact:** SL/HL separation is advisory. More importantly it demonstrates the design rule to fix before Premium: **never gate content on a column the user can write.**
- **Remediation:** move gating inputs to server-controlled data (an `entitlements` row or a definer function), or revoke `level` from the user-update grant and change it through an RPC that rate-limits changes (students legitimately switch course level rarely). See F.
- **Regression risk:** Low if `level` stays editable through an RPC.
- **Priority:** P1.

## C-AUTH-07 — Password-change settings and policy unverified
- **Severity:** Low–Medium. **Status:** CONDITIONAL (dashboard settings, D-1, D-4).
- **Files:** `src/pages/ResetPassword.jsx`, `src/pages/AuthPage.jsx:258` (length >= 8 only client-side), `AuthContext.jsx` `updatePassword`.
- **Details:** `/reset-password` calls `updateUser({password})` for any signed-in session without checking the recovery event or asking for the current password. Safe only if Supabase "Secure password change" is on; server-side minimum length / leaked-password protection / CAPTCHA are unknown.
- **Remediation:** enable Secure password change, leaked-password protection, server-side minimum length (>= 10 recommended), CAPTCHA on signup and recovery; gate the page on the `PASSWORD_RECOVERY` auth event.
- **Priority:** P2.

## C-AUTH-08 — Registration-closed and maintenance are interface-only
- **Severity:** Low. **Status:** CONFIRMED (repo). `registration-enforcement-migration.sql` is documented as optional and its application status is unknown; maintenance mode is a client check (`ProtectedRoute.jsx:100`). Acceptable for maintenance; for registration use L-12 to confirm the trigger and note that it also needs to reject `admin`-valued metadata when used against a repo-built database.
- **Priority:** P3.

## C-AUTH-09 — Unrestricted profile INSERT policy and unvalidated signup metadata
- **Severity:** Low. **Status:** CONFIRMED in repo; live CONDITIONAL (the supplied grant list covers UPDATE only).
- **Files:** `schema.sql:45-47`; `handle_new_user` copies `full_name`, `school`, `country`, `grade_or_class`, `curriculum`, `level` verbatim with no length or value checks (so `level` can be any string and `curriculum` anything).
- **Scenario:** if `authenticated` retains INSERT on `profiles` and a user has no row (trigger failure, deleted row), they could insert their own row with an arbitrary `role`. A normal user cannot delete their row, so this is narrow.
- **Remediation:** revoke INSERT on `profiles` from `authenticated` (query L-4); constrain trigger inputs with `left(...,200)` and `level in ('SL','HL')`.
- **Priority:** P2.

## C-STO-01 — `question-media` public SELECT enables enumeration
- **Severity:** Medium. **Status:** CONFIRMED (supplied policy `USING (bucket_id = 'question-media')` + repo `question_bank_visual_storage.sql:19-22`).
- **Exploit scenario:** with the publishable key (visible in the bundle) any visitor calls the Storage list endpoint for `question-media` and receives every object name. Object paths are `questions/{question_id}/{Date.now()}.{ext}` (`questionBankService.js:151-157`), so even without listing the names are guessable from question ids and timestamps. The 11 files are question diagrams; mark-scheme or answer images, if any are stored here, would be exposed.
- **Key technical point:** a public bucket serves `/object/public/...` URLs **without consulting `storage.objects` RLS**; the SELECT policy is only needed for *listing/downloading through the API*. Removing the public SELECT policy therefore should not break existing image URLs, while stopping enumeration. Replace it with an admin-only SELECT (the backup code uses `.download()` as admin). Verify with one public URL before/after (K).
- **Regression risk:** Low; test in staging first.
- **Priority:** P1. Proposed SQL in J.

## C-STO-02 — `learn-media` public bearer URLs
- **Severity:** Medium today; High once Premium lessons exist. **Status:** CONFIRMED (supplied: public bucket, 206 files, admin-gated writes).
- **Facts:** public URLs never expire, are not tied to a user, and are cached by the CDN (Supabase default `cache-control: max-age=3600`; changed or privatised files may keep serving from caches for up to that time, and browser-cached copies persist). Every authenticated user (and anonymous users if C-CNT-03 is true) can read all URLs because they are stored in `learn_blocks.content`. Paths are `lessons/{pageId}/{blockId}/{uuid}.{ext}` — unguessable, so the exposure is "anyone who ever saw a lesson", which is the real-world threat model (a pupil or competitor creating one free account).
- **Remediation:** F.4 (private bucket + short-lived signed URLs resolved at render time for premium lessons; keep the public bucket for demo/free content so nothing breaks; do **not** move or delete the 217 files now).
- **Priority:** P1 (design now, implement with Premium).

## C-STO-03 — Upload validation gaps on `question-media`
- **Severity:** Low. **Status:** CONFIRMED (repo). `uploadQuestionImage` (`questionBankService.js:151-161`) has no MIME or size check and uses `file.name.split(".").pop()` unsanitised; the bucket in `question_bank_visual_storage.sql` has no `allowed_mime_types` / `file_size_limit` (unlike `learn-media`). Admin-only write, so exploitation requires an admin session. Remediation: set bucket `allowed_mime_types` to PNG/JPEG/WEBP, 5 MB, and mirror `validateLearnMediaFile`.
- **Priority:** P2.

## C-STO-04 — Resources: premium inert; metadata visible; public-folder bypass
- **Severity:** Medium. **Status:** CONFIRMED (repo).
- **Details:** (1) `resources.access_tier` is metadata only; the enforcing policy exists only in `resources-premium-enforcement-migration.sql` ("DO NOT RUN THIS YET"), so premium files are readable by any signed-in user of the right audience; confirm with L-3. (2) The `resources` SELECT policies return the full row including `file_path` for locked rows (`useVisibleResources.js` hides the button, RLS does not hide the row); the storage policy still blocks the file, so impact is metadata only. (3) `src/data/student-resources.js` instructs maintainers to put files in `public/resources/...` — those are served by Vercel to **everyone, unauthenticated, permanently**. Folder currently contains only `.gitkeep`. (4) Signed URLs (600 s) are bearer tokens: anyone given the link can open the file until expiry.
- **Remediation:** apply the premium storage policy only together with a real entitlement function (F); add a CI check failing the build if `public/resources/**` contains anything except `.gitkeep`; add `download` option and per-user watermark for premium PDFs.
- **Priority:** P1.

## C-CNT-01 — Unthrottled bulk extraction by any free account
- **Severity:** High for IP and for any Premium plan. **Status:** CONFIRMED (repo).
- **Files:** `supabase/migrations/learn_content_cms.sql` + `learn_sl_hl...sql` (policies), `src/lib/learnContentService.js`, `src/lib/canonicalQuestions.js:21`, `src/pages/teacher/qbuilder/lib/supabaseQuestions.js:19`.
- **Exploit scenario:** create one account (email only, no vetting), then `from('learn_pages').select('*')` and `from('learn_blocks').select('*')` return the entire published lesson corpus in two requests; `from('questions').select('*').eq('status','published')` returns every published question including visuals and parts. Image URLs inside blocks can then be fetched without authentication. There is no per-user quota, no row cap documented, no CAPTCHA, no anomaly logging. Because HL access is user-selectable (C-AUTH-06) HL content is included.
- **Impact:** the "theft or mass extraction of original lesson material" objective cannot currently be met; Premium would be meaningless against this path.
- **Remediation:** entitlement-aware RLS (F); lesson delivery by page via RPC (`get_lesson_page`) with a rate/volume counter; PostgREST `max_rows` cap; signup CAPTCHA and email verification enforced; request logging with alerts on high volume (G, H). It cannot be made impossible for a legitimate subscriber (they can always save what they view), only made costly, attributable and revocable.
- **Regression risk:** Medium — changes read paths for Learn; implement behind a toggle, per content tier.
- **Priority:** P1.

## C-CNT-02 — `mark_learn_check_answers` discloses answers and explanations to every caller
- **Severity:** Medium. **Status:** CONFIRMED (repo).
- **Files:** `learn_sl_hl_access_and_flow_incremental.sql:207-318` (lines ~312-316: `correct_answer_data := v_correct_answer_data; explanation := v_explanation; return next;`), `get_learn_check_items` (item ids).
- **Scenario:** call `get_learn_check_items(page)` to list item ids, then `mark_learn_check_answers(page, [{item_id, source_type, student_answer: ""}...])`; the response contains `correct_answer_data` and `explanation` for every item whether or not the answer was right and with unlimited retries. Canonical check items are pinned versions of **Question Bank questions**, so the same keys serve Solve / assessment use.
- **Impact:** answer keys for formative checks are public to any account; for pinned bank questions they leak the assessment bank. May be acceptable pedagogically for "Check Your Understanding", but it should be a deliberate decision.
- **Remediation:** return `is_correct` only until the learner has answered; reveal `correct_answer_data` only after a submitted answer per item (store attempts in `concept_attempts`) or after N attempts; never pin bank questions used in Solve into Learn checks without a flag; rate-limit the RPC.
- **Priority:** P1.

## C-CNT-03 — Anonymous reachability of Learn tables depends on `anon` grants
- **Severity:** Medium. **Status:** CONDITIONAL — needs verification (L-4, L-18).
- **Reasoning:** Supabase's default privileges grant `anon` table privileges unless changed. Repo policies on `learn_pages`, `learn_blocks`, `learn_check_questions`, `learn_manual_questions` do not specify `TO authenticated`; despite names like "Anyone **authenticated** can read...", the original (pre-SL/HL) policies were `using (status = 'published')`. The SL/HL replacement requires a `profiles` row for `auth.uid()`, which makes `anon` get nothing — **if that migration is applied**. `learn_check_questions` and `learn_manual_questions` policies were never replaced and still evaluate only "page is published". Repo `GRANT`s name only `authenticated`, but REVOKE-from-anon is never issued.
- **Impact if true:** lessons readable with no account at all.
- **Remediation:** `revoke all on <table> from anon`, add `to authenticated` to policies, then rely on F.
- **Priority:** P0 to verify.

## C-CNT-04 — Whole published question bank delivered to every browser
- **Severity:** Low–Medium. **Status:** CONFIRMED (repo). The Solve and Q Builder clients select every published row and filter level in JS (`curateChallenge`), so HL questions reach SL students and all content is available to scraping. Answers are not included. Remediation: server-side `get_challenge_candidates(topic_codes, level, n)` RPC returning only the needed rows. **Priority:** P2.

## C-CNT-05 — Simulation code, datasets and in-sim answers are public static assets
- **Severity:** Medium (IP). **Status:** CONFIRMED (repo/build).
- **Facts:** `/simulation/:simulationId` (`router.jsx:128-132`) has no auth gate by design (comment in the file); `/interactives/:id` and Learn blocks reach the same chunks; all 25 engines are static, lazily-loaded JS; MS/IR/NMR/structure data tables are plain text inside the `SpectroscopyStudio` chunk; NMR "challenges" compute expected answers client-side (`nmr/molecular/model/challenges.js`); `ModeToggle` stores `teacher` in localStorage for any visitor and merely changes which `<details>` are open. No source maps (good), but minified JS is readable and data is not obfuscatable.
- **Impact:** competitor can copy engines and data from DevTools; no way to restrict Teacher-only simulation content by role. Section G gives the realistic architecture.
- **Priority:** P2 (decide per engine; most are not worth protecting server-side).

## C-CNT-06 — No print / export provenance
- **Severity:** Low. **Status:** CONFIRMED (repo): no `@media print` rules, no watermarking; teacher paper export (`pages/teacher/qbuilder/lib/export.js`) is client-side jsPDF/docx from content the teacher already holds. Not recommended to disable print (accessibility); instead add per-user footer watermark on premium exports (G). **Priority:** P2.

## C-APP-01 — `dompurify` undeclared transitive dependency, flagged by `npm audit`
- **Severity:** Medium (tool rating: critical). **Status:** CONFIRMED.
- **Files:** `src/lib/sanitizeHtml.js:1`, `package.json` (no `dompurify` entry), `npm ls dompurify` → `jspdf@4.2.1 → dompurify@3.4.14`.
- **Facts:** the only sanitiser protecting all Learn rich text is present solely because jsPDF depends on it. If jsPDF changes or drops it, the build breaks or resolves a different major. The installed version is inside five advisory ranges.
- **My exploitability assessment (reading the advisory titles, not executing exploits):** the production call is `DOMPurify.sanitize(string, {ADD_ATTR:[...]})`. The advisories concern `SAFE_FOR_TEMPLATES`, `IN_PLACE` with node-removing hooks, shadow-root output modes and `application/xhtml+xml` parsing, none of which this code uses. Real-world risk is therefore likely low, but the dependency must be fixed regardless because it is the XSS boundary, and the tooling will keep reporting it.
- **Remediation:** add `"dompurify": "^3.4.17"` to `dependencies` and reinstall; upgrade `vite` to `^8.3.8` (dev-server advisories; `npm audit` says fix available); re-run `npm audit`. The `undici` and `source-map-js` findings are dev/build-time (not shipped to browsers).
- **Regression risk:** Low; run the rich-text tests (`npm run test:rich-text-selection`, `verify:rich-text`).
- **Priority:** P0.

## C-APP-02 — No security headers or CSP
- **Severity:** Medium. **Status:** CONFIRMED (repo): `vercel.json` contains only the SPA rewrite; `index.html` has no CSP meta; `supabase/vercel.json` does not exist. (Live header values not checked; D-13 gives the `curl` commands.)
- **Impact:** clickjacking (no `frame-ancestors`), no defence-in-depth against XSS, third-party script injection or data exfil, permissive referrer, no `Permissions-Policy`.
- **Remediation:** J.4 header set; deploy CSP in Report-Only for two weeks first. Feasible because the bundle has no `eval`; needs `style-src 'unsafe-inline'` (React inline styles, Tailwind), `worker-src blob:` (three/troika), `connect-src` for Supabase + jsDelivr, `frame-src` YouTube/Vimeo.
- **Regression risk:** Medium (CSP can block a resource silently) — Report-Only first.
- **Priority:** P1.

## C-APP-03 — Sanitiser residuals in Learn rich text
- **Severity:** Low (content is admin-authored). **Status:** CONFIRMED (test, section "Checks").
- **Surviving constructs:** `<form action="https://...">` with `<input>`/`<button>`; `style="position:fixed;top:0;...;z-index:99999"` (full-page overlay, e.g. a fake "session expired — sign in" panel); `style="background-image:url(https://...)"`, `<img src="https://...">`, `<video src>` (tracking / external hotlinking); inert `<svg>` and `<math>`.
- **Scenario:** a compromised or malicious admin (or an attacker restoring a crafted backup through `restore_elab_content`, which inserts block JSON unsanitised) plants a credential-phishing form inside a trusted lesson served from the real origin.
- **Remediation:** extend `sanitizeHtml`: `FORBID_TAGS: ['form','input','button','textarea','select','style','svg','math','video','audio']`, add a DOMPurify `uponSanitizeAttribute` hook that drops `style` declarations containing `position`, `url(`, `expression(`, `behavior`, `@import`; allow images only from the Supabase storage host; add CSP `form-action 'self'`.
- **Regression risk:** Low–Medium (existing lessons that use inline `style` for fonts/colours must keep working; test on all 206-file lessons via the existing `verify:rich-text` and a corpus render).
- **Priority:** P2.

## C-APP-04 — Video embed and external-link validation
- **Severity:** Low. **Status:** CONFIRMED.
- **Files:** `LearnBlockRenderer.jsx:63-80, 452-470` (`toEmbedVideoUrl` returns any URL unchanged; iframe uses `sandbox="allow-scripts allow-same-origin allow-presentation"`); `useVisibleResources.js:62-63` / `AdminResources.jsx:73` (`window.open(resource.externalUrl)` with no scheme check).
- **Notes:** `javascript:` iframe sources are neutralised by React 19 (test); a `data:` page is cross-origin; arbitrary HTTPS framing is possible but needs admin authorship. `allow-scripts` + `allow-same-origin` is the combination that is unsafe for same-origin content, so the allow-list should be enforced, not assumed.
- **Remediation:** accept only `https:` with host in {`www.youtube.com`, `www.youtube-nocookie.com`, `player.vimeo.com`} or the Supabase storage host; otherwise render a link. Validate `external_url` as `https:` only at save and at open.
- **Priority:** P2.

## C-APP-05 — Definer-function hygiene
- **Severity:** Low–Medium. **Status:** CONFIRMED in repo; live CONDITIONAL (L-7).
- **Facts (from the static scan):** 16 of 19 definer functions use `search_path = public` rather than `''`; 11 definer functions (including `publish_learn_page`, `mark_learn_check_answers`, `get_learn_check_items`, `admin_save_learn_manual_question`, `get_admin_learn_manual_question_secret`, both `can_access_*` helpers, `is_admin`, `handle_new_user`, `enforce_registration_open`) only `REVOKE ... FROM public`; Supabase also grants EXECUTE to `anon` explicitly through default privileges, so `anon` very likely retains EXECUTE. The in-function `is_admin()` / `auth.uid()` checks prevent abuse, but every callable definer function is public attack surface (timing, error text, DoS). `handle_new_user` / `enforce_registration_open` should not be callable via `/rpc/` at all.
- **Remediation:** J.3 (`REVOKE EXECUTE ... FROM anon, public`; revoke trigger functions from all API roles; set `search_path = ''` and schema-qualify). Do **not** revoke `is_admin()` from `authenticated`/`anon` without testing: RLS policies call it as the invoking role.
- **Priority:** P1.

## C-APP-06 — Client-writable scores and flags
- **Severity:** Low–Medium. **Status:** CONFIRMED (repo policies).
- **Details:** `student_challenges` / `challenge_questions` UPDATE policies are `auth.uid() = user_id` with no column restriction, so a student can set `status='submitted'`, `score`, `max_score`, `is_correct`, `marks_awarded`, `termination_reason`; `learning_progress.status/best_check_score` likewise; `prediction_snapshots` can be inserted with any grade. The server RPC computes canonical scores, but nothing stops a direct overwrite afterwards. Self-impact today; becomes a reporting-integrity problem when teachers/schools consume this data.
- **Remediation:** column-level grants or a BEFORE UPDATE trigger that freezes scoring columns once `status='submitted'`; compute predictions server-side or label as self-reported.
- **Priority:** P2.

## C-APP-07 — PostgREST filter strings from typed search
- **Severity:** Low. **Status:** CONFIRMED. `userService.js:41-47`, `accessService.js:48-52`, `questionBankService.js:15-18` interpolate admin-typed text into `.or("...ilike.%q%...")`; commas/parentheses alter the filter. Admin-only, self-inflicted. Escape or use separate `.ilike` calls. **Priority:** P3.

## C-APP-08 — Raw backend errors surfaced
- **Severity:** Low. **Status:** CONFIRMED: 85 sites render `error.message` from PostgREST/Auth. May expose table/column/function names (e.g. "permission denied for table ..."). Map to friendly messages in a single helper; keep detail in a logger. **Priority:** P3.

## C-APP-09 — Supply-chain hygiene
- **Severity:** Low. **Status:** CONFIRMED. No CI, no `.github`, no Dependabot/Renovate, no `npm audit` gate, all dependencies use caret ranges (lockfile mitigates). `core-js` and `fsevents` run install scripts. Recommend: `npm ci` in CI, `npm audit --omit=dev --audit-level=high` gate, Renovate weekly, `ignore-scripts=true` in `.npmrc` for CI with an allow-list, enable GitHub secret scanning and 2FA on npm/GitHub/Vercel/Supabase accounts. **Priority:** P2.

## C-APP-10 — Runtime third-party fetches
- **Severity:** Low. **Status:** CONFIRMED (bundle strings): drei/troika `<Text>` fetches `https://cdn.jsdelivr.net/gh/lojjic/unicode-font-resolver@v1.0.1/packages/data` and a default font at runtime (`MoleculeViewer3D.jsx:20`); jsPDF contains a `cdnjs.cloudflare.com/.../pdfobject.min.js` loader (only on the PDF-object output path); Google Fonts in `index.html`. These are supply-chain/availability/privacy dependencies and must be listed in the CSP. Self-host the font data and pass a bundled `font` prop. **Priority:** P2.

## C-APP-11 — No audit trail
- **Severity:** Medium. **Status:** CONFIRMED (repo): no table records role changes, plan grants, content restores, exports or secret reads. Without it a compromise cannot be scoped. Add `admin_audit_log` written by the definer RPCs (J.1) and enable Supabase Auth audit log retention / log drains. **Priority:** P1.

## C-OPS-01 — Disaster-recovery ZIP is unencrypted
- **Severity:** Medium. **Status:** CONFIRMED (repo): `disasterExport.js` builds a JSZip with DEFLATE only; contents include profiles (names, emails, schools), progress, challenge answers, class plans and `question_secrets` / version secrets (answer keys), and it is downloaded to the admin's browser Downloads folder. Recommendation: client-side encrypt with WebCrypto AES-GCM using an admin-supplied passphrase before download, exclude student PII from the routine content backup, and document storage location/retention. **Priority:** P1.

## C-OPS-02 — Vercel / hosting configuration unverified
- **Severity:** Medium. **Status:** CONDITIONAL (dashboard). `README.md` says the project is not yet deployed to Vercel, while the audit brief says it is. Unknown: Deployment Protection for preview URLs, whether previews use production Supabase variables, which environment variables are marked Sensitive, custom-domain HSTS. See H.3 and D-10, D-11, D-13.
- **Priority:** P1.

---

# D. Authentication and role findings

## D.1 Role model as built (CONFIRMED + supplied)

| Aspect | Current behaviour |
|---|---|
| Source of truth | `public.profiles.role` ∈ {student, teacher, admin}, `status` ∈ {active, suspended}. |
| Who sets it | Signup trigger from client metadata (student/teacher), `admin_update_profile_role_status` RPC (admin; definition not in repo), SQL editor. |
| Users may edit | `full_name, school, country, grade_or_class, curriculum, level` (supplied). |
| Used by | `ProtectedRoute` (`profile.role !== role` → redirect), RLS for `resources` (student/teacher/admin), `is_admin()` (62 references), live `is_teacher_or_admin()` policies on papers, SL/HL policies (`p.role <> 'student'`, `p.level`). |
| Admin creation | Manual SQL (`admin-role-migration.sql` step 3) — good, never via UI. |

## D.2 Admin privilege findings

- `is_admin()` as supplied is correct in form: `SECURITY DEFINER`, `STABLE`, pinned `search_path = public`, reads `profiles` by `auth.uid()`; it cannot be influenced by caller-provided values. Things to verify (L-7): owner (should be `postgres`, not a user-writable role), `proacl` (EXECUTE for `authenticated` is required by RLS; `anon` is harmless but unnecessary), and that `public` schema CREATE is revoked for `anon/authenticated` so a malicious object cannot shadow `profiles` in `public` (Supabase default on current Postgres, but verify). Recommend `search_path = ''` and `public.profiles` qualification.
- Everything that depends on `is_admin()`: policies on `learn_pages`, `learn_blocks`, `learn_check_questions`, `learn_manual_questions`, `resources`, `platform_settings`, `user_access`, `profiles` (select all / update any), `storage.objects` for three buckets, plus every admin RPC (about 15). Hence the admin account concentration noted in C-AUTH-04.
- "Admins can update any profile" policy plus live column grants: since `role/status` UPDATE is denied to `authenticated`, the admin UI correctly routes role/status through the RPC (`userService.js:60-76`). `updateUserProfile(id, fields)` still sends arbitrary fields; harmless but should be whitelisted.

## D.3 Teacher registration

- **Is unauthorised teacher access real?** Yes (C-AUTH-01). What a self-declared teacher gains today: teacher-audience resources and their signed URLs; write access to `question_papers` / `question_paper_items` (own rows only; no cross-user exposure); `/teacher/*` UI; non-student Learn view (all levels). What they do **not** gain: other users' data, answer keys, admin functions. So the damage is mainly confidentiality of teacher-only files and the trust value of the "Teacher" badge for future school plans.
- `class_plans` / `lesson_blocks` policies are owner-only with no role gate (any role can write them); `lesson_blocks.class_plan_id` ownership is not verified in the policy (insert a block pointing at another user's plan needs its UUID; low). The disaster-recovery notes say these tables are not deployed live — unverified (L-5).

## D.4 Recommended approval design (simplest robust)

**Principle:** `profiles.role` remains the *effective* privilege that every existing policy already reads. A teacher signup creates a *request*, not a role. That means **no existing RLS policy needs to change** and pending teachers automatically get student-level (least) privilege.

| Item | Design |
|---|---|
| New columns on `profiles` | `requested_role text` (student/teacher), `teacher_status text not null default 'none'` (`none`/`pending`/`approved`/`rejected`), `teacher_reviewed_by uuid`, `teacher_reviewed_at timestamptz`, `teacher_review_note text`. None are added to the user UPDATE grant. |
| Trigger `handle_new_user` | Keeps the exact accept-list `('student','teacher')` the live function has; but inserts `role='student'` always, `requested_role = requested`, `teacher_status = 'pending'` when `teacher`. Also length-limits text fields and validates `level`. **Take the live function body first (`pg_get_functiondef`) and change only the role lines**, so no live behaviour (NOT NULL handling, extra columns) is lost. |
| Sign-up UI | **Unchanged.** Student/Teacher tabs stay; after teacher signup and email confirmation the user lands in `/teacher`, where `ProtectedRoute` shows a "Teacher account awaiting approval" page (new small component) when `requested_role='teacher' and teacher_status='pending'` rather than redirecting them away. Rejected → message with contact link. |
| Approval | New `admin_review_teacher_request(p_user_id, p_decision, p_note)` SECURITY DEFINER, `search_path=''`, `is_admin()` check, only acts on rows with `teacher_status='pending' and role='student'`, sets `role`, status, reviewer, timestamp, writes `admin_audit_log`. REVOKE from `public, anon`. |
| Defence in depth | `BEFORE UPDATE` trigger `guard_profile_privileged_columns` that raises if `role`, `status`, `requested_role`, `teacher_status` change and the caller is neither `is_admin()` nor a non-JWT session (SQL editor / service role). Protects against a future accidental `GRANT UPDATE`. |
| Existing teachers | Backfill `requested_role='teacher', teacher_status='approved'` for every `role='teacher'` row, in the same transaction. No `role` value changes, so no policy, `question_papers` row or session is affected. |
| Admin UI | In Admin → Users add a "Pending teachers" filter and Approve / Reject buttons calling the RPC; existing role/status RPC remains for other changes, but route teacher promotion only through the review RPC. |
| Teacher-owned data | `question_papers.user_id` stays as is; pending teachers cannot create papers (their `role` is student) unless the live `is_teacher_or_admin()` allows students — verify. If a pending teacher already created content before approval it remains theirs. |
| Future school plans | Add `organizations`, `organization_members(role)` and let an approved *school admin* approve teachers within their org; `teacher_status` stays the platform-level gate, org membership grants the school entitlement (F). |
| `user_metadata` rule | Never authorise from `auth.jwt()->'user_metadata'`; users can change it with `auth.updateUser`. If a JWT claim is wanted later (performance), use a Custom Access Token Hook that reads `profiles`, writing to `app_metadata`-equivalent claims. |

**Migration order:** (1) read-only verification L-6..L-9 and snapshot of `pg_get_functiondef`, `pg_policies`; (2) add columns (nullable/defaulted, no lock risk); (3) backfill; (4) create review RPC + guard trigger (guard last, after confirming the admin RPC path works); (5) replace `handle_new_user`; (6) ship UI (pending page, admin tab); (7) turn teacher registration on/off per need.
**Rollback:** every step is additive. To roll back the trigger, re-create the previously saved `handle_new_user`; drop the guard trigger; columns can remain unused. Users approved in the interim keep `role='teacher'`.

## D.5 Other auth observations

| Topic | Finding |
|---|---|
| Session storage | supabase-js default `localStorage` (tokens readable by any XSS) — mitigated by CSP + sanitiser; acceptable for this app. |
| Session revocation | `signOut()` default scope is local; suspension does not revoke (C-AUTH-05); there is no "sign out everywhere". |
| Password recovery | Redirect target `${origin}/reset-password` (must be in Supabase Redirect URLs); page has no re-auth; rate limiting depends on Supabase defaults (D-4). |
| Email confirmation | Documented as "ON recommended"; if OFF, a signup immediately yields a session (`classifySignUp` branch "signed-in"), making mass account creation trivial. |
| Account enumeration | Signup screen is uniform (good); sign-in error text is Supabase's (generic). |
| CSRF | Not applicable to the token-in-header model; no cookies are used by the app; CORS on PostgREST/Storage is Supabase-managed. |
| Rate limiting | Only Supabase platform defaults; no app-level limits on RPCs (marking, import). |

---

# E. Storage and content exposure (including the 217 files)

## E.1 Bucket matrix

| Bucket | Visibility | Files | Write | Read path | Listing | Cache / revocation | Verdict |
|---|---|---|---|---|---|---|---|
| `learn-media` | **public** | 206 (supplied) | admin (`is_admin()`), insert/update/delete `to authenticated` | `/storage/v1/object/public/...` — no RLS consulted | Not enumerable unless a SELECT policy exists on `storage.objects` for this bucket (none in repo; verify L-3) | CDN default max-age 3600; no revocation short of delete/replace | Acceptable for free/demo; unsuitable for Premium |
| `question-media` | **public** | 11 (supplied) | admin | public URL **and** public SELECT policy | **Enumerable by anyone with the publishable key** (C-STO-01) | same | Remove the public SELECT policy |
| `resources` | private | n/a | admin | signed URL 600 s after `resources` row + storage policy checks | admin only | URL valid until expiry; bearer | Good model to reuse for Premium |

## E.2 The 217 public files

- **Do not change visibility, move or delete any of them now** (your restriction, and correct: lesson blocks store absolute public URLs in `learn_blocks.content`).
- What can be done **without touching those URLs**: (1) drop the enumerating policy on `question-media`; (2) confirm no SELECT policy lets `learn-media` be listed; (3) classify the 206 lesson-media files by owning lesson (join `storage.objects.name` `lessons/{pageId}/...` to `learn_pages.access_tier` once it exists) so that Premium migration has an exact worklist; (4) for new Premium media use a private bucket from day one; (5) later, for lessons promoted to Premium, copy their files to the private bucket, rewrite block references to `storage://learn-media-private/<path>` (resolved to signed URLs at render time), verify, then delete the public copy — one lesson at a time, with rollback by restoring the old URL JSON (L-2 gives the inventory).
- Honest limits: a public URL once seen is a permanent copy. Users who already have URLs keep access until the object is deleted (plus CDN TTL). Images displayed in a browser can always be saved; signed URLs only make sharing links expire and make the origin attributable.
- Signed URL guidance: TTL 5–10 minutes for images (resolve on lesson open and cache in memory per page), 60 s for downloads; use `createSignedUrls` (batch) to avoid per-image round trips; never write signed URLs to the database or localStorage.

## E.3 Where content can leave the system (inventory)

| Channel | Today | Preventable? |
|---|---|---|
| PostgREST table reads of lessons/questions | open to any account, no limits | Gate by entitlement, rate-limit, page-wise RPC |
| Media URLs | permanent, public | Private bucket + signed URL for premium |
| Answer keys | `mark_learn_check_answers` returns them; Solve review RPC after submission | Reveal-after-attempt policy |
| Print / PDF | browser print works; teacher paper export is client-side | Not preventable; add watermark/provenance |
| Offline / cache | HTTP caches, service workers (none), localStorage drafts (editors only) | Add `Cache-Control: private, no-store` to authenticated API responses where possible (Supabase controls PostgREST headers; media is the main concern) |
| Simulation bundles | public static JS | Not preventable; see G |
| Backup ZIP | admin only, unencrypted | Encrypt (C-OPS-01) |

---

# F. Premium authorization design

## F.1 Inventory of what exists (CONFIRMED, repo)

| Item | Where | Enforced? |
|---|---|---|
| `user_access(user_id unique, plan free/premium/school, starts_at, expires_at, created_by)` | `admin-access-migration.sql` | Table exists; writable by admins only; readable by owner. **Nothing reads it for access decisions.** |
| `user_access_overview` view with `access_status`, `effective_plan` (expiry-aware) | same | Used only by Admin Access/Users pages and the unapplied premium storage policy. |
| `resources.access_tier` (`free`/`premium`) | `resources-migration.sql:77` | Inert metadata. |
| `resources.is_locked` | same | **Enforced** at the storage layer (file cannot be read); row remains visible. |
| `platform_settings.default_resource_access` | settings migration | Inert default. |
| `resources-premium-enforcement-migration.sql` | repo, "DO NOT RUN YET" | Would enforce `effective_plan in ('premium','school')` for premium resource **files** only; per-user subquery on the view; not applicable to lessons, questions, media or simulations. |
| Client-side checks | none beyond lock icon in `ResourceCard.jsx` | Cosmetic. |

## F.2 Principle and model

Two orthogonal axes, both evaluated **in the database**:

1. **Audience** (who the content is for): `student`, `teacher`, `both` (already modelled on resources; extend to lessons/questions where needed). Teacher audience requires `teacher_status='approved'` (D).
2. **Tier** (what you must hold): `public` (anonymous demo), `free` (any verified account), `premium` (individual paid), `school` (granted through an organisation; ranks equal to premium). `admin` bypasses.

A single definer function is the only place that interprets entitlements, so a policy can never drift from the rule:

- `current_plan_rank()` → `0` anon, `1` free, `2` premium/school/admin, derived from `profiles.status`, `user_access` (with dates), `organization_members` ⨝ `organization_subscriptions`.
- `has_tier(required text)` → `current_plan_rank() >= rank(required)`.
- `can_access_audience(aud text)` → role/teacher_status check.

Payment readiness without a payment system: `user_access` gains `source` (`manual`/`stripe`/`school_invoice`), `external_customer_id`, `external_subscription_id`; a `payment_events(id, provider, event_id unique, payload, processed_at)` table for webhook idempotency; a future Supabase Edge Function (or Vercel serverless function) verifies the provider signature and writes entitlements with the service role. **Nothing here collects or stores card data and no payment code is written now.** Admins keep granting access manually (existing page) until then.

## F.3 Access matrix

| User type | Lessons (Learn) | Lesson media | Question Bank / Solve | Simulations | Protected datasets | Worksheets / resources | Progress |
|---|---|---|---|---|---|---|---|
| **Public demo (anon)** | Only items flagged `tier='public'`; catalogue titles via view | Public bucket only (flagged lessons) | none | Allow-listed demo sims (client code is public anyway) | none | none | none (local only, as today) |
| **Free student** | `tier in (public, free)`; SL/HL filter from an *admin-controlled* field | Public bucket + signed URLs for free-private | Free-tier questions; bounded daily Solve | All free-tier sims; dataset-backed features limited | Sample sets | Free-tier files | Full own-data read/write |
| **Approved teacher** | Free tiers + teacher-audience content | as above | Free tiers + paper builder | Teacher flows | Teacher-audience sets | Teacher-audience, free tier | Own data; class view only via org (future) |
| **Premium individual** | all `premium` | signed URLs | full bank + unlimited Solve | all | full | all | Own data; history kept after lapse (read-only) |
| **School / institution** | as premium for all members; org admin manages seats | signed | full | all | full | all + class resources | Per-member own data; org-level aggregates only through definer RPCs with explicit consent and k-anonymity |
| **Admin** | all, including drafts | all | all + secrets via RPC | all | all | all | none by default; no student progress access (matches the existing "not exposed even to Admin" decision in `solve-challenges-migration.sql`) |

## F.4 How each surface is enforced (DB / backend, never UI)

| Surface | Mechanism |
|---|---|
| **Lessons** | Add `learn_pages.access_tier` (`public/free/premium`, default `free` so nothing changes) and `learn_pages.audience`. Replace the select policy on `learn_pages`/`learn_blocks`/`learn_check_questions`/`learn_manual_questions` with `... and public.has_tier(lp.access_tier) and public.can_access_audience(lp.audience) and <existing SL/HL clause>`. Provide `learn_catalog` view (id, title, code, order, tier only, `security_invoker=false` but column-limited) so locked lessons can show an upgrade card without leaking blocks. |
| **Lesson media** | Premium lessons store `storage://` references in blocks; renderer calls `createSignedUrls` after the lesson fetch succeeds (which already proves entitlement). Private bucket policy: `bucket_id='learn-media-private' and exists(select 1 from learn_pages ... and has_tier(access_tier))`, parsing page id from the path. |
| **Question Bank** | `questions.access_tier`; RLS or a `get_challenge_candidates` RPC applying `has_tier` and level server-side; Solve limits (daily count) enforced by the RPC. Answers remain RPC-only. |
| **Simulations** | Static code cannot be entitlement-protected (G). What is enforceable: any *server-held data or answer-check* a premium simulation needs (spectra libraries, unknown-compound sets, challenge answers) moves behind an RPC/Edge Function that calls `has_tier`. The engine itself stays a public chunk. |
| **Protected datasets** | `datasets(id, tier, payload jsonb)` + RPC `get_dataset(id)` with entitlement + per-user rate limit; cached client-side per session only. |
| **Downloadable worksheets** | Existing `resources` bucket; replace the inert `access_tier` with the entitlement-aware storage policy once F.2 exists; add per-user footer watermark when generating the signed download through an Edge Function (stamping PDFs with name/email/date). |
| **Student progress** | Never gated by plan; always owner-only. After a lapse the learner retains read access to their own history (data-protection friendly). Writes to progress for premium lessons require the same read entitlement. |

## F.5 Implementation notes

- Default every new `access_tier` column to the current behaviour (`free`) so enabling is a no-op; flip lessons to `premium` one at a time in the admin UI.
- The `has_tier` function is `STABLE`, `SECURITY DEFINER`, `search_path=''`; index `user_access(user_id)` (already unique) and `organization_members(user_id)`.
- Evaluate policy performance: wrap in `(select public.current_plan_rank())` to let Postgres cache per statement.
- Test matrix (K) must include: expired plan, scheduled plan, school member removed, suspended user, plan downgrade mid-session (JWT is not entitlement-bearing, so effect is immediate).

---

# G. Intellectual-property protection

## G.1 What cannot be prevented in an ordinary browser (be explicit with stakeholders)

| Action | Why it cannot be stopped |
|---|---|
| Screenshots, screen recording, camera photos of the screen | OS-level. |
| Copying visible text, saving rendered images, "Save image as" | The browser must receive the bytes to display them. |
| Reading the network responses (lesson JSON, question JSON) | Authenticated users see what the server sends. |
| Reading, de-minifying and re-hosting simulation JavaScript, tables and constants | Minified code is still code; obfuscation only slows a determined reader. **I make no claim that obfuscation or minification prevents access.** |
| Printing / "Save as PDF" | Browser feature; disabling it harms accessibility and is trivially bypassed. |
| Disabling DevTools, right-click or selection | Cosmetic, bypassable, harmful to accessibility; **not recommended and not part of this plan.** |

## G.2 What does materially help (and is realistic here)

1. **Least privilege on the server:** entitlement-aware RLS (F) so non-subscribers never receive premium bytes; keep answer keys and marking server-side (already largely true); fix C-CNT-02.
2. **Make bulk theft expensive and attributable:** page-wise delivery RPC with volume counters, PostgREST `max_rows`, signup CAPTCHA, verified email, per-account anomaly alerts (for example more than N lessons in an hour), account bans that work (C-AUTH-05), and server logging of reads of premium tables.
3. **Controlled media delivery:** private bucket, 5–10 min signed URLs, batch signing on lesson open, no persistent URLs in DB for premium media.
4. **Selective watermarking:** per-user footer stamp on downloadable PDFs/DOCX generated through an Edge Function; subtle on-screen user-initials watermark on premium diagrams is possible but has an accessibility and cost trade-off — apply only to premium downloads first.
5. **Canary content:** a few uniquely-worded sentences / one subtly altered constant per tenant tier let you prove copying later. Cheap, and works against exactly the "someone republished my lessons" scenario.
6. **Legal and provenance:** copyright notice (already in `CopyrightNotice.jsx`), terms of use forbidding scraping/redistribution, takedown process, and a written licence for school plans.
7. **Don't ship what you cannot afford to lose:** anything that is a trade secret should not be in the bundle at all.

## G.3 Simulations: what must stay client-side vs what can move

| Layer | Examples in repo | Keep client-side? | Protect server-side? |
|---|---|---|---|
| Rendering / animation / 3D | `three`, drei scenes, canvases | **Must stay** (latency, cost) | No |
| Interactive physics | gas laws, ideal gas, bonding, collision theory | Stay | Not worthwhile; commodity science |
| Spectra generation engines (IR/MS/NMR line shapes, splitting) | `spectroscopy-studio/*/physics` | Stay (needs real-time response) | Algorithms stay public |
| **Compound / spectra datasets** | `ms/data/*`, `ir/data/*`, `structure/data/*`, `nmr/molecular/model/molecules.js` (about 115 kB of tables) | Could stay for the free/demo subset | **Candidate to serve from an entitlement-checked RPC** as JSON per compound, with the free subset embedded |
| **Unknown-compound challenges and their answers** | Structure Investigation (8 unknowns), NMR challenges | Question text can be client-side | **Answer verification should be an RPC** (`check_structure_answer`), like Learn marking, otherwise the solution is in the bundle |
| Teacher-only explanations | `TeacherDisclosure` | Not protectable client-side | Serve teacher text from an RPC gated by `teacher_status='approved'` if it is valuable |

Facts for planning: there are no source maps today (keep it that way); `index-*.js` (2.39 MB) contains admin code; chunk names are readable (`SpectroscopyStudio-*.js`); `/simulation/:id` and `/interactives/:id` are public routes by design and routes are also discoverable from the registry in the bundle. Gating *access to the chunk* with an Edge Middleware token check is possible (`/assets/premium/*` requires a signed cookie) but adds cost and complexity, and anyone with a subscription can still download the chunk — I recommend **not** doing it for engines, only for datasets/answers.

**Recommended architecture:** public engine code + entitlement-gated, per-request data and answer-checking via Supabase RPCs (Postgres) first; Supabase Edge Functions only where Postgres is awkward (PDF stamping, signed-URL minting with watermark, payment webhooks). Avoid building a custom compute backend: cost, latency and maintenance are not justified for chemistry visualisations whose value is pedagogy and curation, not secret algorithms. Obfuscating bundles is not recommended (hurts debugging and gives false assurance); if desired later, treat as friction only.

---

# H. Application and deployment hardening

## H.1 React / client

| Item | Recommendation |
|---|---|
| Admin code in public bundle | `React.lazy` the `/admin` subtree and Q Builder (Q Builder already lazy). Reduces recon surface; not a security boundary. |
| Sanitiser | Declare `dompurify`, upgrade (C-APP-01), tighten config (C-APP-03), keep sanitising after math rendering. Add the 27-payload test as a regression test in `scripts/` (proposed, not created). |
| Embeds | Host allow-list (C-APP-04); drop `allow-same-origin` for third-party frames if the provider works without it (YouTube/Vimeo players generally need it; keep for those hosts only). |
| Error messages | Central `friendlyError()` (C-APP-08). |
| Draft/local storage | Contains lesson drafts for admin editors only (no secrets). Fine. |
| Third-party fetches | Self-host font data (C-APP-10). |
| Session | Consider `persistSession` unchanged; add inactivity timeout for admin routes (client-side convenience) and short JWT for admin if on a plan that allows. |

## H.2 Supabase

| Area | Action |
|---|---|
| Grants | Revoke `anon` EXECUTE on every non-public RPC; revoke API-role EXECUTE on trigger functions; revoke `anon` table privileges not needed (everything except `platform_settings_public`); revoke `INSERT` on `profiles` from `authenticated`. |
| `search_path` | `''` + qualified names on definer functions (start with `is_admin`, `handle_new_user`, marking RPCs). |
| Views | Keep `security_invoker` on any view that reads RLS tables; `platform_settings_public` is intentional. Add a check query (L-10). |
| RLS | Add `to authenticated` to all non-public policies; wrap `auth.uid()` in `(select auth.uid())` for performance. |
| Auth | MFA for admins; CAPTCHA; email confirmation ON; Secure password change; leaked password protection (plan permitting); server min password length; exact Redirect URL allow-list (no wildcards in production); disable unused providers. |
| API | Set `max_rows`, review exposed schemas (only `public`), disable GraphQL if unused, enable `pg_stat_statements` and API/Auth log retention, consider log drain. |
| Backups | Confirm daily backups / PITR in dashboard; test restore into a separate project; document where the encrypted app-level ZIP is stored; keep `auth.users` relinking procedure (existing docs). |
| Network / abuse | Rate limits in Auth settings; consider Supabase Network Restrictions for the direct DB host. |
| Edge | Create Edge Functions only for the three jobs in G.3. |

## H.3 Vercel

| Question from the spec | Finding |
|---|---|
| Can sensitive files be publicly served? | Static output contains only `/assets`, `/branding`, `/resources/**` (empty), `/simulations/separation/filtration/*.png`. `docs/`, `supabase/`, `scripts/`, `.env*` are outside `dist/` and not served. Risk is **future files** placed in `public/` (see C-STO-04). |
| Are production source maps exposed? | **No.** 0 `.map` files, 0 `sourceMappingURL` in both local builds and in the repo's existing `dist/`. Add `build.sourcemap: false` explicitly to `vite.config.js` so a future change cannot silently enable it. |
| Environment variables safe? | Only two `VITE_*` variables exist and both are public by design. Risk is operational: never create `VITE_` variables for secrets (anything `VITE_*` is inlined into the public bundle); mark non-public variables Sensitive; use separate Supabase project/branch variables for Preview vs Production so a PR preview never writes to production data. (CONDITIONAL — D-11.) |
| Preview deployments restricted? | Unknown (CONDITIONAL). Enable Deployment Protection (Vercel Authentication) for Preview at minimum; consider protection for Production only if the site is not public. |
| Security headers? | None configured (C-APP-02). |
| Protected responses cacheable? | The SPA shell and static assets are public by design. Authenticated data comes from `*.supabase.co` (not Vercel). No Vercel serverless/Edge API exists in the repo, so there are no Vercel-hosted protected responses to cache. The fallback rewrite returns `index.html` with 200 for unknown paths including missing `/assets/*` — harmless but confusing for chunk errors (the app already has a chunk-refresh workaround). |
| Do bundles reveal simulation logic? | Yes, by nature (G). |
| API endpoints needing validation? | None in repo today. When Edge Functions/webhooks are added: verify JWT or provider signature, validate JSON schema, size-limit bodies, idempotency keys. |

**Recommended `vercel.json` (proposed, not applied) — see J.4 for the full file.**

## H.4 Dependencies and supply chain
See C-APP-01 and C-APP-09. Action list: add `dompurify` explicit, bump `vite`, re-audit; `npm ci` + `npm audit --omit=dev --audit-level=high` in CI; Renovate; pin Node version (`.nvmrc`/`engines`); lockfile review in PRs; 2FA on registry/hosting accounts; consider `npm config set ignore-scripts true` in CI.

## H.5 Logging, monitoring, backups
- Add `admin_audit_log(id, at, actor, action, target, details jsonb)` written by definer RPCs (role change, teacher review, plan grant, restore, secret export, publish).
- Turn on Supabase Auth and API logs retention; alert on: admin sign-in from new IP, role changes, spike of `learn_blocks`/`questions` reads per user, repeated failed `mark_learn_check_answers`.
- Frontend: add a minimal error reporter (Sentry or equivalent) with PII scrubbing; do not log tokens.
- Backups: see H.2.

---

# I. Safe implementation roadmap

Each phase is independently deployable and independently testable; later phases do not depend on earlier ones unless stated. Nothing here touches the 217 files, student progress rows, existing accounts or visuals.

| Phase | Name | Contents | Depends on | Test gate | Rollback |
|---|---|---|---|---|---|
| **0** | Verify and baseline (read-only) | Run all section L queries; export live schema/policies/function bodies to `supabase/baseline/` (new file, documentation only); fix repo drift documentation (C-AUTH-02); decide open questions (anon grants, `is_teacher_or_admin`, admin RPC bodies, MFA state, Vercel settings). | — | Report of results reviewed; no behaviour change | n/a |
| **1** | Dependency and header quick wins | Declare/upgrade `dompurify`, bump `vite`; `build.sourcemap:false`; `vercel.json` headers with **CSP Report-Only**; CI with `npm audit` gate. | — | `npm run build`, `npm test`, rich-text tests, manual smoke (K), no CSP violation reports for 1–2 weeks | Revert two files |
| **2** | Teacher approval | D.4 migration, trigger, RPC, UI (pending page, admin tab). | Phase 0 (live function bodies) | Section K teacher matrix | Restore saved `handle_new_user`; drop guard trigger |
| **3** | Grant/exec hardening | Revoke `anon` EXECUTE and trigger-function EXECUTE; revoke `INSERT` on profiles; drop `question-media` public SELECT (replace with admin SELECT); `to authenticated` on policies. | Phase 0 | Anon-role query suite (L-18), image URL fetch before/after, admin Backup page still downloads media | Re-grant script saved from Phase 0 |
| **4** | Admin hardening | Enrol admins in MFA; add `aal2` to `is_admin()` (staged); `admin_audit_log`; lazy-load admin; encrypt backup ZIP. | Phase 0 | Admin login with and without MFA in staging; backup round-trip | Redefine `is_admin()` from saved text |
| **5** | Enforcement of account state | `is_active_user()` in read policies, Auth ban on suspend, server-controlled `level` (RPC) | Phase 3 | Suspended-user suite; SL/HL suite | Per-table policy restore |
| **6** | Answer and extraction controls | Learn marking reveal policy; rate counters; `get_lesson_page` RPC; PostgREST `max_rows`; signup CAPTCHA; Solve candidate RPC | Phase 0 | Learn check flow works; scraper script returns bounded data | Keep old RPC versions callable behind a flag |
| **7** | Entitlement model (schema only) | `organizations`, `organization_members`, `organization_subscriptions`, `access_tier` columns defaulting to `free`, `current_plan_rank()`, `has_tier()`, `payment_events`. No policy changed. | Phases 2, 5 | Function unit tests as various roles; zero behaviour change | Drop new objects |
| **8** | Apply entitlements | Switch policies to `has_tier`; admin UI to tag lessons; `learn_catalog`; private media bucket + signed URL resolver; resources premium policy; teacher/school audiences | Phase 7 | Full access matrix F.3 | Flip policies back to current text; tiers default free |
| **9** | Protected data and exports | Dataset/answer RPCs for Structure Investigation / NMR challenges; watermarked PDF Edge Function; self-host font data; CSP enforce | Phases 1, 8 | Simulation regression (`verify:*` scripts), CSP clean | Feature flags per engine |
| **10** | Operations | Monitoring/alerts, backup restore drill, quarterly access review, incident runbook | — | Drill completed | n/a |

---

# J. Exact proposed code changes (NOT applied)

## J.1 Database migrations (new files under `supabase/migrations/`, proposed names)

| File | Purpose |
|---|---|
| `20261112_baseline_live_schema.sql` | **Documentation only** — output of `pg_dump --schema-only` (never run against live). |
| `20261112_teacher_approval.sql` | D.4: columns, backfill, trigger, review RPC, guard trigger, audit table. |
| `20261112_grants_and_policy_hardening.sql` | J.3. |
| `20261113_question_media_listing.sql` | J.2. |
| `20261120_admin_mfa_and_audit.sql` | `aal2` in `is_admin()` (staged), `admin_audit_log`. |
| `20261201_entitlements_schema.sql` | F.2 objects. |
| `20261215_entitlement_policies.sql` | F.4 policy replacements. |

### J.1.a Teacher approval (key statements)

```sql
begin;

alter table public.profiles
  add column if not exists requested_role text check (requested_role in ('student','teacher')),
  add column if not exists teacher_status text not null default 'none'
      check (teacher_status in ('none','pending','approved','rejected')),
  add column if not exists teacher_reviewed_by uuid references auth.users(id),
  add column if not exists teacher_reviewed_at timestamptz,
  add column if not exists teacher_review_note text;

-- Existing teachers stay exactly as they are and become "approved".
update public.profiles
   set requested_role = 'teacher', teacher_status = 'approved', teacher_reviewed_at = now()
 where role = 'teacher' and teacher_status = 'none';
update public.profiles set requested_role = 'student' where role = 'student' and requested_role is null;

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  action text not null,
  target uuid,
  details jsonb
);
alter table public.admin_audit_log enable row level security;
create policy "Admins read audit log" on public.admin_audit_log for select to authenticated using (public.is_admin());
revoke all on public.admin_audit_log from anon, authenticated;
grant select on public.admin_audit_log to authenticated;     -- writes only via definer functions

-- !! Start from the LIVE definition (pg_get_functiondef) and change only the role lines. Illustrative body:
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_req text := case when new.raw_user_meta_data ->> 'role' in ('student','teacher')
                     then new.raw_user_meta_data ->> 'role' else 'student' end;
begin
  insert into public.profiles (id, email, full_name, role, requested_role, teacher_status,
                               school, country, grade_or_class, curriculum, level)
  values (new.id, new.email, left(new.raw_user_meta_data ->> 'full_name', 200),
          'student', v_req, case when v_req = 'teacher' then 'pending' else 'none' end,
          left(new.raw_user_meta_data ->> 'school', 200), left(new.raw_user_meta_data ->> 'country', 100),
          left(new.raw_user_meta_data ->> 'grade_or_class', 100),
          coalesce(left(new.raw_user_meta_data ->> 'curriculum', 100), 'IB Diploma Programme'),
          case when upper(new.raw_user_meta_data ->> 'level') in ('SL','HL')
               then upper(new.raw_user_meta_data ->> 'level') end)
  on conflict (id) do nothing;
  return new;
end $$;

create or replace function public.admin_review_teacher_request(p_user_id uuid, p_decision text, p_note text default null)
returns public.profiles language plpgsql security definer set search_path = ''
as $$
declare v_row public.profiles;
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  if p_decision not in ('approve','reject') then raise exception 'Invalid decision'; end if;
  update public.profiles set
      role = case when p_decision = 'approve' then 'teacher' else role end,
      teacher_status = case when p_decision = 'approve' then 'approved' else 'rejected' end,
      teacher_reviewed_by = auth.uid(), teacher_reviewed_at = now(),
      teacher_review_note = left(p_note, 500)
    where id = p_user_id and teacher_status = 'pending' and role = 'student'
    returning * into v_row;
  if v_row.id is null then raise exception 'No pending teacher request for this user'; end if;
  insert into public.admin_audit_log(actor, action, target, details)
  values (auth.uid(), 'teacher_review_' || p_decision, p_user_id, jsonb_build_object('note', left(p_note, 500)));
  return v_row;
end $$;
revoke all on function public.admin_review_teacher_request(uuid, text, text) from public, anon;
grant execute on function public.admin_review_teacher_request(uuid, text, text) to authenticated;

-- Defence in depth: privileged columns cannot change from an ordinary user session, whatever grants exist.
create or replace function public.guard_profile_privileged_columns() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (new.role, new.status, new.requested_role, new.teacher_status)
       is distinct from (old.role, old.status, old.requested_role, old.teacher_status)
     and auth.uid() is not null and not public.is_admin() then
    raise exception 'Not authorized to change privileged profile fields';
  end if;
  return new;
end $$;
drop trigger if exists guard_profile_privileged_columns on public.profiles;
create trigger guard_profile_privileged_columns before update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();

commit;
```
Regression notes: the guard allows SQL-editor sessions (no JWT) and admins; `admin_update_profile_role_status` keeps working because it runs as an admin. Test the "approved teacher unchanged" case before enabling the guard. `profiles.full_name` is NOT NULL in the repo schema: mirror the live null-handling when copying the live function.

### J.1.b Required UI changes for the same phase
`src/components/auth/ProtectedRoute.jsx` (render `PendingTeacherApproval` when `role="teacher"`, `profile.role==='student'`, `profile.teacher_status==='pending'`; show rejection notice for `rejected`), new `src/components/auth/PendingTeacherApproval.jsx`, `src/lib/userService.js` (`reviewTeacherRequest`, `listPendingTeachers`), `src/pages/admin/users/AdminUsers.jsx` (filter + Approve/Reject), `src/pages/AuthPage.jsx` (copy: "Teacher accounts are reviewed before activation" — layout unchanged).

## J.2 Stop enumeration of `question-media` (images keep working)

```sql
begin;
drop policy if exists "Public can read question media" on storage.objects;
create policy "Admins can read question media" on storage.objects
  for select to authenticated
  using (bucket_id = 'question-media' and public.is_admin());
-- tighten the bucket
update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/png','image/jpeg','image/webp']
 where id = 'question-media';
commit;
-- Rollback: recreate the original public SELECT policy:  using (bucket_id = 'question-media')
```
Pre/post test: `curl -I` one existing public image URL (expect 200 both times); run list as anon (expect empty/denied after).

## J.3 Grants and policy hardening (illustrative; generate exact list from L-7 output)

```sql
-- trigger functions must not be callable through the API
revoke execute on function public.handle_new_user()            from public, anon, authenticated;
revoke execute on function public.enforce_registration_open()  from public, anon, authenticated;

-- RPCs that are for signed-in users only: remove the implicit anon EXECUTE
revoke execute on function public.publish_learn_page(uuid) from anon;
revoke execute on function public.mark_learn_check_answers(uuid, jsonb) from anon;
revoke execute on function public.get_learn_check_items(uuid) from anon;
revoke execute on function public.admin_save_learn_manual_question(uuid, uuid, jsonb, jsonb, text) from anon;
revoke execute on function public.get_admin_learn_manual_question_secret(uuid) from anon;
revoke execute on function public.can_access_learn_page_for_current_user(uuid) from anon;
revoke execute on function public.can_access_learn_check_for_current_user(uuid) from anon;
-- save_question_with_secrets (27-param) likewise; admin_update_profile_role_status, submit_and_mark_challenge, get_review_content after L-8.

-- API roles need no INSERT on profiles (trigger creates rows)
revoke insert on public.profiles from authenticated, anon;

-- anon should see only the curated public view
revoke all on all tables in schema public from anon;
grant select on public.platform_settings_public to anon;
-- (verify nothing else is intentionally anonymous, e.g. via L-4, before running)
```
Do **not** revoke `EXECUTE` on `public.is_admin()` from `authenticated` (and test before touching `anon`): policies evaluate it as the caller.

## J.4 `vercel.json` (proposed)

```json
{
  "cleanUrls": false,
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Content-Security-Policy-Report-Only",
          "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://<PROJECT_REF>.supabase.co; media-src 'self' blob: https://<PROJECT_REF>.supabase.co; connect-src 'self' https://<PROJECT_REF>.supabase.co wss://<PROJECT_REF>.supabase.co https://cdn.jsdelivr.net; frame-src https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests" }
      ]
    },
    {
      "source": "/assets/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    },
    {
      "source": "/index.html",
      "headers": [{ "key": "Cache-Control", "value": "no-cache" }]
    }
  ]
}
```
Notes: replace `<PROJECT_REF>` with your Supabase host (I did not record or invent it). `X-Frame-Options: DENY` assumes no embedding of e-Lab in LMS iframes; if schools will embed simulations, allow-list them via `frame-ancestors` for `/simulation/*` only. `COOP same-origin` can affect OAuth popups (none today). After two clean weeks of Report-Only (add a `report-to`/`report-uri` endpoint), rename the key to `Content-Security-Policy`. Vite emits hashed filenames so the immutable cache rule is safe; `index.html` must not be immutable.

## J.5 `package.json` / `vite.config.js`

```diff
 "dependencies": {
+  "dompurify": "^3.4.17",
 ...
 "devDependencies": {
-  "vite": "^8.2.2",
+  "vite": "^8.3.8",
```
```js
// vite.config.js
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { sourcemap: false },   // explicit: never publish maps
})
```
Then `npm install`, `npm audit`, `npm test`.

## J.6 Application code changes (list)

| File | Change |
|---|---|
| `src/lib/sanitizeHtml.js` | Add `FORBID_TAGS`, style-declaration filtering hook, optional host-restricted images (C-APP-03). |
| `src/components/learn/LearnBlockRenderer.jsx` | Enforce embed host allow-list; fall back to link (C-APP-04). |
| `src/lib/useVisibleResources.js`, `src/pages/admin/resources/AdminResources.jsx` | `https:`-only check before `window.open`. |
| `src/router.jsx` | `React.lazy` for the `/admin` tree. |
| `src/components/auth/ProtectedRoute.jsx` | pending/rejected teacher states (D). |
| `src/lib/userService.js` | teacher review functions; whitelist fields in `updateUserProfile`. |
| `src/lib/learnContentService.js` | later: signed-URL resolver for `storage://` references; `get_lesson_page` consumer. |
| `src/lib/questionBankService.js` | validate upload type/size; sanitise extension (C-STO-03). |
| `src/pages/ResetPassword.jsx` | require recovery event (C-AUTH-07). |
| `src/lib/errors.js` (new) | `friendlyError()` (C-APP-08). |
| `.github/workflows/ci.yml` (new) | `npm ci`, build, tests, `npm audit --omit=dev --audit-level=high`, check `public/resources` only contains `.gitkeep`. |
| `scripts/test-sanitizer-xss.mjs` (new) | the 27-payload regression from this audit (script available in scratchpad). |
| `supabase/baseline/*` (new) | live-schema snapshot (documentation). |
| `supabase/schema.sql` | mark as superseded; replace insecure `handle_new_user` and profile INSERT policy with a banner pointing to baseline. |

## J.7 Entitlement skeleton (Phase 7, key function)

```sql
create table public.organizations (id uuid primary key default gen_random_uuid(), name text not null, created_at timestamptz default now());
create table public.organization_members (
  organization_id uuid references public.organizations on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  member_role text not null check (member_role in ('org_admin','teacher','student')),
  status text not null default 'active' check (status in ('active','removed')),
  primary key (organization_id, user_id));
create table public.organization_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations on delete cascade,
  status text not null check (status in ('active','expired','cancelled')),
  starts_at timestamptz, expires_at timestamptz, seats int);
alter table public.user_access add column if not exists source text not null default 'manual',
  add column if not exists external_customer_id text, add column if not exists external_subscription_id text;
-- RLS on all: members read own membership; org_admins read their org; writes admin/service only.

create or replace function public.current_plan_rank() returns int
language sql stable security definer set search_path = ''
as $$
  select case
    when auth.uid() is null then 0
    when not exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'active') then 0
    when public.is_admin() then 2
    when exists (select 1 from public.user_access a where a.user_id = auth.uid() and a.plan in ('premium','school')
                  and (a.starts_at is null or a.starts_at <= now()) and (a.expires_at is null or a.expires_at > now())) then 2
    when exists (select 1 from public.organization_members m
                   join public.organization_subscriptions s on s.organization_id = m.organization_id
                  where m.user_id = auth.uid() and m.status = 'active' and s.status = 'active'
                    and (s.starts_at is null or s.starts_at <= now()) and (s.expires_at is null or s.expires_at > now())) then 2
    else 1 end
$$;
create or replace function public.has_tier(required text) returns boolean
language sql stable security definer set search_path = ''
as $$ select public.current_plan_rank() >= case required when 'public' then 0 when 'free' then 1 else 2 end $$;
revoke all on function public.current_plan_rank(), public.has_tier(text) from public;
grant execute on function public.current_plan_rank(), public.has_tier(text) to anon, authenticated;
```
Policy pattern (Phase 8): `... and public.has_tier(lp.access_tier)` appended to the existing `learn_pages` / `learn_blocks` / `learn_check_questions` / `learn_manual_questions` / `questions` / `resources` / storage policies.

---

# K. Testing and rollback plans

## K.1 Demonstrating nothing broke (per phase, manual smoke)

Use dedicated test accounts, **not real student records**: `test-student-sl`, `test-student-hl`, `test-teacher-approved`, `test-teacher-pending`, `test-admin`, plus anonymous.

| Area | Steps | Pass criterion |
|---|---|---|
| Login | Sign up (student, teacher), confirm email, sign in/out, forgot password, change password | Correct landing page per role; pending teacher sees pending page; admin reaches `/admin` |
| Lessons | Open a published SL lesson, an HL-only lesson (SL student must not see it), page breaks, previous/next, math, tables, video, equations | Identical to baseline screenshots |
| Images | Open 10 lessons containing images from `learn-media`; open 3 questions with `question-media` images (anonymous window as well) | All render; response 200 before and after each phase |
| Simulations | Open 5 engines via Learn and `/simulation/<id>`; run `npm run verify:simulations` locally | Same behaviour; no console CSP violations (Report-Only) |
| Check Your Understanding | Answer MCQ, numeric, short answer | Marking works; after Phase 6 correct-answer reveal follows the new rule |
| Solve | Create, answer, submit, report a challenge | Server score present; report shows review |
| Progress | Mark lessons complete, reload, other browser | Persisted; Estimated Grade unchanged |
| Teacher | Q Builder: build a paper, export PDF/DOCX, save; Class planner; Resources download | Works for approved teacher; blocked for pending |
| Admin | Users list, review teacher request, grant plan, Learn editor save/publish, question import dry run, backup export (staging) | Works; audit rows written |
| Resources | Open an unlocked published file; a locked file must fail | Signed URL works; locked denied |

## K.2 Automated

- Existing: `npm test` (jsdom suites; not run in this audit), `npm run build`.
- Add: sanitiser regression (J.6); a SQL test file run against a **staging/branch** database using the pattern below (transactions rolled back):

```sql
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','<TEST_USER_UUID>','role','authenticated')::text, true);
  -- expect failure / zero rows:
  update public.profiles set role = 'admin' where id = '<TEST_USER_UUID>';        -- must be denied
  select count(*) from public.question_secrets;                                   -- must error
rollback;
```
- Entitlement bypass tests (after Phase 8): for each tier × content type assert row counts: anon=0 on premium, free sees free only, expired premium falls back, removed org member loses access, level change does not widen access.
- Extraction test: a script that logs in as a free test user and attempts paginated `select` of `learn_blocks`; expected to be capped/denied after Phase 6.

## K.3 Rollback principles

1. Every migration is a file with a paired `*_rollback.sql` produced before applying (saved `pg_get_functiondef` / `pg_policies` dumps from Phase 0).
2. Apply in staging (Supabase branch) first; apply to production in a quiet window with an immediate smoke run.
3. Phases are additive: new columns/functions can stay unused; policy changes are single-statement reversible.
4. Feature flag for new read paths (`platform_settings` column or env) so the UI can fall back to the old RPC.
5. Keep the previous Vercel deployment promoted for instant rollback (`vercel rollback`) for header/CSP changes.
6. Take a Supabase backup/PITR marker plus an encrypted app-level export before Phases 2, 3, 5, 8.

---

# L. Manual verification requirements (read-only)

Run in the Supabase SQL editor as the project owner. All are `SELECT`-only unless marked; those marked **(tx)** use `BEGIN; ... ROLLBACK;` with `SET LOCAL ROLE` and make no persistent change. Do not paste output containing emails or tokens into shared channels.

**L-1 Buckets: visibility, limits, MIME rules** — confirms the two public buckets and finds missing limits.
```sql
select id, public, file_size_limit, allowed_mime_types from storage.buckets order by id;
```
**L-2 Object inventory** — confirms 206 / 11 and sizes; basis for the Premium worklist.
```sql
select bucket_id, count(*) files, pg_size_pretty(sum((metadata->>'size')::bigint)) total
from storage.objects group by bucket_id order by 1;
select bucket_id, split_part(name,'/',1) as top_folder, count(*) from storage.objects group by 1,2 order by 1,2;
```
**L-3 Storage policies** — shows whether `learn-media` can be listed and whether the premium resources policy was applied.
```sql
select policyname, cmd, roles, qual, with_check from pg_policies where schemaname='storage' and tablename='objects' order by policyname;
```
**L-4 Table privileges and RLS flags** — finds `anon` grants (C-CNT-03), any `INSERT` on profiles, tables without RLS.
```sql
select c.relname, c.relrowsecurity as rls, c.relforcerowsecurity as forced
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p') order by rls, c.relname;

select grantee, table_name, string_agg(privilege_type, ',' order by privilege_type) privs
from information_schema.role_table_grants
where table_schema='public' and grantee in ('anon','authenticated','public')
group by 1,2 order by 2,1;

select table_name, column_name, grantee, privilege_type
from information_schema.column_privileges
where table_schema='public' and table_name='profiles' and grantee in ('anon','authenticated') order by 2,3,4;
```
**L-5 Which repo tables actually exist live** — resolves drift (class planner, prediction, user_preferences, premium tables).
```sql
select table_name from information_schema.tables where table_schema='public' order by 1;
```
**L-6 Triggers on `auth.users` and `public.profiles`** — finds any other path that writes `profiles.role` from metadata.
```sql
select t.tgname, c.relname, n.nspname, pg_get_triggerdef(t.oid) def
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where not t.tgisinternal and ((n.nspname='auth' and c.relname='users') or (n.nspname='public' and c.relname in ('profiles','user_access')));
```
**L-7 All functions: SECURITY DEFINER, owner, search_path, EXECUTE for anon/authenticated** — core of C-APP-05 / C-AUTH-03.
```sql
select p.oid::regprocedure as fn, pg_get_userbyid(p.proowner) as owner, p.prosecdef as definer,
       p.proconfig as config,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_exec
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' order by p.prosecdef desc, 1::text;
```
**L-8 Definitions of the functions not in the repo** — review for `is_admin()`, ownership and input checks.
```sql
select proname, pg_get_functiondef(oid) from pg_proc
where pronamespace='public'::regnamespace
  and proname in ('is_admin','is_teacher_or_admin','handle_new_user','admin_update_profile_role_status',
                  'submit_and_mark_challenge','get_review_content','maybe_create_question_version','enforce_registration_open');
```
**L-9 Policies on every public table** — complete permissions inventory including question-bank tables the repo lacks.
```sql
select tablename, policyname, cmd, roles, qual, with_check from pg_policies where schemaname='public' order by tablename, cmd, policyname;
```
**L-10 Views and `security_invoker`** — finds views that bypass RLS.
```sql
select c.relname, c.reloptions from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('v','m') order by 1;
```
**L-11 Default privileges** — explains why `anon` has implicit grants.
```sql
select pg_get_userbyid(defaclrole) as owner, defaclobjtype, defaclacl from pg_default_acl;
```
**L-12 Registration enforcement trigger and settings** — confirms whether closed registration is server-enforced.
```sql
select tgname, tgenabled from pg_trigger where tgrelid='auth.users'::regclass and not tgisinternal;
select allow_student_registration, allow_teacher_registration, maintenance_mode from public.platform_settings;
```
**L-13 Role / status distribution (counts only)** — baseline before teacher backfill; detects unexpected admins.
```sql
select role, status, count(*) from public.profiles group by 1,2 order by 1,2;
```
**L-14 Self-declared teachers vs time** — shows scale of C-AUTH-01 (no emails selected).
```sql
select date_trunc('month', created_at) m, count(*) filter (where role='teacher') teachers, count(*) total
from public.profiles group by 1 order by 1;
```
**L-15 Metadata vs profile mismatch** — detects any role that does not match what signup requested.
```sql
select p.role as profile_role, u.raw_user_meta_data->>'role' as requested, count(*)
from public.profiles p join auth.users u on u.id=p.id group by 1,2 order by 3 desc;
```
**L-16 Admin MFA coverage (counts only)** — C-AUTH-04.
```sql
select count(*) filter (where f.id is not null) admins_with_verified_factor, count(*) admins
from public.profiles p left join auth.mfa_factors f on f.user_id=p.id and f.status='verified'
where p.role='admin';
```
**L-17 Premium/entitlement state** — confirms nothing reads it and shows data volume.
```sql
select plan, count(*) from public.user_access group by 1;
select access_tier, status, count(*) from public.resources group by 1,2;
```
**L-18 Exposure as `anon` (tx)** — proves or disproves C-CNT-03 without changing data.
```sql
begin;
set local role anon;
select 'learn_pages' t, count(*) from public.learn_pages;           -- error or 0 = good
select 'learn_blocks', count(*) from public.learn_blocks;
select 'questions', count(*) from public.questions;
select 'resources', count(*) from public.resources;
select 'objects question-media', count(*) from storage.objects where bucket_id='question-media';   -- >0 = enumerable
rollback;
```
(Each statement may need to be run separately because a permission error aborts the transaction.)
**L-19 Exposure as an ordinary authenticated test user (tx)** — set claims for a *test* account.
```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','<TEST_STUDENT_UUID>','role','authenticated')::text, true);
select count(*) from public.learn_blocks;
select count(*) from public.questions where status='published';
select * from public.mark_learn_check_answers('<PUBLISHED_PAGE_UUID>', '[]'::jsonb);   -- inspect shape only
rollback;
```
**L-20 Content volume to size C-CNT-01** — how much an extractor would obtain.
```sql
select (select count(*) from public.learn_pages where status='published') pages,
       (select count(*) from public.learn_blocks where visible) blocks,
       (select count(*) from public.questions where status='published') questions;
```
**L-21 Read-only check that `public` schema cannot be written by API roles** — search_path hijack prerequisite.
```sql
select has_schema_privilege('anon','public','CREATE') anon_create, has_schema_privilege('authenticated','public','CREATE') auth_create;
```

## Dashboard checks (no SQL)

| # | Where | What to confirm | Why |
|---|---|---|---|
| D-1 | Supabase → Authentication → Providers/Email | Confirm email ON; minimum password length; leaked-password protection; Secure password change ON; CAPTCHA | C-AUTH-07, C-CNT-01 |
| D-2 | Authentication → MFA | TOTP enabled; admin factors enrolled | C-AUTH-04 |
| D-3 | Authentication → URL Configuration | Site URL = production origin; Redirect URLs exact (no `*` in production) | open-redirect / token leakage |
| D-4 | Authentication → Rate limits; Sessions | Defaults reviewed; JWT expiry; refresh-token reuse detection | token abuse |
| D-5 | Settings → API | Exposed schemas = `public` only; `max_rows`; GraphQL disabled if unused | extraction cap |
| D-6 | Storage → Policies and bucket settings | Matches L-1..L-3; file size / MIME limits | E |
| D-7 | Database → Advisors (Security) | Resolve "SECURITY DEFINER view", "function search_path mutable", "RLS disabled", "anon can execute" findings | C-APP-05 |
| D-8 | Database → Backups | Daily backups / PITR; last restore drill date | C-OPS-01 |
| D-9 | Logs / Log drains | Retention, alerting on auth anomalies | C-APP-11 |
| D-10 | Vercel → Project → Settings → Deployment Protection | Vercel Authentication enabled for Preview | C-OPS-02 |
| D-11 | Vercel → Settings → Environment Variables | Only `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`; no secrets with `VITE_` prefix; Preview points at a non-production Supabase project; secrets marked Sensitive | H.3 |
| D-12 | Account security | 2FA on GitHub, Vercel, Supabase, npm, domain registrar, email | supply chain |
| D-13 | Run yourself (not run by me): `curl -sI https://<your-domain>/` and `curl -sI https://<your-domain>/assets/<hash>.js` | Headers, cache-control, absence of `.map` (`curl -s -o /dev/null -w "%{http_code}" https://<your-domain>/assets/<hash>.js.map` should not return a map) | C-APP-02, H.3 |

---

## Appendix 1 — Things I could not verify

- Any live Supabase object: grants, policies, function bodies, `is_teacher_or_admin()`, `admin_update_profile_role_status`, `submit_and_mark_challenge`, `get_review_content`, whether the optional migrations (registration enforcement, premium enforcement, class planner, SL/HL, prediction cycles) are applied. The repo itself records that class planner and prediction tables were found missing on a live export (`constants.js`, `disaster_recovery_rpc_incremental.sql` comments).
- Supabase Auth configuration (email confirmation, password rules, MFA, rate limits, redirect URLs, JWT expiry).
- Vercel project configuration (preview protection, env scoping, custom-domain headers, real response headers).
- Real behaviour in browsers (all rendering tests used jsdom; CSP effects untested).
- The existing `npm test` / `verify:*` suites (deliberately not executed to avoid any write to the repo).
- Exploit execution of any finding (none attempted).

## Appendix 2 — Evidence files (scratchpad, outside the repo)

`.../scratchpad/security/`: `audit-prod.json`, `audit-all.json`, `build.log`, `build2.log`, `dist/`, `dist2/`, `sqlscan.py`, `sqlscan.out`, `xss-test.mjs`, `iframe-test.mjs`, `redirect-test.mjs`.
