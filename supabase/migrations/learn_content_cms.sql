-- e-Lab: Learn Content CMS migration (CORRECTED, CONSOLIDATED — NOT run)
--
-- This migration has NEVER been run against the live database. It is
-- the complete, corrected migration for a database where none of
-- learn_pages / learn_blocks / learn_check_questions / the Learn RPCs
-- exist yet. RUN THIS MIGRATION IN SUPABASE BEFORE TESTING LEARN CONTENT.
--
-- CORRECTIONS IN THIS REVISION:
--
-- 1. GRANT fix: the previous draft revoked INSERT/UPDATE/DELETE on all
--    three Learn tables from `authenticated` entirely — but the Admin
--    frontend performs direct `supabase.from(...).insert/update()`
--    calls. RLS alone does not grant the underlying SQL table
--    privilege; a REVOKE at the grant level blocks the operation before
--    RLS is ever evaluated, for admin and non-admin alike. Table
--    privileges are now GRANTed broadly to `authenticated`, with RLS
--    (using public.is_admin()) remaining the actual authorization
--    boundary — the same pattern already used for question_papers /
--    question_paper_items elsewhere in this project. A non-admin's
--    INSERT/UPDATE/DELETE attempt is still rejected, by RLS's own
--    `with check (is_admin())`, not by the grant.
--
-- 2. Version pinning: learn_check_questions.question_version_id is now
--    NOT NULL — a canonical Question Bank assignment can never be
--    created unpinned. mark_learn_check_answers() no longer has any
--    fallback path that marks against public.question_secrets by bare
--    question_id; it also now verifies the pinned version genuinely
--    belongs to the assigned question_id, not just that the UUID exists.
--
-- 3. Numeric-zero fix: the marking logic's numeric comparison
--    previously required `expected != 0`, silently refusing to ever
--    mark a question whose correct numeric answer is legitimately 0.
--    Zero is now handled with an absolute-tolerance comparison instead
--    of the relative one used for non-zero values (a relative
--    comparison is undefined at zero — dividing by zero — not just
--    unmarked).
--
-- Reuses public.is_admin(), public.is_teacher_or_admin(), and
-- public.set_updated_at() — all already exist live; none are redefined.
-- Does not touch questions/question_secrets/question_versions/
-- question_version_secrets or any other existing table.

begin;

-- ============================================================
-- learn_pages
-- ============================================================
create table if not exists public.learn_pages (
  id uuid primary key default gen_random_uuid(),
  parent_topic text not null,
  lesson_code text not null,
  title text not null,
  level text not null default 'SL/HL' check (level in ('SL/HL', 'SL', 'HL')),
  display_order int not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  unique (parent_topic, lesson_code)
);

create index if not exists learn_pages_parent_topic_idx on public.learn_pages(parent_topic);
create index if not exists learn_pages_status_idx on public.learn_pages(status);
-- Deterministic secondary ordering: display_order first, then id as a
-- stable tiebreaker so two lessons with equal display_order never
-- produce unstable Previous/Next navigation between requests.
create index if not exists learn_pages_ordering_idx on public.learn_pages(parent_topic, display_order, id);

alter table public.learn_pages enable row level security;

drop trigger if exists set_updated_at on public.learn_pages;
create trigger set_updated_at before update on public.learn_pages
  for each row execute function public.set_updated_at();

drop policy if exists "Anyone authenticated can read published learn pages" on public.learn_pages;
create policy "Anyone authenticated can read published learn pages"
  on public.learn_pages for select using (status = 'published');
drop policy if exists "Admins can read all learn pages" on public.learn_pages;
create policy "Admins can read all learn pages"
  on public.learn_pages for select using (public.is_admin());
drop policy if exists "Admins can write learn pages" on public.learn_pages;
create policy "Admins can write learn pages"
  on public.learn_pages for all using (public.is_admin()) with check (public.is_admin());

-- Table-level grants: RLS is the real authorization boundary (checked
-- via is_admin() above) — these grants only permit the OPERATION TYPE,
-- never bypass row-level checks. A non-admin's insert/update/delete
-- still fails the "Admins can write learn pages" policy's WITH CHECK.
grant select, insert, update, delete on public.learn_pages to authenticated;

-- ============================================================
-- learn_blocks
-- ============================================================
create table if not exists public.learn_blocks (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.learn_pages(id) on delete cascade,
  block_type text not null,
  content jsonb not null default '{}'::jsonb,
  position int not null default 0 check (position >= 0),
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists learn_blocks_page_id_idx on public.learn_blocks(page_id, position);

alter table public.learn_blocks enable row level security;

drop trigger if exists set_updated_at on public.learn_blocks;
create trigger set_updated_at before update on public.learn_blocks
  for each row execute function public.set_updated_at();

drop policy if exists "Anyone authenticated can read visible blocks of published pages" on public.learn_blocks;
create policy "Anyone authenticated can read visible blocks of published pages"
  on public.learn_blocks for select
  using (
    visible = true
    and exists (select 1 from public.learn_pages p where p.id = page_id and p.status = 'published')
  );
drop policy if exists "Admins can read all blocks" on public.learn_blocks;
create policy "Admins can read all blocks"
  on public.learn_blocks for select using (public.is_admin());
drop policy if exists "Admins can write blocks" on public.learn_blocks;
create policy "Admins can write blocks"
  on public.learn_blocks for all using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.learn_blocks to authenticated;

-- ============================================================
-- learn_check_questions — question_version_id is NOT NULL: a canonical
-- assignment can never exist unpinned. This table has never been live,
-- so the correct constraint is defined from the start rather than
-- retrofitted.
-- ============================================================
create table if not exists public.learn_check_questions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.learn_pages(id) on delete cascade,
  question_id text not null references public.questions(id),
  question_version_id uuid not null references public.question_versions(id),
  position int not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  unique (page_id, question_id)
);

create index if not exists learn_check_questions_page_id_idx on public.learn_check_questions(page_id, position);

alter table public.learn_check_questions enable row level security;

drop policy if exists "Anyone authenticated can read check questions of published pages" on public.learn_check_questions;
create policy "Anyone authenticated can read check questions of published pages"
  on public.learn_check_questions for select
  using (exists (select 1 from public.learn_pages p where p.id = page_id and p.status = 'published'));
drop policy if exists "Admins can read all check questions" on public.learn_check_questions;
create policy "Admins can read all check questions"
  on public.learn_check_questions for select using (public.is_admin());
drop policy if exists "Admins can write check questions" on public.learn_check_questions;
create policy "Admins can write check questions"
  on public.learn_check_questions for all using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.learn_check_questions to authenticated;

-- ============================================================
-- publish_learn_page — Admin-only, sets status + published_at together.
-- ============================================================
create or replace function public.publish_learn_page(p_page_id uuid)
returns public.learn_pages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page public.learn_pages;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  update public.learn_pages
  set status = 'published', published_at = now()
  where id = p_page_id
  returning * into v_page;

  if v_page is null then
    raise exception 'Learn page not found';
  end if;

  return v_page;
end;
$$;

revoke all on function public.publish_learn_page(uuid) from public;
grant execute on function public.publish_learn_page(uuid) to authenticated;

-- ============================================================
-- mark_learn_check_answers — CORRECTED, SECURE, version-pinned-only.
--
-- Security guarantees, all enforced server-side:
--   1. The page must exist and be status = 'published'.
--   2. Each submitted question_id must have a row in
--      learn_check_questions for THIS EXACT page_id.
--   3. The question_version_id used for marking is read from that row —
--      never from the client — and is GUARANTEED non-null by the
--      table's own NOT NULL constraint (no fallback branch exists).
--   4. The pinned version is verified to actually belong to the
--      assigned question_id (question_versions.question_id match), not
--      merely a UUID that happens to exist somewhere.
--   5. Only question_version_secrets for that specific, verified,
--      assigned version is ever touched.
--
-- Numeric marking: zero is now a legitimate expected value, compared
-- with an absolute tolerance rather than the relative (divide-by-expected)
-- comparison used for non-zero values, which is undefined at zero.
--
-- Deliberately stateless — does not write to student_challenges,
-- challenge_questions, or affect streak/Progress in any way.
-- ============================================================
create or replace function public.mark_learn_check_answers(p_page_id uuid, p_items jsonb)
returns table (question_id text, is_correct boolean, correct_answer_data jsonb, explanation text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page public.learn_pages;
  v_item jsonb;
  v_submitted_question_id text;
  v_student_answer jsonb;
  v_check_row public.learn_check_questions;
  v_version public.question_versions;
  v_secrets record;
  v_answer_type text;
  v_expected_option text;
  v_given_option text;
  v_expected_num numeric;
  v_given_num numeric;
  v_correct boolean;
begin
  if auth.uid() is null then
    raise exception 'Not authorized';
  end if;

  select * into v_page from public.learn_pages where id = p_page_id;
  if v_page is null or v_page.status <> 'published' then
    raise exception 'This lesson is not available.';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_submitted_question_id := v_item->>'question_id';
    v_student_answer := v_item->'student_answer';
    v_correct := null;

    -- The question must genuinely be assigned to THIS page. If it
    -- isn't, this row is simply skipped — never an error that would
    -- reveal whether a guessed question_id exists elsewhere in the bank.
    select * into v_check_row
      from public.learn_check_questions
      where page_id = p_page_id and question_id = v_submitted_question_id;

    if v_check_row is null then
      continue;
    end if;

    -- Verify the pinned version genuinely belongs to the assigned
    -- question — not merely that SOME question_versions row with that
    -- UUID exists. If this ever fails, the assignment itself is corrupt
    -- (should be unreachable given the NOT NULL + application insert
    -- path), so the row is skipped rather than trusted.
    select * into v_version
      from public.question_versions
      where id = v_check_row.question_version_id and question_id = v_check_row.question_id;

    if v_version is null then
      continue;
    end if;

    select correct_answer_data, explanation into v_secrets
      from public.question_version_secrets
      where question_version_id = v_check_row.question_version_id;

    if v_secrets.correct_answer_data is not null and v_student_answer is not null then
      v_answer_type := v_secrets.correct_answer_data->>'type';

      if v_answer_type = 'mcq' then
        v_expected_option := v_secrets.correct_answer_data->>'value';
        v_given_option := v_student_answer #>> '{}';
        if v_expected_option is not null and v_given_option is not null then
          v_correct := (trim(v_given_option) = trim(v_expected_option));
        end if;

      elsif v_answer_type = 'numeric' then
        begin
          v_expected_num := (v_secrets.correct_answer_data->>'value')::numeric;
          v_given_num := regexp_replace(v_student_answer #>> '{}', '[^0-9.\-]', '', 'g')::numeric;
          if v_expected_num is not null then
            if v_expected_num = 0 then
              -- Absolute tolerance — a relative (divide-by-expected)
              -- comparison is undefined at zero, not just unmarked.
              v_correct := (abs(v_given_num - v_expected_num) < coalesce((v_secrets.correct_answer_data->>'tolerance')::numeric, 0.01));
            else
              v_correct := (abs((v_given_num - v_expected_num) / v_expected_num) < coalesce((v_secrets.correct_answer_data->>'tolerance')::numeric, 0.01));
            end if;
          end if;
        exception when others then
          v_correct := null;
        end;
      end if;
    end if;

    question_id := v_check_row.question_id;
    is_correct := v_correct;
    correct_answer_data := v_secrets.correct_answer_data;
    explanation := v_secrets.explanation;
    return next;
  end loop;
end;
$$;

revoke all on function public.mark_learn_check_answers(uuid, jsonb) from public;
grant execute on function public.mark_learn_check_answers(uuid, jsonb) to authenticated;

commit;
