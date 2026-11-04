-- e-Lab incremental migration: SL/HL Learn access + independent lesson flow
-- Safe to run once on the live database after the existing Learn CMS migrations.
-- Does not modify question_versions, question secrets, or historical attempts.

begin;

-- Independent ordering for SL and HL student paths.
alter table public.learn_pages
  add column if not exists display_order_sl int,
  add column if not exists display_order_hl int;

update public.learn_pages
set display_order_sl = coalesce(display_order_sl, display_order),
    display_order_hl = coalesce(display_order_hl, display_order)
where display_order_sl is null or display_order_hl is null;

alter table public.learn_pages
  alter column display_order_sl set default 0,
  alter column display_order_hl set default 0;

update public.learn_pages set display_order_sl = 0 where display_order_sl is null;
update public.learn_pages set display_order_hl = 0 where display_order_hl is null;

alter table public.learn_pages
  alter column display_order_sl set not null,
  alter column display_order_hl set not null;

create index if not exists learn_pages_ordering_sl_idx on public.learn_pages(parent_topic, display_order_sl, id);
create index if not exists learn_pages_ordering_hl_idx on public.learn_pages(parent_topic, display_order_hl, id);

-- Replace the broad published-page read policy with a level-aware one.
-- HL students may read every published lesson (SL + HL).
-- SL students may read published SL/shared lessons but never HL-only lessons.
-- Teachers and other non-student authenticated profiles retain access to all published lessons.
drop policy if exists "Anyone authenticated can read published learn pages" on public.learn_pages;
drop policy if exists "Authenticated can read permitted published learn pages" on public.learn_pages;
create policy "Authenticated can read permitted published learn pages"
  on public.learn_pages for select
  using (
    status = 'published'
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (
          p.role <> 'student'
          or upper(coalesce(p.level, 'SL')) = 'HL'
          or upper(coalesce(learn_pages.level, 'SL/HL')) <> 'HL'
        )
    )
  );

-- Block-level audience lives inside existing JSONB as content.audience.
-- Missing audience means shared/backward-compatible content.
-- This keeps HL-only additions out of SL reads even inside a shared lesson.
drop policy if exists "Anyone authenticated can read visible blocks of published pages" on public.learn_blocks;
drop policy if exists "Authenticated can read permitted visible learn blocks" on public.learn_blocks;
create policy "Authenticated can read permitted visible learn blocks"
  on public.learn_blocks for select
  using (
    visible = true
    and exists (
      select 1
      from public.learn_pages lp
      join public.profiles p on p.id = auth.uid()
      where lp.id = learn_blocks.page_id
        and lp.status = 'published'
        and (
          p.role <> 'student'
          or upper(coalesce(p.level, 'SL')) = 'HL'
          or (
            upper(coalesce(lp.level, 'SL/HL')) <> 'HL'
            and lower(coalesce(learn_blocks.content->>'audience', 'both')) <> 'hl'
          )
        )
    )
  );

-- Existing Admin policies remain in place and continue to allow Admin
-- editing/preview access regardless of student level.

grant select, insert, update, delete on public.learn_pages to authenticated;
grant select, insert, update, delete on public.learn_blocks to authenticated;

-- Security-definer Learn-check RPCs must enforce the same SL/HL access
-- themselves because SECURITY DEFINER can bypass table RLS.
create or replace function public.can_access_learn_page_for_current_user(p_page_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.learn_pages lp
    join public.profiles p on p.id = auth.uid()
    where lp.id = p_page_id
      and lp.status = 'published'
      and (
        public.is_admin()
        or p.role <> 'student'
        or upper(coalesce(p.level, 'SL')) = 'HL'
        or upper(coalesce(lp.level, 'SL/HL')) <> 'HL'
      )
  );
$$;

revoke all on function public.can_access_learn_page_for_current_user(uuid) from public;
grant execute on function public.can_access_learn_page_for_current_user(uuid) to authenticated;

create or replace function public.can_access_learn_check_for_current_user(p_page_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_access_learn_page_for_current_user(p_page_id)
    and not exists (
      select 1
      from public.learn_blocks b
      join public.profiles p on p.id = auth.uid()
      where b.page_id = p_page_id
        and b.block_type = 'check_understanding'
        and b.visible = true
        and not public.is_admin()
        and p.role = 'student'
        and upper(coalesce(p.level, 'SL')) <> 'HL'
        and lower(coalesce(b.content->>'audience', 'both')) = 'hl'
    );
$$;

revoke all on function public.can_access_learn_check_for_current_user(uuid) from public;
grant execute on function public.can_access_learn_check_for_current_user(uuid) to authenticated;

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
declare
  v_is_hl boolean := false;
begin
  if auth.uid() is null then raise exception 'Not authorized'; end if;
  if not public.can_access_learn_check_for_current_user(p_page_id) then
    raise exception 'This lesson content is not available for your course level.';
  end if;

  select coalesce(p.role <> 'student' or upper(coalesce(p.level, 'SL')) = 'HL', false)
  into v_is_hl
  from public.profiles p
  where p.id = auth.uid();

  return query
  select c.id,
         'canonical'::text,
         c.question_id,
         c.position,
         jsonb_build_object(
           'id', c.question_id,
           'questionText', coalesce(v.content_snapshot->>'question_content',''),
           'questionType', coalesce(v.content_snapshot->>'question_type','Short Response'),
           'level', coalesce(v.content_snapshot->>'level','SL/HL'),
           'marks', v.content_snapshot->'marks',
           'stimulus', v.content_snapshot->'visual_data',
           'options', coalesce(v.content_snapshot->'options','[]'::jsonb),
           'parts', coalesce(v.content_snapshot->'parts','[]'::jsonb)
         )
  from public.learn_check_questions c
  join public.question_versions v on v.id = c.question_version_id and v.question_id = c.question_id
  where c.page_id = p_page_id
    and (v_is_hl or upper(coalesce(v.content_snapshot->>'level','SL/HL')) <> 'HL')

  union all

  select m.id,
         'manual'::text,
         null::text,
         m.position,
         jsonb_build_object(
           'id', 'manual:' || m.id::text,
           'questionText', m.question_text,
           'questionType', case when m.question_type = 'mcq' then 'MCQ' else 'Short Response' end,
           'level', 'SL/HL',
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

create or replace function public.mark_learn_check_answers(p_page_id uuid, p_items jsonb)
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
  v_is_hl boolean := false;
  v_question_level text;
begin
  if auth.uid() is null then raise exception 'Not authorized'; end if;
  if not public.can_access_learn_check_for_current_user(p_page_id) then
    raise exception 'This lesson content is not available for your course level.';
  end if;

  select coalesce(p.role <> 'student' or upper(coalesce(p.level, 'SL')) = 'HL', false)
  into v_is_hl
  from public.profiles p
  where p.id = auth.uid();

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

      select coalesce(v.content_snapshot->>'level','SL/HL') into v_question_level
      from public.question_versions v where v.id = v_canonical.question_version_id;
      if not v_is_hl and upper(coalesce(v_question_level,'SL/HL')) = 'HL' then continue; end if;

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

notify pgrst, 'reload schema';

commit;
