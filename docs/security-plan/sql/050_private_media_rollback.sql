-- Rollback for 050_private_media.sql -- DRAFT / NOT APPLIED.
-- Step 1 (instant, safe, do this first if anything looks wrong):  update public.learn_pages set media_mode = 'public';
--   -> every lesson serves its public URLs again; nothing was ever deleted from the public buckets.
-- Step 2 (only to remove the objects of this phase; the private buckets must be EMPTIED via the Storage API/dashboard first):
begin;
update public.learn_pages set media_mode = 'public';
create or replace function public.rewrite_media_refs(p_page_id uuid, p_content jsonb) returns jsonb
language sql stable set search_path = '' as $$ select p_content $$;
drop function if exists public.admin_set_lesson_media_mode(uuid, text);
drop policy if exists "Admins manage learn-media-private" on storage.objects;
drop policy if exists "Entitled users read learn-media-private" on storage.objects;
drop policy if exists "Admins manage question-media-private" on storage.objects;
drop policy if exists "Entitled users read question-media-private" on storage.objects;
drop function if exists public.can_read_media_path(text, text);
-- Buckets: delete from the dashboard after emptying (Supabase blocks deleting non-empty buckets via SQL).
--   delete from storage.buckets where id in ('learn-media-private','question-media-private');   -- only when empty
alter table public.learn_pages drop column if exists media_mode;
commit;
