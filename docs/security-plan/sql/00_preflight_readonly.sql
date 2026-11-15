-- =====================================================================================================
-- 00_preflight_readonly.sql   --   DRAFT / READ-ONLY / NOT APPLIED
-- e-Lab.school Security Implementation Plan, Phase P0
--
-- Run in the Supabase SQL editor of the PRODUCTION project (and again on staging) as the project owner.
-- Every statement is a SELECT (or a BEGIN ... ROLLBACK block that changes nothing).
-- Paste each query individually if the editor only shows the last result set.
-- SAVE THE OUTPUT OFFLINE (encrypted drive) -- the outputs of Q03, Q04, Q06, Q07, Q08, Q09 are the
-- rollback source of truth for phases P2-P5. Do not paste outputs containing emails into shared channels.
-- No query selects emails, passwords, tokens or student answers.
-- This file was NOT executed by the author (no database access). Nothing in it has produced results yet.
-- =====================================================================================================

-- ---------- A. Inventory and baseline counts --------------------------------------------------------

-- Q01  Which tables / views exist live (resolves repo-vs-live drift: class planner, prediction tables, etc.)
select c.relname, c.relkind, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced,
       pg_get_userbyid(c.relowner) as owner
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r','p','v','m')
order by c.relkind, c.relname;

-- Q02  Row counts of the tables that matter (baseline to compare after every phase; counts only)
select 'profiles' t, count(*) from public.profiles
union all select 'learn_pages', count(*) from public.learn_pages
union all select 'learn_pages_published', count(*) from public.learn_pages where status = 'published'
union all select 'learn_blocks', count(*) from public.learn_blocks
union all select 'learn_check_questions', count(*) from public.learn_check_questions
union all select 'learn_manual_questions', count(*) from public.learn_manual_questions
union all select 'questions', count(*) from public.questions
union all select 'question_versions', count(*) from public.question_versions
union all select 'learning_progress', count(*) from public.learning_progress
union all select 'user_access', count(*) from public.user_access
union all select 'resources', count(*) from public.resources;
-- (If a table does not exist live, that line errors: delete the line and note it. Do not guess.)

-- Q03  Content fingerprints. After every phase re-run and compare: a changed value means content changed.
select 'learn_blocks_md5' as k, md5(string_agg(id::text || content::text || position::text || visible::text, '|' order by id)) from public.learn_blocks
union all
select 'learn_pages_md5', md5(string_agg(id::text || parent_topic || lesson_code || title || level || status, '|' order by id)) from public.learn_pages;

-- Q04  Role / status distribution (counts only). Baseline before P8; detects unexpected admins.
select role, status, count(*) from public.profiles group by 1, 2 order by 1, 2;

-- ---------- B. Storage -------------------------------------------------------------------------------

-- Q05  Buckets: visibility, size limit, MIME allow-list
select id, public, file_size_limit, allowed_mime_types from storage.buckets order by id;

-- Q06  Object inventory per bucket (confirms the 206 / 11 figures) and by top-level folder
select bucket_id, count(*) as files, pg_size_pretty(coalesce(sum((metadata->>'size')::bigint), 0)) as total_size
from storage.objects group by 1 order by 1;
select bucket_id, split_part(name, '/', 1) as top_folder, count(*) from storage.objects group by 1, 2 order by 1, 2;

-- Q07  MIME types actually stored (needed before tightening bucket allow-lists; SVG/HTML would be a finding)
select bucket_id, metadata->>'mimetype' as mime, count(*) from storage.objects group by 1, 2 order by 1, 2;

-- Q08  ALL storage.objects policies (is learn-media listable? is the premium resources policy applied?)
select policyname, cmd, roles, permissive, qual, with_check
from pg_policies where schemaname = 'storage' and tablename = 'objects' order by policyname;

-- Q09  Media reference map: every learn-media URL found in lesson block JSON, joined to the storage inventory.
--      Expected: every referenced URL resolves to an object (missing_object = 0). Unreferenced objects are listed too.
with refs as (
  select b.page_id, b.id as block_id,
         (regexp_matches(b.content::text, '/storage/v1/object/public/learn-media/([^"\s)\\]+)', 'g'))[1] as object_name
  from public.learn_blocks b
)
select (select count(*) from refs)                                                     as references_found,
       (select count(distinct object_name) from refs)                                  as distinct_referenced,
       (select count(*) from (select distinct object_name from refs) r
         where not exists (select 1 from storage.objects o where o.bucket_id = 'learn-media' and o.name = r.object_name)) as missing_object,
       (select count(*) from storage.objects o where o.bucket_id = 'learn-media'
         and not exists (select 1 from refs r where r.object_name = o.name))           as unreferenced_objects;
-- Per lesson: how many images each lesson references (the P5 worklist, ordered by size of job)
with refs as (
  select b.page_id, (regexp_matches(b.content::text, '/storage/v1/object/public/learn-media/([^"\s)\\]+)', 'g'))[1] as object_name
  from public.learn_blocks b
)
select p.parent_topic, p.lesson_code, p.title, p.status, count(distinct r.object_name) as images
from refs r join public.learn_pages p on p.id = r.page_id group by 1, 2, 3, 4 order by images desc, 1, 2;

-- Q10  Where else are public media URLs stored? (questions' visuals, manual check questions, resources)
select 'questions.visual_data' as col, count(*) from public.questions where visual_data::text like '%/object/public/%'
union all select 'questions.question_content', count(*) from public.questions where question_content::text like '%/object/public/%'
union all select 'questions.parts', count(*) from public.questions where parts::text like '%/object/public/%'
union all select 'learn_manual_questions.stimulus', count(*) from public.learn_manual_questions where stimulus::text like '%/object/public/%'
union all select 'learn_manual_questions.options', count(*) from public.learn_manual_questions where options::text like '%/object/public/%';
-- (column names are taken from the repo's code; if one errors, the live column name differs -- report it.)

-- ---------- C. Grants, policies, functions ------------------------------------------------------------

-- Q11  Table privileges for API roles (finds anon grants; anon should need ONLY platform_settings_public)
select grantee, table_name, string_agg(privilege_type, ',' order by privilege_type) as privs
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated', 'PUBLIC')
group by 1, 2 order by 2, 1;

-- Q12  Column-level privileges on profiles (confirms role/status/email UPDATE is denied to authenticated)
select column_name, grantee, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles' and grantee in ('anon', 'authenticated')
order by 1, 2, 3;

-- Q13  Every policy on every public table (complete permissions inventory incl. question bank tables the repo lacks)
select tablename, policyname, cmd, roles, permissive, qual, with_check
from pg_policies where schemaname = 'public' order by tablename, cmd, policyname;

-- Q14  All public functions: definer?, owner, search_path pin, EXECUTE for anon / authenticated, ACL
select p.oid::regprocedure::text as fn, pg_get_userbyid(p.proowner) as owner, p.prosecdef as security_definer,
       p.proconfig as config, p.prorettype::regtype::text as returns,
       has_function_privilege('anon', p.oid, 'EXECUTE')          as anon_exec,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_exec,
       p.proacl::text as acl
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' order by p.prosecdef desc, 1;

-- Q15  The SECURITY DEFINER functions NOT present in the repo -- READ THE BODIES. Copy them into
--      docs/security-plan/sql/010_baseline_live_functions.TEMPLATE.sql (then into supabase/baseline/).
select proname, pg_get_functiondef(oid) as definition
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('is_admin', 'is_teacher_or_admin', 'handle_new_user', 'admin_update_profile_role_status',
                  'submit_and_mark_challenge', 'get_review_content', 'maybe_create_question_version',
                  'enforce_registration_open', 'touch_updated_at', 'set_updated_at')
order by proname;

-- Q16  Any definer function in public that is NOT in the repo (names only), to catch surprises
select p.proname, p.oid::regprocedure::text as signature
from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef
order by 1;

-- Q17  Triggers on auth.users / profiles / user_access (other paths that write profiles.role from metadata)
select t.tgname, n.nspname as schema, c.relname as tbl, t.tgenabled, pg_get_triggerdef(t.oid) as definition
from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal and ((n.nspname = 'auth' and c.relname = 'users') or (n.nspname = 'public' and c.relname in ('profiles', 'user_access', 'learn_pages', 'learn_blocks')));

-- Q18  Views and whether they bypass RLS (security_invoker)
select c.relname, c.reloptions, pg_get_userbyid(c.relowner) as owner
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('v', 'm') order by 1;

-- Q19  Default privileges (explains implicit anon grants on future objects)
select pg_get_userbyid(defaclrole) as owner, defaclnamespace::regnamespace::text as schema, defaclobjtype, defaclacl::text from pg_default_acl;

-- Q20  Can API roles create objects in public (search_path hijack prerequisite)?
select has_schema_privilege('anon', 'public', 'CREATE') as anon_create, has_schema_privilege('authenticated', 'public', 'CREATE') as authenticated_create;

-- Q21  Extensions available / installed (decides whether pg_cron can prune the access log; pg_net is NOT required)
select name, default_version, installed_version from pg_available_extensions where name in ('pg_cron', 'pg_net', 'pgcrypto', 'pg_stat_statements') order by 1;

-- ---------- D. Roles, teachers, entitlements ------------------------------------------------------------

-- Q22  Metadata vs profile mismatch (detects roles that do not match what signup requested; counts only)
select p.role as profile_role, u.raw_user_meta_data ->> 'role' as requested_in_metadata, count(*)
from public.profiles p join auth.users u on u.id = p.id group by 1, 2 order by 3 desc;

-- Q23  Teachers by creation month (scale of self-declared teachers; no emails)
select date_trunc('month', created_at) as month, count(*) filter (where role = 'teacher') as teachers, count(*) as total
from public.profiles group by 1 order by 1;

-- Q24  Existing entitlement data (nothing reads it today; confirms what P3 must migrate)
select plan, count(*), count(*) filter (where expires_at is not null and expires_at < now()) as expired,
       count(*) filter (where starts_at is not null and starts_at > now()) as scheduled
from public.user_access group by 1 order by 1;
select access_tier, status, audience, count(*), count(*) filter (where is_locked) as locked
from public.resources group by 1, 2, 3 order by 1, 2, 3;

-- Q25  Admin MFA coverage (counts only)
select count(*) filter (where f.id is not null) as admins_with_verified_factor, count(*) as admins
from public.profiles p left join auth.mfa_factors f on f.user_id = p.id and f.status = 'verified'
where p.role = 'admin';

-- Q26  Profile fields that will matter for teacher metadata (distinct non-empty schools only; no personal data)
select count(*) filter (where role = 'teacher') as teachers,
       count(*) filter (where role = 'teacher' and coalesce(school, '') <> '') as teachers_with_school
from public.profiles;

-- Q27  Registration settings and whether enforcement trigger exists
select allow_student_registration, allow_teacher_registration, maintenance_mode from public.platform_settings;
select tgname, tgenabled from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal;

-- Q28  Content volume (sizes the extraction exposure; informs rate-limit thresholds)
select (select count(*) from public.learn_pages where status = 'published')                       as published_lessons,
       (select count(*) from public.learn_blocks where visible)                                     as visible_blocks,
       (select round(avg(c))::int from (select count(*) c from public.learn_blocks where visible group by page_id) s) as avg_blocks_per_lesson,
       (select max(c) from (select count(*) c from public.learn_blocks where visible group by page_id) s)             as max_blocks_per_lesson,
       (select count(*) from public.questions where status = 'published')                           as published_questions;

-- ---------- E. Exposure tests (change nothing; each in its own transaction) -------------------------------
-- Run each block SEPARATELY: a permission error aborts the transaction.

-- Q29  What can ANON read? (error 42501 or 0 = good; any positive count is an exposure)
begin; set local role anon; select 'learn_pages' as t, count(*) from public.learn_pages; rollback;
begin; set local role anon; select 'learn_blocks' as t, count(*) from public.learn_blocks; rollback;
begin; set local role anon; select 'questions' as t, count(*) from public.questions; rollback;
begin; set local role anon; select 'resources' as t, count(*) from public.resources; rollback;
begin; set local role anon; select 'objects in question-media (enumerable if > 0)' as t, count(*) from storage.objects where bucket_id = 'question-media'; rollback;
begin; set local role anon; select 'objects in learn-media (enumerable if > 0)' as t, count(*) from storage.objects where bucket_id = 'learn-media'; rollback;

-- Q30  What can an ordinary authenticated TEST account read? Replace the UUID with a TEST account (never a real student).
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '<TEST_STUDENT_UUID>', 'role', 'authenticated')::text, true);
select count(*) as blocks_visible from public.learn_blocks;
select count(*) as questions_visible from public.questions where status = 'published';
rollback;

-- ---------- F. Backup checks (the dashboard holds the rest) ----------------------------------------------
-- Q31  There is no SQL for Supabase backup/PITR state. Record manually (see plan, section "Backups required"):
--      Dashboard > Database > Backups: (1) plan and whether PITR is enabled, (2) timestamp of last daily backup,
--      (3) date of the last restore drill into a SEPARATE project. Do not start P2 until a restore drill has passed.
-- Q32  Database size, to estimate dump/restore time
select pg_size_pretty(pg_database_size(current_database())) as database_size;

-- Q33  External <img> hosts used inside lesson rich text (decides whether the optional allowedImageHosts sanitiser restriction is safe).
--      Any host other than your Supabase project host listed here would STOP rendering if the restriction were switched on.
select lower(m[1]) as image_host, count(*) as occurrences
from public.learn_blocks b,
     lateral regexp_matches(b.content::text, 'src=\\?"https?://([^/\\"]+)', 'g') as m
group by 1 order by 2 desc;
