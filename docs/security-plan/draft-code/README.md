# draft-code (NOT APPLIED to /home/claude/e-lab)

Everything here was produced in a scratch copy outside the repo and exported as patches. `git apply --check` was run against the pristine repo for every patch in this folder (all apply cleanly); the patches were **not** applied.

| Patch | Phase | Needs DB first? |
|---|---|---|
| `P1/P1a_build_deps_sanitizer_video.patch` | P1 | no |
| `P1/P1b_catalog_cache.patch` | P1 | no |
| `P1-export/P1c_…apply_only_after_sql_025.patch` | P1 (export UI) | **yes: 025** |
| `P4/P4_lesson_delivery_client…patch` | P4 | **yes: 040** (client is not wired into the UI yet) |
| `P5/P5_private_media…patch` | P5 | **yes: 050** (resolver + admin scripts, not wired into the renderer yet) |
| `P7/P7_backup_encryption.patch` | P7 | no (not wired into the backup UI) |
| `package/package.json.wiring_and_deps.patch` | P1 | no; also adds `test:security` and `check:build-security` scripts |
| `package/package-lock.json.regenerate_with_npm_install.patch` | P1 | prefer running `npm install dompurify@^3.4.17 vite@^8.3.8` yourself |
| `package/test-security-libs.mjs.NEW` | tests | same file is inside ALL_… patch |
| `ALL_local_app_changes_except_lockfile.patch` | all | combined |

Tests that run without any live Supabase (jsdom / pure Node): `scripts/test-sanitize-html.mjs` (30), `scripts/test-security-libs.mjs` (16), `scripts/check-learn-export-controls.mjs`, `scripts/check-build-security.mjs dist`. In the scratch copy the full existing suite plus these passes and the build produces 0 source maps.

Scripts `copy-media-to-private.mjs` and `compare-lesson-images.mjs` talk to Supabase/HTTP only when you run them: dry-run by default, credentials read from environment variables at run time and never printed; **not run**.

Not drafted on purpose: wiring the delivery client / storage-ref resolver into React components, the admin upload switch to private buckets, the MFA UI and the Teacher form (open question) — each needs the DB phase on staging first.
