-- e-Lab Learn CMS incremental migration
-- For a live database where learn_content_cms.sql has ALREADY been run.
-- Adds Learn-only manual check questions + secure marking + learn-media bucket.
-- Idempotent where practical. Review, then run once in Supabase SQL Editor.

begin;

create table if not exists public.learn_manual_questions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.learn_pages(id) on delete cascade,
  question_type text not null check (question_type in ('mcq', 'short_answer')),
  question_text text not null,
  options jsonb not null default '[]'::jsonb,
  stimulus jsonb not null default '{}'::jsonb,
  position int not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists learn_manual_questions_page_id_idx
  on public.learn_manual_questions(page_id, position, id);

alter table public.learn_manual_questions enable row level security;

drop trigger if exists set_updated_at on public.learn_manual_questions;
create trigger set_updated_at before update on public.learn_manual_questions
  for each row execute function public.set_updated_at();

drop policy if exists "Authenticated can read manual questions of published pages" on public.learn_manual_questions;
create policy "Authenticated can read manual questions of published pages"
  on public.learn_manual_questions for select
  using (exists (
    select 1 from public.learn_pages p
    where p.id = page_id and p.status = 'published'
  ));

drop policy if exists "Admins can read all manual questions" on public.learn_manual_questions;
create policy "Admins can read all manual questions"
  on public.learn_manual_questions for select using (public.is_admin());

drop policy if exists "Admins can write manual questions" on public.learn_manual_questions;
create policy "Admins can write manual questions"
  on public.learn_manual_questions for all using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.learn_manual_questions to authenticated;

create table if not exists public.learn_manual_question_secrets (
  manual_question_id uuid primary key references public.learn_manual_questions(id) on delete cascade,
  correct_answer_data jsonb not null,
  explanation text,
  updated_at timestamptz not null default now()
);

alter table public.learn_manual_question_secrets enable row level security;

drop trigger if exists set_updated_at on public.learn_manual_question_secrets;
create trigger set_updated_at before update on public.learn_manual_question_secrets
  for each row execute function public.set_updated_at();

-- Secrets are never student-readable. Admin access is through SECURITY DEFINER RPCs only.
revoke all on public.learn_manual_question_secrets from anon, authenticated;

create or replace function public.admin_save_learn_manual_question(
  p_question_id uuid,
  p_page_id uuid,
  p_question jsonb,
  p_correct_answer_data jsonb,
  p_explanation text default null
)
returns public.learn_manual_questions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.learn_manual_questions;
  v_type text := p_question->>'question_type';
  v_text text := trim(coalesce(p_question->>'question_text', ''));
  v_options jsonb := coalesce(p_question->'options', '[]'::jsonb);
  v_stimulus jsonb := coalesce(p_question->'stimulus', '{}'::jsonb);
  v_position int := coalesce((p_question->>'position')::int, 0);
  v_correct_type text := p_correct_answer_data->>'type';
  v_correct_value text := trim(coalesce(p_correct_answer_data->>'value', ''));
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  if not exists (select 1 from public.learn_pages where id = p_page_id) then raise exception 'Learn page not found'; end if;
  if v_type not in ('mcq', 'short_answer') then raise exception 'Unsupported manual question type'; end if;
  if v_text = '' then raise exception 'Question text is required'; end if;
  if jsonb_typeof(v_stimulus) <> 'object' then raise exception 'Stimulus must be an object'; end if;
  if coalesce(v_stimulus->>'src','') <> '' and coalesce(v_stimulus->>'type','') <> 'image' then raise exception 'Only image stimulus is supported for manual Learn questions'; end if;
  if v_correct_value = '' then raise exception 'Correct answer is required'; end if;

  if v_type = 'mcq' then
    if jsonb_typeof(v_options) <> 'array' or jsonb_array_length(v_options) < 2 then
      raise exception 'MCQ requires at least two options';
    end if;
    if v_correct_type <> 'mcq' then raise exception 'MCQ answer type mismatch'; end if;
    if not exists (
      select 1 from jsonb_array_elements(v_options) o
      where o->>'id' = v_correct_value and trim(coalesce(o->>'text','')) <> ''
    ) then raise exception 'Correct option must match one of the provided options'; end if;
  else
    if v_correct_type <> 'text' then raise exception 'Short-answer answer type mismatch'; end if;
    v_options := '[]'::jsonb;
  end if;

  if p_question_id is null then
    insert into public.learn_manual_questions(page_id, question_type, question_text, options, stimulus, position)
    values (p_page_id, v_type, v_text, v_options, v_stimulus, v_position)
    returning * into v_row;
  else
    update public.learn_manual_questions
      set question_type = v_type, question_text = v_text, options = v_options, stimulus = v_stimulus
      where id = p_question_id and page_id = p_page_id
      returning * into v_row;
    if v_row is null then raise exception 'Manual question not found'; end if;
  end if;

  insert into public.learn_manual_question_secrets(manual_question_id, correct_answer_data, explanation)
  values (v_row.id, p_correct_answer_data, nullif(trim(coalesce(p_explanation,'')), ''))
  on conflict (manual_question_id) do update
    set correct_answer_data = excluded.correct_answer_data,
        explanation = excluded.explanation,
        updated_at = now();

  return v_row;
end;
$$;
revoke all on function public.admin_save_learn_manual_question(uuid, uuid, jsonb, jsonb, text) from public;
grant execute on function public.admin_save_learn_manual_question(uuid, uuid, jsonb, jsonb, text) to authenticated;

create or replace function public.get_admin_learn_manual_question_secret(p_question_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_result jsonb;
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  select jsonb_build_object(
    'correctAnswerData', s.correct_answer_data,
    'explanation', s.explanation
  ) into v_result
  from public.learn_manual_question_secrets s
  where s.manual_question_id = p_question_id;
  return v_result;
end;
$$;
revoke all on function public.get_admin_learn_manual_question_secret(uuid) from public;
grant execute on function public.get_admin_learn_manual_question_secret(uuid) to authenticated;

-- Student-safe item hydration. Returns only renderable question content; never secrets.
create or replace function public.get_learn_check_items(p_page_id uuid)
returns table (
  item_id uuid,
  source_type text,
  question_id text,
  "position" int,
  question_content jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authorized'; end if;
  if not exists (select 1 from public.learn_pages p where p.id = p_page_id and p.status = 'published') then
    raise exception 'This lesson is not available.';
  end if;

  return query
  select c.id,
         'canonical'::text,
         c.question_id,
         c.position,
         jsonb_build_object(
           'id', c.question_id,
           'questionText', coalesce(v.content_snapshot->>'question_content',''),
           'questionType', coalesce(v.content_snapshot->>'question_type','Short Response'),
           'marks', v.content_snapshot->'marks',
           'stimulus', v.content_snapshot->'visual_data',
           'options', coalesce(v.content_snapshot->'options','[]'::jsonb),
           'parts', coalesce(v.content_snapshot->'parts','[]'::jsonb)
         )
  from public.learn_check_questions c
  join public.question_versions v on v.id = c.question_version_id and v.question_id = c.question_id
  where c.page_id = p_page_id

  union all

  select m.id,
         'manual'::text,
         null::text,
         m.position,
         jsonb_build_object(
           'id', 'manual:' || m.id::text,
           'questionText', m.question_text,
           'questionType', case when m.question_type = 'mcq' then 'MCQ' else 'Short Response' end,
           'marks', null,
           'stimulus', case when coalesce(m.stimulus->>'src','') <> '' then m.stimulus else null end,
           'options', m.options,
           'parts', '[]'::jsonb
         )
  from public.learn_manual_questions m
  where m.page_id = p_page_id
  order by 4, 1;
end;
$$;
revoke all on function public.get_learn_check_items(uuid) from public;
grant execute on function public.get_learn_check_items(uuid) to authenticated;

-- Replace existing Learn marking RPC so both canonical and manual items can be marked securely.
drop function if exists public.mark_learn_check_answers(uuid, jsonb);
create function public.mark_learn_check_answers(p_page_id uuid, p_items jsonb)
returns table (
  item_id uuid,
  source_type text,
  question_id text,
  is_correct boolean,
  correct_answer_data jsonb,
  explanation text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_item_id uuid;
  v_source text;
  v_student_answer jsonb;
  v_canonical public.learn_check_questions;
  v_manual public.learn_manual_questions;
  v_correct_answer_data jsonb;
  v_explanation text;
  v_answer_type text;
  v_expected_option text;
  v_given text;
  v_expected_num numeric;
  v_given_num numeric;
  v_correct boolean;
  v_alt jsonb;
begin
  if auth.uid() is null then raise exception 'Not authorized'; end if;
  if not exists (select 1 from public.learn_pages p where p.id = p_page_id and p.status = 'published') then
    raise exception 'This lesson is not available.';
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    begin v_item_id := (v_item->>'item_id')::uuid; exception when others then continue; end;
    v_source := v_item->>'source_type';
    v_student_answer := v_item->'student_answer';
    v_correct := null;
    v_correct_answer_data := null;
    v_explanation := null;

    if v_source = 'canonical' then
      select * into v_canonical from public.learn_check_questions
      where id = v_item_id and page_id = p_page_id;
      if v_canonical is null then continue; end if;
      if not exists (select 1 from public.question_versions v where v.id = v_canonical.question_version_id and v.question_id = v_canonical.question_id) then continue; end if;
      select s.correct_answer_data, s.explanation into v_correct_answer_data, v_explanation
      from public.question_version_secrets s where s.question_version_id = v_canonical.question_version_id;
      question_id := v_canonical.question_id;

    elsif v_source = 'manual' then
      select * into v_manual from public.learn_manual_questions
      where id = v_item_id and page_id = p_page_id;
      if v_manual is null then continue; end if;
      select s.correct_answer_data, s.explanation into v_correct_answer_data, v_explanation
      from public.learn_manual_question_secrets s where s.manual_question_id = v_manual.id;
      question_id := null;
    else
      continue;
    end if;

    if v_correct_answer_data is not null and v_student_answer is not null then
      v_answer_type := v_correct_answer_data->>'type';
      v_given := trim(coalesce(v_student_answer #>> '{}',''));

      if v_answer_type = 'mcq' then
        v_expected_option := trim(coalesce(v_correct_answer_data->>'value',''));
        if v_expected_option <> '' then v_correct := (v_given = v_expected_option); end if;

      elsif v_answer_type = 'numeric' then
        begin
          v_expected_num := (v_correct_answer_data->>'value')::numeric;
          v_given_num := regexp_replace(v_given, '[^0-9.\-]', '', 'g')::numeric;
          if v_expected_num = 0 then
            v_correct := abs(v_given_num) < coalesce((v_correct_answer_data->>'tolerance')::numeric, 0.01);
          else
            v_correct := abs((v_given_num - v_expected_num) / v_expected_num) < coalesce((v_correct_answer_data->>'tolerance')::numeric, 0.01);
          end if;
        exception when others then v_correct := null; end;

      elsif v_answer_type = 'text' then
        v_correct := lower(v_given) = lower(trim(coalesce(v_correct_answer_data->>'value','')));
        if not coalesce(v_correct,false) then
          for v_alt in select * from jsonb_array_elements(coalesce(v_correct_answer_data->'alternatives','[]'::jsonb)) loop
            if lower(v_given) = lower(trim(v_alt #>> '{}')) then v_correct := true; exit; end if;
          end loop;
        end if;
      end if;
    end if;

    item_id := v_item_id;
    source_type := v_source;
    is_correct := v_correct;
    correct_answer_data := v_correct_answer_data;
    explanation := v_explanation;
    return next;
  end loop;
end;
$$;
revoke all on function public.mark_learn_check_answers(uuid, jsonb) from public;
grant execute on function public.mark_learn_check_answers(uuid, jsonb) to authenticated;

commit;

-- Storage bucket: public-read lesson media; admin-only mutations.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'learn-media', 'learn-media', true, 104857600,
  array['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm','video/quicktime']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can upload learn media" on storage.objects;
create policy "Admins can upload learn media" on storage.objects for insert to authenticated
with check (bucket_id = 'learn-media' and public.is_admin());

drop policy if exists "Admins can update learn media" on storage.objects;
create policy "Admins can update learn media" on storage.objects for update to authenticated
using (bucket_id = 'learn-media' and public.is_admin())
with check (bucket_id = 'learn-media' and public.is_admin());

drop policy if exists "Admins can delete learn media" on storage.objects;
create policy "Admins can delete learn media" on storage.objects for delete to authenticated
using (bucket_id = 'learn-media' and public.is_admin());
