-- =====================================================================================================
-- 010_preflight_readonly.sql   --   READ-ONLY / DRAFT / NOT EXECUTED BY THE AUTHOR
-- Run in the Supabase SQL editor BEFORE 010_resource_folders.sql.  Every statement is a SELECT.
-- Paste queries one at a time if the editor only shows the last result.  Save the output.
-- No query returns emails, passwords or file contents.
-- =====================================================================================================

-- P01  Preconditions: the objects 010 depends on must exist (expect true / true / true).
select to_regclass('public.resources') is not null                         as resources_table_exists,
       to_regprocedure('public.is_admin()') is not null                    as is_admin_exists,
       to_regprocedure('public.touch_updated_at()') is not null            as touch_updated_at_exists;

-- P02  Has any part of 010 already been applied? (expect false / false)
select to_regclass('public.resource_folders') is not null                  as folders_table_exists,
       exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'resources' and column_name = 'folder_id') as folder_id_column_exists;

-- P03  Current resources columns (compare with supabase/resources-migration.sql; look for drift).
select column_name, data_type, is_nullable, column_default
  from information_schema.columns where table_schema = 'public' and table_name = 'resources' order by ordinal_position;

-- P04  How many resources per category/audience (this is what the backfill will map).
select category, audience, count(*) from public.resources group by 1, 2 order by 1, 2;

-- P05  Categories the backfill will NOT map (anything outside the four legacy ids).  These keep folder_id NULL.
select category, audience, count(*) from public.resources
 where category not in ('ib-documents', 'study-materials', 'ib-resources', 'worksheets-other')
 group by 1, 2 order by 3 desc;

-- P06  Category/audience combinations that cross schemes (e.g. teacher audience with a student category).
select category, audience, count(*) from public.resources
 where (audience = 'teacher' and category in ('ib-documents', 'study-materials'))
    or (audience = 'student' and category in ('ib-resources', 'worksheets-other'))
 group by 1, 2;

-- P07  Existing RLS policies on resources (the new folder policies mirror these; compare to the repo).
select policyname, cmd, permissive, roles, qual, with_check from pg_policies
 where schemaname = 'public' and tablename = 'resources' order by policyname;

-- P08  Triggers on resources (the backfill disables/re-enables `set_updated_at`; confirm it exists and is enabled).
select tgname, tgenabled from pg_trigger where tgrelid = 'public.resources'::regclass and not tgisinternal;

-- P09  Table owner and RLS status (the backfill's ALTER TABLE ... DISABLE TRIGGER needs the owner role).
select c.relname, pg_get_userbyid(c.relowner) as owner, c.relrowsecurity as rls_enabled
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname = 'resources';

-- P10  Baseline for after-apply comparison: row count and a fingerprint of the columns 010 must not change.
select count(*) as resources,
       md5(string_agg(id::text || coalesce(category, '') || coalesce(file_path, '') || audience || status || is_locked::text || access_tier,
                      '|' order by id)) as untouched_columns_fingerprint
  from public.resources;

-- P11  Storage objects in the resources bucket (010 moves nothing; this is the before-count).
select count(*) as objects from storage.objects where bucket_id = 'resources';

-- P12  Default privileges / grants on resources (to mirror on the new table if grants hardening was applied).
select grantee, privilege_type from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'resources' order by grantee, privilege_type;

-- P13  Role names the policies rely on exist in profiles (expect student / teacher / admin rows).
select role, count(*) from public.profiles group by 1 order by 1;
