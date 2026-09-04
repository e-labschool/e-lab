-- e-Lab: Admin role migration
--
-- This file is NOT meant to be run automatically and was NOT executed by
-- Claude. Review each statement, then run it yourself in the Supabase
-- SQL Editor. Nothing here deletes data, drops the profiles table, resets
-- auth, or touches existing RLS policies — it only widens the `role`
-- column's allowed values and (separately) promotes exactly one account
-- you specify.

-- ============================================================
-- STEP 1 (recommended, read-only) — confirm the actual name of the
-- existing check constraint on profiles.role before dropping anything.
-- If your project's constraint was created with the default (unnamed)
-- syntax, as in this project's schema.sql, it will be exactly
-- `profiles_role_check` (Postgres's default naming: <table>_<column>_check)
-- and STEP 2 below will work as written. If this query returns a
-- different name, substitute it into STEP 2 before running.
-- ============================================================
select conname
from pg_constraint
where conrelid = 'public.profiles'::regclass
  and contype = 'c'; -- 'c' = check constraint

-- ============================================================
-- STEP 2 — widen the constraint to also allow 'admin'.
-- Postgres has no "ALTER CONSTRAINT" for check clauses, so the standard,
-- safe pattern is: drop the old check, add an equivalent new one with the
-- extra allowed value. This does NOT touch any existing row's data —
-- every current 'student'/'teacher' row already satisfies the new,
-- broader constraint.
-- ============================================================
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('student', 'teacher', 'admin'));

-- ============================================================
-- STEP 3 — promote exactly ONE existing account to admin.
--
-- Replace 'your-email@example.com' with your real account email, then
-- run this by itself (it's intentionally separate from steps 1–2 so you
-- can run the constraint change now and this promotion whenever you're
-- ready — e.g. after confirming your own sign-in still works).
--
-- This updates exactly the one profiles row whose id matches that email
-- in auth.users — it can never affect more than one row, and does
-- nothing if no matching account is found.
-- ============================================================
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'your-email@example.com');

-- Optional sanity check — run this after Step 3 to confirm exactly one
-- row now has role = 'admin' and it's the account you expected.
select id, email, full_name, role from public.profiles where role = 'admin';
