-- e-Lab: Class Planner migration
--
-- NOT run automatically. Review, then run in the Supabase SQL Editor.
-- Two new tables only — does not touch Student Learn, Solve, Question
-- Bank, Resources, or any existing table. Reuses public.set_updated_at()
-- (confirmed live name) — no new trigger function created.

-- ============================================================
-- class_plans
-- A teacher's own lesson-planning workspace for one class session.
-- Deliberately NOT a formal lesson-plan document (no ATL, prior
-- learning, differentiation, etc fields) — per the brief, the everyday
-- planner answers "what/how long/with what/in what order", nothing more.
-- topic_code is the SAME short curriculum code used everywhere else
-- (e.g. "S1.1") — not a second encoding of the syllabus.
-- ============================================================
create table if not exists public.class_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,

  title text not null,
  class_group text, -- e.g. "DP1" — free text, not a formal class-roster entity
  topic_code text,
  level text check (level is null or level in ('SL', 'HL')),
  duration_minutes int not null default 60,
  planned_date date,
  status text not null default 'draft' check (status in ('draft', 'saved', 'archived')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.class_plans enable row level security;

create policy "Teachers can read own class plans"
  on public.class_plans for select
  using (auth.uid() = user_id);

create policy "Teachers can insert own class plans"
  on public.class_plans for insert
  with check (auth.uid() = user_id);

create policy "Teachers can update own class plans"
  on public.class_plans for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Teachers can delete own class plans"
  on public.class_plans for delete
  using (auth.uid() = user_id);
-- Delete IS permitted at the database level (a teacher may need to
-- remove a genuine mistake), but the UI never exposes casual permanent
-- deletion — "Archive" (a status change, no data loss) is what Save/
-- Duplicate/Rename/Archive actually offer, per the brief's explicit
-- "do not implement permanent destructive deletion casually" instruction.

drop trigger if exists set_updated_at on public.class_plans;
create trigger set_updated_at before update on public.class_plans
  for each row execute function public.set_updated_at();

create index if not exists class_plans_user_id_idx on public.class_plans(user_id, updated_at desc);

-- ============================================================
-- lesson_blocks
-- The ordered sequence of blocks that make up one class_plan. Each block
-- stores its OWN title/content copied at add-time — never a live
-- reference back into Teach/Question Bank/Resources content — so
-- customising a lesson-specific version can never mutate the source.
-- source_type + source_ref exist purely for the subtle "e-Lab Teach" /
-- "Question Bank" / "My Content" label and for a future "jump back to
-- source" link; they are NOT foreign keys into those systems, since
-- Teach content and Question Bank both currently live in code (not a
-- database table) rather than as database rows with stable ids to
-- reference relationally.
-- ============================================================
create table if not exists public.lesson_blocks (
  id uuid primary key default gen_random_uuid(),
  class_plan_id uuid not null references public.class_plans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade, -- denormalized for a simple, fast RLS check

  position int not null,
  block_type text not null, -- "Starter" | "Explain" | "Visualise" | ... | "Custom" — deliberately NOT a check constraint enum, since the brief requires teachers can label a block anything via Custom

  title text not null,
  content jsonb, -- shape depends on source_type (plain text, a question snapshot, a file/link reference, ...)
  duration_minutes int,

  source_type text not null default 'custom' check (source_type in ('elab_teach', 'elab_interactive', 'question_bank', 'resource', 'custom')),
  source_ref text, -- e.g. a subtopic code, an interactive id, a question id, or a resource id — informational only, see note above

  teacher_notes text, -- private; never shown in Present Class (see student_facing)
  student_facing boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lesson_blocks enable row level security;

create policy "Teachers can read own lesson blocks"
  on public.lesson_blocks for select
  using (auth.uid() = user_id);

create policy "Teachers can insert own lesson blocks"
  on public.lesson_blocks for insert
  with check (auth.uid() = user_id);

create policy "Teachers can update own lesson blocks"
  on public.lesson_blocks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Teachers can delete own lesson blocks"
  on public.lesson_blocks for delete
  using (auth.uid() = user_id);

drop trigger if exists set_updated_at on public.lesson_blocks;
create trigger set_updated_at before update on public.lesson_blocks
  for each row execute function public.set_updated_at();

create index if not exists lesson_blocks_plan_id_idx on public.lesson_blocks(class_plan_id, position);
