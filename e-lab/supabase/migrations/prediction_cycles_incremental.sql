-- e-Lab incremental migration: Estimated IB Grade prediction cycles/snapshots
-- Safe to run more than once. Does not modify learning_progress,
-- student_challenges, challenge_questions, or any existing table/data.
--
-- Deliberately does NOT add a prediction_cycle_id to challenge_questions or
-- student_challenges: which cycle an attempt belongs to is derived from
-- comparing student_challenges.submitted_at against prediction_cycles.started_at
-- at read time (see src/lib/predictionEngine.js). This keeps Challenge
-- history completely independent of prediction history and avoids rewriting
-- any existing row.

create table if not exists public.prediction_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cycle_number integer not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, cycle_number)
);

alter table public.prediction_cycles enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='prediction_cycles' and policyname='Users can read own prediction cycles') then
    create policy "Users can read own prediction cycles" on public.prediction_cycles for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='prediction_cycles' and policyname='Users can insert own prediction cycles') then
    create policy "Users can insert own prediction cycles" on public.prediction_cycles for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='prediction_cycles' and policyname='Users can update own prediction cycles') then
    create policy "Users can update own prediction cycles" on public.prediction_cycles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

create index if not exists prediction_cycles_user_id_idx on public.prediction_cycles(user_id);

-- Enforces "a student cannot accidentally have multiple active prediction
-- cycles" at the database level, not just in application code: a partial
-- unique index means at most one is_active=true row per user is possible.
create unique index if not exists prediction_cycles_one_active_per_user
  on public.prediction_cycles(user_id) where is_active;

-- Historical grade/trend snapshots. Append-only by design (no update policy)
-- -- a snapshot is a point-in-time record of what the estimate was, not a
-- mutable row, so past trend history can never be silently rewritten.
create table if not exists public.prediction_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prediction_cycle_id uuid not null references public.prediction_cycles(id) on delete cascade,
  estimated_grade integer check (estimated_grade between 1 and 7),
  estimated_grade_low integer not null check (estimated_grade_low between 1 and 7),
  estimated_grade_high integer not null check (estimated_grade_high between 1 and 7),
  estimated_percentage numeric,
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  overall_performance numeric,
  recent_performance numeric,
  syllabus_coverage numeric,
  difficulty_performance numeric,
  consistency_score numeric,
  evidence_challenges integer not null default 0,
  evidence_marks numeric,
  calculated_at timestamptz not null default now()
);

alter table public.prediction_snapshots enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='prediction_snapshots' and policyname='Users can read own prediction snapshots') then
    create policy "Users can read own prediction snapshots" on public.prediction_snapshots for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='prediction_snapshots' and policyname='Users can insert own prediction snapshots') then
    create policy "Users can insert own prediction snapshots" on public.prediction_snapshots for insert with check (auth.uid() = user_id);
  end if;
end $$;

create index if not exists prediction_snapshots_user_id_idx on public.prediction_snapshots(user_id);
create index if not exists prediction_snapshots_cycle_id_idx on public.prediction_snapshots(prediction_cycle_id);
create index if not exists prediction_snapshots_calculated_at_idx on public.prediction_snapshots(user_id, calculated_at desc);
