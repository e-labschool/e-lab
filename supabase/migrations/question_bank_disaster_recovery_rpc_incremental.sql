-- e-Lab: Question Bank / Question Paper Complete Disaster Recovery
-- gap closure (additive, idempotent). Adds THREE new functions. Does NOT
-- alter restore_elab_content, restore_elab_disaster_data, any existing
-- table, column, RLS policy, or grant. Safe to run once on the live
-- database alongside every prior migration.
--
-- READ THIS FIRST — SCHEMA RECOVERY GAP (see src/lib/backup/constants.js
-- SCHEMA_RECOVERY_GAPS and docs/DISASTER_RECOVERY.md for the full audit):
-- public.questions, public.question_secrets, public.question_versions,
-- public.question_version_secrets, public.question_papers and
-- public.question_paper_items are REAL, LIVE tables that real,
-- unmodified application code reads and writes today — but NONE of them
-- have a `create table` migration anywhere in this repository. This file
-- does NOT attempt to create or guess those tables' schemas (per explicit
-- instruction: never fabricate a migration from assumptions). It only
-- adds functions that REFERENCE those tables by the exact column names
-- real application code already proves exist (see the citations in
-- SCHEMA_RECOVERY_GAPS). If any referenced table/column genuinely does
-- not exist on the database this runs against, creating these functions
-- still succeeds (plpgsql bodies are not schema-checked at CREATE time)
-- but CALLING them will fail at that point — exactly the same "cannot
-- promise a fresh/foreign project already has this schema" honesty this
-- whole gap-closure update is built around.
--
-- WHY A BULK EXPORT RPC IS NEEDED (not just .from("question_secrets")):
-- get-admin-question-secrets-migration.sql's own header comment confirms
-- "Grants no direct table access to question_secrets" — table-level
-- SELECT is revoked entirely, even for admins, exactly like
-- learn_manual_question_secrets. The existing get_admin_question_secrets
-- RPC only returns ONE question's secrets at a time (p_question_id) —
-- fine for the Question Editor, useless for a disaster backup that must
-- read EVERY row. These two new RPCs are the bulk, admin-only equivalent,
-- same SECURITY DEFINER + is_admin() + revoke/grant pattern as every
-- other privileged RPC in this project.
--
-- WHY A SEPARATE RESTORE RPC (not added to restore_elab_disaster_data):
-- that existing function's own header states it is scoped to
-- USER_DATA_TABLES/PROGRESS_DATA_TABLES/ASSESSMENT_DATA_TABLES/
-- PLANNING_DATA_TABLES/SETTINGS_TABLES and declares itself NOT altered by
-- future additions ("Does NOT alter ... any existing table ... Safe to
-- run once ... alongside every prior migration"). Question Bank/Question
-- Paper restore is kept in its own function here instead, called
-- separately by disasterRestore.js — extending the proven staged-restore
-- pattern, never rewriting the existing RPC.
--
-- RESTORE ID STRATEGY: unlike profiles/student_challenges/class_plans
-- (which remap ids because a fresh project's auth.users ids differ from
-- the backup's), questions/question_versions/question_papers/
-- question_paper_items ids are NEVER remapped here — they are inserted
-- with their ORIGINAL id (`on conflict (id) do update`), preserving
-- every foreign key between them exactly as captured (spec: "Preserve
-- EXACTLY: primary IDs, foreign keys ... version relationships ...
-- paper item ordering"). Only `questions.created_by` and
-- `question_papers.user_id` go through the identity map, exactly like
-- resources.created_by and every other per-user-owned table.

begin;

-- ============================================================
-- admin_export_question_secrets — bulk read of EVERY question_secrets
-- row, admin-only. Never exposed to non-admin roles; the Admin UI itself
-- never renders these values (see AdminBackupRestore.jsx) — this exists
-- purely so Complete Disaster Recovery can capture them inside the
-- protected .zip package, per spec: "secret application fields ... may
-- exist inside the protected disaster package if required for
-- application restoration, but never display answer/secret contents in
-- logs or summaries."
-- ============================================================
create or replace function public.admin_export_question_secrets()
returns setof public.question_secrets
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  return query select * from public.question_secrets;
end;
$$;

revoke all on function public.admin_export_question_secrets() from public;
revoke all on function public.admin_export_question_secrets() from anon;
grant execute on function public.admin_export_question_secrets() to authenticated;

-- ============================================================
-- admin_export_question_version_secrets — same bulk-read pattern, for the
-- version-pinned secrets table used by Learn's canonical-question secure
-- marking. No prior RPC of any kind exposed this table in bulk OR singly.
-- ============================================================
create or replace function public.admin_export_question_version_secrets()
returns setof public.question_version_secrets
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  return query select * from public.question_version_secrets;
end;
$$;

revoke all on function public.admin_export_question_version_secrets() from public;
revoke all on function public.admin_export_question_version_secrets() from anon;
grant execute on function public.admin_export_question_version_secrets() to authenticated;

-- ============================================================
-- restore_elab_question_bank_data — restores questions, question_secrets,
-- question_versions, question_version_secrets, question_papers and
-- question_paper_items from a Complete Disaster Recovery package, in
-- strict dependency order, inside ONE transaction (this function body) —
-- same atomicity guarantee as restore_elab_disaster_data.
--
-- Every insert is wrapped in its own `exception when undefined_table`
-- block, exactly like the existing tolerant tables (user_preferences/
-- prediction_cycles/class_plans/lesson_blocks) — here specifically
-- because of the documented SCHEMA RECOVERY GAP: this function cannot
-- promise the target database already has these tables, since no
-- migration in this repository can be pointed at to guarantee it. A
-- missing table is recorded via `tableMissing` + `schemaRecoveryGap` in
-- the returned jsonb, never silently swallowed and never a reason to
-- abort restoring every OTHER table this call already committed.
-- ============================================================
create or replace function public.restore_elab_question_bank_data(p_payload jsonb, p_id_map jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_counts jsonb := '{}'::jsonb;
  v_inserted int;
  v_skipped int;
  v_new_creator_uid uuid;
  v_new_uid uuid;
  v_questions_table_missing boolean := false;
  v_question_secrets_table_missing boolean := false;
  v_question_versions_table_missing boolean := false;
  v_question_version_secrets_table_missing boolean := false;
  v_question_papers_table_missing boolean := false;
  v_question_paper_items_table_missing boolean := false;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  -- ---------------- questions (root of the Question Bank graph; created_by nullable, never skips a row) ----------------
  v_inserted := 0; v_skipped := 0;
  begin
    for v_row in select * from jsonb_array_elements(coalesce(p_payload->'questions', '[]'::jsonb))
    loop
      v_new_creator_uid := nullif(p_id_map->>(v_row->>'created_by'), '')::uuid;
      insert into public.questions (
        id, curriculum_section, topic_code, topic_title, unit_code, unit_title, concept, level, paper,
        question_type, difficulty, marks, command_terms, tags, question_content, visual_data, parts, options,
        estimated_minutes, data_booklet_required, calculator_required, status, source, syllabus_version, created_by
      ) values (
        v_row->>'id', v_row->>'curriculum_section', v_row->>'topic_code', v_row->>'topic_title', v_row->>'unit_code',
        v_row->>'unit_title', v_row->>'concept', v_row->>'level', v_row->>'paper', v_row->>'question_type',
        v_row->>'difficulty', (v_row->>'marks')::int,
        coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(v_row->'command_terms', '[]'::jsonb)) x), '{}'::text[]),
        coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(v_row->'tags', '[]'::jsonb)) x), '{}'::text[]),
        v_row->>'question_content', v_row->'visual_data', v_row->'parts', v_row->'options',
        (v_row->>'estimated_minutes')::numeric, coalesce((v_row->>'data_booklet_required')::boolean, false),
        coalesce((v_row->>'calculator_required')::boolean, false), coalesce(v_row->>'status', 'draft'),
        v_row->>'source', v_row->>'syllabus_version', v_new_creator_uid
      )
      on conflict (id) do update set
        curriculum_section = excluded.curriculum_section, topic_code = excluded.topic_code, topic_title = excluded.topic_title,
        unit_code = excluded.unit_code, unit_title = excluded.unit_title, concept = excluded.concept, level = excluded.level,
        paper = excluded.paper, question_type = excluded.question_type, difficulty = excluded.difficulty, marks = excluded.marks,
        command_terms = excluded.command_terms, tags = excluded.tags, question_content = excluded.question_content,
        visual_data = excluded.visual_data, parts = excluded.parts, options = excluded.options,
        estimated_minutes = excluded.estimated_minutes, data_booklet_required = excluded.data_booklet_required,
        calculator_required = excluded.calculator_required, status = excluded.status,
        source = excluded.source, syllabus_version = excluded.syllabus_version;
      v_inserted := v_inserted + 1;
    end loop;
  exception when undefined_table then
    -- SCHEMA RECOVERY GAP (see this file's header): the target database
    -- genuinely does not have public.questions. Recorded, not raised —
    -- every other table restored by this call must still commit.
    v_questions_table_missing := true;
  end;
  v_counts := jsonb_set(v_counts, '{questions}', jsonb_build_object('restored', v_inserted, 'skippedNoIdentity', v_skipped, 'tableMissing', v_questions_table_missing, 'schemaRecoveryGap', true));

  -- ---------------- question_secrets (FK to questions.id; never displayed, only restored) ----------------
  v_inserted := 0; v_skipped := 0;
  begin
    for v_row in select * from jsonb_array_elements(coalesce(p_payload->'question_secrets', '[]'::jsonb))
    loop
      insert into public.question_secrets (question_id, correct_answer_data, markscheme, explanation)
      values (v_row->>'question_id', v_row->'correct_answer_data', v_row->'markscheme', v_row->>'explanation')
      on conflict (question_id) do update set
        correct_answer_data = excluded.correct_answer_data, markscheme = excluded.markscheme, explanation = excluded.explanation;
      v_inserted := v_inserted + 1;
    end loop;
  exception when undefined_table then
    v_question_secrets_table_missing := true;
  end;
  v_counts := jsonb_set(v_counts, '{question_secrets}', jsonb_build_object('restored', v_inserted, 'skippedNoIdentity', v_skipped, 'tableMissing', v_question_secrets_table_missing, 'schemaRecoveryGap', true));

  -- ---------------- question_versions (FK to questions.id; id preserved exactly, referenced by question_paper_items/question_version_secrets) ----------------
  v_inserted := 0; v_skipped := 0;
  begin
    for v_row in select * from jsonb_array_elements(coalesce(p_payload->'question_versions', '[]'::jsonb))
    loop
      insert into public.question_versions (id, question_id, version_number, content_snapshot)
      values ((v_row->>'id')::uuid, v_row->>'question_id', (v_row->>'version_number')::int, v_row->'content_snapshot')
      on conflict (id) do update set
        question_id = excluded.question_id, version_number = excluded.version_number, content_snapshot = excluded.content_snapshot;
      v_inserted := v_inserted + 1;
    end loop;
  exception when undefined_table then
    v_question_versions_table_missing := true;
  end;
  v_counts := jsonb_set(v_counts, '{question_versions}', jsonb_build_object('restored', v_inserted, 'skippedNoIdentity', v_skipped, 'tableMissing', v_question_versions_table_missing, 'schemaRecoveryGap', true));

  -- ---------------- question_version_secrets (FK to question_versions.id) ----------------
  v_inserted := 0; v_skipped := 0;
  begin
    for v_row in select * from jsonb_array_elements(coalesce(p_payload->'question_version_secrets', '[]'::jsonb))
    loop
      insert into public.question_version_secrets (question_version_id, correct_answer_data, explanation)
      values ((v_row->>'question_version_id')::uuid, v_row->'correct_answer_data', v_row->>'explanation')
      on conflict (question_version_id) do update set
        correct_answer_data = excluded.correct_answer_data, explanation = excluded.explanation;
      v_inserted := v_inserted + 1;
    end loop;
  exception when undefined_table then
    v_question_version_secrets_table_missing := true;
  end;
  v_counts := jsonb_set(v_counts, '{question_version_secrets}', jsonb_build_object('restored', v_inserted, 'skippedNoIdentity', v_skipped, 'tableMissing', v_question_version_secrets_table_missing, 'schemaRecoveryGap', true));

  -- ---------------- question_papers (user_id NOT nullable in practice — every real paper is user-owned, so an unmappable identity SKIPS the row, same rule as student_challenges/class_plans) ----------------
  v_inserted := 0; v_skipped := 0;
  begin
    for v_row in select * from jsonb_array_elements(coalesce(p_payload->'question_papers', '[]'::jsonb))
    loop
      v_new_uid := nullif(p_id_map->>(v_row->>'user_id'), '')::uuid;
      if v_new_uid is null then
        v_skipped := v_skipped + 1; continue;
      end if;
      insert into public.question_papers (id, user_id, title, paper, level, status)
      values ((v_row->>'id')::uuid, v_new_uid, coalesce(v_row->>'title', 'Untitled paper'), v_row->>'paper', v_row->>'level', coalesce(v_row->>'status', 'draft'))
      on conflict (id) do update set
        user_id = excluded.user_id, title = excluded.title, paper = excluded.paper, level = excluded.level, status = excluded.status;
      v_inserted := v_inserted + 1;
    end loop;
  exception when undefined_table then
    v_question_papers_table_missing := true;
  end;
  v_counts := jsonb_set(v_counts, '{question_papers}', jsonb_build_object('restored', v_inserted, 'skippedNoIdentity', v_skipped, 'tableMissing', v_question_papers_table_missing, 'schemaRecoveryGap', true));

  -- ---------------- question_paper_items (FK to question_papers.id, NULLABLE FK to question_versions.id; ordering preserved via `position`) ----------------
  v_inserted := 0; v_skipped := 0;
  begin
    for v_row in select * from jsonb_array_elements(coalesce(p_payload->'question_paper_items', '[]'::jsonb))
    loop
      insert into public.question_paper_items (id, paper_id, position, question_version_id, custom_question, marks_override)
      values (
        (v_row->>'id')::uuid, (v_row->>'paper_id')::uuid, coalesce((v_row->>'position')::int, 0),
        nullif(v_row->>'question_version_id','')::uuid, v_row->'custom_question', (v_row->>'marks_override')::numeric
      )
      on conflict (id) do update set
        paper_id = excluded.paper_id, position = excluded.position, question_version_id = excluded.question_version_id,
        custom_question = excluded.custom_question, marks_override = excluded.marks_override;
      v_inserted := v_inserted + 1;
    end loop;
  exception when undefined_table then
    v_question_paper_items_table_missing := true;
  end;
  v_counts := jsonb_set(v_counts, '{question_paper_items}', jsonb_build_object('restored', v_inserted, 'skippedNoIdentity', v_skipped, 'tableMissing', v_question_paper_items_table_missing, 'schemaRecoveryGap', true));

  return v_counts;
end;
$$;

revoke all on function public.restore_elab_question_bank_data(jsonb, jsonb) from public;
revoke all on function public.restore_elab_question_bank_data(jsonb, jsonb) from anon;
grant execute on function public.restore_elab_question_bank_data(jsonb, jsonb) to authenticated;

commit;
