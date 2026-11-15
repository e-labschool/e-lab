-- =====================================================================================================
-- 022_question_media_listing.sql   --   DRAFT / NOT APPLIED / STORAGE (production) / risk: LOW-MEDIUM
-- Phase P2.  Fixes C-STO-01 (bucket enumeration) and C-STO-03 (upload validation) WITHOUT changing bucket
-- visibility and WITHOUT touching any of the 11 files.
--
-- Technical basis: objects in a PUBLIC bucket are served from /storage/v1/object/public/... without
-- consulting storage.objects RLS; the SELECT policy only governs the API paths (list / download / sign).
-- Dropping the anonymous SELECT policy therefore stops enumeration; existing image URLs keep working.
-- THIS IS A CLAIM ABOUT SUPABASE BEHAVIOUR that the author could not test: the staging test (plan P2, test 3)
-- fetches an existing question-media URL before and after and MUST return HTTP 200 both times before production.
--
-- Safety: the DO block drops only SELECT policies on storage.objects whose expression mentions
-- 'question-media' and does NOT mention is_admin; it aborts if it finds more than one (human review).
-- ROLLBACK: 022_question_media_listing_rollback.sql
-- IDEMPOTENT: yes.
-- =====================================================================================================
begin;
select secplan.snapshot_policies('022', 'storage', 'objects');

do $$
declare r record; n int := 0;
begin
  select count(*) into n from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and cmd = 'SELECT'
     and qual like '%question-media%' and qual not like '%is_admin%';
  if n > 1 then
    raise exception 'Found % anonymous question-media SELECT policies; review Q08 and drop by name', n;
  end if;
  for r in select policyname from pg_policies
            where schemaname = 'storage' and tablename = 'objects' and cmd = 'SELECT'
              and qual like '%question-media%' and qual not like '%is_admin%'
  loop
    execute format('drop policy %I on storage.objects', r.policyname);
    raise notice 'dropped anonymous SELECT policy %', r.policyname;
  end loop;
end $$;

drop policy if exists "Admins can read question media" on storage.objects;
create policy "Admins can read question media" on storage.objects
  for select to authenticated
  using (bucket_id = 'question-media' and public.is_admin());

-- Upload validation at the bucket level (admin uploads are not validated client-side: questionBankService.js:151-161).
-- Existing objects are unaffected. Q07 must show that the 11 existing files are within this list; if one is
-- image/svg+xml or another type, DO NOT run this block until the open question is answered.
update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
 where id = 'question-media';
commit;
