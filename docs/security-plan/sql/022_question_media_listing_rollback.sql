-- Rollback for 022_question_media_listing.sql -- DRAFT / NOT APPLIED.
begin;
drop policy if exists "Admins can read question media" on storage.objects;
select secplan.restore_policies('022', 'storage', 'objects');   -- recreates the dropped anonymous SELECT policy (and re-creates same-named others identically)
-- Bucket limits: restore the values you recorded from Q05 before running 022 (shown here as 'no limit'):
update storage.buckets set file_size_limit = null, allowed_mime_types = null where id = 'question-media';
commit;
