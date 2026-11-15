-- Rollback for 040_lesson_delivery.sql -- DRAFT / NOT APPLIED.
-- Run AFTER 041_rollback (direct reads restored) and AFTER the app is switched back to direct reads
-- (feature flag off), otherwise students lose lesson access.
begin;
select secplan.restore_functions('040');            -- puts back the two original helper bodies
drop function if exists public.get_lesson_page(uuid, int, int);
drop function if exists public.list_lesson_catalog(int, int);
drop function if exists public.lesson_rate_check(uuid);
drop function if exists public.rewrite_media_refs(uuid, jsonb);
drop function if exists public.admin_access_summary(int);
drop function if exists public.prune_content_access_log(int);
drop function if exists public.security_limit(text, int);
-- Logs are evidence; export before dropping:  select * from public.security_events;
drop table if exists public.content_access_log;
drop table if exists public.security_events;
drop table if exists public.security_limits;
commit;
