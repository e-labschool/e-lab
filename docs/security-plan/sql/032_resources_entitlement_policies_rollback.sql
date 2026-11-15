-- Rollback for 032_resources_entitlement_policies.sql -- DRAFT / NOT APPLIED.
begin;
select secplan.restore_policies('032', 'public', 'resources');
select secplan.restore_policies('032', 'storage', 'objects');
drop function if exists public.can_read_resource_row(text, uuid);
drop function if exists public.is_org_member(uuid);
alter table public.resources drop column if exists organization_id;
commit;
