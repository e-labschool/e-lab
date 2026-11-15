-- =====================================================================================================
-- 041_lesson_table_lockdown.sql   --   DRAFT / NOT APPLIED / DATABASE (production) / risk: HIGH
-- Phase P4b.  REMOVES the broad direct SELECT on learn_pages / learn_blocks / learn_check_questions /
-- learn_manual_questions for everyone except admins.  An RPC alone is not enough: while these policies exist,
-- any signed-in account can still `from('learn_blocks').select('*')` the whole corpus (C-CNT-01).
--
-- Admins are unaffected: their `is_admin()` policies ("Admins can read/write ...") are kept. Students, teachers and
-- everything else lose direct table reads and must use get_lesson_page / list_lesson_catalog /
-- get_learn_check_items / mark_learn_check_answers (all definer functions, so they still work).
--
-- HARD GATE (do not run until ALL are true):
--   [1] 040 applied on production and verified;
--   [2] the app version that reads lessons through the RPCs is DEPLOYED and has run on production for a full week
--       with the legacy-fallback counter at zero (draft-code/P4/lessonDeliveryClient.js reports fallbacks);
--   [3] staging acceptance tests (sql/tests/staging_acceptance_tests.sql, P4 section) pass;
--   [4] backups taken (plan section 'Backups required').
-- Mechanism: drops every SELECT policy on those 4 tables whose expression does not mention is_admin(); aborts if the
-- count per table is not exactly 1 (so an unexpected live policy forces a human look).
-- ROLLBACK: 041_lesson_table_lockdown_rollback.sql (restores the snapshotted policies; instantaneous).
-- IDEMPOTENT: yes.
-- =====================================================================================================
begin;
select secplan.snapshot_policies('041', 'public', 'learn_pages');
select secplan.snapshot_policies('041', 'public', 'learn_blocks');
select secplan.snapshot_policies('041', 'public', 'learn_check_questions');
select secplan.snapshot_policies('041', 'public', 'learn_manual_questions');

do $$
declare t text; r record; n int;
begin
  foreach t in array array['learn_pages', 'learn_blocks', 'learn_check_questions', 'learn_manual_questions'] loop
    select count(*) into n from pg_policies
     where schemaname = 'public' and tablename = t and cmd = 'SELECT' and qual not like '%is_admin%';
    if n > 1 then raise exception 'table %: % non-admin SELECT policies found (expected at most 1); review Q13', t, n; end if;
    for r in select policyname from pg_policies
              where schemaname = 'public' and tablename = t and cmd = 'SELECT' and qual not like '%is_admin%' loop
      execute format('drop policy %I on public.%I', r.policyname, t);
      raise notice 'dropped % on %', r.policyname, t;
    end loop;
  end loop;
end $$;
commit;
-- Post-check: as a TEST student (sql/tests): select count(*) from public.learn_blocks;  -> 0
--             select (public.get_lesson_page('<published lesson id>')) ->> 'ok';         -> true
