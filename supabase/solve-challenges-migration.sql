-- e-Lab: Student Solve (Challenge) migration
--
-- NOT run automatically. Review, then run in the Supabase SQL Editor.
-- Uses public.is_admin() and public.set_updated_at() (per the brief,
-- confirmed live names), both already created by earlier migrations —
-- this file does not redefine or duplicate either.

-- ============================================================
-- student_challenges
-- One row per challenge attempt (a "session"). Config is stored so a
-- Challenge Report can always be regenerated/reviewed later even if
-- underlying settings defaults change. `status` distinguishes an
-- in-progress session (for "Continue Challenge") from a finished one.
-- ============================================================
create table if not exists public.student_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,

  -- Selected topic codes, e.g. ["S1.2","S1.3","R1.1"] — the SAME short
  -- codes used everywhere else (Q Builder, Learn), never a second
  -- encoding of the curriculum.
  topic_codes text[] not null,
  level text not null check (level in ('SL', 'HL')),
  mode text not null check (mode in ('questions', 'time')),
  question_count int not null,
  time_limit_seconds int, -- null when mode = 'questions' and no reliable estimate exists
  style text not null default 'balanced' check (style in ('balanced', 'exam_ready')),

  status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'abandoned')),
  current_question_index int not null default 0,
  flagged_question_ids text[] not null default '{}',

  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  duration_seconds int, -- actual time taken, recorded at submission

  score numeric, -- total marks earned, null until submitted (and only for auto-markable content)
  max_score numeric,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.student_challenges enable row level security;

create policy "Users can read own challenges"
  on public.student_challenges for select
  using (auth.uid() = user_id);

create policy "Users can insert own challenges"
  on public.student_challenges for insert
  with check (auth.uid() = user_id);

create policy "Users can update own challenges"
  on public.student_challenges for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Admin read access is intentionally NOT added here — per the brief,
-- personal Solve data (answers/scores/attempts) is not exposed even to
-- Admin in this version unless a future need is explicitly identified.

drop trigger if exists set_updated_at on public.student_challenges;
create trigger set_updated_at before update on public.student_challenges
  for each row execute function public.set_updated_at();

create index if not exists student_challenges_user_id_idx on public.student_challenges(user_id, started_at desc);

-- ============================================================
-- challenge_questions
-- A snapshot of which questions belong to a challenge, in what order,
-- and (later) the student's answer. Storing question_id as text (not a
-- foreign key) deliberately: the Question Bank itself lives in
-- src/data/questions (a code-defined registry, not a database table) —
-- this table's job is to remember WHICH question ids were selected and
-- what the student answered, not to duplicate question content.
-- Per the brief's question-security section, the correct answer/marking
-- data is never written here — only the student's own response and,
-- after submission, whether it was judged correct.
-- ============================================================
create table if not exists public.challenge_questions (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.student_challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade, -- denormalized for a simple, fast RLS check
  question_id text not null,
  position int not null,
  topic_code text not null,

  student_answer jsonb, -- shape depends on question type (string, array, {parts:[...]})
  is_correct boolean, -- null until auto-marked at submission; stays null for question types that need manual/future marking
  marks_awarded numeric,
  marks_possible numeric not null,

  answered_at timestamptz,

  unique (challenge_id, question_id)
);

alter table public.challenge_questions enable row level security;

create policy "Users can read own challenge questions"
  on public.challenge_questions for select
  using (auth.uid() = user_id);

create policy "Users can insert own challenge questions"
  on public.challenge_questions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own challenge questions"
  on public.challenge_questions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists challenge_questions_challenge_id_idx on public.challenge_questions(challenge_id, position);
create index if not exists challenge_questions_user_topic_idx on public.challenge_questions(user_id, topic_code);

-- ============================================================
-- student_streaks
-- One row per student. A qualifying day (>=1 challenge with >=5
-- questions submitted) advances the streak; the streak is recomputed
-- from last_qualifying_date, not incrementally trusted forever, so a
-- missed day naturally resets to a fresh start without any separate
-- "break the streak" write.
-- ============================================================
create table if not exists public.student_streaks (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_qualifying_date date,
  updated_at timestamptz not null default now()
);

alter table public.student_streaks enable row level security;

create policy "Users can read own streak"
  on public.student_streaks for select
  using (auth.uid() = user_id);

create policy "Users can upsert own streak"
  on public.student_streaks for insert
  with check (auth.uid() = user_id);

create policy "Users can update own streak"
  on public.student_streaks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_updated_at on public.student_streaks;
create trigger set_updated_at before update on public.student_streaks
  for each row execute function public.set_updated_at();
