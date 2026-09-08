-- e-Lab: Learn Content CMS migration (NOT run — for review only)
-- Idempotent where practical (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- Reuses public.is_admin() and public.set_updated_at() — both already
-- exist live; neither is redefined here. Does not touch any existing
-- table (questions, question_secrets, question_versions, challenges,
-- profiles, resources, etc).

begin;

-- ============================================================
-- learn_pages — one row per lesson. `parent_topic` stores the existing
-- curriculum registry's subtopic id (e.g. "structure-1.1") for
-- Structure/Reactivity, or the literal string "tools-for-chemistry" for
-- the Tools area — never a newly-invented IB code. `lesson_code` and
-- `title` are Admin-authored content, not asserted as official IB text.
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

grant select on public.learn_pages to authenticated;
revoke insert, update, delete on public.learn_pages from authenticated;

-- ============================================================
-- learn_blocks — flexible block architecture. block_type + content jsonb
-- means new block types never require a schema change.
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

grant select on public.learn_blocks to authenticated;
revoke insert, update, delete on public.learn_blocks from authenticated;

-- ============================================================
-- learn_check_questions — Check Your Understanding selections. Stores
-- BOTH question_id and the resolved question_version_id at the moment
-- Admin selects it (same version-pinning principle as
-- question_paper_items), so a later canonical edit cannot silently
-- change what a published lesson's check section actually asks.
-- ============================================================
create table if not exists public.learn_check_questions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.learn_pages(id) on delete cascade,
  question_id text not null references public.questions(id),
  question_version_id uuid references public.question_versions(id),
  position int not null default 0 check (position >= 0),
  created_at timestamptz not null default now()
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

grant select on public.learn_check_questions to authenticated;
revoke insert, update, delete on public.learn_check_questions from authenticated;

-- Reading learn_check_questions only tells a student WHICH questions are
-- selected (ids), never their content — the existing questions table
-- policy ("published questions only") already covers safe content, and
-- question_secrets/question_version_secrets remain completely
-- inaccessible to any direct client query, exactly as in Assess.

-- ============================================================
-- publish_learn_page — Admin-only, sets status + published_at together
-- so the two can never drift out of sync from a partial client update.
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
-- Safe even though EXECUTE is granted broadly to authenticated: the
-- function itself checks is_admin() internally before doing anything,
-- exactly like every other admin-only RPC already in this project
-- (save_question_with_secrets, bulk_import_questions, etc).

-- ============================================================
-- mark_learn_check_answers — secure, STATELESS marking for Learn's
-- Check Your Understanding. Deliberately does NOT write to
-- student_challenges/challenge_questions or affect streak/Progress in
-- any way — Learn's check is explicitly not the Assess experience.
-- Marks against question_version_secrets ONLY when a version_id is
-- pinned (matches the existing Assess security model); falls back to
-- question_secrets keyed by question_id for a check question that has
-- no pinned version for some reason, but never exposes secret content
-- to the caller — only the computed outcome + explanation.
-- ============================================================
create or replace function public.mark_learn_check_answers(p_items jsonb)
returns table (question_id text, is_correct boolean, correct_answer_data jsonb, explanation text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_question_id text;
  v_version_id uuid;
  v_student_answer jsonb;
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

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_question_id := v_item->>'question_id';
    v_version_id := nullif(v_item->>'question_version_id', '')::uuid;
    v_student_answer := v_item->'student_answer';
    v_correct := null;

    if v_version_id is not null then
      select correct_answer_data, explanation into v_secrets
        from public.question_version_secrets where question_version_id = v_version_id;
    else
      select correct_answer_data, explanation into v_secrets
        from public.question_secrets where question_id = v_question_id;
    end if;

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
          if v_expected_num is not null and v_expected_num != 0 then
            v_correct := (abs((v_given_num - v_expected_num) / v_expected_num) < coalesce((v_secrets.correct_answer_data->>'tolerance')::numeric, 0.01));
          end if;
        exception when others then
          v_correct := null;
        end;
      end if;
    end if;

    question_id := v_question_id;
    is_correct := v_correct;
    correct_answer_data := v_secrets.correct_answer_data;
    explanation := v_secrets.explanation;
    return next;
  end loop;
end;
$$;

revoke all on function public.mark_learn_check_answers(jsonb) from public;
grant execute on function public.mark_learn_check_answers(jsonb) to authenticated;
-- Returns correct_answer_data/explanation only for the SPECIFIC items the
-- caller just answered and submitted, exactly matching Assess's
-- post-submission review principle — never queryable before submission,
-- since this function only ever runs in response to an explicit submit
-- action from the student's own client.

commit;

-- ============================================================
-- Storage: learn-media bucket for lesson images/video posters.
-- Public read (published lesson media must be visible to students
-- without extra round-trips), Admin-only write — mirrors the existing
-- safe pattern used by the `resources` bucket, adapted for public read
-- since Learn media belongs to published, freely-visible lessons rather
-- than access-tiered resources.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('learn-media', 'learn-media', true)
on conflict (id) do nothing;

drop policy if exists "Public can read learn media" on storage.objects;
create policy "Public can read learn media"
  on storage.objects for select
  using (bucket_id = 'learn-media');

drop policy if exists "Admins can upload learn media" on storage.objects;
create policy "Admins can upload learn media"
  on storage.objects for insert
  with check (bucket_id = 'learn-media' and public.is_admin());

drop policy if exists "Admins can update learn media" on storage.objects;
create policy "Admins can update learn media"
  on storage.objects for update
  using (bucket_id = 'learn-media' and public.is_admin());

drop policy if exists "Admins can delete learn media" on storage.objects;
create policy "Admins can delete learn media"
  on storage.objects for delete
  using (bucket_id = 'learn-media' and public.is_admin());
