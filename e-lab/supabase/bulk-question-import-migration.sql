-- e-Lab: Consolidated Question Import migration (NOT run)
-- Verified against the live database: exactly one existing
-- save_question_with_secrets() with the OLD 25-parameter signature.
-- This migration drops that exact signature and replaces it with a
-- single new 27-parameter canonical version (adds source,
-- syllabus_version), then adds the two new import RPCs. Nothing in this
-- file has been run before — this is the only migration needed for the
-- whole import feature on a fresh live database.
--
-- public.maybe_create_question_version() is not touched.

begin;

-- ============================================================
-- STEP 1 — remove the OLD 25-parameter save_question_with_secrets,
-- by its exact verified signature (never a bare unqualified DROP).
-- ============================================================
drop function if exists public.save_question_with_secrets(
  text, text, text, text, text, text, text, text, text, text, text, int,
  text[], text[], text, jsonb, jsonb, jsonb, numeric, boolean, boolean, text, jsonb, jsonb, text
);

-- ============================================================
-- STEP 2 — the single new canonical 27-parameter version.
-- ============================================================
create function public.save_question_with_secrets(
  p_question_id text,
  p_curriculum_section text, p_topic_code text, p_topic_title text, p_unit_code text, p_unit_title text,
  p_concept text, p_level text, p_paper text, p_question_type text, p_difficulty text, p_marks int,
  p_command_terms text[], p_tags text[], p_question_content text, p_visual_data jsonb, p_parts jsonb, p_options jsonb,
  p_estimated_minutes numeric, p_data_booklet_required boolean, p_calculator_required boolean, p_status text,
  p_correct_answer_data jsonb, p_markscheme jsonb, p_explanation text,
  p_source text default 'e-Lab Original',
  p_syllabus_version text default 'First assessment 2025'
)
returns public.questions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_question public.questions;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  insert into public.questions (
    id, curriculum_section, topic_code, topic_title, unit_code, unit_title, concept, level, paper,
    question_type, difficulty, marks, command_terms, tags, question_content, visual_data, parts, options,
    estimated_minutes, data_booklet_required, calculator_required, status, source, syllabus_version, created_by
  )
  values (
    p_question_id, p_curriculum_section, p_topic_code, p_topic_title, p_unit_code, p_unit_title, p_concept,
    p_level, p_paper, p_question_type, p_difficulty, p_marks, p_command_terms, p_tags, p_question_content,
    p_visual_data, p_parts, p_options, p_estimated_minutes, p_data_booklet_required, p_calculator_required,
    p_status, p_source, p_syllabus_version, auth.uid()
  )
  on conflict (id) do update set
    curriculum_section = excluded.curriculum_section, topic_code = excluded.topic_code, topic_title = excluded.topic_title,
    unit_code = excluded.unit_code, unit_title = excluded.unit_title, concept = excluded.concept, level = excluded.level,
    paper = excluded.paper, question_type = excluded.question_type, difficulty = excluded.difficulty, marks = excluded.marks,
    command_terms = excluded.command_terms, tags = excluded.tags, question_content = excluded.question_content,
    visual_data = excluded.visual_data, parts = excluded.parts, options = excluded.options,
    estimated_minutes = excluded.estimated_minutes, data_booklet_required = excluded.data_booklet_required,
    calculator_required = excluded.calculator_required, status = excluded.status,
    source = excluded.source, syllabus_version = excluded.syllabus_version, updated_at = now()
  returning * into v_question;

  insert into public.question_secrets (question_id, correct_answer_data, markscheme, explanation)
  values (p_question_id, p_correct_answer_data, p_markscheme, p_explanation)
  on conflict (question_id) do update set
    correct_answer_data = excluded.correct_answer_data, markscheme = excluded.markscheme,
    explanation = excluded.explanation, updated_at = now();

  perform public.maybe_create_question_version(p_question_id);

  return v_question;
end;
$$;

revoke all on function public.save_question_with_secrets(
  text, text, text, text, text, text, text, text, text, text, text, int,
  text[], text[], text, jsonb, jsonb, jsonb, numeric, boolean, boolean, text, jsonb, jsonb, text,
  text, text
) from public;
grant execute on function public.save_question_with_secrets(
  text, text, text, text, text, text, text, text, text, text, text, int,
  text[], text[], text, jsonb, jsonb, jsonb, numeric, boolean, boolean, text, jsonb, jsonb, text,
  text, text
) to authenticated;

-- ============================================================
-- STEP 3 — classify_question_import: authoritative NEW/UNCHANGED/UPDATE
-- classification, comparing full canonical content AND secrets
-- server-side. Returns only the classification label per id — never the
-- secret values themselves.
-- ============================================================
create or replace function public.classify_question_import(p_questions jsonb)
returns table (question_id text, classification text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_id text;
  v_existing public.questions;
  v_existing_secrets public.question_secrets;
  v_new_snapshot jsonb;
  v_existing_snapshot jsonb;
  v_new_secrets_snapshot jsonb;
  v_existing_secrets_snapshot jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  for v_item in select * from jsonb_array_elements(p_questions)
  loop
    v_id := v_item->>'id';
    select * into v_existing from public.questions where id = v_id;

    if v_existing is null then
      question_id := v_id;
      classification := 'new';
      return next;
      continue;
    end if;

    select * into v_existing_secrets from public.question_secrets where question_id = v_id;

    v_new_snapshot := jsonb_build_object(
      'id', v_item->>'id',
      'curriculum_section', v_item->>'curriculumSection',
      'topic_code', v_item->>'topicCode', 'topic_title', v_item->>'topicTitle',
      'unit_code', v_item->>'unitCode', 'unit_title', v_item->>'unitTitle',
      'concept', v_item->>'concept', 'level', v_item->>'level', 'paper', v_item->>'paper',
      'question_type', v_item->>'questionType', 'difficulty', v_item->>'difficulty',
      'marks', (v_item->>'marks')::int,
      'command_terms', coalesce(v_item->'commandTerms', '[]'::jsonb),
      'tags', coalesce(v_item->'tags', '[]'::jsonb),
      'question_content', v_item->>'questionContent',
      'visual_data', v_item->'visualData', 'parts', v_item->'parts', 'options', v_item->'options',
      'estimated_minutes', (v_item->>'estimatedMinutes')::numeric,
      'data_booklet_required', coalesce((v_item->>'dataBookletRequired')::boolean, false),
      'calculator_required', coalesce((v_item->>'calculatorRequired')::boolean, false),
      'source', coalesce(v_item->>'source', 'e-Lab Original'),
      'syllabus_version', coalesce(v_item->>'syllabusVersion', 'First assessment 2025')
    );

    v_existing_snapshot := jsonb_build_object(
      'id', v_existing.id,
      'curriculum_section', v_existing.curriculum_section,
      'topic_code', v_existing.topic_code, 'topic_title', v_existing.topic_title,
      'unit_code', v_existing.unit_code, 'unit_title', v_existing.unit_title,
      'concept', v_existing.concept, 'level', v_existing.level, 'paper', v_existing.paper,
      'question_type', v_existing.question_type, 'difficulty', v_existing.difficulty, 'marks', v_existing.marks,
      'command_terms', to_jsonb(v_existing.command_terms), 'tags', to_jsonb(v_existing.tags),
      'question_content', v_existing.question_content, 'visual_data', v_existing.visual_data,
      'parts', v_existing.parts, 'options', v_existing.options,
      'estimated_minutes', v_existing.estimated_minutes,
      'data_booklet_required', v_existing.data_booklet_required,
      'calculator_required', v_existing.calculator_required,
      'source', v_existing.source, 'syllabus_version', v_existing.syllabus_version
    );

    v_new_secrets_snapshot := jsonb_build_object(
      'correct_answer_data', v_item->'correctAnswerData',
      'markscheme', v_item->'markscheme',
      'explanation', v_item->>'explanation'
    );
    v_existing_secrets_snapshot := jsonb_build_object(
      'correct_answer_data', v_existing_secrets.correct_answer_data,
      'markscheme', v_existing_secrets.markscheme,
      'explanation', v_existing_secrets.explanation
    );

    question_id := v_id;
    if v_new_snapshot is distinct from v_existing_snapshot
       or v_new_secrets_snapshot is distinct from v_existing_secrets_snapshot
    then
      classification := 'update';
    else
      classification := 'unchanged';
    end if;
    return next;
  end loop;
end;
$$;

revoke all on function public.classify_question_import(jsonb) from public;
revoke all on function public.classify_question_import(jsonb) from anon;
grant execute on function public.classify_question_import(jsonb) to authenticated;

-- ============================================================
-- STEP 4 — bulk_import_questions: transactional, all-or-nothing.
-- A plpgsql function body is one transaction by default: any unhandled
-- exception anywhere in the loop aborts and rolls back everything
-- already inserted earlier in the SAME call — reusing
-- save_question_with_secrets() per question, no separate insert/version
-- logic anywhere.
-- ============================================================
create or replace function public.bulk_import_questions(p_questions jsonb)
returns table (imported_id text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  for v_item in select * from jsonb_array_elements(p_questions)
  loop
    perform public.save_question_with_secrets(
      v_item->>'p_question_id', v_item->>'p_curriculum_section', v_item->>'p_topic_code',
      v_item->>'p_topic_title', v_item->>'p_unit_code', v_item->>'p_unit_title', v_item->>'p_concept',
      v_item->>'p_level', v_item->>'p_paper', v_item->>'p_question_type', v_item->>'p_difficulty',
      (v_item->>'p_marks')::int,
      array(select jsonb_array_elements_text(coalesce(v_item->'p_command_terms', '[]'::jsonb))),
      array(select jsonb_array_elements_text(coalesce(v_item->'p_tags', '[]'::jsonb))),
      v_item->>'p_question_content', v_item->'p_visual_data', v_item->'p_parts', v_item->'p_options',
      (v_item->>'p_estimated_minutes')::numeric, (v_item->>'p_data_booklet_required')::boolean,
      (v_item->>'p_calculator_required')::boolean, v_item->>'p_status',
      v_item->'p_correct_answer_data', v_item->'p_markscheme', v_item->>'p_explanation',
      coalesce(v_item->>'p_source', 'e-Lab Original'),
      coalesce(v_item->>'p_syllabus_version', 'First assessment 2025')
    );
    imported_id := v_item->>'p_question_id';
    return next;
  end loop;
end;
$$;

revoke all on function public.bulk_import_questions(jsonb) from public;
revoke all on function public.bulk_import_questions(jsonb) from anon;
grant execute on function public.bulk_import_questions(jsonb) to authenticated;

commit;
