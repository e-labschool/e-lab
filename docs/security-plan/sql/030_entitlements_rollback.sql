-- Rollback for 030_entitlements.sql -- DRAFT / NOT APPLIED.
-- BEFORE RUNNING: export  select * from public.entitlements;  organizations, organization_members,
-- organization_entitlements, admin_audit_log  (rows created after P3 exist nowhere else).
-- Run AFTER 040/041/050 rollbacks (they reference can_read_lesson / the new columns).
begin;
drop trigger if exists sync_user_access_to_entitlement on public.user_access;
drop function if exists public.sync_user_access_to_entitlement();
drop function if exists public.admin_grant_org_entitlement(uuid, timestamptz, int, text);
drop function if exists public.admin_set_org_member(uuid, uuid, text, text);
drop function if exists public.admin_create_organization(text);
drop function if exists public.admin_revoke_entitlement(uuid);
drop function if exists public.admin_grant_entitlement(uuid, text, timestamptz, timestamptz, text);
drop function if exists public.can_read_lesson(uuid);
drop function if exists public.has_entitlement(text);
drop function if exists public.is_active_account();
drop function if exists public.current_tier();
drop function if exists public.tier_rank(text);
-- CASCADE only removes the policies/constraints that belong to these new tables (they reference each other).
drop table if exists public.organization_entitlements cascade;
drop table if exists public.organization_members cascade;
drop table if exists public.organizations cascade;
drop table if exists public.entitlements cascade;
drop index if exists public.learn_pages_access_tier_idx;
alter table public.learn_pages drop column if exists access_tier, drop column if exists audience_scope;
-- admin_audit_log and write_admin_audit are deliberately KEPT (audit evidence). Drop manually only if you must.
commit;
