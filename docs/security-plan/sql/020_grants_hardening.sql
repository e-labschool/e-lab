-- =====================================================================================================
-- 020_grants_hardening.sql   --   DRAFT / NOT APPLIED / DATABASE (production) / risk: MEDIUM
-- Phase P2.  Fixes C-APP-05 and C-CNT-03 from docs/SECURITY_AUDIT_REPORT.md.
--
-- WHAT IT DOES
--   1. Takes an ACL snapshot (secplan.snapshot_acls('020')).
--   2. For every SECURITY DEFINER function in schema public EXCEPT the allow-list below:
--        REVOKE EXECUTE FROM PUBLIC and anon.
--        Re-GRANT EXECUTE to `authenticated` ONLY IF authenticated had it before (so nothing a signed-in
--        user could call yesterday stops working).
--        Trigger functions (RETURNS trigger): also revoke from `authenticated` -- they must not be callable
--        through /rest/v1/rpc. (Postgres checks EXECUTE on a trigger function only at CREATE TRIGGER time,
--        not when the trigger fires; the staging test 'signup still works' proves this on Supabase.)
--   3. REVOKE ALL on every table/view in public from anon, except platform_settings_public.
--
-- ALLOW-LIST (keep anon EXECUTE): is_admin, is_teacher_or_admin.  Reason: RLS policies call them with the
--   caller's privileges; if anon loses EXECUTE, ANY anon query touching a table whose policy mentions them
--   fails with "permission denied for function" instead of returning zero rows. They return false for anon,
--   leak nothing, and are removed from the allow-list only after step 3 is verified (see plan P2 notes).
--
-- PRECONDITIONS : 019 applied. P0 outputs saved (Q11, Q14). Q11 reviewed: any anon grant you KNOW the site
--                 needs must be added to the 'keep' list in step 3 BEFORE running.
-- RISK          : Medium. If a public page/feature relied on an anon grant, it breaks (visible as 401/403 on the
--                 anon REST call). Mitigation: staging run + anon route sweep (plan P2 test plan).
-- ROLLBACK      : 020_grants_hardening_rollback.sql (re-grants from the snapshot).
-- IDEMPOTENT    : yes (re-running revokes the same things again; the first snapshot is preserved).
-- =====================================================================================================
begin;

select secplan.snapshot_acls('020');

do $$
declare
  r record;
  v_auth boolean;
  v_keep text[] := array['is_admin', 'is_teacher_or_admin'];
  n_func int := 0;
begin
  for r in
    select p.oid, p.oid::regprocedure as sig, (p.prorettype = 'trigger'::regtype) as is_trigger
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef and p.proname <> all (v_keep)
  loop
    v_auth := has_function_privilege('authenticated', r.oid, 'EXECUTE');
    execute format('revoke execute on function %s from public, anon', r.sig);
    if r.is_trigger then
      execute format('revoke execute on function %s from authenticated', r.sig);
    elsif v_auth then
      execute format('grant execute on function %s to authenticated', r.sig);
    end if;
    n_func := n_func + 1;
  end loop;
  raise notice 'P2/020: processed % SECURITY DEFINER functions', n_func;
end $$;

do $$
declare r record; n_rel int := 0;
begin
  for r in
    select c.oid::regclass as rel
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and c.relname not in ('platform_settings_public')          -- <-- extend this 'keep' list from Q11 if needed
  loop
    execute format('revoke all on %s from anon', r.rel);
    n_rel := n_rel + 1;
  end loop;
  raise notice 'P2/020: revoked anon privileges on % relations', n_rel;
end $$;

-- platform_settings_public must stay readable before sign-in (registration availability, maintenance screen).
grant select on public.platform_settings_public to anon, authenticated;

-- OPTIONAL (left commented; decide after the first run): stop FUTURE tables inheriting anon grants.
-- alter default privileges for role postgres in schema public revoke all on tables    from anon;
-- alter default privileges for role postgres in schema public revoke all on functions from anon;

commit;

-- Post-check (read-only):  Q14 (anon_exec should be false for everything except the allow-list),
--                          Q11 (anon should list only platform_settings_public).
