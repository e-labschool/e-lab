-- e-Lab: Platform Settings migration
--
-- NOT run automatically. Review, then run in the Supabase SQL Editor.
--
-- NAMING NOTE (please read): every earlier e-Lab migration (schema.sql,
-- resources-migration.sql, admin-users-migration.sql,
-- admin-access-migration.sql) created and reused a trigger FUNCTION named
-- public.touch_updated_at() — the TRIGGER itself was always named
-- set_updated_at, which may be what's being remembered as the function
-- name. Rather than guess which name is truly live in your project, this
-- migration defines public.set_updated_at() fresh via `create or
-- replace function` — safe to run whether or not a function by that name
-- already exists, and it will not conflict with touch_updated_at() (a
-- separate, differently-named function) if that's what your other
-- tables actually use. You may want to consolidate to one name later;
-- that's a non-urgent cleanup, not a functional problem — both do the
-- same thing.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- platform_settings
-- Deliberately a singleton table (id is always 1) — "one platform-wide
-- settings record is enough" per the brief. No secrets live here:
-- no service-role keys, no SMTP credentials, no payment keys — see
-- settingsService.js and AdminSettings.jsx, neither of which ever
-- collects or displays anything like that.
-- ============================================================
create table if not exists public.platform_settings (
  id int primary key default 1 check (id = 1),

  platform_name text not null default 'e-Lab',
  tagline text not null default 'Making Science Interactive.',
  support_email text,
  contact_email text,

  allow_student_registration boolean not null default true,
  allow_teacher_registration boolean not null default true,

  default_curriculum text not null default 'IB DP Chemistry',
  default_resource_access text not null default 'free' check (default_resource_access in ('free', 'premium')),

  maintenance_mode boolean not null default false,
  maintenance_message text not null default 'e-Lab is currently undergoing scheduled maintenance. Please check back shortly.',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed the single row now, so the app never needs to INSERT client-side —
-- only ever UPDATE. Safe to re-run (on conflict do nothing).
insert into public.platform_settings (id) values (1) on conflict (id) do nothing;

alter table public.platform_settings enable row level security;

-- Only admins can read/write the base table directly — it's not
-- considered "safe public configuration" as a whole (e.g. contact_email
-- isn't something every anonymous visitor's client needs). Public,
-- pre-auth access goes ONLY through the curated view below.
create policy "Admins can read platform settings"
  on public.platform_settings for select
  using (public.is_admin());

create policy "Admins can update platform settings"
  on public.platform_settings for update
  using (public.is_admin())
  with check (public.is_admin());

-- No insert/delete policy: the single row is seeded once above by this
-- migration; the app only ever updates it.

drop trigger if exists set_updated_at on public.platform_settings;
create trigger set_updated_at before update on public.platform_settings
  for each row execute function public.set_updated_at();

-- ============================================================
-- platform_settings_public
-- A curated view exposing ONLY the fields that genuinely need to be
-- readable before sign-in: registration availability (so signup can show
-- "currently unavailable"), maintenance status/message (so the
-- maintenance screen can render for a signed-out visitor too), and the
-- platform name/tagline (cosmetic, harmless). Everything else
-- (support_email, contact_email, default_curriculum,
-- default_resource_access) stays admin-only.
--
-- This view intentionally does NOT use security_invoker — it is meant to
-- expose a fixed safe subset to EVERYONE regardless of the querying
-- user's own RLS on the base table, which is the opposite of how the
-- user_access_overview view (admin-access-migration.sql) was designed.
-- ============================================================
create or replace view public.platform_settings_public as
select
  platform_name,
  tagline,
  allow_student_registration,
  allow_teacher_registration,
  maintenance_mode,
  maintenance_message
from public.platform_settings
where id = 1;

grant select on public.platform_settings_public to anon, authenticated;
