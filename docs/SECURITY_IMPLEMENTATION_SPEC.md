# e-Lab.school — Priority Security Implementation: Protect Original Code, Lessons and Simulations

We have completed the comprehensive security audit.

I want to clarify my highest priority: **prevent unauthorized access to, extraction of, or redistribution of e-Lab's original educational content and simulation materials.**

The website is currently free or partially free, but it will eventually introduce Premium and School subscriptions.

Users must access lessons and simulations through the website. Download, export and PDF-generation functions must only be available when explicitly enabled by the administrator.

I understand that browser-rendered text, images and JavaScript cannot be made mathematically impossible to copy. Implement the strongest practical security without introducing misleading protections or damaging the educational experience.

## 1. Protect the original source code

Inspect Vite, Vercel and the complete repository.

Ensure:
- No original source files, SQL migrations, secrets, backups or development files are included in public deployments.
- Production source maps are explicitly disabled.
- Repository access is private and appropriately restricted.
- No service-role keys, database credentials or private environment variables are exposed to the browser.
- Public static assets contain only what is necessary for the frontend.
- Administration APIs enforce authorization independently of whether their JavaScript is visible.

Identify which simulation code and datasets are unavoidably browser-delivered and which can remain exclusively server-side.

Never claim that lazy loading, minification or obfuscation makes frontend code confidential.

## 2. Restrict lesson content delivery

Investigate all `learn_pages`, `learn_blocks`, question and related content APIs.

Design backend authorization that checks:
- Valid session.
- Active account.
- Publication status.
- User role where relevant.
- Free or Premium access tier.
- Subscription expiry.
- School entitlement where applicable.
- Existing SL/HL rules.

Prevent unauthorized direct Supabase requests from retrieving premium material.

Avoid unrestricted access to the entire lesson corpus.

Where appropriate, serve individual lesson content through a narrowly scoped, authorized backend function instead of broad unrestricted table reads.

Ensure database RLS and grants protect the underlying records. Simply adding an RPC while leaving broad direct SELECT access is not sufficient.

Introduce appropriate pagination and rate limiting while preserving normal student navigation.

Do not accidentally expose teacher-only or administrative content.

## 3. Protect images, diagrams and media

The live application has:
- 206 images in `learn-media`.
- 11 images in `question-media`.

Both are currently public.

Do not change bucket visibility immediately.

Prepare a reversible migration using private storage for protected content.

Requirements:
- Classify public/demo images separately from protected images.
- Use authenticated retrieval or appropriately short-lived signed URLs.
- Check lesson access before granting file access.
- Prevent unauthorized listing and bulk downloads.
- Update lesson rendering so images continue to work.
- Avoid permanent premium-media URLs in public lesson JSON.
- Preserve all existing media and references.
- Test existing lessons before and after migration.
- Do not delete public copies until replacement paths are verified and approved.

Remember that time-limited URLs do not prevent authorized users from saving displayed media.

## 4. Secure simulations

Audit all simulation routes and engines, especially:
- Spectroscopy Studio.
- Mass Spectrometry.
- IR Spectroscopy.
- NMR.
- Structure Investigation.
- Other interactive chemistry simulations.

Current public routes and JavaScript bundles expose simulation logic and scientific data.

Design a realistic protection model:

- Keep browser-side rendering, WebGL and time-sensitive animations efficient.
- Move valuable proprietary datasets that do not need to be embedded into entitlement-checked server services.
- Move confidential challenge solutions and grading to server-side functions.
- Ensure Premium-only data cannot be fetched using a Free account.
- Prevent unauthorized direct data API access.
- Preserve the scientific accuracy and responsiveness of all simulations.
- Keep free demonstration versions available only where explicitly designated.

Do not assume that protecting a React route prevents users from downloading static JavaScript bundles.

Explicitly identify any engine code that remains publicly retrievable and the trade-offs of stronger delivery methods.

## 5. Control printing, downloading and exporting

Inspect every user-facing:
- Download button.
- Print button.
- PDF export.
- Word export.
- Media download link.
- Simulation export.
- Resource viewer.
- API endpoint exposing complete content.

For protected student-facing Learn pages, remove unnecessary application-provided export controls.

Allow only explicitly administrator-authorized resources to be downloaded.

Retain legitimate Question Paper Builder exports and administrator backups where appropriate, with their own permissions.

Do not globally disable browser accessibility features, keyboard shortcuts or text selection.

Consider unobtrusive user-attribution watermarks on premium material and authorized exports.

Do not describe watermarking as copy prevention.

## 6. Stop unauthorized extraction

Develop measures against bulk scraping and automated downloading.

Include:
- Authentication and entitlement checks.
- Backend rate limiting.
- Per-account request-volume controls.
- Appropriate query-size and pagination limits.
- Detection of abnormal lesson and dataset retrieval.
- Account suspension enforced server-side.
- Audit records for unusual access.
- Safe logging without unnecessarily collecting personal data.

A premium subscriber should be able to study normally, but automated extraction of hundreds of lessons should be detected and constrained.

## 7. Protect against hacking and corruption

Fix genuine vulnerabilities identified in the audit.

Prioritize:
- Vulnerable DOMPurify dependency.
- Unverified privileged RPCs.
- Database grants and RLS.
- Supabase Storage access policies.
- Unsafe uploaded content.
- Cross-site scripting.
- Admin authentication and MFA.
- Security headers and tested CSP.
- Sensitive backups and restore permissions.
- Unauthorized modification or deletion of lesson content.
- Audit logs and tested backups.

Do not make destructive changes to production.

## 8. Future Premium access

Support:
- Public demonstrations.
- Free registered content.
- Premium individual subscriptions.
- School subscriptions.
- Administrator-authorized downloads.

Build a single server-enforced authorization approach.

Payment status must never be trusted from frontend variables or editable user metadata.

Premium access must stop when an entitlement expires, including direct database and storage requests.

An expired subscriber retains access only to content allowed by the Free tier.

Do not implement payment collection yet.

## 9. Confirmed registration decisions

Keep Student and Teacher registration open.

Do not require manual teacher approval for ordinary teacher features.

School or personal email addresses are allowed.

The Teacher form should use the previously agreed required school name and dropdown professional fields.

Allow multiple active login sessions for now. Do not implement device or session-count restrictions.

Teacher role alone must not grant Premium access or confidential school-specific privileges.

## 10. Implementation rules

Preserve:
- Every Learn lesson.
- Every scientific animation and simulation.
- Existing student progress.
- Existing users.
- Current lesson ordering.
- Admin content-editing functionality.
- Question Paper Builder.
- Approved teacher exports.
- Website appearance and performance.

Work in separately tested phases.

Begin by preparing the exact fixes for source protection, authorization, content extraction, private storage and Premium access.

Before implementation, provide:
1. Specific files to modify.
2. SQL migrations required.
3. Production risks.
4. Backups required.
5. Staging test plan.
6. Rollback plan.
7. Remaining limitations for browser-visible code and content.

You may implement low-risk local application changes only after clearly separating them from database and production changes and receiving explicit approval.

**Do not execute production migrations, change bucket visibility, delete media or deploy without approval.**

The final objective is a secure, performant, Premium-ready e-Lab.school where users can learn interactively but cannot obtain protected materials through unauthorized access paths or built-in export functions.
