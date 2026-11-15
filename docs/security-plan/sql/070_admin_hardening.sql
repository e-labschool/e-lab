-- =====================================================================================================
-- 070_admin_hardening.sql   --   DRAFT / NOT APPLIED / DATABASE (production) / risk: HIGH if the flag is switched on
--                                prematurely; LOW while the flag row is absent.
-- Phase P7.  (1) Optional MFA (AAL2) requirement inside is_admin(), controlled by a FLAG ROW so it can be switched on
--           and OFF instantly from the SQL editor; (2) audit trigger for role/status changes; (3) client-reported
--           audit hook for admin exports/restores.
--
-- BEHAVIOUR ON APPLY: IDENTICAL to today (the flag row 'require_admin_mfa' does not exist, so the aal2 clause is not
--   evaluated).  Body copied from the live definition quoted in docs/SECURITY_AUDIT_SPEC.md section 3, with
--   search_path tightened from 'public' to '' and the table schema-qualified.  RE-READ THE LIVE BODY (Q15) FIRST; if it
--   differs from the spec, stop.
-- SWITCHING ON (only after: every admin has a VERIFIED TOTP factor (Q25), and each has signed in with it on staging AND
--   production, and a second break-glass admin exists):
--        insert into public.security_limits (key, value, description) values ('require_admin_mfa', 1, 'admins must be AAL2');
-- SWITCHING OFF / BREAK-GLASS (SQL editor runs as postgres and is not affected by is_admin()):
--        delete from public.security_limits where key = 'require_admin_mfa';
-- WHY IT COVERS EVERYTHING: every admin RPC and every admin RLS policy calls is_admin(), so one flag covers role changes,
--   backups/restores, answer-key exports, entitlement grants and Learn content writes.
-- Dependencies: 030 (write_admin_audit), 040 (security_limits).    ROLLBACK: 070_admin_hardening_rollback.sql
-- =====================================================================================================
begin;
select secplan.snapshot_function('070', 'public.is_admin()'::regprocedure);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
     and ( not exists (select 1 from public.security_limits where key = 'require_admin_mfa')
           or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2' )
$$;
-- is_admin keeps its existing EXECUTE grants (RLS evaluates it as the caller); CREATE OR REPLACE preserves them.

-- ---- audit every role/status change, whichever path made it ------------------------------------------------------
create or replace function public.audit_profile_privileged_changes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.role is distinct from old.role or new.status is distinct from old.status then
    insert into public.admin_audit_log (actor, action, target, details)
    values (auth.uid(), 'profile_role_status_change', new.id,
            jsonb_build_object('role_from', old.role, 'role_to', new.role, 'status_from', old.status, 'status_to', new.status));
  end if;
  return new;
end $$;
revoke all on function public.audit_profile_privileged_changes() from public, anon, authenticated;
drop trigger if exists audit_profile_privileged_changes on public.profiles;
create trigger audit_profile_privileged_changes after update on public.profiles
  for each row execute function public.audit_profile_privileged_changes();

-- ---- client-reported audit (best effort: a compromised browser could omit it; server-side paths are audited above) ----
create or replace function public.admin_log_event(p_action text, p_details jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_action not in ('backup_export', 'disaster_export', 'restore_content', 'restore_disaster', 'answer_key_export', 'bulk_import') then
    raise exception 'Unknown audit action';
  end if;
  perform public.write_admin_audit('client:' || p_action, null, jsonb_build_object('summary', left(p_details::text, 2000)));
end $$;
revoke all on function public.admin_log_event(text, jsonb) from public, anon;
grant execute on function public.admin_log_event(text, jsonb) to authenticated;
commit;
