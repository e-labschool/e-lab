-- e-Lab: Admin Users migration
--
-- NOT run automatically. Review, then run in the Supabase SQL Editor.
-- Adds one column to the EXISTING `profiles` table and two new RLS
-- policies on it — does not touch any other table, does not delete or
-- reset any data, does not weaken the existing "read/update own row"
-- policies (they stay exactly as they are; these are ADDITIONAL grants
-- for admins specifically, evaluated alongside the existing ones).

-- ============================================================
-- STEP 1 — account status
-- ============================================================
alter table public.profiles
  add column if not exists status text not null default 'active'
  check (status in ('active', 'suspended'));

-- ============================================================
-- STEP 2 — let admins read every profile (needed for the Users
-- dashboard's list/search/filter/summary counts). Reuses the same
-- is_admin() function already created by resources-migration.sql — if
-- you haven't run that migration yet, run it first, since this depends
-- on that function existing.
-- ============================================================
create policy "Admins can read all profiles"
  on public.profiles for select
  using (public.is_admin());

-- ============================================================
-- STEP 3 — let admins update any profile's editable fields (name,
-- school, country, grade_or_class, curriculum, level, role, status).
-- This does NOT let a non-admin escalate themselves — the policy's USING
-- clause requires the CALLER to already be an admin; a student/teacher
-- updating their own row still goes through the existing
-- "Users can update own profile" policy only, which is unaffected.
-- ============================================================
create policy "Admins can update any profile"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- No admin DELETE policy is added — this version intentionally does not
-- support deleting users (suspension only), per the brief.
