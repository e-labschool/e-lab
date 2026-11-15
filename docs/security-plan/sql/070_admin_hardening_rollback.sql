-- Rollback for 070_admin_hardening.sql -- DRAFT / NOT APPLIED.
begin;
delete from public.security_limits where key = 'require_admin_mfa';   -- FIRST: switches MFA enforcement off immediately
select secplan.restore_functions('070');                              -- original is_admin() body
drop trigger if exists audit_profile_privileged_changes on public.profiles;
drop function if exists public.audit_profile_privileged_changes();
drop function if exists public.admin_log_event(text, jsonb);
commit;
