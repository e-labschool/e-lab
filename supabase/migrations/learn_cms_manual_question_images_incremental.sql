-- e-Lab Learn CMS incremental migration
-- Run ONLY if the earlier manual-question/media migration is already live.
-- Adds optional image stimulus support to Learn-only manual Check Your Understanding questions.
-- Page Break is JSONB block content and needs no database change.

begin;

alter table public.learn_manual_questions
  add column if not exists stimulus jsonb not null default '{}'::jsonb;

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

commit;
