-- e-Lab: Question Bank Visual Management — storage migration (NOT run)
-- Reuses public.is_admin() (already exists live). Does not touch Learn
-- CMS tables or any existing Question Bank table.

begin;

-- question-media bucket — Admin-uploaded Question Bank images (the
-- "image" stimulus type). Public read: an uploaded diagram image carries
-- no secret information the way question_secrets does, so a public-read
-- bucket (same pattern as the existing learn-media bucket) is the
-- simplest correct choice — it lets Assess/Question Builder display
-- images directly with no signed-URL plumbing, while write access stays
-- Admin-only. If a future need arises for non-public question media,
-- that would be a deliberate separate decision, not implied by this one.
insert into storage.buckets (id, name, public)
values ('question-media', 'question-media', true)
on conflict (id) do nothing;

drop policy if exists "Public can read question media" on storage.objects;
create policy "Public can read question media"
  on storage.objects for select
  using (bucket_id = 'question-media');

drop policy if exists "Admins can upload question media" on storage.objects;
create policy "Admins can upload question media"
  on storage.objects for insert
  with check (bucket_id = 'question-media' and public.is_admin());

drop policy if exists "Admins can update question media" on storage.objects;
create policy "Admins can update question media"
  on storage.objects for update
  using (bucket_id = 'question-media' and public.is_admin());

drop policy if exists "Admins can delete question media" on storage.objects;
create policy "Admins can delete question media"
  on storage.objects for delete
  using (bucket_id = 'question-media' and public.is_admin());

commit;
