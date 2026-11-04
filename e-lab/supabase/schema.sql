-- e-Lab Supabase schema
-- Run this once in the Supabase SQL Editor for your project (Dashboard →
-- SQL Editor → New query → paste this whole file → Run).
--
-- NOTE: if you have already created the `profiles` table, its RLS
-- policies, and an automatic profile-creation trigger yourself (as
-- described when this file was last updated), you do NOT need to re-run
-- the `profiles` section below — it's kept here as documentation so the
-- rest of this file (and the application code, which assumes the exact
-- shape described here) stays consistent with what your project expects.
-- Every table is protected by Row Level Security — there is no public
-- read access to any of these tables under any circumstance.

-- ============================================================
-- profiles
-- One row per user, keyed by auth.users.id directly (id IS the foreign
-- key — there is no separate user_id column on this table). This matches
-- Supabase's own recommended pattern for a profiles table populated by an
-- auth.users trigger.
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null,
  role text not null check (role in ('student', 'teacher')),
  school text,
  country text,
  -- Only meaningful for students; null for teachers.
  grade_or_class text,
  curriculum text not null default 'IB Diploma Programme',
  -- Student: 'SL' | 'HL'. Teacher: 'SL' | 'HL' | 'SL & HL'. Enforced in
  -- the application layer (kept as free text here so future
  -- curricula/levels don't require a schema migration).
  level text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Automatic profile creation trigger — reads the metadata passed to
-- supabase.auth.signUp({ options: { data: {...} } }) from the client
-- (see src/context/AuthContext.jsx) and creates the matching profiles
-- row the moment a new auth.users row is inserted, so the client never
-- has to (and never could, under RLS, before a session exists anyway).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, school, country, grade_or_class, curriculum, level)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    coalesce(new.raw_user_meta_data ->> 'role', 'student'),
    new.raw_user_meta_data ->> 'school',
    new.raw_user_meta_data ->> 'country',
    new.raw_user_meta_data ->> 'grade_or_class',
    coalesce(new.raw_user_meta_data ->> 'curriculum', 'IB Diploma Programme'),
    new.raw_user_meta_data ->> 'level'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- No delete policy: profile deletion happens via auth.users cascade only
-- (e.g. an account-deletion flow calling Supabase admin APIs server-side),
-- never directly from the client.

-- ============================================================
-- learning_progress
-- One row per (user, concept). Upserted as a student studies a concept.
-- ============================================================
create table if not exists public.learning_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id text not null,
  curriculum_code text not null, -- e.g. "structure-1.3" (subtopic) for grouping/milestones
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  best_check_score integer,
  last_check_score integer,
  attempt_count integer not null default 0,
  first_opened_at timestamptz,
  last_visited_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, concept_id)
);

alter table public.learning_progress enable row level security;

create policy "Users can read own progress"
  on public.learning_progress for select
  using (auth.uid() = user_id);

create policy "Users can insert own progress"
  on public.learning_progress for insert
  with check (auth.uid() = user_id);

create policy "Users can update own progress"
  on public.learning_progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists learning_progress_user_id_idx on public.learning_progress(user_id);
create index if not exists learning_progress_curriculum_code_idx on public.learning_progress(user_id, curriculum_code);

-- ============================================================
-- concept_attempts
-- One row per individual Check Yourself question attempt. Append-only
-- from the client (no update/delete policy) — this is a lightweight
-- attempt log, not a source of truth for current status (that's
-- learning_progress, which the client updates deliberately after scoring).
-- ============================================================
create table if not exists public.concept_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id text not null,
  question_id text not null,
  is_correct boolean not null,
  attempted_at timestamptz not null default now()
);

alter table public.concept_attempts enable row level security;

create policy "Users can read own attempts"
  on public.concept_attempts for select
  using (auth.uid() = user_id);

create policy "Users can insert own attempts"
  on public.concept_attempts for insert
  with check (auth.uid() = user_id);

create index if not exists concept_attempts_user_id_idx on public.concept_attempts(user_id);
create index if not exists concept_attempts_concept_id_idx on public.concept_attempts(user_id, concept_id);

-- ============================================================
-- user_preferences
-- One row per user. Small UI-state table (sidebar, theme, last route) so
-- signed-in preferences follow the student across devices.
-- ============================================================
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_student_route text,
  last_concept_id text,
  sidebar_collapsed boolean not null default false,
  theme text check (theme in ('light', 'dark')),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

create policy "Users can read own preferences"
  on public.user_preferences for select
  using (auth.uid() = user_id);

create policy "Users can insert own preferences"
  on public.user_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users can update own preferences"
  on public.user_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- updated_at auto-touch trigger (applied to all four tables)
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists set_updated_at on public.learning_progress;
create trigger set_updated_at before update on public.learning_progress
  for each row execute function public.touch_updated_at();

drop trigger if exists set_updated_at on public.user_preferences;
create trigger set_updated_at before update on public.user_preferences
  for each row execute function public.touch_updated_at();
