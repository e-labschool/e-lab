-- e-Lab: Complete Disaster Recovery -- restore_elab_disaster_data RPC
-- (additive, idempotent). Adds exactly one new function. Does NOT alter
-- restore_elab_content, any existing table, column, RLS policy, or grant.
-- Safe to run once on the live database alongside every prior migration.
--
-- SCOPE: this function restores the APPLICATION USER / PROGRESS /
-- ASSESSMENT / PLANNING / SETTINGS tables audited in
-- src/lib/backup/constants.js (USER_DATA_TABLES, PROGRESS_DATA_TABLES,
-- ASSESSMENT_DATA_TABLES, PLANNING_DATA_TABLES, SETTINGS_TABLES). It is
-- deliberately separate from restore_elab_content (educational content),
-- exactly like the existing RPC already keeps Learn content restore
-- independent of everything else -- this is the same pattern, extended,
-- not a rewrite of it (see backup_restore_rpc_incremental.sql).
--
-- WHY THIS CANNOT RECREATE auth.users ITSELF:
-- public.profiles.id is a foreign key into auth.users(id), which is
-- Supabase-managed schema this project does not own. Creating an
-- auth.users row (with a real, safely-hashed password / sign-in method)
-- requires Supabase's Admin API, which requires a service-role secret --
-- something that must NEVER run in this React frontend (see
-- src/lib/supabaseClient.js's own header comment, and spec section 12).
-- This function therefore does NOT attempt to create or touch auth.users
-- at all. Instead it takes `p_id_map` -- a jsonb object of
-- { "<old user id>": "<new/target user id already present in auth.users
-- on THIS database>" } -- built by the admin, out-of-band, via whatever
-- Supabase-native recovery/relinking procedure applies (see
-- docs/DISASTER_RECOVERY.md "Restoring users" for the two supported
-- scenarios: (a) same auth.users still exist -> identity map is old id ->
-- same id, or (b) fresh project, users re-invited/recreated -> identity
-- map is old id -> their new auth id). Every old user id absent from
-- p_id_map is SKIPPED for every table, reported back by count, and NEVER
-- silently attached to a different, unrelated account (spec section 11's
-- explicit requirement).
--
-- ATOMICITY: a single plpgsql function body is one Postgres transaction --
-- if anything inside raises, everything this call did is rolled back, the
-- same guarantee restore_elab_content already relies on. This does NOT
-- cover Storage (media) restoration, which cannot share a transaction
-- with Postgres table writes -- see disasterRestore.js for the staged,
-- compensating-cleanup design that covers that separately (spec §24).
--
-- SECURITY: SECURITY DEFINER + public.is_admin(), matching every other
-- privileged RPC in this project. Execute revoked from everyone, then
-- re-granted only to `authenticated`; RLS on every underlying table
-- remains the real backstop regardless.

begin;

create or replace function public.restore_elab_disaster_data(p_payload jsonb, p_id_map jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_old_uid text;
  v_new_uid uuid;
  v_counts jsonb := '{}'::jsonb;
  v_inserted int;
  v_skipped int;
  v_old_plan_id text;
  v_new_plan_id uuid;
  v_plan_id_map jsonb := '{}'::jsonb;
  v_old_cycle_id text;
  v_new_cycle_id uuid;
  v_cycle_id_map jsonb := '{}'::jsonb;
  v_old_challenge_id text;
  v_new_challenge_id uuid;
  v_challenge_id_map jsonb := '{}'::jsonb;
  -- user_preferences is audited OPTIONAL (src/lib/backup/constants.js) --
  -- small per-user UI-state table that may not exist on every project
  -- (see that file's audit note). If the TARGET database restored into
  -- also lacks it, this flag records that rather than aborting the
  -- whole restore transaction over one non-critical table.
  v_user_preferences_table_missing boolean := false;
  -- 2026-10 schema reconciliation: prediction_cycles/prediction_snapshots
  -- were RECLASSIFIED OPTIONAL in src/lib/backup/constants.js after the
  -- live Complete Disaster Recovery export reported "Could not find the
  -- table 'public.prediction_cycles' in the schema cache" — direct
  -- evidence this migration's own `create table` statements
  -- (prediction_cycles_incremental.sql) have not actually been applied to
  -- every live project, exactly like user_preferences before it. Same
  -- tolerant pattern applied here for consistency on the restore side.
  v_prediction_cycles_table_missing boolean := false;
  v_prediction_snapshots_table_missing boolean := false;
  -- 2026-10 reconciliation, part 2: class_plans/lesson_blocks are
  -- RECLASSIFIED `not_deployed_if_missing` in src/lib/backup/constants.js
  -- (a live export confirmed this project's class-planner-migration.sql
  -- has never been applied here). Same tolerant pattern as the OPTIONAL
  -- tables above applies on restore: a TARGET database that also lacks
  -- these tables must not abort this whole function (every other table's
  -- restore has to commit regardless) — it is recorded instead. This is
  -- the "does a disaster package where these are marked not_deployed
  -- restore safely" guarantee the backup side's not_deployed/zero-row
  -- recording depends on.
  v_class_plans_table_missing boolean := false;
  v_lesson_blocks_table_missing boolean := false;
  -- resources.created_by is a NULLABLE creator reference, not a strict
  -- per-row owner — a row with no mappable creator is still restored
  -- (never skipped), with attribution set to null rather than dropping
  -- real library content over an identity-map gap.
  v_new_creator_uid uuid;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  -- ---------------- profiles (the root of every user-owned table) ----------------
  v_inserted := 0; v_skipped := 0;
  for v_row in select * from jsonb_array_elements(coalesce(p_payload->'profiles', '[]'::jsonb))
  loop
    v_old_uid := v_row->>'id';
    v_new_uid := nullif(p_id_map->>v_old_uid, '')::uuid;
    if v_new_uid is null or not exists (select 1 from auth.users where id = v_new_uid) then
      v_skipped := v_skipped + 1; continue;
    end if;
    insert into public.profiles (id, email, full_name, role, school, country, grade_or_class, curriculum, level, status)
    values (
      v_new_uid, v_row->>'email', coalesce(v_row->>'full_name', ''), coalesce(v_row->>'role', 'student'),
      v_row->>'school', v_row->>'country', v_row->>'grade_or_class',
      coalesce(v_row->>'curriculum', 'IB Diploma Programme'), v_row->>'level',
      coalesce(v_row->>'status', 'active')
    )
    on conflict (id) do update set
      email = excluded.email, full_name = excluded.full_name, role = excluded.role,
      school = excluded.school, country = excluded.country, grade_or_class = excluded.grade_or_class,
      curriculum = excluded.curriculum, level = excluded.level, status = excluded.status;
    v_inserted := v_inserted + 1;
  end loop;
  v_counts := jsonb_set(v_counts, '{profiles}', jsonb_build_object('restored', v_inserted, 'skippedNoIdentity', v_skipped));

  -- ---------------- user_access ----------------
  v_inserted := 0; v_skipped := 0;
  for v_row in select * from jsonb_array_elements(coalesce(p_payload->'user_access', '[]'::jsonb))
  loop
    v_new_uid := nullif(p_id_map->>(v_row->>'user_id'), '')::uuid;
    if v_new_uid is null or not exists (select 1 from public.profiles where id = v_new_uid) then
      v_skipped := v_skipped + 1; continue;
    end if;
    insert into public.user_access (user_id, plan, starts_at, expires_at)
    values (v_new_uid, coalesce(v_row->>'plan', 'free'), nullif(v_row->>'starts_at','')::timestamptz, nullif(v_row->>'expires_at','')::timestamptz)
    on conflict (user_id) do update set plan = excluded.plan, starts_at = excluded.starts_at, expires_at = excluded.expires_at;
    v_inserted := v_inserted + 1;
  end loop;
  v_counts := jsonb_set(v_counts, '{user_access}', jsonb_build_object('restored', v_inserted, 'skippedNoIdentity', v_skipped));

  -- ---------------- user_preferences (OPTIONAL — see declare block) ----------------
  v_inserted := 0; v_skipped := 0;
  begin
    for v_row in select * from jsonb_array_elements(coalesce(p_payload->'user_preferences', '[]'::jsonb))
    loop
      v_new_uid := nullif(p_id_map->>(v_row->>'user_id'), '')::uuid;
      if v_new_uid is null or not exists (select 1 from public.profiles where id = v_new_uid) then
        v_skipped := v_skipped + 1; continue;
      end if;
      insert into public.user_preferences (user_id, last_student_route, last_concept_id, sidebar_collapsed, theme)
      values (v_new_uid, v_row->>'last_student_route', v_row->>'last_concept_id', coalesce((v_row->>'sidebar_collapsed')::boolean, false), v_row->>'theme')
      on conflict (user_id) do update set
        last_student_route = excluded.last_student_route, last_concept_id = excluded.last_concept_id,
        sidebar_collapsed = excluded.sidebar_collapsed, theme = excluded.theme;
      v_inserted := v_inserted + 1;
    end loop;
  exception when undefined_table then
    -- The target database genuinely doesn't have this OPTIONAL table.
    -- Recorded, not raised — restoring every other (required) table must
    -- still succeed and commit.
    v_user_preferences_table_missing := true;
  end;
  v_counts := jsonb_set(
    v_counts, '{user_preferences}',
    jsonb_build_object('restored', v_inserted, 'skippedNoIdentity', v_skipped, 'tableMissing', v_user_preferences_table_missing)
  );

  -- ---------------- learning_progress ----------------
  v_inserted := 0; v_skipped := 0;
  for v_row in select * from jsonb_array_elements(coalesce(p_payload->'learning_progress', '[]'::jsonb))
  loop
    v_new_uid := nullif(p_id_map->>(v_row->>'user_id'), '')::uuid;
    if v_new_uid is null or not exists (select 1 from public.profiles where id = v_new_uid) then
      v_skipped := v_skipped + 1; continue;
    end if;
    insert into public.learning_progress (user_id, concept_id, curriculum_code, status, best_check_score, last_check_score, attempt_count, first_opened_at, last_visited_at, completed_at)
    values (
      v_new_uid, v_row->>'concept_id', v_row->>'curriculum_code', coalesce(v_row->>'status', 'not_started'),
      (v_row->>'best_check_score')::int, (v_row->>'last_check_score')::int, coalesce((v_row->>'attempt_count')::int, 0),
      nullif(v_row->>'first_opened_at','')::timestamptz, nullif(v_row->>'last_visited_at','')::timestamptz, nullif(v_row->>'completed_at','')::timestamptz
    )
    on conflict (user_id, concept_id) do update set
      curriculum_code = excluded.curriculum_code, status = excluded.status,
      best_check_score = excluded.best_check_score, last_check_score = excluded.last_check_score,
      attempt_count = excluded.attempt_count, first_opened_at = excluded.first_opened_at,
      last_visited_at = excluded.last_visited_at, completed_at = excluded.completed_at;
    v_inserted := v_inserted + 1;
  end loop;
  v_counts := jsonb_set(v_counts, '{learning_progress}', jsonb_build_object('restored', v_inserted, 'skippedNoIdentity', v_skipped));

  -- ---------------- concept_attempts (append-only log) ----------------
  v_inserted := 0; v_skipped := 0;
  for v_row in select * from jsonb_array_elements(coalesce(p_payload->'concept_attempts', '[]'::jsonb))
  loop
    v_new_uid := nullif(p_id_map->>(v_row->>'user_id'), '')::uuid;
    if v_new_uid is null or not exists (select 1 from public.profiles where id = v_new_uid) then
      v_skipped := v_skipped + 1; continue;
    end if;
    insert into public.concept_attempts (user_id, concept_id, question_id, is_correct, attempted_at)
    values (v_new_uid, v_row->>'concept_id', v_row->>'question_id', coalesce((v_row->>'is_correct')::boolean, false), coalesce(nullif(v_row->>'attempted_at','')::timestamptz, now()));
    v_inserted := v_inserted + 1;
  end loop;
  v_counts := jsonb_set(v_counts, '{concept_attempts}', jsonb_build_object('restored', v_inserted, 'skippedNoIdentity', v_skipped));

  -- ---------------- prediction_cycles (OPTIONAL — see declare block; id remapped; referenced by prediction_snapshots) ----------------
  v_inserted := 0; v_skipped := 0;
  begin
    for v_row in select * from jsonb_array_elements(coalesce(p_payload->'prediction_cycles', '[]'::jsonb))
    loop
      v_new_uid := nullif(p_id_map->>(v_row->>'user_id'), '')::uuid;
      v_old_cycle_id := v_row->>'id';
      if v_new_uid is null or not exists (select 1 from public.profiles where id = v_new_uid) then
        v_skipped := v_skipped + 1; continue;
      end if;
      insert into public.prediction_cycles (user_id, cycle_number, started_at, ended_at, is_active)
      values (v_new_uid, (v_row->>'cycle_number')::int, coalesce(nullif(v_row->>'started_at','')::timestamptz, now()), nullif(v_row->>'ended_at','')::timestamptz, coalesce((v_row->>'is_active')::boolean, false))
      on conflict (user_id, cycle_number) do update set started_at = excluded.started_at, ended_at = excluded.ended_at, is_active = excluded.is_active
      returning id into v_new_cycle_id;
      if v_old_cycle_id is not null then
        v_cycle_id_map := jsonb_set(v_cycle_id_map, array[v_old_cycle_id], to_jsonb(v_new_cycle_id::text));
      end if;
      v_inserted := v_inserted + 1;
    end loop;
  exception when undefined_table then
    -- The target database genuinely doesn't have this table (same
    -- "migration file exists in the repo, was never actually run against
    -- this live project" situation user_preferences hit first). Recorded,
    -- not raised — every other required table must still commit.
    v_prediction_cycles_table_missing := true;
  end;
  v_counts := jsonb_set(
    v_counts, '{prediction_cycles}',
    jsonb_build_object('restored', v_inserted, 'skippedNoIdentity', v_skipped, 'tableMissing', v_prediction_cycles_table_missing)
  );

  -- ---------------- prediction_snapshots (OPTIONAL — see declare block; append-only; FK to prediction_cycles) ----------------
  v_inserted := 0; v_skipped := 0;
  begin
    for v_row in select * from jsonb_array_elements(coalesce(p_payload->'prediction_snapshots', '[]'::jsonb))
    loop
      v_new_uid := nullif(p_id_map->>(v_row->>'user_id'), '')::uuid;
      v_new_cycle_id := nullif(v_cycle_id_map->>(v_row->>'prediction_cycle_id'), '')::uuid;
      if v_new_uid is null or v_new_cycle_id is null then
        v_skipped := v_skipped + 1; continue;
      end if;
      insert into public.prediction_snapshots (
        user_id, prediction_cycle_id, estimated_grade, estimated_grade_low, estimated_grade_high, estimated_percentage,
        confidence, overall_performance, recent_performance, syllabus_coverage, difficulty_performance, consistency_score,
        evidence_challenges, evidence_marks, calculated_at
      ) values (
        v_new_uid, v_new_cycle_id, (v_row->>'estimated_grade')::int, (v_row->>'estimated_grade_low')::int, (v_row->>'estimated_grade_high')::int,
        (v_row->>'estimated_percentage')::numeric, coalesce(v_row->>'confidence', 'low'), (v_row->>'overall_performance')::numeric,
        (v_row->>'recent_performance')::numeric, (v_row->>'syllabus_coverage')::numeric, (v_row->>'difficulty_performance')::numeric,
        (v_row->>'consistency_score')::numeric, coalesce((v_row->>'evidence_challenges')::int, 0), (v_row->>'evidence_marks')::numeric,
        coalesce(nullif(v_row->>'calculated_at','')::timestamptz, now())
      );
      v_inserted := v_inserted + 1;
    end loop;
  exception when undefined_table then
    v_prediction_snapshots_table_missing := true;
  end;
  v_counts := jsonb_set(
    v_counts, '{prediction_snapshots}',
    jsonb_build_object('restored', v_inserted, 'skippedNoIdentity', v_skipped, 'tableMissing', v_prediction_snapshots_table_missing)
  );

  -- ---------------- student_streaks ----------------
  v_inserted := 0; v_skipped := 0;
  for v_row in select * from jsonb_array_elements(coalesce(p_payload->'student_streaks', '[]'::jsonb))
  loop
    v_new_uid := nullif(p_id_map->>(v_row->>'user_id'), '')::uuid;
    if v_new_uid is null or not exists (select 1 from public.profiles where id = v_new_uid) then
      v_skipped := v_skipped + 1; continue;
    end if;
    insert into public.student_streaks (user_id, current_streak, longest_streak, last_qualifying_date)
    values (v_new_uid, coalesce((v_row->>'current_streak')::int, 0), coalesce((v_row->>'longest_streak')::int, 0), nullif(v_row->>'last_qualifying_date','')::date)
    on conflict (user_id) do update set current_streak = excluded.current_streak, longest_streak = excluded.longest_streak, last_qualifying_date = excluded.last_qualifying_date;
    v_inserted := v_inserted + 1;
  end loop;
  v_counts := jsonb_set(v_counts, '{student_streaks}', jsonb_build_object('restored', v_inserted, 'skippedNoIdentity', v_skipped));

  -- ---------------- student_challenges (id remapped; referenced by challenge_questions) ----------------
  v_inserted := 0; v_skipped := 0;
  for v_row in select * from jsonb_array_elements(coalesce(p_payload->'student_challenges', '[]'::jsonb))
  loop
    v_new_uid := nullif(p_id_map->>(v_row->>'user_id'), '')::uuid;
    v_old_challenge_id := v_row->>'id';
    if v_new_uid is null or v_old_challenge_id is null then
      v_skipped := v_skipped + 1; continue;
    end if;
    insert into public.student_challenges (
      user_id, topic_codes, level, mode, question_count, time_limit_seconds, style, status,
      current_question_index, flagged_question_ids, started_at, submitted_at, duration_seconds,
      score, max_score, focus_violation_count, termination_reason
    ) values (
      v_new_uid,
      coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(v_row->'topic_codes', '[]'::jsonb)) x), '{}'::text[]),
      coalesce(v_row->>'level','SL'), coalesce(v_row->>'mode','questions'), coalesce((v_row->>'question_count')::int, 0),
      (v_row->>'time_limit_seconds')::int, coalesce(v_row->>'style','balanced'), coalesce(v_row->>'status','submitted'),
      coalesce((v_row->>'current_question_index')::int, 0),
      coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(v_row->'flagged_question_ids', '[]'::jsonb)) x), '{}'::text[]),
      coalesce(nullif(v_row->>'started_at','')::timestamptz, now()), nullif(v_row->>'submitted_at','')::timestamptz,
      (v_row->>'duration_seconds')::int, (v_row->>'score')::numeric, (v_row->>'max_score')::numeric,
      coalesce((v_row->>'focus_violation_count')::int, 0), v_row->>'termination_reason'
    ) returning id into v_new_challenge_id;
    v_challenge_id_map := jsonb_set(v_challenge_id_map, array[v_old_challenge_id], to_jsonb(v_new_challenge_id::text));
    v_inserted := v_inserted + 1;
  end loop;
  v_counts := jsonb_set(v_counts, '{student_challenges}', jsonb_build_object('restored', v_inserted, 'skippedNoIdentity', v_skipped));

  -- ---------------- challenge_questions (FK to student_challenges) ----------------
  v_inserted := 0; v_skipped := 0;
  for v_row in select * from jsonb_array_elements(coalesce(p_payload->'challenge_questions', '[]'::jsonb))
  loop
    v_new_uid := nullif(p_id_map->>(v_row->>'user_id'), '')::uuid;
    v_new_challenge_id := nullif(v_challenge_id_map->>(v_row->>'challenge_id'), '')::uuid;
    if v_new_uid is null or v_new_challenge_id is null then
      v_skipped := v_skipped + 1; continue;
    end if;
    insert into public.challenge_questions (challenge_id, user_id, question_id, position, topic_code, student_answer, is_correct, marks_awarded, marks_possible, answered_at)
    values (
      v_new_challenge_id, v_new_uid, v_row->>'question_id', coalesce((v_row->>'position')::int, 0), v_row->>'topic_code',
      v_row->'student_answer', (v_row->>'is_correct')::boolean, (v_row->>'marks_awarded')::numeric,
      coalesce((v_row->>'marks_possible')::numeric, 0), nullif(v_row->>'answered_at','')::timestamptz
    )
    on conflict (challenge_id, question_id) do nothing;
    v_inserted := v_inserted + 1;
  end loop;
  v_counts := jsonb_set(v_counts, '{challenge_questions}', jsonb_build_object('restored', v_inserted, 'skippedNoIdentity', v_skipped));

  -- ---------------- class_plans (OPTIONAL/not_deployed_if_missing — see declare block; id remapped; referenced by lesson_blocks) ----------------
  v_inserted := 0; v_skipped := 0;
  begin
    for v_row in select * from jsonb_array_elements(coalesce(p_payload->'class_plans', '[]'::jsonb))
    loop
      v_new_uid := nullif(p_id_map->>(v_row->>'user_id'), '')::uuid;
      v_old_plan_id := v_row->>'id';
      if v_new_uid is null or v_old_plan_id is null then
        v_skipped := v_skipped + 1; continue;
      end if;
      insert into public.class_plans (user_id, title, class_group, topic_code, level, duration_minutes, planned_date, status)
      values (v_new_uid, coalesce(v_row->>'title',''), v_row->>'class_group', v_row->>'topic_code', v_row->>'level', coalesce((v_row->>'duration_minutes')::int, 60), nullif(v_row->>'planned_date','')::date, coalesce(v_row->>'status','draft'))
      returning id into v_new_plan_id;
      v_plan_id_map := jsonb_set(v_plan_id_map, array[v_old_plan_id], to_jsonb(v_new_plan_id::text));
      v_inserted := v_inserted + 1;
    end loop;
  exception when undefined_table then
    -- The target database doesn't have this table either (Class Planner
    -- not deployed there, same as the source project this package was
    -- backed up from — see declare block). Recorded, not raised — every
    -- other table's restore must still commit. The payload here is
    -- normally already zero rows (the export recorded `not_deployed` with
    -- zero rows for this exact reason), so this branch mainly guards a
    -- package restored into a DIFFERENT project than it was made from.
    v_class_plans_table_missing := true;
  end;
  v_counts := jsonb_set(
    v_counts, '{class_plans}',
    jsonb_build_object('restored', v_inserted, 'skippedNoIdentity', v_skipped, 'tableMissing', v_class_plans_table_missing)
  );

  -- ---------------- lesson_blocks (OPTIONAL/not_deployed_if_missing — see declare block; FK to class_plans) ----------------
  v_inserted := 0; v_skipped := 0;
  begin
    for v_row in select * from jsonb_array_elements(coalesce(p_payload->'lesson_blocks', '[]'::jsonb))
    loop
      v_new_uid := nullif(p_id_map->>(v_row->>'user_id'), '')::uuid;
      v_new_plan_id := nullif(v_plan_id_map->>(v_row->>'class_plan_id'), '')::uuid;
      if v_new_uid is null or v_new_plan_id is null then
        v_skipped := v_skipped + 1; continue;
      end if;
      insert into public.lesson_blocks (class_plan_id, user_id, position, block_type, title, content, duration_minutes, source_type, source_ref, teacher_notes, student_facing)
      values (
        v_new_plan_id, v_new_uid, coalesce((v_row->>'position')::int, 0), coalesce(v_row->>'block_type','Custom'),
        coalesce(v_row->>'title',''), v_row->'content', (v_row->>'duration_minutes')::int,
        coalesce(v_row->>'source_type','custom'), v_row->>'source_ref', v_row->>'teacher_notes', coalesce((v_row->>'student_facing')::boolean, true)
      );
      v_inserted := v_inserted + 1;
    end loop;
  exception when undefined_table then
    v_lesson_blocks_table_missing := true;
  end;
  v_counts := jsonb_set(
    v_counts, '{lesson_blocks}',
    jsonb_build_object('restored', v_inserted, 'skippedNoIdentity', v_skipped, 'tableMissing', v_lesson_blocks_table_missing)
  );

  -- ---------------- resources (2026-10 reconciliation addition — see
  -- src/lib/backup/constants.js's BACKUP_DATASETS audit note: this table
  -- was a genuine silent gap, present in neither backup nor restore
  -- before now). created_by is nullable, so an unmappable creator does
  -- NOT skip the row — only attribution is lost, the resource itself is
  -- always restored. ----------------
  v_inserted := 0; v_skipped := 0;
  for v_row in select * from jsonb_array_elements(coalesce(p_payload->'resources', '[]'::jsonb))
  loop
    v_new_creator_uid := nullif(p_id_map->>(v_row->>'created_by'), '')::uuid;
    insert into public.resources (
      title, description, audience, category, curriculum, topic, subtopic, level,
      resource_type, file_path, external_url, original_file_name, mime_type, file_size,
      status, is_locked, access_tier, created_by
    ) values (
      coalesce(v_row->>'title', ''), v_row->>'description', coalesce(v_row->>'audience', 'both'),
      coalesce(v_row->>'category', ''), coalesce(v_row->>'curriculum', 'dp-chemistry'), v_row->>'topic', v_row->>'subtopic',
      v_row->>'level', coalesce(v_row->>'resource_type', ''), v_row->>'file_path', v_row->>'external_url',
      v_row->>'original_file_name', v_row->>'mime_type', (v_row->>'file_size')::bigint,
      coalesce(v_row->>'status', 'draft'), coalesce((v_row->>'is_locked')::boolean, false),
      coalesce(v_row->>'access_tier', 'free'), v_new_creator_uid
    );
    v_inserted := v_inserted + 1;
  end loop;
  v_counts := jsonb_set(v_counts, '{resources}', jsonb_build_object('restored', v_inserted, 'skippedNoIdentity', v_skipped));

  -- ---------------- platform_settings (singleton; no user_id at all) ----------------
  v_inserted := 0;
  if p_payload ? 'platform_settings' and jsonb_typeof(p_payload->'platform_settings') = 'object' then
    v_row := p_payload->'platform_settings';
    update public.platform_settings set
      platform_name = coalesce(v_row->>'platform_name', platform_name),
      tagline = coalesce(v_row->>'tagline', tagline),
      support_email = v_row->>'support_email',
      contact_email = v_row->>'contact_email',
      allow_student_registration = coalesce((v_row->>'allow_student_registration')::boolean, allow_student_registration),
      allow_teacher_registration = coalesce((v_row->>'allow_teacher_registration')::boolean, allow_teacher_registration),
      default_curriculum = coalesce(v_row->>'default_curriculum', default_curriculum),
      default_resource_access = coalesce(v_row->>'default_resource_access', default_resource_access),
      maintenance_mode = coalesce((v_row->>'maintenance_mode')::boolean, maintenance_mode),
      maintenance_message = coalesce(v_row->>'maintenance_message', maintenance_message)
    where id = 1;
    v_inserted := 1;
  end if;
  v_counts := jsonb_set(v_counts, '{platform_settings}', jsonb_build_object('restored', v_inserted, 'skippedNoIdentity', 0));

  return v_counts;
end;
$$;

revoke all on function public.restore_elab_disaster_data(jsonb, jsonb) from public;
revoke all on function public.restore_elab_disaster_data(jsonb, jsonb) from anon;
grant execute on function public.restore_elab_disaster_data(jsonb, jsonb) to authenticated;

commit;
