# Decisions and open questions (needed from the owner before the matching phase)

Nothing below was assumed or invented; where a default is proposed it is labelled and changes nothing until you confirm.

| # | Question | Blocks | Proposed default (not applied) |
|---|---|---|---|
| 1 | **Teacher registration form fields.** The "previously agreed required school name and dropdown professional fields" are not in the repo, the spec or the audit. Which fields, which dropdown options, which are required? | P8 UI | `school_name` required (as stated); no other field invented. `080` stores fields as validated data once defined. |
| 2 | **Which images are public/demo vs protected?** (206 `learn-media`, 11 `question-media`.) A per-lesson or per-folder rule, or a list? | P5 | Unclassified = protected; demo only if the lesson itself is `public`. |
| 3 | **Which simulations / tabs are free demos** (anonymous), which need a free account, which are Premium? | P6, P3 | Everything stays publicly runnable until you provide the list. |
| 4 | **Premium split:** which lessons are `public`, `free`, `premium`? Is the flag per lesson (proposed: `learn_pages.access_tier`) or per topic/unit? Are check-questions and resources tiered with their lesson? | P3, P4 | All existing lessons `free` (= today's behaviour). |
| 5 | **SL/HL rule details:** keep exactly today's rule (teachers and admins see HL; students see HL only if their level is HL; SL/HL lessons visible to all)? Should a premium lesson also be level-restricted? | P4 | Preserve the current rule unchanged. |
| 6 | **Media whose storage path belongs to a different lesson than the one displaying it** (same image reused, or a block moved between lessons). Draft `can_read_media_path` authorises a file by the lesson id in its path (`lessons/<page_id>/…`), so a reader of lesson B would be refused a file stored under premium lesson A. Choose: re-upload/copy into the displaying lesson's folder (proposed), or add a media-reference table so any readable referencing lesson grants the file. P0 Q-map counts how many such cases exist. | P5 | Count first; copy under the displaying lesson's path. |
| 7 | **Where do admin download/export settings live?** Proposed: two columns on `platform_settings` (`allow_resource_downloads`, `allow_teacher_exports`) edited in Admin → Settings. Per-resource flags too? Does "Approved teacher exports" mean Question Paper Builder only? | P1f, P2 | Both default to enabled (today's behaviour). |
| 8 | **Supabase plan limits** (Edge Functions, RPC/DB connections, storage egress/signing rates, PITR) and **Vercel plan** (edge rate limiting, deployment protection). | P4 limits, P9 | SQL-level limits only; no Edge Function dependency. |
| 9 | **Rate-limit thresholds.** Proposed numbers (20 calls/min; soft 40 and hard 80 distinct lessons/hour; hard 200/day) are guesses, not measurements. Soft mode first? How long to observe? | P4 | Soft/audit only for two weeks, then decide. |
| 10 | **Anonymous (public tier) volume:** acceptable to leave un-rate-limited per account? Edge limiting needed? | P4 | Keep the public tier small. |
| 11 | **CSP violation reporting endpoint** (none exists); acceptable to rely on browser-console soak on a preview? HSTS `includeSubDomains`? | P1H, P9 | No endpoint; no `preload`. |
| 12 | **Admin MFA:** which admins, TOTP only? Break-glass admin? When to enforce? | P7 | Flag off until all admins enrolled and tested. |
| 13 | **Backups:** where are encrypted dumps stored, who holds the passphrase, retention, who runs the restore drill? | P0 | – |
| 14 | **Unseen live functions** (`is_teacher_or_admin`, `maybe_create_question_version`, `admin_update_profile_role_status`, `submit_and_mark_challenge`, `get_review_content`): approve a read-only capture of their bodies. | P0, P2 | – |
| 15 | **Attribution watermark** on premium pages/authorised exports: wanted? (Attribution only, never "protection".) | optional | Not built. |
| 16 | **Public copies of media:** after verification, written approval is needed before any deletion. | P5 end | Never delete by default. |
| 17 | **GitHub / Vercel settings** (repo privacy, collaborators, source protection) — I could not inspect them; please confirm or share a read-only screenshot. | P9 | – |
