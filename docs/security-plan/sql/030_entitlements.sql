-- =====================================================================================================
-- 030_entitlements.sql   --   DRAFT / NOT APPLIED / DATABASE (production) / risk: MEDIUM (schema), LOW (behaviour)
-- Phase P3.  Single server-enforced authorization model: public demo / free registered / premium individual /
-- school / admin.  NO payment collection.  Nothing here reads user_metadata or any client-writable field.
--
-- BEHAVIOUR CHANGE ON APPLY: none. New learn_pages columns default to access_tier='free', audience_scope='all'
-- (= exactly today's rule: any signed-in user). Functions are created but no policy/RPC uses them until P4.
--
-- ADMIN PATH: today's Admin -> Access page writes public.user_access (one row per user). A bridge trigger copies
-- those rows into public.entitlements so the admin UI keeps working unchanged. Later the UI can call
-- admin_grant_entitlement directly and the bridge can be dropped.
-- BUG FIXED vs the repo's unapplied resources-premium-enforcement-migration.sql: user_access_overview.effective_plan
-- ignores starts_at, so a SCHEDULED premium plan would grant access early. has_entitlement() honours starts_at,
-- expiry, revocation and account status.
--
-- PRECONDITIONS : 019/020/021 applied and verified. Q24 reviewed (what user_access contains).
-- RISK          : ALTER TABLE learn_pages ADD COLUMN ... DEFAULT is metadata-only on PG11+ (very short lock).
--                 DEPENDENCY: restore_elab_content / restore_elab_disaster_data list learn_pages columns explicitly
--                 (backup_restore_rpc_incremental.sql:98-105) so a restore would reset the two new columns to
--                 their defaults. Before ANY lesson is set to premium/public the restore RPCs must be updated
--                 (see plan P3 gate 'backup round trip').
-- ROLLBACK      : 030_entitlements_rollback.sql (drops new objects; export entitlements first).
-- IDEMPOTENT    : yes.
-- =====================================================================================================
begin;

-- ---- 0. audit log (shared with P4/P7/P8) --------------------------------------------------------
create table if not exists public.admin_audit_log (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  actor   uuid,
  action  text not null,
  target  uuid,
  details jsonb not null default '{}'::jsonb
);
alter table public.admin_audit_log enable row level security;
drop policy if exists "Admins read audit log" on public.admin_audit_log;
create policy "Admins read audit log" on public.admin_audit_log for select to authenticated using (public.is_admin());
revoke all on public.admin_audit_log from public, anon, authenticated;
grant select on public.admin_audit_log to authenticated;      -- writes only via definer functions

create or replace function public.write_admin_audit(p_action text, p_target uuid, p_details jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.admin_audit_log(actor, action, target, details) values (auth.uid(), p_action, p_target, coalesce(p_details, '{}'::jsonb));
$$;
revoke all on function public.write_admin_audit(text, uuid, jsonb) from public, anon, authenticated;

-- ---- 1. content classification columns -------------------------------------------------------------
alter table public.learn_pages
  add column if not exists access_tier    text not null default 'free'  check (access_tier in ('public', 'free', 'premium')),
  add column if not exists audience_scope text not null default 'all'   check (audience_scope in ('all', 'teacher'));
create index if not exists learn_pages_access_tier_idx on public.learn_pages (access_tier) where status = 'published';

-- ---- 2. entitlement tables -------------------------------------------------------------------------
create table if not exists public.entitlements (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  tier         text not null check (tier in ('premium', 'school')),
  source       text not null default 'admin_grant' check (source in ('admin_grant', 'user_access_sync', 'payment')),
  starts_at    timestamptz not null default now(),
  expires_at   timestamptz,                       -- NULL = no expiry (admin's explicit choice)
  revoked_at   timestamptz,
  granted_by   uuid references auth.users(id),
  note         text,
  external_ref text,                              -- future payment-provider id, written only by a verified webhook
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists entitlements_user_idx on public.entitlements (user_id);
create unique index if not exists entitlements_user_sync_uidx on public.entitlements (user_id) where source = 'user_access_sync';

create table if not exists public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 200),
  created_at timestamptz not null default now()
);
create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  member_role     text not null default 'member' check (member_role in ('org_admin', 'member')),
  status          text not null default 'active' check (status in ('active', 'removed')),
  added_at        timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index if not exists organization_members_user_idx on public.organization_members (user_id);
create table if not exists public.organization_entitlements (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  starts_at       timestamptz not null default now(),
  expires_at      timestamptz,
  revoked_at      timestamptz,
  seats           int check (seats is null or seats > 0),
  note            text,
  created_at      timestamptz not null default now()
);
create index if not exists organization_entitlements_org_idx on public.organization_entitlements (organization_id);

do $$ declare t text; begin
  foreach t in array array['entitlements', 'organizations', 'organization_members', 'organization_entitlements'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);        -- writes: definer RPCs only
  end loop;
end $$;

drop policy if exists "Users read own entitlements" on public.entitlements;
create policy "Users read own entitlements" on public.entitlements for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Admins read all entitlements" on public.entitlements;
create policy "Admins read all entitlements" on public.entitlements for select to authenticated using (public.is_admin());
drop policy if exists "Members read own organization" on public.organizations;
create policy "Members read own organization" on public.organizations for select to authenticated
  using (exists (select 1 from public.organization_members m where m.organization_id = organizations.id and m.user_id = (select auth.uid()) and m.status = 'active'));
drop policy if exists "Admins read organizations" on public.organizations;
create policy "Admins read organizations" on public.organizations for select to authenticated using (public.is_admin());
drop policy if exists "Users read own membership" on public.organization_members;
create policy "Users read own membership" on public.organization_members for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Admins read memberships" on public.organization_members;
create policy "Admins read memberships" on public.organization_members for select to authenticated using (public.is_admin());
drop policy if exists "Admins read org entitlements" on public.organization_entitlements;
create policy "Admins read org entitlements" on public.organization_entitlements for select to authenticated using (public.is_admin());

-- ---- 3. decision functions (the ONLY place entitlements are interpreted) ------------------------------
create or replace function public.tier_rank(p_tier text) returns int
language sql immutable set search_path = '' as $$
  select case p_tier when 'public' then 0 when 'anon' then 0 when 'inactive' then 0 when 'free' then 1
                     when 'premium' then 2 when 'school' then 2 when 'admin' then 3 else 99 end
$$;

create or replace function public.current_tier() returns text
language sql stable security definer set search_path = '' as $$
  select case
    when auth.uid() is null then 'anon'
    when not exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.status, 'active') = 'active') then 'inactive'
    when exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then 'admin'
    when exists (select 1 from public.entitlements e where e.user_id = auth.uid() and e.revoked_at is null
                  and e.starts_at <= now() and (e.expires_at is null or e.expires_at > now())) then 'premium'
    when exists (select 1 from public.organization_members m
                   join public.organization_entitlements oe on oe.organization_id = m.organization_id
                  where m.user_id = auth.uid() and m.status = 'active' and oe.revoked_at is null
                    and oe.starts_at <= now() and (oe.expires_at is null or oe.expires_at > now())) then 'school'
    else 'free' end
$$;

create or replace function public.is_active_account() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.status, 'active') = 'active')
$$;

create or replace function public.has_entitlement(p_required text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case when p_required = 'public' then true
              else public.tier_rank(public.current_tier()) >= public.tier_rank(p_required) end
$$;

-- Can the CURRENT caller read this lesson?  Used by: get_lesson_page (P4), storage policies (P5),
-- and (replacing the old helper bodies) the Learn-check RPCs.  Teacher role does NOT bypass the tier test.
create or replace function public.can_read_lesson(p_page_id uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  lp     record;
  pr     record;
  v_tier text := public.current_tier();
begin
  select id, status, level, access_tier, audience_scope into lp from public.learn_pages where id = p_page_id;
  if not found then return false; end if;
  if v_tier = 'admin' then return true; end if;                       -- admin: drafts too (editor/preview)
  if lp.status <> 'published' then return false; end if;
  if v_tier = 'inactive' then return false; end if;                   -- suspended / missing profile
  if not public.has_entitlement(lp.access_tier) then return false; end if;
  select role, level into pr from public.profiles where id = auth.uid();
  if lp.audience_scope = 'teacher' and coalesce(pr.role, '') not in ('teacher', 'admin') then return false; end if;
  -- Existing SL/HL rule, unchanged in meaning (learn_sl_hl_access_and_flow_incremental.sql:37-52):
  -- non-students (teachers) see both levels; HL students see all; SL students never see HL-only lessons.
  return coalesce(pr.role, 'student') <> 'student'
      or upper(coalesce(pr.level, 'SL')) = 'HL'
      or upper(coalesce(lp.level, 'SL/HL')) <> 'HL';
end $$;

revoke all on function public.tier_rank(text), public.current_tier(), public.is_active_account(),
                       public.has_entitlement(text), public.can_read_lesson(uuid) from public;
grant execute on function public.tier_rank(text) to anon, authenticated;
grant execute on function public.current_tier(), public.has_entitlement(text), public.can_read_lesson(uuid) to anon, authenticated;
grant execute on function public.is_active_account() to authenticated;

-- ---- 4. admin write paths (explicit authorization; independent of any visible JS) ----------------------
create or replace function public.admin_grant_entitlement(p_user_id uuid, p_tier text, p_expires_at timestamptz,
                                                         p_starts_at timestamptz default now(), p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_tier not in ('premium', 'school') then raise exception 'Invalid tier'; end if;
  if p_expires_at is not null and p_expires_at <= coalesce(p_starts_at, now()) then raise exception 'Expiry must be after start'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then raise exception 'Unknown user'; end if;
  insert into public.entitlements (user_id, tier, source, starts_at, expires_at, granted_by, note)
  values (p_user_id, p_tier, 'admin_grant', coalesce(p_starts_at, now()), p_expires_at, auth.uid(), left(p_note, 500))
  returning id into v_id;
  perform public.write_admin_audit('entitlement_grant', p_user_id, jsonb_build_object('entitlement_id', v_id, 'tier', p_tier, 'expires_at', p_expires_at));
  return v_id;
end $$;

create or replace function public.admin_revoke_entitlement(p_entitlement_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  if not public.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  update public.entitlements set revoked_at = now(), updated_at = now()
   where id = p_entitlement_id and revoked_at is null returning user_id into v_user;
  if v_user is null then raise exception 'No active entitlement with that id'; end if;
  perform public.write_admin_audit('entitlement_revoke', v_user, jsonb_build_object('entitlement_id', p_entitlement_id));
end $$;

create or replace function public.admin_create_organization(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  insert into public.organizations(name) values (left(p_name, 200)) returning id into v_id;
  perform public.write_admin_audit('org_create', null, jsonb_build_object('organization_id', v_id));
  return v_id;
end $$;

create or replace function public.admin_set_org_member(p_org uuid, p_user uuid, p_member_role text default 'member', p_status text default 'active') returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  insert into public.organization_members (organization_id, user_id, member_role, status) values (p_org, p_user, p_member_role, p_status)
  on conflict (organization_id, user_id) do update set member_role = excluded.member_role, status = excluded.status;
  perform public.write_admin_audit('org_member_set', p_user, jsonb_build_object('organization_id', p_org, 'status', p_status));
end $$;

create or replace function public.admin_grant_org_entitlement(p_org uuid, p_expires_at timestamptz, p_seats int default null, p_note text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  insert into public.organization_entitlements (organization_id, expires_at, seats, note) values (p_org, p_expires_at, p_seats, left(p_note, 500)) returning id into v_id;
  perform public.write_admin_audit('org_entitlement_grant', null, jsonb_build_object('organization_id', p_org, 'entitlement_id', v_id, 'expires_at', p_expires_at));
  return v_id;
end $$;

revoke all on function public.admin_grant_entitlement(uuid, text, timestamptz, timestamptz, text), public.admin_revoke_entitlement(uuid),
                       public.admin_create_organization(text), public.admin_set_org_member(uuid, uuid, text, text),
                       public.admin_grant_org_entitlement(uuid, timestamptz, int, text) from public, anon;
grant execute on function public.admin_grant_entitlement(uuid, text, timestamptz, timestamptz, text), public.admin_revoke_entitlement(uuid),
                          public.admin_create_organization(text), public.admin_set_org_member(uuid, uuid, text, text),
                          public.admin_grant_org_entitlement(uuid, timestamptz, int, text) to authenticated;

-- ---- 5. bridge from the existing Admin -> Access page (user_access) ------------------------------------
create or replace function public.sync_user_access_to_entitlement() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.plan in ('premium', 'school') then
    insert into public.entitlements (user_id, tier, source, starts_at, expires_at, granted_by, note)
    values (new.user_id, new.plan, 'user_access_sync', coalesce(new.starts_at, new.created_at, now()), new.expires_at, new.created_by, 'synced from user_access')
    on conflict (user_id) where source = 'user_access_sync'
    do update set tier = excluded.tier, starts_at = excluded.starts_at, expires_at = excluded.expires_at, revoked_at = null, updated_at = now();
  else
    update public.entitlements set revoked_at = now(), updated_at = now()
     where user_id = new.user_id and source = 'user_access_sync' and revoked_at is null;
  end if;
  return new;
end $$;
revoke all on function public.sync_user_access_to_entitlement() from public, anon, authenticated;

drop trigger if exists sync_user_access_to_entitlement on public.user_access;
create trigger sync_user_access_to_entitlement after insert or update on public.user_access
  for each row execute function public.sync_user_access_to_entitlement();

-- one-time backfill (idempotent: the unique partial index + ON CONFLICT make a re-run a no-op update)
insert into public.entitlements (user_id, tier, source, starts_at, expires_at, granted_by, note)
select ua.user_id, ua.plan, 'user_access_sync', coalesce(ua.starts_at, ua.created_at, now()), ua.expires_at, ua.created_by, 'backfilled from user_access'
from public.user_access ua where ua.plan in ('premium', 'school')
on conflict (user_id) where source = 'user_access_sync' do nothing;

commit;
