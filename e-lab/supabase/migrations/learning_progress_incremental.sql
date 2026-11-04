-- e-Lab incremental migration: Learn progress persistence
-- Safe to run more than once. Does not modify Learn CMS content or question versions.

create table if not exists public.learning_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id text not null,
  curriculum_code text not null,
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

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='learning_progress' and policyname='Users can read own progress') then
    create policy "Users can read own progress" on public.learning_progress for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='learning_progress' and policyname='Users can insert own progress') then
    create policy "Users can insert own progress" on public.learning_progress for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='learning_progress' and policyname='Users can update own progress') then
    create policy "Users can update own progress" on public.learning_progress for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

create index if not exists learning_progress_user_id_idx on public.learning_progress(user_id);
create index if not exists learning_progress_curriculum_code_idx on public.learning_progress(user_id, curriculum_code);

-- Check Your Understanding attempt history uses this companion table.
create table if not exists public.concept_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id text not null,
  question_id text not null,
  is_correct boolean not null,
  attempted_at timestamptz not null default now()
);

alter table public.concept_attempts enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='concept_attempts' and policyname='Users can read own attempts') then
    create policy "Users can read own attempts" on public.concept_attempts for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='concept_attempts' and policyname='Users can insert own attempts') then
    create policy "Users can insert own attempts" on public.concept_attempts for insert with check (auth.uid() = user_id);
  end if;
end $$;

create index if not exists concept_attempts_user_id_idx on public.concept_attempts(user_id);
create index if not exists concept_attempts_concept_id_idx on public.concept_attempts(user_id, concept_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.learning_progress;
create trigger set_updated_at before update on public.learning_progress
  for each row execute function public.touch_updated_at();

-- Ask Supabase/PostgREST to refresh its schema cache immediately.
notify pgrst, 'reload schema';
