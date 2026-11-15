# e-Lab.school — Comprehensive Security, Intellectual Property & Premium Access Audit

You are acting as a senior application security engineer, Supabase/PostgreSQL security specialist, and full-stack React/Vite architect.

I want you to conduct an exceptionally thorough security inspection of my existing educational platform, **e-Lab.school**.

This is a proprietary educational website containing original IB Chemistry lessons, interactive scientific simulations, images, assessments, student accounts, learning progress, and administrative functionality. I intend to expand to additional subjects and introduce Premium and School subscription plans.

**IMPORTANT: THIS IS AN AUDIT-ONLY TASK. DO NOT MODIFY CODE, EXECUTE MIGRATIONS, CHANGE STORAGE SETTINGS OR DEPLOY ANYTHING UNTIL I EXPLICITLY APPROVE THE IMPLEMENTATION.**

## 1. Security objectives

The website must remain educationally excellent, responsive, user-friendly and suitable for students and teachers.

I want strong protection against:

- Unauthorized access to lessons and premium content.
- Theft or mass extraction of original lesson material.
- Unauthorized downloading of diagrams, images and learning resources.
- Unnecessary PDF exports or printing of protected lessons.
- Exposure of proprietary scientific algorithms and datasets.
- Theft of confidential source code or developer credentials.
- Unauthorized access to student and school information.
- Administrator and teacher privilege escalation.
- Circumvention of premium subscription controls.
- Database and Supabase Storage vulnerabilities.
- Cross-site scripting, injection attacks and account compromise.
- Automated scraping and excessive content retrieval.
- Improper exposure of assessment answers.
- Exploitation of insecure dependencies or deployment configuration.

Understand that browser-visible content cannot be made completely impossible to copy, screenshot or inspect. I want genuine security engineering, not cosmetic or ineffective restrictions.

## 2. Inspect the entire repository

Inspect every relevant file, including:

- React components, routes and protected routes.
- Vite build and deployment configuration.
- Authentication providers and session management.
- Supabase client initialization.
- Supabase SQL schema, migrations, triggers, RLS and database grants.
- Supabase Storage configuration and object policies.
- Learn CMS and rich-text rendering.
- Lesson media delivery.
- Question Bank and question-paper generation.
- Student progress and user profiles.
- Teacher and administrator functions.
- Resources, exports and downloads.
- Interactive simulation engines and molecular datasets.
- Spectroscopy Studio, including MS, IR, NMR and Structure Investigation.
- Third-party dependencies.
- Environment variables, configuration and secrets handling.
- Vercel hosting, security headers and caching.

Do not limit the inspection to files that appear obviously related to security.

Build a complete map of how users, browsers, database tables, storage files and simulation assets interact.

Identify which security controls exist only in the interface and which are genuinely enforced by the backend.

## 3. Previous live Supabase verification results

We have already inspected parts of the live Supabase database.

Use the following verified information and compare it against the repository. Do not assume that repository SQL exactly reflects the live deployment.

### Storage configuration

Two buckets are currently public:

- `learn-media`: 206 files.
- `question-media`: 11 files.

Total: **217 files in publicly accessible buckets**.

We have not changed their visibility because existing lessons depend on image URLs and we do not want to break them.

### Existing Storage policies

`learn-media` has administrator-gated upload, update and delete policies using `is_admin()`.

`question-media` has administrator-gated write/delete policies but also a public SELECT policy:

`USING (bucket_id = 'question-media')`

The `resources` bucket uses authenticated resource-reading policies based on audience, publication status, locking and role checks.

Evaluate these protections, including the limitations of public buckets, signed URLs, object listing and cache behaviour.

### Administrator authorization function

The live database contains:

```sql
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$function$;
```

Investigate the function owner, EXECUTE grants, search path, role trust boundary and all database operations that depend upon it.

### Profile column-level permissions

The live database returns:

- `id`: UPDATE denied.
- `email`: UPDATE denied.
- `role`: UPDATE denied.
- `status`: UPDATE denied.
- `created_at`: UPDATE denied.
- `updated_at`: UPDATE denied.

Authenticated users can update:

- `full_name`
- `school`
- `country`
- `grade_or_class`
- `curriculum`
- `level`

Therefore, an ordinary authenticated role cannot directly update the sensitive columns using its ordinary database privileges.

Do not incorrectly report direct modification of `profiles.role` as a confirmed exploit.

Still investigate any alternate routes through triggers, functions, grants and privileged endpoints.

### Registration trigger

The live `on_auth_user_created` trigger invokes `public.handle_new_user()`.

The function is SECURITY DEFINER and uses an empty search path with explicitly qualified table references.

Its role assignment logic is:

```sql
CASE
  WHEN new.raw_user_meta_data ->> 'role'
       IN ('student', 'teacher')
    THEN new.raw_user_meta_data ->> 'role'
  ELSE 'student'
END
```

This prevents direct self-registration as `admin`.

However, **users can request a teacher role through client-controlled signup metadata**.

Assess whether this gives unauthorized access to teacher-only resources or functionality.

### Teacher-related database policies

The live database includes:

- `question_papers`: teacher-gated SELECT and ALL policies restricted to records with `user_id = auth.uid()`.
- `question_paper_items`: teacher-gated SELECT and ALL policies restricted to items belonging to the user's own papers.
- `resources`: published teacher-audience resources accessible when `profiles.role = 'teacher'`.

Some policies use `is_teacher_or_admin()`, whose live implementation still needs verification.

Review other policies and privileged endpoints as well; the above policies are not an exhaustive permissions inventory.

## 4. Teacher approval architecture

Determine whether users should be able to select Teacher at signup while obtaining only restricted permissions until approved by an administrator.

Recommend the simplest robust design that:

- Preserves the Student and Teacher registration interface.
- Prevents unauthorized teacher privilege acquisition.
- Keeps already-approved teachers working.
- Records pending teacher requests.
- Allows secure administrator approval and rejection.
- Prevents clients from directly modifying approval status.
- Avoids forcing unnecessary account creation changes.
- Does not break existing teacher-authored question papers.
- Supports future school subscriptions.

Do not implement this until the current authorization model and user migration implications have been reviewed.

## 5. Premium access architecture

Inspect all existing subscription tables, flags and access checks.

Develop a consistent authorization model supporting:

1. Public demonstrations.
2. Free authenticated students.
3. Approved teachers.
4. Premium individual accounts.
5. School/institution subscriptions.
6. Administrators.

Identify exactly how premium entitlements should apply to:

- Learn lesson content.
- Lesson media.
- Question Bank resources.
- Interactive simulations.
- Protected scientific datasets.
- Downloadable worksheets.
- Student learning progress.

The backend or database must enforce access decisions independently of the interface.

A premium label, hidden route or disabled button is not security.

Plan for future payment integration without introducing an unnecessary payment system now.

## 6. Content protection and downloading

Investigate every method by which content can be accessed, copied, exported or retrieved.

Specifically inspect:

- Browser-accessible images.
- Supabase public asset URLs.
- Signed URLs.
- Browser print and PDF export.
- Document-generation functions.
- Media download links.
- Network requests returning lesson content.
- Static JavaScript simulation bundles.
- Direct simulation URLs.
- Offline or cached content.
- Bulk data extraction endpoints.
- Question and answer-key exposure.

Recommend genuine security measures such as private asset authorization, server-side content gates, least-privilege database access, selective watermarks and controlled resource delivery.

Clearly explain which types of copying cannot be prevented in ordinary web browsers.

Do not propose disabling developer tools, right-click or text selection as primary security controls.

Preserve legitimate accessibility and teaching functionality.

## 7. Simulation intellectual-property protection

Inspect all scientific simulation engines, with particular attention to:

- NMR.
- IR spectroscopy.
- Mass spectrometry.
- Structure elucidation.
- Molecular models and animation logic.
- Proprietary datasets and scientific calculations.

Identify which code must remain client-side for smooth rendering and which sensitive logic could reasonably be protected server-side.

Evaluate public routes, dynamic imports, compiled JavaScript chunks and source-map exposure.

Do not falsely claim that JavaScript obfuscation makes code inaccessible.

Recommend a realistic architecture balancing intellectual-property protection, performance, cost and maintainability.

## 8. Application security audit

Examine:

- Authentication and token management.
- Session persistence and revocation.
- Password recovery.
- Admin authentication and MFA.
- SQL injection and unsafe RPCs.
- RLS bypasses.
- SECURITY DEFINER function safety.
- Function EXECUTE privileges.
- Access to unpublished lessons.
- Cross-user data exposure.
- XSS through CMS and rich-text rendering.
- Unsafe image, SVG, HTML and URL uploads.
- External links and embeds.
- CSRF where applicable.
- CORS configuration.
- Rate limiting.
- Automated scraping.
- Error-message information exposure.
- Dependency vulnerabilities.
- Supply-chain threats.
- Security headers and Content Security Policy.
- Logging and monitoring.
- Backup security.

Prioritize actual exploit paths over theoretical issues.

## 9. Investigate Vercel configuration

Inspect the deployment architecture and determine:

- Whether sensitive files can be publicly served.
- Whether production source maps are exposed.
- Whether environment variables are safely managed.
- Whether deployment previews are appropriately restricted.
- Whether security headers are configured.
- Whether protected responses are cacheable.
- Whether public static JavaScript bundles reveal proprietary simulation logic.
- Whether any API endpoints need stronger validation.

Provide exact recommended configuration changes, but do not deploy them.

## 10. Testing requirements

Run safe, non-destructive checks where possible.

Perform:

- Source-code security scanning.
- Dependency vulnerability checks.
- Static permission analysis.
- Route authorization inspection.
- Frontend build verification.
- Tests for entitlement bypasses.
- Tests for privilege escalation assumptions.
- Tests for unsafe rich-text rendering.
- Tests for unauthorized resource access.

Do not conduct destructive tests or aggressive probing against the live production website.

Do not use real student records in test cases.

If testing requires access to Supabase, produce read-only verification SQL and explain the purpose of each query.

Do not fabricate results for tests that cannot be executed.

## 11. Required audit report

Produce:

**e-Lab.school — Comprehensive Security Audit and Protection Strategy**

Organize the report into these sections:

### A. Executive assessment

Overall current security posture and the highest-priority risks.

### B. Verified protections

What is already correctly implemented and should be preserved.

### C. Vulnerability register

For every finding, provide:

- Finding ID.
- Severity: Critical, High, Medium or Low.
- Exact affected files.
- Relevant code or SQL.
- Exploit scenario.
- Impact.
- Whether confirmed or conditional.
- Recommended remediation.
- Regression risk.
- Priority.

### D. Authentication and role findings

Including administrator privileges, teacher registration and profile security.

### E. Storage and content exposure

Including the 217 existing files.

### F. Premium authorization design

With free/premium/school access model.

### G. Intellectual-property protection

Including realistic limits on copying and source-code confidentiality.

### H. Application and deployment hardening

Including React, Supabase, Vercel and dependencies.

### I. Safe implementation roadmap

Break implementation into independently testable phases.

### J. Exact proposed code changes

List files to edit, new files to create, database migrations and deployment settings.

Do not implement yet.

### K. Testing and rollback plans

Explain how to demonstrate that login, lessons, simulations, images and user progress still work.

### L. Manual verification requirements

Provide carefully scoped read-only Supabase queries and dashboard checks for unverified live settings.

## 12. Non-negotiable restrictions

- Do not modify code during this audit.
- Do not run migrations.
- Do not alter production RLS policies.
- Do not change public buckets to private yet.
- Do not delete or relocate any of the 217 media files.
- Do not interfere with existing student and teacher accounts.
- Do not change the website's appearance.
- Do not rewrite any simulation unnecessarily.
- Do not break existing Learn lessons.
- Do not change student progress data.
- Do not introduce heavy performance overhead.
- Do not expose passwords, tokens or private keys.
- Do not claim absolute prevention of browser copying.
- Do not report unverified live vulnerabilities as confirmed.

## 13. Final instruction

Thoroughly examine the complete codebase and compare it with the live database information above.

Identify all meaningful security loopholes, including indirect privilege escalation, content exposure, unauthorized teacher access, premium-content bypass and possible information leakage.

Produce a highly detailed, evidence-based report with actionable recommendations.

**Do not begin implementation. Present the complete audit and wait for my approval.**

Our priority is to make e-Lab.school secure, copyright-conscious, scalable and premium-ready while retaining every existing educational feature.
