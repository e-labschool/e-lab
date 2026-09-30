-- e-Lab: Backup & Restore -- restore_elab_content RPC (additive, idempotent).
--
-- Adds exactly one function. Does not alter any existing table, column,
-- RLS policy, grant, or other function. Safe to run once on the live
-- database alongside the existing Learn CMS migrations.
--
-- WHY A FUNCTION AND NOT CLIENT-SIDE INSERT/UPDATE CALLS:
-- Supabase's JS client cannot span a multi-statement transaction across
-- separate .insert()/.update() calls. A single Postgres function body,
-- however, IS automatically transactional: if any statement inside this
-- function raises, every change the function made (in this call) is
-- rolled back as a unit -- there is no code here that opens/commits a
-- transaction explicitly because a function invocation already is one.
-- This is the real atomicity guarantee behind Restore; see
-- docs/BACKUP_AND_DISASTER_RECOVERY.md for the residual risks that remain
-- (e.g. two admins restoring concurrently, or a backup referencing
-- Question Bank rows that no longer exist -- those rows are skipped, not
-- fatal, and reported back to the caller).
--
-- SECURITY: SECURITY DEFINER + an explicit public.is_admin() check at the
-- top, exactly like every other privileged Learn RPC in this project
-- (publish_learn_page, mark_learn_check_answers, ...). Execute is revoked
-- from everyone by default and re-granted only to `authenticated`; RLS on
-- the underlying tables (public.is_admin()) remains the real backstop
-- even if this check were ever bypassed.
--
-- RESTORE SEMANTICS (must match src/lib/backup/restoreContent.js and the
-- Restore UI copy exactly -- see docs/ for the full description):
--   * A page is matched to an existing page by its NATURAL KEY
--     (parent_topic, lesson_code) -- the same pair the table's own UNIQUE
--     constraint already uses -- never by the backup's own id column. A
--     restored page never reuses its original database id.
--   * mode = 'merge': a page whose natural key does not yet exist is
--     inserted, with a FRESH id, along with all of its blocks/check
--     questions/manual questions (remapped to that fresh id). A page
--     whose natural key already exists is left COMPLETELY untouched --
--     merge only ever ADDS whole pages, it never edits an existing one.
--   * mode = 'replace': a page whose natural key already exists has its
--     metadata updated and ALL of its existing blocks/check
--     questions/manual questions deleted and replaced with the backup's
--     versions. A page whose natural key does not exist is inserted fresh
--     (same as merge).
--   * A check-question row is skipped (not fatal) if the referenced
--     questions/question_versions row no longer exists in the Question
--     Bank -- the Question Bank is a separate system outside this
--     backup's scope (see docs/), so this is a real possibility.

begin;

create or replace function public.restore_elab_content(p_payload jsonb, p_mode text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page jsonb;
  v_block jsonb;
  v_cq jsonb;
  v_mq jsonb;
  v_sec jsonb;
  v_old_page_id text;
  v_new_page_id uuid;
  v_mapped_page_id uuid;
  v_existing public.learn_pages;
  v_id_map jsonb := '{}'::jsonb;   -- old page id (text) -> new page id (text) or JSON null if merge-skipped
  v_mq_id_map jsonb := '{}'::jsonb; -- old manual question id (text) -> new manual question id (text)
  v_old_mq_id text;
  v_new_mq_id uuid;
  v_pages_inserted int := 0;
  v_pages_updated int := 0;
  v_pages_skipped int := 0;
  v_blocks_inserted int := 0;
  v_cq_inserted int := 0;
  v_cq_skipped int := 0;
  v_mq_inserted int := 0;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  if p_mode not in ('merge', 'replace') then
    raise exception 'Unsupported restore mode: %', coalesce(p_mode, '(null)');
  end if;

  -- ---------------- pages ----------------
  for v_page in select * from jsonb_array_elements(coalesce(p_payload->'learn_pages', '[]'::jsonb))
  loop
    v_old_page_id := v_page->>'id';
    if v_old_page_id is null or coalesce(v_page->>'parent_topic', '') = '' or coalesce(v_page->>'lesson_code', '') = '' then
      raise exception 'Malformed page row in backup payload (missing id/parent_topic/lesson_code)';
    end if;

    select * into v_existing from public.learn_pages
      where parent_topic = (v_page->>'parent_topic') and lesson_code = (v_page->>'lesson_code');

    if v_existing is null then
      insert into public.learn_pages (
        parent_topic, lesson_code, syllabus_codes, title, level,
        display_order, display_order_sl, display_order_hl, status, published_at
      ) values (
        v_page->>'parent_topic',
        v_page->>'lesson_code',
        coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(v_page->'syllabus_codes', '[]'::jsonb)) x), '{}'::text[]),
        v_page->>'title',
        coalesce(nullif(v_page->>'level', ''), 'SL/HL'),
        coalesce((v_page->>'display_order')::int, 0),
        coalesce((v_page->>'display_order_sl')::int, 0),
        coalesce((v_page->>'display_order_hl')::int, 0),
        coalesce(nullif(v_page->>'status', ''), 'draft'),
        nullif(v_page->>'published_at', '')::timestamptz
      ) returning id into v_new_page_id;
      v_pages_inserted := v_pages_inserted + 1;
      v_id_map := jsonb_set(v_id_map, array[v_old_page_id], to_jsonb(v_new_page_id::text));

    elsif p_mode = 'replace' then
      v_new_page_id := v_existing.id;
      update public.learn_pages set
        title = v_page->>'title',
        level = coalesce(nullif(v_page->>'level', ''), level),
        syllabus_codes = coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(v_page->'syllabus_codes', '[]'::jsonb)) x), syllabus_codes),
        display_order = coalesce((v_page->>'display_order')::int, display_order),
        display_order_sl = coalesce((v_page->>'display_order_sl')::int, display_order_sl),
        display_order_hl = coalesce((v_page->>'display_order_hl')::int, display_order_hl),
        status = coalesce(nullif(v_page->>'status', ''), status),
        published_at = nullif(v_page->>'published_at', '')::timestamptz
      where id = v_new_page_id;

      delete from public.learn_blocks where page_id = v_new_page_id;
      delete from public.learn_check_questions where page_id = v_new_page_id;
      delete from public.learn_manual_question_secrets
        where manual_question_id in (select id from public.learn_manual_questions where page_id = v_new_page_id);
      delete from public.learn_manual_questions where page_id = v_new_page_id;

      v_pages_updated := v_pages_updated + 1;
      v_id_map := jsonb_set(v_id_map, array[v_old_page_id], to_jsonb(v_new_page_id::text));

    else
      -- merge mode, page already exists: never touched. Its dependent
      -- rows in this payload are intentionally NOT imported either --
      -- merge only ever adds whole new pages (see header comment).
      v_pages_skipped := v_pages_skipped + 1;
      v_id_map := jsonb_set(v_id_map, array[v_old_page_id], 'null'::jsonb);
    end if;
  end loop;

  -- ---------------- blocks ----------------
  for v_block in select * from jsonb_array_elements(coalesce(p_payload->'learn_blocks', '[]'::jsonb))
  loop
    v_mapped_page_id := nullif(v_id_map->>(v_block->>'page_id'), '')::uuid;
    if v_mapped_page_id is null then continue; end if;
    insert into public.learn_blocks (page_id, block_type, content, position, visible)
    values (
      v_mapped_page_id,
      v_block->>'block_type',
      coalesce(v_block->'content', '{}'::jsonb),
      coalesce((v_block->>'position')::int, 0),
      coalesce((v_block->>'visible')::boolean, true)
    );
    v_blocks_inserted := v_blocks_inserted + 1;
  end loop;

  -- ---------------- canonical check questions ----------------
  for v_cq in select * from jsonb_array_elements(coalesce(p_payload->'learn_check_questions', '[]'::jsonb))
  loop
    v_mapped_page_id := nullif(v_id_map->>(v_cq->>'page_id'), '')::uuid;
    if v_mapped_page_id is null then continue; end if;

    if not exists (
      select 1 from public.question_versions v
      where v.id = (v_cq->>'question_version_id')::uuid and v.question_id = v_cq->>'question_id'
    ) then
      -- Referenced Question Bank item no longer exists -- skip this one
      -- assignment rather than fail the whole restore (see header note).
      v_cq_skipped := v_cq_skipped + 1;
      continue;
    end if;

    insert into public.learn_check_questions (page_id, question_id, question_version_id, position)
    values (v_mapped_page_id, v_cq->>'question_id', (v_cq->>'question_version_id')::uuid, coalesce((v_cq->>'position')::int, 0))
    on conflict (page_id, question_id) do nothing;
    v_cq_inserted := v_cq_inserted + 1;
  end loop;

  -- ---------------- manual questions + their secrets ----------------
  for v_mq in select * from jsonb_array_elements(coalesce(p_payload->'learn_manual_questions', '[]'::jsonb))
  loop
    v_mapped_page_id := nullif(v_id_map->>(v_mq->>'page_id'), '')::uuid;
    if v_mapped_page_id is null then continue; end if;
    v_old_mq_id := v_mq->>'id';

    insert into public.learn_manual_questions (page_id, question_type, question_text, options, stimulus, position)
    values (
      v_mapped_page_id,
      v_mq->>'question_type',
      v_mq->>'question_text',
      coalesce(v_mq->'options', '[]'::jsonb),
      coalesce(v_mq->'stimulus', '{}'::jsonb),
      coalesce((v_mq->>'position')::int, 0)
    ) returning id into v_new_mq_id;

    if v_old_mq_id is not null then
      v_mq_id_map := jsonb_set(v_mq_id_map, array[v_old_mq_id], to_jsonb(v_new_mq_id::text));
    end if;
    v_mq_inserted := v_mq_inserted + 1;
  end loop;

  for v_sec in select * from jsonb_array_elements(coalesce(p_payload->'learn_manual_question_secrets', '[]'::jsonb))
  loop
    v_new_mq_id := nullif(v_mq_id_map->>(v_sec->>'manual_question_id'), '')::uuid;
    if v_new_mq_id is null then continue; end if;
    insert into public.learn_manual_question_secrets (manual_question_id, correct_answer_data, explanation)
    values (v_new_mq_id, v_sec->'correct_answer_data', v_sec->>'explanation')
    on conflict (manual_question_id) do update
      set correct_answer_data = excluded.correct_answer_data,
          explanation = excluded.explanation,
          updated_at = now();
  end loop;

  return jsonb_build_object(
    'pagesInserted', v_pages_inserted,
    'pagesUpdated', v_pages_updated,
    'pagesSkipped', v_pages_skipped,
    'blocksInserted', v_blocks_inserted,
    'checkQuestionsInserted', v_cq_inserted,
    'checkQuestionsSkipped', v_cq_skipped,
    'manualQuestionsInserted', v_mq_inserted
  );
end;
$$;

revoke all on function public.restore_elab_content(jsonb, text) from public;
revoke all on function public.restore_elab_content(jsonb, text) from anon;
grant execute on function public.restore_elab_content(jsonb, text) to authenticated;

commit;
