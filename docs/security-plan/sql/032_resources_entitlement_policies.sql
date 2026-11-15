-- =====================================================================================================
-- 032_resources_entitlement_policies.sql   --   DRAFT / NOT APPLIED / DATABASE+STORAGE / risk: MEDIUM
-- Phase P3.  Makes resources.access_tier real (today it is inert metadata) and separates the TEACHER ROLE from
-- PREMIUM and from SCHOOL-SPECIFIC content:
--   * audience (student / teacher / both) is still decided by profiles.role  -> a teacher sees teacher-audience
--     FREE resources, nothing more;
--   * access_tier = 'premium'  additionally requires has_entitlement('premium')  (role is irrelevant);
--   * organization_id (new, nullable) = school-specific/confidential resource: requires ACTIVE membership of that
--     organisation with an ACTIVE organisation entitlement (role is irrelevant);
--   * suspended accounts read nothing;
--   * the admin switch platform_settings.allow_resource_downloads (025) closes ALL resource files to students/teachers.
-- Supersedes the repo's unapplied resources-premium-enforcement-migration.sql (do NOT run that file; it ignores
-- starts_at and excludes admins).
--
-- PRECONDITIONS : 025 and 030 applied (025 provides resource_downloads_enabled()). Q08 + Q13 saved (live resources + storage policies; they may differ from the repo).
--                 Q24 reviewed: with default_resource_access/access_tier 'premium' rows present, applying this
--                 REMOVES access for non-entitled users -- that is the intent, but announce it.
-- RISK          : Medium (changes who can open files). Staged: run on staging with the P3 test matrix first.
-- ROLLBACK      : 032_resources_entitlement_policies_rollback.sql (policies restored from snapshot).
-- IDEMPOTENT    : yes.
-- =====================================================================================================
begin;
select secplan.snapshot_policies('032', 'public', 'resources');
select secplan.snapshot_policies('032', 'storage', 'objects');

alter table public.resources add column if not exists organization_id uuid references public.organizations(id) on delete set null;

create or replace function public.is_org_member(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.organization_members m
      join public.organization_entitlements oe on oe.organization_id = m.organization_id
     where m.organization_id = p_org and m.user_id = auth.uid() and m.status = 'active'
       and oe.revoked_at is null and oe.starts_at <= now() and (oe.expires_at is null or oe.expires_at > now()))
$$;
revoke all on function public.is_org_member(uuid) from public, anon;
grant execute on function public.is_org_member(uuid) to authenticated;

create or replace function public.can_read_resource_row(p_tier text, p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_active_account()
     and public.has_entitlement(case p_tier when 'premium' then 'premium' else 'free' end)
     and (p_org is null or public.is_org_member(p_org))
$$;
revoke all on function public.can_read_resource_row(text, uuid) from public, anon;
grant execute on function public.can_read_resource_row(text, uuid) to authenticated;

-- ---- table policies (same names as the repo's resources-migration.sql:111-126) --------------------------
drop policy if exists "Students can read published student resources" on public.resources;
create policy "Students can read published student resources" on public.resources for select to authenticated
  using (status = 'published' and audience in ('student', 'both')
         and exists (select 1 from public.profiles where id = auth.uid() and role = 'student')
         and public.can_read_resource_row(access_tier, organization_id));

drop policy if exists "Teachers can read published teacher resources" on public.resources;
create policy "Teachers can read published teacher resources" on public.resources for select to authenticated
  using (status = 'published' and audience in ('teacher', 'both')
         and exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher')
         and public.can_read_resource_row(access_tier, organization_id));
-- NOTE: row METADATA of locked/premium rows is still listable by design (the UI shows a lock). If premium titles
-- themselves are sensitive, drop the premium rows from this policy and serve a catalogue view instead (open question).

-- ---- storage policy: the file itself --------------------------------------------------------------------
drop policy if exists "Authorized users can read unlocked published resource files" on storage.objects;
create policy "Authorized users can read unlocked published resource files" on storage.objects for select to authenticated
  using (bucket_id = 'resources'
         and exists (select 1 from public.resources r join public.profiles p on p.id = auth.uid()
                      where r.file_path = storage.objects.name and r.status = 'published' and r.is_locked = false
                        and (r.audience = 'both' or r.audience = p.role)
                        and public.resource_downloads_enabled()
                        and public.can_read_resource_row(r.access_tier, r.organization_id)));
commit;
