-- e-Lab: Admin Access migration
--
-- NOT run automatically. Review, then run in the Supabase SQL Editor.
-- Adds one new table (`user_access`) and one new view
-- (`user_access_overview`) — does not touch profiles, resources, or any
-- existing RLS policy on them.

-- ============================================================
-- user_access
-- One current entitlement row per user (student/teacher). No row at all
-- means "free" — free users never need a payment/entitlement record,
-- per the brief. Deliberately references public.profiles(id) rather than
-- auth.users(id): both ultimately identify the same person, but this lets
-- PostgREST embed/join profiles + user_access directly (used by the
-- Admin Access and Admin Users pages), which a plain auth.users
-- reference would not support.
-- ============================================================
create table if not exists public.user_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'premium', 'school')),
  starts_at timestamptz,
  expires_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_access enable row level security;

-- Users can read their OWN entitlement (needed later to gate premium
-- content client-side) but can never modify it themselves.
create policy "Users can read own access"
  on public.user_access for select
  using (auth.uid() = user_id);

create policy "Admins can read all access records"
  on public.user_access for select
  using (public.is_admin());

create policy "Admins can insert access records"
  on public.user_access for insert
  with check (public.is_admin());

create policy "Admins can update access records"
  on public.user_access for update
  using (public.is_admin())
  with check (public.is_admin());

-- No delete policy — "remove premium/school" is done by setting plan
-- back to 'free' (see accessService.js), not by deleting the row, so the
-- start/expiry history and created_by audit trail are preserved.

drop trigger if exists set_updated_at on public.user_access;
create trigger set_updated_at before update on public.user_access
  for each row execute function public.touch_updated_at(); -- reuses the function from schema.sql

-- ============================================================
-- user_access_overview
-- Computes access_status and effective_plan in the database — "do not
-- fake these statuses" — so both Admin Access and Admin Users read the
-- exact same, correctly-derived values, and so filtering by plan/status
-- can happen server-side (not by fetching everything and filtering in
-- JS). `security_invoker = true` is essential: without it, a view runs
-- with the VIEW OWNER's privileges and would silently bypass RLS; with
-- it, the view enforces the QUERYING user's own RLS exactly as if they'd
-- queried profiles/user_access directly — a student querying this view
-- still only ever sees their own row.
-- ============================================================
create or replace view public.user_access_overview
with (security_invoker = true) as
select
  p.id as user_id,
  p.full_name,
  p.email,
  p.role,
  p.school,
  p.country,
  p.status as account_status,
  p.created_at as joined_at,
  coalesce(ua.plan, 'free') as plan,
  ua.starts_at,
  ua.expires_at,
  case
    when ua.plan is null or ua.plan = 'free' then 'active'
    when ua.starts_at is not null and ua.starts_at > now() then 'scheduled'
    when ua.expires_at is not null and ua.expires_at < now() then 'expired'
    else 'active'
  end as access_status,
  -- The stored `plan` is the admin's intent; `effective_plan` is what
  -- should actually gate content right now — expired premium/school
  -- falls back to free access here, without ever overwriting the
  -- historical `plan` value itself.
  case
    when ua.expires_at is not null and ua.expires_at < now() then 'free'
    else coalesce(ua.plan, 'free')
  end as effective_plan
from public.profiles p
left join public.user_access ua on ua.user_id = p.id
where p.role in ('student', 'teacher');

grant select on public.user_access_overview to authenticated;
