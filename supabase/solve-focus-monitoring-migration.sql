-- e-Lab: Challenge focus-monitoring migration
--
-- NOT run automatically. Review, then run in the Supabase SQL Editor.
-- Extends the EXISTING public.student_challenges table (does not
-- recreate it, does not touch challenge_questions or student_streaks).
-- Reuses public.set_updated_at() — the confirmed live trigger function
-- name — already attached to this table by solve-challenges-migration.sql;
-- no new trigger is created here.

alter table public.student_challenges
  add column if not exists focus_violation_count int not null default 0;

alter table public.student_challenges
  add column if not exists termination_reason text
  check (termination_reason is null or termination_reason in ('submitted', 'time_expired', 'focus_violation', 'manual_end'));
